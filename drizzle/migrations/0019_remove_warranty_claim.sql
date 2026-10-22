-- Remove the false "1-year limited warranty" claim from stored product copy.
--
-- WHY THIS EXISTS. The product descriptions used to end with the sentence
-- "Backed by a 1-year limited warranty with free, tracked shipping and a 30-day
-- returns window." The store cannot honour a 1-year warranty, so the claim has
-- been removed from the catalogue source (shared/catalog-data.ts). But the
-- seeder deliberately never overwrites a product's description - it is treated
-- as admin-owned copy - so a database seeded before the fix still renders the
-- false claim on every product page. This migration corrects the stored copy.
--
-- WHAT IT DOES. Replaces the exact false sentence with the honest one, in every
-- product description that still carries it. It is a pure string replacement, so
-- it is idempotent: a row already corrected does not match and is left alone,
-- and a re-run changes nothing. Only the exact sentence is touched - any other
-- admin copy around it is preserved byte for byte.

UPDATE "products"
SET "description" = replace(
  "description",
  'Backed by a 1-year limited warranty with free, tracked shipping and a 30-day returns window.',
  'Shipped fast and tracked, with a 30-day returns window.'
)
WHERE "description" LIKE '%1-year limited warranty%';
