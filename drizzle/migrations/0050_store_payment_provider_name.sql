-- Name the store's payment method correctly in its own settings.
--
-- WHY THIS EXISTS. Migration 0049 moved the store's payment rail from
-- NOWPayments to Bachs and rewrote `orders.payment_provider` to `bachs`. It
-- also tried to rewrite the store-level `payment_provider` SETTING - but it
-- only matched the old crypto name, and on this database that setting never
-- held the crypto name at all: it still held the platform template's own
-- default, "2checkout". So the setting kept a name for a payment method the
-- store has never used.
--
-- It is cosmetic - the storefront uses this setting only to PREFER a provider
-- and falls back to the only one there is - but it is the value an operator
-- sees on the Settings page, next to the label "Payment method (bachs)". A
-- setting that names a different gateway than the one the label promises is
-- a real confusion, so it is corrected here.
--
-- IDEMPOTENT: it only rewrites the value when it is not already "bachs".
UPDATE "store_settings"
   SET "value" = '"bachs"'::jsonb,
       "updated_at" = now()
 WHERE "key" = 'payment_provider'
   AND "value" <> '"bachs"'::jsonb;
