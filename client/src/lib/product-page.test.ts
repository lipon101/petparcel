// Guards the product page's hardest rule: nothing on it may be invented.
//
// Two bundled-catalog traps this locks down, both of which shipped live before:
//
//  1. The bundled catalog carried a fixed epoch as created_at, so the bundle
//     claimed every product was brand new forever and the NEW badge never
//     expired.
//  2. The catalog hooks seeded React Query with bundled rows as `initialData`
//     and held them behind a `staleTime` window, so a product the API reports as
//     having no reviews rendered with bundled reviews and a bundled rating.
//     Reviews must come from live rows only.
import { describe, expect, it } from "vitest";
import {
  GALLERY_SIZE,
  oneLineSummary,
  productShippingLine,
  productTrustStrip,
  roundelImages,
} from "@shared/store";
import { CATALOG_DATA, CATALOG_SEEDED_AT } from "@shared/catalog-data";
import { PRODUCT_SPECS } from "@shared/product-specs";

describe("bundled catalog carries honest data", () => {
  it("has a real change date on every product, not a fixed epoch", () => {
    expect(CATALOG_SEEDED_AT).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const dated = CATALOG_DATA.filter((p) => p.seededAt === CATALOG_SEEDED_AT);
    expect(dated.length).toBe(CATALOG_DATA.length);
    // A product dated in the future would make the NEW badge meaningless.
    expect(new Date(CATALOG_SEEDED_AT).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("gives every product real specs for the Product Details tab", () => {
    const missing = CATALOG_DATA.filter((p) => Object.keys(PRODUCT_SPECS[p.slug] ?? {}).length === 0);
    expect(missing.map((p) => p.slug)).toEqual([]);
  });

  it("ships no bundled reviews, so the bundle can never fake a rating", () => {
    // With zero bundled reviews, a page rendering from the bundle shows the
    // confident empty state rather than an invented score. Real reviews arrive
    // from the API and are approved-only.
    const withReviews = CATALOG_DATA.filter((p) => p.reviews.length > 0);
    expect(withReviews).toEqual([]);
  });
});

describe("oneLineSummary", () => {
  it("cuts at the first sentence and never mid-word", () => {
    expect(oneLineSummary("First one here. Second one there.")).toBe("First one here.");
  });

  it("falls back to the whole string when there is no sentence break", () => {
    expect(oneLineSummary("No full stop at all")).toBe("No full stop at all");
  });

  it("truncates long copy with an ellipsis rather than trailing off", () => {
    const out = oneLineSummary("x".repeat(400) + ". More.");
    expect(out.length).toBeLessThanOrEqual(180);
    expect(out.endsWith("...")).toBe(true);
  });

  it("returns an empty string for empty input", () => {
    expect(oneLineSummary("   ")).toBe("");
  });
});

describe("the gallery rail's size", () => {
  it("is the number of tiles the rail shows at least", () => {
    // The tiles themselves are built by `buildGalleryTiles` (see
    // client/src/lib/gallery-tiles.test.ts): every real shot the product has,
    // the picked option's own photograph first.
    expect(GALLERY_SIZE).toBe(5);
  });
});

describe("productTrustStrip reflects the live store policy", () => {
  it("quotes the real flat rate when there is no free-shipping tier", () => {
    const strip = productTrustStrip({
      free_shipping_threshold_cents: 0,
      shipping_flat_cents: 599,
      return_window_days: 30,
      shipping_estimate: "2-5 business days",
    });
    // threshold 0 = no free tier, so the flat rate is what we state - never "free".
    expect(strip.find((i) => i.key === "shipping")?.body).toContain("$5.99");
    expect(strip.find((i) => i.key === "shipping")?.body).not.toContain("Free");
  });

  it("states the free-over threshold when the store has one", () => {
    const strip = productTrustStrip({
      free_shipping_threshold_cents: 5000,
      shipping_flat_cents: 599,
      return_window_days: 30,
      shipping_estimate: "2-5 business days",
    });
    expect(strip.find((i) => i.key === "shipping")?.body).toContain("$50.00");
  });

  it("quotes the real return window", () => {
    const strip = productTrustStrip({
      free_shipping_threshold_cents: 0,
      shipping_flat_cents: 0,
      return_window_days: 45,
      shipping_estimate: "2-5 business days",
    });
    expect(strip.find((i) => i.key === "returns")?.body).toContain("45 days");
  });

  it("always has the four promises in order", () => {
    const strip = productTrustStrip({
      free_shipping_threshold_cents: 0,
      shipping_flat_cents: 0,
      return_window_days: 30,
      shipping_estimate: "2-5 business days",
    });
    expect(strip.map((i) => i.title)).toEqual([
      "Tracked Shipping",
      "Secure Payment",
      "Easy Returns",
      "Careful Packaging",
    ]);
  });
});

describe("productShippingLine never contradicts what checkout charges", () => {
  // The live bug this guards: threshold 0 (NO free tier) was read as "free
  // shipping on every order" on the product page while checkout charged the
  // flat rate. Every surface must derive its sentence from this one helper.
  it("states the flat rate - never 'free' - when there is no free-shipping tier", () => {
    const line = productShippingLine({
      free_shipping_threshold_cents: 0,
      shipping_flat_cents: 599,
    });
    expect(line).toContain("$5.99");
    expect(line.toLowerCase()).not.toContain("free shipping");
  });

  it("states the real threshold when the store has a free-over tier", () => {
    const line = productShippingLine({
      free_shipping_threshold_cents: 5000,
      shipping_flat_cents: 599,
    });
    expect(line).toContain("over $50.00");
  });

  it("agrees with the trust strip for the same settings", () => {
    for (const free of [0, 5000]) {
      const settings = {
        free_shipping_threshold_cents: free,
        shipping_flat_cents: 599,
        return_window_days: 30,
        shipping_estimate: "Fast, tracked delivery",
      };
      const line = productShippingLine(settings);
      const strip = productTrustStrip(settings).find((i) => i.key === "shipping")?.body ?? "";
      // Both surfaces quote the same money for the same configuration.
      expect(line.includes("$5.99")).toBe(strip.includes("$5.99"));
      expect(line.includes("$50.00")).toBe(strip.includes("$50.00"));
    }
  });
});

describe("the bundled catalog dates match the seeded products table", () => {
  it("is older than the new-product window, so the first paint shows no false NEW badge", () => {
    // Every seeded product carries the same createdAt as the products table, so
    // none of them is "new" and the page must not claim otherwise. A bundle date
    // later than the database's would flash a NEW badge on the first paint,
    // before the API answer replaces the bundled rows.
    const seeded = new Date(CATALOG_SEEDED_AT).getTime();
    const ageDays = (Date.now() - seeded) / 86_400_000;
    expect(Number.isFinite(seeded)).toBe(true);
    expect(ageDays).toBeGreaterThan(30);
  });
});

describe("roundelImages picks one distinct real photo per aisle", () => {
  const products = [
    { category: "Toys", images: ["/cattoy.jpg"] },
    { category: "Food & Treats", images: ["/cattoy.jpg"] },
    { category: "Training", images: ["/puzzletoy.jpg"] },
    { category: "Birds", images: ["/slowbowl.jpg"] },
    { category: "Litter & Litter Boxes", images: ["/litterbox.jpg"] },
  ];

  it("never assigns one photo to two aisles", () => {
    const out = roundelImages(
      ["Toys", "Food & Treats", "Training", "Birds", "Litter & Litter Boxes"],
      products,
    );
    const used = Object.values(out);
    expect(new Set(used).size).toBe(used.length);
  });

  it("leaves a photo-less aisle out so it falls back to its icon", () => {
    const out = roundelImages(["Toys", "Food & Treats", "Birds"], products);
    // Food & Treats' only photo belongs to Toys, which is ranked first.
    expect(out.Toys).toBe("/cattoy.jpg");
    expect(out["Food & Treats"]).toBeUndefined();
    expect(out.Birds).toBe("/slowbowl.jpg");
  });

  it("only ever returns a photo a product actually carries", () => {
    const known = new Set(products.flatMap((p) => p.images));
    const out = roundelImages(["Toys", "Training", "Birds"], products);
    expect(Object.values(out).every((src) => known.has(src))).toBe(true);
  });

  it("gives every ranked aisle a distinct photo when each owns one", () => {
    const own = [
      { category: "Dogs", images: ["/harness.jpg"] },
      { category: "Cats", images: ["/cattoy.jpg"] },
      { category: "Apparel", images: ["/raincoat.jpg"] },
    ];
    const out = roundelImages(["Dogs", "Cats", "Apparel"], own);
    expect(out).toEqual({
      Dogs: "/harness.jpg",
      Cats: "/cattoy.jpg",
      Apparel: "/raincoat.jpg",
    });
  });
});

describe("store copy keeps the house rules", () => {
  const strings = [
    ...CATALOG_DATA.flatMap((p) => [p.name, p.description, p.category, ...p.tags]),
    ...productTrustStrip({
      free_shipping_threshold_cents: 0,
      shipping_flat_cents: 0,
      return_window_days: 30,
      shipping_estimate: "2-5 business days",
    }).flatMap((i) => [i.title, i.body]),
  ];

  it("contains no em dash or en dash", () => {
    const bad = strings.filter((s) => /[\u2014\u2013]/.test(s));
    expect(bad).toEqual([]);
  });
});

