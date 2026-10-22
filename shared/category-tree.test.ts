import { describe, expect, it } from "vitest";
import {
  CATEGORY_TREE_DUPLICATES,
  CJ_CATEGORY_TREE,
  categoryChildren,
  categoryParent,
  categoryWithDescendants,
  findCategoryNameCollisions,
  isCategoryParent,
  treeParentNames,
  uniqueFlatCategories,
} from "./category-tree";

describe("CJ_CATEGORY_TREE", () => {
  it("holds the ten aisles the store browses by", () => {
    expect(treeParentNames()).toEqual([
      "Pet Toys",
      "Pet Drinking & Feeding",
      "Pet Outdoor Supplies",
      "Bird Supplies",
      "Fish & Aquatic Pets",
      "Pet Apparels",
      "Pet Collars, Harnesses & Accessories",
      "Pet Groomings",
      "Pet Furnitures",
      "Pet Bedding",
    ]);
  });

  it("files every subcategory the source list names", () => {
    expect(categoryChildren("Pet Toys")).toEqual([
      "Pet Chase Toys",
      "Pet Chew Toys",
      "Pet Training and Educational Toys",
      "Pet Sound Toys",
      "Pet Tunnel Toys",
      "Pet Toy Set",
      "Pet Plush Toys",
    ]);
    expect(categoryChildren("Fish & Aquatic Pets")).toEqual([
      "Fish Tanks",
      "Fish Tank Decorations",
      "Fish Tank Cleaning Supplies",
    ]);
    expect(categoryChildren("Pet Bedding")).toEqual([
      "Pet Mats",
      "Pet Nests",
      "Pet Beds",
      "Pet Blankets & Quilts",
    ]);
  });

  it("nests every subcategory under a top-level aisle, never two deep", () => {
    for (const parent of CJ_CATEGORY_TREE) {
      // A parent is never itself a child - the tree is exactly two levels, which
      // is what the storefront's browse UI and the admin pickers assume.
      expect(categoryParent(parent.name)).toBeNull();
      for (const child of parent.children) {
        // A name repeated across aisles resolves to the FIRST aisle that claims
        // it ("Pet Bags" -> Pet Outdoor Supplies) - see `uniqueFlatCategories`.
        const owner = CJ_CATEGORY_TREE.find((p) => p.children.includes(child))!;
        expect(categoryParent(child)).toBe(owner.name);
      }
    }
  });
});

describe("uniqueFlatCategories", () => {
  it("lists each parent once and each child under it", () => {
    const flat = uniqueFlatCategories();
    const parents = flat.filter((c) => c.parent === null).map((c) => c.name);
    expect(parents).toEqual(treeParentNames());

    // 10 aisles + every listed subcategory, minus the one name that repeats.
    const sourceChildren = CJ_CATEGORY_TREE.reduce((n, p) => n + p.children.length, 0);
    expect(flat.length).toBe(treeParentNames().length + sourceChildren - 1);
  });

  it("keeps a repeated name only once, under the FIRST aisle that claims it", () => {
    // "Pet Bags" is listed by both Pet Outdoor Supplies and Pet Apparels. A
    // product references its category by NAME, so the name may exist once - and
    // the first parent that claims it wins, deterministically.
    const flat = uniqueFlatCategories();
    const matches = flat.filter((c) => c.name === "Pet Bags");
    expect(matches).toHaveLength(1);
    expect(matches[0].parent).toBe("Pet Outdoor Supplies");
  });

  it("reports the collision so an importer can surface it", () => {
    expect(CATEGORY_TREE_DUPLICATES).toEqual([
      { name: "Pet Bags", parents: ["Pet Outdoor Supplies", "Pet Apparels"] },
    ]);
  });

  it("finds collisions in any tree it is given", () => {
    const tree = [
      { name: "A", children: ["x", "y"] },
      { name: "B", children: ["y", "z"] },
    ];
    expect(findCategoryNameCollisions(tree)).toEqual([{ name: "y", parents: ["A", "B"] }]);
  });

  it("numbers siblings in tree order so the tree renders in the source order", () => {
    const flat = uniqueFlatCategories();
    const toyOrder = flat.filter((c) => c.parent === "Pet Toys").map((c) => c.sortOrder);
    expect(toyOrder).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("categoryWithDescendants", () => {
  it("matches an aisle AND its subcategories", () => {
    // Filtering "Pet Toys" has to show gear filed on "Pet Chew Toys", or the
    // aisle would look empty until every product is filed on the parent itself.
    const names = categoryWithDescendants("Pet Toys");
    expect(names[0]).toBe("Pet Toys");
    expect(names).toContain("Pet Chew Toys");
    expect(names).toContain("Pet Plush Toys");
    expect(names).toHaveLength(8);
  });

  it("matches just the subcategory when one is selected", () => {
    expect(categoryWithDescendants("Pet Chew Toys")).toEqual(["Pet Chew Toys"]);
  });

  it("returns only the name for an unknown (admin-invented) aisle", () => {
    // An aisle the tree has never seen must not pick up a sibling's products.
    expect(categoryWithDescendants("Reptiles")).toEqual(["Reptiles"]);
  });

  it("treats an empty selection as no filter at all", () => {
    expect(categoryWithDescendants("")).toEqual([]);
  });
});

describe("isCategoryParent", () => {
  it("separates aisles from subcategories", () => {
    expect(isCategoryParent("Pet Toys")).toBe(true);
    expect(isCategoryParent("Pet Chew Toys")).toBe(false);
    expect(isCategoryParent("Nothing Like This")).toBe(false);
  });
});
