// ── The paid receipt: strictly gated, exactly once ──────────────────────────
//
// WHY THIS FILE EXISTS. The order confirmation email used to be sent when the
// order was PLACED - i.e. before the shopper had paid anything. A real order
// (PP-5VJGT7AS) therefore told the customer "a confirmation email is on its way"
// while the order was still awaiting payment. That is a promise the store could
// not keep, and on a crypto checkout it is worse than useless: the shopper is
// looking at an unpaid invoice while being told a receipt exists.
//
// THE TWO PROPERTIES THIS MODULE GUARANTEES, and why each needs real machinery:
//
//   1. ONLY AFTER PAYMENT IS 100% CONFIRMED. The email is sent only from a
//      VERIFIED payment path (the HMAC-SHA512-checked IPN webhook, the live
//      status reconciliation, or the post-return confirmation), and only when
//      the provider's own status is `finished` - the single status this store
//      treats as settled. `waiting`, `confirming`, `confirmed`, `sending`,
//      `partially_paid`, `failed`, `expired` and `refunded` are ALL refused.
//      A caller cannot bypass the gate by asking nicely: the paid state is
//      re-derived here from the order and the raw status, so an unpaid order
//      sends nothing no matter which path calls in.
//
//   2. EXACTLY ONE EMAIL PER ORDER. Three paths can observe the same settlement,
//      NOWPayments retries a webhook until it gets a 2xx, and two serverless
//      instances can handle the same payment concurrently. So the send is
//      guarded by an ATOMIC claim on `orders.confirmation_email_sent_at` (one
//      conditional UPDATE that exactly one caller can win - see
//      `claimOrderConfirmationEmail`). The loser never sends.
//
// THE CLAIM IS RELEASED when the provider did NOT accept the message (no API key
// yet, or a hard failure), so the order is not left looking as though the
// customer was told and a later attempt can still deliver the receipt. A send the
// provider ACCEPTED is never released and never repeated.
//
// This module is the ONLY place the paid receipt is sent from. Nothing else in
// the codebase should call `sendPaymentConfirmation` directly.
import {
  claimOrderConfirmationEmail,
  getOrderConfirmationEmailSentAt,
  getOrderDetail,
  releaseOrderConfirmationEmail,
} from "../db";
import { getSettings } from "../store-settings";
import { isPaidStatus } from "./nowpayments";
import { sendPaymentConfirmation, toEmailLines, type EmailTrigger, type SendResult } from "./email";

/** What happened when we tried to send the paid receipt. */
export type ReceiptOutcome =
  | { status: "sent"; sentAt: Date }
  /** The receipt already existed (or another caller won the claim). */
  | { status: "already_sent"; sentAt: Date | null }
  /** Refused: the payment is not settled. Nothing was sent. */
  | { status: "not_paid"; reason: string }
  /** The order does not exist (a stale or bogus reference). */
  | { status: "no_order"; reason: string }
  /** Claimed, but the provider did not accept the message. The claim was
   *  released, so a later attempt can retry. */
  | { status: "not_delivered"; reason: string };

/** True when this outcome resulted in an actual send on this call. */
export function didSendReceipt(outcome: ReceiptOutcome): boolean {
  return outcome.status === "sent";
}

/**
 * Send the order-confirmation (paid receipt) email AT MOST ONCE, and only when
 * the payment is genuinely settled.
 *
 * CALLERS MUST BE ON A VERIFIED PAYMENT PATH. The gate is re-checked here, so a
 * caller that passes an unpaid order is safe - it simply sends nothing - but
 * there is no reason to call this from anywhere else.
 *
 * @param orderId       the order to receipt
 * @param rawStatus     the raw provider status the caller observed (`finished`,
 *                      `waiting`, ...). Passing it is the strongest signal.
 * @param verifiedPaid  set true ONLY when the caller has asked the provider
 *                      directly (or verified a signed webhook) and been told the
 *                      payment settled. Combined with a stored `paid` status.
 * @param origin        the site origin, so the email's links are absolute.
 * @param trigger       which verified path produced this send ('ipn',
 *                      'reconciliation', 'post_return', 'admin_resend'),
 *                      recorded on `email_log.trigger` for the admin history.
 */
export async function sendPaidReceiptOnce(input: {
  orderId: string;
  rawStatus?: string | null;
  verifiedPaid?: boolean;
  origin?: string | null;
  trigger?: EmailTrigger | null;
}): Promise<ReceiptOutcome> {
  const detail = await getOrderDetail(input.orderId);
  if (!detail) return { status: "no_order", reason: "Order not found." };
  const order = detail.order;

  // ── GATE 1: is the payment actually settled? ──────────────────────────────
  // Two independent ways to be sure, and at least one must hold:
  //   - the raw provider status is literally `finished`, or
  //   - the caller verified with the provider AND the order is recorded paid.
  // Anything else - including `partially_paid`, which is a real loss if shipped
  // - is refused. There is deliberately no way to "force" a receipt.
  const paidByRawStatus = input.rawStatus ? isPaidStatus(input.rawStatus) : false;
  const paidByVerifiedStore = input.verifiedPaid === true && order.paymentStatus === "paid";
  if (!paidByRawStatus && !paidByVerifiedStore) {
    return {
      status: "not_paid",
      reason:
        `Order ${order.orderNumber} is not settled ` +
        `(stored "${order.paymentStatus}"${input.rawStatus ? `, provider "${input.rawStatus}"` : ""}), ` +
        `so no confirmation email was sent.`,
    };
  }

  // ── GATE 2: has it already gone? (fast path) ──────────────────────────────
  if (order.confirmationEmailSentAt) {
    return { status: "already_sent", sentAt: order.confirmationEmailSentAt };
  }

  // ── GATE 3: win the atomic claim ──────────────────────────────────────────
  // This is the mutual-exclusion point. A read-then-write "if not sent" check
  // would let two concurrent handlers both send; a single conditional UPDATE
  // matching `confirmation_email_sent_at IS NULL` lets exactly one win.
  const claimed = await claimOrderConfirmationEmail(order.id);
  if (!claimed) {
    return {
      status: "already_sent",
      sentAt: await getOrderConfirmationEmailSentAt(order.id),
    };
  }

  // ── Send. Never throws, and never leaves a phantom claim on failure. ──────
  try {
    const settings = await getSettings();
    const result: SendResult = await sendPaymentConfirmation(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        email: order.email,
        currency: order.currency,
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        taxCents: order.taxCents,
        totalCents: order.totalCents,
        shippingAddress: order.shippingAddress,
      },
      toEmailLines(detail.items),
      settings,
      input.origin ?? null,
      input.trigger ?? null,
    );

    if (result.status === "sent") {
      // The claim stands: the receipt exists and must never be sent again.
      return { status: "sent", sentAt: new Date() };
    }

    // `skipped` (no RESEND_API_KEY yet) or `failed` (provider refused). Either
    // way the customer was NOT told, so give the claim back - the order must not
    // look receipted, and a later attempt (an admin resend, a retried webhook)
    // must be able to deliver it.
    await releaseOrderConfirmationEmail(order.id);
    return {
      status: "not_delivered",
      reason: result.reason ?? "The mail provider did not accept the message.",
    };
  } catch (e) {
    await releaseOrderConfirmationEmail(order.id);
    return { status: "not_delivered", reason: (e as Error).message };
  }
}

/**
 * Whether the paid receipt has been sent for an order, and when.
 *
 * The order page uses this to state the truth: "confirmation email sent" is
 * shown only when this is non-null. Note it is read from the PERSISTED column,
 * not from the send attempt - so it survives a refresh, a new device and a
 * different serverless instance.
 */
export async function receiptSentAt(orderId: string): Promise<Date | null> {
  return getOrderConfirmationEmailSentAt(orderId);
}
