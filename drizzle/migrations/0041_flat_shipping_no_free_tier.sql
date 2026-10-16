-- Remove the free-shipping tier so shipping is a flat $6.99 on every order.
--
-- WHY THIS EXISTS. `store_settings` is seeded once and the sync only ever
-- INSERTs a MISSING key, so an existing row keeps its old value forever (an
-- admin's own edit is deliberately never clobbered). 0031 set the threshold to
-- $99.00 and has already been applied, so editing it cannot move the row -
-- Drizzle tracks applied migrations by hash. This migration is the one that
-- actually clears the tier on an existing database; a fresh database gets 0
-- directly from SETTINGS_DEFAULTS in shared/store.ts.
--
-- WHY 0. The store's published policy is "flat $6.99 shipping and returns are
-- free". A live free-over-$99 tier contradicted that policy on the shipping &
-- returns page, on every product page and in the Merchant Center shipping
-- settings at the same time. `0` is the documented "no free tier" value (see
-- SETTINGS_DEFAULTS and productShippingLine), so the flat rate is what every
-- order is charged and every surface agrees.
--
-- These are the SAME numbers carried in shared/store.ts SETTINGS_DEFAULTS, so a
-- fresh database and an existing one converge on an identical model.
--
-- IDEMPOTENT. Guarded on the value actually differing, so a re-run reports
-- UPDATE 0 and changes nothing.

UPDATE "store_settings"
  SET "value" = '0'::jsonb
  WHERE "key" = 'free_shipping_threshold_cents'
    AND "value" IS DISTINCT FROM '0'::jsonb;

-- Pin the flat rate too, so a database that somehow drifted off $6.99 is brought
-- back in line with the published policy in the same migration.
UPDATE "store_settings"
  SET "value" = '699'::jsonb
  WHERE "key" = 'shipping_flat_cents'
    AND "value" IS DISTINCT FROM '699'::jsonb;
