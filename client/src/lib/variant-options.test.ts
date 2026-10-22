import { describe, expect, it } from "vitest";
import {
  buildVariantOptions,
  colorHex,
  colorNeedsBorder,
  compactVariantLabel,
  displayName,
  swatchBackground,
} from "./variant-options";
import type { StoreVariant } from "./types";

// Two live bugs are pinned here.
//
//  1. The axes were decided by POSITION - "the half before the middle dot is the
//     size, the half after is the colour". A garment label ("S (14-20 in girth) .
//     Black") happens to match that, but the towel's own label ("BLUE-M .
//     100x50cm") is the exact opposite: colour first, size second. The page then
//     headed a group of SIZES "Choose a colour" and asked its colour table for a
//     hex for "100x50cm", which has no colour word in it - so EVERY swatch fell
//     through to the same neutral stone. Two identical grey dots on a product
//     with five real colourways.
//
//  2. A grid was drawn even when the product's options were not a grid, so the
//     shopper saw choices that resolved to nothing.
//
// The axes must now be read from each option value's MEANING, and a group's
// label must match what the shopper is really being asked to pick.

function v(name: string, sku: string, qty: number, price = 3499): StoreVariant {
  return { id: sku, name, sku, priceCents: price, inventoryQty: qty, sortOrder: 0, active: true };
}

const HARNESS = [
  "S (14-20 in girth) \u00b7 Black",
  "S (14-20 in girth) \u00b7 Blue",
  "S (14-20 in girth) \u00b7 Red",
  "M (20-27 in girth) \u00b7 Black",
  "M (20-27 in girth) \u00b7 Blue",
  "M (20-27 in girth) \u00b7 Red",
  "L (27-35 in girth) \u00b7 Black",
  "L (27-35 in girth) \u00b7 Blue",
  "L (27-35 in girth) \u00b7 Red",
  "XL (35-44 in girth) \u00b7 Black",
  "XL (35-44 in girth) \u00b7 Blue",
  "XL (35-44 in girth) \u00b7 Red",
].map((n, i) => v(n, `PP-HARN-${i}`, 58 - i * 4));

// The real towel: five colourways x two sizes, the supplier's own labels. The
// live page drew a "Choose a colour" group of two SIZES here, both grey.
const TOWEL = [
  "BLUE-M \u00b7 100x50cm",
  "BLUE-L \u00b7 130x70cm",
  "GREEN-M \u00b7 100x50cm",
  "GREEN-L \u00b7 130x70cm",
  "Brown-M \u00b7 100x50cm",
  "Brown-L \u00b7 130x70cm",
  "PINK-M \u00b7 100x50cm",
  "PINK-L \u00b7 130x70cm",
  "GRAY-M \u00b7 100x50cm",
  "GRAY-L \u00b7 130x70cm",
].map((n, i) => v(n, `CJPT22704460${i}`, 300));

describe("the live towel - a colour-first label must not invert the axes", () => {
  const o = buildVariantOptions(TOWEL);
  const colourAxis = o.axes.find((a) => a.kind === "color");

  it("finds the real colour axis, not the size axis", () => {
    expect(colourAxis).toBeDefined();
    // Five real colourways, canonicalised - not the two sizes that were drawn.
    expect(colourAxis!.values).toEqual(["Blue", "Green", "Brown", "Pink", "Grey"]);
  });

  it("draws five swatches, not two", () => {
    expect(colourAxis!.values).toHaveLength(5);
    // The old model drew exactly two, and one of them was wrongly disabled.
    expect(colourAxis!.values.length).toBeGreaterThan(2);
  });

  it("gives every colour a DIFFERENT dot", () => {
    const dots = colourAxis!.values.map((c) => colorHex(c));
    expect(new Set(dots).size).toBe(dots.length);
    expect(dots).not.toContain("#c9c2bd");
  });

  it("renders each colour as its real colour", () => {
    expect(colorHex("Blue")).toBe("#2f5fd0");
    expect(colorHex("GREEN")).toBe("#2e7d52");
    expect(colorHex("PINK")).toBe("#eb3594");
  });

  it("heads a SIZE group 'Choose a size', never 'Choose a colour'", () => {
    const sizeAxis = o.axes.find((a) => a.kind === "size");
    expect(sizeAxis).toBeDefined();
    expect(sizeAxis!.ariaLabel).toBe("Choose a size");
    // The axis VALUE keeps the supplier's real remaining option text (the colour
    // was lifted out of "BLUE-M"), so nothing is invented and nothing is lost...
    expect(sizeAxis!.values).toEqual(["M \u00b7 100x50cm", "L \u00b7 130x70cm"]);
    // ...while the CHIP the shopper reads is the short, clean form.
    expect(sizeAxis!.values.map((v) => sizeAxis!.chipLabel(v))).toEqual(["M", "L"]);
    // No colour axis here may claim to be a size and vice versa.
    expect(colourAxis!.ariaLabel).toBe("Choose a colour");
  });

  it("keeps every combination selectable and resolving to its own variant", () => {
    const colours = colourAxis!.values;
    const sizes = o.axes.find((a) => a.kind === "size")!.values;
    expect(colours.length * sizes.length).toBe(TOWEL.length);
    for (const c of colours) {
      for (const s of sizes) {
        const hit = o.find(s, c);
        expect(hit, `${c} / ${s}`).not.toBeNull();
        expect(hit!.inventoryQty).toBeGreaterThan(0);
      }
    }
    // Ten distinct rows, so no two picks collapse onto one variant.
    const ids = new Set(
      colours.flatMap((c) => sizes.map((s) => o.find(s, c)!.id)),
    );
    expect(ids.size).toBe(TOWEL.length);
  });

  it("uses the supplier's own SKU for the picked combination", () => {
    expect(o.find("L \u00b7 130x70cm", "Blue")!.sku).toBe("CJPT227044601");
    expect(o.find("M \u00b7 100x50cm", "Grey")!.sku).toBe("CJPT227044608");
  });
});

describe("the garment harness - colour last, the shape that already worked", () => {
  const o = buildVariantOptions(HARNESS);

  it("collapses twelve rows into four sizes and three colours", () => {
    expect(o.sizes).toHaveLength(4);
    expect(o.colors).toEqual(["Black", "Blue", "Red"]);
    expect(o.colors.length).toBeLessThan(HARNESS.length);
  });

  it("shortens a size chip to the part before its measurement", () => {
    expect(o.shortLabel("S (14-20 in girth)")).toBe("S");
    expect(o.shortLabel("XL (35-44 in girth)")).toBe("XL");
  });

  it("resolves the single real variant for a selected pair", () => {
    expect(o.find("M (20-27 in girth)", "Blue")?.name).toBe("M (20-27 in girth) \u00b7 Blue");
  });

  it("returns null for a pair the product does not carry", () => {
    expect(o.find("S (14-20 in girth)", "Purple")).toBeNull();
  });

  it("preselects a genuinely buyable pair", () => {
    const picked = o.find(o.defaultSelection.size, o.defaultSelection.color);
    expect(picked?.inventoryQty ?? 0).toBeGreaterThan(0);
  });

  it("greys a colour only for the size that is actually out of stock", () => {
    const opt = buildVariantOptions([
      v("S (14-20 in girth) \u00b7 Black", "X", 0),
      v("S (14-20 in girth) \u00b7 Blue", "Y", 5),
    ]);
    expect(opt.colorAvailable("Black", "S (14-20 in girth)")).toBe(false);
    expect(opt.colorAvailable("Blue", "S (14-20 in girth)")).toBe(true);
    expect(opt.colorsInStockFor("S (14-20 in girth)")).toEqual(["Blue"]);
  });

  it("carries the colour across a size change and falls back when it cannot", () => {
    const opt = buildVariantOptions([
      v("S \u00b7 Black", "A", 5),
      v("S \u00b7 Blue", "B", 5),
      v("M \u00b7 Blue", "C", 5),
    ]);
    const sizeAxisIndex = opt.axes.findIndex((a) => a.kind === "size");
    if (sizeAxisIndex >= 0) {
      // Blue survives the move to M; Black does not and falls back to M's stock.
      expect(opt.nextSelection(sizeAxisIndex, "M", { size: "S", color: "Blue" }).color).toBe("Blue");
      expect(opt.nextSelection(sizeAxisIndex, "M", { size: "S", color: "Black" }).color).toBe("Blue");
    }
  });
});

describe("a colour-only product is a swatch row", () => {
  const o = buildVariantOptions([v("Black", "A", 5), v("Blue", "B", 5)]);
  it("heads the row 'Choose a colour' and offers both values", () => {
    expect(o.axes).toHaveLength(1);
    expect(o.axes[0].kind).toBe("color");
    expect(o.axes[0].ariaLabel).toBe("Choose a colour");
    expect(o.colors).toEqual(["Black", "Blue"]);
  });
  it("draws two distinct dots", () => {
    expect(colorHex("Black")).not.toBe(colorHex("Blue"));
  });
});

describe("a size-only product is a size chip row", () => {
  const o = buildVariantOptions([v("Small", "A", 5), v("Large", "B", 5)]);
  it("heads the row a size and offers both values", () => {
    expect(o.axes).toHaveLength(1);
    expect(o.axes[0].kind).toBe("size");
    expect(o.axes[0].ariaLabel).toBe("Choose a size");
    expect(o.sizes).toEqual(["Small", "Large"]);
  });
});

describe("options that are NOT a grid get one honest list, not a grid of holes", () => {
  it("lists the bird-cage ornaments flat instead of inventing a second axis", () => {
    // Nine values that are not a cross product. The old model split them on the
    // middle dot and drew a nine-by-two grid - nine of whose eighteen cells were
    // choices a shopper could see but not take.
    const o = buildVariantOptions(
      [
        "Semicircle Small",
        "Large \u00b7 19 x 10 cm",
        "Small \u00b7 15 x 8 cm",
        "Square \u00b7 12 x 12",
        "Large Fan",
        "Semicircle Large",
        "Small Fan",
        "Triangular Wood",
        "Standard",
      ].map((n, i) => v(n, `BIRD-${i}`, 12)),
    );
    expect(o.axes).toHaveLength(1);
    expect(o.axes[0].values).toHaveLength(9);
  });

  it("still resolves each listed value to its own variant", () => {
    const names = ["Style 1", "Style 2", "Style 3"].map((n, i) => v(n, `S-${i}`, 9));
    const o = buildVariantOptions(names);
    for (const n of names) {
      expect(o.resolve({ size: n.name, color: null })?.name).toBe(n.name);
    }
  });
});

describe("a single option draws no chooser at all", () => {
  it("states the one configuration instead", () => {
    const o = buildVariantOptions([v("White", "CJYD234462301AZ", 38)]);
    expect(o.axes).toEqual([]);
    expect(o.singleLabel).toBe("White");
    expect(o.singleLabelHeading).toBe("Colour");
  });

  it("states the value alone when the supplier names no dimension (never a vague 'Option')", () => {
    const o = buildVariantOptions([v("USA Plug (V1) · White", "A", 38)]);
    // The supplier stated no dimension for this listing, so there is no honest
    // heading to print. A generic "Option" label is exactly the vague wording
    // this exists to remove; the value is stated on its own instead.
    expect(o.singleLabelHeading).toBeNull();
    expect(o.singleLabel).toBeTruthy();
  });

  it("never states a PLACEHOLDER as the product's one configuration", () => {
    // The live water fountain printed "COLOUR: as pic" - the supplier's
    // placeholder, dressed as a colour choice. A placeholder is not a value a
    // shopper can pick, so the page states nothing about options at all.
    for (const placeholder of ["as pic", "As shown", "Standard", "Default Title"]) {
      const o = buildVariantOptions([v(placeholder, "PP-PLACEHOLDER", 38)]);
      expect(o.singleLabel, placeholder).toBeNull();
      expect(o.axes, placeholder).toEqual([]);
    }
  });

  it("keeps a pack count - it is a real value, not a placeholder", () => {
    // "2 pcs" is the pack size, and under the supplier's own "Pack"/"Set"
    // heading it says exactly what the shopper is buying.
    const o = buildVariantOptions([v("1 box", "PP-COUNT", 38)], [
      { token: "Set", kind: "set", label: "Set" },
    ]);
    expect(o.singleLabel).toBe("1 box");
    expect(o.singleLabelHeading).toBe("Set");
  });

  it("never heads a row 'Colour' when the values hold no colour", () => {
    // The supplier may state a colour dimension for a listing whose only value
    // is not a colour. A "Colour" heading over a non-colour is the same
    // placeholder dressed as a choice, so the canonical word for the values is
    // used instead.
    const o = buildVariantOptions(
      [v("As pic", "PP-A", 38), v("As shown", "PP-B", 38)],
      [{ token: "Color", kind: "color", label: "Colour" }],
    );
    for (const axis of o.axes) {
      expect(axis.label).not.toBe("Colour");
    }
  });
});

describe("swatch colours", () => {
  it("maps known colour names and falls back for unknown ones", () => {
    expect(colorHex("Black")).toBe("#1b1b1b");
    expect(colorHex("blue")).toBe("#2f5fd0");
    expect(colorHex("Chartreuse")).toBe("#c9c2bd");
  });

  it("flags white for a hairline border so it stays visible on a white card", () => {
    expect(colorNeedsBorder("White")).toBe(true);
    expect(colorNeedsBorder("Black")).toBe(false);
  });

  it("keeps two multi-word colourways visually DISTINCT", () => {
    // "Military Green" and "Green Grey" are both real supplier colourway names,
    // and both used to fall through to the SAME neutral fallback - so the pet
    // bed's two colours rendered as identical dots.
    const khaki = colorHex("Military Green");
    const greyGreen = colorHex("Green Grey");
    expect(khaki).not.toBe(greyGreen);
    expect(khaki).not.toBe("#c9c2bd");
    expect(greyGreen).not.toBe("#c9c2bd");
  });

  it("prefers a multi-word colour name over its last word", () => {
    // "Sky Blue" must not render as plain "Blue", and "Light Brown" must not
    // render as plain "Brown" - the names are what tell two colourways apart.
    expect(displayName("Sky Blue")).toBe("Sky Blue");
    expect(displayName("Light Brown")).toBe("Light Brown");
    expect(colorHex("Light Blue")).not.toBe(colorHex("Dark Blue"));
    expect(colorHex("Light Brown")).not.toBe(colorHex("Dark Brown"));
  });

  it("canonicalises a shouted supplier name without changing the value used to resolve", () => {
    expect(displayName("PINK")).toBe("Pink");
    expect(displayName("GRAY")).toBe("Grey");
    // The VALUE keeps its own spelling - it is the key back to the variant row.
    const o = buildVariantOptions([v("PINK", "A", 3), v("BLUE", "B", 3)]);
    expect(o.find(null, "PINK")?.sku).toBe("A");
  });

  it("draws a multicolour colourway as a wheel, not one flat dot", () => {
    expect(swatchBackground("MULTICOLOR")).toContain("conic-gradient");
    expect(swatchBackground("Black")).toBe("#1b1b1b");
  });
});

describe("axis labels describe what the shopper is actually picking", () => {
  it("calls an S/M/L/XL row 'Size'", () => {
    const o = buildVariantOptions([v("Small", "A", 5), v("Medium", "B", 5)]);
    expect(o.axes[0].label).toBe("Size");
  });

  it("calls a plug-type row 'Option', not 'Size'", () => {
    const o = buildVariantOptions([
      v("USA Plug (V1) \u00b7 White", "A", 5),
      v("EU Plug (V1) \u00b7 White", "B", 5),
    ]);
    const plug = o.axes.find((a) => a.values.some((x) => x.includes("Plug")));
    expect(plug?.label).toBe("Option");
  });

  it("calls a bundle row 'Option'", () => {
    const o = buildVariantOptions([
      v("Black \u00b7 Standard Meal", "A", 5),
      v("Black \u00b7 Deluxe Package", "B", 5),
    ]);
    const bundle = o.axes.find((a) => a.values.some((x) => x.includes("Package")));
    expect(bundle?.label).toBe("Option");
  });
});

describe("compactVariantLabel - the sticky bar reads meaning, not position", () => {
  it("reads a colour-first supplier label the right way round", () => {
    expect(compactVariantLabel("BLUE-M \u00b7 100x50cm")).toBe("Blue M \u00b7 100x50cm");
  });

  it("keeps a colour-last label as it stands", () => {
    expect(compactVariantLabel("S (14-20 in girth) \u00b7 Black")).toBe(
      "S (14-20 in girth) \u00b7 Black",
    );
  });

  it("passes a single-axis label straight through", () => {
    expect(compactVariantLabel("White")).toBe("White");
  });
});

// The REAL supplier option schema, as fetched from the supplier's own product
// endpoint. This is what supplies the DIMENSION HEADINGS the values alone cannot
// justify - and what stops a genuine single-option listing from collapsing into a
// bare value under a vague "Option" heading.
describe("the supplier's own option dimensions head the rows", () => {
  const REAL_DIMS = {
    set: [{ token: "Set", kind: "set", label: "Set" }],
    qty: [{ token: "QTY", kind: "pack", label: "Pack" }],
    colorSize: [
      { token: "COLOR", kind: "color", label: "Colour" },
      { token: "SIZE", kind: "size", label: "Size" },
    ],
  };

  it("names a single-option row with the supplier's own dimension (Set, not Option)", () => {
    const o = buildVariantOptions([v("2 pcs", "CJSP319096001AZ", 61)], REAL_DIMS.set);
    expect(o.axes).toEqual([]);
    expect(o.singleLabel).toBe("2 pcs");
    expect(o.singleLabelHeading).toBe("Set");
    expect(o.singleDimensionStated).toBe(true);
  });

  it("names a pack listing 'Pack' from the supplier's QTY dimension", () => {
    const o = buildVariantOptions([v("1 pack", "CJPG303385101AZ", 96)], REAL_DIMS.qty);
    expect(o.singleLabelHeading).toBe("Pack");
    expect(o.singleDimensionStated).toBe(true);
  });

  it("draws NOTHING for a product the supplier lists as optionless", () => {
    // The cat condo's supplier listing is "Default Title" with one variant, and
    // the store's seeded label for it said "Standard". A placeholder label on an
    // optionless product is not an option - so no row is drawn at all.
    const o = buildVariantOptions([v("Standard", "CJHC31412920001", 230)], []);
    expect(o.axes).toEqual([]);
    expect(o.singleLabel).toBeNull();
    expect(o.singleDimensionStated).toBe(false);
  });

  it("keeps a REAL straight single option visible even without a supplier dimension", () => {
    const o = buildVariantOptions([v("White", "CJYD234462301AZ", 38)], []);
    expect(o.singleLabel).toBe("White");
    expect(o.singleLabelHeading).toBe("Colour");
    expect(o.singleDimensionStated).toBe(false);
  });

  it("heads a colour grid from the supplier's own COLOR dimension", () => {
    const o = buildVariantOptions(TOWEL, [
      { token: "COLOR", kind: "color", label: "Colour" },
      { token: "SIZE", kind: "size", label: "Size" },
    ]);
    const headings = o.axes.map((a) => a.label);
    expect(headings).toEqual(["Colour", "Size"]);
  });
});

// A product whose TWO dimensions are BOTH non-colour - a pattern row and a size
// row - has no colour half. The old (size, colour) pair model wrote both axes
// into `size`, so the pick resolved to NOTHING: the page quoted no price, no
// variant id, and every control looked disabled. The positional axis view keeps
// both dimensions, so the pick resolves and a press really switches the variant.
describe("a two-dimension product with no colour axis (the foldable pet bed)", () => {
  const BED = [
    "Grey Snow House \u00b7 Large",
    "Grey Snow House \u00b7 Small",
    "Grey stars Blue \u00b7 Large",
    "Grey stars Blue \u00b7 Small",
    "Green bear den \u00b7 Large",
    "Green bear den \u00b7 Medium",
    "Green bear den \u00b7 Small",
    "Brown bear \u00b7 Large",
    "Brown bear \u00b7 Medium",
    "Brown bear \u00b7 Small",
    "Grey cat \u00b7 Large",
    "Grey cat \u00b7 Medium",
    "Grey cat \u00b7 Small",
    "Rabbit door curtain \u00b7 Large",
    "Rabbit door curtain \u00b7 Medium",
    "Rabbit door curtain \u00b7 Small",
    "Pink pig \u00b7 Large",
    "Pink pig \u00b7 Medium",
    "Pink pig \u00b7 Small",
    "Pink pig \u00b7 X-Large",
  ].map((n, i) => v(n, `CJGY1354527${i}`, 25, 1849));
  const DIMS = [
    { token: "Color", kind: "color" as const, label: "Colour" },
    { token: "Size", kind: "size" as const, label: "Size" },
  ];

  it("draws both real dimensions, headed with the supplier's own names", () => {
    const o = buildVariantOptions(BED, DIMS);
    expect(o.axes.map((a) => a.label)).toEqual(["Colour", "Size"]);
    expect(o.axes[0].values).toHaveLength(7);
    expect(o.axes[1].values).toEqual(["Large", "Small", "Medium", "X-Large"]);
  });

  it("resolves the default pick to a REAL variant (the old pair model resolved nothing)", () => {
    const o = buildVariantOptions(BED, DIMS);
    const hit = o.findAxis(o.defaultAxisSelection);
    expect(hit).not.toBeNull();
    expect(BED.some((b) => b.id === hit!.id)).toBe(true);
  });

  it("resolves every combination the catalogue really holds", () => {
    const o = buildVariantOptions(BED, DIMS);
    const [patterns, sizes] = [o.axes[0].values, o.axes[1].values];
    let resolved = 0;
    for (const p of patterns) for (const s of sizes) if (o.findAxis([p, s])) resolved++;
    // 7 patterns x 4 sizes = 28 cells, but only 20 real variants exist.
    expect(resolved).toBe(BED.length);
  });

  it("switches the variant when a size is pressed, keeping the pattern", () => {
    const o = buildVariantOptions(BED, DIMS);
    const next = o.nextAxisSelection(1, "Medium", o.defaultAxisSelection);
    const hit = o.findAxis(next);
    expect(hit).not.toBeNull();
    expect(hit!.name).toContain("Medium");
  });

  it("switches the variant when a pattern is pressed, keeping the size", () => {
    const o = buildVariantOptions(BED, DIMS);
    const next = o.nextAxisSelection(0, "Pink pig", o.defaultAxisSelection);
    const hit = o.findAxis(next);
    expect(hit).not.toBeNull();
    expect(hit!.name).toContain("Pink pig");
  });
});

