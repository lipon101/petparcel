// Build RESPONSIVE DERIVATIVES for every catalogue image, ONCE, into Cloudflare
// R2 - the single largest lever on how fast the grid and a product page paint.
//
// WHY. Every product image on R2 is one large WebP: a 1200px artwork that the
// grid draws at ~320 CSS px and a phone at ~390. Measured on the real storefront,
// /shop transferred 1094 KB of images (one alone 244 KB) and the product page
// 1021 KB - for slots a fraction of that size. R2 does NOT resize on the fly
// (its `x-oss-process` / `cdn-cgi/image` endpoints 404), so the derivatives have
// to exist as objects.
//
// WHAT IT WRITES, per source image, under a sibling prefix:
//   products/w400/<name>.webp   grid tile on a 2x phone  (~30-60 KB)
//   products/w800/<name>.webp   product stage / 2x tile  (~70-140 KB)
//   products/w24/<name>.webp    blur-up placeholder     (~0.3-1 KB)
//
// IDEMPOTENT. A derivative already present (HEAD 200) is skipped, so re-running
// uploads nothing. Nothing is deleted and the canonical object is never touched -
// the storefront keeps it as the fallback for any browser that cannot take the
// derivative.
//
// Run:  node --env-file=.env scripts/build-r2-derivatives.mjs [--dry] [--limit N]
import crypto from "node:crypto";
import sharp from "sharp";
import { Client } from "pg";
import { r2Put, r2Head, r2PublicUrl, isR2Configured, describeR2 } from "../server/_core/r2.ts";

const DRY = process.argv.includes("--dry");
const LIMIT = process.argv.includes("--limit")
  ? Number(process.argv[process.argv.indexOf("--limit") + 1])
  : Infinity;

if (!isR2Configured()) {
  console.error("R2 is not configured. Present: " + describeR2().join(", "));
  process.exit(1);
}
const DB = process.env.DATABASE_URL;
if (!DB) {
  console.error("DATABASE_URL is required (the catalogue is the source of image URLs).");
  process.exit(1);
}

/** The widths the storefront actually asks for. Kept in step with
 *  `PRODUCT_IMAGE_WIDTHS` in shared/product-media.ts. */
const DERIVATIVES = [
  { width: 400, quality: 78 },
  { width: 800, quality: 74 },
  { width: 24, quality: 40 },
];

/** Which derivative prefix a width belongs to. */
export function derivativePrefix(width) {
  return `w${width}`;
}

const client = new Client({ connectionString: DB, ssl: false });
await client.connect();
const { rows } = await client.query(
  `select distinct u from (
     select jsonb_array_elements_text(images) as u from products
   ) t
   where u ~ '^https://[^/]+/products/[^/]+\\.webp$'
   order by u`,
);
await client.end();

const urls = rows.map((r) => r.u).slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`[derivatives] ${urls.length} catalogue images, ${DERIVATIVES.length} sizes each`);

let uploaded = 0;
let skipped = 0;
let bytesIn = 0;
let bytesOut = 0;
const failed = [];

const CONCURRENCY = 6;
let cursor = 0;

async function one(url) {
  const m = url.match(/^https:\/\/[^/]+\/products\/([^/]+\.webp)$/);
  if (!m) return;
  const name = m[1];
  let srcBytes = null;
  for (const d of DERIVATIVES) {
    const key = `products/${derivativePrefix(d.width)}/${name}`;
    const head = await r2Head(key);
    if (head) {
      skipped++;
      continue;
    }
    if (DRY) {
      uploaded++;
      continue;
    }
    if (!srcBytes) {
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      srcBytes = Buffer.from(await res.arrayBuffer());
      bytesIn += srcBytes.byteLength;
    }
    const out = await sharp(srcBytes, { failOn: "none" })
      .resize({ width: d.width, withoutEnlargement: true })
      .webp({ quality: d.quality })
      .toBuffer();
    await r2Put(key, new Uint8Array(out), "image/webp");
    bytesOut += out.byteLength;
    uploaded++;
  }
}

async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++];
    try {
      await one(url);
    } catch (err) {
      failed.push(`${url} :: ${err instanceof Error ? err.message : String(err)}`);
    }
    const done = cursor;
    if (done % 25 === 0 || done === urls.length) {
      console.log(
        `[derivatives] ${done}/${urls.length}  uploaded=${uploaded} skipped=${skipped} failed=${failed.length}`,
      );
    }
  }
}

const started = Date.now();
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`\n[derivatives] DONE in ${((Date.now() - started) / 1000).toFixed(0)}s`);
console.log(`  uploaded ${uploaded}  skipped(existing) ${skipped}  failed ${failed.length}`);
if (bytesIn > 0) {
  console.log(`  source read ${kb(bytesIn)}  ->  derivatives written ${kb(bytesOut)}`);
}
if (failed.length) {
  console.error("  failures:");
  for (const f of failed.slice(0, 20)) console.error(`    ${f}`);
  process.exit(1);
}
console.log(`  sample: ${r2PublicUrl("products/w400/" + urls[0]?.split("/").pop())}`);

// A content address of the derivative set, so a deploy can be tied to exactly
// which derivatives it expected to exist.
const digest = crypto
  .createHash("sha256")
  .update(urls.join("\n") + DERIVATIVES.map((d) => `${d.width}:${d.quality}`).join(","))
  .digest("hex")
  .slice(0, 12);
console.log(`  manifest digest: ${digest}`);
