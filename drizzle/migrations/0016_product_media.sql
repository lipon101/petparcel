-- Product media: images AND videos on one product.
--
-- `products.media` is a jsonb array of { url, kind } where kind is 'image' or
-- 'video'. `products.images` is KEPT as the image-only projection so every
-- consumer written before video existed (cart thumbnail, JSON-LD, OG image,
-- older catalog readers) keeps working unchanged. Back-fills each existing row
-- from its current images so no product loses its gallery.
--
-- Hand-written and idempotent: `drizzle/migrations/meta/` has no snapshot past
-- 0005, so a generated file would re-create columns that already exist.
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "media" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Back-fill: a product with images but no media yet gets those images as image
-- media. Guarded by a jsonb_array_length check so a re-run changes nothing and
-- a product that already carries media is never overwritten.
UPDATE "products"
SET "media" = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('url', value, 'kind', 'image') ORDER BY ordinality)
   FROM jsonb_array_elements_text("images") WITH ORDINALITY AS t(value, ordinality)),
  '[]'::jsonb
)
WHERE jsonb_typeof("images") = 'array'
  AND jsonb_array_length("images") > 0
  AND jsonb_array_length("media") = 0;
