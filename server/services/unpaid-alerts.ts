// Unpaid-order alert job.
//
// WHY THIS EXISTS. A crypto invoice can go unpaid: the shopper reaches the
// hosted checkout, gets distracted, and never sends the coins. Nothing in the
// store chased that - the order simply sat on "awaiting payment" forever, and
// the owner only found out by opening the panel. This job emails the owner when
// an order has been unpaid for more than the threshold (24h).
//
// EXACTLY ONCE, EVEN UNDER CONCURRENCY. The job can run concurrently (two
// serverless instances, or a manual run overlapping the cron), and an owner who
// gets the same nudge every hour will start ignoring it. So the send is guarded
// by an ATOMIC claim (`claimUnpaidOrderAlert`) - a single conditional UPDATE that
// exactly one run can win - not by an if-not-sent check two runs can both pass.
// The candidate list is only a hint; the claim is what decides.
//
// ONLY GENUINELY UNPAID. The claim's WHERE clause re-asserts the business rule
// at the moment of the write, so a run that raced a payment cannot alert on an
// order that has since been paid, refunded or cancelled.
import { registerJob } from "../_core/jobs";
import {
  claimUnpaidOrderAlert,
  listUnpaidOrdersForAlert,
  releaseUnpaidOrderAlert,
  UNPAID_ALERT_AFTER_HOURS,
} from "../db";
import { getSettings } from "../store-settings";
import { absoluteUrl, sendUnpaidOrderAlertEmail } from "./email";
import { STORE_URL } from "../../shared/store";

export interface UnpaidAlertRunResult {
  /** Orders that were old enough and unpaid when the run started. */
  candidates: number;
  /** Alerts actually sent (the runs that won the claim AND the provider took). */
  sent: number;
  /** Claims won but the mail provider did not accept - released for a retry. */
  failed: number;
  /** Candidates another concurrent run had already claimed. */
  skipped: number;
  /** Order numbers alerted in this run, for the log line. */
  alerted: string[];
}

/**
 * Find unpaid orders past the threshold and alert the owner, once each.
 *
 * Never throws for a single order's failure: one bad order must not stop the
 * rest of the sweep. A send the provider did NOT accept releases the claim, so
 * the next run retries it rather than losing the alert forever.
 */
export async function runUnpaidOrderAlerts(
  olderThanHours: number = UNPAID_ALERT_AFTER_HOURS,
): Promise<UnpaidAlertRunResult> {
  const candidates = await listUnpaidOrdersForAlert(olderThanHours);
  const result: UnpaidAlertRunResult = {
    candidates: candidates.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    alerted: [],
  };
  if (candidates.length === 0) return result;

  const settings = await getSettings();

  for (const order of candidates) {
    // The claim is the mutual-exclusion point: only the winner may send.
    const won = await claimUnpaidOrderAlert(order.id);
    if (!won) {
      result.skipped += 1;
      continue;
    }

    const orderUrl = absoluteUrl(STORE_URL, `/order/${encodeURIComponent(order.orderNumber)}`);
    const send = await sendUnpaidOrderAlertEmail(
      {
        id: order.id,
        orderNumber: order.orderNumber,
        email: order.email,
        customerName: order.shippingAddress?.fullName || "there",
        totalCents: order.totalCents,
        currency: order.currency,
        createdAt: order.createdAt,
        paymentStatus: order.paymentStatus,
        orderUrl,
      },
      settings,
    );

    if (send.status === "sent") {
      result.sent += 1;
      result.alerted.push(order.orderNumber);
    } else {
      // Not delivered - give the claim back so a later run can still alert.
      await releaseUnpaidOrderAlert(order.id);
      result.failed += 1;
    }
  }

  return result;
}

/** The scheduled entry point. Registered so Vercel Cron can reach it via
 *  POST/GET /api/cron/unpaid-order-alerts (see vercel.json). */
registerJob("unpaid-order-alerts", async () => {
  const result = await runUnpaidOrderAlerts();
  // eslint-disable-next-line no-console
  console.log(
    `[unpaid-order-alerts] candidates=${result.candidates} sent=${result.sent} ` +
      `failed=${result.failed} skipped=${result.skipped}` +
      (result.alerted.length ? ` alerted=${result.alerted.join(",")}` : ""),
  );
});
