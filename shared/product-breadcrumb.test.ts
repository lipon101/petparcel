// The product page's breadcrumb, pinned.
//
// Before this, the product page printed `Home > <category> > <product name>`. On
// a real product the name is a whole descriptive sentence, so the trail dumped a
// long line of text across the top of the page while still leaving the shopper
// unable to tell which AISLE the category belonged to. These tests lock the
// replacement: a short, browsable path that never contains the product name.
import { describe, expect, it } from "vitest";
import {
  buildProductBreadcrumb,
  resolveCategoryTrail,
  type BreadcrumbTaxonomyNode,
} from "./product-breadcrumb";

const TAXONOMY: BreadcrumbTaxonomyNode[] = [
  {
    name: "Pet Furnitures",
    children: [
      { name: "Cat Scratching Posts" },
      { name: "Pet Furniture Tools" },
      { name: "Pet Houses & Cages" },
    ],
  },
  { name: "Pet Toys", children: [{ name: "Pet Chew Toys" }] },
];

const LONG_NAME =
  "Intelligent Litter Box Fully Enclosed Anti-splash Automatic Cleaning Deodorant";

describe("resolveCategoryTrail", () => {
  it("finds the aisle a subcategory sits under", () => {
    expect(resolveCategoryTrail("Pet Furniture Tools", TAXONOMY)).toEqual({
      aisle: "Pet Furnitures",
      category: "Pet Furniture Tools",
    });
  });

  it("reports no aisle for a top-level aisle used as a category", () => {
    expect(resolveCategoryTrail("Pet Toys", TAXONOMY)).toEqual({
      aisle: null,
      category: "Pet Toys",
    });
  });

  it("reports no aisle for a legacy name with no row in the tree", () => {
    expect(resolveCategoryTrail("Beds & Furniture", TAXONOMY)).toEqual({
      aisle: null,
      category: "Beds & Furniture",
    });
  });

  it("handles an empty category without throwing", () => {
    expect(resolveCategoryTrail("   ", TAXONOMY)).toEqual({ aisle: null, category: "" });
  });
});

describe("buildProductBreadcrumb", () => {
  it("is Home > Shop > Aisle > Subcategory for a subcategory product", () => {
    expect(buildProductBreadcrumb("Pet Furniture Tools", TAXONOMY)).toEqual([
      { label: "Home", to: "/" },
      { label: "Shop", to: "/shop" },
      { label: "Pet Furnitures", to: "/shop?category=Pet%20Furnitures" },
      { label: "Pet Furniture Tools", to: "/shop?category=Pet%20Furniture%20Tools" },
    ]);
  });

  it("NEVER contains the product name, however long it is", () => {
    // The whole point of the change: the trail must not echo the <h1>.
    const trail = buildProductBreadcrumb("Pet Furniture Tools", TAXONOMY);
    const rendered = trail.map((c) => c.label).join(" / ");
    expect(rendered).not.toContain(LONG_NAME);
    expect(rendered).not.toContain("Intelligent Litter Box");
    // And it stays short enough to sit on one line. The category here is a long
    // one ("Pet Furniture Tools"), so this is the worst case: even it lands well
    // under the ~70 characters a 1200px row holds at 12.5px.
    expect(rendered.length).toBeLessThan(60);
  });

  it("links Shop and the aisle, so the shopper can step up twice", () => {
    const trail = buildProductBreadcrumb("Pet Furniture Tools", TAXONOMY);
    expect(trail.map((c) => c.to)).toEqual([
      "/",
      "/shop",
      "/shop?category=Pet%20Furnitures",
      "/shop?category=Pet%20Furniture%20Tools",
    ]);
  });

  it("folds the aisle into the category when the tree does not know it", () => {
    expect(buildProductBreadcrumb("Beds & Furniture", TAXONOMY)).toEqual([
      { label: "Home", to: "/" },
      { label: "Shop", to: "/shop" },
      { label: "Beds & Furniture", to: "/shop?category=Beds%20%26%20Furniture" },
    ]);
  });

  it("returns nothing when there is no category, so no lone 'Home' renders", () => {
    expect(buildProductBreadcrumb("", TAXONOMY)).toEqual([]);
  });

  it("still works when the taxonomy has not loaded yet", () => {
    expect(buildProductBreadcrumb("Pet Furniture Tools", [])).toEqual([
      { label: "Home", to: "/" },
      { label: "Shop", to: "/shop" },
      { label: "Pet Furniture Tools", to: "/shop?category=Pet%20Furniture%20Tools" },
    ]);
  });

  it("uses an encoded category in the shop URL, so '&' cannot break the filter", () => {
    const trail = buildProductBreadcrumb("Pet Houses & Cages", TAXONOMY);
    expect(trail[trail.length - 1].to).toBe("/shop?category=Pet%20Houses%20%26%20Cages");
  });
});
