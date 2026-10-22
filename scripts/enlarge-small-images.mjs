// Re-encode product images that are SMALLER than Google's minimum, upload the
// larger copy to our own bucket, and point the row at it.
//
// WHY THIS EXISTS. Google rejects an item whose image is smaller than 250x250
// pixels (non-apparel): "Image too small". Two variant photographs in the
// catalogue are under that line - one of them a single pixel short on its
// height - and they are the images the Merchant Center feed advertises as the
// item's MAIN image.
//
// WHY NOT JUST USE ANOTHER PICTURE. Every other photograph of those two
// products carries burned-in promotional text ("Built-in simulation fish",
// "Round Underwater World 65cmX65cm"), a supplier watermark ("Â© Medeiros"), a
// different colourway, or a different size annotation. Any of those is a WORSE
// advertisement than a slightly small but honest photo: burned-in text is
// exactly what got the hoodie rejected. So the only fix that keeps the picture
// truthful is to re-encode the photo we already have at a larger size.
//
// WHAT IT DOES. The photo is upscaled to fit a 1200x1200 canvas and padded with
// white to make it square (Google's recommended main-image shape and
// background), re-encoded as WebP, stored under a CONTENT-ADDRESSED key - the
// same scheme scripts/sync-variant-images.mjs uses, so re-running is a no-op -
// and the row is pointed at the new object.
//
// The source pixels are small, so the result is an upscale: it satisfies the
// dimension check and keeps the right product in the right colourway.
//
// Run:
//   DATABASE_URL=... node --env-file=.env scripts/enlarge-small-images.mjs [--dry] [--min=250]
//   node --env-file=.env scripts/enlarge-small-images.mjs --url=https://.../image.webp [--dry]
import crypto from "node:crypto";
import sharp from "sharp";
import { Client } from "pg";
import { r2Put, r2PublicUrl, isR2Configured, describeR2 } from "../server/_core/r2.ts";

const DRY = process.argv.includes("--dry");
const MIN = Number((process.argv.find((a) => a.startsWith("--min=")) ?? "--min=250").split("=")[1]) || 250;
/** The canvas the image is fitted to: Google's recommended square main image. */
const CANVAS = 1200;

const urlArg = process.argv.find((a) => a.startsWith("--url="))?.slice("--url=".length);

/** The content-addressed key, the same scheme the variant sync uses. */
function contentKey(bytes, prefix) {
  const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 20);
  return `${prefix}/${hash}.webp`;
}

/**
 * Upscale to a square white canvas.
 *
 * `fit: "inside"` scales the photo to FIT the canvas without cropping it and
 * without distorting it, and the `extend` then pads the remainder with white.
 * An upscale is deliberate: the source pixels are what they are, and padding
 * (rather than stretching) keeps the product's shape honest.
 */
async function toCompliantCanvas(buf) {
  const fitted = await sharp(buf)
    .resize({ width: CANVAS, height: CANVAS, fit: "inside", withoutEnlargement: false })
    .webp({ quality: 85 })
    .toBuffer();
  const meta = await sharp(fitted).metadata();
  const w = meta.width ?? CANVAS;
  const h = meta.height ?? CANVAS;
  if (w >= CANVAS && h >= CANVAS) return fitted;
  return sharp(fitted)
    .extend({
      top: Math.floor((CANVAS - h) / 2),
      bottom: Math.ceil((CANVAS - h) / 2),
      left: Math.floor((CANVAS - w) / 2),
      right: Math.ceil((CANVAS - w) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .webp({ quality: 85 })
    .toBuffer();
}

/**
 * One image that is too small, and where it is used.
 *
 * @typedef {{ url: string,
 *   owner: { kind: "variant", sku: string } | { kind: "product", slug: string } }} Small
 */

/** Every image the store advertises, with the row that points at it. */
async function listFromDb() {
  const DB = process.env.DATABASE_URL;
  if (!DB) throw new Error("DATABASE_URL is required.");
  const client = new Client({ connectionString: DB, ssl: false });
  await client.connect();
  try {
    const { rows } = await client.query(
      `select p.slug, p.images, v.sku, v.image_url
         from products p
         left join product_variants v on v.product_id = p.id
        where p.active and not p.archived`,
    );
    const out = [];
    for (const row of rows) {
      for (const image of row.images ?? []) {
        if (typeof image === "string" && image) out.push({ url: image, owner: { kind: "product", slug: row.slug } });
      }
      if (row.image_url) {
        out.push({ url: row.image_url, owner: { kind: "variant", sku: row.sku } });
      }
    }
    return out;
  } finally {
    await client.end();
  }
}

/** Write the new object back to the row that points at the old one. */
async function pointAt(client, owner, newUrl) {
  if (owner.kind === "variant") {
    await client.query(`update product_variants set image_url = $1 where sku = $2`, [newUrl, owner.sku]);
  } else {
    // The gallery is a jsonb array of urls: the old one is replaced in place.
    await client.query(
      `update products
          set images = (
                select coalesce(jsonb_agg(
                  case when el.value #>> '{}' = $2 then to_jsonb($1::text) else el.value end
                ), '[]'::jsonb)
                  from jsonb_array_elements(images) as el(value)
              )
        where slug = $3`,
      [newUrl, owner.url, owner.slug],
    );
  }
}

async function main() {
  const small = urlArg
    ? [{ url: urlArg, owner: { kind: "variant", sku: "(explicit --url)" } }]
    : await listFromDb();

  const seen = new Set();
  let enlarged = 0;
  let skipped = 0;
  let failed = 0;

  const client = urlArg ? null : new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  if (client) await client.connect();

  try {
    for (const item of small) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      try {
        const res = await fetch(item.url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) {
          failed++;
          console.log(`  ! ${item.url} -> HTTP ${res.status}`);
          continue;
        }
        const raw = Buffer.from(await res.arrayBuffer());
        const meta = await sharp(raw).metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;
        if (w >= MIN && h >= MIN) {
          skipped++;
          continue;
        }
        const webp = await toCompliantCanvas(raw);
        const after = await sharp(webp).metadata();
        const prefix = item.url.includes("/products/variants/") ? "products/variants" : "products";
        const key = contentKey(webp, prefix);
        // The public URL needs the bucket's configuration; a dry run must work
        // without it, so a missing configuration is not fatal here.
        let newUrl = null;
        try {
          newUrl = r2PublicUrl(key);
        } catch {
          newUrl = null;
        }
        console.log(
          `  ${w}x${h} -> ${after.width}x${after.height}  ${key}  ` +
            `(${item.owner.kind === "variant" ? item.owner.sku : item.owner.slug})`,
        );
        if (DRY) {
          console.log(`    (dry run - nothing written${newUrl ? `; would become ${newUrl}` : ""})`);
          continue;
        }
        if (!newUrl || !isR2Configured()) {
          failed++;
          console.log(`    ! R2 is not configured. Present: ${describeR2().join(", ")}`);
          continue;
        }
        await r2Put(key, new Uint8Array(webp), "image/webp");
        if (client) await pointAt(client, item.owner, newUrl);
        enlarged++;
      } catch (err) {
        failed++;
        console.log(`  ! ${item.url} -> ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    if (client) await client.end();
  }

  console.log(
    `[enlarge-small-images] done. enlarged=${enlarged} already-fine=${skipped} failed=${failed}` +
      `${DRY ? " (dry run - nothing written)" : ""}`,
  );
  if (failed > 0) process.exit(1);
}

await main();

