-- Home page promo cards: admin-selected featured products.
--
-- The two home page promo cards ("Just landed" / "Most reordered") are now
-- admin-controlled and database-backed. The owner's pick for each card is stored
-- as a product id in the existing key/value `store_settings` table, so it is
-- editable from the admin panel and read on every request with no schema change.
--
-- An EMPTY STRING (the seeded default) means "no explicit pick" - the storefront
-- then falls back to the best available product (newest / most-ordered) so the
-- cards never render empty. The value is a product id, NOT a foreign key: a
-- deleted or unpublished product simply stops matching and the slot falls back,
-- which is the graceful behaviour we want (a hard FK would either block the
-- delete or null the setting, and neither is needed here).
--
-- Hand-written and idempotent: `drizzle/migrations/meta/` has no snapshot past
-- 0005, so a generated file would re-create columns that already exist. The
-- ON CONFLICT DO NOTHING means a re-run never clobbers a pick the owner made.
INSERT INTO "store_settings" ("key", "value")
VALUES
  ('promo_new_arrivals_product_id', '""'::jsonb),
  ('promo_best_sellers_product_id', '""'::jsonb)
ON CONFLICT ("key") DO NOTHING;
