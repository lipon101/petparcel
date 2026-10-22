-- Host product images on the store's own Cloudflare R2 bucket.
--
-- WHY. The storefront used to hotlink CJdropshipping's CDN for every gallery.
-- That works, but it means the store's own product photography lives on a
-- supplier's host - a slow or blocked third party becomes a broken product page,
-- and the store cannot control caching, sizing or format. Every image has now
-- been copied ONCE into the store's own R2 bucket, re-encoded to WebP, and the
-- catalogue (shared/catalog-data.ts) points at the store's own CDN
-- (R2_PUBLIC_BASE_URL, https://media.petparcel.store).
--
-- WHY A MIGRATION AND NOT THE SEEDER. The catalogue sync only ever INSERTs a
-- product; it never rewrites an existing row's images, because an admin's edit
-- must outrank the bundled data. A database seeded before this revision would
-- therefore keep the old supplier URLs forever.
--
-- SOURCE OF TRUTH. Every URL below is the R2 object the store uploaded for that
-- exact product's image - content-addressed from the supplier's own file, not
-- invented, not third-party, not a placeholder. THIS FILE IS GENERATED from
-- shared/catalog-data.ts so the two can never disagree.
--
-- IDEMPOTENT. Each statement is guarded on the row not already pointing at the
-- R2 host, so a re-run reports UPDATE 0 and never overwrites an admin's own
-- gallery.

-- intelligent-litter-box-automatic-self-cleaning-deodorant
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/8ff500cc46a333ba8780.webp","https://media.petparcel.store/products/3d3e619e9d3704a8b7d1.webp","https://media.petparcel.store/products/54ad336954cabab31d38.webp","https://media.petparcel.store/products/c98c5612a81d2365c835.webp","https://media.petparcel.store/products/61ab1d788eeaba07caf5.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/8ff500cc46a333ba8780.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3d3e619e9d3704a8b7d1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/54ad336954cabab31d38.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c98c5612a81d2365c835.webp","kind":"image"},{"url":"https://media.petparcel.store/products/61ab1d788eeaba07caf5.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'intelligent-litter-box-automatic-self-cleaning-deodorant'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- foldable-pet-tent-bed-with-cooling-mat
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/c9dc28fe713eca204cbf.webp","https://media.petparcel.store/products/826405bdc17a4272ce05.webp","https://media.petparcel.store/products/5d9985410fd80bdf8a88.webp","https://media.petparcel.store/products/dcffa8fd748fc35286c3.webp","https://media.petparcel.store/products/120e55599edd4ede7716.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/c9dc28fe713eca204cbf.webp","kind":"image"},{"url":"https://media.petparcel.store/products/826405bdc17a4272ce05.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5d9985410fd80bdf8a88.webp","kind":"image"},{"url":"https://media.petparcel.store/products/dcffa8fd748fc35286c3.webp","kind":"image"},{"url":"https://media.petparcel.store/products/120e55599edd4ede7716.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'foldable-pet-tent-bed-with-cooling-mat'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-dog-carrier-bag-double-shoulder-travel-backpack
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/a48caa9ed25bfdd59233.webp","https://media.petparcel.store/products/cd313f3d5b56c7a90fcd.webp","https://media.petparcel.store/products/fd51c6d4a2b1d6186e69.webp","https://media.petparcel.store/products/c3c8b9dd72cc0dccc63c.webp","https://media.petparcel.store/products/49b04c98a0465c7632e1.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/a48caa9ed25bfdd59233.webp","kind":"image"},{"url":"https://media.petparcel.store/products/cd313f3d5b56c7a90fcd.webp","kind":"image"},{"url":"https://media.petparcel.store/products/fd51c6d4a2b1d6186e69.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c3c8b9dd72cc0dccc63c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/49b04c98a0465c7632e1.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-dog-carrier-bag-double-shoulder-travel-backpack'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- smart-anti-barking-dog-collar-rechargeable
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/263e777261e1bcf29981.webp","https://media.petparcel.store/products/20c8a1cf33e7f8f98112.webp","https://media.petparcel.store/products/5afa695b426441120a93.webp","https://media.petparcel.store/products/c3418a00dd13d024bdf7.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/263e777261e1bcf29981.webp","kind":"image"},{"url":"https://media.petparcel.store/products/20c8a1cf33e7f8f98112.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5afa695b426441120a93.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c3418a00dd13d024bdf7.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'smart-anti-barking-dog-collar-rechargeable'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- four-seasons-universal-cat-recliner-bed
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/a53b0fd786d55ca3308f.webp","https://media.petparcel.store/products/f85f08565c85febdd2d1.webp","https://media.petparcel.store/products/1fbdac284d54a35b6e22.webp","https://media.petparcel.store/products/827730564bc2e56b8b45.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/a53b0fd786d55ca3308f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f85f08565c85febdd2d1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1fbdac284d54a35b6e22.webp","kind":"image"},{"url":"https://media.petparcel.store/products/827730564bc2e56b8b45.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'four-seasons-universal-cat-recliner-bed'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- stainless-steel-automatic-circulating-water-fountain
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/4b144104a9de69914ab4.webp","https://media.petparcel.store/products/c08c923673ae14e0db62.webp","https://media.petparcel.store/products/546edc898c9c0d0283e1.webp","https://media.petparcel.store/products/174a6d29741b011078f9.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/4b144104a9de69914ab4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c08c923673ae14e0db62.webp","kind":"image"},{"url":"https://media.petparcel.store/products/546edc898c9c0d0283e1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/174a6d29741b011078f9.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'stainless-steel-automatic-circulating-water-fountain'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- floating-pet-water-bowl-1-5l
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/dafb16577b82aa4ea14d.webp","https://media.petparcel.store/products/ee6ed1a5142db31c871e.webp","https://media.petparcel.store/products/6bb8e3e57a82fb58e95d.webp","https://media.petparcel.store/products/5d099a8e6316f9fa0aa4.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/dafb16577b82aa4ea14d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ee6ed1a5142db31c871e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/6bb8e3e57a82fb58e95d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5d099a8e6316f9fa0aa4.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'floating-pet-water-bowl-1-5l'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- reflective-airtag-collar-holder
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/52f5857dc8bbe5c5ef4f.webp","https://media.petparcel.store/products/0af49e97489ef683e028.webp","https://media.petparcel.store/products/5ef4d00d95803e18582e.webp","https://media.petparcel.store/products/c2d6641ad62235e97625.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/52f5857dc8bbe5c5ef4f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0af49e97489ef683e028.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5ef4d00d95803e18582e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c2d6641ad62235e97625.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'reflective-airtag-collar-holder'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- retractable-dog-leash-with-collar
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/b3e6a1e01ad44e1f82d1.webp","https://media.petparcel.store/products/8f000445783cb0aad313.webp","https://media.petparcel.store/products/b850b5afca9ecdf1e950.webp","https://media.petparcel.store/products/269eb1e08dc6c5218605.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/b3e6a1e01ad44e1f82d1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8f000445783cb0aad313.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b850b5afca9ecdf1e950.webp","kind":"image"},{"url":"https://media.petparcel.store/products/269eb1e08dc6c5218605.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'retractable-dog-leash-with-collar'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- summer-dog-cooling-vest
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/7d293b5ac280ca856364.webp","https://media.petparcel.store/products/2db5fdcc85c48afb6694.webp","https://media.petparcel.store/products/16c5acd045ed8dbd569b.webp","https://media.petparcel.store/products/209703971a8ca4c62552.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/7d293b5ac280ca856364.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2db5fdcc85c48afb6694.webp","kind":"image"},{"url":"https://media.petparcel.store/products/16c5acd045ed8dbd569b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/209703971a8ca4c62552.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'summer-dog-cooling-vest'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- interactive-cat-toy-ball-super-drive
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/35acc8a5aec106e0db01.webp","https://media.petparcel.store/products/fb61ea7436549d076366.webp","https://media.petparcel.store/products/ecae874d6e5a1218e2aa.webp","https://media.petparcel.store/products/4ac119cf560665d4a7de.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/35acc8a5aec106e0db01.webp","kind":"image"},{"url":"https://media.petparcel.store/products/fb61ea7436549d076366.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ecae874d6e5a1218e2aa.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4ac119cf560665d4a7de.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'interactive-cat-toy-ball-super-drive'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- cooling-pet-water-bed-cushion
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/02d38f075e9246d57921.webp","https://media.petparcel.store/products/93d4d167b1a4eca41664.webp","https://media.petparcel.store/products/df715a6f1a1e234898ec.webp","https://media.petparcel.store/products/b81f6dad978e62aa5b48.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/02d38f075e9246d57921.webp","kind":"image"},{"url":"https://media.petparcel.store/products/93d4d167b1a4eca41664.webp","kind":"image"},{"url":"https://media.petparcel.store/products/df715a6f1a1e234898ec.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b81f6dad978e62aa5b48.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'cooling-pet-water-bed-cushion'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- electric-jumping-shrimp-cat-toy
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/f1967c1432db5b03110f.webp","https://media.petparcel.store/products/223257b99af667badd23.webp","https://media.petparcel.store/products/e91597244a3ad66f4eca.webp","https://media.petparcel.store/products/46c67b8a1df75f85fb12.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/f1967c1432db5b03110f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/223257b99af667badd23.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e91597244a3ad66f4eca.webp","kind":"image"},{"url":"https://media.petparcel.store/products/46c67b8a1df75f85fb12.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'electric-jumping-shrimp-cat-toy'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- foldable-dog-house-cat-bed
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/9e16b9a4cb623f26578a.webp","https://media.petparcel.store/products/0f7e84b54927b596a7ea.webp","https://media.petparcel.store/products/25baa1fb704c16fa8081.webp","https://media.petparcel.store/products/11320e3b963567a76148.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/9e16b9a4cb623f26578a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0f7e84b54927b596a7ea.webp","kind":"image"},{"url":"https://media.petparcel.store/products/25baa1fb704c16fa8081.webp","kind":"image"},{"url":"https://media.petparcel.store/products/11320e3b963567a76148.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'foldable-dog-house-cat-bed'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-cooling-pad-bed
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/4eb72d72b020d2083bff.webp","https://media.petparcel.store/products/89453d7693b8d1d71f9f.webp","https://media.petparcel.store/products/4f0a4cba74414f15a7cc.webp","https://media.petparcel.store/products/f3ec0d55621f793c3894.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/4eb72d72b020d2083bff.webp","kind":"image"},{"url":"https://media.petparcel.store/products/89453d7693b8d1d71f9f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4f0a4cba74414f15a7cc.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f3ec0d55621f793c3894.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-cooling-pad-bed'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- cute-fruit-dog-hoodie-clothes
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/17990b2601548ecca52e.webp","https://media.petparcel.store/products/22ec4be8f4d843d4172c.webp","https://media.petparcel.store/products/992039abdb19dedcbd25.webp","https://media.petparcel.store/products/63d04b55e524e429ca60.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/17990b2601548ecca52e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/22ec4be8f4d843d4172c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/992039abdb19dedcbd25.webp","kind":"image"},{"url":"https://media.petparcel.store/products/63d04b55e524e429ca60.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'cute-fruit-dog-hoodie-clothes'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- parrot-bird-cage-with-feeder
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/a90e4bd49167b6134310.webp","https://media.petparcel.store/products/97c27f1200d077b8c971.webp","https://media.petparcel.store/products/440fea2c059161c02609.webp","https://media.petparcel.store/products/682f7f3d4a1a05b4f8c0.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/a90e4bd49167b6134310.webp","kind":"image"},{"url":"https://media.petparcel.store/products/97c27f1200d077b8c971.webp","kind":"image"},{"url":"https://media.petparcel.store/products/440fea2c059161c02609.webp","kind":"image"},{"url":"https://media.petparcel.store/products/682f7f3d4a1a05b4f8c0.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'parrot-bird-cage-with-feeder'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- climbing-playing-bird-cage-accessory
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/e0acc8bcf3e43734d6f5.webp","https://media.petparcel.store/products/50ee03ebd6177cb7e014.webp","https://media.petparcel.store/products/418f0f9ef0ec6304c147.webp","https://media.petparcel.store/products/3f4ceaa4ddf29e41d9cd.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/e0acc8bcf3e43734d6f5.webp","kind":"image"},{"url":"https://media.petparcel.store/products/50ee03ebd6177cb7e014.webp","kind":"image"},{"url":"https://media.petparcel.store/products/418f0f9ef0ec6304c147.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3f4ceaa4ddf29e41d9cd.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'climbing-playing-bird-cage-accessory'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- reusable-pet-hair-remover-brush
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/e5cfda2ea05fa9c9d127.webp","https://media.petparcel.store/products/2cf86274fff8e91aa161.webp","https://media.petparcel.store/products/71905281ec5b0fe8d94c.webp","https://media.petparcel.store/products/23c764cabc20f87c2ecb.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/e5cfda2ea05fa9c9d127.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2cf86274fff8e91aa161.webp","kind":"image"},{"url":"https://media.petparcel.store/products/71905281ec5b0fe8d94c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/23c764cabc20f87c2ecb.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'reusable-pet-hair-remover-brush'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- quick-drying-pet-absorbent-towel
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/69ffcdcd222d17eb5fb1.webp","https://media.petparcel.store/products/765596d7c7fc78ec9680.webp","https://media.petparcel.store/products/fe595f49321a36265c0f.webp","https://media.petparcel.store/products/8e15840bb64d4ddc0ae9.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/69ffcdcd222d17eb5fb1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/765596d7c7fc78ec9680.webp","kind":"image"},{"url":"https://media.petparcel.store/products/fe595f49321a36265c0f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8e15840bb64d4ddc0ae9.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'quick-drying-pet-absorbent-towel'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-nail-clippers
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/9fe3471b754f7c1fd58d.webp","https://media.petparcel.store/products/36424882c907f878c1e1.webp","https://media.petparcel.store/products/2feaa0917a0c6a02c6bf.webp","https://media.petparcel.store/products/2648050e46ab44ad82c6.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/9fe3471b754f7c1fd58d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/36424882c907f878c1e1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2feaa0917a0c6a02c6bf.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2648050e46ab44ad82c6.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-nail-clippers'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- silicone-pet-hair-remover-comb
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/18d2919cf27cf137f353.webp","https://media.petparcel.store/products/f2d0c436001f4bda054f.webp","https://media.petparcel.store/products/8cccaf06ddc658b57bee.webp","https://media.petparcel.store/products/0f3e16e2841966040bbf.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/18d2919cf27cf137f353.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f2d0c436001f4bda054f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8cccaf06ddc658b57bee.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0f3e16e2841966040bbf.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'silicone-pet-hair-remover-comb'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/697c27c590b239b08698.webp","https://media.petparcel.store/products/9251963e2dc0d377bba4.webp","https://media.petparcel.store/products/23a8eb7d1d510a05dd57.webp","https://media.petparcel.store/products/3369dac25545d2722e6e.webp","https://media.petparcel.store/products/4c762566606373f499b6.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/697c27c590b239b08698.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9251963e2dc0d377bba4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/23a8eb7d1d510a05dd57.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3369dac25545d2722e6e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4c762566606373f499b6.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/0228c62f5ba5e34746bf.webp","https://media.petparcel.store/products/dc1c1a001e255f0ad5b9.webp","https://media.petparcel.store/products/630822ce7d019583ba3d.webp","https://media.petparcel.store/products/73ddc0625cc64d000e5c.webp","https://media.petparcel.store/products/eb7cf406dd18981bc58f.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/0228c62f5ba5e34746bf.webp","kind":"image"},{"url":"https://media.petparcel.store/products/dc1c1a001e255f0ad5b9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/630822ce7d019583ba3d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/73ddc0625cc64d000e5c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/eb7cf406dd18981bc58f.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/e4748d849a12b078a708.webp","https://media.petparcel.store/products/31889a56aff5d01576be.webp","https://media.petparcel.store/products/45ad5af205492e07873c.webp","https://media.petparcel.store/products/0cf0bb428662ac46b778.webp","https://media.petparcel.store/products/a972fb84799939350f80.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/e4748d849a12b078a708.webp","kind":"image"},{"url":"https://media.petparcel.store/products/31889a56aff5d01576be.webp","kind":"image"},{"url":"https://media.petparcel.store/products/45ad5af205492e07873c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0cf0bb428662ac46b778.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a972fb84799939350f80.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- lavender-scented-disposable-pet-training-pads
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/89183ad131ca84f4534b.webp","https://media.petparcel.store/products/c7432a63aa133cf19029.webp","https://media.petparcel.store/products/23ff683722a8e35e99d6.webp","https://media.petparcel.store/products/87674074351f293c9014.webp","https://media.petparcel.store/products/a585d3ce69e0d77ea1f5.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/89183ad131ca84f4534b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c7432a63aa133cf19029.webp","kind":"image"},{"url":"https://media.petparcel.store/products/23ff683722a8e35e99d6.webp","kind":"image"},{"url":"https://media.petparcel.store/products/87674074351f293c9014.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a585d3ce69e0d77ea1f5.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'lavender-scented-disposable-pet-training-pads'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/6014dc84d4b31ceb6838.webp","https://media.petparcel.store/products/6e1b60da03a03eead7fe.webp","https://media.petparcel.store/products/9eb11122cf10a7293d10.webp","https://media.petparcel.store/products/22ac53b3743f66b22efa.webp","https://media.petparcel.store/products/4c6894db630d2a2fe520.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/6014dc84d4b31ceb6838.webp","kind":"image"},{"url":"https://media.petparcel.store/products/6e1b60da03a03eead7fe.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9eb11122cf10a7293d10.webp","kind":"image"},{"url":"https://media.petparcel.store/products/22ac53b3743f66b22efa.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4c6894db630d2a2fe520.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- traveler-bubble-backpack-pet-carriers-for-cats-and-dogs
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/f297ef278c39dd5a8aef.webp","https://media.petparcel.store/products/54d42d2a53dffcabbb11.webp","https://media.petparcel.store/products/8dd84094b65a257edad0.webp","https://media.petparcel.store/products/cb49df9fabfcbf9b9186.webp","https://media.petparcel.store/products/0e2e7f96979740439b19.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/f297ef278c39dd5a8aef.webp","kind":"image"},{"url":"https://media.petparcel.store/products/54d42d2a53dffcabbb11.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8dd84094b65a257edad0.webp","kind":"image"},{"url":"https://media.petparcel.store/products/cb49df9fabfcbf9b9186.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0e2e7f96979740439b19.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'traveler-bubble-backpack-pet-carriers-for-cats-and-dogs'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/112100784d4742bac5b8.webp","https://media.petparcel.store/products/04abcdbe05dfd082f5a6.webp","https://media.petparcel.store/products/5794451656373dbdcd2a.webp","https://media.petparcel.store/products/678527b08664e2c1cacb.webp","https://media.petparcel.store/products/945967d863b2979e9f19.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/112100784d4742bac5b8.webp","kind":"image"},{"url":"https://media.petparcel.store/products/04abcdbe05dfd082f5a6.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5794451656373dbdcd2a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/678527b08664e2c1cacb.webp","kind":"image"},{"url":"https://media.petparcel.store/products/945967d863b2979e9f19.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- car-pet-mat-pet-seat-center-protective-net
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/aae4e4ac1bdedc3c48b1.webp","https://media.petparcel.store/products/90e5ca339b88a93495ac.webp","https://media.petparcel.store/products/8a0070c6a88abb1cfaa6.webp","https://media.petparcel.store/products/2316be146e3ce3d02c47.webp","https://media.petparcel.store/products/96515a34920775ea9256.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/aae4e4ac1bdedc3c48b1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/90e5ca339b88a93495ac.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8a0070c6a88abb1cfaa6.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2316be146e3ce3d02c47.webp","kind":"image"},{"url":"https://media.petparcel.store/products/96515a34920775ea9256.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'car-pet-mat-pet-seat-center-protective-net'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/ec1ce72f37067aadc572.webp","https://media.petparcel.store/products/7057efbefcc96343ee1e.webp","https://media.petparcel.store/products/4112ec1a0d5710bbafd8.webp","https://media.petparcel.store/products/bbaf289869238ed40f0d.webp","https://media.petparcel.store/products/1d4413f6152a514c2012.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/ec1ce72f37067aadc572.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7057efbefcc96343ee1e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4112ec1a0d5710bbafd8.webp","kind":"image"},{"url":"https://media.petparcel.store/products/bbaf289869238ed40f0d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1d4413f6152a514c2012.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/84da021cd17d65d463a8.webp","https://media.petparcel.store/products/e5472f61cc5f0e8ef49d.webp","https://media.petparcel.store/products/63bc788e7ac3eb632f97.webp","https://media.petparcel.store/products/69ba4cd370021ccb3100.webp","https://media.petparcel.store/products/561153aea1e149e9f647.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/84da021cd17d65d463a8.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e5472f61cc5f0e8ef49d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/63bc788e7ac3eb632f97.webp","kind":"image"},{"url":"https://media.petparcel.store/products/69ba4cd370021ccb3100.webp","kind":"image"},{"url":"https://media.petparcel.store/products/561153aea1e149e9f647.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/533569abde530c28aff1.webp","https://media.petparcel.store/products/9215803f552c7bde1f86.webp","https://media.petparcel.store/products/77ccc784e251c685f82d.webp","https://media.petparcel.store/products/862879de7c00649b7e3d.webp","https://media.petparcel.store/products/2e6e9c35e6525c3ea4e3.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/533569abde530c28aff1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9215803f552c7bde1f86.webp","kind":"image"},{"url":"https://media.petparcel.store/products/77ccc784e251c685f82d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/862879de7c00649b7e3d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2e6e9c35e6525c3ea4e3.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/637567db454abe66055d.webp","https://media.petparcel.store/products/3a1e5d7cd431b3c9cd4a.webp","https://media.petparcel.store/products/9d15d7eb338397f2a059.webp","https://media.petparcel.store/products/19f942521a231ede8987.webp","https://media.petparcel.store/products/6deb6e3449cb621786b8.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/637567db454abe66055d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3a1e5d7cd431b3c9cd4a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9d15d7eb338397f2a059.webp","kind":"image"},{"url":"https://media.petparcel.store/products/19f942521a231ede8987.webp","kind":"image"},{"url":"https://media.petparcel.store/products/6deb6e3449cb621786b8.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/00fcbf1e77e7d5d10555.webp","https://media.petparcel.store/products/f87fca44a7fe678bee4b.webp","https://media.petparcel.store/products/870283b6f4c48ec00b7e.webp","https://media.petparcel.store/products/ee7e6db852a3036cc842.webp","https://media.petparcel.store/products/3b7fa86e654966360207.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/00fcbf1e77e7d5d10555.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f87fca44a7fe678bee4b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/870283b6f4c48ec00b7e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ee7e6db852a3036cc842.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3b7fa86e654966360207.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/d280fc68466913d92ff5.webp","https://media.petparcel.store/products/fa0fcb6d37ce69aa3d5d.webp","https://media.petparcel.store/products/d1cbc3535ca65c8a7e2a.webp","https://media.petparcel.store/products/c819518da9fddb9f24e0.webp","https://media.petparcel.store/products/5ffe7771639f1ef50153.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/d280fc68466913d92ff5.webp","kind":"image"},{"url":"https://media.petparcel.store/products/fa0fcb6d37ce69aa3d5d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d1cbc3535ca65c8a7e2a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c819518da9fddb9f24e0.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5ffe7771639f1ef50153.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 2-tier-cat-condo-with-hammock
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/50a0a6b51a648f88d6e9.webp","https://media.petparcel.store/products/6d276684b4d892d86622.webp","https://media.petparcel.store/products/a086d1f24b2603da2d57.webp","https://media.petparcel.store/products/a4cdaed83d2152afb517.webp","https://media.petparcel.store/products/f1fbcf984588f08aedac.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/50a0a6b51a648f88d6e9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/6d276684b4d892d86622.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a086d1f24b2603da2d57.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a4cdaed83d2152afb517.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f1fbcf984588f08aedac.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '2-tier-cat-condo-with-hammock'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/6812b66734d6990a9f0b.webp","https://media.petparcel.store/products/d50f4a7625caa7afc5b8.webp","https://media.petparcel.store/products/e5b299037abfb2bd63d4.webp","https://media.petparcel.store/products/abff9f098bc4d7586122.webp","https://media.petparcel.store/products/da059929e2465bf66a86.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/6812b66734d6990a9f0b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d50f4a7625caa7afc5b8.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e5b299037abfb2bd63d4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/abff9f098bc4d7586122.webp","kind":"image"},{"url":"https://media.petparcel.store/products/da059929e2465bf66a86.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/969f32f8c07945de5673.webp","https://media.petparcel.store/products/d8f658bbb7f39352cfea.webp","https://media.petparcel.store/products/7f41709d4d8c53f9f058.webp","https://media.petparcel.store/products/817485a2e735c99535bd.webp","https://media.petparcel.store/products/de3eebb872a40f4ea179.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/969f32f8c07945de5673.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d8f658bbb7f39352cfea.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7f41709d4d8c53f9f058.webp","kind":"image"},{"url":"https://media.petparcel.store/products/817485a2e735c99535bd.webp","kind":"image"},{"url":"https://media.petparcel.store/products/de3eebb872a40f4ea179.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/03bcd6ddafe7c4685461.webp","https://media.petparcel.store/products/7be197d0046a21ac8796.webp","https://media.petparcel.store/products/4c9bc06e75ac521e030f.webp","https://media.petparcel.store/products/585ec868f6fcb06f6f78.webp","https://media.petparcel.store/products/0f78a015d82db5968b48.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/03bcd6ddafe7c4685461.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7be197d0046a21ac8796.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4c9bc06e75ac521e030f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/585ec868f6fcb06f6f78.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0f78a015d82db5968b48.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- ceramic-pet-hamster-bowl-brown
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/5f984da4124d29e4b81a.webp","https://media.petparcel.store/products/db69f03c62f6856c8e80.webp","https://media.petparcel.store/products/dd9ebebbeb63f84afad0.webp","https://media.petparcel.store/products/15eb399e099920a0bc4d.webp","https://media.petparcel.store/products/73953a526ab888cea388.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/5f984da4124d29e4b81a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/db69f03c62f6856c8e80.webp","kind":"image"},{"url":"https://media.petparcel.store/products/dd9ebebbeb63f84afad0.webp","kind":"image"},{"url":"https://media.petparcel.store/products/15eb399e099920a0bc4d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/73953a526ab888cea388.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'ceramic-pet-hamster-bowl-brown'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/52abb3f30fe4cee828fd.webp","https://media.petparcel.store/products/1f55c3eef2264e6ce9b2.webp","https://media.petparcel.store/products/bade4cd033ca071a7598.webp","https://media.petparcel.store/products/2362bb379d7dae259e4a.webp","https://media.petparcel.store/products/81ef9de21db35c970af0.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/52abb3f30fe4cee828fd.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1f55c3eef2264e6ce9b2.webp","kind":"image"},{"url":"https://media.petparcel.store/products/bade4cd033ca071a7598.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2362bb379d7dae259e4a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/81ef9de21db35c970af0.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/f7259b82bc721015ee33.webp","https://media.petparcel.store/products/84f6e89c10a7aae9fb8b.webp","https://media.petparcel.store/products/911932c6c6016e9074cf.webp","https://media.petparcel.store/products/f4c4c85436197d6305ab.webp","https://media.petparcel.store/products/171e23949872434af977.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/f7259b82bc721015ee33.webp","kind":"image"},{"url":"https://media.petparcel.store/products/84f6e89c10a7aae9fb8b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/911932c6c6016e9074cf.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f4c4c85436197d6305ab.webp","kind":"image"},{"url":"https://media.petparcel.store/products/171e23949872434af977.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/b8209aa4a3e5318a4067.webp","https://media.petparcel.store/products/b8a34826562b88707451.webp","https://media.petparcel.store/products/7c3e8940ba3288852be2.webp","https://media.petparcel.store/products/d7642051e25b233bfd62.webp","https://media.petparcel.store/products/dcdb0d45184b170a2e39.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/b8209aa4a3e5318a4067.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b8a34826562b88707451.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7c3e8940ba3288852be2.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d7642051e25b233bfd62.webp","kind":"image"},{"url":"https://media.petparcel.store/products/dcdb0d45184b170a2e39.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/254291cffbc7279af19b.webp","https://media.petparcel.store/products/98795ed21fd26f03200f.webp","https://media.petparcel.store/products/1fd6e97b4af34f10a6d4.webp","https://media.petparcel.store/products/e01b1d4429181f1326a5.webp","https://media.petparcel.store/products/e107dd165fb11d0df202.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/254291cffbc7279af19b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/98795ed21fd26f03200f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1fd6e97b4af34f10a6d4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e01b1d4429181f1326a5.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e107dd165fb11d0df202.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/ea0bd19daf7f27524642.webp","https://media.petparcel.store/products/cb983c35cc6ba3f8925a.webp","https://media.petparcel.store/products/703e472260918488c2b3.webp","https://media.petparcel.store/products/96ce3a15138f3744576e.webp","https://media.petparcel.store/products/1e0a0f6faa34c858d92a.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/ea0bd19daf7f27524642.webp","kind":"image"},{"url":"https://media.petparcel.store/products/cb983c35cc6ba3f8925a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/703e472260918488c2b3.webp","kind":"image"},{"url":"https://media.petparcel.store/products/96ce3a15138f3744576e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1e0a0f6faa34c858d92a.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/71e162ac252060020a22.webp","https://media.petparcel.store/products/8a338dca06fd94325abe.webp","https://media.petparcel.store/products/2b69615fc9b52f8d63c4.webp","https://media.petparcel.store/products/c0914f94c5e2149c4121.webp","https://media.petparcel.store/products/8525f7a116f1cc0c0e0d.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/71e162ac252060020a22.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8a338dca06fd94325abe.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2b69615fc9b52f8d63c4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c0914f94c5e2149c4121.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8525f7a116f1cc0c0e0d.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/170586a0a98af9806e01.webp","https://media.petparcel.store/products/7385d3f629435f289b02.webp","https://media.petparcel.store/products/560d09de87c6bf3a8095.webp","https://media.petparcel.store/products/3503e13069a9e746a8b1.webp","https://media.petparcel.store/products/ce0ea1f68031e5e9172d.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/170586a0a98af9806e01.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7385d3f629435f289b02.webp","kind":"image"},{"url":"https://media.petparcel.store/products/560d09de87c6bf3a8095.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3503e13069a9e746a8b1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ce0ea1f68031e5e9172d.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/f95a8d97fd5c2f1acfd1.webp","https://media.petparcel.store/products/ff7852b848a9ce9db360.webp","https://media.petparcel.store/products/efc1412c15b30300dab3.webp","https://media.petparcel.store/products/0a93757797cf7c758584.webp","https://media.petparcel.store/products/98c13c6aec4fb3807fa2.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/f95a8d97fd5c2f1acfd1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ff7852b848a9ce9db360.webp","kind":"image"},{"url":"https://media.petparcel.store/products/efc1412c15b30300dab3.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0a93757797cf7c758584.webp","kind":"image"},{"url":"https://media.petparcel.store/products/98c13c6aec4fb3807fa2.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/193d5b57096d8f69e334.webp","https://media.petparcel.store/products/d7da1d75c8730f29bb11.webp","https://media.petparcel.store/products/10c3f59490b2136a9151.webp","https://media.petparcel.store/products/f56ed58478c8e942b6e0.webp","https://media.petparcel.store/products/b3cb3abed45977fdada9.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/193d5b57096d8f69e334.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d7da1d75c8730f29bb11.webp","kind":"image"},{"url":"https://media.petparcel.store/products/10c3f59490b2136a9151.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f56ed58478c8e942b6e0.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b3cb3abed45977fdada9.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/ed45b4482c1f4e1ecf64.webp","https://media.petparcel.store/products/b941f0a9be5f0f718613.webp","https://media.petparcel.store/products/1e59efc4a70648a4eb8b.webp","https://media.petparcel.store/products/d7f867bb5f31fdafc414.webp","https://media.petparcel.store/products/72b98a85f47cfe45be21.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/ed45b4482c1f4e1ecf64.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b941f0a9be5f0f718613.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1e59efc4a70648a4eb8b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d7f867bb5f31fdafc414.webp","kind":"image"},{"url":"https://media.petparcel.store/products/72b98a85f47cfe45be21.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/fd2e2cb4f2c474e1f799.webp","https://media.petparcel.store/products/6374ad0ace96137591fd.webp","https://media.petparcel.store/products/5d5ff699508d161ae205.webp","https://media.petparcel.store/products/5b7999eea75309a2a1dd.webp","https://media.petparcel.store/products/332d338414795ef43614.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/fd2e2cb4f2c474e1f799.webp","kind":"image"},{"url":"https://media.petparcel.store/products/6374ad0ace96137591fd.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5d5ff699508d161ae205.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5b7999eea75309a2a1dd.webp","kind":"image"},{"url":"https://media.petparcel.store/products/332d338414795ef43614.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-accessories-photo-concave-shape-pumpkin-hat
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/67b06431c4818d1de563.webp","https://media.petparcel.store/products/744ce932c99efa636b6f.webp","https://media.petparcel.store/products/fc8d88718218c57fa6e9.webp","https://media.petparcel.store/products/de20203d03b4cc48bd43.webp","https://media.petparcel.store/products/145925606be5e1784fd8.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/67b06431c4818d1de563.webp","kind":"image"},{"url":"https://media.petparcel.store/products/744ce932c99efa636b6f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/fc8d88718218c57fa6e9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/de20203d03b4cc48bd43.webp","kind":"image"},{"url":"https://media.petparcel.store/products/145925606be5e1784fd8.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-accessories-photo-concave-shape-pumpkin-hat'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/64f70a235e49aa7ab249.webp","https://media.petparcel.store/products/58917cfa67d2641e229d.webp","https://media.petparcel.store/products/a58eb471f65ab361689a.webp","https://media.petparcel.store/products/5de019be4a70293f5c97.webp","https://media.petparcel.store/products/0827ee809fb25856d3e6.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/64f70a235e49aa7ab249.webp","kind":"image"},{"url":"https://media.petparcel.store/products/58917cfa67d2641e229d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a58eb471f65ab361689a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5de019be4a70293f5c97.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0827ee809fb25856d3e6.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/acced887e3dbb2a76f3c.webp","https://media.petparcel.store/products/1f82c8b9d63295825166.webp","https://media.petparcel.store/products/e29048394811c57c4ee1.webp","https://media.petparcel.store/products/868966c8496e9daee0d3.webp","https://media.petparcel.store/products/e319cded24babb710e74.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/acced887e3dbb2a76f3c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1f82c8b9d63295825166.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e29048394811c57c4ee1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/868966c8496e9daee0d3.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e319cded24babb710e74.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/ca1ffc93ec11942bb15f.webp","https://media.petparcel.store/products/718c33a1fd8ea70945fe.webp","https://media.petparcel.store/products/bc8aa508fc45f10f436b.webp","https://media.petparcel.store/products/39cf891b6c19d750cd77.webp","https://media.petparcel.store/products/37f46760994e4cf40922.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/ca1ffc93ec11942bb15f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/718c33a1fd8ea70945fe.webp","kind":"image"},{"url":"https://media.petparcel.store/products/bc8aa508fc45f10f436b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/39cf891b6c19d750cd77.webp","kind":"image"},{"url":"https://media.petparcel.store/products/37f46760994e4cf40922.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- american-local-tactical-pet-boobs-service-dog-harness-vest-adjustable-reflecti
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/cc58b4c5b7f97bcc2d32.webp","https://media.petparcel.store/products/8979f60f154b14a4984f.webp","https://media.petparcel.store/products/03ffeeb9bc63ab3fc902.webp","https://media.petparcel.store/products/23da02fb5fea0e8c64c6.webp","https://media.petparcel.store/products/286af9c1d4be8b14d7a2.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/cc58b4c5b7f97bcc2d32.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8979f60f154b14a4984f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/03ffeeb9bc63ab3fc902.webp","kind":"image"},{"url":"https://media.petparcel.store/products/23da02fb5fea0e8c64c6.webp","kind":"image"},{"url":"https://media.petparcel.store/products/286af9c1d4be8b14d7a2.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'american-local-tactical-pet-boobs-service-dog-harness-vest-adjustable-reflecti'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-mouth-cover-golden-retrievergerman-shepherd-dedicated
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/39bd7b0bee482b6e4fe7.webp","https://media.petparcel.store/products/2691e6815f7585406213.webp","https://media.petparcel.store/products/b0fddbd7c559811727fe.webp","https://media.petparcel.store/products/94d0fd35496b110f98da.webp","https://media.petparcel.store/products/039fe0b4bcc9ca9a65c5.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/39bd7b0bee482b6e4fe7.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2691e6815f7585406213.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b0fddbd7c559811727fe.webp","kind":"image"},{"url":"https://media.petparcel.store/products/94d0fd35496b110f98da.webp","kind":"image"},{"url":"https://media.petparcel.store/products/039fe0b4bcc9ca9a65c5.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-mouth-cover-golden-retrievergerman-shepherd-dedicated'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/8999990ee21790d76be7.webp","https://media.petparcel.store/products/a798f8b5f653b8313be9.webp","https://media.petparcel.store/products/0ce6f450fe673d425265.webp","https://media.petparcel.store/products/12c243e56509ead0880c.webp","https://media.petparcel.store/products/c5d5e846ab5d020a5df0.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/8999990ee21790d76be7.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a798f8b5f653b8313be9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0ce6f450fe673d425265.webp","kind":"image"},{"url":"https://media.petparcel.store/products/12c243e56509ead0880c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c5d5e846ab5d020a5df0.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/fe15ce7f8fdcb8558a31.webp","https://media.petparcel.store/products/7cf00a4d72becce6444b.webp","https://media.petparcel.store/products/c10841f9b7cce09f6b86.webp","https://media.petparcel.store/products/b3368a3021e1758cc84e.webp","https://media.petparcel.store/products/b1ef9512b77229499a7c.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/fe15ce7f8fdcb8558a31.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7cf00a4d72becce6444b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c10841f9b7cce09f6b86.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b3368a3021e1758cc84e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b1ef9512b77229499a7c.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/98031d70c723d41452b7.webp","https://media.petparcel.store/products/74db501741fc970a6a54.webp","https://media.petparcel.store/products/bd55671c97260fc832f1.webp","https://media.petparcel.store/products/fd50bc60bba32f168f48.webp","https://media.petparcel.store/products/9138bb545fffffdb5ce1.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/98031d70c723d41452b7.webp","kind":"image"},{"url":"https://media.petparcel.store/products/74db501741fc970a6a54.webp","kind":"image"},{"url":"https://media.petparcel.store/products/bd55671c97260fc832f1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/fd50bc60bba32f168f48.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9138bb545fffffdb5ce1.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/bdbd5981d5ebc848e6a4.webp","https://media.petparcel.store/products/f5deed108b36ae889391.webp","https://media.petparcel.store/products/0c68800ae1b80b89d12f.webp","https://media.petparcel.store/products/b258060593689a1fea34.webp","https://media.petparcel.store/products/93b848c9e582c4a10b56.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/bdbd5981d5ebc848e6a4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f5deed108b36ae889391.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0c68800ae1b80b89d12f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b258060593689a1fea34.webp","kind":"image"},{"url":"https://media.petparcel.store/products/93b848c9e582c4a10b56.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/23e11d6a2584e033d527.webp","https://media.petparcel.store/products/c3ff85f9081b601fdda5.webp","https://media.petparcel.store/products/dd6ddfb54ff0239bce76.webp","https://media.petparcel.store/products/55890c312b7fcb6bcc44.webp","https://media.petparcel.store/products/08f51aaaad9b2c88cca9.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/23e11d6a2584e033d527.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c3ff85f9081b601fdda5.webp","kind":"image"},{"url":"https://media.petparcel.store/products/dd6ddfb54ff0239bce76.webp","kind":"image"},{"url":"https://media.petparcel.store/products/55890c312b7fcb6bcc44.webp","kind":"image"},{"url":"https://media.petparcel.store/products/08f51aaaad9b2c88cca9.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/3160a6a6cfd518397512.webp","https://media.petparcel.store/products/8ad5d925c85336da50f4.webp","https://media.petparcel.store/products/204c6f5874b9747d99e0.webp","https://media.petparcel.store/products/64e7bdca9f9c0698418d.webp","https://media.petparcel.store/products/861e1d955a5cbf92e569.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/3160a6a6cfd518397512.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8ad5d925c85336da50f4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/204c6f5874b9747d99e0.webp","kind":"image"},{"url":"https://media.petparcel.store/products/64e7bdca9f9c0698418d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/861e1d955a5cbf92e569.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/0f215b0654f84ba7928e.webp","https://media.petparcel.store/products/539938d8206afdb354e2.webp","https://media.petparcel.store/products/89e53aa363d45cc9b959.webp","https://media.petparcel.store/products/a5361dd4b186c698af9b.webp","https://media.petparcel.store/products/0233f5120509ff5a6727.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/0f215b0654f84ba7928e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/539938d8206afdb354e2.webp","kind":"image"},{"url":"https://media.petparcel.store/products/89e53aa363d45cc9b959.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a5361dd4b186c698af9b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0233f5120509ff5a6727.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- all-in-one-no-installation-cat-scratcher-tunnel-toy
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/71f20fc49cde628f5493.webp","https://media.petparcel.store/products/e5d3dc352919c71ac7e9.webp","https://media.petparcel.store/products/dcdc03f4ec6df9a9c27c.webp","https://media.petparcel.store/products/504bf2deeefe578e6c1d.webp","https://media.petparcel.store/products/000018ae7533aa4b109b.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/71f20fc49cde628f5493.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e5d3dc352919c71ac7e9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/dcdc03f4ec6df9a9c27c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/504bf2deeefe578e6c1d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/000018ae7533aa4b109b.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'all-in-one-no-installation-cat-scratcher-tunnel-toy'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/8fa1adebb81ff67e1c6d.webp","https://media.petparcel.store/products/8982fe7eaf8e56328257.webp","https://media.petparcel.store/products/0f98a2b6d1d6624b9404.webp","https://media.petparcel.store/products/e6ce59acb6d6043158d6.webp","https://media.petparcel.store/products/453ea6378b7e5a1d0cb2.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/8fa1adebb81ff67e1c6d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8982fe7eaf8e56328257.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0f98a2b6d1d6624b9404.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e6ce59acb6d6043158d6.webp","kind":"image"},{"url":"https://media.petparcel.store/products/453ea6378b7e5a1d0cb2.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/d36ab866fa41b3ac3a54.webp","https://media.petparcel.store/products/d578e7c58bfdbf88e15e.webp","https://media.petparcel.store/products/806d433a79b682b5212c.webp","https://media.petparcel.store/products/d26f295d1fe417ee72af.webp","https://media.petparcel.store/products/6f10be3081ac2aac9144.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/d36ab866fa41b3ac3a54.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d578e7c58bfdbf88e15e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/806d433a79b682b5212c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d26f295d1fe417ee72af.webp","kind":"image"},{"url":"https://media.petparcel.store/products/6f10be3081ac2aac9144.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/34484b83bb74ae6777d7.webp","https://media.petparcel.store/products/ca80b1b2258c2a584737.webp","https://media.petparcel.store/products/b242f523308b100ce548.webp","https://media.petparcel.store/products/21ee63209619ac4ec34f.webp","https://media.petparcel.store/products/0240c6d09edd22063491.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/34484b83bb74ae6777d7.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ca80b1b2258c2a584737.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b242f523308b100ce548.webp","kind":"image"},{"url":"https://media.petparcel.store/products/21ee63209619ac4ec34f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0240c6d09edd22063491.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/19c3202ea2d3ef5ff433.webp","https://media.petparcel.store/products/a83c96ffa776f5b035aa.webp","https://media.petparcel.store/products/a18c4f322b5b4bbc634a.webp","https://media.petparcel.store/products/beeacd5327a001a866ca.webp","https://media.petparcel.store/products/354c3cc9a2f67a9d5221.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/19c3202ea2d3ef5ff433.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a83c96ffa776f5b035aa.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a18c4f322b5b4bbc634a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/beeacd5327a001a866ca.webp","kind":"image"},{"url":"https://media.petparcel.store/products/354c3cc9a2f67a9d5221.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- round-long-hairy-autumn-and-winter-nest-pad-cat-mattress
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/60cafea7d6e117668ce1.webp","https://media.petparcel.store/products/1e9f171f83966e289867.webp","https://media.petparcel.store/products/160b40d91f90ef7f5108.webp","https://media.petparcel.store/products/9a2d5f77e603e769402b.webp","https://media.petparcel.store/products/4c3d44c998a297a26d11.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/60cafea7d6e117668ce1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1e9f171f83966e289867.webp","kind":"image"},{"url":"https://media.petparcel.store/products/160b40d91f90ef7f5108.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9a2d5f77e603e769402b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4c3d44c998a297a26d11.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'round-long-hairy-autumn-and-winter-nest-pad-cat-mattress'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/55fc3f7c42804d4ff6ac.webp","https://media.petparcel.store/products/f16509174d943e12165f.webp","https://media.petparcel.store/products/360c14fa723af00ce54c.webp","https://media.petparcel.store/products/68920125ece162d069fe.webp","https://media.petparcel.store/products/b64850d41de4a553b34e.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/55fc3f7c42804d4ff6ac.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f16509174d943e12165f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/360c14fa723af00ce54c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/68920125ece162d069fe.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b64850d41de4a553b34e.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/15677ef83cb22d7a5d22.webp","https://media.petparcel.store/products/a02a277084acb4456eb9.webp","https://media.petparcel.store/products/ac3a1ed86defc6688d13.webp","https://media.petparcel.store/products/48dcc46e1f8b5484bda4.webp","https://media.petparcel.store/products/9f5a668cb43075a8c5af.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/15677ef83cb22d7a5d22.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a02a277084acb4456eb9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ac3a1ed86defc6688d13.webp","kind":"image"},{"url":"https://media.petparcel.store/products/48dcc46e1f8b5484bda4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9f5a668cb43075a8c5af.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-clothes-round-neck-t-shirt
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/9fa3c24e86a781a7ad4d.webp","https://media.petparcel.store/products/20132af0188f8960e23c.webp","https://media.petparcel.store/products/e406bdab4f9a45c1be27.webp","https://media.petparcel.store/products/05c9a881f9f30a126c9c.webp","https://media.petparcel.store/products/0958c2a7d77deaf571dd.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/9fa3c24e86a781a7ad4d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/20132af0188f8960e23c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e406bdab4f9a45c1be27.webp","kind":"image"},{"url":"https://media.petparcel.store/products/05c9a881f9f30a126c9c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0958c2a7d77deaf571dd.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-clothes-round-neck-t-shirt'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-dresses-for-outdoor-walks-with-a-leash
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/47d27f4c439ae214c42f.webp","https://media.petparcel.store/products/f9e9857539677bb20897.webp","https://media.petparcel.store/products/178fb038671719d15880.webp","https://media.petparcel.store/products/a9ca4ebadf3c8cc3e544.webp","https://media.petparcel.store/products/12d31530e4ea6cf6f5ea.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/47d27f4c439ae214c42f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f9e9857539677bb20897.webp","kind":"image"},{"url":"https://media.petparcel.store/products/178fb038671719d15880.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a9ca4ebadf3c8cc3e544.webp","kind":"image"},{"url":"https://media.petparcel.store/products/12d31530e4ea6cf6f5ea.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-dresses-for-outdoor-walks-with-a-leash'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-clothes-round-neck-t-shirt-pet-tops
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/9fa3c24e86a781a7ad4d.webp","https://media.petparcel.store/products/20132af0188f8960e23c.webp","https://media.petparcel.store/products/e406bdab4f9a45c1be27.webp","https://media.petparcel.store/products/05c9a881f9f30a126c9c.webp","https://media.petparcel.store/products/0958c2a7d77deaf571dd.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/9fa3c24e86a781a7ad4d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/20132af0188f8960e23c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e406bdab4f9a45c1be27.webp","kind":"image"},{"url":"https://media.petparcel.store/products/05c9a881f9f30a126c9c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0958c2a7d77deaf571dd.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-clothes-round-neck-t-shirt-pet-tops'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-dog-color-block-cardigan-sweater
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/12c44684de8b9a9cbd57.webp","https://media.petparcel.store/products/945a788cecff6f539fe4.webp","https://media.petparcel.store/products/43e737d44e6c7d2a8ae0.webp","https://media.petparcel.store/products/da5592ab03f0104a5921.webp","https://media.petparcel.store/products/b31484011c7a1a795048.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/12c44684de8b9a9cbd57.webp","kind":"image"},{"url":"https://media.petparcel.store/products/945a788cecff6f539fe4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/43e737d44e6c7d2a8ae0.webp","kind":"image"},{"url":"https://media.petparcel.store/products/da5592ab03f0104a5921.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b31484011c7a1a795048.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-dog-color-block-cardigan-sweater'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- large-dog-border-collie-pet-sweater
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/e430649d0c3db489afa8.webp","https://media.petparcel.store/products/d3674ce7364027908b65.webp","https://media.petparcel.store/products/c67d7f6b2eb074125ec9.webp","https://media.petparcel.store/products/e5db7b9770e4bd75bab7.webp","https://media.petparcel.store/products/62feb1837bafb3538986.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/e430649d0c3db489afa8.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d3674ce7364027908b65.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c67d7f6b2eb074125ec9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e5db7b9770e4bd75bab7.webp","kind":"image"},{"url":"https://media.petparcel.store/products/62feb1837bafb3538986.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'large-dog-border-collie-pet-sweater'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-clothes-dog-anxiety-jacket-warm-vest
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/8f0849dee0275fa91c04.webp","https://media.petparcel.store/products/82b81fd346595df4c347.webp","https://media.petparcel.store/products/1633c0641ed6a9710dff.webp","https://media.petparcel.store/products/88ec64e6f4684b9be9b8.webp","https://media.petparcel.store/products/7012eb9f09caa52fa992.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/8f0849dee0275fa91c04.webp","kind":"image"},{"url":"https://media.petparcel.store/products/82b81fd346595df4c347.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1633c0641ed6a9710dff.webp","kind":"image"},{"url":"https://media.petparcel.store/products/88ec64e6f4684b9be9b8.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7012eb9f09caa52fa992.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-clothes-dog-anxiety-jacket-warm-vest'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- dog-four-seasons-breathable-soft-bottom-jumpsuit
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/16fa3985b4f9b330145f.webp","https://media.petparcel.store/products/55c7afa1d4b524998a0d.webp","https://media.petparcel.store/products/aabf8ad158bfd1c57f32.webp","https://media.petparcel.store/products/5ab7a8cddf14a84593be.webp","https://media.petparcel.store/products/0ccbabd45cd6903df805.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/16fa3985b4f9b330145f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/55c7afa1d4b524998a0d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/aabf8ad158bfd1c57f32.webp","kind":"image"},{"url":"https://media.petparcel.store/products/5ab7a8cddf14a84593be.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0ccbabd45cd6903df805.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'dog-four-seasons-breathable-soft-bottom-jumpsuit'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/1ba878e0bb7ba77638bd.webp","https://media.petparcel.store/products/6d50f085bd495d7e7c67.webp","https://media.petparcel.store/products/202131f516c8ca14a5df.webp","https://media.petparcel.store/products/ae55804def297cec51a6.webp","https://media.petparcel.store/products/693520c7b589911c87d3.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/1ba878e0bb7ba77638bd.webp","kind":"image"},{"url":"https://media.petparcel.store/products/6d50f085bd495d7e7c67.webp","kind":"image"},{"url":"https://media.petparcel.store/products/202131f516c8ca14a5df.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ae55804def297cec51a6.webp","kind":"image"},{"url":"https://media.petparcel.store/products/693520c7b589911c87d3.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- winter-clothes-fleece-lined-warm-dog-cute-clothes
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/b3b8ff3cc91f2b626228.webp","https://media.petparcel.store/products/187b78783f8099214798.webp","https://media.petparcel.store/products/3063db9284627c3438ad.webp","https://media.petparcel.store/products/01d94f63764ebd446b51.webp","https://media.petparcel.store/products/1a2f80c6c8ef60bb68da.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/b3b8ff3cc91f2b626228.webp","kind":"image"},{"url":"https://media.petparcel.store/products/187b78783f8099214798.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3063db9284627c3438ad.webp","kind":"image"},{"url":"https://media.petparcel.store/products/01d94f63764ebd446b51.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1a2f80c6c8ef60bb68da.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'winter-clothes-fleece-lined-warm-dog-cute-clothes'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/0ec4b4ea9e8a3b19cc81.webp","https://media.petparcel.store/products/3137a85fe0b873665952.webp","https://media.petparcel.store/products/c26b8231315fbc6f479f.webp","https://media.petparcel.store/products/e87fc2ae1bcd1269b8d8.webp","https://media.petparcel.store/products/0eabadc8e2dfc8db871e.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/0ec4b4ea9e8a3b19cc81.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3137a85fe0b873665952.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c26b8231315fbc6f479f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e87fc2ae1bcd1269b8d8.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0eabadc8e2dfc8db871e.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- puppy-soldier-hat-and-clothing-set
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/74550ff20ee5c49179b7.webp","https://media.petparcel.store/products/a2e4f24e9c6f961ea328.webp","https://media.petparcel.store/products/7baa48cb9cb4b8416c8e.webp","https://media.petparcel.store/products/18830430ec2082a84ca3.webp","https://media.petparcel.store/products/dd6988c757b9e8d3e1fe.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/74550ff20ee5c49179b7.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a2e4f24e9c6f961ea328.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7baa48cb9cb4b8416c8e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/18830430ec2082a84ca3.webp","kind":"image"},{"url":"https://media.petparcel.store/products/dd6988c757b9e8d3e1fe.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'puppy-soldier-hat-and-clothing-set'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/2556fe080051dddf0d4d.webp","https://media.petparcel.store/products/e98542d12ac0494a3a9d.webp","https://media.petparcel.store/products/63cc3bf27986eacbc5c5.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/2556fe080051dddf0d4d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e98542d12ac0494a3a9d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/63cc3bf27986eacbc5c5.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-shoes-wear-dog-shoes
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/4f3d8f6806822e466f8a.webp","https://media.petparcel.store/products/76bf1f01b934cae9d68c.webp","https://media.petparcel.store/products/de0317b807ee510dd652.webp","https://media.petparcel.store/products/e9ff7df8b10a2d989bf8.webp","https://media.petparcel.store/products/ea60fd8dbb369817f030.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/4f3d8f6806822e466f8a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/76bf1f01b934cae9d68c.webp","kind":"image"},{"url":"https://media.petparcel.store/products/de0317b807ee510dd652.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e9ff7df8b10a2d989bf8.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ea60fd8dbb369817f030.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-shoes-wear-dog-shoes'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 1pc-adjustable-bandana-leather-pet-collar-triangle-scarf
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/9d6a75b500ecc192d3ca.webp","https://media.petparcel.store/products/2c23f391beded1816892.webp","https://media.petparcel.store/products/229bf609c920c60c0f93.webp","https://media.petparcel.store/products/3f992df3ea51534104b9.webp","https://media.petparcel.store/products/c205478305a6dd2b356b.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/9d6a75b500ecc192d3ca.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2c23f391beded1816892.webp","kind":"image"},{"url":"https://media.petparcel.store/products/229bf609c920c60c0f93.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3f992df3ea51534104b9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/c205478305a6dd2b356b.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '1pc-adjustable-bandana-leather-pet-collar-triangle-scarf'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/7d867f8ce51c8ee8bcbf.webp","https://media.petparcel.store/products/b107b81f996ec5fe149a.webp","https://media.petparcel.store/products/9bb64df1603e89d7c3f2.webp","https://media.petparcel.store/products/e9c4f715b9eed59c0ed1.webp","https://media.petparcel.store/products/b8bc9525c2e484e548ee.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/7d867f8ce51c8ee8bcbf.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b107b81f996ec5fe149a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9bb64df1603e89d7c3f2.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e9c4f715b9eed59c0ed1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b8bc9525c2e484e548ee.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/71d148f5aa88b8de72c1.webp","https://media.petparcel.store/products/d2b9e7854a59f33021fa.webp","https://media.petparcel.store/products/f5d48bdc43b5531349a9.webp","https://media.petparcel.store/products/b32eca6d4ac7d009ae4f.webp","https://media.petparcel.store/products/32dc6f6fd9ec1b137952.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/71d148f5aa88b8de72c1.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d2b9e7854a59f33021fa.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f5d48bdc43b5531349a9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b32eca6d4ac7d009ae4f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/32dc6f6fd9ec1b137952.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/e2515469c1dc40e0d4c2.webp","https://media.petparcel.store/products/745e3ef5ad9dde6022aa.webp","https://media.petparcel.store/products/59dcae3bc34a71a6e17f.webp","https://media.petparcel.store/products/a466602d87bce601211d.webp","https://media.petparcel.store/products/f34476e4611ab14aad3f.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/e2515469c1dc40e0d4c2.webp","kind":"image"},{"url":"https://media.petparcel.store/products/745e3ef5ad9dde6022aa.webp","kind":"image"},{"url":"https://media.petparcel.store/products/59dcae3bc34a71a6e17f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a466602d87bce601211d.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f34476e4611ab14aad3f.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/6aaa196cf411330036fd.webp","https://media.petparcel.store/products/1402cf1bc6065be3c617.webp","https://media.petparcel.store/products/df824c4975aecaa309f9.webp","https://media.petparcel.store/products/f71c12b1bba9fb670638.webp","https://media.petparcel.store/products/9253340cb6d72459ce84.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/6aaa196cf411330036fd.webp","kind":"image"},{"url":"https://media.petparcel.store/products/1402cf1bc6065be3c617.webp","kind":"image"},{"url":"https://media.petparcel.store/products/df824c4975aecaa309f9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f71c12b1bba9fb670638.webp","kind":"image"},{"url":"https://media.petparcel.store/products/9253340cb6d72459ce84.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/310cf8f19f2f500f692b.webp","https://media.petparcel.store/products/fb88488199d40a83e83a.webp","https://media.petparcel.store/products/18b4a4443c5e529597a0.webp","https://media.petparcel.store/products/4ffcb9d028a1f076cd7a.webp","https://media.petparcel.store/products/2626e1f0e2b8db3a53dc.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/310cf8f19f2f500f692b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/fb88488199d40a83e83a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/18b4a4443c5e529597a0.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4ffcb9d028a1f076cd7a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2626e1f0e2b8db3a53dc.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- convenient-outing-parrot-myna-bird-cage
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/d86e9e0ec0b57e396012.webp","https://media.petparcel.store/products/4252bf0667e26a43442f.webp","https://media.petparcel.store/products/2c73c168ffce983b8bdd.webp","https://media.petparcel.store/products/f55a1ebc6528323ce126.webp","https://media.petparcel.store/products/e51f51182a1608814026.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/d86e9e0ec0b57e396012.webp","kind":"image"},{"url":"https://media.petparcel.store/products/4252bf0667e26a43442f.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2c73c168ffce983b8bdd.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f55a1ebc6528323ce126.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e51f51182a1608814026.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'convenient-outing-parrot-myna-bird-cage'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- parrot-out-rope-towing-anti-loss-flight-suit
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/2aecfaf2c6c65087eb78.webp","https://media.petparcel.store/products/f8ae43ab38d9bcd88bd2.webp","https://media.petparcel.store/products/d825b57c7b8940b1c6ab.webp","https://media.petparcel.store/products/47278d5accdd28c0d470.webp","https://media.petparcel.store/products/697fb31ec0b8a70b0f94.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/2aecfaf2c6c65087eb78.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f8ae43ab38d9bcd88bd2.webp","kind":"image"},{"url":"https://media.petparcel.store/products/d825b57c7b8940b1c6ab.webp","kind":"image"},{"url":"https://media.petparcel.store/products/47278d5accdd28c0d470.webp","kind":"image"},{"url":"https://media.petparcel.store/products/697fb31ec0b8a70b0f94.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'parrot-out-rope-towing-anti-loss-flight-suit'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/3fb2f9c741ce50021ded.webp","https://media.petparcel.store/products/7269fc629c8c1aee8192.webp","https://media.petparcel.store/products/2acb34eccebfac11079a.webp","https://media.petparcel.store/products/e5bbbe2f7d6172605671.webp","https://media.petparcel.store/products/6fbd89cf23318afd9642.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/3fb2f9c741ce50021ded.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7269fc629c8c1aee8192.webp","kind":"image"},{"url":"https://media.petparcel.store/products/2acb34eccebfac11079a.webp","kind":"image"},{"url":"https://media.petparcel.store/products/e5bbbe2f7d6172605671.webp","kind":"image"},{"url":"https://media.petparcel.store/products/6fbd89cf23318afd9642.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/e0f291eb5870ef058a56.webp","https://media.petparcel.store/products/0288be1f554f13341f24.webp","https://media.petparcel.store/products/ef77cb5704fecec6ea67.webp","https://media.petparcel.store/products/a2b6d04bbf979e850243.webp","https://media.petparcel.store/products/7849d1511ceabeb0a339.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/e0f291eb5870ef058a56.webp","kind":"image"},{"url":"https://media.petparcel.store/products/0288be1f554f13341f24.webp","kind":"image"},{"url":"https://media.petparcel.store/products/ef77cb5704fecec6ea67.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a2b6d04bbf979e850243.webp","kind":"image"},{"url":"https://media.petparcel.store/products/7849d1511ceabeb0a339.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/9b18dd5450d27986134e.webp","https://media.petparcel.store/products/77877e701f675c072ad4.webp","https://media.petparcel.store/products/95f128aacd8c553874c4.webp","https://media.petparcel.store/products/f9817ec4b8da00f2a010.webp","https://media.petparcel.store/products/a03a1f95faec5246cb80.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/9b18dd5450d27986134e.webp","kind":"image"},{"url":"https://media.petparcel.store/products/77877e701f675c072ad4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/95f128aacd8c553874c4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/f9817ec4b8da00f2a010.webp","kind":"image"},{"url":"https://media.petparcel.store/products/a03a1f95faec5246cb80.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- 2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/d38d5482f811cda087f9.webp","https://media.petparcel.store/products/df577efaab559087080b.webp","https://media.petparcel.store/products/63e2054b8eadd1160f24.webp","https://media.petparcel.store/products/8a65930a3c83d66f12a4.webp","https://media.petparcel.store/products/43973a89b1c3578660ef.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/d38d5482f811cda087f9.webp","kind":"image"},{"url":"https://media.petparcel.store/products/df577efaab559087080b.webp","kind":"image"},{"url":"https://media.petparcel.store/products/63e2054b8eadd1160f24.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8a65930a3c83d66f12a4.webp","kind":"image"},{"url":"https://media.petparcel.store/products/43973a89b1c3578660ef.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = '2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil'
    AND "images"::text NOT LIKE '%media.petparcel.store%';

-- pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove
UPDATE "products" SET
  "images" = '["https://media.petparcel.store/products/b6d706406d70492f6b85.webp","https://media.petparcel.store/products/92964a73fad6bb4037d5.webp","https://media.petparcel.store/products/3bdb196dc0729c3c86c5.webp","https://media.petparcel.store/products/b4357e92f548fa2b9fdf.webp","https://media.petparcel.store/products/8450316aca26089a5e51.webp"]'::jsonb,
  "media" = '[{"url":"https://media.petparcel.store/products/b6d706406d70492f6b85.webp","kind":"image"},{"url":"https://media.petparcel.store/products/92964a73fad6bb4037d5.webp","kind":"image"},{"url":"https://media.petparcel.store/products/3bdb196dc0729c3c86c5.webp","kind":"image"},{"url":"https://media.petparcel.store/products/b4357e92f548fa2b9fdf.webp","kind":"image"},{"url":"https://media.petparcel.store/products/8450316aca26089a5e51.webp","kind":"image"}]'::jsonb,
  "updated_at" = now()
  WHERE "slug" = 'pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove'
    AND "images"::text NOT LIKE '%media.petparcel.store%';
