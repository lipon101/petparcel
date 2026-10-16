// Order forwarding to the upstream supplier.
//
// WHAT THIS DOES. When a store order is confirmed PAID, this pushes it to CJ so
// the supplier ships it. It is the piece that turns "a customer paid" into "CJ
// has the order", and it is deliberately the ONLY place that calls
// createOrderV2.
//
// THE ONE THING THAT MUST NEVER HAPPEN: a doubled payment webhook creating TWO
// CJ orders. NOWPayments retries, a shopper refreshes the return URL, and two
// serverless instances can run the same handler concurrently. Forwarding twice
// would place two real supplier orders and ship the customer twice - a real,
// unrecoverable cost.
//
// HOW THAT IS PREVENTED. `cj_order_forwards.order_id` is the PRIMARY KEY, so the
// INSERT that claims a forward is an ATOMIC mutual-exclusion point:
//   - the first caller inserts the row and proceeds to call CJ;
//   - every other caller's INSERT hits the primary key, `onConflictDoNothing`
//     returns no row, and that caller STOPS - it never calls CJ.
// A boolean on `orders` could not do this: two concurrent transactions would
// both read "not forwarded" before either wrote. The claim is written BEFORE the
// CJ call, so a crash mid-call leaves a `pending` claim that a retry can resume
// rather than a second order.
//
// FAIL-SAFE. With no CJ_API_KEY the forward is skipped with one clear log line -
// checkout is never affected and nothing pretends to have succeeded. A line
// whose variant has no CJ VID is refused (status 'failed', a precise reason)
// rather than guessed at.
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../_core/db";
import { env } from "../_core/env";
import { cjOrderForwards, orderItems, orders, productVariants } from "../../drizzle/schema";
import { CjClient, CjNotConfiguredError, cjClient, type CjOrderLine } from "./cj-client";

export type ForwardOutcome =
  | { status: "skipped"; reason: string }
  | { status: "already_forwarded"; cjOrderId: string | null }
  | { status: "forwarded"; cjOrderId: string | null }
  | { status: "failed"; reason: string };

/** The order shape forwarding needs - a narrow slice of the order row. */
export interface ForwardableOrder {
  id: string;
  orderNumber: string;
  email: string;
  paymentStatus: string;
  shippingAddress: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string | null;
  };
}

export interface ForwardableLine {
  variantId: string | null;
  nameSnapshot: string;
  qty: number;
  /** The CJ VID for this line's variant, or null when unmapped. */
  cjVid: string | null;
}

/** The persistence seam. The default implementation is the real database; tests
 *  inject a fake so the idempotency logic can be exercised hermetically. */
export interface ForwardStore {
  getOrder(orderId: string): Promise<ForwardableOrder | null>;
  getLines(orderId: string): Promise<ForwardableLine[]>;
  /** Atomically claim the forward. Returns true ONLY for the caller that won. */
  claim(orderId: string): Promise<boolean>;
  markForwarded(orderId: string, cjOrderId: string | null, response: unknown): Promise<void>;
  markFailed(orderId: string, reason: string, response: unknown): Promise<void>;
  /** Record the CJ order id on the order row itself. */
  setOrderCjId(orderId: string, cjOrderId: string | null): Promise<void>;
}

/** Map a country name or code to the two-letter code CJ requires. Handles the
 *  codes the store actually ships to; anything unrecognised is passed through
 *  uppercased so CJ's own validation reports it rather than us guessing wrong. */
export function toCountryCode(country: string): string {
  const raw = (country ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  const map: Record<string, string> = {
    "united states": "US", "united states of america": "US", usa: "US", "u.s.a.": "US", "u.s.": "US",
    canada: "CA", "united kingdom": "GB", uk: "GB", "great britain": "GB", england: "GB",
    australia: "AU", "new zealand": "NZ", ireland: "IE", germany: "DE", france: "FR",
    spain: "ES", italy: "IT", netherlands: "NL", belgium: "BE", sweden: "SE", norway: "NO",
    denmark: "DK", finland: "FI", poland: "PL", portugal: "PT", austria: "AT", switzerland: "CH",
    japan: "JP", singapore: "SG", "south korea": "KR", "hong kong": "HK", mexico: "MX",
    brazil: "BR", india: "IN", "united arab emirates": "AE", "saudi arabia": "SA",
  };
  return map[raw.toLowerCase()] ?? raw.toUpperCase();
}

/** Build the createOrderV2 line items from the store's order lines. Returns an
 *  error string when any line cannot be mapped to a CJ variant - forwarding is
 *  refused rather than guessed. */
export function buildOrderLines(lines: ForwardableLine[]): { lines: CjOrderLine[] } | { error: string } {
  const out: CjOrderLine[] = [];
  const unmapped: string[] = [];
  for (const l of lines) {
    if (!l.cjVid) {
      unmapped.push(l.nameSnapshot);
      continue;
    }
    out.push({ vid: l.cjVid, quantity: l.qty });
  }
  if (unmapped.length > 0) {
    return {
      error:
        `no CJ variant id (VID) mapped for: ${unmapped.join(", ")}. ` +
        `Set the CJ VID on those variants in the admin product editor before forwarding.`,
    };
  }
  if (out.length === 0) return { error: "order has no line items" };
  return { lines: out };
}

/** The real database-backed store. */
const dbStore: ForwardStore = {
  async getOrder(orderId) {
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!row) return null;
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      email: row.email,
      paymentStatus: row.paymentStatus,
      shippingAddress: row.shippingAddress,
    };
  },
  async getLines(orderId) {
    const rows = await db
      .select({
        variantId: orderItems.variantId,
        nameSnapshot: orderItems.nameSnapshot,
        qty: orderItems.qty,
        cjVid: productVariants.cjVid,
      })
      .from(orderItems)
      .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(eq(orderItems.orderId, orderId));
    return rows.map((r) => ({
      variantId: r.variantId,
      nameSnapshot: r.nameSnapshot,
      qty: r.qty,
      cjVid: r.cjVid ?? null,
    }));
  },
  async claim(orderId) {
    // THE mutual-exclusion point. `onConflictDoNothing` + `returning` means only
    // the caller that actually inserted a row gets a row back.
    const inserted = await db
      .insert(cjOrderForwards)
      .values({ orderId, status: "pending" })
      .onConflictDoNothing({ target: cjOrderForwards.orderId })
      .returning({ orderId: cjOrderForwards.orderId });
    return inserted.length > 0;
  },
  async markForwarded(orderId, cjOrderId, response) {
    await db
      .update(cjOrderForwards)
      .set({
        status: "forwarded",
        cjOrderId,
        responsePayload: response as object,
        attempts: sql`${cjOrderForwards.attempts} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(cjOrderForwards.orderId, orderId));
  },
  async markFailed(orderId, reason, response) {
    await db
      .update(cjOrderForwards)
      .set({
        status: "failed",
        lastError: reason,
        responsePayload: response as object,
        attempts: sql`${cjOrderForwards.attempts} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(cjOrderForwards.orderId, orderId));
  },
  async setOrderCjId(orderId, cjOrderId) {
    await db
      .update(orders)
      .set({ cjOrderId, cjForwardedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(orders.id, orderId));
  },
};

export interface ForwardDeps {
  store?: ForwardStore;
  client?: CjClient;
}

/**
 * Forward a paid order to CJ. Idempotent: calling it any number of times for the
 * same order places AT MOST ONE CJ order. Never throws - every failure is
 * returned as an outcome and logged, so a caller inside the payment path can
 * never be broken by a CJ problem.
 */
export async function forwardOrderToCj(
  orderId: string,
  deps: ForwardDeps = {},
): Promise<ForwardOutcome> {
  const store = deps.store ?? dbStore;
  const client = deps.client ?? cjClient;

  // Not configured: do nothing, say so once. This is the normal state until the
  // owner supplies the API key, and it must never affect checkout.
  if (!client.isConfigured()) {
    // eslint-disable-next-line no-console
    console.log(`[cj-forward] skipped order ${orderId}: CJ_API_KEY is not set (integration not configured).`);
    return { status: "skipped", reason: "not_configured" };
  }

  const order = await store.getOrder(orderId);
  if (!order) return { status: "failed", reason: "order not found" };

  // Only a PAID order is ever forwarded. A pending/unpaid order must not reach
  // the supplier.
  if (order.paymentStatus !== "paid") {
    return { status: "skipped", reason: `order is ${order.paymentStatus}, not paid` };
  }

  // ── THE IDEMPOTENCY CLAIM ──────────────────────────────────────────────────
  const won = await store.claim(orderId);
  if (!won) {
    // Someone else already claimed (or completed) this forward. Do NOT call CJ.
    // eslint-disable-next-line no-console
    console.log(`[cj-forward] order ${order.orderNumber} already claimed - not forwarding again.`);
    return { status: "already_forwarded", cjOrderId: null };
  }

  try {
    const lines = await store.getLines(orderId);
    const built = buildOrderLines(lines);
    if ("error" in built) {
      await store.markFailed(orderId, built.error, null);
      // eslint-disable-next-line no-console
      console.warn(`[cj-forward] order ${order.orderNumber} not forwarded: ${built.error}`);
      return { status: "failed", reason: built.error };
    }

    const addr = order.shippingAddress;
    const result = await client.createOrder({
      orderNumber: order.orderNumber,
      shippingCountryCode: toCountryCode(addr.country),
      shippingCountry: addr.country,
      shippingProvince: addr.state,
      shippingCity: addr.city,
      shippingCustomerName: addr.fullName,
      shippingAddress: addr.line1,
      shippingAddress2: addr.line2 ?? undefined,
      shippingZip: addr.postalCode,
      shippingPhone: addr.phone ?? undefined,
      email: order.email,
      logisticName: env.cj.logisticName,
      fromCountryCode: env.cj.fromCountryCode,
      products: built.lines,
      remark: env.cj.email ? `PetParcel order ${order.orderNumber} (${env.cj.email})` : `PetParcel order ${order.orderNumber}`,
    });

    const cjOrderId = result.cjOrderId ?? result.orderId ?? null;
    await store.markForwarded(orderId, cjOrderId, result.raw);
    await store.setOrderCjId(orderId, cjOrderId);
    // eslint-disable-next-line no-console
    console.log(
      `[cj-forward] order ${order.orderNumber} forwarded to CJ (cjOrderId=${cjOrderId ?? "?"}, sandbox=${client.sandbox}).`,
    );
    return { status: "forwarded", cjOrderId };
  } catch (err) {
    const reason = err instanceof CjNotConfiguredError ? "not_configured" : err instanceof Error ? err.message : String(err);
    await store.markFailed(orderId, reason, null);
    // eslint-disable-next-line no-console
    console.error(`[cj-forward] order ${order.orderNumber} forwarding failed: ${reason}`);
    return { status: "failed", reason };
  }
}

/** Orders that are paid, have a CJ order id, and are not yet delivered - the
 *  set the tracking-sync job polls. */
export async function listOrdersAwaitingTracking(limit = 50) {
  return db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      cjOrderId: orders.cjOrderId,
      trackingNumber: orders.trackingNumber,
      status: orders.status,
    })
    .from(orders)
    .where(and(eq(orders.paymentStatus, "paid"), isNull(orders.trackingNumber)))
    .limit(limit);
}
