// Unit tests for the home page promo card logic (shared/promo.ts).
//
// These pin the two things that must never regress: the FALLBACK rule (a card
// fills itself with the best available product rather than breaking when the
// owner's pick is missing, deleted or unpublished) and the COPY rule (the card
// describes the real product's own signals - a genuine markdown or a real
// rating - and never invents one).
import { describe, expect, it } from "vitest";
import {
  discountPercent,
  hasRating,
  pickPromoProduct,
  promoCardCopy,
  promoEyebrow,
  PROMO_SETTING_KEYS,
  type PromoProductLike,
} from "./promo";

const base: PromoProductLike = { name: "Intelligent Litter Box", priceCents: 21900 };

describe("discountPercent", () => {
  it("is null without a compare-at price", () => {
    expect(discountPercent(base)).toBeNull();
  });

  it("is null when the compare-at price is not actually higher", () => {
    expect(discountPercent({ ...base, compareAtCents: 21900 })).toBeNull();
    expect(discountPercent({ ...base, compareAtCents: 19900 })).toBeNull();
  });

  it("rounds a genuine markdown to whole percent", () => {
    expect(discountPercent({ ...base, compareAtCents: 28900 })).toBe(24);
  });
});

describe("hasRating", () => {
  it("is false with no rating or no reviews", () => {
    expect(hasRating(base)).toBe(false);
    expect(hasRating({ ...base, rating: 4.8, reviewCount: 0 })).toBe(false);
    expect(hasRating({ ...base, rating: 0, reviewCount: 5 })).toBe(false);
  });

  it("is true only with a real rating backed by at least one review", () => {
    expect(hasRating({ ...base, rating: 4.8, reviewCount: 12 })).toBe(true);
  });
});

describe("promoCardCopy", () => {
  it("uses the product's own name as the heading and a short CTA", () => {
    const copy = promoCardCopy("new_arrivals", base);
    expect(copy.title).toBe("Intelligent Litter Box");
    expect(copy.cta).toBe("Shop now");
    expect(copy.eyebrow).toBe("Just landed");
  });

  it("leads with a genuine markdown when there is one", () => {
    const copy = promoCardCopy("new_arrivals", { ...base, compareAtCents: 28900 });
    expect(copy.body).toContain("24% off");
  });

  it("quotes a real rating when there is one and no markdown", () => {
    const copy = promoCardCopy("new_arrivals", { ...base, rating: 4.8, reviewCount: 12 });
    expect(copy.body).toContain("4.8 out of 5");
    expect(copy.body).toContain("12 shoppers");
  });

  it("falls back to a plain, honest line with neither signal", () => {
    const copy = promoCardCopy("new_arrivals", base);
    expect(copy.body).not.toContain("%");
    expect(copy.body).not.toContain("out of 5");
    expect(copy.body.length).toBeGreaterThan(0);
  });

  it("frames the best-sellers card differently from new arrivals", () => {
    const newCopy = promoCardCopy("new_arrivals", base);
    const bestCopy = promoCardCopy("best_sellers", base);
    expect(bestCopy.eyebrow).toBe("Featured");
    expect(bestCopy.body).not.toBe(newCopy.body);
  });

  it("uses singular wording for a single review", () => {
    const copy = promoCardCopy("best_sellers", { ...base, rating: 5, reviewCount: 1 });
    expect(copy.body).toContain("1 shopper ");
    expect(copy.body).not.toContain("1 shoppers");
  });
});

describe("promoEyebrow", () => {
  it("labels each slot", () => {
    expect(promoEyebrow("new_arrivals")).toBe("Just landed");
    expect(promoEyebrow("best_sellers")).toBe("Featured");
  });
});

describe("pickPromoProduct", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const c = { id: "c" };

  it("returns null when there is nothing to feature", () => {
    expect(pickPromoProduct("a", [])).toBeNull();
  });

  it("uses the owner's pick when it is a live product", () => {
    expect(pickPromoProduct("b", [a, b, c])).toEqual({ product: b, source: "selected" });
  });

  it("falls back to the first candidate when the pick is missing/deleted", () => {
    expect(pickPromoProduct("gone", [a, b, c])).toEqual({ product: a, source: "fallback" });
  });

  it("falls back when there is no pick at all", () => {
    expect(pickPromoProduct("", [a, b])).toEqual({ product: a, source: "fallback" });
    expect(pickPromoProduct(null, [a, b])).toEqual({ product: a, source: "fallback" });
    expect(pickPromoProduct(undefined, [a, b])).toEqual({ product: a, source: "fallback" });
  });

  it("ignores surrounding whitespace on a stored id", () => {
    expect(pickPromoProduct("  b  ", [a, b])).toEqual({ product: b, source: "selected" });
  });

  it("keeps the two FALLBACK slots off the same product", () => {
    // With no picks and several products, the sibling's product is skipped, so
    // the shopper sees two different cards instead of the same one twice.
    expect(pickPromoProduct("", [a, b, c], "a")).toEqual({ product: b, source: "fallback" });
  });

  it("still honours an EXPLICIT pick even when it is the sibling's product", () => {
    // The owner deliberately featuring one product in both cards is intent, not a
    // bug, so exclusion must not override a live pick.
    expect(pickPromoProduct("a", [a, b], "a")).toEqual({ product: a, source: "selected" });
  });

  it("falls back to the sibling's product when it is the only one left", () => {
    // A one-product store must still fill BOTH cards - an exclusion that emptied
    // a card would be worse than the repetition.
    expect(pickPromoProduct("", [a], "a")).toEqual({ product: a, source: "fallback" });
  });

  it("ignores an empty exclusion id", () => {
    expect(pickPromoProduct("", [a, b], "")).toEqual({ product: a, source: "fallback" });
    expect(pickPromoProduct("", [a, b], null)).toEqual({ product: a, source: "fallback" });
  });
});

describe("PROMO_SETTING_KEYS", () => {
  it("names the two store_settings keys", () => {
    expect(PROMO_SETTING_KEYS.new_arrivals).toBe("promo_new_arrivals_product_id");
    expect(PROMO_SETTING_KEYS.best_sellers).toBe("promo_best_sellers_product_id");
  });
});
