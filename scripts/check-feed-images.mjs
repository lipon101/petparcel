// Check every image the Merchant Center feed advertises, and lay the MAIN ones
// out in one sheet so they can be reviewed for overlays.
//
// WHY THIS EXISTS. Google reads the MAIN image (g:image_link) strictly: text over
// the picture, a retailer logo, a watermark or a decorative frame all get the
// item rejected with "Promotional overlay on image", and the feed is fetched
// every day - so a bad picture is found one item per review cycle, days apart.
// Two of this store's items were rejected that way before this check existed.
//
// The check answers the question that actually matters - "does the feed
// advertise a picture that cannot be advertised?" - from THREE sides:
//
//   1. the policy (shared/merchant-image-policy.ts): a picture the store has
//      already found to be un-advertisable must never appear in the feed again.
//      Exact, so it FAILS the run;
//   2. Google's own objective rules: the picture loads and it is an image.
//      Exact, so it FAILS the run;
//   3. a REVIEW SHEET of every distinct main image, so a human (or an agent)
//      can look for the overlays and watermarks that no rule can detect, and
//      add what they find to the policy.
//
// A picture that is merely SMALLER than Google's 250x250 minimum is reported
// as a warning, not a failure: it is still advertisable, and the fix (re-encoding
// the picture larger) needs the bucket's credentials, so it is the operator's
// call rather than a gate.
//
// Usage:
//   node scripts/check-feed-images.mjs [--module] [feed-url|feed-file] [--sheet=out.png] [--no-sheet]
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { NON_COMPLIANT_IMAGES } from "../shared/merchant-image-policy.ts";

const args = process.argv.slice(2);
const useModule = args.includes("--module");
const feedArg = args.find((a) => !a.startsWith("--"));
const sheetPath = args.find((a) => a.startsWith("--sheet="))?.slice("--sheet=".length);
const wantSheet = !args.includes("--no-sheet");
const FEED = feedArg ?? "https://www.petparcel.store/google-merchant-feed.xml";

/** Google's hard minimum for a non-apparel product image. */
const MIN_SIZE = 250;
/** Google's maximum: 64 megapixels. */
const MAX_MEGAPIXELS = 64;

const policyKeys = new Map(NON_COMPLIANT_IMAGES.map((e) => [e.key.toLowerCase(), e]));

function keyOf(url) {
  const name = url.split("/").pop() ?? "";
  return name.replace(/\.[A-Za-z0-9]+$/, "").toLowerCase();
}

/** The feed's items: either the live feed, or the committed module. */
async function readItems() {
  if (useModule) {
    const { MERCHANT_FEED_ITEMS } = await import("../server/_core/merchant-feed-data.ts");
    return MERCHANT_FEED_ITEMS.map((i) => ({
      id: i.id,
      image: i.imageLink,
      additional: i.additionalImageLinks ?? [],
    }));
  }
  const xml = feedArg && !/^https?:/i.test(feedArg)
    ? readFileSync(feedArg, "utf8")
    : await (await fetch(FEED, { headers: { "cache-control": "no-cache" } })).text();
  const out = [];
  for (const block of xml.split("<item>").slice(1)) {
    out.push({
      id: /<g:id>([^<]+)<\/g:id>/.exec(block)?.[1] ?? "?",
      image: /<g:image_link>([^<]+)<\/g:image_link>/.exec(block)?.[1] ?? "",
      additional: [...block.matchAll(/<g:additional_image_link>([^<]+)<\/g:additional_image_link>/g)].map(
        (m) => m[1],
      ),
    });
  }
  return out;
}

const items = await readItems();

/** The MAIN images, with the SKUs that use them. */
const mains = new Map();
for (const item of items) {
  if (!item.image) continue;
  mains.set(item.image, [...(mains.get(item.image) ?? []), item.id]);
}
console.log(`feed: ${items.length} item(s), ${mains.size} distinct main image(s)`);

const failures = [];
const warnings = [];
const reviewed = [];

for (const [url, skus] of mains) {
  const blocked = policyKeys.get(keyOf(url));
  if (blocked) {
    failures.push(`${skus[0]}: the main image is on the non-compliant list (${blocked.reason}) - ${url}`);
    continue;
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      failures.push(`${skus[0]}: the main image answered HTTP ${res.status} - ${url}`);
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) {
      failures.push(`${skus[0]}: the main image is not an image (${type}) - ${url}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < MIN_SIZE || h < MIN_SIZE) {
      warnings.push(
        `${skus[0]}: the main image is ${w}x${h}, under Google's ${MIN_SIZE}x${MIN_SIZE} minimum - ${url}`,
      );
    } else if ((w * h) / 1_000_000 > MAX_MEGAPIXELS) {
      failures.push(
        `${skus[0]}: the main image is ${((w * h) / 1_000_000).toFixed(1)}MP, over 64MP - ${url}`,
      );
    }
    reviewed.push({ url, skus, buf, w, h });
  } catch (err) {
    failures.push(`${skus[0]}: the main image could not be read (${err.message}) - ${url}`);
  }
}

if (wantSheet && sheetPath) {
  const TILE = 220;
  const COLS = 8;
  const rows = Math.max(1, Math.ceil(reviewed.length / COLS));
  mkdirSync(path.dirname(sheetPath), { recursive: true });
  const composites = [];
  for (const [i, r] of reviewed.entries()) {
    const scaled = await sharp(r.buf).resize(TILE, TILE, { fit: "contain", background: "#ffffff" }).png().toBuffer();
    composites.push({ input: scaled, left: (i % COLS) * TILE, top: Math.floor(i / COLS) * (TILE + 14) });
  }
  await sharp({
    create: { width: COLS * TILE, height: rows * (TILE + 14), channels: 3, background: "#e8e8e8" },
  })
    .composite(composites)
    .png()
    .toFile(sheetPath);
  console.log(`review sheet: ${sheetPath} (${reviewed.length} main image(s))`);
}

console.log(`\nchecked ${mains.size} main image(s): ${failures.length} problem(s), ${warnings.length} warning(s)`);
for (const w of warnings) console.log(`  WARN ${w}`);
for (const f of failures) console.log(`  FAIL ${f}`);
if (failures.length > 0) {
  console.log(
    "\nA main image that cannot be advertised is removed by nulling the variant's\n" +
      "image_url (the option then falls back to the product's gallery) and by adding\n" +
      "the picture to shared/merchant-image-policy.ts.",
  );
  process.exit(1);
}
console.log("every main image can be advertised");
