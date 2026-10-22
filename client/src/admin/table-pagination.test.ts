import { describe, expect, it } from "vitest";
import { pageItems } from "./table";

describe("pageItems", () => {
  it("returns nothing for zero pages", () => {
    expect(pageItems(1, 0)).toEqual([]);
  });

  it("returns a single page for one page", () => {
    expect(pageItems(1, 1)).toEqual([1]);
  });

  it("lists every page when the count fits the window", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("collapses the right gap when near the start", () => {
    expect(pageItems(1, 20)).toEqual([1, 2, "ellipsis", 20]);
    expect(pageItems(2, 20)).toEqual([1, 2, 3, "ellipsis", 20]);
  });

  it("collapses both gaps in the middle", () => {
    expect(pageItems(10, 20)).toEqual([1, "ellipsis", 9, 10, 11, "ellipsis", 20]);
  });

  it("collapses the left gap when near the end", () => {
    expect(pageItems(20, 20)).toEqual([1, "ellipsis", 19, 20]);
    expect(pageItems(19, 20)).toEqual([1, "ellipsis", 18, 19, 20]);
  });

  it("always includes the first and last page", () => {
    const items = pageItems(50, 100);
    expect(items[0]).toBe(1);
    expect(items[items.length - 1]).toBe(100);
  });

  it("clamps an out-of-range current page", () => {
    expect(pageItems(999, 20)).toEqual([1, "ellipsis", 19, 20]);
    expect(pageItems(0, 20)).toEqual([1, 2, "ellipsis", 20]);
  });
});
