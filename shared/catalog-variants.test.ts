// Guards the customer-facing quality of the catalogue's variant names.
//
// WHY THIS EXISTS. The Intelligent Litter Box's single buyable variant was named
// after the supplier's internal spec code - "V1 Litter Box UK · White" - and the
// product page rendered it verbatim as "OptionV1 Litter Box UK · White". That is
// a raw supplier placeholder, not something a shopper should ever read. These
// tests fail the build if any variant name in the catalogue carries a supplier
// placeholder token, so the same class of leak cannot come back.
import { describe, expect, it } from "vitest";
import { CATALOG_DATA } from "./catalog-data";

// Tokens that only ever appear in a supplier's own internal naming, never in
// copy written for a shopper.
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\bOptionV\d*\b/i, // "OptionV1"
  /\bV\d+\b/, // a bare spec version like "V1"
  /\bLitter Box UK\b/i, // the supplier's internal spec code
  /\bSKU\b/i,
  /\bvariant\b/i,
  /\bdefault\b/i,
];

describe("catalogue variant names are customer-facing", () => {
  const allVariants = CATALOG_DATA.flatMap((p) =>
    p.variants.map((v) => ({ slug: p.slug, name: v.name, sku: v.sku })),
  );

  it("has variants to check", () => {
    expect(allVariants.length).toBeGreaterThan(0);
  });

  it("never carries a supplier placeholder token", () => {
    for (const v of allVariants) {
      for (const re of PLACEHOLDER_PATTERNS) {
        expect(
          re.test(v.name),
          `variant "${v.name}" on ${v.slug} matches placeholder ${re}`,
        ).toBe(false);
      }
    }
  });

  it("names every variant with a real, non-empty label", () => {
    for (const v of allVariants) {
      expect(v.name.trim().length, `${v.slug} has an empty variant name`).toBeGreaterThan(0);
    }
  });

  it("keeps the supplier's real SKU on every variant", () => {
    for (const v of allVariants) {
      // CJ SKUs are the supplier's own scheme; every variant must carry one.
      // The scheme is a CJ prefix plus the supplier's own suffix, which may
      // include hyphens, spaces and mixed case (e.g. "CJJJCWGY02426-Dark grey-M").
      expect(v.sku, `${v.slug} / ${v.name} has no SKU`).toMatch(/^CJ[A-Za-z0-9 -]+$/);
    }
  });

  it("gives the litter box its real colour, not the supplier spec code", () => {
    const litter = CATALOG_DATA.find(
      (p) => p.slug === "intelligent-litter-box-automatic-self-cleaning-deodorant",
    );
    expect(litter).toBeDefined();
    expect(litter!.variants.map((v) => v.name)).toEqual(["White"]);
    expect(litter!.variants[0]!.sku).toBe("CJYD234462301AZ");
  });
});
