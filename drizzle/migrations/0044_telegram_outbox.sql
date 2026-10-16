-- Telegram outbox: a durable retry queue for order notifications.
--
-- WHY THIS EXISTS. `services/order-notify.ts` retries a failed send a few times
-- INSIDE the serverless invocation that observed the payment - because the
-- shopper is waiting on that same request, a notification that costs 20 seconds
-- to fail is worse than one that reports the failure immediately. But that
-- bounded window has a hole: a Telegram outage (or a rate limit) that outlasts
-- it would drop a real sale's notification, and the owner would never hear about
-- that order at all.
--
-- This table closes that hole. A send Telegram did NOT accept writes one row
-- here, and the sweep in `services/telegram-outbox.ts` (scheduled in vercel.json)
-- picks it up later and retries through the SAME `notifyPaidOrderOnce` entry
-- point - so the exactly-once guarantee built on
-- `orders.telegram_notified_at` is unchanged; this is only a "try again"
-- reminder.
--
--   status           'pending' | 'sent' | 'failed'. 'failed' is PERMANENT: the
--                    bounded attempt budget ran out. `last_error` records why.
--   attempts         sweep attempts made so far.
--   next_attempt_at  the earliest time the sweep may claim the row. The claim
--                    pushes it forward by the backoff, which doubles as the
--                    lease that stops two concurrent sweeps working one row.
--
-- ONE ROW PER ORDER (the unique index on order_id) makes the enqueue naturally
-- IDEMPOTENT: a retried webhook, an admin re-send and the daily reconciliation
-- job can each raise the same reminder without stacking attempt counts.
--
-- IDEMPOTENT DDL: `IF NOT EXISTS` on every statement, so a re-run converges.
CREATE TABLE IF NOT EXISTS "telegram_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "order_number" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_attempt_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One row per order: the enqueue's idempotency guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS "telegram_outbox_order_idx" ON "telegram_outbox" ("order_id");

-- The sweep's driving query: due rows in a given status, oldest first.
CREATE INDEX IF NOT EXISTS "telegram_outbox_due_idx" ON "telegram_outbox" ("status", "next_attempt_at");
