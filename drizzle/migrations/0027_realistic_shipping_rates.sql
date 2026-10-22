-- Realistic, consolidated US shipping rates (flat per order, never per item).
--
-- WHY THIS EXISTS. The store shipped with a $5.99 flat rate and NO free-shipping
-- tier, which is below the real postage a tracked US small parcel costs and reads
-- as an arbitrary charge to a shopper. This sets the standard small-parcel model:
--   * a single flat rate per ORDER (the store already charges shipping once per
--     order, so a multi-item cart is consolidated into one shipment rather than
--     billed postage on every line), and
--   * a free-shipping tier a realistic pet-supplies basket can actually reach.
--
-- WHY A MIGRATION. `store_settings` is seeded once (the sync only ever INSERTs a
-- missing key), so a database created before this revision keeps the old rates
-- forever - an admin's own edit is deliberately never clobbered. A migration is
-- the only thing that can move the values on an existing row.
--
-- IDEMPOTENT. Every statement is guarded on the value actually differing, so a
-- re-run reports UPDATE 0 and changes nothing.
--
-- These are the SAME numbers carried in shared/store.ts SETTINGS_DEFAULTS, so a
-- fresh database and an existing one converge on identical rates.

UPDATE "store_settings"
  SET "value" = '699'::jsonb
  WHERE "key" = 'shipping_flat_cents'
    AND "value" IS DISTINCT FROM '699'::jsonb;

UPDATE "store_settings"
  SET "value" = '5900'::jsonb
  WHERE "key" = 'free_shipping_threshold_cents'
    AND "value" IS DISTINCT FROM '5900'::jsonb;

UPDATE "store_settings"
  SET "value" = '"Tracked delivery, 5-9 business days after dispatch"'::jsonb
  WHERE "key" = 'shipping_estimate'
    AND "value" IS DISTINCT FROM '"Tracked delivery, 5-9 business days after dispatch"'::jsonb;
