// ── Paid-order notifications to the owner's private Telegram channel ───────
//
// WHAT THIS DOES. The moment a payment SETTLES, post one message to the store
// owner's private Telegram chat containing everything they need to act without
// opening the admin panel: the order number, the amount and currency, the
// product(s) ordered and the customer's country.
//
// WHY IT MIRRORS `order-receipt.ts` RATHER THAN ITS OWN THING. The paid receipt
// email already solved this exact problem - "notify about a settled payment,
// exactly once, from three different verified paths, without ever breaking
// checkout" - and its answers are the right ones. Reusing its shape means there
// is ONE mental model for one-shot paid-order side effects on this store, and a
// reviewer who understands the receipt understands this. The two run side by
// side from the same call sites; neither depends on the other.
//
// THE THREE PROPERTIES THIS MODULE GUARANTEES:
//
//   1. ONLY FOR A GENUINELY SETTLED PAYMENT. Same gate as the receipt, checked
//      HERE rather than trusted from the caller: the raw provider status must be
//      `finished`, or the caller must have verified with the provider AND the
//      order must be recorded `paid`. `partially_paid` - a real, unrecoverable
//      loss if treated as paid - is refused. A caller cannot bypass the gate by
//      asking nicely.
//
//   2. EXACTLY ONE NOTIFICATION PER ORDER. Three paths can observe the same
//      settlement, NOWPayments retries a webhook until it gets a 2xx, and two
//      serverless instances can handle the same payment concurrently. So the
//      send is guarded by an ATOMIC CLAIM on `orders.telegram_notified_at` (one
//      conditional UPDATE that exactly one caller can win - see
//      `claimTelegramNotification`). The loser returns `already_notified`.
//
//   3. IT CAN NEVER BREAK THE ORDER FLOW. Telegram is a convenience channel, not
//      part of the transaction. A missing token, a wrong chat id, a rate limit
//      or an outage all return an outcome; nothing here throws. That is what
//      makes it safe to `await` directly on the payment-confirmation path.
//
// The claim is RELEASED when Telegram did not accept the message, so the order is
// not left looking as though the owner was told, and a later attempt (a retried
// webhook, an admin re-send) can still deliver it. A send Telegram ACCEPTED is
// never released and never repeated.
import {
  claimTelegramNotification,
  enqueueTelegramOutbox,
  getOrderDetail,
  getTelegramNotifiedAt,
  releaseTelegramNotification,
  setTelegramNotifyError,
} from "../db";
import { getSettings } from "../store-settings";
import { isPaidStatus } from "./nowpayments";
import { escapeHtml, isTelegramConfigured, sendTelegramMessage, TELEGRAM_SAFE_CHARS } from "./telegram";
import { formatMoney } from "../../shared/store";

/**
 * Which verified path produced a notification. Recorded only in the log line -
 * unlike the email's `trigger` there is no per-order history table for Telegram,
 * because the durable `telegram_notified_at` claim plus one log line is the
 * whole audit surface this channel needs.
 */
export type NotifyTrigger =
  | "ipn"
  | "reconciliation"
  | "post_return"
  | "admin_resend"
  | "manual"
  /** The durable outbox sweep re-trying a notification the in-request attempt
   *  could not deliver (see `services/telegram-outbox.ts`). */
  | "outbox";

/** What happened when we tried to notify. Mirrors `ReceiptOutcome` on purpose. */
export type NotifyOutcome =
  | { status: "sent"; sentAt: Date; messagesSent: number }
  /** Already delivered (or another caller won the claim). Nothing was sent. */
  | { status: "already_notified"; sentAt: Date | null }
  /** Refused: the payment is not settled. Nothing was sent. */
  | { status: "not_paid"; reason: string }
  /** The order does not exist (a stale or bogus reference). */
  | { status: "no_order"; reason: string }
  /** Telegram is not configured yet - the normal pre-setup state. */
  | { status: "skipped"; reason: string }
  /** Claimed, but Telegram did not accept the message. The claim was released,
   *  so a later attempt can retry. */
  | { status: "not_delivered"; reason: string };

/** True when this outcome resulted in an actual send on this call. */
export function didSendNotification(outcome: NotifyOutcome): boolean {
  return outcome.status === "sent";
}

/**
 * Resolve the customer's country from what the order already stores.
 *
 * The order carries a SNAPSHOT of the shipping address (see the `orders` table
 * comment), so the country is already on the row and needs no extra lookup. It
 * is nonetheless treated as optional: an older order, or one created by a
 * migration that predates the field being required, may have it blank - and a
 * notification with "(not provided)" in that one slot is far more useful than a
 * missing notification or a crash.
 *
 * Exported so the fallback is unit-tested directly rather than only through a
 * full send.
 */
export function customerCountry(address: { country?: string | null } | null | undefined): string {
  const raw = String(address?.country ?? "").trim();
  return raw || "Not provided";
}

/** One product line, already flattened for the message. */
interface NotifyLine {
  name: string;
  variant: string | null;
  qty: number;
  lineTotalCents: number;
}

/**
 * Build the message body.
 *
 * EVERY interpolated value is escaped: a product name is supplier data that has
 * already contained `&` and `-`, and the country comes from a free-text address
 * field. The body is sent with `parse_mode: "HTML"`, so an unescaped `<` or `&`
 * would either be rejected by Telegram ("can't parse entities") or render as
 * markup the value was never meant to produce.
 *
 * THE ITEM LIST IS CAPPED. A cart can hold many lines, and past the Telegram
 * limit the transport would have to split the message - which would cut the
 * totals and the country away from the order number. So the list is bounded
 * first, at a length measured against `TELEGRAM_SAFE_CHARS`, with the remainder
 * summarised as "... and N more items". A whole order therefore arrives as ONE
 * readable message; the transport's splitter stays a safety net that never fires.
 *
 * Exported for the escaping and truncation tests.
 */
export function buildOrderNotification(input: {
  orderNumber: string;
  currency: string;
  totalCents: number;
  country: string;
  lines: NotifyLine[];
}): string {
  const head = "🐾 <b>New paid order</b>";
  const summary = [
    `<b>Order</b>   ${escapeHtml(input.orderNumber)}`,
    `<b>Total</b>   ${escapeHtml(formatMoney(input.totalCents, input.currency))}`,
    `<b>Country</b> ${escapeHtml(input.country)}`,
  ].join("\n");

  // FIXED_PART is the head + the summary block + the "Items" heading, none of
  // which shrinks. The rest of the budget goes to the item lines.
  const fixedBudget = head.length + summary.length + "\n\n<b>Items</b>".length + 64;
  const budget = Math.max(200, TELEGRAM_SAFE_CHARS - fixedBudget);

  const rendered: string[] = [];
  let used = 0;
  for (const line of input.lines) {
    const variant = line.variant ? ` (${escapeHtml(line.variant)})` : "";
    const text =
      `• ${escapeHtml(line.name)}${variant} × ${line.qty} — ` +
      `${escapeHtml(formatMoney(line.lineTotalCents, input.currency))}`;
    // `+ 1` accounts for the joining newline, so `used` tracks the real length.
    if (used + text.length + 1 > budget && rendered.length > 0) break;
    rendered.push(text);
    used += text.length + 1;
  }

  const omitted = input.lines.length - rendered.length;
  const itemBlock = rendered.length > 0 ? rendered.join("\n") : "• (no line items recorded)";
  const tail = omitted > 0 ? `\n…and ${omitted} more item${omitted === 1 ? "" : "s"}` : "";

  return [head, "", summary, "", "<b>Items</b>", itemBlock + tail].join("\n");
}

/**
 * Notify the owner about a settled order, AT MOST ONCE.
 *
 * CALLERS MUST BE ON A VERIFIED PAYMENT PATH. The paid gate is re-checked here,
 * so a caller that passes an unpaid order simply sends nothing - but there is no
 * reason to call this from anywhere else.
 *
 * @param orderId      the order to announce
 * @param rawStatus    the raw provider status the caller observed (`finished`,
 *                     `waiting`, ...). The strongest signal.
 * @param verifiedPaid set true ONLY when the caller asked the provider directly
 *                     (or verified a signed webhook) and was told it settled.
 * @param trigger      which verified path produced this send (log line only).
 * @param deps         test seam - passed straight through to the transport.
 */
export async function notifyPaidOrderOnce(input: {
  orderId: string;
  rawStatus?: string | null;
  verifiedPaid?: boolean;
  trigger?: NotifyTrigger | null;
  deps?: Parameters<typeof sendTelegramMessage>[1];
}): Promise<NotifyOutcome> {
  const trigger = input.trigger ?? "manual";
  try {
    // ── GATE 0: is the channel even set up? ──────────────────────────────────
    // Checked BEFORE the claim, deliberately. If Telegram is unconfigured we
    // must not spend the claim, or the order would be marked "notified" and a
    // later attempt - after the owner adds the token - would silently no-op.
    if (!isTelegramConfigured()) {
      return {
        status: "skipped",
        reason:
          "Telegram is not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID).",
      };
    }

    const detail = await getOrderDetail(input.orderId);
    if (!detail) return { status: "no_order", reason: "Order not found." };
    const order = detail.order;

    // ── GATE 1: is the payment actually settled? ─────────────────────────────
    // Two independent ways to be sure, and at least one must hold - identical to
    // the receipt gate, so the two side effects agree on what "paid" means.
    const paidByRawStatus = input.rawStatus ? isPaidStatus(input.rawStatus) : false;
    const paidByVerifiedStore = input.verifiedPaid === true && order.paymentStatus === "paid";
    if (!paidByRawStatus && !paidByVerifiedStore) {
      return {
        status: "not_paid",
        reason:
          `Order ${order.orderNumber} is not settled ` +
          `(stored "${order.paymentStatus}"${input.rawStatus ? `, provider "${input.rawStatus}"` : ""}), ` +
          `so the owner was not notified.`,
      };
    }

    // ── GATE 2: has it already gone? (fast path) ─────────────────────────────
    if (order.telegramNotifiedAt) {
      return { status: "already_notified", sentAt: order.telegramNotifiedAt };
    }

    // ── GATE 3: win the atomic claim ─────────────────────────────────────────
    // The mutual-exclusion point. A read-then-write "if not notified" check
    // would let two concurrent handlers both send; a single conditional UPDATE
    // matching `telegram_notified_at IS NULL` lets exactly one win.
    const claimed = await claimTelegramNotification(order.id);
    if (!claimed) {
      return {
        status: "already_notified",
        sentAt: await getTelegramNotifiedAt(order.id),
      };
    }

    // ── Send. Never throws; never leaves a phantom claim on failure. ─────────
    try {
      // Settings are read for the brand name only; a settings read failure must
      // not stop a notification, so it falls back rather than propagating.
      const settings = await getSettings().catch(() => null);

      const lines: NotifyLine[] = detail.items.map((i) => ({
        name: i.nameSnapshot,
        variant: i.variantSnapshot,
        qty: i.qty,
        lineTotalCents: i.priceCents * i.qty,
      }));

      const body = buildOrderNotification({
        orderNumber: order.orderNumber,
        currency: order.currency,
        totalCents: order.totalCents,
        country: customerCountry(order.shippingAddress),
        lines,
      });

      void settings; // reserved for a future branded footer; not needed today.

      const result = await sendTelegramMessage(body, input.deps);

      if (result.status === "sent") {
        // The claim stands: the owner has been told and must not be told again.
        await setTelegramNotifyError(order.id, null).catch(() => {});
        // eslint-disable-next-line no-console
        console.log(
          `[telegram] notified ${order.orderNumber} (${trigger}, ` +
            `${result.messagesSent ?? 1} message(s), ${result.attempts ?? 1} attempt(s))`,
        );
        return { status: "sent", sentAt: new Date(), messagesSent: result.messagesSent ?? 1 };
      }

      // `skipped` (raced to unconfigured) or `failed` (Telegram refused). Either
      // way the owner was NOT told, so give the claim back - the order must not
      // look notified, and a later attempt must be able to deliver it.
      const reason = result.reason ?? "Telegram did not accept the message.";
      await setTelegramNotifyError(order.id, reason).catch(() => {});
      await releaseTelegramNotification(order.id);
      // The in-request retries are exhausted WITHOUT Telegram accepting the
      // message. Record a durable reminder so the outbox sweep keeps trying
      // after this invocation ends - the one thing that stops a Telegram outage
      // outliving the request from dropping a real sale's alert. `enqueueTelegramOutbox`
      // is an upsert keyed on the order and never throws, so this is safe to call
      // on the payment path.
      await enqueueTelegramOutbox({ orderId: order.id, orderNumber: order.orderNumber, reason });
      // eslint-disable-next-line no-console
      console.warn(`[telegram] not delivered for ${order.orderNumber}: ${reason}`);
      return { status: "not_delivered", reason };
    } catch (e) {
      const reason = (e as Error).message;
      await setTelegramNotifyError(order.id, reason).catch(() => {});
      await releaseTelegramNotification(order.id);
      // An unexpected throw is still a notification the owner did not get, so it
      // gets the same durable reminder as a refused send. Never let the queuing
      // itself become the failure: it swallows and logs its own errors.
      await enqueueTelegramOutbox({ orderId: order.id, orderNumber: order.orderNumber, reason });
      return { status: "not_delivered", reason };
    }
  } catch (e) {
    // A failure anywhere above - including the order read or the claim itself -
    // is returned, never thrown. The payment path this sits on must complete.
    return { status: "not_delivered", reason: (e as Error).message };
  }
}

/** Whether the owner has been notified about an order, and when. */
export async function telegramNotifiedAt(orderId: string): Promise<Date | null> {
  return getTelegramNotifiedAt(orderId);
}
