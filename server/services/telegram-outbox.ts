// ── Telegram outbox: the durable retry sweep ────────────────────────────────
//
// WHAT THIS CLOSES. `services/order-notify.ts` retries a failed send a few times
// INSIDE the serverless invocation that observed the payment - deliberately
// short, because the shopper is waiting on that same request. That bounded
// window has a hole: a Telegram outage, or a rate limit, that outlasts it would
// drop a real sale's notification, and the owner would never hear about that
// order at all.
//
// So a send Telegram did NOT accept records a reminder in `telegram_outbox`
// (best-effort; a queue write must never be able to break the payment path), and
// THIS module - driven by the cron entry in vercel.json - picks those reminders
// up later and retries them.
//
// THREE PROPERTIES THAT MATTER, AND HOW EACH IS MET:
//
//   1. IT CANNOT NOTIFY TWICE. The sweep does not send anything itself: it
//      re-enters through `notifyPaidOrderOnce`, which re-wins the SAME atomic
//      claim on `orders.telegram_notified_at` that guards every other path. The
//      outbox row is only a "try again" marker, so even a duplicated or stale
//      reminder resolves to `already_notified` and sends nothing. This is the
//      reason the retry queue can safely be idempotent-by-upsert.
//
//   2. CONCURRENT SWEEPS CANNOT DOUBLE-WORK. Claiming a reminder is one
//      conditional UPDATE ... RETURNING that also pushes `next_attempt_at`
//      forward - a lease. A second sweep running at the same time finds nothing
//      due and does nothing.
//
//   3. IT GIVES UP, VISIBLY. Attempts are bounded (`OUTBOX_MAX_ATTEMPTS`). At the
//      budget the row becomes PERMANENTLY `failed` with `last_error` recorded, so
//      a hopeless misconfiguration stops consuming the sweep forever AND leaves
//      the owner a clear reason in the admin order view. A later explicit enqueue
//      (a human, or the daily reconciliation) reopens it with a fresh budget.
//
// NO SECRETS. Every error string that reaches this module came from
// `services/telegram.ts` already redacted, and nothing here logs a token, a chat
// id or a message body.
import { registerJob } from "../_core/jobs";
import {
  claimDueTelegramOutbox,
  markTelegramOutboxSent,
  recordTelegramOutboxFailure,
} from "../db";
import { notifyPaidOrderOnce } from "./order-notify";

/**
 * How many sweep attempts one reminder gets before it is marked permanently
 * failed. Five daily runs is a generous allowance for a transient outage, while
 * still bounding a genuinely broken configuration to a handful of noise-free
 * attempts instead of a perpetual daily failure.
 */
export const OUTBOX_MAX_ATTEMPTS = 5;

/** Reminders one sweep will work, so a backlog is drained steadily rather than
 *  in one unbounded burst that could exhaust a serverless invocation's budget. */
export const OUTBOX_SWEEP_BATCH = 25;

export interface OutboxSweepResult {
  /** Reminders claimed for this run. */
  claimed: number;
  /** Reminders whose retry actually delivered the notification. */
  sent: number;
  /** Reminders that failed but stay queued for another attempt. */
  retried: number;
  /** Reminders that exhausted their budget and are now permanently failed. */
  failed: number;
  /** Claimed rows that resolved to `already_notified` - the order had in fact
   *  been delivered by another path. Counted separately because it is the
   *  expected, healthy outcome of a duplicate reminder, not a failure. */
  already: number;
  /** Claimed rows that could not retry for a benign reason (unconfigured,
   *  unpaid, order gone). */
  skipped: number;
  /** Order numbers that delivered in this run, for the log line. */
  sentOrders: string[];
}

/**
 * Work the due reminders once. Never throws for a single reminder's failure: one
 * bad row must not stop the rest of the sweep.
 *
 * `deps` is the transport test seam, passed straight through to
 * `notifyPaidOrderOnce`.
 */
export async function runTelegramOutboxSweep(
  deps?: Parameters<typeof notifyPaidOrderOnce>[0]["deps"],
): Promise<OutboxSweepResult> {
  const due = await claimDueTelegramOutbox(OUTBOX_SWEEP_BATCH);
  const result: OutboxSweepResult = {
    claimed: due.length,
    sent: 0,
    retried: 0,
    failed: 0,
    already: 0,
    skipped: 0,
    sentOrders: [],
  };

  for (const row of due) {
    try {
      // Re-entry through the authoritative path: the paid gate, the
      // already-notified fast path and the atomic claim all apply again, so a
      // reminder can never produce a second notification.
      const outcome = await notifyPaidOrderOnce({
        orderId: row.orderId,
        trigger: "outbox",
        deps,
      });

      if (outcome.status === "sent") {
        await markTelegramOutboxSent(row.id);
        result.sent += 1;
        result.sentOrders.push(row.orderNumber);
        continue;
      }
      if (outcome.status === "already_notified") {
        // Another path delivered it. The reminder is spent, not failed.
        await markTelegramOutboxSent(row.id);
        result.already += 1;
        continue;
      }
      if (outcome.status === "not_delivered") {
        const { status } = await recordTelegramOutboxFailure(
          row.id,
          outcome.reason,
          OUTBOX_MAX_ATTEMPTS,
        );
        if (status === "failed") result.failed += 1;
        else result.retried += 1;
        continue;
      }

      // `skipped` (Telegram unconfigured), `not_paid` (the order was refunded or
      // re-classified since the reminder was raised) or `no_order` (deleted).
      // None of these is a send failure, so the reminder is not marked failed and
      // not counted as delivered - it stays queued and is re-judged next run.
      result.skipped += 1;
      if (outcome.status === "no_order") {
        // The order no longer exists; the FK cascade will have removed the row
        // anyway, but never leave a reminder pointing at nothing.
        await markTelegramOutboxSent(row.id);
      }
    } catch (e) {
      // Belt and braces: `notifyPaidOrderOnce` does not throw, but a sweep must
      // survive a surprise in the queue layer too.
      const reason = `Sweep error: ${(e as Error).message}`;
      const { status } = await recordTelegramOutboxFailure(
        row.id,
        reason,
        OUTBOX_MAX_ATTEMPTS,
      ).catch(() => ({ status: "pending" as const, attempts: 0 }));
      if (status === "failed") result.failed += 1;
      else result.retried += 1;
    }
  }

  return result;
}

/** The scheduled entry point. Reached via GET/POST /api/cron/telegram-outbox. */
registerJob("telegram-outbox", async () => {
  const result = await runTelegramOutboxSweep();
  // eslint-disable-next-line no-console
  console.log(
    `[telegram-outbox] claimed=${result.claimed} sent=${result.sent} ` +
      `retried=${result.retried} failed=${result.failed} ` +
      `already=${result.already} skipped=${result.skipped}` +
      (result.sentOrders.length ? ` delivered=${result.sentOrders.join(",")}` : ""),
  );
});

// ENQUEUEING lives in `db.ts` (`enqueueTelegramOutbox`), deliberately: the queue
// write must be reachable from `order-notify.ts` on the payment path WITHOUT
// this module importing back the other way. `telegram-outbox.ts` depends on
// `order-notify.ts` (above), so the reverse edge would be a circular import; the
// never-throw guarantee for the enqueue is therefore enforced inside db.ts,
// where both callers are covered by construction.
