-- Backfill the real CJ variant ids (VIDs) onto already-seeded variants.
--
-- WHY A DATA MIGRATION AND NOT JUST A SEEDER CHANGE. The seeder only ever
-- INSERTS a variant; it never rewrites an existing row's mapping. So a database
-- seeded before this feature would keep cj_vid NULL forever, and order
-- forwarding would refuse every order. This writes the mapping onto the rows
-- that already exist.
--
-- SOURCE OF TRUTH. Every VID below was recovered from the real CJ listing's own
-- productDetailData (stanProducts[].id) - the litter box (pid
-- 2504030718511602300), the tent bed (pid 1643077881498701824) and the carrier
-- (pid FF10D3C0-679C-4C38-8F48-8961E85AE312). None is invented. The same
-- mapping is carried in shared/catalog-data.ts so a fresh seed gets it too.
--
-- Idempotent: each UPDATE is guarded by `cj_vid IS NULL`, so a re-run reports
-- UPDATE 0 and never overwrites an admin's own correction.

-- Intelligent Litter Box (1 variant)
UPDATE "product_variants" SET "cj_vid" = '2504030718511602500', "cj_sku" = 'CJYD234462301AZ'
  WHERE "sku" = 'CJYD234462301AZ' AND "cj_vid" IS NULL;

-- Foldable Pet Tent Bed (6 variants)
UPDATE "product_variants" SET "cj_vid" = '1643077881620336640', "cj_sku" = 'CJMY172457401AZ' WHERE "sku" = 'CJMY172457401AZ' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1643077881779720192', "cj_sku" = 'CJMY172457402BY' WHERE "sku" = 'CJMY172457402BY' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1643077881871994880', "cj_sku" = 'CJMY172457403CX' WHERE "sku" = 'CJMY172457403CX' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1643077882060738560', "cj_sku" = 'CJMY172457404DW' WHERE "sku" = 'CJMY172457404DW' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1643077882119458816', "cj_sku" = 'CJMY172457405EV' WHERE "sku" = 'CJMY172457405EV' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1643077882182373376', "cj_sku" = 'CJMY172457406FU' WHERE "sku" = 'CJMY172457406FU' AND "cj_vid" IS NULL;

-- Pet Dog Carrier Bag (21 variants)
UPDATE "product_variants" SET "cj_vid" = '5C02D4A4-2501-46C8-AA21-3FEC24EDDFCE', "cj_sku" = 'CJJJCWGY02426-Black-S' WHERE "sku" = 'CJJJCWGY02426-Black-S' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1ED2C552-5674-4605-BC25-9535A344E114', "cj_sku" = 'CJJJCWGY02426-Black-M' WHERE "sku" = 'CJJJCWGY02426-Black-M' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '6B015962-C3C4-472B-83D8-B9521F18DACF', "cj_sku" = 'CJJJCWGY02426-Black-L' WHERE "sku" = 'CJJJCWGY02426-Black-L' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '80291B38-C353-4660-8D9A-76C122F0BAC2', "cj_sku" = 'CJJJCWGY02426-Black-XL' WHERE "sku" = 'CJJJCWGY02426-Black-XL' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '9407D5CF-2C29-42DF-83C9-C1CB5C0C47C2', "cj_sku" = 'CJJJCWGY02426-Red-S' WHERE "sku" = 'CJJJCWGY02426-Red-S' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1A252A48-E558-4131-A4E9-AFE980A9973F', "cj_sku" = 'CJJJCWGY02426-Red-M' WHERE "sku" = 'CJJJCWGY02426-Red-M' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = 'A71172B8-3DD8-4079-AFBA-41BC4471EAA9', "cj_sku" = 'CJJJCWGY02426-Red-L' WHERE "sku" = 'CJJJCWGY02426-Red-L' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = 'E68AD4AE-8CC0-41F0-8164-4A91705AFDAB', "cj_sku" = 'CJJJCWGY02426-Red-XL' WHERE "sku" = 'CJJJCWGY02426-Red-XL' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '64D5831C-DD6B-484F-A442-AC155435E098', "cj_sku" = 'CJJJCWGY02426-Blue-S' WHERE "sku" = 'CJJJCWGY02426-Blue-S' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '6D811D61-B2D4-47FA-91D4-945BD7A98250', "cj_sku" = 'CJJJCWGY02426-Blue-M' WHERE "sku" = 'CJJJCWGY02426-Blue-M' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '4AEA9285-795B-489A-89CF-52143651E1D7', "cj_sku" = 'CJJJCWGY02426-Blue-L' WHERE "sku" = 'CJJJCWGY02426-Blue-L' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = 'B7D44B6A-7799-40D7-81BB-F9D0471A2A3B', "cj_sku" = 'CJJJCWGY02426-Blue-XL' WHERE "sku" = 'CJJJCWGY02426-Blue-XL' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = 'B20ABB11-A05B-40A7-8EF4-D033256CA095', "cj_sku" = 'CJJJCWGY02426-Grey-S' WHERE "sku" = 'CJJJCWGY02426-Grey-S' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '49123A89-8386-4209-ACD7-278B1DCBBDF2', "cj_sku" = 'CJJJCWGY02426-Grey-M' WHERE "sku" = 'CJJJCWGY02426-Grey-M' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '76499A08-309A-4181-B8C0-39C1AD61C496', "cj_sku" = 'CJJJCWGY02426-Grey-L' WHERE "sku" = 'CJJJCWGY02426-Grey-L' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '2BFC744D-1C48-42C7-BC5B-B28E79EF5822', "cj_sku" = 'CJJJCWGY02426-Grey-XL' WHERE "sku" = 'CJJJCWGY02426-Grey-XL' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1605437143483166720', "cj_sku" = 'CJJJCWGY02426-Dark grey-M' WHERE "sku" = 'CJJJCWGY02426-Dark grey-M' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '2505271619051604000', "cj_sku" = 'CJJJCWGY02426-Dark grey-L' WHERE "sku" = 'CJJJCWGY02426-Dark grey-L' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1620319187908440064', "cj_sku" = 'CJJJCWGY02426-Dark grey-XL' WHERE "sku" = 'CJJJCWGY02426-Dark grey-XL' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '1651773089350426624', "cj_sku" = 'CJJJCWGY02426-Orange-L' WHERE "sku" = 'CJJJCWGY02426-Orange-L' AND "cj_vid" IS NULL;
UPDATE "product_variants" SET "cj_vid" = '2503260804221611700', "cj_sku" = 'CJJJCWGY02426-Orange-XL' WHERE "sku" = 'CJJJCWGY02426-Orange-XL' AND "cj_vid" IS NULL;
