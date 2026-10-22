// Guards the deploy reconciler's two reconcile-DOWN rules.
//
// `seedCategories` and `seedSettings` only ever INSERT, so a row that is no
// longer declared would live in the database forever: a retired aisle would go
// on rendering as a browse tile, and a settings row no code reads would sit in
// the table looking editable. These tests pin the decision that decides what may
// be removed - and, more importantly, what may NOT.
import { describe, expect, it } from "vitest";
import { partitionCategories, partitionSettings } from "./catalog-sync";
import { plannedCategoryNames } from "./category-tree";
import { plannedSettingKeys, SETTINGS_DEFAULTS } from "./store";

const cat = (name: string, productCount = 0) => ({
  id: `id-${name}`,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  parentId: null,
  productCount,
});

describe("plannedCategoryNames", () => {
  it("covers every aisle and subcategory the taxonomy declares", () => {
    const names = plannedCategoryNames();
    expect(names.has("Pet Furnitures")).toBe(true);
    expect(names.has("Pet Furniture Tools")).toBe(true);
    expect(names.has("Pet Tents")).toBe(true);
  });

  it("does not contain a name the taxonomy has dropped", () => {
    const names = plannedCategoryNames();
    expect(names.has("Dogs")).toBe(false);
    expect(names.has("Feeders & Fountains")).toBe(false);
    expect(names.has("Travel & Outdoors")).toBe(false);
  });
});

describe("partitionCategories", () => {
  it("keeps every declared row untouched", () => {
    const { keep, retire, protect } = partitionCategories(
      [cat("Pet Furnitures"), cat("Pet Tents")],
      ["Pet Furnitures", "Pet Tents"],
    );
    expect(keep.map((r) => r.name)).toEqual(["Pet Furnitures", "Pet Tents"]);
    expect(retire).toEqual([]);
    expect(protect).toEqual([]);
  });

  it("retires an undeclared row that holds nothing", () => {
    const { retire } = partitionCategories([cat("Dogs")], ["Pet Furnitures"]);
    expect(retire.map((r) => r.name)).toEqual(["Dogs"]);
  });

  it("NEVER retires an undeclared row with products filed under it", () => {
    // A product stores its category as a plain NAME, so deleting a populated row
    // would drop those products out of every filter. This is the safety rule.
    const { retire, protect } = partitionCategories(
      [cat("Dogs", 3)],
      ["Pet Furnitures"],
    );
    expect(retire).toEqual([]);
    expect(protect.map((r) => r.name)).toEqual(["Dogs"]);
  });

  it("keeps an admin-added aisle the moment a product is filed under it", () => {
    const { keep, protect } = partitionCategories(
      [cat("Reptiles", 1)],
      plannedCategoryNames(),
    );
    expect(keep).toEqual([]);
    expect(protect.map((r) => r.name)).toEqual(["Reptiles"]);
  });

  it("preserves order within each bucket", () => {
    const { retire } = partitionCategories(
      [cat("A"), cat("Pet Furnitures"), cat("B"), cat("C")],
      ["Pet Furnitures"],
    );
    expect(retire.map((r) => r.name)).toEqual(["A", "B", "C"]);
  });
});

describe("plannedSettingKeys", () => {
  it("is exactly the keys the code can read", () => {
    expect(new Set(plannedSettingKeys())).toEqual(new Set(Object.keys(SETTINGS_DEFAULTS)));
  });

  it("includes the keys the storefront and the promo feature depend on", () => {
    const keys = plannedSettingKeys();
    for (const k of [
      "brand_name",
      "currency",
      "shipping_flat_cents",
      "promo_new_arrivals_product_id",
      "promo_best_sellers_product_id",
    ]) {
      expect(keys).toContain(k);
    }
  });
});

describe("partitionSettings", () => {
  it("keeps a live key and retires a dead one", () => {
    const { keep, retire } = partitionSettings(
      ["brand_name", "legacy_demo_key", "currency"],
      plannedSettingKeys(),
    );
    expect(keep).toEqual(["brand_name", "currency"]);
    expect(retire).toEqual(["legacy_demo_key"]);
  });

  it("retires nothing when every row is live", () => {
    const live = plannedSettingKeys();
    const { retire } = partitionSettings(live, live);
    expect(retire).toEqual([]);
  });
});
