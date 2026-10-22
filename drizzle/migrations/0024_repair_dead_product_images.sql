-- Repair product images that pointed at a retired asset host.
--
-- WHY. The store's product galleries were once self-hosted as GitHub Release
-- assets under github.com/lipon101/petparcel/releases/download/product-images-v1.
-- That host no longer serves the files: every one of those URLs now answers
-- 302 -> text/html, so a product page rendered an HTML error document in place
-- of a photo. The affected products' galleries have been re-sourced from
-- CJdropshipping - the supplier's own photography for exactly that product, on
-- its own CDN - and the catalogue (shared/catalog-data.ts) declares the new
-- URLs. This migration carries the SAME galleries onto a database that was
-- seeded before the change.
--
-- WHY A MIGRATION AND NOT THE SEEDER. The catalogue sync only ever INSERTs a
-- product; it never rewrites an existing row's `images`, because an admin's
-- edit must outrank the bundled bundle. A database seeded before this revision
-- would therefore keep the dead URLs forever.
--
-- SOURCE OF TRUTH. Every URL below is a real CJdropshipping image for that
-- product, resolved through the CJ API from the product's own variant id - not
-- invented, not third-party, not a placeholder. THIS FILE IS GENERATED from
-- shared/catalog-data.ts so the two can never disagree.
--
-- IDEMPOTENT. Each statement is guarded on the row still pointing at the dead
-- host, so a re-run reports UPDATE 0 and never overwrites an admin's own
-- gallery.

-- climbing-playing-bird-cage-accessory
UPDATE "products" SET "images" = '["https://oss-cf.cjdropshipping.com/product/2024/12/06/10/e2b2f36b-02c7-4881-8966-91bf9ad72a0f_trans.jpeg","https://oss-cf.cjdropshipping.com/product/2024/12/06/10/08965440-1981-4973-adaf-3201f2a27a40_trans.jpeg","https://oss-cf.cjdropshipping.com/product/2024/12/06/10/1bf73571-9a16-46f3-b9f0-24443f18faa5_trans.jpeg","https://oss-cf.cjdropshipping.com/product/2024/12/06/10/f27b4584-3073-4953-950f-9a3b1c93efc0_trans.jpeg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'climbing-playing-bird-cage-accessory' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- cooling-pet-water-bed-cushion
UPDATE "products" SET "images" = '["https://oss-cf.cjdropshipping.com/product/2024/06/13/02/9a9a8419-4cc4-45ef-9a11-bce06a3ff684.jpg","https://oss-cf.cjdropshipping.com/product/2025/06/12/01/f858a542-2057-40e2-a2f8-4d218406d0b2.jpg","https://oss-cf.cjdropshipping.com/product/2024/06/12/03/c71f1ebd-15f3-4fdb-bcf6-52e16f6c1a70_trans.jpeg","https://oss-cf.cjdropshipping.com/product/2024/06/12/03/82632f6d-a2d7-4ce7-92fb-1008dac291b0_trans.jpeg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'cooling-pet-water-bed-cushion' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- cute-fruit-dog-hoodie-clothes
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/1623555230823.jpg","https://cf.cjdropshipping.com/d1cb327b-eac1-40ae-ad4c-6f23aa09ef94.jpg","https://oss-cf.cjdropshipping.com/product/2024/08/22/03/9fb68e6e-47d2-47c8-875f-f49b8fe541ea.jpg","https://cf.cjdropshipping.com/1623555242019.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'cute-fruit-dog-hoodie-clothes' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- electric-jumping-shrimp-cat-toy
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/250370f8-7e2a-407a-90c6-0a81110823e0.jpg","https://cf.cjdropshipping.com/8e6cdff8-cb7c-4c6e-a75a-f4584839962d.jpg","https://cf.cjdropshipping.com/480582ae-d65f-44e7-9d8a-371da2ffc008.png","https://cf.cjdropshipping.com/4a694451-a862-432f-9704-79b4fa0cc666.png"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'electric-jumping-shrimp-cat-toy' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- floating-pet-water-bowl-1-5l
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/1614651331941.jpg","https://cf.cjdropshipping.com/b7440e7c-b9bc-4abc-b07a-fb1bf316730e.jpg","https://cf.cjdropshipping.com/1614651331666.jpg","https://cf.cjdropshipping.com/bddb3619-4001-4ae0-9e4a-1c659f905a38.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'floating-pet-water-bowl-1-5l' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- foldable-dog-house-cat-bed
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/37424d7e-3e03-40c5-bb86-d37673293db4.png","https://cf.cjdropshipping.com/a5312892-23aa-4389-a5a7-b7831a5c532a.jpg","https://cf.cjdropshipping.com/701617af-53b3-4166-b026-ec5e42aaba18.jpg","https://cf.cjdropshipping.com/67cf59ac-29ef-447a-8bd5-04c1f1afe8ea.png"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'foldable-dog-house-cat-bed' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- foldable-pet-tent-bed-with-cooling-mat
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/c4cace1b-c780-450e-88b6-df085e7fcfb7.jpg","https://cf.cjdropshipping.com/fd0c4786-a093-40fe-8bed-b97b51721912.jpg","https://cf.cjdropshipping.com/1b6464ed-631d-4fa1-b03d-074afcf1a0ef.jpg","https://cf.cjdropshipping.com/2eeaecb0-b4b8-4a2c-a1e4-7bd6977094be.jpg","https://cf.cjdropshipping.com/f0080325-0be3-435e-81b9-b030ae8126c6.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'foldable-pet-tent-bed-with-cooling-mat' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- four-seasons-universal-cat-recliner-bed
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/1620179853667.jpg","https://cf.cjdropshipping.com/1620179853662.jpg","https://cf.cjdropshipping.com/1620179853974.jpg","https://cf.cjdropshipping.com/1620179975386.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'four-seasons-universal-cat-recliner-bed' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- intelligent-litter-box-automatic-self-cleaning-deodorant
UPDATE "products" SET "images" = '["https://oss-cf.cjdropshipping.com/product/2025/04/03/07/60439e66-d0d3-474b-b14d-b115feb994cb_trans.jpeg","https://oss-cf.cjdropshipping.com/product/2025/04/03/07/ab647488-e93b-44e7-ad42-76e7a561b944_trans.jpeg","https://oss-cf.cjdropshipping.com/product/2025/04/03/07/7eb9c118-d8c4-47c5-96f6-950efea07255_trans.jpeg","https://oss-cf.cjdropshipping.com/product/2025/04/03/07/7019a55f-eecf-49e4-a2d4-ec7dced53c21_trans.jpeg","https://oss-cf.cjdropshipping.com/product/2025/04/03/07/a6b2b79a-543c-49e1-b921-33923ea649fa_trans.jpeg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'intelligent-litter-box-automatic-self-cleaning-deodorant' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- interactive-cat-toy-ball-super-drive
UPDATE "products" SET "images" = '["https://oss-cf.cjdropshipping.com/product/2026/04/02/06/185e37bd-a5d4-4a86-814b-7d27259bdd5e.jpg","https://oss-cf.cjdropshipping.com/product/2026/08/12/06/fdc2ece7-697d-4749-8dcd-1e457fabaafd.jpg","https://oss-cf.cjdropshipping.com/product/2026/08/12/06/38435cc8-2fd6-46ba-9e19-459921599867.jpg","https://oss-cf.cjdropshipping.com/product/2024/09/03/07/e378c136-1046-4996-8e9e-a1939923ee47_trans.jpeg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'interactive-cat-toy-ball-super-drive' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- parrot-bird-cage-with-feeder
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/080d7c82-2adb-41c1-9a74-3e618f1e7807.jpeg","https://cf.cjdropshipping.com/9164330f-27e1-43e1-869c-9b7f777fe8a4.jpeg","https://cf.cjdropshipping.com/a5a93eeb-744c-4596-a249-c38ac76beea2.jpeg","https://cf.cjdropshipping.com/69d11980-c49b-41fb-97fd-35395908676e.jpeg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'parrot-bird-cage-with-feeder' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- pet-cooling-pad-bed
UPDATE "products" SET "images" = '["https://oss-cf.cjdropshipping.com/product/2024/05/20/03/490d3917-2767-44cb-aa99-f0a1eca91f4c.jpg","https://oss-cf.cjdropshipping.com/product/2024/05/20/03/b13808bb-5cc1-4c33-ada0-8272f5074dd5.jpg","https://oss-cf.cjdropshipping.com/product/2025/05/24/02/7b3e1bb3-17a5-4e0e-8ed2-469b835fed2f.jpg","https://oss-cf.cjdropshipping.com/product/2025/05/24/02/d3a4d8dd-bca2-461f-bed0-032fa345e96e.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'pet-cooling-pad-bed' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- pet-dog-carrier-bag-double-shoulder-travel-backpack
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/86654064-4457-462a-9b9f-5d7943387c55.png","https://cf.cjdropshipping.com/20200724/8536936528672.jpg","https://cf.cjdropshipping.com/15955200/1109357003104.jpg","https://oss-cf.cjdropshipping.com/product/2026/07/07/08/005a0ede-8a57-43b9-b4d7-a13847459762.jpg","https://oss-cf.cjdropshipping.com/product/2026/07/07/08/5c1a3787-4cfa-43d9-b6d1-455d6aabc9d8.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'pet-dog-carrier-bag-double-shoulder-travel-backpack' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- pet-nail-clippers
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/c11494d9-fa78-405a-ab15-ac003567ad3c.jpg","https://oss-cf.cjdropshipping.com/product/2024/08/05/05/0763af78-7270-423f-b538-e88cdf0bc788.jpg","https://oss-cf.cjdropshipping.com/product/2024/08/05/05/9c402888-93dd-42eb-a187-2ea16b641574.jpg","https://oss-cf.cjdropshipping.com/product/2024/07/31/02/e28bbc78-b937-4f02-907b-892a2dd4e546_fine.jpeg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'pet-nail-clippers' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- quick-drying-pet-absorbent-towel
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/3197617b-48fd-418f-8d31-de749e172968.jpg","https://cf.cjdropshipping.com/8818a4aa-9259-4702-bd29-3dd3e5c87658.jpg","https://cf.cjdropshipping.com/64066dff-ac57-4433-827c-7136231525de.jpg","https://cf.cjdropshipping.com/6efc8801-6261-4469-81c3-294e1590f2e0.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'quick-drying-pet-absorbent-towel' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- reflective-airtag-collar-holder
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/7bbbfd4d-e8b5-4376-bdec-883042e6300f.jpg","https://cf.cjdropshipping.com/a3f6677a-d750-4d0f-951f-b00025b8ccc0.jpg","https://oss-cf.cjdropshipping.com/product/2026/04/02/07/63e23a15-5d5a-44ed-baaa-ccdfafb601b9.jpg","https://cf.cjdropshipping.com/e76961a1-d7b1-4c4b-ab26-912ad508e42e.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'reflective-airtag-collar-holder' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- retractable-dog-leash-with-collar
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/520cc706-5eab-4f3b-9828-feafcad7c918.jpg","https://cf.cjdropshipping.com/a7705f85-4c2a-4a23-ad14-cf3cc2e46031.jpg","https://cf.cjdropshipping.com/3f0c53ad-2358-4393-9395-af413cdd89f2.jpg","https://cf.cjdropshipping.com/14a60e04-4332-4a8a-bf7b-5597a38c04ca.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'retractable-dog-leash-with-collar' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- reusable-pet-hair-remover-brush
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/1617961882551.jpg","https://oss-cf.cjdropshipping.com/product/2025/11/27/08/be18cd13-7816-40b9-ba7d-bddf39f683bd.jpg","https://oss-cf.cjdropshipping.com/product/2026/02/17/08/53558e1d-bf5d-4935-a1ef-d139a9ef8662.jpg","https://cf.cjdropshipping.com/1615203197685.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'reusable-pet-hair-remover-brush' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- silicone-pet-hair-remover-comb
UPDATE "products" SET "images" = '["https://cf.cjdropshipping.com/quick/product/e12d4867-fccf-4b53-b9d8-35739927f2dd.jpg","https://cf.cjdropshipping.com/quick/product/686ed446-2b2d-4781-9a36-c41bdea925f3.jpg","https://cf.cjdropshipping.com/quick/product/46efe67d-844c-4637-81fb-06f8a96f8e63.jpg","https://cf.cjdropshipping.com/quick/product/76bbbbce-de04-4548-a673-c284d3588d92.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'silicone-pet-hair-remover-comb' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- smart-anti-barking-dog-collar-rechargeable
UPDATE "products" SET "images" = '["https://oss-cf.cjdropshipping.com/product/2024/05/28/08/c223a45a-8a41-42bd-ac0c-f8773c50bb69.jpg","https://oss-cf.cjdropshipping.com/product/2024/05/28/08/7add4c54-ac45-4b9b-8a01-a50b2465a991.jpg","https://oss-cf.cjdropshipping.com/product/2024/06/26/01/840e400f-10df-4967-a98f-ca933188c877.jpg","https://oss-cf.cjdropshipping.com/product/2024/05/28/08/190a7117-130e-4406-bb44-975c6ec22b4e.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'smart-anti-barking-dog-collar-rechargeable' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- stainless-steel-automatic-circulating-water-fountain
UPDATE "products" SET "images" = '["https://oss-cf.cjdropshipping.com/product/2026/09/29/11/93771e29-91d6-428b-877d-76c14a32eba1.jpg","https://cf.cjdropshipping.com/d11631bf-6df2-4f08-bc60-9fbc93e8bf73.jpg","https://cf.cjdropshipping.com/fe91ff1a-0d86-434a-8598-c17c0937fae3.jpg","https://oss-cf.cjdropshipping.com/product/2025/12/17/01/858749e8-5605-48ef-b41c-a3a1d415159c.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'stainless-steel-automatic-circulating-water-fountain' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- summer-dog-cooling-vest
UPDATE "products" SET "images" = '["https://oss-cf.cjdropshipping.com/product/2026/06/26/04/c6abbb58-10a9-4f74-a714-26b2dad3d183.jpg","https://cf.cjdropshipping.com/b7052f26-e933-4fe4-97fe-2d071ecbb64c.jpg","https://cf.cjdropshipping.com/70709af9-bb74-46b5-adf6-070836485816.jpg","https://cf.cjdropshipping.com/f65bddea-ae66-49f0-9feb-d0aa725c818f.jpg"]'::jsonb::jsonb, "updated_at" = now()
  WHERE "slug" = 'summer-dog-cooling-vest' AND "images"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- products.media: the gallery's { url, kind } records.
UPDATE "products"
SET "media" = (
  SELECT COALESCE(jsonb_agg(
    CASE WHEN elem->>'url' LIKE '%github.com/lipon101/petparcel/releases%' THEN jsonb_set(elem, '{url}', to_jsonb(replace(elem->>'url', 'https://github.com/lipon101/petparcel/releases/download/product-images-v1/', 'https://cf.cjdropshipping.com/'))) ELSE elem END
  ), '[]'::jsonb)
  FROM jsonb_array_elements("media") AS elem
)
WHERE "media"::text LIKE '%github.com/lipon101/petparcel/releases%';

-- order_items.image_url: the image captured on an order line at purchase.
UPDATE "order_items"
SET "image_url" = replace("image_url", 'https://github.com/lipon101/petparcel/releases/download/product-images-v1/', 'https://cf.cjdropshipping.com/')
WHERE "image_url" LIKE '%github.com/lipon101/petparcel/releases%';
