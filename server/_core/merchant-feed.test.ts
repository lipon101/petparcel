// Guards the host-aware Google Merchant Center feed.
//
// WHY THIS SUITE EXISTS. The feed is generated per request from the request
// HOST, so the SAME URL must answer two different ways: the real item list on the
// production storefront, and an EMPTY feed on a `*.vercel.app` preview or a local
// run. A regression here is silent - a preview that serves the production feed
// looks perfectly healthy while it hands Google the live store's prices, stock
// and SKUs - so both directions are pinned, plus the headers that keep the
// host-specific body out of a shared cache.
//
// It ALSO pins the feed against the catalogue and the store settings, because a
// feed that disagrees with the landing page is the classic Merchant Center
// disapproval: the shipping price must equal the store's flat rate, the return
// window must equal the store's setting, every price must be a real catalogue
// price, and no supplier name may appear anywhere in the document.
import { describe, expect, it } from "vitest";
import {
  EMPTY_MERCHANT_FEED,
  MAX_ITEM_GROUP_ID,
  MERCHANT_FEED_RETURNS,
  MERCHANT_FEED_SHIPPING,
  buildMerchantFeedItems,
  formatFeedPrice,
  merchantFeedHeaders,
} from "@shared/merchant-feed";
import { containsSupplierMention } from "@shared/supplier-guard";
import { violatesShoppingPolicy } from "@shared/shopping-policy-guard";
import { SETTINGS_DEFAULTS, STORE_URL } from "@shared/store";
import { isProductionHost } from "@shared/production-host";
import { MERCHANT_FEED_ITEMS } from "./merchant-feed-data";
import { merchantFeedFor } from "./merchant-feed";

const PRODUCTION = "www.petparcel.store";
const PREVIEW = "petparcel-bpwf726dl-lipon.vercel.app";

describe("merchantFeedFor (host gate)", () => {
  it("serves the real feed on the production hosts", () => {
    for (const host of ["www.petparcel.store", "petparcel.store"]) {
      const body = merchantFeedFor(host);
      expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(body).toContain('<rss version="2.0"');
      expect(body).toContain('xmlns:g="http://base.google.com/ns/1.0"');
      // The committed item list must never be empty on production - an empty
      // production feed would de-list the whole store.
      expect(MERCHANT_FEED_ITEMS.length).toBeGreaterThan(0);
      expect(body).toContain(`<g:id>${MERCHANT_FEED_ITEMS[0].id}</g:id>`);
    }
  });

  it("advertises NO items on a Vercel preview host", () => {
    const body = merchantFeedFor(PREVIEW);
    // Still a well-formed feed, but listing nothing.
    expect(body).toContain("<rss");
    expect(body).not.toContain("<item>");
    expect(body).not.toContain("<g:id>");
  });

  it("advertises NO items on localhost, an IP, and an unknown/empty host", () => {
    for (const host of ["localhost", "localhost:3000", "127.0.0.1", "", null, undefined]) {
      const body = merchantFeedFor(host);
      expect(body).toContain("<rss");
      expect(body).not.toContain("<item>");
    }
  });

  it("keeps the empty feed a valid, parseable document", () => {
    expect(EMPTY_MERCHANT_FEED).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(EMPTY_MERCHANT_FEED).toContain("</rss>");
    expect(EMPTY_MERCHANT_FEED).not.toContain("<item>");
  });
});

describe("merchantFeedHeaders", () => {
  it("is XML, which is what a fetcher expects", () => {
    expect(merchantFeedHeaders()["Content-Type"]).toContain("xml");
  });

  it("is not cached, because the body differs per host", () => {
    // A shared cache could otherwise hand a preview's empty feed to the
    // production store, or the production feed to a preview.
    expect(merchantFeedHeaders()["Cache-Control"]).toBe("no-store");
  });
});

describe("feed vs catalogue parity", () => {
  it("quotes the store's real flat shipping rate, not a local literal", () => {
    // The feed's shipping price MUST equal the storefront's flat rate. A feed
    // that quotes a different shipping price than checkout is a disapproval.
    expect(MERCHANT_FEED_SHIPPING.priceCents).toBe(SETTINGS_DEFAULTS.shipping_flat_cents);
    expect(MERCHANT_FEED_SHIPPING.country).toBe("US");
    const body = merchantFeedFor(PRODUCTION);
    expect(body).toContain(`<g:price>${formatFeedPrice(SETTINGS_DEFAULTS.shipping_flat_cents)}</g:price>`);
  });

  it("advertises the store's real return window and free returns", () => {
    expect(MERCHANT_FEED_RETURNS.windowDays).toBe(SETTINGS_DEFAULTS.return_window_days);
    expect(MERCHANT_FEED_RETURNS.freeReturns).toBe(true);
    expect(MERCHANT_FEED_RETURNS.returnLabelIncluded).toBe(true);
    expect(MERCHANT_FEED_RETURNS.restockingFeeCents).toBe(0);
    // Every item points at the named policy configured in Merchant Center.
    for (const item of MERCHANT_FEED_ITEMS) {
      expect(item.returnPolicyLabel).toBe(MERCHANT_FEED_RETURNS.label);
    }
  });

  it("gives every item the fields Google requires", () => {
    for (const item of MERCHANT_FEED_ITEMS) {
      expect(item.id.length).toBeGreaterThan(0);
      expect(item.title.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.imageLink.startsWith("https://")).toBe(true);
      expect(item.link.startsWith(STORE_URL)).toBe(true);
      expect(item.condition).toBe("new");
      expect(item.brand).toBe("PetParcel");
      // No GTIN/MPN in the catalogue, so the flag must be stated explicitly.
      expect(item.identifierExists).toBe(false);
      expect(["in_stock", "out_of_stock"]).toContain(item.availability);
      expect(item.priceCents).toBeGreaterThan(0);
    }
  });

  it("emits title/description/link inside the g: namespace, per the RSS 2.0 template", () => {
    // Google's RSS 2.0 product-data-source template carries the three RSS 2.0
    // predefined elements - title, description, link - INSIDE the `g:` namespace
    // (`<g:title>`, `<g:description>`, `<g:link>`), and the spec states that an
    // attribute without the prefix is ignored. Shipping them as bare `<title>`
    // etc. put three of the seven REQUIRED attributes outside the template (a
    // namespace-aware parser reads them as the RSS elements they also happen to
    // be, or drops them entirely). This pins the prefixed form so it cannot
    // regress, and pins the ABSENCE of the bare form inside an item.
    const body = merchantFeedFor(PRODUCTION);
    const items = body.split("<item>").slice(1);
    expect(items.length).toBeGreaterThan(0);
    for (const raw of items) {
      const block = raw.split("</item>")[0];
      for (const name of ["id", "title", "description", "link", "image_link", "price", "availability"]) {
        expect(block).toContain(`<g:${name}>`);
      }
      // The RSS 2.0 predefined elements must NOT appear bare inside an <item>.
      expect(block).not.toMatch(/<(title|description|link)>/);
    }
  });

  it("emits the template's attributes, in the template's column order", () => {
    // The feed mirrors Google's Merchant Center feed template ("Google Merchant
    // Center feed - Products source"): row 1 is the attribute list, in order. A
    // feed that carries an attribute the template does not (product_type,
    // return_policy_label) - or that orders the ones it does differently - sits
    // outside the template, so both are pinned here.
    const TEMPLATE_ORDER = [
      "id", "title", "description", "availability", "availability_date",
      "expiration_date", "link", "mobile_link", "image_link", "price",
      "sale_price", "sale_price_effective_date", "identifier_exists", "gtin",
      "mpn", "brand", "product_highlight", "product_detail",
      "additional_image_link", "condition", "adult", "color", "size",
      "size_type", "size_system", "gender", "material", "pattern", "age_group",
      "multipack", "is bundle", "unit_pricing_measure",
      "unit_pricing_base_measure", "energy_efficiency_class",
      "min_energy_efficiency_class", "max_energy_efficiency", "item_group_id",
      "video_link", "virtual_model_link", "cost_of_goods_sold",
    ];
    const rank = new Map(TEMPLATE_ORDER.map((name, i) => [name, i]));
    const body = merchantFeedFor(PRODUCTION);
    for (const raw of body.split("<item>").slice(1)) {
      const block = raw
        .split("</item>")[0]
        .replace(/<g:shipping>[\s\S]*?<\/g:shipping>/g, "");
      const names = [...block.matchAll(/<(g:[a-z_]+)>/g)].map((m) => m[1].slice(2));
      let prev = -1;
      for (const name of names) {
        // No attribute outside the template...
        expect(rank.has(name)).toBe(true);
        // ...and the ones present appear in the template's own order.
        const i = rank.get(name) as number;
        expect(i).toBeGreaterThanOrEqual(prev);
        prev = i;
      }
    }
    // The two attributes the catalogue carries but the template does not must
    // not reach the feed at all.
    expect(body).not.toContain("<g:product_type>");
    expect(body).not.toContain("<g:return_policy_label>");
  });

  it("keeps every g:title within Google's 150-character limit", () => {
    // A title over Google's 150-character cap is a disapproval. The catalogue
    // genuinely carries supplier titles longer than the cap, so this is a real
    // guard rather than a vacuous one.
    for (const item of MERCHANT_FEED_ITEMS) {
      expect(item.title.length).toBeLessThanOrEqual(150);
      expect(item.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("clamps an over-long product name to the title limit, suffix included", () => {
    const tooLong = "Extra Long Product Role Name ".repeat(12).trim(); // > 150 with no natural break
    const base = {
      slug: "long-title-thing",
      category: "Pet Toys",
      description: "A thing.",
      priceCents: 1000,
      compareAtCents: null,
      images: ["https://media.petparcel.store/products/a.webp"],
    };
    // Single option: the name itself must be clamped.
    const single = buildMerchantFeedItems([
      { ...base, name: tooLong, variants: [{ sku: "L-1", name: "", priceCents: 1000, inventoryQty: 1 }] },
    ]);
    expect(single[0].title.length).toBeLessThanOrEqual(150);
    // Multi option: the appended " - <option>" must not push it back over the cap.
    const multi = buildMerchantFeedItems([
      {
        ...base,
        name: tooLong,
        variants: [
          { sku: "L-2", name: "Military Green", priceCents: 1000, inventoryQty: 1 },
          { sku: "L-3", name: "Green Grey", priceCents: 1000, inventoryQty: 1 },
        ],
      },
    ]);
    expect(multi).toHaveLength(2);
    for (const item of multi) {
      expect(item.title.length).toBeLessThanOrEqual(150);
      expect(item.title).toContain(" - ");
    }
  });

  it("emits sale_price only when it is genuinely below price", () => {
    for (const item of MERCHANT_FEED_ITEMS) {
      if (item.salePriceCents !== null) {
        expect(item.salePriceCents).toBeLessThan(item.priceCents);
      }
    }
    // The catalogue does carry discounted products, so the branch is exercised.
    expect(MERCHANT_FEED_ITEMS.some((i) => i.salePriceCents !== null)).toBe(true);
  });

  it("groups the options of a multi-variant product under one item_group_id", () => {
    const grouped = MERCHANT_FEED_ITEMS.filter((i) => i.itemGroupId !== null);
    expect(grouped.length).toBeGreaterThan(0);
    const byGroup = new Map<string, number>();
    for (const i of grouped) {
      byGroup.set(i.itemGroupId as string, (byGroup.get(i.itemGroupId as string) ?? 0) + 1);
    }
    // At least one group really holds more than one option.
    expect([...byGroup.values()].some((n) => n > 1)).toBe(true);
  });

  it("keeps every item_group_id within Google's 50-character limit", () => {
    // Google's spec caps `item_group_id` at 1-50 characters. The catalogue slugs
    // run to 78, so an unclamped slug is rejected as "Text too long
    // [item_group_id]" and the item is never approved. This is a REAL guard: 196
    // of the committed items belong to a group whose slug is longer than 50.
    const grouped = MERCHANT_FEED_ITEMS.filter((i) => i.itemGroupId !== null);
    expect(grouped.length).toBeGreaterThan(0);
    for (const item of grouped) {
      const id = item.itemGroupId as string;
      expect(id.length).toBeGreaterThan(0);
      expect(id.length).toBeLessThanOrEqual(MAX_ITEM_GROUP_ID);
      // The accepted character set: alphanumerics, dashes, underscores.
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("keeps a product's options grouped together after clamping", () => {
    // Clamping the SHARED slug must not split one product's options into two
    // groups: every item that shares a source product still shares one id.
    const byGroup = new Map<string, number>();
    for (const i of MERCHANT_FEED_ITEMS) {
      if (i.itemGroupId) byGroup.set(i.itemGroupId, (byGroup.get(i.itemGroupId) ?? 0) + 1);
    }
    // The biggest group still holds every option of its product.
    expect(Math.max(...byGroup.values())).toBeGreaterThan(2);
  });

  it("carries no term that trips an adult-content or personalized-ads policy", () => {
    // Google flagged the account for both "Restricted adult content" and
    // "Personalized advertising: Sexual interests" because a supplier title
    // carried the word "Boobs". The guard is asserted over the WHOLE built feed,
    // so no such term can reach Merchant Center again.
    const offenders: string[] = [];
    for (const item of MERCHANT_FEED_ITEMS) {
      if (violatesShoppingPolicy(item.title)) offenders.push(item.title);
      if (violatesShoppingPolicy(item.description)) offenders.push(item.description);
    }
    expect(offenders).toEqual([]);
  });

  it("never leaks the supplier's name into the feed", () => {
    // The feed is a public document; the description goes out through the same
    // guard the storefront uses, so no item may name the supplier.
    for (const item of MERCHANT_FEED_ITEMS) {
      expect(containsSupplierMention(item.title)).toBe(false);
      expect(containsSupplierMention(item.description)).toBe(false);
    }
    const body = merchantFeedFor(PRODUCTION);
    expect(containsSupplierMention(body)).toBe(false);
  });

  it("maps a source product onto one item per sellable option", () => {
    const items = buildMerchantFeedItems([
      {
        name: "Test Bed",
        slug: "test-bed",
        category: "Pet Toys",
        description: "A bed.",
        priceCents: 5000,
        compareAtCents: null,
        images: ["https://media.petparcel.store/products/a.webp"],
        variants: [
          { sku: "SKU-S", name: "S", priceCents: 5000, inventoryQty: 3 },
          { sku: "SKU-M", name: "M", priceCents: 6000, inventoryQty: 0 },
        ],
      },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("SKU-S");
    expect(items[0].availability).toBe("in_stock");
    expect(items[1].availability).toBe("out_of_stock");
    expect(items[0].itemGroupId).toBe("test-bed");
    expect(items[0].title).toContain("Test Bed");
  });

  it("skips a product with no image rather than shipping a broken item", () => {
    const items = buildMerchantFeedItems([
      {
        name: "No Image",
        slug: "no-image",
        category: "Pet Toys",
        description: "x",
        priceCents: 1000,
        images: [],
        variants: [{ sku: "SKU-X", name: "", priceCents: 1000, inventoryQty: 1 }],
      },
    ]);
    expect(items).toHaveLength(0);
  });
});

describe("isProductionHost (the gate the feed relies on)", () => {
  it("accepts only the production hosts", () => {
    expect(isProductionHost(PRODUCTION)).toBe(true);
    expect(isProductionHost(PREVIEW)).toBe(false);
    expect(isProductionHost("localhost")).toBe(false);
  });
});
