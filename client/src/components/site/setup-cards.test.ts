// The cross-sell fallback shows one of several card sets, chosen by the product's
// category. Picking the wrong set put litter-box accessories ("Litter & liners",
// "Odour control") on the tent-bed page - a real content error that only surfaced
// once the store had a second product. These tests pin the mapping.
import { describe, expect, it } from "vitest";
import { setupCardsFor } from "./ProductExtras";

const titles = (category: string | null | undefined) =>
  setupCardsFor(category).map((c) => c.title);

describe("setupCardsFor", () => {
  it("gives the litter box its own supplies", () => {
    expect(titles("Pet Furniture Tools")).toEqual([
      "Litter & liners",
      "Odour control",
      "Care & cleaning",
    ]);
  });

  it("gives the tent bed bedding, never litter supplies", () => {
    const t = titles("Pet Tents");
    expect(t).toContain("Spare cushion covers");
    expect(t).not.toContain("Litter & liners");
    expect(t).not.toContain("Odour control");
  });

  it("never leaks one product's supplies onto another's page", () => {
    // The regression: these two lists must not intersect on the product-specific
    // cards, so a shopper never sees an accessory their product cannot use.
    const litter = titles("Pet Furniture Tools");
    const tent = titles("Pet Tents");
    expect(litter.filter((t) => tent.includes(t))).toEqual(["Care & cleaning"]);
  });

  it("falls back to a neutral set for an unknown category", () => {
    const t = titles("Something Not Yet Stocked");
    expect(t.length).toBeGreaterThan(0);
    expect(t).not.toContain("Litter & liners");
    expect(t).not.toContain("Spare cushion covers");
  });

  it("handles a missing category without throwing", () => {
    expect(titles(null).length).toBeGreaterThan(0);
    expect(titles(undefined).length).toBeGreaterThan(0);
  });
});
