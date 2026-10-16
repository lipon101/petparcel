// Run the unpaid-order alert sweep by hand.
//
// The same sweep runs on a schedule in production (Vercel Cron →
// /api/cron/unpaid-order-alerts, see vercel.json). This script exists so an
// operator can run it on demand - to test the alert end to end, or to chase a
// backlog without waiting for the next cron tick.
//
// It is IDEMPOTENT by construction: the sweep claims each order atomically, so
// running it twice (or alongside the cron) sends each alert exactly once.
//
// Run:
//   pnpm check:unpaid-orders              # default 24h threshold
//   pnpm check:unpaid-orders --hours 48   # only orders older than 48h
//
// Requires DATABASE_URL and the mail env (RESEND_API_KEY, ADMIN_EMAIL) to
// actually deliver; without them the sweep reports the sends as failed and
// releases the claims, so nothing is lost.
import { runUnpaidOrderAlerts } from "../server/services/unpaid-alerts";
import { UNPAID_ALERT_AFTER_HOURS } from "../server/db";

function parseHours(argv: string[]): number {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--hours" || arg === "-h") {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n) && n > 0) return n;
    } else if (arg.startsWith("--hours=")) {
      const n = Number(arg.slice("--hours=".length));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return UNPAID_ALERT_AFTER_HOURS;
}

async function main(): Promise<void> {
  const hours = parseHours(process.argv.slice(2));
  console.log(`Checking for orders unpaid for more than ${hours}h...`);
  const result = await runUnpaidOrderAlerts(hours);
  console.log(
    `candidates=${result.candidates} sent=${result.sent} ` +
      `failed=${result.failed} skipped=${result.skipped}`,
  );
  if (result.alerted.length > 0) {
    console.log(`Alerted: ${result.alerted.join(", ")}`);
  }
  // A failed send is a real problem (mail misconfigured) - surface it in the
  // exit code so a CI/manual run notices rather than reading "0 sent" as "none
  // to send".
  process.exitCode = result.failed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error(`check-unpaid-orders failed: ${(e as Error).message}`);
  process.exitCode = 1;
});
