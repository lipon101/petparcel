import { describe, expect, it } from "vitest";
import {
  FOOTER_AISLE_LIMIT,
  HEADER_AISLE_LIMIT,
  HEADER_CHILD_LIMIT,
  curateFooterNav,
  curateHeaderNav,
  curateNav,
  hiddenAisleCount,
  type NavNode,
} from "./nav-curation";

const node = (
  name: string,
  productCount: number,
  children: { name: string; productCount: number }[] = [],
): NavNode => ({ name, productCount, children });

describe("curateNav", () => {
  it("puts stocked aisles ahead of empty ones while keeping the incoming order inside each group", () => {
    const nodes = [
      node("Empty A", 0),
      node("Stocked A", 3),
      node("Empty B", 0),
      node("Stocked B", 1),
    ];
    expect(curateNav(nodes, 10, 0).map((n) => n.name)).toEqual([
      "Stocked A",
      "Stocked B",
      "Empty A",
      "Empty B",
    ]);
  });

  it("caps the aisles at the limit", () => {
    const nodes = Array.from({ length: 12 }, (_, i) => node(`Aisle ${i}`, i));
    expect(curateNav(nodes, 4, 0)).toHaveLength(4);
  });

  it("offers only stocked subcategories, capped, in order", () => {
    const nodes = [
      node("Pet Toys", 5, [
        { name: "Empty Child", productCount: 0 },
        { name: "Chew Toys", productCount: 2 },
        { name: "Plush Toys", productCount: 1 },
        { name: "Chase Toys", productCount: 4 },
      ]),
    ];
    const [aisle] = curateNav(nodes, 4, 2);
    // The stocked ones in the order they arrived, capped - the empty child is
    // neither shown nor given a slot.
    expect(aisle.children.map((c) => c.name)).toEqual(["Chew Toys", "Plush Toys"]);
  });

  it("shows no subcategories when none of them are stocked (never padded with empty shelves)", () => {
    const nodes = [
      node("Bird Supplies", 4, [
        { name: "Bird Cages", productCount: 0 },
        { name: "Bird Toys", productCount: 0 },
      ]),
    ];
    expect(curateNav(nodes, 4, 4)[0].children).toEqual([]);
  });

  it("carries each aisle's own count through untouched (the roll-up the endpoint sent)", () => {
    const [aisle] = curateNav([node("Pet Toys", 7, [])], 4, 4);
    expect(aisle.productCount).toBe(7);
  });

  it("returns nothing for no nodes", () => {
    expect(curateNav([], 6, 4)).toEqual([]);
  });
});

describe("curateHeaderNav / curateFooterNav", () => {
  const nodes = Array.from({ length: 15 }, (_, i) => node(`Aisle ${String(i).padStart(2, "0")}`, 15 - i));

  it("uses the header's own limits", () => {
    expect(curateHeaderNav(nodes)).toHaveLength(HEADER_AISLE_LIMIT);
  });

  it("uses the footer's own limits and shows no subcategories there", () => {
    const footer = curateFooterNav([
      node("Pet Toys", 3, [{ name: "Pet Chew Toys", productCount: 2 }]),
    ]);
    expect(footer[0].children).toEqual([]);
    expect(footer).toHaveLength(1);
    expect(FOOTER_AISLE_LIMIT).toBeGreaterThan(0);
  });

  it("keeps the header's subcategory cap small enough to scan", () => {
    expect(HEADER_CHILD_LIMIT).toBeLessThanOrEqual(5);
  });
});

describe("hiddenAisleCount", () => {
  it("reports what the cap is holding back", () => {
    expect(hiddenAisleCount([node("a", 1), node("b", 1), node("c", 1)], 2)).toBe(1);
  });

  it("never goes negative when everything fits", () => {
    expect(hiddenAisleCount([node("a", 1)], 6)).toBe(0);
  });
});
