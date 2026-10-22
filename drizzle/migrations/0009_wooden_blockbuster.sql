-- DB-backed login/signup throttle. One row per scoped key
-- (`login_account:<email>`, `login_ip:<addr>`, `signup_ip:<addr>`), so a lockout
-- survives across serverless instances - the in-memory limiter in
-- `_core/rate-limit.ts` only sees the requests that land on the same warm
-- instance.
--
-- Written idempotently (IF NOT EXISTS / guarded constraint) on purpose: the
-- 0006/0007 snapshots were never committed, so a machine-generated diff can be
-- unreliable. This file only makes the one real change and is safe to run
-- whether or not the earlier migrations already landed.
CREATE TABLE IF NOT EXISTS "login_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" text NOT NULL,
        "count" integer DEFAULT 0 NOT NULL,
        "first_at" timestamp with time zone DEFAULT now() NOT NULL,
        "last_at" timestamp with time zone DEFAULT now() NOT NULL,
        "locked_until" timestamp with time zone
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "login_attempts"
    ADD CONSTRAINT "login_attempts_key_unique" UNIQUE ("key");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "login_attempts_locked_idx" ON "login_attempts" USING btree ("locked_until");
