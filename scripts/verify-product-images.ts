// Verify that EVERY product image the storefront can render actually loads.
//
// WHY THIS EXISTS. Product galleries are served from the store's own Cloudflare
// R2 bucket (R2_PUBLIC_BASE_URL, e.g. https://media.petparcel.store), re-encoded
// to WebP at ingest. Two things can therefore break silently and only show up as
// a broken tile or a product page with no photo:
//
//   1. a stored URL that 404s, is deleted, or (worse) answers 200 with an HTML
//      error page - the exact failure that shipped once when the galleries were
//      hosted on a retired GitHub-release URL that 302'd to text/html;
//   2. a URL whose host does not serve the bytes as an image.
//
// And one more, which is a MERCHANT CENTER problem rather than a broken tile:
//   3. an image that is too SMALL. Google requires a product image to be at
//      least 250x250 pixels for a non-apparel product, and rejects an item
//      whose image is smaller. Two variant photos in the catalogue are under
//      that (one is a single pixel short on its height), so the size is checked
//      here rather than left to a disapproval.
//
// The check covers BOTH galleries: the product's own images AND each variant's
// own photograph, because the variant photo is the one the Merchant Center feed
// advertises as the item's MAIN image (g:image_link).
//
// So this checks the image the browser is actually handed AND, for any legacy
// supplier URL still in the catalogue, the resized transform too, and it FAILS on
// a non-200, a non-image content type, or an image below Google's minimum. Run
// it after any catalogue change:
//
//   pnpm verify:images
//
// It reads the live database (never a bundled copy), so it verifies what the API
// will actually serve.

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import sharp from "sharp";

const CONTENT_TYPE_MUST_START_WITH = "image/";

/** Google's hard minimum for a non-apparel product image. */
const GOOGLE_MIN_SIZE = 250;

/** Google's recommended minimum (the figure its own guidance quotes). */
const GOOGLE_RECOMMENDED_SIZE = 500;

/** Google's maximum: 64 megapixels. */
const GOOGLE_MAX_MEGAPIXELS = 64;

/** Google's maximum file size: 16MB. */
const GOOGLE_MAX_BYTES = 16 * 1024 * 1024;

/** The rewritten URL the storefront renders for a slot, or null when the host
 *  is not a supplier host. Images on the store's own R2 bucket are already WebP
 *  at the right size, so they need no transform and are checked as-is. */
function transformed(url, width) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!["cf.cjdropshipping.com", "oss-cf.cjdropshipping.com"].includes(parsed.hostname)) {
    return null;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}x-oss-process=image/resize,w_${width}/format,webp/quality,q_82`;
}

/**
 * Fetch an image and check it against Google's own rules.
 *
 * The bytes are read in full (not a ranged read) because the SIZE has to be
 * measured, which needs the whole file.
 */
async function check(url, token) {
  const res = await fetch(url, {
    method: "GET",
    headers: token ? { "CJ-Access-Token": token } : {},
    signal: AbortSignal.timeout(30_000),
  });
  const type = res.headers.get("content-type") ?? "";
  const ok = res.ok && type.startsWith(CONTENT_TYPE_MUST_START_WITH);
  if (!ok) return { status: res.status, type, ok, width: null, height: null, bytes: 0 };
  const buf = Buffer.from(await res.arrayBuffer());
  let width = null;
  let height = null;
  try {
    const meta = await sharp(buf).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    // A file that claims to be an image but cannot be decoded is a failure.
    return { status: res.status, type, ok: false, width: null, height: null, bytes: buf.length };
  }
  return { status: res.status, type, ok: true, width, height, bytes: buf.length };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const driver =
    process.env.DB_DRIVER === "neon" ? neon(url) : new Pool({ connectionString: url });
  const rows =
    process.env.DB_DRIVER === "neon"
      ? await driver`SELECT images FROM products WHERE active = true AND archived = false`
      : (await driver.query("SELECT images FROM products WHERE active = true AND archived = false")).rows;
  // The variant photos matter as much as the galleries: the Merchant Center
  // feed advertises a variant's OWN photograph as the item's main image
  // (g:image_link), so that is the image Google measures the item against.
  const variantRows =
    process.env.DB_DRIVER === "neon"
      ? await driver`SELECT v.image_url FROM product_variants v
                     JOIN products p ON p.id = v.product_id
                    WHERE p.active AND NOT p.archived AND v.image_url IS NOT NULL`
      : (
          await driver.query(
            `SELECT v.image_url FROM product_variants v
               JOIN products p ON p.id = v.product_id
              WHERE p.active AND NOT p.archived AND v.image_url IS NOT NULL`,
          )
        ).rows;
  if (process.env.DB_DRIVER !== "neon") await driver.end();

  const galleryUrls = rows.flatMap((r) => r.images ?? []).filter(Boolean);
  const variantUrls = variantRows.map((r) => r.image_url).filter(Boolean);
  const urls = [...new Set([...galleryUrls, ...variantUrls])];
  console.log(
    `checking ${urls.length} distinct image(s): ${galleryUrls.length} gallery + ${variantUrls.length} variant across ${rows.length} products`,
  );

  // Each image is checked twice: the transformed URL the browser is handed, and
  // the original it falls back to. A relative/unsupported URL is checked as-is.
  const targets = [];
  for (const u of urls) {
    targets.push({ url: u, tag: "original" });
    const t = transformed(u, 600);
    if (t) targets.push({ url: t, tag: "transformed" });
  }

  const failures = [];
  const undersized = [];
  let done = 0;
  const CONCURRENCY = 12;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < targets.length) {
        const target = targets[cursor++];
        try {
          const result = await check(target.url);
          if (!result.ok) {
            failures.push({ ...target, ...result });
          } else if (result.width && result.height) {
            const megapixels = (result.width * result.height) / 1_000_000;
            if (result.width < GOOGLE_MIN_SIZE || result.height < GOOGLE_MIN_SIZE) {
              // Below Google's hard minimum: the item is rejected.
              failures.push({
                ...target,
                ...result,
                why: `too small ${result.width}x${result.height} (minimum ${GOOGLE_MIN_SIZE}x${GOOGLE_MIN_SIZE})`,
              });
            } else if (result.width < GOOGLE_RECOMMENDED_SIZE || result.height < GOOGLE_RECOMMENDED_SIZE) {
              // Above the minimum but under Google's recommendation: worth
              // knowing, not a rejection.
              undersized.push({ ...target, ...result });
            }
            if (megapixels > GOOGLE_MAX_MEGAPIXELS) {
              failures.push({
                ...target,
                ...result,
                why: `too large ${result.width}x${result.height} = ${megapixels.toFixed(1)}MP (max ${GOOGLE_MAX_MEGAPIXELS}MP)`,
              });
            }
            if (result.bytes > GOOGLE_MAX_BYTES) {
              failures.push({
                ...target,
                ...result,
                why: `file ${(result.bytes / 1024 / 1024).toFixed(1)}MB (max 16MB)`,
              });
            }
          }
        } catch (err) {
          failures.push({ ...target, status: 0, type: `(error) ${err.message}`, ok: false });
        }
        done += 1;
        if (done % 100 === 0) console.log(`  ...${done}/${targets.length}`);
      }
    }),
  );

  console.log(`\nchecked ${targets.length} URL(s): ${failures.length} failed`);
  if (undersized.length > 0) {
    console.log(
      `\n${undersized.length} image(s) are under Google's RECOMMENDED ${GOOGLE_RECOMMENDED_SIZE}x${GOOGLE_RECOMMENDED_SIZE} ` +
        `(still above the ${GOOGLE_MIN_SIZE}x${GOOGLE_MIN_SIZE} minimum, so still advertisable):`,
    );
    for (const u of undersized.slice(0, 20)) {
      console.log(`  [${u.tag}] ${u.width}x${u.height} ${u.url}`);
    }
  }
  if (failures.length > 0) {
    console.error("\nFAILURES:");
    for (const f of failures.slice(0, 50)) {
      console.error(`  [${f.tag}] ${f.status} ${f.type}${f.why ? ` ${f.why}` : ""} ${f.url}`);
    }
    process.exit(1);
  }
  console.log("all product images load as real images and are within Google's size rules");
}

await main();
