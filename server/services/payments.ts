// ── Payment abstraction ──────────────────────────────────────────────────────
//
// Bachs is the ONLY payment method PetParcel supports. It is a HOSTED
// checkout: we create a checkout session, hand the customer to Bachs' own
// secure page, and confirm the outcome server-to-server. PetParcel never sees
// a card number, so there is no card-like or custodial secret to hold here and
// swapping the account behind the keys is a config change.
//
//   bachs - card checkout in USD (the `USD_CARD` corridor). The shopper pays
//           the order total, to the cent, on Bachs' own page.
//
// Before the merchant keys are in place the provider degrades gracefully: the
// order is recorded as `unpaid` for offline settlement (the admin marks it paid
// when funds land). That is a behaviour of the provider, NOT a separate offline
// method - checkout offers a card and nothing else, and there is no
// bank-transfer UI anywhere in the store.
//
// Keys come from the app owner's environment (Settings → Environment variables),
// never from code. See the Bachs dashboard for the account setup.
//
// TWO CONFIRMATION PATHS, BOTH SERVER-SIDE:
//   1. PUSH - Bachs POSTs a signed event to /api/payments/bachs/webhook. The
//      route verifies the HMAC-SHA256 signature over the RAW body before this
//      module is ever called (see _core/app.ts), so `handleWebhook` only ever
//      sees an event that has already been proven authentic.
//   2. PULL - the shopper's confirmation page asks `getLivePaymentStatus`,
//      which queries Bachs directly with our API key. This is what makes the
//      flow robust when a webhook is delayed or the webhook secret is unset.
//
// A browser redirect can be forged; neither of these can. The return URL only
// decides WHERE the shopper lands, never whether the order is paid.
import { eq } from "drizzle-orm";
import { centsToMajor, formatMajor, majorToCents } from "../../shared/money";
import { db } from "../_core/db";
import { getOrderDetail } from "../db";
import { orderEvents, orders, paymentWebhookEvents } from "../../drizzle/schema";
import { forwardOrderToCj } from "./cj-order-forward";
import { sendPaidReceiptOnce } from "./order-receipt";
// The owner's private Telegram ping, sent from this same SIGNATURE-VERIFIED
// webhook path. Gated on the same settled status and idempotent on its own
// atomic claim; never throws, so a Telegram outage cannot turn a valid payment
// notification into a retry storm.
import { notifyPaidOrderOnce } from "./order-notify";
import {
  BachsError,
  createCheckoutSession,
  createRefund,
  getCheckoutSession,
  getPayment,
  isBachsConfigured,
  isSettled,
  parseBachsEvent,
  paymentStage,
  refundStage,
  refundStatusLabel,
  toPaymentStatusView,
  type CheckoutSessionDetailResponse,
  type ParsedBachsEvent,
  type PaymentResponse,
  type PaymentStatusView,
  type RefundResponse,
} from "./bachs";

export type ProviderId = "bachs";

export interface PaymentStartInput {
  /** The order's DB id, so the created session can be persisted against it. */
  orderId: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  email: string;
  customerName: string;
  /** Absolute URL the provider returns the shopper to after paying. */
  returnUrl: string;
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
 * Bachs hosted card checkout - the single payment method.
 *
 * With keys present the shopper is sent to Bachs' hosted page. With no keys
 * yet, the order is still created and returned to our own order page as
 * unpaid, so the storefront runs end-to-end until the merchant account is live.
 */
const bachsProvider: PaymentProvider = {
  id: "bachs",
  label: "Card (Visa, Mastercard, Amex)",
  isConfigured: () => isBachsConfigured(),
  describe: () =>
    "Pay securely by card on Bachs' hosted checkout. You'll be redirected to Bachs to enter your card details, and we only see the result - never your card number.",
  async start(input) {
    // No keys yet: record the order and return to the order page, unpaid.
    // Nothing is charged and no session is created - the store simply waits
    // for the merchant account to be connected.
    if (!this.isConfigured()) {
      return {
        redirectUrl: `/order/${input.orderNumber}`,
        providerRef: null,
        instructions: "Your order is placed. Payment is completed once the store accepts it.",
      };
    }

    // ── IDEMPOTENCY ──────────────────────────────────────────────────────────
    // A shopper who double-clicks "Place order", or retries after a network
    // blip, must NOT end up with two live checkout sessions for one order. If
    // this order already has a hosted checkout and it is still payable, hand
    // back the SAME URL rather than creating another.
    const [existing] = await db
      .select({
        paymentUrl: orders.paymentUrl,
        paymentInvoiceId: orders.paymentInvoiceId,
        paymentStatus: orders.paymentStatus,
      })
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .limit(1);

    if (existing?.paymentStatus === "unpaid" && existing.paymentUrl && existing.paymentInvoiceId) {
      if (await checkoutStillOpen(existing.paymentInvoiceId)) {
        return {
          redirectUrl: existing.paymentUrl,
          providerRef: existing.paymentInvoiceId,
          instructions: "Continue your card payment on Bachs' secure checkout.",
        };
      }
      // The previous session has closed. A new one is created below, with a
      // NEW idempotency key (derived from the closed session's id) so it is
      // genuinely a new session rather than a replay of the old request.
      //
      // WHY A NEW SESSION IS SAFE HERE, even though the provider's guidance is
      // "don't reuse the order for a new checkout". That warning is about a
      // payment arriving AFTER a checkout expired - a bank transfer sent
      // before it expired, which can still complete the old checkout and would
      // then be a second payment against the same order. A CARD cannot do
      // that: the provider states that "after expiry the checkout URL is
      // invalid", so an expired session cannot be paid, and the store takes
      // cards only. Creating a fresh session therefore cannot leave a shopper
      // able to pay twice - the old one is dead.
      //
      // The other half of the guard is the order itself: it can only be
      // settled once, and the supplier forward, the receipt and the owner's
      // notification each carry their own durable claim, so even a
      // double-charge could not ship the customer twice.
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
        `Refusing to check out order ${input.orderNumber}: ${input.totalCents} cents does not round-trip through major units.`,
      );
    }

    const session = await createCheckoutSession({
      amount: priceAmount,
      currency: input.currency,
      orderNumber: input.orderNumber,
      orderId: input.orderId,
      email: input.email,
      customerName: input.customerName,
      successUrl: input.returnUrl,
      cancelUrl: input.returnUrl,
      idempotencyKey: existing?.paymentInvoiceId
        ? `checkout-${input.orderId}-${existing.paymentInvoiceId}`
        : `checkout-${input.orderId}`,
    });

    // ── PRICE INTEGRITY, AGAINST THE PROVIDER ─────────────────────────────────
    // The create response does not echo what Bachs will charge, so the session
    // is read back and its amount compared with the order total. A genuine
    // disagreement is refused outright rather than persisted: a shopper charged
    // something other than the order total would either be short-paid or
    // overcharged, and either way the order must not be fulfilled as if it
    // were right.
    //
    // A failed READ is not a mismatch. The provider blipped; the amount we sent
    // is what Bachs charges, and the fulfilment path re-checks it against the
    // order total when the payment webhook arrives. So a read failure is logged
    // and the checkout continues.
    let readBack: CheckoutSessionDetailResponse | null = null;
    try {
      readBack = await getCheckoutSession(session.checkoutId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[payments] could not read back checkout ${session.checkoutId} for ${input.orderNumber}: ${(e as Error).message}`,
      );
    }
    if (readBack?.amount != null && String(readBack.amount).trim()) {
      const charged = majorToCents(readBack.amount);
      if (charged !== input.totalCents) {
        throw new Error(
          `Refusing to hand over checkout ${session.checkoutId}: Bachs priced it at ${formatMajor(charged)} but the order total is ${formatMajor(input.totalCents)}.`,
        );
      }
    }

    // Persist the session so the status endpoint can poll it and a retry can
    // reuse it. Best-effort: a write failure must not stop the shopper from
    // paying, so it is logged rather than thrown.
    try {
      await db
        .update(orders)
        .set({
          paymentProvider: "bachs",
          paymentInvoiceId: session.checkoutId,
          paymentUrl: session.checkoutUrl,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[payments] could not persist checkout session for ${input.orderNumber}: ${(e as Error).message}`,
      );
    }

    return {
      redirectUrl: session.checkoutUrl,
      providerRef: session.checkoutId,
      instructions: "Complete your card payment on Bachs' secure checkout.",
    };
  },
};

/** Is a hosted checkout session still payable? A session that has closed is
 *  replaced rather than handed back to a shopper who would only see an error
 *  page. A provider that cannot be reached is assumed STILL OPEN: creating a
 *  second session for one order is the thing the idempotency guard exists to
 *  prevent, and a stale URL costs the shopper one extra click. */
async function checkoutStillOpen(checkoutId: string): Promise<boolean> {
  try {
    const session = await getCheckoutSession(checkoutId);
    const status = String(session.status ?? "")
      .trim()
      .toLowerCase();
    if (!status) return true;
    return status === "open";
  } catch {
    return true;
  }
}

const REGISTRY: Record<ProviderId, PaymentProvider> = {
  bachs: bachsProvider,
};

export const PROVIDER_IDS = Object.keys(REGISTRY) as ProviderId[];

/** Resolve a provider id to its implementation. Bachs is the only method, so
 *  this always returns it regardless of the stored value - an order placed
 *  before the swap still checks out cleanly. */
export function getProvider(_id?: string | null): PaymentProvider {
  return REGISTRY["bachs"];
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
 * Claim a webhook event id, so a repeated delivery does no work.
 *
 * The provider guarantees at-least-once delivery and retries anything that did
 * not get a 2xx, so the same event id can arrive several times. The claim is a
 * single INSERT with a conflict guard, which two concurrent serverless
 * instances cannot both win.
 */
async function claimWebhookEvent(
  eventId: string,
  type: string,
  orderNumber: string | null,
): Promise<boolean> {
  const rows = await db
    .insert(paymentWebhookEvents)
    .values({ id: eventId, type, orderNumber })
    .onConflictDoNothing({ target: paymentWebhookEvents.id })
    .returning({ id: paymentWebhookEvents.id });
  return rows.length > 0;
}

/**
 * Release a claim, so a delivery that could not be processed can be retried.
 *
 * WHY THIS EXISTS. The claim is taken BEFORE the work, so two concurrent
 * deliveries cannot both do it. But a claim that is never released would also
 * swallow the provider's RETRY: the provider re-sends a delivery that did not
 * get a 2xx, and if the claim is still standing the retry would do nothing -
 * so a transient database blip would leave a paid order unsettled FOREVER.
 *
 * Releasing on failure restores the retry, and it is safe to release: the work
 * that did run was itself idempotent (the paid transition is guarded, and the
 * supplier forward, the receipt and the Telegram ping each carry their own
 * durable claim), so a re-run cannot double-fulfil.
 */
async function releaseWebhookEvent(eventId: string): Promise<void> {
  try {
    await db.delete(paymentWebhookEvents).where(eq(paymentWebhookEvents.id, eventId));
  } catch {
    // A claim that cannot be released is not fatal: the event's own guards
    // still protect the order, and the pull path can settle it.
  }
}

/**
 * Find the order an event belongs to.
 *
 * Three handles, most precise first:
 *   1. the checkout session id (`chk_...`) we stored on the order;
 *   2. the charge id (`ch_...`) we stored on the order;
 *   3. the order number, which Bachs echoes back as the checkout's own
 *      `reference` and as our `metadata.order_number`.
 */
async function findOrderForEvent(event: ParsedBachsEvent) {
  const orderNumber = event.orderNumber?.trim().toUpperCase();
  if (orderNumber) {
    const [byNumber] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);
    if (byNumber) return byNumber;
  }
  if (event.checkoutId) {
    const [byCheckout] = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentInvoiceId, event.checkoutId))
      .limit(1);
    if (byCheckout) return byCheckout;
  }
  if (event.chargeId) {
    const [byCharge] = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentRef, event.chargeId))
      .limit(1);
    if (byCharge) return byCharge;
  }
  return null;
}

/** Find the order a REFUND event belongs to. A refund's own `reference` is
 *  the refund reference, not an order number, so the order is found by the
 *  refund id we stored or by the charge it was issued against. */
async function findOrderForRefundEvent(event: ParsedBachsEvent) {
  if (event.refundId) {
    const [byRefund] = await db
      .select()
      .from(orders)
      .where(eq(orders.refundRef, event.refundId))
      .limit(1);
    if (byRefund) return byRefund;
  }
  if (event.chargeId) {
    const [byCharge] = await db
      .select()
      .from(orders)
      .where(eq(orders.paymentRef, event.chargeId))
      .limit(1);
    if (byCharge) return byCharge;
  }
  // Our refund references are `refund-<order number>`, so the order number can
  // be recovered from one even when the charge id is unknown.
  const reference = event.data?.reference;
  const fromReference =
    typeof reference === "string" && reference.toLowerCase().startsWith("refund-")
      ? reference.slice("refund-".length).trim().toUpperCase()
      : null;
  if (fromReference) {
    const [byNumber] = await db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, fromReference))
      .limit(1);
    if (byNumber) return byNumber;
  }
  return null;
}

/**
 * Provider notification handler. Marks the order paid (or failed) and records
 * the reference. Called from an API webhook route, NOT from the browser - a
 * browser redirect can be forged, a signed server-to-server event cannot (once
 * the provider's signature has been verified, which the route does BEFORE
 * calling this function).
 *
 * IDEMPOTENT, IN THREE LAYERS.
 *   1. The event id is claimed in a durable ledger, so a retried delivery does
 *      no work at all.
 *   2. An order that is already `paid` is left alone - no duplicate status
 *      event, no second CJ forward.
 *   3. The paid transition itself is guarded downstream: `forwardOrderToCj`
 *      is idempotent via a durable DB claim, the receipt is sent via an atomic
 *      claim, and so is the Telegram ping.
 *
 * AND IT NEVER WALKS A PAID ORDER BACKWARDS. The provider states plainly that
 * "events are not guaranteed to arrive in the order they happened, and a
 * retried event can arrive after a newer one". A late `collection.failed`
 * arriving after a `collection.succeeded` must therefore not un-settle an
 * order that has already shipped.
 */
export async function handleWebhook(
  providerId: string,
  payload: Record<string, unknown>,
): Promise<WebhookOutcome> {
  const event = parseBachsEvent(payload);
  if (!event) {
    // A body that is not a Bachs event at all. Ignore it rather than guess.
    return { handled: false, reason: "no event type in payload" };
  }

  if (event.eventId) {
    const claimed = await claimWebhookEvent(event.eventId, event.type, event.orderNumber);
    if (!claimed) {
      return { handled: true, orderNumber: event.orderNumber ?? undefined, reason: "duplicate event" };
    }
  }

  try {
    if (event.type.startsWith("refund.")) return await handleRefundEvent(event);
    return await handleCollectionEvent(event, providerId, payload);
  } catch (e) {
    // The work failed. Release the claim so the provider's RETRY can try
    // again - otherwise a transient database blip would leave a paid order
    // unsettled forever, because every retry would find the claim taken.
    if (event.eventId) await releaseWebhookEvent(event.eventId);
    throw e;
  }
}

/** A payment event: `collection.*` or `checkout.*`. */
async function handleCollectionEvent(
  event: ParsedBachsEvent,
  providerId: string,
  payload: Record<string, unknown>,
): Promise<WebhookOutcome> {
  const order = await findOrderForEvent(event);
  if (!order) {
    return { handled: false, orderNumber: event.orderNumber ?? undefined, reason: "unknown order" };
  }

  // Already settled: acknowledge without re-writing, so a retried or late
  // event cannot append a second "paid" event or re-trigger fulfilment.
  if (order.paymentStatus === "paid") {
    return { handled: true, orderNumber: order.orderNumber, paid: true, reason: "already paid" };
  }

  const rawStatus = event.rawStatus ?? "";
  const amountPaidCents = event.amountPaidCents ?? event.amountCents;
  const settled = isSettled(rawStatus, {
    amountDueCents: order.totalCents,
    amountPaidCents,
  });

  // The amount the provider actually collected, in the order's own currency.
  // A SHORT payment never ships: shipping a short payment is a real,
  // unrecoverable loss, so it stays unpaid and the balance is outstanding.
  const sameCurrency =
    !event.currency || event.currency.toUpperCase() === (order.currency || "USD").toUpperCase();
  const chargedCents = event.amountCents;
  const shortPaid =
    settled && sameCurrency && chargedCents != null && chargedCents < order.totalCents;

  let nextStatus: "unpaid" | "paid" | "failed" | "refunded";
  switch (event.type) {
    case "collection.succeeded":
      nextStatus = settled && !shortPaid ? "paid" : "unpaid";
      break;
    case "collection.failed":
      // NOT a failed order. The provider is explicit: "the checkout stays
      // open, so the customer can try again" - and "don't cancel the order on
      // it". The attempt failed; the order is still awaiting payment.
      nextStatus = "unpaid";
      break;
    case "collection.underpaid":
      nextStatus = "unpaid";
      break;
    case "checkout.completed":
      nextStatus = settled && !shortPaid ? "paid" : "unpaid";
      break;
    case "checkout.expired":
      nextStatus = "failed";
      break;
    default:
      return { handled: false, orderNumber: order.orderNumber, reason: `ignored event ${event.type}` };
  }

  if (shortPaid) {
    // eslint-disable-next-line no-console
    console.warn(
      `[payments] ${order.orderNumber}: Bachs collected ${formatMajor(chargedCents!)} but the order total is ${formatMajor(order.totalCents)} - not fulfilling.`,
    );
  }

  await db
    .update(orders)
    .set({
      paymentStatus: nextStatus,
      paymentStatusDetail: rawStatus || order.paymentStatusDetail || null,
      paymentProvider: providerId,
      paymentRef: event.chargeId ?? order.paymentRef ?? null,
      paymentInvoiceId: event.checkoutId ?? order.paymentInvoiceId ?? null,
      // Keep the event verbatim. When a payment looks stuck this is the
      // single most useful fact - what the provider last told us, and when.
      paymentLastIpn: payload,
      paymentLastIpnAt: new Date(),
      paymentLastIpnStatus: rawStatus || null,
      status: nextStatus === "paid" ? "paid" : order.status,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  // Forward the paid order to the upstream supplier. This is the SECOND entry
  // point into forwarding (the first is confirmPayment), which is exactly why
  // the guard is a durable DB claim rather than an in-memory flag: a webhook and
  // a return-URL confirmation can arrive at the same time, and only one of them
  // may place the CJ order. `forwardOrderToCj` never throws, so a CJ outage
  // cannot turn a valid payment notification into a retry storm.
  if (nextStatus === "paid") {
    await forwardOrderToCj(order.id);
    // Deliver the paid receipt from THIS verified path. The signature was
    // checked before this function was ever called (see _core/app.ts), so the
    // settlement is trustworthy; the send is gated on it and idempotent via an
    // atomic claim, so a retried webhook cannot send a second receipt.
    await sendPaidReceiptOnce({
      orderId: order.id,
      rawStatus,
      verifiedPaid: true,
      trigger: "ipn",
    });
    // Announce the settled order to the owner's private Telegram channel. This
    // is the real-time path: the webhook fires the moment Bachs settles, so the
    // owner hears about a sale within seconds of it being final.
    await notifyPaidOrderOnce({
      orderId: order.id,
      rawStatus,
      verifiedPaid: true,
      trigger: "ipn",
    });
  }

  return { handled: true, orderNumber: order.orderNumber, paid: nextStatus === "paid" };
}

/** A refund event: `refund.created`, `refund.paid`, `refund.failed`. */
async function handleRefundEvent(event: ParsedBachsEvent): Promise<WebhookOutcome> {
  const order = await findOrderForRefundEvent(event);
  if (!order) return { handled: false, reason: "unknown order" };

  const rawStatus = event.refundStatus ?? "";
  const stage = refundStage(rawStatus);
  if (stage === "unknown") {
    return { handled: true, orderNumber: order.orderNumber, reason: "unknown refund status" };
  }

  const data = event.data ?? {};
  const amount =
    typeof data.refunded_amount === "string" && data.refunded_amount.trim()
      ? data.refunded_amount
      : typeof data.requested_amount === "string" && data.requested_amount.trim()
        ? data.requested_amount
        : order.refundAmount;

  await db
    .update(orders)
    .set({
      refundStatus: stage,
      refundRef: event.refundId ?? order.refundRef ?? null,
      refundAmount: amount ?? null,
      refundCurrency: event.currency ?? order.refundCurrency ?? null,
      // A completed refund moves the store's own payment status to `refunded`;
      // an in-flight one is recorded but does not claim to have returned funds.
      ...(stage === "refunded" ? { paymentStatus: "refunded" as const } : {}),
      ...(stage === "refunded" ? { refundedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  await db.insert(orderEvents).values({
    id: crypto.randomUUID(),
    orderId: order.id,
    status: order.status,
    note: `Refund ${stage}: ${refundStatusLabel(rawStatus)}${
      event.refundId ? ` (refund ${event.refundId})` : ""
    }`,
  });

  return { handled: true, orderNumber: order.orderNumber, paid: false };
}

/**
 * PULL confirmation - the safety net on this platform.
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
  if (providerId !== "bachs") return false;
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
 * The live, authoritative status of an order's card payment, straight from
 * Bachs. This is what the storefront's status panel renders, so the shopper
 * sees the REAL state ("Payment complete") rather than a smoothed "unpaid".
 *
 * Resolution order, because a charge id only exists once the shopper has
 * actually started paying:
 *   1. the CHECKOUT SESSION (`payment_invoice_id`) - it carries both the
 *      session's own state and the charge it produced, so it is the one read
 *      that answers "can this shopper still pay?" as well as "did they pay?";
 *   2. the CHARGE (`payment_ref`) - the authoritative status of the money.
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
  paymentUrl?: string | null;
  totalCents?: number;
  currency?: string;
}): Promise<PaymentStatusView> {
  const fallback = {
    paymentStatus: order.paymentStatus,
    storedStatus: order.paymentStatusDetail ?? null,
    error: null as string | null,
    checkoutUrl: order.paymentUrl ?? null,
    chargeId: order.paymentRef ?? null,
    checkoutId: order.paymentInvoiceId ?? null,
  };

  // No API key: the store is in offline-settlement mode. This is a REAL state,
  // not an error - the order is recorded and the owner settles it by hand. Say
  // that plainly instead of a misleading "keys are not configured" banner,
  // which read like a fault even on an order that had simply not been paid yet.
  // A stored `paid` is still reported as paid.
  if (!isBachsConfigured()) {
    return toPaymentStatusView(null, {
      ...fallback,
      configured: false,
      error:
        order.paymentStatus === "paid"
          ? null
          : "This store settles card payments manually, so live card status isn't shown here.",
    });
  }

  // Configured, but this order has no handle yet (no checkout id and no charge
  // id). That is the normal state for an order placed before the keys were set,
  // or one whose checkout creation failed. Report it honestly as "awaiting
  // payment" rather than as an error.
  if (!order.paymentRef && !order.paymentInvoiceId) {
    return toPaymentStatusView(null, { ...fallback, configured: true });
  }

  try {
    let payment: PaymentResponse | null = null;
    let checkoutStatus: string | null = null;

    if (order.paymentInvoiceId) {
      const session = await getCheckoutSession(order.paymentInvoiceId);
      checkoutStatus =
        String(session.status ?? "")
          .trim()
          .toLowerCase() || null;
      if (session.charge) {
        payment = session.charge;
      } else if (session.payment_status) {
        // No charge yet: the checkout-level state stands in for it. The
        // session's own `payment_status` is a different vocabulary from the
        // charge's, but it maps onto the same stages.
        const status = String(session.payment_status).trim().toLowerCase();
        const settled = status === "succeeded" || status === "paid" || status === "overpaid";
        payment = {
          payment_id: null,
          checkout_id: session.checkout_id ?? order.paymentInvoiceId,
          status,
          amount: session.amount ?? null,
          amount_paid: settled ? (session.amount ?? null) : null,
          currency: session.currency ?? null,
          payment_method: session.payment_method ?? null,
        };
      }
    }
    if (!payment && order.paymentRef) {
      payment = await getPayment(order.paymentRef);
    }

    // The store's own status, computed from what is actually known. A stored
    // `paid` is never walked backwards by a later, less certain reading.
    const rawStatus = payment?.status ? String(payment.status).toLowerCase() : null;
    const liveStatus = liveStoreStatus(rawStatus, {
      checkoutStatus,
      amountDueCents: order.totalCents ?? null,
      amountPaidCents: payment?.amount_paid ? majorToCents(payment.amount_paid) : null,
    });
    const paymentStatus = order.paymentStatus === "paid" ? "paid" : liveStatus;

    return toPaymentStatusView(payment, { ...fallback, paymentStatus, configured: true });
  } catch (e) {
    return toPaymentStatusView(null, {
      ...fallback,
      configured: true,
      error: `Could not reach the payment provider: ${(e as Error).message}`,
    });
  }
}

/**
 * The store's own payment status for a live reading.
 *
 * The rules, in order:
 *   * settled -> `paid` (a short payment is NOT settled - see `isSettled`);
 *   * refunded -> `refunded`;
 *   * a checkout that has closed without payment -> `failed`;
 *   * a failed ATTEMPT on a checkout that is still open -> `unpaid`, because
 *     the shopper can try again on the same session;
 *   * anything else -> `unpaid`.
 */
function liveStoreStatus(
  rawStatus: string | null,
  opts: {
    checkoutStatus?: string | null;
    amountDueCents?: number | null;
    amountPaidCents?: number | null;
  },
): "unpaid" | "paid" | "failed" | "refunded" {
  if (isSettled(rawStatus, opts)) return "paid";
  const stage = paymentStage(rawStatus);
  if (stage === "refunded") return "refunded";
  const checkoutClosed =
    opts.checkoutStatus === "expired" ||
    opts.checkoutStatus === "cancelled" ||
    opts.checkoutStatus === "canceled";
  if (checkoutClosed) return "failed";
  if (stage === "failed") {
    // A failed attempt on a still-open checkout is retryable, so it is not a
    // failed order. When the checkout's state is unknown, the failed attempt
    // is the only fact there is, and it is reported as one.
    return opts.checkoutStatus === "open" ? "unpaid" : "failed";
  }
  return "unpaid";
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
    (view.chargeId ?? null) !== (order.paymentRef ?? null);

  if (changed) {
    await db
      .update(orders)
      .set({
        paymentStatus: nextStoreStatus,
        paymentStatusDetail: view.status ?? order.paymentStatusDetail ?? null,
        paymentRef: view.chargeId ?? order.paymentRef ?? null,
        paymentInvoiceId: view.checkoutId ?? order.paymentInvoiceId ?? null,
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
// webhook bodies, no checkout ids) - this one is written for an operator.

export interface RawPaymentData {
  provider: "bachs";
  configured: boolean;
  /** The store's coarse status (unpaid | paid | failed | refunded). */
  paymentStatus: string;
  /** The raw status last persisted (`succeeded`, `processing`, ...). */
  storedStatusDetail: string | null;
  /** The live raw status, straight from the provider (null when unreachable). */
  liveStatus: string | null;
  liveLabel: string | null;
  /** The charge id (`ch_...`) - what a refund is addressed to. */
  chargeId: string | null;
  /** The checkout session id (`chk_...`). */
  checkoutId: string | null;
  /** The hosted checkout URL. */
  checkoutUrl: string | null;
  /** The payment method that collected it (`USD_CARD` / `CARD`). */
  paymentMethod: string | null;
  /** The amount due, in cents. */
  amountCents: number | null;
  /** The amount actually received, in cents. */
  amountPaidCents: number | null;
  /** The currency the payment was collected in. */
  currency: string | null;
  /** The last webhook body, verbatim, and when it arrived. */
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
  totalCents?: number;
  currency?: string;
}): Promise<RawPaymentData> {
  const view = await getLivePaymentStatus(order);
  const iso = (v: Date | string | null | undefined): string | null =>
    v ? (v instanceof Date ? v.toISOString() : String(v)) : null;
  const rStage = order.refundStatus ? refundStage(order.refundStatus) : null;
  return {
    provider: "bachs",
    configured: view.configured,
    paymentStatus: view.paymentStatus,
    storedStatusDetail: order.paymentStatusDetail ?? null,
    liveStatus: view.status,
    liveLabel: view.status ? view.label : null,
    chargeId: view.chargeId ?? order.paymentRef ?? null,
    checkoutId: view.checkoutId ?? order.paymentInvoiceId ?? null,
    checkoutUrl: order.paymentUrl ?? null,
    paymentMethod: view.paymentMethod,
    amountCents: view.amountCents,
    amountPaidCents: view.amountPaidCents,
    currency: view.currency,
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
 * Refund a paid order through Bachs.
 *
 * GUARDS (all deliberate - this is the only money-moving admin action):
 *   1. The provider must be configured, or there is nothing to refund against.
 *   2. The order must have a CHARGE id. A refund is addressed to a specific
 *      charge; without one there is nothing to return and we refuse rather
 *      than guess.
 *   3. The order must be `paid`. Refunding an unpaid order would hand out money
 *      that never arrived.
 *   4. A refund already in flight (`created`) or complete (`refunded`) is
 *      REUSED, not repeated. This is the idempotency guard that stops a
 *      double-click - or a retry after a timeout - from issuing two payouts.
 *      (Bachs refuses a second refund on one charge as well, but the store
 *      must not rely on the provider to be the one that stops it.)
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

  if (!isBachsConfigured()) {
    throw new RefundError(
      "Card refunds need the store's Bachs API key. Add BACHS_API_KEY and redeploy.",
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
  const chargeId = String(order.paymentRef ?? "").trim();
  if (!chargeId) {
    throw new RefundError(
      "This order has no Bachs charge id, so there is no charge to refund. Refresh the status first.",
      409,
    );
  }

  // The refund reference must be unique per account, and a reference that was
  // used by a refund that FAILED is still taken. A retry after a failure
  // therefore carries the failed refund's id, which makes it a new reference.
  const attemptSuffix =
    existingStage === "failed" && order.refundRef ? `-${order.refundRef}` : "";
  const reference = `refund-${order.orderNumber}${attemptSuffix}`.slice(0, 128);

  let raw: RefundResponse;
  try {
    raw = await createRefund({
      chargeId,
      reference,
      amount: opts.amount,
      reason: opts.reason,
      idempotencyKey: reference,
    });
  } catch (e) {
    const message =
      (e as Error).message || "Bachs rejected the refund.";
    // Record the failed attempt so the panel shows why, then re-throw so the
    // caller (and the operator) sees the real reason.
    await db
      .update(orders)
      .set({ refundStatus: "failed", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    throw new RefundError(message, 502);
  }

  const rawStatus = String(raw.status ?? "processing");
  const stage = refundStage(rawStatus);
  const refundId = raw.refund_id !== null && raw.refund_id !== undefined ? String(raw.refund_id) : null;
  const amount =
    raw.refunded_amount !== null && raw.refunded_amount !== undefined
      ? String(raw.refunded_amount)
      : raw.requested_amount !== null && raw.requested_amount !== undefined
        ? String(raw.requested_amount)
        : null;
  const currency = raw.charge_id ? (order.currency ?? null) : null;

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
  // other state change, not only in the payment panel.
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

/** Re-exported so callers that already import the provider's helpers from
 *  here keep working. */
export { BachsError };
