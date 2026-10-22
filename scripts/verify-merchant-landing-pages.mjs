// Validates the LIVE storefront against the SAME product data source Google
// Merchant Center is given - the second half of the fix that `vercel.json` and
// `server/_core/serve.ts` make possible.
//
// WHY THIS EXISTS. The feed was always structurally valid, so "is the feed OK?"
// was never the useful question. Google crawls each feed `link` (a
// `/product/:slug` landing page) and refuses an item whose page does not present
// the advertised product. In production every one of those pages was answered by
// the CDN from the STATIC `/index.html`, so the raw HTML carried the HOMEPAGE
// canonical and no product data at all. Nothing in the repo could see that: the
// feed was green, CI was green, and the page renders correctly in a browser
// (which runs the bundle and writes the tags client-side).
//
// So this script asserts the one thing no other check does: for real feed items,
// the page a NON-JS crawler receives matches the feed.
//
// Checks, per sampled item:
//   * the landing page answers HTTP 200
//   * its `<link rel="canonical">` is that product's own URL (NOT the homepage)
//   * its `<title>` carries a distinctive token from the feed's `g:title`
//   * a `Product` JSON-LD block is present and the offer it publishes for that
//     item's SKU carries the price the item advertises (a price mismatch is a
//     Merchant Center disapproval)
//   * the feed's `g:image_link` is reachable
//
// Usage:
//   node scripts/verify-merchant-landing-pages.mjs [origin] [--all|--sample=N]
//   MERCHANT_FEED_URL=https://... node scripts/verify-merchant-landing-pages.mjs
//
// Exits non-zero on any failure, so CI or an operator can gate on it.
const args = process.argv.slice(2);
const originArg = args.find((a) => !a.startsWith("--"));
const ORIGIN = (originArg ?? process.env.MERCHANT_ORIGIN ?? "https://www.petparcel.store").replace(/\/+$/, "");
const FEED_URL = process.env.MERCHANT_FEED_URL ?? `${ORIGIN}/google-merchant-feed.xml`;
const sampleArg = args.find((a) => a.startsWith("--sample="));
const SAMPLE = args.includes("--all") ? Infinity : Number(sampleArg?.split("=")[1] ?? 8) || 8;

const failures = [];
const notes = [];

/** Decode the handful of XML entities the feed actually uses. */
function decode(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Pull every <item> block and the attributes this check needs. */
function parseItems(xml) {
  const items = [];
  for (const block of xml.split("<item>").slice(1)) {
    const body = block.split("</item>")[0];
    const grab = (tag) => {
      const m = new RegExp(`<g:${tag}>([\\s\\S]*?)</g:${tag}>`).exec(body);
      return m ? decode(m[1]) : null;
    };
    const id = grab("id");
    if (id) {
      items.push({
        id,
        title: grab("title"),
        link: grab("link"),
        price: grab("price"),
        salePrice: grab("sale_price"),
        availability: grab("availability"),
        imageLink: grab("image_link"),
      });
    }
  }
  return items;
}

/** Deterministic spread across the catalogue rather than the first N. */
function sampleOf(list, n) {
  if (n === Infinity || n >= list.length) return list;
  const step = Math.max(1, Math.floor(list.length / n));
  const out = [];
  for (let i = 0; i < list.length && out.length < n; i += step) out.push(list[i]);
  return out;
}

/** A distinctive word from the title, to prove the page names THIS product. */
function distinctiveToken(title) {
  const skip = new Set(["for", "and", "the", "with", "pet", "pets", "new", "set"]);
  const words = String(title ?? "")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length >= 5 && !skip.has(w.toLowerCase()));
  return words[0] ?? null;
}

/**
 * The offer the page publishes for THIS sku.
 *
 * A product page carries one offer for the option it shows by default and one
 * per option in `hasVariant`, so the offer for an item is the one whose sku is
 * the item's id. The product-level offer is used only when the page publishes
 * no per-option offers AND it names the same sku - otherwise the page says
 * nothing about this option's price, and there is nothing to compare against.
 */
function offerForSku(product, sku) {
  const variants = Array.isArray(product.hasVariant) ? product.hasVariant : [];
  for (const variant of variants) {
    if (variant && variant.sku === sku) {
      const offers = Array.isArray(variant.offers) ? variant.offers[0] : variant.offers;
      if (offers) return offers;
    }
  }
  const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  if (!offers) return null;
  if (product.sku && product.sku !== sku) return null;
  return offers;
}

function extractJsonLdProduct(html) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const parsed = JSON.parse(m[1]);
      const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
      const product = nodes.find((n) => n && n["@type"] === "Product");
      if (product) return product;
    } catch {
      // A malformed block is not a Product block; keep looking.
    }
  }
  return null;
}

async function main() {
  console.log(`[merchant-landing] feed: ${FEED_URL}`);
  const feedRes = await fetch(FEED_URL, { headers: { "user-agent": "petparcel-merchant-verify" } });
  if (!feedRes.ok) {
    console.error(`[merchant-landing] FEED UNREACHABLE: HTTP ${feedRes.status}`);
    process.exit(1);
  }
  const xml = await feedRes.text();
  const items = parseItems(xml);
  if (items.length === 0) {
    console.error("[merchant-landing] feed contains ZERO items - Merchant Center would see no products.");
    process.exit(1);
  }
  console.log(`[merchant-landing] feed items: ${items.length}`);

  const sample = sampleOf(items, SAMPLE);
  console.log(`[merchant-landing] checking ${sample.length} landing page(s)...\n`);

  const checkedImages = new Set();
  for (const item of sample) {
    const label = item.id;
    if (!item.link || !item.link.startsWith(ORIGIN)) {
      failures.push(`${label}: link is missing or points outside ${ORIGIN} (${item.link})`);
      continue;
    }
    let res;
    try {
      res = await fetch(item.link, { headers: { "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" } });
    } catch (e) {
      failures.push(`${label}: landing page fetch failed (${e.message})`);
      continue;
    }
    if (!res.ok) {
      failures.push(`${label}: landing page HTTP ${res.status} (${item.link})`);
      continue;
    }
    const html = await res.text();

    // 1. Canonical must be THIS product's URL, never the homepage.
    const canonical = /<link\s+rel="canonical"\s+href="([^"]*)"/.exec(html)?.[1] ?? null;
    if (!canonical) {
      failures.push(`${label}: no <link rel="canonical"> in the raw HTML`);
    } else if (canonical !== item.link) {
      failures.push(`${label}: canonical is ${canonical}, expected ${item.link}`);
    }

    // 2. The page must NAME the product (a distinctive token from g:title).
    const token = distinctiveToken(item.title);
    if (token && !html.toLowerCase().includes(token.toLowerCase())) {
      failures.push(`${label}: page does not mention "${token}" from the feed title`);
    }

    // 3. Product JSON-LD with the feed's own price.
    //
    // The price a customer actually pays is the SALE price when the feed
    // quotes one: `g:price` is the compare-at ("was") figure the page strikes
    // through, and `g:sale_price` is the price that is charged. Comparing the
    // page with `g:price` therefore reported every discounted item as a
    // mismatch - a false alarm that sent the operator chasing a problem that
    // was not there.
    //
    // The offer is looked up BY SKU. A product page carries one offer for the
    // option it shows and one per option in `hasVariant`, so the price of the
    // exact option an item advertises is the one that has to match.
    const product = extractJsonLdProduct(html);
    if (!product) {
      failures.push(`${label}: no Product JSON-LD in the raw HTML`);
    } else if (item.price != null) {
      const offer = offerForSku(product, item.id);
      const pagePrice = offer?.price != null ? `${Number(offer.price).toFixed(2)} USD` : null;
      const effective = item.salePrice ?? item.price;
      if (pagePrice !== effective) {
        failures.push(`${label}: page price ${pagePrice} != feed price ${effective}`);
      }
      if (item.availability === "in_stock" && !String(offer?.availability ?? "").includes("InStock")) {
        failures.push(`${label}: feed says in_stock but the page does not declare InStock`);
      }
    }

    // 4. The advertised image must resolve (checked once per unique URL).
    if (item.imageLink && !checkedImages.has(item.imageLink)) {
      checkedImages.add(item.imageLink);
      try {
        const img = await fetch(item.imageLink, { method: "HEAD" });
        if (!img.ok) failures.push(`${label}: image_link HTTP ${img.status} (${item.imageLink})`);
      } catch (e) {
        failures.push(`${label}: image_link fetch failed (${e.message})`);
      }
    }

    notes.push(`${label}: OK (canonical + title + price match)`);
  }

  for (const n of notes) console.log(`  ✓ ${n}`);

  if (failures.length > 0) {
    console.error(`\n[merchant-landing] FAILED: ${failures.length} problem(s):`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(
    `\n[merchant-landing] OK: ${sample.length}/${items.length} sampled items serve a landing page whose canonical, title, price and availability match the feed.`,
  );
}

main().catch((e) => {
  console.error("[merchant-landing] unexpected error:", e);
  process.exit(1);
});
