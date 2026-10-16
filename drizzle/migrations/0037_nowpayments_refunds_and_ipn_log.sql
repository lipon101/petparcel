-- NOWPayments: refund lifecycle + the last IPN we received.
--
-- WHY THIS EXISTS. Two gaps in the first crypto pass:
--
--   1. A refund had nowhere to live. A crypto refund is a PAYOUT, not an
--      instant reversal - NOWPayments accepts it (`created`), then signs and
--      broadcasts it (`refunded`), or it fails. A boolean cannot express that,
--      and without a stored refund id a retried refund would issue a SECOND
--      payout. So the refund gets its own status, id, amount and timestamp.
--
--   2. The admin panel could not see what the provider last told us. When a
--      payment looks stuck, the single most useful fact is the last webhook
--      body and when it arrived - kept verbatim so an operator can read the
--      real status without re-querying NOWPayments.
--
--   payment_last_ipn         the last IPN body, verbatim (JSON).
--   payment_last_ipn_at      when it arrived.
--   payment_last_ipn_status  the raw status it carried, for a quick scan.
--   refund_status            created | refunded | failed (NULL = never refunded).
--   refund_ref               NOWPayments' refund id - the idempotency handle.
--   refund_amount            the refunded amount, in the payment currency.
--   refund_currency          the payment currency it was refunded in.
--   refunded_at              when the refund reached `refunded`.
--
-- All nullable: every existing order predates both features and simply has no
-- value, which is the normal state. No backfill, no default.
--
-- IDEMPOTENT: guarded with IF NOT EXISTS, so a re-run converges.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_last_ipn" jsonb;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_last_ipn_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_last_ipn_status" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_status" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_ref" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_amount" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refund_currency" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "refunded_at" timestamp with time zone;
