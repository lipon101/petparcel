// Register the upstream supplier sync jobs with the platform job registry.
//
// Imported for its side effect from `_core/app.ts`, so the registration runs in
// BOTH entry points (the Node server and the Vercel function) - the platform
// fires a signed callback to POST /api/_jobs/{name} on schedule, and the handler
// runs in this app's own runtime (see _core/jobs.ts).
//
// The job bodies are thin wrappers: all the logic lives in cj-sync.ts, which is
// unit-tested with the CJ HTTP boundary mocked.
import { registerJob } from "../_core/jobs";
import { runStockSync, runTrackingSync } from "./cj-sync";
import { runVariantPriceSync } from "./cj-pricing";

registerJob("cj-tracking-sync", async () => {
  await runTrackingSync();
});

registerJob("cj-stock-sync", async () => {
  await runStockSync();
});

// Per-variant PRICE refresh, on the same daily schedule as stock and tracking.
// The storefront charges a price per variant and the supplier prices each
// variant itself, so a price refreshed only by hand drifts and the margin
// quietly disappears. Idempotent and fail-safe: a CJ outage logs and skips,
// keeping the last good price (see services/cj-pricing.ts).
registerJob("cj-price-sync", async () => {
  await runVariantPriceSync();
});
