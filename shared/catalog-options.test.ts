// Guards the REAL option values of the catalogue - the names a shopper picks
// from.
//
// WHY THIS SUITE EXISTS. The option values are the store's own text, and for a
// long time one product shipped the placeholders "Style 1" through "Style 4":
// a shopper was told to choose between numbered styles for a hoodie that
// actually comes in a red apple, a red heart, a carrot and a white-and-green
// costume. The Merchant Center item title carried the same placeholder, and a
// generic option value is a placeholder on the page.
//
// So the catalogue's option values are pinned here: they must be real, they
// must be distinct, and they must not be a numbered stand-in for a real choice.
import { describe, expect, it } from "vitest";
import { CATALOG_DATA } from "./catalog-data";
import { buildVariantSelector } from "./variant-axes";

/** A value that names an option rather than numbering it. */
const NUMBERED = /^(style|option|design|model|type|version|series|no\.?|number)\s*\d+$/i;

describe("the catalogue's option values", () => {
  it("never numbers an option instead of naming it", () => {
    const offenders: string[] = [];
    for (const product of CATALOG_DATA) {
      for (const variant of product.variants) {
        // The label is "<design> Â· <size>": each half must be a real value.
        for (const part of variant.name.split("Â·").map((p) => p.trim())) {
          if (part && NUMBERED.test(part)) {
            offenders.push(`${product.slug} ${variant.sku}: ${part}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("names every option of a product distinctly", () => {
    for (const product of CATALOG_DATA) {
      const names = product.variants.map((v) => v.name);
      expect(new Set(names).size, product.slug).toBe(names.length);
    }
  });
});

describe("the fruit hoodie's options", () => {
  const product = CATALOG_DATA.find((p) => p.slug === "cute-fruit-dog-hoodie-clothes");
  if (!product) throw new Error("the hoodie is not in the catalogue");

  it("offers the real designs, not numbered styles", () => {
    const selector = buildVariantSelector(
      product.variants.map((v) => ({
        id: v.sku,
        name: v.name,
        active: true,
        inventoryQty: v.inventoryQty,
      })),
    );
    const designs = selector.axes.find((a) => a.kind !== "size")?.values ?? [];
    expect(designs).toEqual(["Red Apple", "Red Heart", "Carrot", "White & Green"]);
    // The sizes are the real sizes, in the supplier's order.
    const sizes = selector.axes.find((a) => a.kind === "size")?.values ?? [];
    expect(sizes).toEqual(["XS", "S", "M", "L", "XL", "2XL"]);
  });

  it("resolves a design and a size to one real variant", () => {
    const selector = buildVariantSelector(
      product.variants.map((v) => ({
        id: v.sku,
        name: v.name,
        active: true,
        inventoryQty: v.inventoryQty,
      })),
    );
    const found = selector.find({ primary: "Carrot", secondary: "M" });
    expect(found?.id).toBe("CJGD117239415OL");
    expect(found?.name).toBe("Carrot · M");
  });

  it("names every design in the copy the page shows", () => {
    // The description lists the first options, so every design has to be in
    // there - otherwise the copy advertises one design only.
    const listed = product.description.split("Choose the option that suits your pet - ")[1] ?? "";
    for (const design of ["Red Apple", "Red Heart", "Carrot", "White & Green"]) {
      expect(listed, design).toContain(design);
    }
  });
});

