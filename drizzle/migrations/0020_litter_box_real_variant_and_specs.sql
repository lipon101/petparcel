-- Correct the Intelligent Litter Box's stored variant name, description and
-- specs to the real, customer-facing values.
--
-- WHY THIS EXISTS. The litter box's single buyable variant was named after the
-- supplier's internal spec code - "V1 Litter Box UK · White" - which the product
-- page rendered verbatim as "OptionV1 Litter Box UK · White". That is a raw
-- supplier placeholder, not something a shopper should read. The catalogue
-- source (shared/catalog-data.ts) now names the variant by its real colour,
-- "White", and the specs (shared/product-specs.ts) now carry the supplier's own
-- measured figures instead of invented ones.
--
-- But the seeder only ever INSERTS a variant and only reconciles a variant's
-- NAME when it already exists; and it deliberately never overwrites a product's
-- description or specs beyond the catalog-managed fields. So a database seeded
-- before this fix still renders the placeholder name, the old description and
-- the invented specs. This migration corrects the stored rows.
--
-- WHAT IT DOES, all idempotent (a re-run changes nothing):
--   1. Renames the litter-box variant from the supplier placeholder to "White".
--   2. Replaces the product's specs with the supplier's real figures (PVC,
--      47 x 48 x 59 cm, 8.5 kg / 8.55 kg boxed) and drops the invented interior
--      capacity, entry width and filter-replacement interval.
--   3. Removes the unverifiable claims from the stored description (a "week" of
--      drawer capacity, a "3 to 18 lb" weight range, "smart sensors", a
--      "removable drum" and a "drawer-liner swap") that the supplier's listing
--      does not state.

-- 1. The variant name: supplier placeholder -> the real colour.
UPDATE "product_variants"
SET "name" = 'White'
WHERE "sku" = 'CJYD234462301AZ'
  AND "name" = 'V1 Litter Box UK · White';

-- 2. The specs: replace the invented figures with the supplier's real ones.
UPDATE "products"
SET "specs" = '{"materials":"PVC shell with a built-in deodorising unit","dimensions":"Approx. 18.5 x 18.9 x 23.2 in (47 x 48 x 59 cm)","weight":"18.7 lb (8.5 kg) unit; 18.9 lb (8.55 kg) boxed","care":"Wipe the shell and interior with a damp cloth; do not immerse the motor base. Empty and rinse the waste drawer regularly."}'::jsonb
WHERE "slug" = 'intelligent-litter-box-automatic-self-cleaning-deodorant'
  AND "specs"::text LIKE '%65 L interior%';

-- 3. The description: strip the claims the supplier does not make. Each replace
--    is guarded by the exact old sentence, so a row already corrected is left
--    alone.
UPDATE "products"
SET "description" = replace(
  replace(
    replace(
      replace(
        "description",
        'that stays out of sight for up to a week',
        'that stays out of sight'
      ),
      'suits cats from 3 to 18 lb and a low-entry step',
      'suits cats of all sizes and a low-entry step'
    ),
    'Smart sensors pause the cycle the moment your cat approaches, so cleaning only ever starts when the box is empty.',
    'The cycle only ever runs when the box is empty, so your cat is never disturbed mid-visit.'
  ),
  'The removable drum wipes clean in seconds and a single drawer-liner swap is the only upkeep you will think about.',
  'The interior wipes clean in seconds, so the only upkeep you will think about is emptying the drawer.'
)
WHERE "slug" = 'intelligent-litter-box-automatic-self-cleaning-deodorant'
  AND "description" LIKE '%up to a week%';
