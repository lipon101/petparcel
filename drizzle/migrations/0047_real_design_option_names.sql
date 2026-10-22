-- The hoodie's real option values, and the order they are offered in.
--
-- WHY THIS EXISTS. The option values were the store's own generic labels -
-- "Style 1" through "Style 4" - which a shopper cannot act on: the page said
-- "Style 1" where the product actually comes in a red apple, a red heart, a
-- carrot and a white-and-green costume, and the buy box told them to choose
-- between numbered styles. A generic option value is a placeholder on the page,
-- and it is what the Merchant Center item title carried too.
--
-- THE VALUES ARE THE PRODUCT'S OWN DESIGNS, read off the photographs the store
-- already hosts for each option: the red apple (red hood, brown stem, green
-- leaf), the red heart (cream hood, red heart), the carrot (orange hood,
-- green leafy crown) and the white costume with the green leaves. The fourth
-- is named for what it certainly is - white with a green top - rather than for
-- an object that cannot be told apart from the photographs, because a name
-- that might be wrong is worse than one that is merely plain.
--
-- THE ORDER. The variants are now walked size by size, so the first options
-- name every design and the copy generator's option line stops advertising
-- one design only. The option AXES are unaffected: the size order is the
-- first appearance of each size, and the design order is the supplier's own.
-- `sort_order` is set to match, so the order a shopper sees is the order the
-- catalogue holds - and `pnpm seed` now writes it too, so a fresh database
-- agrees with production.
--
-- IDEMPOTENT. Every statement is guarded on the row actually differing, so a
-- re-run reports UPDATE 0.

-- cute-fruit-dog-hoodie-clothes
UPDATE "product_variants" SET "name" = $c$Red Apple · XS$c$ WHERE "sku" = $c$CJGD117239401AZ$c$ AND "name" IS DISTINCT FROM $c$Red Apple · XS$c$;
UPDATE "product_variants" SET "name" = $c$Red Heart · XS$c$ WHERE "sku" = $c$CJGD117239407GT$c$ AND "name" IS DISTINCT FROM $c$Red Heart · XS$c$;
UPDATE "product_variants" SET "name" = $c$Carrot · XS$c$ WHERE "sku" = $c$CJGD117239413MN$c$ AND "name" IS DISTINCT FROM $c$Carrot · XS$c$;
UPDATE "product_variants" SET "name" = $c$White & Green · XS$c$ WHERE "sku" = $c$CJGD117239419SH$c$ AND "name" IS DISTINCT FROM $c$White & Green · XS$c$;
UPDATE "product_variants" SET "name" = $c$Red Apple · S$c$ WHERE "sku" = $c$CJGD117239402BY$c$ AND "name" IS DISTINCT FROM $c$Red Apple · S$c$;
UPDATE "product_variants" SET "name" = $c$Red Heart · S$c$ WHERE "sku" = $c$CJGD117239408HS$c$ AND "name" IS DISTINCT FROM $c$Red Heart · S$c$;
UPDATE "product_variants" SET "name" = $c$Carrot · S$c$ WHERE "sku" = $c$CJGD117239414NM$c$ AND "name" IS DISTINCT FROM $c$Carrot · S$c$;
UPDATE "product_variants" SET "name" = $c$White & Green · S$c$ WHERE "sku" = $c$CJGD117239420TG$c$ AND "name" IS DISTINCT FROM $c$White & Green · S$c$;
UPDATE "product_variants" SET "name" = $c$Red Apple · M$c$ WHERE "sku" = $c$CJGD117239403CX$c$ AND "name" IS DISTINCT FROM $c$Red Apple · M$c$;
UPDATE "product_variants" SET "name" = $c$Red Heart · M$c$ WHERE "sku" = $c$CJGD117239409IR$c$ AND "name" IS DISTINCT FROM $c$Red Heart · M$c$;
UPDATE "product_variants" SET "name" = $c$Carrot · M$c$ WHERE "sku" = $c$CJGD117239415OL$c$ AND "name" IS DISTINCT FROM $c$Carrot · M$c$;
UPDATE "product_variants" SET "name" = $c$Red Apple · L$c$ WHERE "sku" = $c$CJGD117239404DW$c$ AND "name" IS DISTINCT FROM $c$Red Apple · L$c$;
UPDATE "product_variants" SET "name" = $c$Red Heart · L$c$ WHERE "sku" = $c$CJGD117239410JQ$c$ AND "name" IS DISTINCT FROM $c$Red Heart · L$c$;
UPDATE "product_variants" SET "name" = $c$Carrot · L$c$ WHERE "sku" = $c$CJGD117239416PK$c$ AND "name" IS DISTINCT FROM $c$Carrot · L$c$;
UPDATE "product_variants" SET "name" = $c$Red Apple · XL$c$ WHERE "sku" = $c$CJGD117239405EV$c$ AND "name" IS DISTINCT FROM $c$Red Apple · XL$c$;
UPDATE "product_variants" SET "name" = $c$Red Heart · XL$c$ WHERE "sku" = $c$CJGD117239411KP$c$ AND "name" IS DISTINCT FROM $c$Red Heart · XL$c$;
UPDATE "product_variants" SET "name" = $c$Carrot · XL$c$ WHERE "sku" = $c$CJGD117239417QJ$c$ AND "name" IS DISTINCT FROM $c$Carrot · XL$c$;
UPDATE "product_variants" SET "name" = $c$Red Apple · 2XL$c$ WHERE "sku" = $c$CJGD117239406FU$c$ AND "name" IS DISTINCT FROM $c$Red Apple · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Red Heart · 2XL$c$ WHERE "sku" = $c$CJGD117239412LO$c$ AND "name" IS DISTINCT FROM $c$Red Heart · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Carrot · 2XL$c$ WHERE "sku" = $c$CJGD117239418RI$c$ AND "name" IS DISTINCT FROM $c$Carrot · 2XL$c$;

UPDATE "product_variants" SET "sort_order" = 0 WHERE "sku" = $c$CJGD117239401AZ$c$ AND "sort_order" IS DISTINCT FROM 0;
UPDATE "product_variants" SET "sort_order" = 1 WHERE "sku" = $c$CJGD117239407GT$c$ AND "sort_order" IS DISTINCT FROM 1;
UPDATE "product_variants" SET "sort_order" = 2 WHERE "sku" = $c$CJGD117239413MN$c$ AND "sort_order" IS DISTINCT FROM 2;
UPDATE "product_variants" SET "sort_order" = 3 WHERE "sku" = $c$CJGD117239419SH$c$ AND "sort_order" IS DISTINCT FROM 3;
UPDATE "product_variants" SET "sort_order" = 4 WHERE "sku" = $c$CJGD117239402BY$c$ AND "sort_order" IS DISTINCT FROM 4;
UPDATE "product_variants" SET "sort_order" = 5 WHERE "sku" = $c$CJGD117239408HS$c$ AND "sort_order" IS DISTINCT FROM 5;
UPDATE "product_variants" SET "sort_order" = 6 WHERE "sku" = $c$CJGD117239414NM$c$ AND "sort_order" IS DISTINCT FROM 6;
UPDATE "product_variants" SET "sort_order" = 7 WHERE "sku" = $c$CJGD117239420TG$c$ AND "sort_order" IS DISTINCT FROM 7;
UPDATE "product_variants" SET "sort_order" = 8 WHERE "sku" = $c$CJGD117239403CX$c$ AND "sort_order" IS DISTINCT FROM 8;
UPDATE "product_variants" SET "sort_order" = 9 WHERE "sku" = $c$CJGD117239409IR$c$ AND "sort_order" IS DISTINCT FROM 9;
UPDATE "product_variants" SET "sort_order" = 10 WHERE "sku" = $c$CJGD117239415OL$c$ AND "sort_order" IS DISTINCT FROM 10;
UPDATE "product_variants" SET "sort_order" = 11 WHERE "sku" = $c$CJGD117239404DW$c$ AND "sort_order" IS DISTINCT FROM 11;
UPDATE "product_variants" SET "sort_order" = 12 WHERE "sku" = $c$CJGD117239410JQ$c$ AND "sort_order" IS DISTINCT FROM 12;
UPDATE "product_variants" SET "sort_order" = 13 WHERE "sku" = $c$CJGD117239416PK$c$ AND "sort_order" IS DISTINCT FROM 13;
UPDATE "product_variants" SET "sort_order" = 14 WHERE "sku" = $c$CJGD117239405EV$c$ AND "sort_order" IS DISTINCT FROM 14;
UPDATE "product_variants" SET "sort_order" = 15 WHERE "sku" = $c$CJGD117239411KP$c$ AND "sort_order" IS DISTINCT FROM 15;
UPDATE "product_variants" SET "sort_order" = 16 WHERE "sku" = $c$CJGD117239417QJ$c$ AND "sort_order" IS DISTINCT FROM 16;
UPDATE "product_variants" SET "sort_order" = 17 WHERE "sku" = $c$CJGD117239406FU$c$ AND "sort_order" IS DISTINCT FROM 17;
UPDATE "product_variants" SET "sort_order" = 18 WHERE "sku" = $c$CJGD117239412LO$c$ AND "sort_order" IS DISTINCT FROM 18;
UPDATE "product_variants" SET "sort_order" = 19 WHERE "sku" = $c$CJGD117239418RI$c$ AND "sort_order" IS DISTINCT FROM 19;

UPDATE "products" SET
  "description" = $c$Fruit design to make your puppy more cute, which will help reduce hair loss in the house, and avoid polluting the grass or other dust to walk your pet.

Built to last: made from cloth, and it weighs around 49.00 g.

Choose the option that suits your pet - Red Apple XS, Red Heart XS, Carrot XS, White & Green XS, Red Apple S, Red Heart S, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Breathable, lightweight, soft fabric, so that your dog in the cold autumn and winter feel more comfortable and warm.
- Suitable for walking, outdoor, sports, family, winter tours and parties, photos and daily wear for holidays.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cute-fruit-dog-hoodie-clothes$c$
    AND "description" IS DISTINCT FROM $c$Fruit design to make your puppy more cute, which will help reduce hair loss in the house, and avoid polluting the grass or other dust to walk your pet.

Built to last: made from cloth, and it weighs around 49.00 g.

Choose the option that suits your pet - Red Apple XS, Red Heart XS, Carrot XS, White & Green XS, Red Apple S, Red Heart S, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Breathable, lightweight, soft fabric, so that your dog in the cold autumn and winter feel more comfortable and warm.
- Suitable for walking, outdoor, sports, family, winter tours and parties, photos and daily wear for holidays.$c$;
