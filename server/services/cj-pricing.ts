// Per-variant price sync: CJ → store, on the daily schedule.
//
// WHY THIS IS A JOB AND NOT A SCRIPT. The storefront charges a price PER
// VARIANT, and the supplier prices each variant itself (the carrier bag's
// Dark-grey-M costs $10.75 while Dark-grey-XL costs $11.65). A price that is
// only refreshed by hand drifts: the supplier raises a cost, the store keeps
// selling at the old price, and the margin quietly disappears. So the same
// refresh that already runs for stock and tracking also runs for price, every
// day, from the live supplier API.
//
// THE RULE IS NOT REIMPLEMENTED HERE. `retailPriceCents` (shared/pricing.ts) is
// the single documented, env-overridable rule - cost x markup, floored at
// cost + a minimum margin, rounded UP to the next .99. This job only decides
// WHICH cost to feed it and WHEN to write.
//
// SAFETY, in the order it matters:
//   * IDEMPOTENT. It writes the price the rule produces, so a second run with
//     unchanged supplier costs writes nothing. `updated` counts real changes.
//   * NEVER ZERO. A variant CJ does not price (missing, non-numeric, <= 0) is
//     left EXACTLY as it is - never zeroed, never guessed. A store that shows
//     $0.00 is worse than one showing a slightly stale price.
//   * NEVER BELOW THE FLOOR. The rule itself guarantees the result is at least
//     cost + the margin floor, so a write can never sell at a loss.
//   * NEVER BREAKS THE STORE. A CJ outage, a rate limit, a bad product - each
//     is logged and skipped, and the last good price stays in place. The job
//     never throws out of the loop, so one bad product cannot stall the rest.
//
// TESTABILITY. All persistence goes through the `PriceSyncStore` seam below.
// The default implementation is the real database; tests inject a fake so the
// job logic is exercised hermetically with the CJ HTTP boundary mocked.
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../_core/db";
import { products, productVariants } from "../../drizzle/schema";
import { CjClient, CjNotConfiguredError, cjClient } from "./cj-client";
import { retailPriceCents, markupMultiplier, minMarginCents } from "../../shared/pricing";
import { optionSchemaFor } from "../../shared/cj-option-schema-data";

export interface PriceSyncSummary {
  /** Products the job looked at. */
  checked: number;
  /** Variant prices actually written (a real change). */
  updated: number;
  /** Variants whose price already matched the rule - no write. */
  unchanged: number;
  /** Variants CJ did not price - left untouched. */
  skipped: number;
  /** Products that could not be read from CJ - left untouched. */
  failed: number;
  /** Product rows whose own (cheapest-variant) price was rewritten. */
  productsRepriced: number;
}

/** A variant the price job may reprice. */
export interface PriceCandidate {
  id: string;
  sku: string;
  cjVid: string;
  priceCents: number;
}

/** A product the price job may reprice, with its supplier pid. */
export interface PriceProduct {
  id: string;
  slug: string;
  priceCents: number;
  pid: string;
  variants: PriceCandidate[];
}

/** The persistence seam for the price job. */
export interface PriceSyncStore {
  listProductsWithPid(limit: number): Promise<PriceProduct[]>;
  setVariantPrice(variantId: string, priceCents: number): Promise<void>;
  setProductPrice(productId: string, priceCents: number): Promise<void>;
}

/** The supplier pid for a product slug, from the generated option-schema module.
 *
 *  The pid is the supplier's own product id, captured when the option schema was
 *  read from the live CJ listing. It is the ONLY key `/product/query` accepts, so
 *  a product without one simply cannot be repriced and is skipped. */
export function pidForSlug(slug: string): string | undefined {
  const entry = optionSchemaFor(slug);
  const pid = entry?.pid?.trim();
  return pid ? pid : undefined;
}

const dbStore: PriceSyncStore = {
  async listProductsWithPid(limit) {
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        priceCents: products.priceCents,
      })
      .from(products)
      .where(and(eq(products.active, true), eq(products.archived, false)))
      .limit(limit);

    const out: PriceProduct[] = [];
    for (const p of rows) {
      const pid = pidForSlug(p.slug);
      if (!pid) continue;
      const variants = await db
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          cjVid: productVariants.cjVid,
          priceCents: productVariants.priceCents,
        })
        .from(productVariants)
        .where(and(eq(productVariants.productId, p.id), isNotNull(productVariants.cjVid)));
      out.push({
        id: p.id,
        slug: p.slug,
        priceCents: p.priceCents,
        pid,
        variants: variants
          .filter((v) => v.cjVid)
          .map((v) => ({ id: v.id, sku: v.sku, cjVid: v.cjVid!, priceCents: v.priceCents })),
      });
    }
    return out;
  },
  async setVariantPrice(variantId, priceCents) {
    await db
      .update(productVariants)
      .set({ priceCents })
      .where(eq(productVariants.id, variantId));
  },
  async setProductPrice(productId, priceCents) {
    // The product's own price is the CHEAPEST variant, so the grid's "from"
    // price is honest. A compare-at that would no longer sit ABOVE the price is
    // cleared rather than left as a struck-through lie.
    await db
      .update(products)
      .set({
        priceCents,
        compareAtCents: sql`case when ${products.compareAtCents} is not null and ${products.compareAtCents} <= ${priceCents} then null else ${products.compareAtCents} end`,
      })
      .where(eq(products.id, productId));
  },
};

/** Parse a supplier price (number or numeric string) into integer cents.
 *  Returns null for anything that is not a positive, finite amount - the caller
 *  treats null as "CJ did not price this", never as zero. */
export function parseCostCents(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const cents = Math.round(n * 100);
  return cents > 0 ? cents : null;
}

/**
 * Refresh every variant's price from the live supplier cost. Idempotent and
 * fail-safe: see the module header for the guarantees.
 */
export async function runVariantPriceSync(
  deps: { client?: CjClient; store?: PriceSyncStore; limit?: number } = {},
): Promise<PriceSyncSummary> {
  const client = deps.client ?? cjClient;
  const store = deps.store ?? dbStore;
  const summary: PriceSyncSummary = {
    checked: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
    productsRepriced: 0,
  };

  if (!client.isConfigured()) {
    // eslint-disable-next-line no-console
    console.log("[cj-price-sync] skipped: CJ_API_KEY is not set (integration not configured).");
    return summary;
  }

  const list = await store.listProductsWithPid(deps.limit ?? 500);
  // eslint-disable-next-line no-console
  console.log(
    `[cj-price-sync] ${list.length} product(s); rule = cost x ${markupMultiplier()} ` +
      `(min margin $${(minMarginCents() / 100).toFixed(2)}), rounded up to .99`,
  );

  for (const product of list) {
    summary.checked += 1;
    let detail;
    try {
      detail = await client.getProductDetail(product.pid);
    } catch (err) {
      summary.failed += 1;
      const reason =
        err instanceof CjNotConfiguredError
          ? "not_configured"
          : err instanceof Error
            ? err.message
            : String(err);
      // eslint-disable-next-line no-console
      console.error(`[cj-price-sync] ${product.slug} failed: ${reason} - keeping last good prices`);
      continue;
    }

    const costByVid = new Map<string, number>();
    for (const v of detail.variants) {
      const cents = parseCostCents(v.variantSellPrice);
      if (cents !== null && v.vid) costByVid.set(String(v.vid), cents);
    }

    const priced: { id: string; price: number }[] = [];
    for (const variant of product.variants) {
      const cost = costByVid.get(String(variant.cjVid));
      if (cost === undefined) {
        // CJ did not price this variant - leave the row EXACTLY as it is.
        summary.skipped += 1;
        continue;
      }
      const price = retailPriceCents(cost);
      if (price === variant.priceCents) {
        summary.unchanged += 1;
        continue;
      }
      try {
        await store.setVariantPrice(variant.id, price);
        summary.updated += 1;
        priced.push({ id: variant.id, price });
      } catch (err) {
        summary.failed += 1;
        // eslint-disable-next-line no-console
        console.error(
          `[cj-price-sync] ${variant.sku} write failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // The product's own price is the cheapest variant. Recompute from the rows
    // we just wrote plus the ones that were already correct, so the grid's
    // "from" price always reflects the real cheapest option.
    const allPrices = product.variants
      .map((v) => {
        const written = priced.find((p) => p.id === v.id);
        if (written) return written.price;
        return costByVid.has(String(v.cjVid)) ? retailPriceCents(costByVid.get(String(v.cjVid))!) : v.priceCents;
      })
      .filter((n) => Number.isFinite(n) && n > 0);
    if (allPrices.length > 0) {
      const minPrice = Math.min(...allPrices);
      if (minPrice !== product.priceCents) {
        try {
          await store.setProductPrice(product.id, minPrice);
          summary.productsRepriced += 1;
        } catch (err) {
          summary.failed += 1;
          // eslint-disable-next-line no-console
          console.error(
            `[cj-price-sync] ${product.slug} product price write failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[cj-price-sync] done. checked=${summary.checked} updated=${summary.updated} ` +
      `unchanged=${summary.unchanged} skipped=${summary.skipped} failed=${summary.failed} ` +
      `productsRepriced=${summary.productsRepriced}`,
  );
  return summary;
}
