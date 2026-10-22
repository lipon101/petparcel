-- CJdropshipping integration: variant VIDs, order-forwarding state, and a
-- durable idempotency ledger.
--
-- WHY THIS EXISTS. The store fulfils through CJdropshipping. To push a paid
-- order to CJ we need, for every line, the CJ VARIANT ID (VID) of the exact
-- option the customer bought - CJ's createOrderV2 takes a `vid` per line and
-- will not accept a guess. We also need a place to record the CJ order id we
-- get back, and - critically - a DURABLE guard so a payment webhook delivered
-- twice can never place two real supplier orders.
--
-- WHAT IT ADDS
--   1. product_variants.cj_vid / cj_sku - the CJ variant mapping, with a
--      PARTIAL unique index on cj_vid (WHERE cj_vid IS NOT NULL) so two store
--      variants can never point at the same CJ variant, while the many
--      unmapped rows (NULL) do not collide.
--   2. orders.cj_order_id / cj_forwarded_at - the CJ order id and when we
--      pushed it, for reconciliation and tracking polls.
--   3. cj_order_forwards - the idempotency ledger. `order_id` is the PRIMARY
--      KEY, so the INSERT that claims a forward is the atomic mutual-exclusion
--      point: exactly one caller can insert, every other gets a unique
--      violation. A boolean on `orders` could NOT do this - two concurrent
--      transactions would both read "not forwarded" before either wrote.
--
-- Idempotent: every statement is IF NOT EXISTS, so a re-run is a no-op.

ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "cj_vid" text;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "cj_sku" text;

CREATE UNIQUE INDEX IF NOT EXISTS "variants_cj_vid_idx"
  ON "product_variants" ("cj_vid") WHERE "cj_vid" IS NOT NULL;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cj_order_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cj_forwarded_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "cj_order_forwards" (
  "order_id" uuid PRIMARY KEY NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "cj_order_id" text,
  "request_payload" jsonb,
  "response_payload" jsonb,
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cj_order_forwards_status_idx" ON "cj_order_forwards" ("status");
