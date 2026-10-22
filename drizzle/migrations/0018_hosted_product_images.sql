-- Move product media off the repo and onto the hosted base.
--
-- WHY THIS EXISTS. The store's product images used to be committed to the repo
-- under `client/public/images/products/*.webp` and referenced by a bare path
-- (`/images/products/pet-tent-bed-1.webp`). Those files are now deleted from the
-- repo and the bytes are served from the store's public media host (this repo's
-- GitHub Release assets). A database that was seeded BEFORE the move still holds
-- the old repo-relative paths in `products.images`, `products.media` and
-- `order_items.image_url`, so without this migration those rows would point at
-- files that no longer exist and every product image would 404.
--
-- WHAT IT DOES. Rewrites the leading `/images/products/` of every stored product
-- image URL to the hosted base, in all three places a product image is stored.
-- It is a pure string prefix swap, so it is idempotent: a row already carrying
-- the hosted URL does not match the WHERE clause and is left untouched, and a
-- re-run changes nothing.
--
-- SAFETY. Only the exact `/images/products/` prefix is rewritten - an admin's
-- own pasted `https://...` URL, an `/app-storage/...` upload, or any other path
-- is left exactly as it is. The base is the same constant the catalogue uses
-- (`PRODUCT_IMAGE_BASE` in shared/catalog-data.ts); keep the two in step.

-- products.images: a JSON array of image URLs.
UPDATE "products"
SET "images" = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN elem #>> '{}' LIKE '/images/products/%'
        THEN to_jsonb('https://github.com/lipon101/petparcel/releases/download/product-images-v1/' || substring(elem #>> '{}' from length('/images/products/') + 1))
      ELSE elem
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements("images") AS elem
)
WHERE "images"::text LIKE '%/images/products/%';

-- products.media: a JSON array of { url, kind } objects.
UPDATE "products"
SET "media" = (
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN elem ->> 'url' LIKE '/images/products/%'
        THEN jsonb_set(elem, '{url}', to_jsonb('https://github.com/lipon101/petparcel/releases/download/product-images-v1/' || substring(elem ->> 'url' from length('/images/products/') + 1)))
      ELSE elem
    END
  ), '[]'::jsonb)
  FROM jsonb_array_elements("media") AS elem
)
WHERE "media"::text LIKE '%/images/products/%';

-- order_items.image_url: a single text URL kept for the order history view.
UPDATE "order_items"
SET "image_url" = 'https://github.com/lipon101/petparcel/releases/download/product-images-v1/' || substring("image_url" from length('/images/products/') + 1)
WHERE "image_url" LIKE '/images/products/%';
