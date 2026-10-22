// Upstream supplier sync jobs: tracking back, stock in.
//
// TWO JOBS, both idempotent and both rate-limit aware (every CJ call goes
// through the client's QPS=1 queue, so a job that touches 28 variants cannot
// trip CJ's one-request-per-second limit):
//
//   cj-tracking-sync  CJ → store. For every paid order that has a CJ order id
//                     but no tracking number yet, ask CJ for the order detail
//                     and, once CJ has a `trackNumber`, write it (and the
//                     carrier) onto the store order. The customer's /track page
//                     and the admin OrderDetail read those columns, so the
//                     tracking appears the moment CJ dispatches.
//
//   cj-stock-sync     CJ → store. For every variant that has a CJ VID, ask CJ
//                     for its stock and write the total into
//                     `product_variants.inventoryQty` - the column the
//                     storefront already reads live (the quantity stepper's
//                     ceiling and the sold-out badge).
//
// IDEMPOTENT BY CONSTRUCTION. Tracking sync only writes when CJ actually has a
// tracking number, and only ever moves an order forward (never clears one CJ
// has already given). Stock sync writes the number CJ reports, so running it
// twice in a row is a no-op the second time. Neither job throws on a single
// failure - it logs and continues, so one bad variant cannot stall the rest.
//
// TESTABILITY. All persistence goes through the `SyncStore` seam below. The
// default implementation is the real database; tests inject a fake so the job
// logic is exercised hermetically with the CJ HTTP boundary mocked.
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../_core/db";
import { orders, productVariants } from "../../drizzle/schema";
import { CjClient, CjNotConfiguredError, cjClient } from "./cj-client";
import { updateOrderTracking } from "../db";

export interface SyncSummary {
  checked: number;
  updated: number;
  skipped: number;
  failed: number;
  /** Stock writes refused because CJ reported an implausible drop to zero. */
  held: number;
}

/** An order the tracking job may poll. */
export interface TrackingCandidate {
  id: string;
  orderNumber: string;
  cjOrderId: string;
}

/** A variant the stock job may poll. */
export interface StockCandidate {
  id: string;
  sku: string;
  cjVid: string;
  inventoryQty: number;
}

/** The persistence seam for both jobs. */
export interface SyncStore {
  listOrdersAwaitingTracking(limit: number): Promise<TrackingCandidate[]>;
  applyTracking(input: {
    orderId: string;
    trackingNumber: string;
    carrier: string | null;
    note: string;
  }): Promise<void>;
  listVariantsWithVid(limit: number): Promise<StockCandidate[]>;
  setVariantStock(variantId: string, qty: number): Promise<void>;
}

const dbStore: SyncStore = {
  async listOrdersAwaitingTracking(limit) {
    const rows = await db
      .select({ id: orders.id, orderNumber: orders.orderNumber, cjOrderId: orders.cjOrderId })
      .from(orders)
      .where(and(eq(orders.paymentStatus, "paid"), isNotNull(orders.cjOrderId), isNull(orders.trackingNumber)))
      .limit(limit);
    return rows.map((r) => ({ id: r.id, orderNumber: r.orderNumber, cjOrderId: r.cjOrderId! }));
  },
  async applyTracking(input) {
    // `updateOrderTracking` also moves the order to "shipped" and logs the
    // event, so the customer's tracking page shows the right step.
    await updateOrderTracking({
      orderId: input.orderId,
      trackingNumber: input.trackingNumber,
      carrier: input.carrier,
      note: input.note,
    });
  },
  async listVariantsWithVid(limit) {
    const rows = await db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        cjVid: productVariants.cjVid,
        inventoryQty: productVariants.inventoryQty,
      })
      .from(productVariants)
      .where(isNotNull(productVariants.cjVid))
      .limit(limit);
    return rows.map((r) => ({ id: r.id, sku: r.sku, cjVid: r.cjVid!, inventoryQty: r.inventoryQty }));
  },
  async setVariantStock(variantId, qty) {
    await db.update(productVariants).set({ inventoryQty: qty }).where(eq(productVariants.id, variantId));
  },
};

/**
 * Pull tracking numbers from CJ for forwarded orders. Idempotent: an order that
 * already has a tracking number is not selected, and an order CJ has not yet
 * dispatched is skipped without a write.
 */
export async function runTrackingSync(
  deps: { client?: CjClient; store?: SyncStore; limit?: number } = {},
): Promise<SyncSummary> {
  const client = deps.client ?? cjClient;
  const store = deps.store ?? dbStore;
  const summary: SyncSummary = { checked: 0, updated: 0, skipped: 0, failed: 0, held: 0 };

  if (!client.isConfigured()) {
    // eslint-disable-next-line no-console
    console.log("[cj-tracking-sync] skipped: CJ_API_KEY is not set (integration not configured).");
    return summary;
  }

  const rows = await store.listOrdersAwaitingTracking(deps.limit ?? 50);
  for (const row of rows) {
    summary.checked += 1;
    try {
      const detail = await client.getOrderDetail(row.cjOrderId);
      const tracking = (detail.trackNumber ?? "").trim();
      if (!tracking) {
        summary.skipped += 1;
        continue;
      }
      const carrier = detail.trackingProvider ?? detail.logisticName ?? null;
      await store.applyTracking({
        orderId: row.id,
        trackingNumber: tracking,
        carrier,
        note: `Tracking synced from CJ (${carrier ?? "carrier"} ${tracking})`,
      });
      summary.updated += 1;
      // eslint-disable-next-line no-console
      console.log(`[cj-tracking-sync] order ${row.orderNumber} → ${tracking}`);
    } catch (err) {
      summary.failed += 1;
      const reason = err instanceof CjNotConfiguredError ? "not_configured" : err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(`[cj-tracking-sync] order ${row.orderNumber} failed: ${reason}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[cj-tracking-sync] done. checked=${summary.checked} updated=${summary.updated} ` +
      `skipped=${summary.skipped} failed=${summary.failed}`,
  );
  return summary;
}

/** Sum CJ's per-warehouse stock for a variant into one number.
 *
 *  CJ lists stock per warehouse, and it is normal for warehouses that do NOT
 *  hold the item to report an explicit `0`. Summing them is correct; the trap is
 *  a variant whose only listed warehouse is an empty one - that is not "0 units
 *  available", it is "this lookup does not cover the stock we hold", and writing
 *  it through would mark a sellable product "Sold out" on the storefront (the
 *  product page renders Sold out and caps the quantity stepper at that number).
 *  So when `ignoreZeros` is set and at least one warehouse reports real stock,
 *  the empty warehouses are skipped. */
export function totalStock(
  rows: { totalInventoryNum?: number }[],
  opts: { ignoreZeros?: boolean } = {},
): number {
  if (opts.ignoreZeros) {
    const positive = rows.map((r) => Number(r.totalInventoryNum) || 0).filter((n) => n > 0);
    if (positive.length > 0) return positive.reduce((a, b) => a + b, 0);
  }
  return rows.reduce((sum, r) => sum + (Number(r.totalInventoryNum) || 0), 0);
}

/** The "healthy stock" line. A drop to zero from at least this much is treated
 *  as suspect rather than as a real sell-out. */
export const CJ_STOCK_FLOOR = 5;

/** Is a stock fall from `previous` to `next` too extreme to trust?
 *
 *  A supplier API can return an empty or partial result (rate limiting, a
 *  transient error, a variant the lookup does not cover). Taking that as truth
 *  would silently zero a live product and show it "Sold out". So a drop to ZERO
 *  from a healthy number is held for a human to confirm, while a smaller drop
 *  (a real sale) is applied normally. Only a drop to zero is suspect - a real
 *  sell-out is always reachable by setting the stock by hand. */
export function isSuspiciousStockDrop(previous: number, next: number, floor = CJ_STOCK_FLOOR): boolean {
  return next === 0 && previous >= floor;
}

/**
 * Pull stock from CJ into `product_variants.inventoryQty`. Idempotent: it writes
 * the number CJ reports, so a second run with unchanged stock writes nothing.
 */
export async function runStockSync(
  deps: { client?: CjClient; store?: SyncStore; limit?: number } = {},
): Promise<SyncSummary> {
  const client = deps.client ?? cjClient;
  const store = deps.store ?? dbStore;
  const summary: SyncSummary = { checked: 0, updated: 0, skipped: 0, failed: 0, held: 0 };

  if (!client.isConfigured()) {
    // eslint-disable-next-line no-console
    console.log("[cj-stock-sync] skipped: CJ_API_KEY is not set (integration not configured).");
    return summary;
  }

  const rows = await store.listVariantsWithVid(deps.limit ?? 200);
  for (const row of rows) {
    summary.checked += 1;
    try {
      const stock = await client.queryStockByVid(row.cjVid);
      const total = Math.max(0, Math.floor(totalStock(stock, { ignoreZeros: true })));
      if (total === row.inventoryQty) {
        summary.skipped += 1;
        continue;
      }
      // Never let an empty or partial CJ result zero a healthy product: that
      // would mark a sellable item "Sold out" on the storefront. A drop to zero
      // from a real number is held (logged, not written); a genuine smaller drop
      // (a sale) still applies.
      if (isSuspiciousStockDrop(row.inventoryQty, total)) {
        summary.held += 1;
        // eslint-disable-next-line no-console
        console.warn(
          `[cj-stock-sync] ${row.sku}: CJ reported 0 (was ${row.inventoryQty}) - held, not written. ` +
            `Confirm in CJ, then set the stock by hand if it is genuinely out of stock.`,
        );
        continue;
      }
      await store.setVariantStock(row.id, total);
      summary.updated += 1;
      // eslint-disable-next-line no-console
      console.log(`[cj-stock-sync] ${row.sku} ${row.inventoryQty} → ${total}`);
    } catch (err) {
      summary.failed += 1;
      const reason = err instanceof CjNotConfiguredError ? "not_configured" : err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(`[cj-stock-sync] ${row.sku} failed: ${reason}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[cj-stock-sync] done. checked=${summary.checked} updated=${summary.updated} ` +
      `skipped=${summary.skipped} held=${summary.held} failed=${summary.failed}`,
  );
  return summary;
}

/** Count of active variants still missing a CJ VID - surfaced so an operator can
 *  see at a glance whether every sellable option is forwardable. */
export async function countUnmappedVariants(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(productVariants)
    .where(and(isNull(productVariants.cjVid), eq(productVariants.active, true)));
  return row?.n ?? 0;
}
