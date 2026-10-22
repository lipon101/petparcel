-- Move the free-shipping threshold to $59.00 on an existing database.
--
-- WHY THIS EXISTS. Migration 0027 set the threshold to $49.00 and has already
-- been applied, so editing it cannot move a row that is already there (Drizzle
-- tracks applied migrations by hash). This migration is the one that actually
-- moves an existing database to the new value; a fresh database gets $59.00
-- directly from SETTINGS_DEFAULTS and from 0027.
--
-- IDEMPOTENT. Guarded on the value actually differing, so a re-run reports
-- UPDATE 0 and changes nothing.

UPDATE "store_settings"
  SET "value" = '5900'::jsonb
  WHERE "key" = 'free_shipping_threshold_cents'
    AND "value" IS DISTINCT FROM '5900'::jsonb;
