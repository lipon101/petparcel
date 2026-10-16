import { describe, expect, it } from "vitest";
import { categoryEquivalents, canonicalCategory } from "./category-taxonomy";

const TAXONOMY = ["Dogs", "Cats", "Feeding", "Feeders & Fountains", "Training", "Travel", "Toys"];

describe("categoryEquivalents", () => {
  it("treats no filter and the All sentinel as no predicate at all", () => {
    expect(categoryEquivalents()).toEqual([]);
    expect(categoryEquivalents("")).toEqual([]);
    expect(categoryEquivalents("All")).toEqual([]);
  });

  it("matches a current aisle by its own name", () => {
    expect(categoryEquivalents("Toys")).toEqual(["Toys"]);
  });

  it("also matches the old name when the aisle has been renamed", () => {
    // A row seeded as "Feeding" must still appear under Feeders & Fountains.
    expect(categoryEquivalents("Feeders & Fountains").sort()).toEqual(
      ["Feeders & Fountains", "Feeding"].sort(),
    );
  });

  it("matches every aisle an old superset name covered", () => {
    // "Travel & Outdoors" held travel and training gear, so both aisles find it.
    for (const aisle of ["Travel", "Training"]) {
      expect(categoryEquivalents(aisle)).toContain("Travel & Outdoors");
    }
  });

  it("leaves an unknown aisle to match only itself", () => {
    // An admin-invented category must not silently pick up legacy rows.
    expect(categoryEquivalents("Reptiles")).toEqual(["Reptiles"]);
  });
});

describe("canonicalCategory", () => {
  it("returns a current name untouched", () => {
    expect(canonicalCategory("Toys", TAXONOMY)).toBe("Toys");
    expect(canonicalCategory("Dogs", TAXONOMY)).toBe("Dogs");
  });

  it("maps a renamed aisle forward", () => {
    expect(canonicalCategory("Feeding", TAXONOMY)).toBe("Feeders & Fountains");
  });

  it("maps a superset name to the first aisle that still exists", () => {
    expect(canonicalCategory("Travel & Outdoors", TAXONOMY)).toBe("Travel");
    // With Travel gone from the taxonomy it falls through to the next candidate.
    expect(canonicalCategory("Travel & Outdoors", ["Training"])).toBe("Training");
  });

  it("keeps a name the taxonomy no longer holds rather than dropping the row", () => {
    // Nothing in the shared catalog covers this, so the stored name survives -
    // a category can never vanish from the storefront, only be reported forward.
    const orphan = canonicalCategory("Reptiles", TAXONOMY);
    expect(orphan).toBe("Reptiles");
  });
});
