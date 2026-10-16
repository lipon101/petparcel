// Pull each variant's OWN product photograph from the live CJ API, host it on
// our R2 bucket, and record it on the store's variant row.
//
// WHY. CJ returns a real `variantImage` per variant - the blue bowl, the pink
// bowl - so a colour press can show the colour the shopper actually picked
// instead of the product's first photo. The store previously had no per-variant
// image at all, so every colour showed the same picture.
//
// WHAT IT DOES, per catalogue product:
//   1. asks CJ for the product (`/product/query?pid=`) and reads each variant's
//      `vid` + `variantImage`;
//   2. matches the CJ variant to the store's row by `cj_vid`;
//   3. downloads the supplier image, re-encodes it to WebP, and PUTs it to R2
//      under `products/variants/<hash>.webp`;
//   4. writes the R2 public URL to `product_variants.image_url`.
//
// IDEMPOTENT. A variant that already has an `image_url` is skipped, so a re-run
// uploads nothing. Nothing is deleted and no other column is touched.
//
// Run:  DATABASE_URL=... CJ_API_KEY=... node --env-file=.env scripts/sync-variant-images.mjs [--limit N] [--dry]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { Client } from "pg";
import { r2Put, r2Head, r2PublicUrl, isR2Configured, describeR2 } from "../server/_core/r2.ts";

const DRY = process.argv.includes("--dry");
const LIMIT = process.argv.includes("--limit")
  ? Number(process.argv[process.argv.indexOf("--limit") + 1])
  : Infinity;

const KEY = process.env.CJ_API_KEY;
if (!KEY) {
  console.error("CJ_API_KEY is unset - refusing to run.");
  process.exit(1);
}
if (!isR2Configured()) {
  console.error("R2 is not configured. Present: " + describeR2().join(", "));
  process.exit(1);
}
const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let TOKEN = null;
async function auth() {
  const r = await fetch(BASE + "/authentication/getAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: KEY }),
  });
  const j = await r.json();
  if (j.code !== 200) throw new Error("CJ auth failed: " + j.message);
  TOKEN = j.data.accessToken;
}
async function cjGet(pathname) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(BASE + pathname, { headers: { "CJ-Access-Token": TOKEN } });
    if (r.status === 429 || r.status >= 500) {
      await sleep(1200 * 2 ** a);
      continue;
    }
    const j = await r.json();
    if (j.code === 1600200 || j.code === 1600300) {
      await auth();
      continue;
    }
    return j;
  }
  return { code: -1, message: "exhausted retries" };
}

/** The R2 key for a variant image, content-addressed so a re-run is a no-op. */
function variantKey(bytes) {
  const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 20);
  return `products/variants/${hash}.webp`;
}

const client = new Client({ connectionString: DB, ssl: false });
await client.connect();

// The supplier pid per slug. The store's own row does not carry it, so it comes
// from the SKU/VID reconciliation report the catalogue sync writes.
const REPORT = path.resolve("work/cj-sku-vid-report.json");
if (!fs.existsSync(REPORT)) {
  console.error(`Missing ${REPORT} - run the catalogue SKU/VID sync first.`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(REPORT, "utf8"));
const pidBySlug = new Map(
  (report.products ?? []).filter((p) => p.pid).map((p) => [p.slug, String(p.pid)]),
);

// Every product that has a CJ pid and at least one variant still missing an
// image.
const { rows: products } = await client.query(
  `select p.id, p.slug
     from products p
    where p.active and not p.archived
      and exists (
        select 1 from product_variants v
         where v.product_id = p.id and v.cj_vid is not null and v.image_url is null
      )
    order by p.slug`,
);
const queue = products
  .map((p) => ({ ...p, pid: pidBySlug.get(p.slug) }))
  .filter((p) => p.pid)
  .slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`[variant-images] ${queue.length} product(s) with variants missing an image`);

await auth();

let uploaded = 0;
let skipped = 0;
let failed = 0;
let done = 0;

for (const p of queue) {
  const j = await cjGet("/product/query?pid=" + encodeURIComponent(p.pid));
  await sleep(350);
  done++;
  if (j.code !== 200 || !j.data) {
    failed++;
    console.log(`[${done}/${queue.length}] FAIL ${p.slug} :: ${j.code} ${j.message ?? ""}`);
    continue;
  }
  const cjVariants = Array.isArray(j.data.variants) ? j.data.variants : [];
  const byVid = new Map(cjVariants.map((v) => [String(v.vid), v]));

  const { rows: storeVariants } = await client.query(
    `select id, cj_vid, image_url from product_variants
      where product_id = $1 and cj_vid is not null`,
    [p.id],
  );

  let productUploaded = 0;
  for (const sv of storeVariants) {
    if (sv.image_url) {
      skipped++;
      continue;
    }
    const cjv = byVid.get(String(sv.cj_vid));
    const src = cjv?.variantImage;
    if (!src || typeof src !== "string" || !/^https?:\/\//.test(src)) {
      skipped++;
      continue;
    }
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        failed++;
        continue;
      }
      const raw = Buffer.from(await res.arrayBuffer());
      const webp = await sharp(raw)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const key = variantKey(webp);
      const url = r2PublicUrl(key);
      if (!DRY) {
        const head = await r2Head(key);
        if (!head) await r2Put(key, new Uint8Array(webp), "image/webp");
        await client.query(`update product_variants set image_url = $1 where id = $2`, [url, sv.id]);
      }
      uploaded++;
      productUploaded++;
    } catch (err) {
      failed++;
      console.log(`  ! ${p.slug} vid=${sv.cj_vid}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(
    `[${done}/${queue.length}] ${p.slug}: ${productUploaded} image(s)${DRY ? " (dry)" : ""}`,
  );
}

await client.end();
console.log(
  `[variant-images] done. uploaded=${uploaded} skipped=${skipped} failed=${failed}${DRY ? " (dry run - nothing written)" : ""}`,
);
