-- Resend webhook events: the delivery lifecycle that happens AFTER Resend
-- accepts a send. `email_log` (0002) records the SEND attempt; this table
-- records what the provider then reported - delivered, bounced, complained,
-- opened, clicked - so the store can answer "did it actually arrive?".
--
-- `svix_id` is UNIQUE on purpose: Resend signs webhooks with Svix, which
-- RETRIES a delivery until it gets a 2xx, so the same event can arrive more
-- than once. A unique key makes the receiver idempotent (ON CONFLICT DO
-- NOTHING) instead of writing duplicate rows.
--
-- `provider_message_id` is the Resend message id (`data.email_id`), the same
-- value `email_log.provider_message_id` holds, so the two tables join.
--
-- Written idempotently (IF NOT EXISTS / guarded constraint) because the
-- 0006/0007 snapshots were never committed, so a machine-generated diff can be
-- unreliable. Safe to run whether or not earlier migrations already landed.
CREATE TABLE IF NOT EXISTS "email_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "svix_id" text NOT NULL,
        "type" text NOT NULL,
        "provider_message_id" text,
        "to_email" text,
        "from_email" text,
        "subject" text,
        "reason" text,
        "occurred_at" timestamp with time zone,
        "received_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "email_events" ADD CONSTRAINT "email_events_svix_id_unique" UNIQUE ("svix_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_message_idx" ON "email_events" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_type_idx" ON "email_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_events_received_idx" ON "email_events" USING btree ("received_at");
