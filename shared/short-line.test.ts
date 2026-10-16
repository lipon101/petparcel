import { describe, expect, it } from "vitest";
import {
  SHORT_LINE_FALLBACK,
  SHORT_LINE_PART_MAX,
  SHORT_LINE_SEPARATOR,
  SHORT_LINE_SINGLE_MAX,
  productShortLine,
} from "./store";

// The buy box prints ONE short line under the price, and it is DERIVED from real
// product data rather than being the supplier's ~200-character title. These tests
// pin the bound (so it can never wrap to a second row) and the ordering of the
// fallbacks: category+material, then whichever survives alone, then the product's
// own KEY ATTRIBUTE (a real size or colour), and only then a plain generic line.
describe("productShortLine - one bounded row, from real data", () => {
  const MAX_TWO_PART = SHORT_LINE_PART_MAX * 2 + SHORT_LINE_SEPARATOR.length;

  it("composes a category and a material when both are usable", () => {
    const line = productShortLine({
      category: "Pet Towels",
      specs: { materials: "Microfibre" },
    });
    expect(line).toBe("Towels \u00b7 Microfibre");
  });

  it("never exceeds the two-part budget (so it cannot wrap at 320px)", () => {
    const line = productShortLine({
      category: "Pet Furniture Tools",
      specs: { materials: "Microfibre blend fabric" },
    });
    expect(line.length).toBeLessThanOrEqual(MAX_TWO_PART);
  });

  it("drops the supplier's 'Others' material placeholder as carrying no information", () => {
    const line = productShortLine({ category: "Pet Collars", specs: { materials: '["Others"]' } });
    expect(line).toBe("Collars");
  });

  it("uses a real stated key attribute when category AND material are generic", () => {
    // This is the shape the task called out: category survived, material was the
    // supplier's "Others", and the product's own real attribute carries the line.
    const line = productShortLine({
      category: "Pet Collars",
      specs: { materials: "Others", keyAttribute: "Red" },
    });
    expect(line).toBe("Collars \u00b7 Red");
  });

  it("falls back to a real OPTION VALUE (a colour) when no attribute is stated", () => {
    // The option label is the product's own real variant text, not an invention -
    // but the buy box DRAWS that value itself, so the line must not print it a
    // second time. The independent category carries the line instead.
    const line = productShortLine({
      category: "Pet Collars",
      specs: { materials: "Others" },
      optionValues: ["Red", "Blue"],
    });
    expect(line).toBe("Collars");
    expect(line).not.toBe("Red");
  });

  it("never prints a stated attribute the picker already draws (the live 'Pink' duplicate)", () => {
    // The 2-pack dog door bells on the live store: one variant named "PINK",
    // category present, material the supplier's "Others", and no stated
    // attribute. The derived line collapsed to the lone option value, so the page
    // read "Pink" under the price and "Pink" again as the one configuration row.
    const line = productShortLine({
      category: "Barking Control Equipments",
      specs: { materials: '["Others"]' },
      optionValues: ["PINK"],
    });
    expect(line).toBe("Barking Control Equipments");
    expect(line.toLowerCase()).not.toContain("pink");
  });

  it("skips a stated KEY ATTRIBUTE that merely repeats a real option value", () => {
    // The anti-bark collar's line read "Black" while its real choice is
    // Black / White - presenting ONE of two choices as the product's own
    // property, and repeating the swatch label drawn below it. The attribute is
    // dropped and the material carries the line instead. (The category here is
    // over the 22-char part budget, so it drops too - which is the separate,
    // already-tested bounding rule.)
    const line = productShortLine({
      category: "Barking Control Equipments",
      specs: { materials: "ABS plastic", keyAttribute: "Black" },
      optionValues: ["Black", "White"],
    });
    expect(line).toBe("ABS plastic");
    expect(line).not.toContain("Black");
  });

  it("keeps a stated attribute the picker does NOT draw", () => {
    // The attribute adds information the buy box never states, so it stays.
    const line = productShortLine({
      category: "Pet Collars",
      specs: { materials: "Others", keyAttribute: "Reflective" },
      optionValues: ["Red", "Blue"],
    });
    expect(line).toBe("Collars \u00b7 Reflective");
  });

  it("lets a real key attribute carry the whole line when nothing else survives", () => {
    const line = productShortLine({
      category: null,
      specs: { materials: "Others", keyAttribute: "Black" },
    });
    expect(line).toBe("Black");
  });

  it("never slices a compound option value into nonsense", () => {
    // "BLUE-M 100x50cm" is a colour AND a size, not a single attribute, so it is
    // skipped rather than truncated to something meaningless.
    const line = productShortLine({
      category: null,
      specs: { materials: "Others" },
      optionValues: ["BLUE-M 100x50cm and a much longer tail"],
    });
    expect(line).toBe(SHORT_LINE_FALLBACK);
  });

  it("keeps every line within the single-part budget when it stands alone", () => {
    const line = productShortLine({
      category: "A Very Long Category Name That Is Over The Budget",
      specs: { materials: "Others" },
    });
    expect(line.length).toBeLessThanOrEqual(SHORT_LINE_SINGLE_MAX);
  });

  it("states the honest generic fallback when a product has nothing usable", () => {
    expect(productShortLine({ category: null, specs: null })).toBe(SHORT_LINE_FALLBACK);
    expect(productShortLine(null)).toBe(SHORT_LINE_FALLBACK);
    expect(productShortLine(undefined)).toBe(SHORT_LINE_FALLBACK);
  });

  it("is stable: the same product always yields the same line", () => {
    const p = { category: "Pet Collars", specs: { materials: "Others", keyAttribute: "Red" } };
    expect(productShortLine(p)).toBe(productShortLine(p));
  });

  // These four strings are REAL values stored in the live catalogue. Before the
  // placeholder filter, the derived line printed them at a shopper.
  it("never lets a placeholder stand as the product's attribute", () => {
    for (const junk of ["Standard", "standard", "2 pcs", "1 Pack", "3 sets"]) {
      const line = productShortLine({
        category: "Hair Removers & Combs",
        specs: { materials: "Others", keyAttribute: junk },
      });
      expect(line).not.toContain(junk);
      expect(line).toBe("Hair Removers & Combs");
    }
  });

  it("never prints the supplier's internal code (letters+digits in one run)", () => {
    const line = productShortLine({
      category: "Furniture Tools",
      specs: { materials: "Others", keyAttribute: "7018NATURAL" },
    });
    expect(line).toBe("Furniture Tools");
    expect(line).not.toMatch(/[0-9]/);
  });

  it("spells a shouted colour properly but leaves real size labels alone", () => {
    const colour = productShortLine({
      category: null,
      specs: { materials: "Others", keyAttribute: "BROWN" },
    });
    expect(colour).toBe("Brown");
    // "XL" is a size a shopper buys, not a shouted word: casing it would be wrong.
    const size = productShortLine({
      category: null,
      specs: { materials: "Others", keyAttribute: "XL" },
    });
    expect(size).toBe("XL");
  });
});
