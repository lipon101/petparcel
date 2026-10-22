-- Job-run claims: "this scheduled job already ran for this period".
--
-- WHY THIS EXISTS. Some scheduled work is naturally idempotent. Re-queueing a
-- Telegram reminder is an UPSERT, so running it twice changes nothing. A SUMMARY
-- MESSAGE to the owner is not idempotent: if the cron fires twice in one day - a
-- manual run overlapping the schedule, or a retried invocation - the owner gets
-- the same alert twice and starts ignoring the channel.
--
-- A unique `(job, period)` row is the mutual-exclusion point. The run whose
-- INSERT succeeds is the one allowed to send; every other run's insert is
-- `ON CONFLICT DO NOTHING` and returns no row, which reads as a normal `false`
-- rather than an error.
--
--   job     the scheduled job's name, e.g. 'telegram-reconciliation'.
--   period  a caller-chosen bucket - the UTC day ('2026-10-16') for a daily job,
--           or any other string for another cadence. Making it a caller's choice
--           is what lets one small table serve every future scheduled job.
--   detail  optional JSON context from the winning run (counts, ids), for the
--           log line and the admin view. Never a secret.
--
-- IDEMPOTENT DDL: `IF NOT EXISTS`, so a re-run converges.
CREATE TABLE IF NOT EXISTS "job_run_claims" (
  "job" text NOT NULL,
  "period" text NOT NULL,
  "detail" jsonb,
  "claimed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "job_run_claims_job_period_pk" PRIMARY KEY ("job", "period")
);
