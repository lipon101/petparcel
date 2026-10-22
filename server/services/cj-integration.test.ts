// Tests for the CJdropshipping integration.
//
// HERMETIC: the CJ HTTP boundary is mocked (a fake `fetch`), and persistence
// goes through the injected seams, so nothing here touches the network or a
// database. The one behaviour that MUST be pinned is the idempotency guard: a
// doubled payment webhook must place exactly ONE CJ order. That is the failure
// that costs real money (two supplier orders, one customer), so it is tested
// from the outside - call the forward path twice, count the CJ calls.
import { beforeEach, describe, expect, it } from "vitest";
import {
  CjClient,
  CjNotConfiguredError,
  resetCjTokenCache,
  type FetchLike,
} from "./cj-client";
import {
  buildOrderLines,
  forwardOrderToCj,
  toCountryCode,
  type ForwardStore,
  type ForwardableLine,
  type ForwardableOrder,
} from "./cj-order-forward";
import { runStockSync, runTrackingSync, isSuspiciousStockDrop, totalStock, type SyncStore } from "./cj-sync";

// Keep the QPS queue from spending a real second per call in tests.
process.env.CJ_MIN_INTERVAL_MS = "0";

const TOKEN = {
  accessToken: "tok-123",
  accessTokenExpiryDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
  refreshToken: "ref-123",
  refreshTokenExpiryDate: new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString(),
};

/** A fake fetch that answers CJ's envelope shape and records every call. */
function makeFetch(handlers: Record<string, (url: string, init?: RequestInit) => unknown>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    for (const [needle, handler] of Object.entries(handlers)) {
      if (url.includes(needle)) {
        const data = handler(url, init);
        return new Response(JSON.stringify({ code: 200, result: true, message: "ok", data }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ code: 1600200, result: false, message: "no handler", data: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

function clientWith(handlers: Record<string, (url: string, init?: RequestInit) => unknown>) {
  const { fetchImpl, calls } = makeFetch(handlers);
  const client = new CjClient({ fetchImpl, apiKey: "CJ123@api@test", liveMode: false });
  return { client, calls };
}

beforeEach(() => {
  resetCjTokenCache();
});

// ── VID mapping ──────────────────────────────────────────────────────────────
describe("buildOrderLines", () => {
  it("maps each line to its CJ VID", () => {
    const lines: ForwardableLine[] = [
      { variantId: "v1", nameSnapshot: "White", qty: 1, cjVid: "2504030718511602500" },
      { variantId: "v2", nameSnapshot: "Military Green-S", qty: 2, cjVid: "1643077881620336640" },
    ];
    const built = buildOrderLines(lines);
    expect("lines" in built).toBe(true);
    if ("lines" in built) {
      expect(built.lines).toEqual([
        { vid: "2504030718511602500", quantity: 1 },
        { vid: "1643077881620336640", quantity: 2 },
      ]);
    }
  });

  it("REFUSES to build an order when a line has no VID, naming the line", () => {
    const built = buildOrderLines([
      { variantId: "v1", nameSnapshot: "White", qty: 1, cjVid: "2504030718511602500" },
      { variantId: "v2", nameSnapshot: "Mystery Option", qty: 1, cjVid: null },
    ]);
    expect("error" in built).toBe(true);
    if ("error" in built) expect(built.error).toContain("Mystery Option");
  });

  it("refuses an order with no lines", () => {
    expect("error" in buildOrderLines([])).toBe(true);
  });
});

describe("toCountryCode", () => {
  it("passes a two-letter code through uppercased", () => {
    expect(toCountryCode("us")).toBe("US");
  });
  it("maps common country names", () => {
    expect(toCountryCode("United States")).toBe("US");
    expect(toCountryCode("United Kingdom")).toBe("GB");
    expect(toCountryCode("Canada")).toBe("CA");
  });
});

// ── Order payload construction ───────────────────────────────────────────────
describe("createOrder payload", () => {
  it("sends the real CJ fields, sandbox by default, and the mapped VIDs", async () => {
    const { client, calls } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "shopping/order/createOrderV2": () => ({ orderId: "CJ-ORDER-1", orderNumber: "PP-1001", cjOrderId: "CJ-ORDER-1" }),
    });

    const result = await client.createOrder({
      orderNumber: "PP-1001",
      shippingCountryCode: "US",
      shippingCountry: "United States",
      shippingProvince: "TX",
      shippingCity: "Dallas",
      shippingCustomerName: "Jane Doe",
      shippingAddress: "1 Main St",
      shippingZip: "75001",
      email: "jane@example.com",
      logisticName: "CJPacket Ordinary",
      fromCountryCode: "CN",
      products: [{ vid: "2504030718511602500", quantity: 1 }],
    });

    expect(result.orderId).toBe("CJ-ORDER-1");
    const orderCall = calls.find((c) => c.url.includes("createOrderV2"))!;
    const body = orderCall.body as Record<string, unknown>;
    expect(body.orderNumber).toBe("PP-1001");
    expect(body.shippingCountryCode).toBe("US");
    expect(body.shippingCustomerName).toBe("Jane Doe");
    expect(body.logisticName).toBe("CJPacket Ordinary");
    expect(body.fromCountryCode).toBe("CN");
    // Sandbox by default - a misconfiguration must not place a real order.
    expect(body.isSandbox).toBe(1);
    expect(body.payType).toBe(3);
    expect(body.products).toEqual([{ vid: "2504030718511602500", quantity: 1 }]);
  });

  it("sends isSandbox: 0 only when live mode is explicitly on", async () => {
    const { fetchImpl, calls } = makeFetch({
      "authentication/getAccessToken": () => TOKEN,
      "shopping/order/createOrderV2": () => ({ orderId: "X", orderNumber: "PP-1" }),
    });
    const live = new CjClient({ fetchImpl, apiKey: "k", liveMode: true });
    await live.createOrder({
      orderNumber: "PP-1",
      shippingCountryCode: "US",
      shippingCountry: "United States",
      shippingProvince: "TX",
      shippingCity: "Dallas",
      shippingCustomerName: "J",
      shippingAddress: "1 Main",
      logisticName: "CJPacket Ordinary",
      fromCountryCode: "CN",
      products: [{ vid: "v", quantity: 1 }],
    });
    const body = calls.find((c) => c.url.includes("createOrderV2"))!.body as Record<string, unknown>;
    expect(body.isSandbox).toBe(0);
  });

  it("caches the token across calls (one auth for many requests)", async () => {
    const { client, calls } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "product/stock/queryByVid": () => [{ vid: "v", totalInventoryNum: 5 }],
    });
    await client.queryStockByVid("v");
    await client.queryStockByVid("v");
    const authCalls = calls.filter((c) => c.url.includes("getAccessToken"));
    expect(authCalls).toHaveLength(1);
  });
});

// ── Fail-safe when unconfigured ──────────────────────────────────────────────
describe("unconfigured client", () => {
  it("throws CjNotConfiguredError rather than calling out", async () => {
    const client = new CjClient({ fetchImpl: async () => new Response("{}"), apiKey: "" });
    expect(client.isConfigured()).toBe(false);
    await expect(client.getToken()).rejects.toBeInstanceOf(CjNotConfiguredError);
  });
});

// ── THE IDEMPOTENCY GUARD ────────────────────────────────────────────────────
// A fake store whose `claim` behaves like the real primary-key insert: only the
// FIRST caller wins.
function makeForwardStore(order: ForwardableOrder, lines: ForwardableLine[]) {
  const claimed = new Set<string>();
  const state = { forwarded: 0, failed: 0, cjOrderId: null as string | null };
  const store: ForwardStore = {
    async getOrder(id) {
      return id === order.id ? order : null;
    },
    async getLines() {
      return lines;
    },
    async claim(id) {
      if (claimed.has(id)) return false;
      claimed.add(id);
      return true;
    },
    async markForwarded(_id, cjOrderId) {
      state.forwarded += 1;
      state.cjOrderId = cjOrderId;
    },
    async markFailed() {
      state.failed += 1;
    },
    async setOrderCjId() {},
  };
  return { store, state };
}

const PAID_ORDER: ForwardableOrder = {
  id: "order-1",
  orderNumber: "PP-1001",
  email: "jane@example.com",
  paymentStatus: "paid",
  shippingAddress: {
    fullName: "Jane Doe",
    line1: "1 Main St",
    city: "Dallas",
    state: "TX",
    postalCode: "75001",
    country: "United States",
  },
};

const MAPPED_LINES: ForwardableLine[] = [
  { variantId: "v1", nameSnapshot: "White", qty: 1, cjVid: "2504030718511602500" },
];

describe("forwardOrderToCj - idempotency", () => {
  it("a DOUBLED webhook places exactly ONE CJ order", async () => {
    const { client, calls } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "shopping/order/createOrderV2": () => ({ orderId: "CJ-1", orderNumber: "PP-1001", cjOrderId: "CJ-1" }),
    });
    const { store, state } = makeForwardStore(PAID_ORDER, MAPPED_LINES);

    const first = await forwardOrderToCj("order-1", { store, client });
    const second = await forwardOrderToCj("order-1", { store, client });

    expect(first.status).toBe("forwarded");
    expect(second.status).toBe("already_forwarded");
    // THE assertion: CJ was asked to create the order exactly once.
    const createCalls = calls.filter((c) => c.url.includes("createOrderV2"));
    expect(createCalls).toHaveLength(1);
    expect(state.forwarded).toBe(1);
  });

  it("two CONCURRENT forwards still place exactly one CJ order", async () => {
    const { client, calls } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "shopping/order/createOrderV2": () => ({ orderId: "CJ-1", orderNumber: "PP-1001", cjOrderId: "CJ-1" }),
    });
    const { store } = makeForwardStore(PAID_ORDER, MAPPED_LINES);

    const [a, b] = await Promise.all([
      forwardOrderToCj("order-1", { store, client }),
      forwardOrderToCj("order-1", { store, client }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["already_forwarded", "forwarded"]);
    expect(calls.filter((c) => c.url.includes("createOrderV2"))).toHaveLength(1);
  });

  it("does NOT forward an unpaid order", async () => {
    const { client, calls } = clientWith({ "authentication/getAccessToken": () => TOKEN });
    const { store } = makeForwardStore({ ...PAID_ORDER, paymentStatus: "pending" }, MAPPED_LINES);
    const out = await forwardOrderToCj("order-1", { store, client });
    expect(out.status).toBe("skipped");
    expect(calls.filter((c) => c.url.includes("createOrderV2"))).toHaveLength(0);
  });

  it("fails safe (no throw, no CJ call) when unconfigured", async () => {
    const client = new CjClient({ fetchImpl: async () => new Response("{}"), apiKey: "" });
    const { store, state } = makeForwardStore(PAID_ORDER, MAPPED_LINES);
    const out = await forwardOrderToCj("order-1", { store, client });
    expect(out.status).toBe("skipped");
    expect(state.forwarded).toBe(0);
  });

  it("records a failure (not a forward) when a line has no VID", async () => {
    const { client, calls } = clientWith({ "authentication/getAccessToken": () => TOKEN });
    const { store, state } = makeForwardStore(PAID_ORDER, [
      { variantId: "v1", nameSnapshot: "White", qty: 1, cjVid: null },
    ]);
    const out = await forwardOrderToCj("order-1", { store, client });
    expect(out.status).toBe("failed");
    expect(state.failed).toBe(1);
    expect(calls.filter((c) => c.url.includes("createOrderV2"))).toHaveLength(0);
  });
});

// ── Tracking sync ────────────────────────────────────────────────────────────
function makeSyncStore(over: Partial<SyncStore> = {}): SyncStore & { applied: unknown[]; stock: unknown[] } {
  const applied: unknown[] = [];
  const stock: unknown[] = [];
  return {
    applied,
    stock,
    async listOrdersAwaitingTracking() {
      return [{ id: "o1", orderNumber: "PP-1", cjOrderId: "CJ-1" }];
    },
    async applyTracking(input) {
      applied.push(input);
    },
    async listVariantsWithVid() {
      return [{ id: "v1", sku: "SKU-1", cjVid: "vid-1", inventoryQty: 0 }];
    },
    async setVariantStock(id, qty) {
      stock.push({ id, qty });
    },
    ...over,
  };
}

describe("runTrackingSync", () => {
  it("writes the tracking number and carrier CJ reports", async () => {
    const { client } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "shopping/order/getOrderDetail": () => ({
        orderId: "CJ-1",
        trackNumber: "TRACK123",
        trackingProvider: "USPS",
      }),
    });
    const store = makeSyncStore();
    const summary = await runTrackingSync({ client, store });
    expect(summary.updated).toBe(1);
    expect(store.applied[0]).toMatchObject({ orderId: "o1", trackingNumber: "TRACK123", carrier: "USPS" });
  });

  it("skips (no write) when CJ has no tracking yet", async () => {
    const { client } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "shopping/order/getOrderDetail": () => ({ orderId: "CJ-1", trackNumber: null }),
    });
    const store = makeSyncStore();
    const summary = await runTrackingSync({ client, store });
    expect(summary.skipped).toBe(1);
    expect(store.applied).toHaveLength(0);
  });

  it("is a no-op when unconfigured", async () => {
    const client = new CjClient({ fetchImpl: async () => new Response("{}"), apiKey: "" });
    const store = makeSyncStore();
    const summary = await runTrackingSync({ client, store });
    expect(summary.checked).toBe(0);
    expect(store.applied).toHaveLength(0);
  });
});

// ── Stock sync ───────────────────────────────────────────────────────────────
describe("runStockSync", () => {
  it("sums CJ's per-warehouse stock into inventoryQty", async () => {
    const { client } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "product/stock/queryByVid": () => [
        { vid: "vid-1", totalInventoryNum: 3 },
        { vid: "vid-1", totalInventoryNum: 4 },
      ],
    });
    const store = makeSyncStore();
    const summary = await runStockSync({ client, store });
    expect(summary.updated).toBe(1);
    expect(store.stock[0]).toEqual({ id: "v1", qty: 7 });
  });

  it("is idempotent - unchanged stock writes nothing on a second run", async () => {
    const { client } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "product/stock/queryByVid": () => [{ vid: "vid-1", totalInventoryNum: 7 }],
    });
    const store = makeSyncStore({
      async listVariantsWithVid() {
        return [{ id: "v1", sku: "SKU-1", cjVid: "vid-1", inventoryQty: 7 }];
      },
    });
    const summary = await runStockSync({ client, store });
    expect(summary.skipped).toBe(1);
    expect(store.stock).toHaveLength(0);
  });

  it("totalStock sums and tolerates missing fields", () => {
    expect(totalStock([{ totalInventoryNum: 2 }, {}, { totalInventoryNum: 5 }])).toBe(7);
  });

  it("totalStock ignores empty warehouses when another warehouse holds stock", () => {
    // CJ lists per-warehouse stock and empty warehouses report 0 explicitly.
    // Those zeros must not cancel out the real stock.
    expect(totalStock([{ totalInventoryNum: 0 }, { totalInventoryNum: 12 }], { ignoreZeros: true })).toBe(12);
  });

  it("totalStock still reports 0 when EVERY warehouse is empty", () => {
    expect(totalStock([{ totalInventoryNum: 0 }], { ignoreZeros: true })).toBe(0);
    expect(totalStock([], { ignoreZeros: true })).toBe(0);
  });
});

// ── Stock-drop guard ──────────────────────────────────────────────────────────
// A supplier API can answer empty (rate limiting, a transient error, a variant
// the lookup does not cover). Writing that through as 0 would mark a sellable
// product "Sold out" AND cap the quantity stepper at zero, so it is held for a
// human instead. A genuine sale is a smaller drop and still applies.
describe("isSuspiciousStockDrop", () => {
  it("flags a drop to ZERO from healthy stock", () => {
    expect(isSuspiciousStockDrop(42, 0)).toBe(true);
    expect(isSuspiciousStockDrop(5, 0)).toBe(true);
  });

  it("does NOT flag a real sale (a drop that stays above zero)", () => {
    expect(isSuspiciousStockDrop(42, 41)).toBe(false);
    expect(isSuspiciousStockDrop(42, 1)).toBe(false);
  });

  it("does NOT flag an already-low variant going to zero", () => {
    expect(isSuspiciousStockDrop(2, 0)).toBe(false);
  });
});

describe("runStockSync - zero-drop guard", () => {
  it("HOLDS a suspicious drop to zero and writes nothing", async () => {
    const { client } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      // The lookup returns an empty warehouse only - must not be believed.
      "product/stock/queryByVid": () => [{ vid: "vid-1", totalInventoryNum: 0 }],
    });
    const store = makeSyncStore({
      async listVariantsWithVid() {
        return [{ id: "v1", sku: "SKU-1", cjVid: "vid-1", inventoryQty: 42 }];
      },
    });
    const summary = await runStockSync({ client, store });
    expect(summary.held).toBe(1);
    expect(summary.updated).toBe(0);
    expect(store.stock).toHaveLength(0);
  });

  it("still applies a real sale (drop that stays above zero)", async () => {
    const { client } = clientWith({
      "authentication/getAccessToken": () => TOKEN,
      "product/stock/queryByVid": () => [{ vid: "vid-1", totalInventoryNum: 40 }],
    });
    const store = makeSyncStore({
      async listVariantsWithVid() {
        return [{ id: "v1", sku: "SKU-1", cjVid: "vid-1", inventoryQty: 42 }];
      },
    });
    const summary = await runStockSync({ client, store });
    expect(summary.updated).toBe(1);
    expect(store.stock[0]).toEqual({ id: "v1", qty: 40 });
  });
});
