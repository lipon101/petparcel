import { describe, expect, it } from "vitest";
import { dropTarget, isBelowMidpoint, moveId, moveItem } from "./category-reorder";

describe("moveItem", () => {
  it("moves an item down", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("moves an item up", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("returns a copy for a no-op move", () => {
    const input = ["a", "b"];
    const out = moveItem(input, 1, 1);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("clamps out-of-range indices instead of corrupting the list", () => {
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 0, 9)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });

  it("never mutates the input", () => {
    const input = ["a", "b", "c"];
    moveItem(input, 0, 2);
    expect(input).toEqual(["a", "b", "c"]);
  });
});

describe("moveId", () => {
  it("moves an id up one place", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
  });

  it("moves an id down one place", () => {
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("clamps at the ends so the first/last row cannot escape", () => {
    expect(moveId(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });

  it("returns a copy when the id is absent", () => {
    const input = ["a", "b"];
    const out = moveId(input, "zz", 1);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
});

describe("dropTarget", () => {
  it("lands BELOW the hovered row when dragging downwards", () => {
    // [a,b,c,d,e,f] - drag c (2) to just under f (5). Removing c first shifts
    // everything after it down one, so the destination is index 5.
    expect(dropTarget(2, 5, true)).toBe(5);
    expect(moveItem(["a", "b", "c", "d", "e", "f"], 2, dropTarget(2, 5, true))).toEqual([
      "a",
      "b",
      "d",
      "e",
      "f",
      "c",
    ]);
  });

  it("lands ABOVE the hovered row when dragging downwards", () => {
    expect(dropTarget(2, 5, false)).toBe(4);
    expect(moveItem(["a", "b", "c", "d", "e", "f"], 2, dropTarget(2, 5, false))).toEqual([
      "a",
      "b",
      "d",
      "e",
      "c",
      "f",
    ]);
  });

  it("lands ABOVE the hovered row when dragging upwards", () => {
    expect(dropTarget(4, 1, false)).toBe(1);
    expect(moveItem(["a", "b", "c", "d", "e"], 4, dropTarget(4, 1, false))).toEqual([
      "a",
      "e",
      "b",
      "c",
      "d",
    ]);
  });

  it("lands BELOW the hovered row when dragging upwards", () => {
    expect(dropTarget(4, 1, true)).toBe(2);
    expect(moveItem(["a", "b", "c", "d", "e"], 4, dropTarget(4, 1, true))).toEqual([
      "a",
      "b",
      "e",
      "c",
      "d",
    ]);
  });

  it("is a no-op when dropped on itself", () => {
    expect(dropTarget(3, 3, false)).toBe(3);
    expect(dropTarget(3, 3, true)).toBe(3);
  });
});

describe("isBelowMidpoint", () => {
  it("splits a row at its vertical middle", () => {
    const rect = { top: 100, height: 40 };
    expect(isBelowMidpoint(rect, 110)).toBe(false);
    expect(isBelowMidpoint(rect, 121)).toBe(true);
  });
});
