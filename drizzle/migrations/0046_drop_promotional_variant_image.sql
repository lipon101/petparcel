-- Stop advertising a variant photo that carries burned-in promotional text.
--
-- WHY THIS EXISTS. The Style 4 shots of the "Cute Fruit Dog Clothes" hoodie -
-- SKUs CJGD117239419SH (XS) and CJGD117239420TG (S) - are a 2x2 collage with
-- KOREAN PROMOTIONAL CAPTIONS burned into three of the four panels. Google
-- Merchant Center rejects an image carrying a promotional overlay ("Promotional
-- overlay on image"), so item CJGD117239420TG never approved: the feed carried
-- it, Merchant Center showed the item as "Not approved" with one missing or
-- invalid field, and the shopper never saw the product.
--
-- THE PICTURE IS THE SUPPLIER'S OWN PHOTOGRAPHY - downloaded from the supplier's
-- API and re-hosted on our own bucket (scripts/sync-variant-images.mjs). We do
-- not re-shoot it, and re-encoding the bytes cannot remove captions that are IN
-- the image. So the only honest fix is to STOP ADVERTISING IT.
--
-- NULL MEANS "NO VARIANT-SPECIFIC SHOT", which is the documented fallback for
-- this column (drizzle/schema.ts): the gallery falls back to the product's own
-- images, never a placeholder. The item then leads with the product's clean
-- hero shot - the same picture the storefront already shows for that option -
-- and its other clean shots stay in `additional_image_link`.
--
-- THE FEED BUILDER ENFORCES THE SAME RULE (shared/merchant-image-policy.ts), so
-- even if this picture is attached to a variant again by a later sync, it can
-- never reach Merchant Center.
--
-- IDEMPOTENT AND PRECISE. The UPDATE is guarded on the CURRENT url, so it
-- clears THIS picture only: a row that has since been given a different,
-- compliant photo is left alone, and a re-run changes nothing.
UPDATE "product_variants"
   SET "image_url" = NULL
 WHERE "sku" IN ('CJGD117239419SH', 'CJGD117239420TG')
   AND "image_url" = 'https://media.petparcel.store/products/variants/8943b5878400e342b3fb.webp';

-- Defensive: the same picture must not sit in a product's gallery either. The
-- catalogue never carried it and the live feed never advertised it as an
-- additional image, but the gallery is admin-editable, so a row that ever took
-- it is cleaned here. `images` is a jsonb array of urls, and the comparison is
-- made against the jsonb VALUE (not its text) so quoting cannot confuse it.
--
-- These two statements are OPTIONAL cleanups, so they are wrapped in a block
-- that cannot fail the deployment: the essential statement above has already
-- run, and a store must never be held back from shipping by a defensive tidy-up.
DO $$
BEGIN
  UPDATE "products"
     SET "images" = (
           SELECT COALESCE(jsonb_agg(el.value), '[]'::jsonb)
             FROM jsonb_array_elements("images") AS el(value)
            WHERE el.value <> to_jsonb('https://media.petparcel.store/products/variants/8943b5878400e342b3fb.webp'::text)
         )
   WHERE EXISTS (
           SELECT 1
             FROM jsonb_array_elements("images") AS el(value)
            WHERE el.value = to_jsonb('https://media.petparcel.store/products/variants/8943b5878400e342b3fb.webp'::text)
         );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '0046: gallery cleanup skipped: %', SQLERRM;
END $$;

-- And the same for the media gallery (images AND videos), which is the list the
-- product page actually renders.
DO $$
BEGIN
  UPDATE "products"
     SET "media" = (
           SELECT COALESCE(jsonb_agg(el.value), '[]'::jsonb)
             FROM jsonb_array_elements("media") AS el(value)
            WHERE COALESCE(el.value ->> 'url', '') <> 'https://media.petparcel.store/products/variants/8943b5878400e342b3fb.webp'
         )
   WHERE EXISTS (
           SELECT 1
             FROM jsonb_array_elements("media") AS el(value)
            WHERE el.value ->> 'url' = 'https://media.petparcel.store/products/variants/8943b5878400e342b3fb.webp'
         );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '0046: media cleanup skipped: %', SQLERRM;
END $$;
