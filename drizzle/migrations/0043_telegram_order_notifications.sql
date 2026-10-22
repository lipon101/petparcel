-- Telegram order notifications: the one-shot claim column and the last error.
--
-- WHY THIS EXISTS. The owner wants a private Telegram ping for every PAID order
-- (see server/services/order-notify.ts). "Exactly one notification per order" is
-- the hard part: the alert is reachable from three verified payment paths (the
-- HMAC-checked NOWPayments IPN, the pull reconciliation, the post-return
-- confirmation), NOWPayments retries a webhook until it gets a 2xx, and two
-- serverless instances can handle the same payment concurrently. Enforcing that
-- needs a COLUMN to claim atomically - a single conditional UPDATE that exactly
-- one caller can win - exactly as `confirmation_email_sent_at` does for the paid
-- receipt (migration 0038) and `unpaid_alert_sent_at` for the unpaid alert
-- (0039).
--
-- `telegram_notify_error` is the diagnostic half. It holds why the LAST attempt
-- did not land, so the admin order view can say "the owner was not told, and
-- here is why" instead of silently believing the order was notified. It is
-- cleared as soon as an attempt succeeds. The string written here always comes
-- back from services/telegram.ts already redacted, so it can never carry the bot
-- token.
--
-- NULL `telegram_notified_at` means unclaimed; a timestamp means the owner has
-- been told. Both columns are nullable with no default, so this is a pure
-- additive change: existing orders read as "not yet notified", which is correct
-- (a back-fill would spam the owner with every historical order at once).
--
-- IDEMPOTENT. `IF NOT EXISTS` on both statements, so a re-run against a database
-- that already has them reports no change.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "telegram_notified_at" timestamp with time zone;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "telegram_notify_error" text;
