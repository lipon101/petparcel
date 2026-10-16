import { describe, expect, it } from "vitest";
import {
  CATEGORY_ORDER,
  FEATURED_CATEGORY_COUNT,
  FEATURED_CATEGORY_ORDER,
  FOOTER_CATEGORY_COUNT,
  SETTINGS_DEFAULTS,
  displayName,
  productShippingLine,
  productTrustStrip,
  sortCategories,
  topCategories,
} from "./store";

describe("shipping model: flat $6.99, no free-shipping tier", () => {
  // The published policy is "flat $6.99 shipping and returns are free". A
  // positive free-shipping threshold would put "Free shipping over $X" on the
  // product pages while the policy page said "flat $6.99 on every order" - the
  // exact contradiction this guards against.
  it("ships at a flat $6.99 with the free-shipping tier switched off", () => {
    expect(SETTINGS_DEFAULTS.shipping_flat_cents).toBe(699);
    expect(SETTINGS_DEFAULTS.free_shipping_threshold_cents).toBe(0);
  });

  it("states the flat rate - never 'free shipping' - for the shipped defaults", () => {
    const line = productShippingLine(SETTINGS_DEFAULTS);
    expect(line).toContain("$6.99");
    expect(line.toLowerCase()).not.toContain("free shipping");
  });

  it("keeps the product trust strip on the flat rate too", () => {
    const strip = productTrustStrip(SETTINGS_DEFAULTS);
    const shipping = strip.find((i) => i.key === "shipping")?.body ?? "";
    expect(shipping).toContain("$6.99");
    expect(shipping.toLowerCase()).not.toContain("free");
  });

  it("promises free returns in the trust copy", () => {
    const returns = productTrustStrip(SETTINGS_DEFAULTS).find((i) => i.key === "returns")?.body ?? "";
    expect(returns).toMatch(/returns are free/i);
  });
});

describe("displayName", () => {
  it("prefers the profile full name, then the account name", () => {
    expect(displayName({ fullName: "Harry Potter", name: "hpotter", email: "x@y.com" })).toBe("Harry Potter");
    expect(displayName({ fullName: "  ", name: "Store Owner", email: "x@y.com" })).toBe("Store Owner");
  });

  it("title-cases the email local-part so a raw handle looks premium", () => {
    expect(displayName({ email: "petparcel@proton.me" })).toBe("Petparcel");
    expect(displayName({ email: "harry.potter@example.com" })).toBe("Harry Potter");
    expect(displayName({ email: "bubt1337@gmail.com" })).toBe("Bubt1337");
  });

  it("falls back to a neutral greeting when there is nothing to show", () => {
    expect(displayName({})).toBe("there");
    expect(displayName({ email: null, name: null, fullName: null })).toBe("there");
  });
});

describe("topCategories", () => {
  it("returns a fixed, short list so a condensed surface never balloons", () => {
    const all = [...CATEGORY_ORDER];
    expect(all.length).toBeGreaterThan(FEATURED_CATEGORY_COUNT);
    expect(topCategories(all)).toHaveLength(FEATURED_CATEGORY_COUNT);
    expect(topCategories(all, 3)).toHaveLength(3);
    expect(topCategories(all, 0)).toHaveLength(0);
  });

  it("puts the named aisles first, in declared order, whatever the stock says", () => {
    // The row is the shape the page was designed around. Ranking it purely by
    // live stock would reorder it the moment a restock landed, so a named aisle
    // is never displaced by a deeper unnamed one.
    const counts = { Aquatics: 500, "Beds & Furniture": 5, Toys: 4 };
    const top = topCategories([...CATEGORY_ORDER], FEATURED_CATEGORY_COUNT, counts);
    expect(top).toEqual([...FEATURED_CATEGORY_ORDER]);
    expect(top).not.toContain("Aquatics");
  });

  it("ranks the unnamed tail by live stock, so a new stocked aisle can earn a slot", () => {
    const list = [...CATEGORY_ORDER];
    const counts = { "Bird Supplies": 40, "Fish & Aquatic Pets": 2, "Pet Groomings": 9 };
    const extra = topCategories(list, FEATURED_CATEGORY_COUNT + 1, counts);
    // The named aisles are untouched; the next slot is the deepest of the
    // aisles the store stocks but has not named.
    expect(extra.slice(0, FEATURED_CATEGORY_COUNT)).toEqual([...FEATURED_CATEGORY_ORDER]);
    expect(extra[FEATURED_CATEGORY_COUNT]).toBe("Bird Supplies");
  });

  it("does not promote an empty aisle over a stocked one", () => {
    // Both are outside the named list, so the live count decides: the shelf that
    // actually holds stock comes first even though catalog order would not.
    const counts = { Aquatics: 3, Birds: 0 };
    expect(topCategories(["Birds", "Aquatics"], 2, counts)).toEqual(["Aquatics", "Birds"]);
  });

  it("is identical on the seeded first paint and the settled paint", () => {
    // `useTopCategories` seeds the bundled counts and swaps in the server's when
    // they land. If the ranking could change with the counts, the row would
    // visibly reshuffle a moment after it appeared - which it must not.
    const seeded = { "Feeders & Fountains": 6, "Beds & Furniture": 5, Aquatics: 2 };
    const settled = { "Feeders & Fountains": 3, "Beds & Furniture": 30, Aquatics: 900 };
    expect(topCategories([...CATEGORY_ORDER], FEATURED_CATEGORY_COUNT, seeded)).toEqual(
      topCategories([...CATEGORY_ORDER], FEATURED_CATEGORY_COUNT, settled),
    );
  });

  it("never repeats a category and only returns ones it was given", () => {
    const top = topCategories(["Dogs", "Dogs", "Cats"], 5, { Dogs: 9, Cats: 2 });
    expect(top).toEqual(["Dogs", "Cats"]);
  });

  it("falls back to the tie-break order when no counts are supplied", () => {
    expect(topCategories([...CATEGORY_ORDER])).toEqual([...FEATURED_CATEGORY_ORDER]);
  });

  it("caps the footer list shorter than the roundel rail, as a prefix of it", () => {
    const all = [...CATEGORY_ORDER];
    const footer = topCategories(all, FOOTER_CATEGORY_COUNT);
    const rail = topCategories(all, FEATURED_CATEGORY_COUNT);
    expect(FOOTER_CATEGORY_COUNT).toBeLessThan(FEATURED_CATEGORY_COUNT);
    expect(footer).toHaveLength(FOOTER_CATEGORY_COUNT);
    // Same ranking at a smaller number, so the two can never disagree about
    // which aisles rank highest.
    expect(footer).toEqual(rail.slice(0, FOOTER_CATEGORY_COUNT));
  });

  it("keeps the full list reachable - sortCategories is untouched by any of this", () => {
    const all = sortCategories([...CATEGORY_ORDER]);
    expect(all).toHaveLength(CATEGORY_ORDER.length);
    expect(new Set(all)).toEqual(new Set(CATEGORY_ORDER));
  });
});
