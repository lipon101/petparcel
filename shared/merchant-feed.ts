// ── The Google Merchant Center feed ─────────────────────────────────────────
//
// ONE definition of the store's Merchant Center product feed, shared by the
// generator (`scripts/generate-merchant-feed.ts`), the host-aware route
// (`server/_core/merchant-feed.ts`) and the parity test
// (`server/_core/merchant-feed.test.ts`).
//
// WHY IT LIVES HERE AND NOT IN THE SCRIPT. A feed is only useful if it agrees
// with the storefront: Google disapproves an item - or the whole account - when
// the feed's price, availability or shipping does not match the landing page the
// item links to. Keeping the MAPPING (price/sale, availability, shipping,
// returns, brand) in one pure module is what lets a single test assert the feed
// and the catalogue cannot disagree. The module is deliberately free of any
// database import so it can be exercised directly, and free of any env read so
// the generator and the request path agree.
//
// The feed is RSS 2.0 with the Google namespace, which is the format Merchant
// Center documents for a scheduled fetch of an XML file.
import { categoryParent } from "./category-tree";
import { isNonCompliantImage } from "./merchant-image-policy";
import { sanitizeProductCopy } from "./supplier-guard";
import { STORE_NAME, STORE_URL } from "./store";

/** Google's own namespace for the `g:` fields. */
export const GOOGLE_MERCHANT_NS = "http://base.google.com/ns/1.0";

/**
 * The single source of shipping cost in the feed. It MUST equal the storefront's
 * `shipping_flat_cents` default (699) - a feed that quotes a different shipping
 * price than checkout is the classic disapproval, and it is why the parity test
 * asserts this against the real settings default rather than a local literal.
 */
export const MERCHANT_FEED_SHIPPING = {
  country: "US",
  service: "Standard",
  priceCents: 699,
} as const;

/**
 * The return policy the feed advertises, mirroring `/shipping-returns` and the
 * Merchant Center return-policy form exactly: a 30-day window, free returns, and
 * a prepaid label included in the package.
 *
 * NOTE ON THE MECHANISM. Google carries return terms as a NAMED POLICY in the
 * account (Merchant Center -> Settings -> Return policies), and an item points at
 * it with `g:return_policy_label`. There is no per-item "return window" attribute
 * in the RSS spec, so this module does NOT invent one: it emits the label, and
 * these fields are the single definition of what that label must contain. The
 * test pins them, so the terms here and the policy page cannot drift.
 */
export const MERCHANT_FEED_RETURNS = {
  label: "30-day-free-returns",
  windowDays: 30,
  freeReturns: true,
  returnLabelIncluded: true,
  restockingFeeCents: 0,
} as const;

/** What Google accepts for `g:availability`. */
export type MerchantAvailability = "in_stock" | "out_of_stock";

/** One `<item>` in the feed, already mapped from a catalogue row. */
export interface MerchantFeedItem {
  /** `g:id` - the variant SKU, which is also what the order is fulfilled by. */
  id: string;
  /** `title` - the product name, plus the option value when the product has
   *  more than one, so the feed's text matches what the page renders. */
  title: string;
  /** `description` - the product copy, supplier mentions already stripped. */
  description: string;
  /** `link` - the canonical production product URL. */
  link: string;
  /** `g:image_link` - the primary shot. */
  imageLink: string;
  /** `g:additional_image_link` - the rest of the gallery. */
  additionalImageLinks: string[];
  /** `g:price` - the REGULAR price. When the product is on sale this is the
   *  compare-at ("was") price, exactly the struck-through figure the page shows. */
  priceCents: number;
  /** `g:sale_price` - the current price, only when a genuine compare-at exists
   *  above it. Null means "emit no sale_price at all". */
  salePriceCents: number | null;
  /** `g:availability` - from live stock, never assumed. */
  availability: MerchantAvailability;
  /** `g:condition` - the store sells new goods only. */
  condition: "new";
  /** `g:brand`. */
  brand: string;
  /** `g:identifier_exists` - false, because the catalogue carries no GTIN/MPN.
   *  Stating it explicitly is what stops Google scanning for an identifier that
   *  does not exist and flagging every item. */
  identifierExists: boolean;
  /** `g:product_type` - OUR browse taxonomy ("Pet Toys > Pet Chew Toys"), which
   *  is what this field is for. The numeric `google_product_category` is
   *  deliberately NOT emitted: guessing a taxonomy id misclassifies the item, and
   *  no id is confidently derivable from the catalogue (see the route's note). */
  productType: string;
  /** `g:item_group_id` - groups the options of one product, so Google shows a
   *  single listing with variants instead of unrelated items. Null for a
   *  single-option product. Clamped to Google's 50-character ceiling by
   *  {@link itemGroupIdFor} (see there for why the slug is not shortened
   *  instead). */
  itemGroupId: string | null;
  /** `g:return_policy_label` - the named policy configured in Merchant Center. */
  returnPolicyLabel: string;
}

/**
 * The structural shape the builder needs. Deliberately structural (not the
 * drizzle row type) so BOTH the database read and the bundled catalogue can be
 * mapped by the same code - which is what makes the two impossible to drift.
 */
export interface MerchantFeedSourceProduct {
  name: string;
  slug: string;
  category: string;
  description: string;
  priceCents: number;
  compareAtCents?: number | null;
  images: string[];
  variants: MerchantFeedSourceVariant[];
}

/** One buyable line of a source product. */
export interface MerchantFeedSourceVariant {
  sku: string;
  name: string;
  priceCents: number;
  inventoryQty: number;
  /** The variant's own photograph, when the catalogue has one. */
  imageUrl?: string | null;
  /** False for a retired option. Absent means active (the bundled catalogue does
   *  not carry the flag, because every seeded option is sellable). */
  active?: boolean;
}

/** Escape a value for XML character data. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** `1234` -> `"12.34 USD"` - the format Google requires for every price. */
export function formatFeedPrice(cents: number): string {
  const safe = Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
  return `${(safe / 100).toFixed(2)} USD`;
}

/** Google's availability vocabulary from a real stock count. */
export function availabilityFor(inventoryQty: number): MerchantAvailability {
  return Number(inventoryQty) > 0 ? "in_stock" : "out_of_stock";
}

/** Google caps `description` at 5000 characters; the catalogue's prose is far
 *  shorter, but a hand-edited row could not be allowed to break the feed. */
const MAX_DESCRIPTION = 5000;

/** Google's ceiling on extra gallery shots per item. */
const MAX_ADDITIONAL_IMAGES = 10;

/** Google caps `title` at 150 characters. Three of the catalogue's supplier
 *  titles run longer than that once the option value is appended, so the feed
 *  clamps every title to Google's limit - a title over the cap is a disapproval,
 *  the same reason `description` is bounded below. */
const MAX_TITLE = 150;

/**
 * Clamp a feed title to Google's 150-character limit at a WORD boundary, so a
 * long role name is trimmed rather than sliced mid-word. Appending the option
 * value (" - S \u00b7 Military Green") after the clamp keeps a variant's option
 * distinction, which Google needs to tell the options of one product apart.
 */
function clampFeedTitle(name: string, suffix: string): string {
  const base = String(name ?? "").trim();
  if (base.length + suffix.length <= MAX_TITLE) return base + suffix;
  const room = MAX_TITLE - suffix.length;
  if (room <= 0) return base.slice(0, MAX_TITLE).trim();
  const cut = base.slice(0, room);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim().replace(/[\s,;:\/\u00b7-]+$/, "");
  return (trimmed || base.slice(0, room)).trim() + suffix;
}

/** Google caps `item_group_id` at 50 characters (the `id` cap is the same). The
 *  catalogue's slugs are written for the STOREFRONT, where a long descriptive
 *  slug is good for SEO - 63 of the 98 are longer than 50, the longest 78 - so a
 *  slug used verbatim as the group id is rejected as "Text too long
 *  [item_group_id]" and the item is never approved. The value is therefore
 *  CLAMPED here rather than the slugs being shortened: a slug is a permanent
 *  public URL, and rewriting 63 of them would break every link already indexed. */
export const MAX_ITEM_GROUP_ID = 50;

/**
 * The `g:item_group_id` for a multi-option product: its slug, clamped to
 * Google's 50-character ceiling.
 *
 * Clamping happens on a HYPHEN boundary - at the last `-` inside the limit - so
 * the id stays a readable word list rather than an arbitrary sliced prefix (the
 * value allows alphanumerics, underscores and dashes, so a trailing `-` is
 * trimmed too). Only the group id is shortened; `link` and `id` are untouched,
 * so the item still points at the real product URL and ASIN-style SKU.
 *
 * Every variant of one product maps to the SAME slug, so the clamp is applied to
 * the shared slug and cannot split a product's options across two groups. The
 * catalogue was checked to be collision-free under this clamp (no two slugs share
 * a 50-character truncation), which is why no hash suffix is needed.
 */
export function itemGroupIdFor(slug: string): string {
  const value = String(slug ?? "").trim();
  if (value.length <= MAX_ITEM_GROUP_ID) return value;
  const cut = value.slice(0, MAX_ITEM_GROUP_ID);
  const boundary = cut.lastIndexOf("-");
  const clamped = (boundary > 0 ? cut.slice(0, boundary) : cut).replace(/[\s-]+$/, "");
  return clamped || cut.replace(/[\s-]+$/, "");
}

/** `"Pet Chew Toys"` -> `"Pet Toys > Pet Chew Toys"`, or the bare name when the
 *  category is top-level. This is our own browse taxonomy, which is exactly what
 *  `g:product_type` is for. */
function productTypeFor(category: string): string {
  const name = String(category ?? "").trim();
  if (!name) return "";
  const parent = categoryParent(name);
  return parent ? `${parent} > ${name}` : name;
}

/**
 * Map the catalogue onto feed items.
 *
 * ONE ITEM PER SELLABLE OPTION. A product with several options becomes several
 * items sharing an `item_group_id`, which is how Google renders one listing with
 * a variant chooser instead of unrelated products. A single-option product is
 * one item with no group id.
 */
export function buildMerchantFeedItems(
  products: readonly MerchantFeedSourceProduct[],
): MerchantFeedItem[] {
  const items: MerchantFeedItem[] = [];
  for (const p of products) {
    if (!p || !p.slug) continue;
    // A gallery image that may not be advertised is DROPPED here rather than
    // shipped. Google's "Promotional overlay on image" policy takes the whole
    // item out of the feed, so an image with burned-in promotional text is
    // worse than no image at all - and the product's other shots are still
    // there. See shared/merchant-image-policy.ts.
    const images = (p.images ?? []).filter(
      (u) => typeof u === "string" && u.length > 0 && !isNonCompliantImage(u),
    );
    const sellable = (p.variants ?? []).filter((v) => v && v.active !== false);
    // A product with no options still needs one item, keyed on its own slug - a
    // product silently absent from the feed is a product Google cannot show.
    const variants: MerchantFeedSourceVariant[] = sellable.length
      ? sellable
      : [
          {
            sku: p.slug,
            name: "",
            priceCents: p.priceCents,
            inventoryQty: 0,
            imageUrl: null,
          },
        ];
    const multi = variants.length > 1;
    const link = `${STORE_URL}/product/${p.slug}`;
    // The description carries supplier mentions in the raw catalogue; the feed is
    // a public document, so it goes out through the SAME guard the storefront
    // uses rather than trusting the upstream copy.
    const description = sanitizeProductCopy(p.description).slice(0, MAX_DESCRIPTION);
    const productType = productTypeFor(p.category);

    for (const v of variants) {
      // The variant's own photograph is the primary shot, because it is the one
      // that shows the option the shopper actually picked - but only when it may
      // be advertised. A variant photo with burned-in promotional text is
      // treated as no photo at all, so the item falls back to the product's own
      // clean gallery shot instead of being disapproved.
      const variantImage =
        typeof v.imageUrl === "string" && v.imageUrl && !isNonCompliantImage(v.imageUrl)
          ? v.imageUrl
          : null;
      const primary = variantImage ?? images[0] ?? "";
      // A feed item with no image is rejected, so an imageless row is skipped
      // rather than shipped broken.
      if (!primary) continue;
      const additional = images.filter((u) => u !== primary).slice(0, MAX_ADDITIONAL_IMAGES);

      const variantPrice = Number(v.priceCents) > 0 ? Number(v.priceCents) : p.priceCents;
      const compareAt = typeof p.compareAtCents === "number" ? p.compareAtCents : null;
      const onSale = compareAt !== null && compareAt > variantPrice;

      // Google's 150-character limit applies to the WHOLE title, variant suffix
      // included, so the label goes through the clamp rather than being appended
      // after it (see clampFeedTitle).
      const title = clampFeedTitle(p.name, multi && v.name ? ` - ${v.name}` : "");

      items.push({
        id: v.sku,
        title,
        description,
        link,
        imageLink: primary,
        additionalImageLinks: additional,
        // The page strikes through the compare-at and shows the current price, so
        // the feed states the same pair: `price` is the "was", `sale_price` the now.
        priceCents: onSale ? (compareAt as number) : variantPrice,
        salePriceCents: onSale ? variantPrice : null,
        availability: availabilityFor(v.inventoryQty),
        condition: "new",
        brand: STORE_NAME,
        identifierExists: false,
        productType,
        itemGroupId: multi ? itemGroupIdFor(p.slug) : null,
        returnPolicyLabel: MERCHANT_FEED_RETURNS.label,
      });
    }
  }
  return items;
}

/** Render one optional element, or nothing at all when the value is absent. */
function tag(name: string, value: string): string {
  return `      <${name}>${escapeXml(value)}</${name}>`;
}

/** Render one `<item>`. */
export function renderFeedItem(item: MerchantFeedItem): string {
  const lines: string[] = ["    <item>"];
  // Attribute ORDER and NAMES mirror Google's Merchant Center feed template
  // ("Google Merchant Center feed - Products source") column for column:
  //   id, title, description, availability, link, image_link, price, sale_price,
  //   identifier_exists, brand, additional_image_link, condition, item_group_id.
  // title / description / link ARE also RSS 2.0's own predefined item elements,
  // but the template carries them inside the `g:` namespace (`<g:title>`,
  // `<g:description>`, `<g:link>`), and the spec is explicit that "attributes in
  // the Google Merchant Center namespace must include this prefix or the
  // attributes and any values they contain will be ignored" - so the prefixed
  // form is the one a namespace-aware parser cannot drop. Emitting bare RSS
  // elements here put three of the seven required attributes outside the template.
  lines.push(tag("g:id", item.id));
  lines.push(tag("g:title", item.title));
  lines.push(tag("g:description", item.description));
  lines.push(tag("g:availability", item.availability));
  lines.push(tag("g:link", item.link));
  lines.push(tag("g:image_link", item.imageLink));
  // `price` is always the regular price; `sale_price` follows only when the item
  // is genuinely discounted, never as a duplicate of `price`.
  lines.push(tag("g:price", formatFeedPrice(item.priceCents)));
  if (item.salePriceCents !== null) {
    lines.push(tag("g:sale_price", formatFeedPrice(item.salePriceCents)));
  }
  lines.push(tag("g:identifier_exists", item.identifierExists ? "yes" : "no"));
  lines.push(tag("g:brand", item.brand));
  for (const extra of item.additionalImageLinks) {
    lines.push(tag("g:additional_image_link", extra));
  }
  lines.push(tag("g:condition", item.condition));
  if (item.itemGroupId) lines.push(tag("g:item_group_id", item.itemGroupId));
  // Every remaining template column (availability_date, expiration_date,
  // mobile_link, gtin, mpn, product_highlight, product_detail, color, size,
  // gender, item_group_id's siblings, video_link, ... ) is OPTIONAL for these
  // products and is omitted rather than sent empty - an empty attribute is
  // itself a feed error. `product_type` and `return_policy_label` are NOT
  // template columns, so they are no longer emitted even though the catalogue
  // still carries them (see MerchantFeedItem.productType / .returnPolicyLabel).
  // Shipping is per item because Google reads it there. The flat rate is the
  // store's only shipping charge (there is no free-shipping threshold), so every
  // marketable item quotes the same figure the checkout does.
  lines.push("      <g:shipping>");
  lines.push(tag("g:country", MERCHANT_FEED_SHIPPING.country));
  lines.push(tag("g:service", MERCHANT_FEED_SHIPPING.service));
  lines.push(tag("g:price", formatFeedPrice(MERCHANT_FEED_SHIPPING.priceCents)));
  lines.push("      </g:shipping>");
  lines.push("    </item>");
  return lines.join("\n");
}

/**
 * A valid RSS feed with NO items - what a non-production host advertises.
 *
 * It is a real, parseable document, so a crawler that ignores the host gate still
 * learns nothing: an empty feed de-lists nothing and leaks no price, no SKU and
 * no product. Serving a 404 or invalid XML instead would make Merchant Center
 * report a fetch error; an empty feed is the quiet, correct answer.
 */
export const EMPTY_MERCHANT_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="${GOOGLE_MERCHANT_NS}">
  <channel>
    <title>${STORE_NAME}</title>
    <link>${STORE_URL}</link>
    <description>${STORE_NAME} product feed</description>
  </channel>
</rss>
`;

/**
 * The feed body for a request host.
 *
 * PRODUCTION (`isProductionHost`) gets the real item list. Every other host - a
 * `*.vercel.app` preview, localhost, an unknown value - gets the empty feed, so
 * a preview deployment can never advertise the live store's prices, stock or
 * SKUs to Google. This is the SAME gate `/robots.txt` and `/sitemap.xml` use.
 */
export function merchantFeedXml(
  host: string | null | undefined,
  items: readonly MerchantFeedItem[],
  isProductionHost: (host: string | null | undefined) => boolean,
): string {
  if (!isProductionHost(host)) return EMPTY_MERCHANT_FEED;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="${GOOGLE_MERCHANT_NS}">
  <channel>
    <title>${STORE_NAME}</title>
    <link>${STORE_URL}</link>
    <description>${STORE_NAME} product feed</description>
${items.map(renderFeedItem).join("\n")}
  </channel>
</rss>
`;
}

/**
 * The response headers for the feed.
 *
 * `application/xml` is what a fetcher expects. `no-store` keeps the
 * host-specific body out of any shared cache: the SAME URL answers differently
 * per host, so a cached copy could hand a preview's empty feed to the production
 * store - or, worse, the production feed (every price and stock count) to a
 * preview.
 */
export function merchantFeedHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store",
  };
}

/** Where Merchant Center should fetch the feed. A single absolute URL is what a
 *  scheduled fetch is registered against. */
export const MERCHANT_FEED_PATH = "/google-merchant-feed.xml";
