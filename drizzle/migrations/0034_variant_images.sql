-- Real per-variant product photographs.
--
-- CJ returns a `variantImage` for every variant (the blue bowl, the pink bowl),
-- so a colour press can show the colour the shopper actually picked instead of
-- the product's first photo. The column is nullable: a variant with no
-- variant-specific shot falls back to the product's own images, never a
-- placeholder. Additive and idempotent.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "image_url" text;
