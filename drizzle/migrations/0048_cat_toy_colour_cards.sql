-- Give the cat toy's gallery a clean photograph to lead with.
--
-- WHY THIS EXISTS. The supplier's photographs for this product are "colour
-- cards": the product shot with a rounded colour label in the corner ("Red",
-- "Green", "Grey") and a decorative band around the edge. Both break Google's
-- image rules - the label is text over the picture, and the band is an element
-- that covers the product - so Merchant Center's automated check flagged one of
-- them ("Interactive Cat Toy Ball Super Drive Cat Rolling Ball - With Rope Style
-- Gray") as "Promotional overlay on image", and it flags the rest of the family
-- one per review cycle.
--
-- The picture INSIDE each card is honest, so the STOREFRONT keeps them: the
-- shopper still sees the design they picked. What cannot be advertised is the
-- card, so the feed does not advertise it (shared/merchant-image-policy.ts) and
-- the option falls back to the product's own gallery.
--
-- For that fallback to be a clean picture, the gallery needs one - so the same
-- product's own clean photograph (the "Bird call" variant shot) now leads the
-- gallery. It is a real picture of this product with no label and no frame, and
-- it makes the storefront's hero picture a plain product shot as well.
--
-- The supplier's own pictures stay in the gallery after it: they are perfectly
-- good additional images, where Google's check tolerates text.
--
-- IDEMPOTENT. The statement is guarded on the image not being there already.
UPDATE "products"
   SET "images" = '["https://media.petparcel.store/products/variants/843bb9f5ce060006e0d0.webp"]'::jsonb || "images",
       "updated_at" = now()
 WHERE "slug" = 'interactive-cat-toy-ball-super-drive'
   AND NOT ("images" @> '["https://media.petparcel.store/products/variants/843bb9f5ce060006e0d0.webp"]'::jsonb);
