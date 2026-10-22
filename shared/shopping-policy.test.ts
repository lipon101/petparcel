// Scans the WHOLE bundled catalogue for terms that would trip a Merchant Center
// adult-content or personalized-advertising (sexual interests) policy flag.
//
// WHY A TEST AND NOT A ONE-OFF CHECK. The catalogue is assembled from supplier
// copy, so a future import can reintroduce a flagged word exactly the way the
// "Pet Boobs" harness did. Running the curated guard in `shopping-policy-guard`
// over every shipped name, description and option value means such a term fails
// the build here rather than surfacing weeks later as a Merchant Center
// disapproval (or, worse, an account-level policy strike).
import { describe, expect, it } from "vitest";
import { CATALOG_DATA } from "./catalog-data";
import { shoppingPolicyViolations, violatesShoppingPolicy } from "./shopping-policy-guard";

describe("shopping policy guard over the whole catalogue", () => {
  it("has no flagged term in any product NAME", () => {
    const offenders = CATALOG_DATA.filter((p) => violatesShoppingPolicy(p.name)).map((p) => p.name);
    expect(offenders).toEqual([]);
  });

  it("has no flagged term in any DESCRIPTION", () => {
    const offenders = CATALOG_DATA.filter((p) => violatesShoppingPolicy(p.description)).map(
      (p) => p.slug,
    );
    expect(offenders).toEqual([]);
  });

  it("has no flagged term in any variant / option name", () => {
    const offenders: string[] = [];
    for (const p of CATALOG_DATA) {
      for (const v of p.variants) {
        if (violatesShoppingPolicy(v.name)) offenders.push(`${p.slug} :: ${v.name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("still catches the exact term that caused the account flag", () => {
    // The regression this whole guard exists for. "Boobs" was in a live title.
    const flagged = shoppingPolicyViolations(
      "American Local Tactical Pet Boobs Service Dog Harness Vest Adjustable",
    );
    expect(flagged).toContain("adult-content");
    expect(flagged).toContain("personalized-ads-sexual-interests");
    // The replacement title is clean.
    expect(
      violatesShoppingPolicy(
        "Tactical Service Dog Harness Vest, Adjustable Reflective Dog Harness with Metal Buckle for Hiking Training",
      ),
    ).toBe(false);
  });

  it("does not cry wolf on legitimate pet and bird vocabulary", () => {
    // These are DELIBERATE exclusions - a guard that fails the build on real pet
    // copy is a guard the owner learns to ignore.
    expect(violatesShoppingPolicy("Adjustable harness for adult dogs and puppies")).toBe(false);
    expect(violatesShoppingPolicy("Great Tit bird feeder, squirrel proof")).toBe(false);
    expect(violatesShoppingPolicy("Routine grooming for anal glands and coat care")).toBe(false);
    expect(violatesShoppingPolicy("Breast collar for a working dog harness")).toBe(false);
  });
});
