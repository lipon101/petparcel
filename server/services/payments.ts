// ── Payment abstraction ──────────────────────────────────────────────────────
//
// NOWPayments is the ONLY payment method PetParcel supports. It is a HOSTED
// checkout: we create an invoice, hand the customer to NOWPayments' own secure
// page, and confirm the outcome server-to-server. PetParcel never touches a
// private key or wallet material, so there is no custodial secret to hold here
// and swapping the account behind the keys is a config change.
//
//   nowpayments - crypto checkout (BTC, ETH, USDT, USDC, LTC and more). The
//                 shopper picks the coin on NOWPayments' hosted invoice.
//
// Before the merchant keys are in place the provider degrades gracefully: the
// order is recorded as `unpaid` for offline settlement (the admin marks it paid
// when funds land). That is a behaviour of the provider, NOT a separate offline
// method - checkout offers crypto and nothing else, and there is no invoice or
// bank-transfer UI anywhere in the store.
//
// Keys come from the app owner's environment (Settings → Environment variables),
// never from code. See the NOWPayments dashboard for the account setup.
//
// TWO CONFIRMATION PATHS, BOTH SERVER-SIDE:
//   1. PUSH - NOWPayments POSTs an IPN to /api/payments/nowpayments/ipn. The
//      route verifies the HMAC-SHA512 signature over the RAW body before this
//      module is ever called (see _core/app.ts), so `handleWebhook` only ever
//      sees a notification that has already been proven authentic.
//   2. PULL - the shopper's confirmation page asks `getLivePaymentStatus`,
//      which queries NOWPayments directly with our API key. This is what makes
//      the flow robust when a webhook is delayed or the IPN secret is unset.
//
// A browser redirect can be forged; neither of these can. The return URL only
// decides WHERE the shopper lands, never whether the order is paid.
import { eq } from "drizzle-orm";
import { centsToMajor, majorToCents } from "../../shared/money";
import { db } from "../_core/db";
import { getOrderDetail } from "../db";
import { orderEvents, orders } from "../../drizzle/schema";
import { forwardOrderToCj } from "./cj-order-forward";
import { sendPaidReceiptOnce } from "./order-receipt";
// The owner's private Telegram ping, sent from this same SIGNATURE-VERIFIED
// webhook path. Gated on the same settled status and idempotent on its own
// atomic claim; never throws, so a Telegram outage cannot turn a valid payment
// notification into a retry storm.
import { notifyPaidOrderOnce } from "./order-notify";
import {
  createInvoice,
  createRefund,
  getInvoiceStatus,
  getPaymentStatus,
  isNowPaymentsConfigured,
  nowPaymentsConfig,
  parseNotification,
  refundStage,
  refundStatusLabel,
  storePaymentStatusFor,
  toPaymentStatusView,
  type PaymentStatusResponse,
  type PaymentStatusView,
  type RefundResponse,
} from "./nowpayments";

export type ProviderId = "nowpayments";

export interface PaymentStartInput {
  /** The order's DB id, so the created invoice can be persisted against it. */
  orderId: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  email: string;
  customerName: string;
  /** Absolute URL the provider returns the shopper to after paying. */
  returnUrl: string;
  /** Absolute URL for the provider's server-to-server notification. */
  ipnUrl: string;
}

export interface PaymentStartResult {
  /** Where to send the browser. A hosted gateway gets its checkout URL; an
   *  unconfigured store gets its own order page (nothing is charged yet). */
  redirectUrl: string;
  providerRef?: string | null;
  /** Shown on the checkout review step so the shopper knows what happens next. */
  instructions: string;
}

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  /** Is this provider configured (keys present)? */
  isConfigured(): boolean;
  /** Human-readable "what happens after you click Place order". */
  describe(): string;
  start(input: PaymentStartInput): Promise<PaymentStartResult>;
}

// Money maths lives in shared/money.ts so the cents→major conversion and its
// exact inverse are stated once and can be asserted round-trip-safe.
// `centsToMajor`/`majorToCents` are imported above.

/**
 * NOWPayments hosted crypto checkout - the single payment method.
 *
 * With keys present the shopper is sent to NOWPayments' hosted invoice. With no
 * keys yet, the order is still created and returned to our own order page as
 * unpaid, so the storefront runs end-to-end until the merchant account is live.
 */
const nowPaymentsProvider: PaymentProvider = {
  id: "nowpayments",
  label: "Crypto (BTC, ETH, USDT + more)",
  isConfigured: () => isNowPaymentsConfigured(),
  describe: () =>
    "Pay with Bitcoin, Ethereum, USDT, USDC, Litecoin and more. You'll be redirected to NOWPayments' secure checkout to pick your coin and send payment.",
  async start(input) {
    // No keys yet: record the order and return to the order page, unpaid.
    // Nothing is charged and no invoice is issued - the store simply waits for
    // the merchant account to be connected.
    if (!this.isConfigured()) {
      return {
        redirectUrl: `/order/${input.orderNumber}`,
        providerRef: null,
        instructions: "Your order is placed. Crypto payment is completed once the store accepts it.",
      };
    }

    // ── IDEMPOTENCY ──────────────────────────────────────────────────────────
    // A shopper who double-clicks "Place order", or retries after a network
    // blip, must NOT end up with two invoices for one order. If this order
    // already has a hosted invoice URL and is still unpaid, hand back the SAME
    // invoice rather than creating another.
    const [existing] = await db
      .select({
        paymentUrl: orders.paymentUrl,
        paymentInvoiceId: orders.paymentInvoiceId,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);
    if (existing?.paymentStatus === "unpaid" && (existing.paymentUrl || existing.paymentInvoiceId)) {
      return {
        redirectUrl: existing.paymentUrl ?? `/order/${input.orderNumber}`,
        providerRef: existing.paymentInvoiceId ?? null,
        instructions: "Continue your crypto payment on NOWPayments' secure checkout.",
      };
    }

    // ── PRICE INTEGRITY ────────────────────────────────────────────────────────
    // The amount sent to the provider derives from ONE number: the order's
    // stored integer-cent total, which `createOrder` computed from catalog
    // prices and store settings alone. Nothing client-supplied reaches this
    // point (the cart's input schema has no price field at all), and the
    // conversion is asserted round-trip-exact so no float drift can slip a cent
    // between "what the customer owes" and "what is charged".
    const priceAmount = centsToMajor(input.totalCents);
    if (majorToCents(priceAmount) !== input.totalCents) {
      throw new Error(
        `Refusing to invoice order ${input.orderNumber}: ${input.totalCents} cents does not round-trip through major units.`,
      );
    }

    const { payCurrency } = nowPaymentsConfig();
    const invoice = await createInvoice({
      priceAmount,
      priceCurrency: input.currency,
      orderId: input.orderNumber,
      orderDescription: `PetParcel order ${input.orderNumber}`,
      ipnCallbackUrl: input.ipnUrl,
      successUrl: input.returnUrl,
      cancelUrl: input.returnUrl,
      payCurrency: payCurrency || undefined,
    });

    // Persist the invoice so the status endpoint can poll it and a retry can
    // reuse it. Best-effort: a write failure must not stop the shopper from
    // paying, so it is logged rather than thrown.
    try {
      await db
        .update(orders)
        .set({
          paymentProvider: "nowpayments",
          paymentInvoiceId: invoice.invoiceId,
          paymentUrl: invoice.invoiceUrl,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[payments] could not persist invoice for ${input.orderNumber}: ${(e as Error).message}`);
    }

    return {
      redirectUrl: invoice.invoiceUrl,
      providerRef: invoice.invoiceId,
      instructions: "Complete your crypto payment on NOWPayments' secure checkout.",
    };
  },
};

const REGISTRY: Record<ProviderId, PaymentProvider> = {
  nowpayments: nowPaymentsProvider,
};

export const PROVIDER_IDS = Object.keys(REGISTRY) as ProviderId[];

/** Resolve a provider id to its implementation. NOWPayments is the only
 *  method, so this always returns it regardless of the stored value - a store
 *  left over on an older setting still checks out cleanly. */
export function getProvider(_id?: string | null): PaymentProvider {
  return REGISTRY["nowpayments"];
}

/** Public description of the payment method, for the checkout option and admin. */
export function listProviders() {
  return PROVIDER_IDS.map((id) => {
    const p = REGISTRY[id];
    return { id, label: p.label, configured: p.isConfigured(), describe: p.describe() };
  });
}

export type WebhookOutcome = { handled: boolean; orderNumber?: string; paid?: boolean; reason?: string };

/**
 * Provider notification handler. Marks the order paid (or failed) and records
 * the reference. Called from an API webhook route, NOT from the browser - a
 * browser redirect can be forged, a server-to-server IPN cannot (once the
 * provider's signature has been verified, which the route does BEFORE calling
 * this function).
 *
 * IDEMPOTENT. NOWPayments retries a callback until it gets a 2xx, and a shopper
 * refreshing the return URL can race the webhook, so this can run more than once
 * for the same payment. The paid transition is therefore guarded: an order that
 * is already `paid` is left alone (no duplicate status event, no second CJ
 * forward - `forwardOrderToCj` is itself idempotent via a durable DB claim).
 */
export async function handleWebhook(
  providerId: string,
  payload: Record<string, unknown>,
): Promise<WebhookOutcome> {
  const note = parseNotification(payload);
  if (!note) {
    // A payout notification (a different event family this endpoint also
    // receives) carries no payment_status. Ignore it rather than guess.
    return { handled: false, reason: "no payment_status in payload" };
  }

  const orderNumber = String(note.orderId ?? "").trim().toUpperCase();
  if (!orderNumber) return { handled: false, reason: "no order reference in payload" };

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return { handled: false, orderNumber, reason: "unknown order" };

  const paid = note.stage === "paid";
  const storeStatus = storePaymentStatusFor(note.rawStatus);

  // Already settled: acknowledge without re-writing, so a retried callback
  // cannot append a second "paid" event or re-trigger fulfilment.
  if (order.paymentStatus === "paid" && paid) {
    return { handled: true, orderNumber, paid: true, reason: "already paid" };
  }

  await db
    .update(orders)
    .set({
      paymentStatus: storeStatus,
      paymentStatusDetail: note.rawStatus,
      paymentProvider: providerId,
      paymentRef: note.paymentId ?? order.paymentRef ?? null,
      paymentInvoiceId: note.invoiceId ?? order.paymentInvoiceId ?? null,
      // Keep the notification verbatim. When a payment looks stuck this is the
      // single most useful fact - what the provider last told us, and when.
      paymentLastIpn: payload,
      paymentLastIpnAt: new Date(),
      paymentLastIpnStatus: note.rawStatus,
      status: paid ? "paid" : order.status,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  // Forward the paid order to the upstream supplier. This is the SECOND entry
  // point into forwarding (the first is confirmPayment), which is exactly why
  // the guard is a durable DB claim rather than an in-memory flag: a webhook and
  // a return-URL confirmation can arrive at the same time, and only one of them
  // may place the CJ order. `forwardOrderToCj` never throws, so a CJ outage
  // cannot turn a valid payment notification into a retry storm.
  if (paid) {
    await forwardOrderToCj(order.id);
    // Deliver the paid receipt from THIS verified path. The signature was
    // checked before this function was ever called (see _core/app.ts), so the
    // settlement is trustworthy; the send is gated on it and idempotent via an
    // atomic claim, so a retried webhook cannot send a second receipt.
    await sendPaidReceiptOnce({
      orderId: order.id,
      rawStatus: note.rawStatus,
      verifiedPaid: true,
      trigger: "ipn",
    });
    // Announce the settled order to the owner's private Telegram channel. This
    // is the real-time path: the webhook fires the moment NOWPayments settles,
    // so the owner hears about a sale within seconds of it being final.
    await notifyPaidOrderOnce({
      orderId: order.id,
      rawStatus: note.rawStatus,
      verifiedPaid: true,
      trigger: "ipn",
    });
  }

  return { handled: true, orderNumber, paid };
}

/**
 * PULL confirmation - the primary path on this platform.
 *
 * Receiving a provider's inbound webhook needs a server route, which this
 * template only exposes for `/trpc`, `/app-storage`, `/api/health` and the
 * platform's own signed `/api/_jobs/*`. Rather than edit the platform layer,
 * PetParcel confirms payment by ASKING the gateway (outbound HTTP, which is a
 * supported capability) when the shopper returns from the hosted checkout.
 *
 * This is not a weaker check than a webhook: the answer comes from the
 * gateway's own API using our secret key, so a customer cannot mark an order
 * paid by editing a URL.
 *
 * Returns true when the gateway reports the order as paid.
 */
export async function verifyPayment(providerId: string, orderNumber: string): Promise<boolean> {
  if (providerId !== "nowpayments") return false;
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber.trim().toUpperCase()))
    .limit(1);
  if (!order) return false;
  const view = await getLivePaymentStatus(order);
  return view.paymentStatus === "paid";
}

/**
 * The live, authoritative status of an order's crypto payment, straight from
 * NOWPayments. This is what the storefront's status panel renders, so the shopper
 * sees the REAL state ("Confirming on the blockchain") rather than a smoothed
 * "unpaid".
 *
 * Resolution order, because a payment id only exists once the shopper has
 * actually started paying:
 *   1. `payment_ref` (a payment_id) - the most precise handle.
 *   2. `payment_invoice_id` - the invoice, polled for its payments.
 *   3. neither - the order has no payment yet; report that honestly.
 *
 * NEVER throws: a provider outage returns the STORED order status with an
 * `error` note, so the confirmation page always renders. It also never
 * downgrades a stored `paid` back to pending - once paid, always paid.
 */
export async function getLivePaymentStatus(order: {
  paymentStatus: string;
  paymentStatusDetail?: string | null;
  paymentRef?: string | null;
  paymentInvoiceId?: string | null;
}): Promise<PaymentStatusView> {
  const fallback = {
    paymentStatus: order.paymentStatus,
    storedStatus: order.paymentStatusDetail ?? null,
    error: null as string | null,
  };

  // No API key: the store is in offline-settlement mode. This is a REAL state,
  // not an error - the order is recorded and the owner settles it by hand. Say
  // that plainly instead of the old, misleading "keys are not configured"
  // banner, which read like a fault even on an order that had simply not been
  // paid yet. A stored `paid` is still reported as paid.
  if (!isNowPaymentsConfigured()) {
    return toPaymentStatusView(null, {
      ...fallback,
      configured: false,
      error:
        order.paymentStatus === "paid"
          ? null
          : "This store settles crypto payments manually, so live blockchain status isn't shown here.",
    });
  }

  // Configured, but this order has no payment handle yet (no payment_id and no
  // invoice_id). That is the normal state for an order placed before the keys
  // were set, or one whose invoice creation failed. Report it honestly as
  // "awaiting payment" rather than as an error.
  if (!order.paymentRef && !order.paymentInvoiceId) {
    return toPaymentStatusView(null, { ...fallback, configured: true });
  }

  try {
    let payment: PaymentStatusResponse | null = null;
    if (order.paymentRef) {
      payment = await getPaymentStatus(order.paymentRef);
    } else if (order.paymentInvoiceId) {
      payment = await getInvoiceStatus(order.paymentInvoiceId);
    }
    return toPaymentStatusView(payment, { ...fallback, configured: true });
  } catch (e) {
    return toPaymentStatusView(null, {
      ...fallback,
      configured: true,
      error: `Could not reach the payment provider: ${(e as Error).message}`,
    });
  }
}

/**
 * Reconcile an order against the live provider status and persist any change.
 * Used by the status endpoint so a page view can also settle an order whose
 * webhook was missed - the pull path acting as a safety net for the push path.
 *
 * Returns the view the client should render. Idempotent: a no-op when nothing
 * changed, and it never downgrades a paid order.
 */
export async function reconcileOrderPayment(orderId: string): Promise<PaymentStatusView | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;

  const view = await getLivePaymentStatus(order);

  // Persist only a real change, and never walk a paid order backwards.
  const nextStoreStatus = order.paymentStatus === "paid" ? "paid" : view.paymentStatus;
  const changed =
    nextStoreStatus !== order.paymentStatus ||
    (view.status ?? null) !== (order.paymentStatusDetail ?? null) ||
    (view.paymentId ?? null) !== (order.paymentRef ?? null);

  if (changed) {
    await db
      .update(orders)
      .set({
        paymentStatus: nextStoreStatus,
        paymentStatusDetail: view.status ?? order.paymentStatusDetail ?? null,
        paymentRef: view.paymentId ?? order.paymentRef ?? null,
        paymentInvoiceId: view.invoiceId ?? order.paymentInvoiceId ?? null,
        status: nextStoreStatus === "paid" ? "paid" : order.status,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    if (nextStoreStatus === "paid" && order.paymentStatus !== "paid") {
      await forwardOrderToCj(order.id);
    }
  }

  return { ...view, paymentStatus: nextStoreStatus };
}

// ── raw provider data (admin) ────────────────────────────────────────────────
//
// Everything the admin panel needs to answer "what did the provider actually
// say about this order?" in ONE object: the stored handles, the live figures,
// and the last webhook we received verbatim. Kept separate from
// `getLivePaymentStatus` because that view is written for the SHOPPER (no raw
// webhook bodies, no invoice ids) - this one is written for an operator.

export interface RawPaymentData {
  provider: "nowpayments";
  configured: boolean;
  /** The store's coarse status (unpaid | paid | failed | refunded). */
  paymentStatus: string;
  /** The raw status last persisted (`waiting`, `finished`, ...). */
  storedStatusDetail: string | null;
  /** The live raw status, straight from the provider (null when unreachable). */
  liveStatus: string | null;
  liveLabel: string | null;
  paymentId: string | null;
  invoiceId: string | null;
  paymentUrl: string | null;
  payAddress: string | null;
  payCurrency: string | null;
  payAmount: number | null;
  actuallyPaid: number | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  outcomeAmount: number | null;
  outcomeCurrency: string | null;
  /** The last IPN body, verbatim, and when it arrived. */
  lastIpn: Record<string, unknown> | null;
  lastIpnAt: string | null;
  lastIpnStatus: string | null;
  refund: {
    status: string | null;
    label: string | null;
    ref: string | null;
    amount: string | null;
    currency: string | null;
    refundedAt: string | null;
  };
  /** Set when the live lookup failed - the stored values are still returned. */
  error: string | null;
}

/** Assemble the raw provider view for an order. Never throws: a provider
 *  outage yields the stored values plus an `error` note, so the panel renders. */
export async function getOrderRawPaymentData(order: {
  paymentStatus: string;
  paymentStatusDetail?: string | null;
  paymentRef?: string | null;
  paymentInvoiceId?: string | null;
  paymentUrl?: string | null;
  paymentLastIpn?: Record<string, unknown> | null;
  paymentLastIpnAt?: Date | string | null;
  paymentLastIpnStatus?: string | null;
  refundStatus?: string | null;
  refundRef?: string | null;
  refundAmount?: string | null;
  refundCurrency?: string | null;
  refundedAt?: Date | string | null;
}): Promise<RawPaymentData> {
  const view = await getLivePaymentStatus(order);
  const iso = (v: Date | string | null | undefined): string | null =>
    v ? (v instanceof Date ? v.toISOString() : String(v)) : null;
  const rStage = order.refundStatus ? refundStage(order.refundStatus) : null;
  return {
    provider: "nowpayments",
    configured: view.configured,
    paymentStatus: view.paymentStatus,
    storedStatusDetail: order.paymentStatusDetail ?? null,
    liveStatus: view.status,
    liveLabel: view.status ? view.label : null,
    paymentId: view.paymentId ?? order.paymentRef ?? null,
    invoiceId: view.invoiceId ?? order.paymentInvoiceId ?? null,
    paymentUrl: order.paymentUrl ?? null,
    payAddress: view.payAddress,
    payCurrency: view.payCurrency,
    payAmount: view.payAmount,
    actuallyPaid: view.actuallyPaid,
    priceAmount: view.priceAmount,
    priceCurrency: view.priceCurrency,
    outcomeAmount: view.outcomeAmount,
    outcomeCurrency: view.outcomeCurrency,
    lastIpn: order.paymentLastIpn ?? null,
    lastIpnAt: iso(order.paymentLastIpnAt),
    lastIpnStatus: order.paymentLastIpnStatus ?? null,
    refund: {
      status: order.refundStatus ?? null,
      label: rStage ? refundStatusLabel(order.refundStatus) : null,
      ref: order.refundRef ?? null,
      amount: order.refundAmount ?? null,
      currency: order.refundCurrency ?? null,
      refundedAt: iso(order.refundedAt),
    },
    error: view.error,
  };
}

// ── refunds ──────────────────────────────────────────────────────────────────

export interface RefundResult {
  ok: boolean;
  /** `created` = accepted, funds on the way; `refunded` = sent; `failed`. */
  refundStatus: string;
  label: string;
  refundId: string | null;
  amount: string | null;
  currency: string | null;
  /** A human-readable reason when `ok` is false or the refund could not run. */
  reason?: string;
  order: unknown;
}

export class RefundError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "RefundError";
    this.status = status;
  }
}

/**
 * Refund a paid order through NOWPayments.
 *
 * GUARDS (all deliberate - this is the only money-moving admin action):
 *   1. The provider must be configured, or there is nothing to refund against.
 *   2. The order must have a `payment_id`. A refund is addressed to a specific
 *      on-chain payment; without one there is nothing to return and we refuse
 *      rather than guess.
 *   3. The order must be `paid`. Refunding an unpaid order would hand out money
 *      that never arrived.
 *   4. A refund already in flight (`created`) or complete (`refunded`) is
 *      REUSED, not repeated. This is the idempotency guard that stops a
 *      double-click - or a retry after a timeout - from issuing two payouts.
 *
 * Never partial by accident: `amount` is only forwarded when the caller passes
 * one explicitly, so the default is always a full refund.
 */
export async function refundOrderPayment(
  orderId: string,
  opts: { amount?: number; reason?: string; requestedBy?: string | null } = {},
): Promise<RefundResult> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new RefundError("Order not found.", 404);

  if (!isNowPaymentsConfigured()) {
    throw new RefundError(
      "Crypto refunds need the store's NOWPayments API key. Add NOWPAYMENTS_API_KEY and redeploy.",
      503,
    );
  }

  // Already refunded or in flight: reuse the existing refund instead of issuing
  // a second one. A `failed` refund is allowed to be retried - that is the one
  // state where trying again is the right thing to do.
  const existingStage = order.refundStatus ? refundStage(order.refundStatus) : null;
  if (existingStage === "created" || existingStage === "refunded") {
    return {
      ok: true,
      refundStatus: order.refundStatus ?? "created",
      label: refundStatusLabel(order.refundStatus),
      refundId: order.refundRef ?? null,
      amount: order.refundAmount ?? null,
      currency: order.refundCurrency ?? null,
      reason: "A refund already exists for this order - reusing it rather than issuing another.",
      order: await getOrderDetail(orderId),
    };
  }

  if (order.paymentStatus !== "paid") {
    throw new RefundError(
      `Only a paid order can be refunded. This order is "${order.paymentStatus}".`,
      409,
    );
  }
  const paymentId = String(order.paymentRef ?? "").trim();
  if (!paymentId) {
    throw new RefundError(
      "This order has no NOWPayments payment id, so there is no payment to refund. Refresh the status first.",
      409,
    );
  }

  let raw: RefundResponse;
  try {
    raw = await createRefund({
      paymentId,
      amount: opts.amount,
      reason: opts.reason,
    });
  } catch (e) {
    const message = (e as Error).message || "NOWPayments rejected the refund.";
    // Record the failed attempt so the panel shows why, then re-throw so the
    // caller (and the operator) sees the real reason.
    await db
      .update(orders)
      .set({ refundStatus: "failed", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    throw new RefundError(message, 502);
  }

  const rawStatus = String(raw.status ?? "created");
  const stage = refundStage(rawStatus);
  const refundId = raw.id !== null && raw.id !== undefined ? String(raw.id) : null;
  const amount = raw.amount !== null && raw.amount !== undefined ? String(raw.amount) : null;
  const currency = raw.currency ? String(raw.currency) : null;

  await db
    .update(orders)
    .set({
      refundStatus: stage === "unknown" ? "created" : stage,
      refundRef: refundId ?? order.refundRef ?? null,
      refundAmount: amount ?? order.refundAmount ?? null,
      refundCurrency: currency ?? order.refundCurrency ?? null,
      // A completed refund moves the store's own payment status to `refunded`;
      // an in-flight one is recorded but does not claim to have returned funds.
      ...(stage === "refunded" ? { paymentStatus: "refunded" as const } : {}),
      ...(stage === "refunded" ? { refundedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  // Log the refund on the order's own timeline so it is visible next to every
  // other state change, not only in the crypto panel.
  await db.insert(orderEvents).values({
    id: crypto.randomUUID(),
    orderId: order.id,
    status: order.status,
    note: `Refund ${stage}: ${refundStatusLabel(rawStatus)}${refundId ? ` (refund ${refundId})` : ""}${
      opts.requestedBy ? ` - by ${opts.requestedBy}` : ""
    }`,
  });

  return {
    ok: stage !== "failed",
    refundStatus: stage === "unknown" ? "created" : stage,
    label: refundStatusLabel(rawStatus),
    refundId,
    amount,
    currency,
    order: await getOrderDetail(orderId),
  };
}
