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
// So this checks the image the browser is actually handed AND, for any legacy
// supplier URL still in the catalogue, the resized transform too, and it FAILS on
// a non-200 or a non-image content type. Run it after any catalogue change:
//
//   pnpm verify:images
//
// It reads the live database (never a bundled copy), so it verifies what the API
// will actually serve.

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

const CONTENT_TYPE_MUST_START_WITH = "image/";

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

async function check(url, token) {
  const res = await fetch(url, {
    method: "GET",
    headers: token ? { "CJ-Access-Token": token } : {},
    // A ranged read is enough to prove the bytes are an image and keeps the
    // check cheap across a full catalogue.
    signal: AbortSignal.timeout(30_000),
  });
  const type = res.headers.get("content-type") ?? "";
  const ok = res.ok && type.startsWith(CONTENT_TYPE_MUST_START_WITH);
  // Drain a little so the connection is reusable.
  if (ok) await res.arrayBuffer();
  return { status: res.status, type, ok };
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
  if (process.env.DB_DRIVER !== "neon") await driver.end();

  const urls = [...new Set(rows.flatMap((r) => r.images ?? []).filter(Boolean))];
  console.log(`checking ${urls.length} distinct catalogue image(S) across ${rows.length} products`);

  // Each image is checked twice: the transformed URL the browser is handed, and
  // the original it falls back to. A relative/unsupported URL is checked as-is.
  const targets = [];
  for (const u of urls) {
    targets.push({ url: u, tag: "original" });
    const t = transformed(u, 600);
    if (t) targets.push({ url: t, tag: "transformed" });
  }

  const failures = [];
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
          }
        } catch (err) {
          failures.push({ ...target, status: 0, type: `(error) ${err.message}`, ok: false });
        }
        done += 1;
        if (done % 100 === 0) console.log(`  ...${done}/${targets.length}`);
      }
    }),
  );

  console.log(`\nchecked ${targets.length} URL(s): ${targets.length - failures.length} ok, ${failures.length} failed`);
  if (failures.length > 0) {
    console.error("\nFAILURES:");
    for (const f of failures.slice(0, 50)) {
      console.error(`  [${f.tag}] ${f.status} ${f.type} ${f.url}`);
    }
    process.exit(1);
  }
  console.log("all product images load as real images");
}

await main();
