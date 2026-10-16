-- Rename the offensive / non-compliant harness product to a clean, Google
-- Merchant Center compliant title and slug.
--
-- WHY A MIGRATION AND NOT JUST THE CATALOG. The catalog seeder
-- (server/seed.ts -> seedCatalog) deliberately reconciles only a product's
-- CATEGORY and SPECS on an existing row: a product's name, slug, description,
-- price and images stay with the admin once the row exists, so a re-seed never
-- clobbers a real edit. That means editing shared/catalog-data.ts alone leaves
-- the LIVE row - and therefore the live product page and the Merchant Center
-- landing page Google crawls - still carrying both the word "Boobs" (which
-- triggered "Restricted adult content") and the over-long slug (which produced
-- the 50-character `item_group_id` truncation). This migration is the only path
-- that reaches the existing production row.
--
-- SOURCE OF TRUTH. This mirrors the new values in shared/catalog-data.ts so the
-- catalog and the database cannot disagree. The catalog is the source for a
-- FRESH database; this migration is the source for one seeded before the fix.
--
-- ORDERING. `pnpm build` runs `migrate:deploy` BEFORE `sync:catalog`
-- (package.json), so this rename lands before the seeder looks the product up by
-- its new slug. If the order were reversed the seeder would insert a SECOND row
-- under the new slug and leave the old one behind, which is why the build order
-- is not incidental.
--
-- IDEMPOTENT. Keyed on the exact OLD slug, so a re-run matches nothing and
-- reports UPDATE 0. On a fresh database the seeder writes the row under the new
-- slug directly and this statement is a no-op.
--
-- NOTE ON VARIANT NAMES. The options (Pink-S, Tan-XL, GrayCamo-M, ...) never
-- contained the offending word and are already reconciled from the catalog by
-- the seeder, so nothing else on this product needs touching.
UPDATE "products"
   SET "name" = $c$Tactical Service Dog Harness Vest, Adjustable Reflective Dog Harness with Metal Buckle for Hiking Training$c$,
       "slug" = $c$tactical-service-dog-harness-vest-adjustable$c$,
       "updated_at" = now()
 WHERE "slug" = $c$american-local-tactical-pet-boobs-service-dog-harness-vest-adjustable-reflecti$c$;
