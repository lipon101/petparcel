-- Move the free-shipping threshold to $99.00 on an existing database.
--
-- WHY THIS EXISTS. `store_settings` is seeded once and the sync only ever
-- INSERTs a MISSING key, so an existing row keeps its old value forever (an
-- admin's own edit is deliberately never clobbered). 0030 set $75.00 and has
-- already been applied, so editing it cannot move the row - Drizzle tracks
-- applied migrations by hash. This migration is the one that actually moves an
-- existing database to the new value; a fresh database gets $99.00 directly
-- from SETTINGS_DEFAULTS in shared/store.ts.
--
-- These are the SAME numbers carried in shared/store.ts SETTINGS_DEFAULTS, so a
-- fresh database and an existing one converge on an identical threshold.
--
-- IDEMPOTENT. Guarded on the value actually differing, so a re-run reports
-- UPDATE 0 and changes nothing.

UPDATE "store_settings"
  SET "value" = '9900'::jsonb
  WHERE "key" = 'free_shipping_threshold_cents'
    AND "value" IS DISTINCT FROM '9900'::jsonb;
