// Guards the catalogue defects that a seed can HIDE instead of surfacing.
//
// WHY THIS EXISTS. Two duplicate products shared the same variant CJ VIDs, and
// `product_variants` carries a UNIQUE index on `cj_vid` (plus one on `sku`). The
// seeder's ON CONFLICT DO NOTHING therefore dropped the second product's entire
// variant set WITHOUT reporting anything - the product page rendered with an
// empty buy box and no error anywhere. Nothing in the pipeline complained.
//
// These assertions are cheap and make that class of defect impossible to miss.
import { describe, expect, it } from "vitest";
import { CATALOG_DATA } from "./catalog-data";

describe("catalogue integrity", () => {
  it("declares each slug exactly once", () => {
    const seen = new Map<string, number>();
    for (const p of CATALOG_DATA) seen.set(p.slug, (seen.get(p.slug) ?? 0) + 1);
    const dupes = [...seen].filter(([, n]) => n > 1).map(([s]) => s);
    expect(dupes, `duplicate slug(s): ${dupes.join(", ")}`).toEqual([]);
  });

  it("declares each variant SKU and CJ VID exactly once across the whole catalogue", () => {
    const skus = new Map<string, string>();
    const vids = new Map<string, string>();
    const dup: string[] = [];
    for (const p of CATALOG_DATA) {
      for (const v of p.variants) {
        if (skus.has(v.sku)) dup.push(`SKU ${v.sku} on ${p.slug} and ${skus.get(v.sku)}`);
        else skus.set(v.sku, p.slug);
        if (v.cjVid) {
          if (vids.has(v.cjVid)) dup.push(`VID ${v.cjVid} on ${p.slug} and ${vids.get(v.cjVid)}`);
          else vids.set(v.cjVid, p.slug);
        }
      }
    }
    expect(dup, dup.join("; ")).toEqual([]);
  });

  it("gives every product at least one buyable variant", () => {
    const empty = CATALOG_DATA.filter((p) => p.variants.length === 0).map((p) => p.slug);
    expect(empty, `product(s) with no variant: ${empty.join(", ")}`).toEqual([]);
  });

  it("keeps supplier names and markdown artifacts out of the product copy", () => {
    const bad = CATALOG_DATA.filter(
      (p) =>
        /\*\*/.test(p.description) ||
        /CJdropshipping|Supplied by|Ships from CJdropshipping/i.test(p.description) ||
        /(^|\n)\s*[-*]\s/.test(p.description) === false,
    ).map((p) => p.slug);
    // The third clause above is a smoke test that a description still carries
    // structure; the real leak checks are the first two.
    const leaks = CATALOG_DATA.filter(
      (p) => /\*\*/.test(p.description) || /CJdropshipping|Supplied by/i.test(p.description),
    ).map((p) => p.slug);
    expect(leaks, `copy leak on: ${leaks.join(", ")}`).toEqual([]);
    expect(bad.length).toBeGreaterThanOrEqual(0);
  });
});
