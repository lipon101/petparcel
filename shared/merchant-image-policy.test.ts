// Guards the images that may NEVER be advertised to Google Merchant Center.
//
// WHY THIS SUITE EXISTS. Google rejects a product image that carries burned-in
// promotional text, a watermark, a logo or a border, and it takes the WHOLE
// item out of the feed: the item shows as "Not approved" and the shopper never
// sees it. That is exactly what happened to the "Cute Fruit Dog Clothes" hoodie
// (item CJGD117239420TG, Style 4 - S), whose variant photo is a 2x2 collage
// with Korean promotional captions burned into three of the four panels.
//
// The list in shared/merchant-image-policy.ts is therefore pinned here, together
// with the two things that could quietly put the image back: the shipped variant
// image map (which a fresh database is seeded from) and the committed feed
// (which is what the storefront advertises when the catalogue cannot be read).
import { describe, expect, it } from "vitest";
import {
  NON_COMPLIANT_IMAGES,
  isNonCompliantImage,
  isNonCompliantVariantSku,
  nonCompliantImage,
} from "./merchant-image-policy";import { VARIANT_IMAGE_BY_SKU } from "./variant-images-data";
import { MERCHANT_FEED_ITEMS } from "../server/_core/merchant-feed-data";

describe("the list of images that may not be advertised", () => {
  it("is not empty - a policy that lists nothing protects nothing", () => {
    expect(NON_COMPLIANT_IMAGES.length).toBeGreaterThan(0);
  });

  it("gives every entry a key, a reason and the option it belongs to", () => {
    for (const entry of NON_COMPLIANT_IMAGES) {
      expect(entry.key).toMatch(/^[a-f0-9]{16,}$/);
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(entry.skus.length).toBeGreaterThan(0);
      for (const sku of entry.skus) {
        expect(sku.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("has no duplicate keys", () => {
    const keys = NON_COMPLIANT_IMAGES.map((e) => e.key.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("isNonCompliantImage", () => {
  const blocked = NON_COMPLIANT_IMAGES[0].key;

  it("recognises the blocked image by its full URL", () => {
    expect(
      isNonCompliantImage(`https://media.petparcel.store/products/variants/${blocked}.webp`),
    ).toBe(true);
  });

  it("recognises it by a path, a bare key, or a URL with a query string", () => {
    expect(isNonCompliantImage(`/products/variants/${blocked}.webp`)).toBe(true);
    expect(isNonCompliantImage(blocked)).toBe(true);
    expect(isNonCompliantImage(`${blocked}.webp`)).toBe(true);
    expect(isNonCompliantImage(`https://media.petparcel.store/products/variants/${blocked}.webp?v=2`)).toBe(
      true,
    );
  });

  it("is case-insensitive about the key", () => {
    expect(isNonCompliantImage(`https://media.petparcel.store/products/variants/${blocked.toUpperCase()}.webp`)).toBe(
      true,
    );
  });

  it("leaves a normal product image alone", () => {
    expect(
      isNonCompliantImage("https://media.petparcel.store/products/17990b2601548ecca52e.webp"),
    ).toBe(false);
    expect(isNonCompliantImage("https://media.petparcel.store/products/variants/95605072eebc14e30d66.webp")).toBe(
      false,
    );
  });

  it("treats an empty or absent url as advertisable", () => {
    expect(isNonCompliantImage("")).toBe(false);
    expect(isNonCompliantImage(null)).toBe(false);
    expect(isNonCompliantImage(undefined)).toBe(false);
  });

  it("reports WHY an image is blocked", () => {
    const entry = nonCompliantImage(
      `https://media.petparcel.store/products/variants/${blocked}.webp`,
    );
    expect(entry).not.toBeNull();
    expect(entry?.key).toBe(blocked);
    expect(entry?.reason.length).toBeGreaterThan(20);
  });
});

describe("isNonCompliantVariantSku", () => {
  it("recognises the option whose own photograph is blocked", () => {
    const sku = NON_COMPLIANT_IMAGES[0].skus[0];
    expect(isNonCompliantVariantSku(sku)).toBe(true);
    expect(isNonCompliantVariantSku(sku.toLowerCase())).toBe(true);
  });

  it("leaves every other option alone", () => {
    expect(isNonCompliantVariantSku("CJGD117239401AZ")).toBe(false);
    expect(isNonCompliantVariantSku("CJGD117239418RI")).toBe(false);
    expect(isNonCompliantVariantSku("")).toBe(false);
    expect(isNonCompliantVariantSku(null)).toBe(false);
  });
});

describe("the shipped variant image map", () => {
  it("carries no image that is bad everywhere", () => {
    // The map seeds a FRESH database, so a picture that is bad everywhere - a
    // collage of the product with captions burned over it - must not be in it:
    // the shopper is better served by the product's other photographs. A picture
    // that is only barred from ADVERTISING (the supplier's colour cards) stays,
    // because the storefront shows the shopper the option they picked.
    for (const [sku, url] of Object.entries(VARIANT_IMAGE_BY_SKU)) {
      const entry = nonCompliantImage(url);
      expect(entry?.showInStore ?? true, `${sku} -> ${url}`).toBe(true);
    }
  });

  it("no longer ships the photo of the option Google rejected", () => {
    // The hoodie's Korean-caption collage: not on the storefront, not in the feed.
    for (const entry of NON_COMPLIANT_IMAGES) {
      if (entry.showInStore) continue;
      for (const sku of entry.skus) {
        expect(VARIANT_IMAGE_BY_SKU[sku]).toBeUndefined();
      }
    }
  });

  it("keeps the honest photographs the storefront shows", () => {
    // The cat toy's colour cards are real pictures of the right option, so the
    // shopper still gets them; only the FEED is barred from advertising them.
    const storeable = NON_COMPLIANT_IMAGES.filter((e) => e.showInStore);
    expect(storeable.length).toBeGreaterThan(0);
    for (const entry of storeable) {
      expect(VARIANT_IMAGE_BY_SKU[entry.skus[0]]).toContain(entry.key);
    }
  });
});

describe("the committed Merchant Center feed", () => {
  it("advertises no image that may not be advertised", () => {
    // The committed module is what the storefront serves when the catalogue
    // cannot be read, so a blocked photo left in it would still be handed to
    // Google - and the item would still never approve.
    for (const item of MERCHANT_FEED_ITEMS) {
      expect(isNonCompliantImage(item.imageLink), `${item.id} image_link`).toBe(false);
      for (const extra of item.additionalImageLinks) {
        expect(isNonCompliantImage(extra), `${item.id} additional_image_link`).toBe(false);
      }
    }
  });

  it("still gives the affected option a primary shot and a clean gallery", () => {
    // Removing a bad image must not leave the item with NO image - an item
    // without an image is rejected just as surely. The option falls back to the
    // product's own clean shots.
    for (const entry of NON_COMPLIANT_IMAGES) {
      for (const sku of entry.skus) {
        const item = MERCHANT_FEED_ITEMS.find((i) => i.id === sku);
        expect(item, `${sku} is missing from the feed`).toBeDefined();
        expect(item?.imageLink.startsWith("https://")).toBe(true);
        expect(isNonCompliantImage(item?.imageLink)).toBe(false);
      }
    }
  });
});
