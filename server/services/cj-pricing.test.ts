// Tests for the per-variant price sync job.
//
// HERMETIC: the CJ HTTP boundary is mocked (a fake `fetch`) and persistence goes
// through the injected `PriceSyncStore` seam, so nothing here touches the network
// or a database. The behaviours that MUST be pinned are the ones that cost real
// money if they regress:
//
//   * IDEMPOTENT - a second run with unchanged supplier costs writes nothing.
//   * NEVER ZERO - a variant CJ does not price is left EXACTLY as it was.
//   * NEVER BELOW THE FLOOR - every written price is at least cost + the margin.
//   * NEVER BREAKS THE STORE - a CJ failure on one product does not stop the rest.
import { beforeEach, describe, expect, it } from "vitest";
import { CjClient, resetCjTokenCache, type FetchLike } from "./cj-client";
import {
  parseCostCents,
  runVariantPriceSync,
  type PriceProduct,
  type PriceSyncStore,
} from "./cj-pricing";
import { retailPriceCents, minMarginCents } from "../../shared/pricing";

// Keep the QPS queue from spending a real second per call in tests.
process.env.CJ_MIN_INTERVAL_MS = "0";

const TOKEN = {
  accessToken: "tok-123",
  accessTokenExpiryDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
  refreshToken: "ref-123",
  refreshTokenExpiryDate: new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString(),
};

/** A fake fetch that answers CJ's envelope shape. */
function clientWith(handlers: Record<string, (url: string, init?: RequestInit) => unknown>) {
  const fetchImpl: FetchLike = async (url) => {
    for (const [needle, handler] of Object.entries(handlers)) {
      if (url.includes(needle)) {
        const data = handler(url);
        return new Response(JSON.stringify({ code: 200, result: true, message: "ok", data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response(
      JSON.stringify({ code: 1600200, result: false, message: "no handler", data: null }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return new CjClient({ fetchImpl, apiKey: "CJ123@api@test", liveMode: false });
}

/** An in-memory store that records every write. */
function makeStore(products: PriceProduct[]) {
  const variantWrites: { id: string; price: number }[] = [];
  const productWrites: { id: string; price: number }[] = [];
  const store: PriceSyncStore = {
    async listProductsWithPid() {
      return products;
    },
    async setVariantPrice(id, price) {
      variantWrites.push({ id, price });
    },
    async setProductPrice(id, price) {
      productWrites.push({ id, price });
    },
  };
  return { store, variantWrites, productWrites };
}

beforeEach(() => {
  resetCjTokenCache();
});

describe("parseCostCents", () => {
  it("accepts a positive number or numeric string", () => {
    expect(parseCostCents(17.96)).toBe(1796);
    expect(parseCostCents("18.4")).toBe(1840);
  });

  it("rejects anything that is not a positive amount - never zero", () => {
    expect(parseCostCents(0)).toBeNull();
    expect(parseCostCents("0")).toBeNull();
    expect(parseCostCents(-3)).toBeNull();
    expect(parseCostCents(undefined)).toBeNull();
    expect(parseCostCents(null)).toBeNull();
    expect(parseCostCents("abc")).toBeNull();
    expect(parseCostCents(NaN)).toBeNull();
  });
});

describe("runVariantPriceSync", () => {
  it("writes the rule's price for each variant and reprices the product to the cheapest", async () => {
    const client = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "product/query": () => ({
        pid: "p1",
        variants: [
          { vid: "vid-a", variantSellPrice: 17.96 },
          { vid: "vid-b", variantSellPrice: 18.4 },
        ],
      }),
    });
    const { store, variantWrites, productWrites } = makeStore([
      {
        id: "prod-1",
        slug: "s",
        priceCents: 9999,
        pid: "p1",
        variants: [
          { id: "v-a", sku: "A", cjVid: "vid-a", priceCents: 9999 },
          { id: "v-b", sku: "B", cjVid: "vid-b", priceCents: 9999 },
        ],
      },
    ]);

    const summary = await runVariantPriceSync({ client, store });

    expect(summary.updated).toBe(2);
    expect(variantWrites).toEqual([
      { id: "v-a", price: retailPriceCents(1796) },
      { id: "v-b", price: retailPriceCents(1840) },
    ]);
    // The product's own price is the CHEAPEST variant.
    expect(productWrites).toEqual([
      { id: "prod-1", price: Math.min(retailPriceCents(1796), retailPriceCents(1840)) },
    ]);
  });

  it("is idempotent - a second run with unchanged costs writes nothing", async () => {
    const client = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "product/query": () => ({ pid: "p1", variants: [{ vid: "vid-a", variantSellPrice: 17.96 }] }),
    });
    const already = retailPriceCents(1796);
    const { store, variantWrites, productWrites } = makeStore([
      {
        id: "prod-1",
        slug: "s",
        priceCents: already,
        pid: "p1",
        variants: [{ id: "v-a", sku: "A", cjVid: "vid-a", priceCents: already }],
      },
    ]);

    const summary = await runVariantPriceSync({ client, store });

    expect(summary.updated).toBe(0);
    expect(summary.unchanged).toBe(1);
    expect(variantWrites).toHaveLength(0);
    expect(productWrites).toHaveLength(0);
  });

  it("leaves a variant CJ does not price EXACTLY as it was - never zeroed", async () => {
    const client = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      // CJ returns no price for vid-b.
      "product/query": () => ({ pid: "p1", variants: [{ vid: "vid-a", variantSellPrice: 17.96 }] }),
    });
    const { store, variantWrites } = makeStore([
      {
        id: "prod-1",
        slug: "s",
        priceCents: 5000,
        pid: "p1",
        variants: [
          { id: "v-a", sku: "A", cjVid: "vid-a", priceCents: 5000 },
          { id: "v-b", sku: "B", cjVid: "vid-b", priceCents: 5000 },
        ],
      },
    ]);

    const summary = await runVariantPriceSync({ client, store });

    expect(summary.skipped).toBe(1);
    // Only v-a was written; v-b was left untouched (no write at all).
    expect(variantWrites.map((w) => w.id)).toEqual(["v-a"]);
  });

  it("never writes a price below cost + the margin floor", async () => {
    const client = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      // A very cheap item: the multiplier alone would leave too little.
      "product/query": () => ({ pid: "p1", variants: [{ vid: "vid-a", variantSellPrice: 0.5 }] }),
    });
    const { store, variantWrites } = makeStore([
      {
        id: "prod-1",
        slug: "s",
        priceCents: 100,
        pid: "p1",
        variants: [{ id: "v-a", sku: "A", cjVid: "vid-a", priceCents: 100 }],
      },
    ]);

    await runVariantPriceSync({ client, store });

    const written = variantWrites[0].price;
    expect(written).toBeGreaterThanOrEqual(50 + minMarginCents());
  });

  it("keeps going when one product fails on CJ - the rest still sync", async () => {
    let call = 0;
    const fetchImpl: FetchLike = async (url) => {
      if (url.includes("authentication/getAccessToken")) {
        return new Response(JSON.stringify({ code: 200, result: true, message: "ok", data: TOKEN }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      call += 1;
      // The first product errors; the second succeeds.
      if (call === 1) {
        return new Response(JSON.stringify({ code: 500, result: false, message: "boom", data: null }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          code: 200,
          result: true,
          message: "ok",
          data: { pid: "p2", variants: [{ vid: "vid-b", variantSellPrice: 20 }] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const client = new CjClient({ fetchImpl, apiKey: "CJ123@api@test", liveMode: false });
    const { store, variantWrites } = makeStore([
      {
        id: "prod-1",
        slug: "bad",
        priceCents: 100,
        pid: "p1",
        variants: [{ id: "v-a", sku: "A", cjVid: "vid-a", priceCents: 100 }],
      },
      {
        id: "prod-2",
        slug: "good",
        priceCents: 100,
        pid: "p2",
        variants: [{ id: "v-b", sku: "B", cjVid: "vid-b", priceCents: 100 }],
      },
    ]);

    const summary = await runVariantPriceSync({ client, store });

    expect(summary.failed).toBe(1);
    expect(summary.updated).toBe(1);
    expect(variantWrites).toEqual([{ id: "v-b", price: retailPriceCents(2000) }]);
  });

  it("no-ops cleanly when the integration is not configured", async () => {
    const client = new CjClient({ apiKey: "", liveMode: false });
    const { store, variantWrites } = makeStore([]);
    const summary = await runVariantPriceSync({ client, store });
    expect(summary.checked).toBe(0);
    expect(variantWrites).toHaveLength(0);
  });
});
