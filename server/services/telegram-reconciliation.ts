// ── Daily Telegram reconciliation ───────────────────────────────────────────
//
// WHAT THIS CATCHES. Every path that notifies the owner about a paid order is
// best-effort by design - the notification must never be able to block a sale.
// That is the right trade, but it means a notification can be missed: an order
// paid by a path that had a bug, an enqueue that failed, a token added to the
// environment AFTER a sale had already gone un-notified, or a reminder that was
// marked permanently `failed` before the owner fixed the configuration.
//
// THIS JOB IS THE BACKSTOP FOR EXACTLY THAT. Once a day it asks the source of
// truth - `orders` - for PAID orders that have never been notified
// (`telegram_notified_at IS NULL`), tells the owner they exist, and re-queues
// each one into the outbox so the sweep actually delivers them.
//
// WHY IT READS `orders` AND NOT THE OUTBOX. The failure it exists for is the one
// NOTHING else noticed. A queue can only hold reminders something remembered to
// write; deriving the list from `orders` finds the order nothing ever queued.
// The outbox is the delivery mechanism, not the ledger.
//
// TWO INDEPENDENT IDEMPOTENCY MECHANISMS, because the two halves differ:
//
//   * RE-QUEUEING is naturally idempotent - `enqueueTelegramOutbox` is an upsert
//     keyed on the order, so running it twice changes nothing and is always
//     safe. It runs unconditionally.
//   * THE SUMMARY MESSAGE is NOT idempotent - a second identical alert is noise
//     the owner learns to ignore. So it is guarded by `claimJobRun`, whose unique
//     (job, period) row admits exactly ONE run per UTC day. A losing run reports
//     that it lost and sends nothing.
//
// NO SECRETS. The summary carries order numbers and ages only - never a customer
// email, never a token. Every interpolated value is escaped for HTML parse mode,
// because an order number is shape-checked but never trusted.
import { registerJob } from "../_core/jobs";
import {
  claimJobRun,
  enqueueTelegramOutbox,
  listPaidOrdersMissingTelegramNotification,
  releaseJobRun,
} from "../db";
import { escapeHtml, isTelegramConfigured, sendTelegramMessage, TELEGRAM_SAFE_CHARS } from "./telegram";

/** The claim name for the once-per-day summary. */
export const RECONCILIATION_JOB = "telegram-reconciliation";

/** How many un-notified orders one run will re-queue. Bounded so a large backlog
 *  is drained steadily rather than in one unbounded burst. */
export const RECONCILIATION_BATCH = 100;

export interface ReconciliationResult {
  /** Paid orders that had never been notified when the run started. */
  missing: number;
  /** Orders whose reminder was (re)raised in the outbox this run. */
  requeued: number;
  /** Whether THIS run won the once-a-day claim and therefore sent the summary. */
  summarySent: boolean;
  /** True when another run had already claimed today's summary. */
  summarySkipped: boolean;
  /** Telegram is unconfigured: reminders were still raised, but no summary could
   *  be delivered. A normal pre-setup state, not an error. */
  telegramUnconfigured: boolean;
  /** Order numbers re-queued, for the log line. */
  orders: string[];
  error: string | null;
}

/** The UTC day bucket a run belongs to, e.g. "2026-10-16". */
export function reconciliationPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Build the owner's summary message. Exported for the escaping/length tests.
 *
 * Bounded: past the Telegram limit the transport would split the message, which
 * would cut the count away from the list. The list is truncated first, with the
 * remainder summarised, so one readable message always carries the total.
 */
export function buildReconciliationMessage(input: {
  orders: Array<{ orderNumber: string; ageHours: number }>;
  total: number;
}): string {
  const head = "🔔 <b>PetParcel — orders never notified via Telegram</b>";
  const intro = [
    `<b>${input.total}</b> paid order${input.total === 1 ? "" : "s"} ` +
      `${input.total === 1 ? "has" : "have"} no Telegram notification on record.`,
    "",
    "They have been queued for retry. If this repeats, check the bot token and",
    "that the bot is an admin of the channel.",
  ].join("\n");

  const fixed = head.length + intro.length + 64;
  const budget = Math.max(200, TELEGRAM_SAFE_CHARS - fixed);

  const lines: string[] = [];
  let used = 0;
  for (const o of input.orders) {
    const text =
      `• <b>${escapeHtml(o.orderNumber)}</b> — ${Math.max(0, Math.round(o.ageHours))}h ago`;
    if (used + text.length + 1 > budget && lines.length > 0) break;
    lines.push(text);
    used += text.length + 1;
  }

  const omitted = input.total - lines.length;
  const tail = omitted > 0 ? `\n…and ${omitted} more` : "";
  const body = lines.length > 0 ? lines.join("\n") + tail : "• (none listed)";
  return [head, "", intro, "", body].join("\n");
}

/**
 * Find paid-but-never-notified orders, report them, and re-queue them.
 *
 * NEVER THROWS: it runs from a cron entry with no caller to catch anything, so a
 * failure must be a returned value the log line can report, not an exception.
 */
export async function runTelegramReconciliation(
  deps?: Parameters<typeof sendTelegramMessage>[1],
  now: Date = new Date(),
): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    missing: 0,
    requeued: 0,
    summarySent: false,
    summarySkipped: false,
    telegramUnconfigured: false,
    orders: [],
    error: null,
  };

  try {
    const missing = await listPaidOrdersMissingTelegramNotification(RECONCILIATION_BATCH);
    result.missing = missing.length;
    if (missing.length === 0) return result;

    // ── 1. RE-QUEUE (idempotent, always safe) ──────────────────────────────
    // Done BEFORE the summary, deliberately. The summary is a convenience; the
    // re-queue is the actual repair. So even if the claim below is lost, or the
    // summary send fails, the refunded/forgotten orders are already back in the
    // queue and the next sweep will deliver them.
    for (const order of missing) {
      await enqueueTelegramOutbox({
        orderId: order.id,
        orderNumber: order.orderNumber,
        reason: "Re-queued by the daily reconciliation job.",
      });
      result.requeued += 1;
      result.orders.push(order.orderNumber);
    }

    // ── 2. SUMMARISE once per day ───────────────────────────────────────────
    if (!isTelegramConfigured()) {
      result.telegramUnconfigured = true;
      return result;
    }

    const period = reconciliationPeriod(now);
    const won = await claimJobRun(RECONCILIATION_JOB, period, {
      missing: result.missing,
      requeued: result.requeued,
    });
    if (!won) {
      result.summarySkipped = true;
      return result;
    }

    const nowMs = now.getTime();
    const body = buildReconciliationMessage({
      total: missing.length,
      orders: missing.slice(0, 50).map((o) => ({
        orderNumber: o.orderNumber,
        ageHours: (nowMs - new Date(o.createdAt).getTime()) / 3_600_000,
      })),
    });

    const send = await sendTelegramMessage(body, deps);
    if (send.status === "sent") {
      result.summarySent = true;
    } else {
      // The summary did not land. Give the claim back so a later run today can
      // still send it - the reminders are already queued, so nothing is lost by
      // retrying the summary.
      result.error = send.reason ?? "Telegram did not accept the summary.";
      await releaseJobRun(RECONCILIATION_JOB, period).catch(() => {});
    }
    return result;
  } catch (e) {
    result.error = (e as Error).message;
    return result;
  }
}

/** The scheduled entry point. Reached via GET/POST /api/cron/telegram-reconciliation. */
registerJob(RECONCILIATION_JOB, async () => {
  const result = await runTelegramReconciliation();
  // eslint-disable-next-line no-console
  console.log(
    `[telegram-reconciliation] missing=${result.missing} requeued=${result.requeued} ` +
      `summarySent=${result.summarySent} summarySkipped=${result.summarySkipped}` +
      (result.telegramUnconfigured ? " telegramUnconfigured=true" : "") +
      (result.orders.length ? ` orders=${result.orders.join(",")}` : "") +
      (result.error ? ` error=${result.error}` : ""),
  );
});
