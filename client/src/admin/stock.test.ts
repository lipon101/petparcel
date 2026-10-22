import { describe, expect, it } from "vitest";
import { MAX_STOCK, clampQty, distributeTotal, stepQty, totalStock } from "./stock";

describe("clampQty", () => {
  it("keeps a valid whole number", () => {
    expect(clampQty(7)).toBe(7);
    expect(clampQty("12")).toBe(12);
  });

  it("floors a fractional value", () => {
    expect(clampQty(3.9)).toBe(3);
  });

  it("never goes below zero", () => {
    expect(clampQty(-5)).toBe(0);
    expect(clampQty("-1")).toBe(0);
  });

  it("caps at MAX_STOCK", () => {
    expect(clampQty(MAX_STOCK + 1)).toBe(MAX_STOCK);
    expect(clampQty(9_999_999)).toBe(MAX_STOCK);
  });

  it("turns a blank or unparseable value into 0, never NaN", () => {
    expect(clampQty("")).toBe(0);
    expect(clampQty("abc")).toBe(0);
    expect(clampQty(Number.NaN)).toBe(0);
  });
});

describe("stepQty", () => {
  it("steps up and down", () => {
    expect(stepQty(5, 1)).toBe(6);
    expect(stepQty(5, -1)).toBe(4);
  });

  it("stays at 0 when stepping down from 0", () => {
    expect(stepQty(0, -1)).toBe(0);
  });

  it("stays at the ceiling when stepping up from MAX_STOCK", () => {
    expect(stepQty(MAX_STOCK, 1)).toBe(MAX_STOCK);
  });

  it("clamps a non-integer current value first", () => {
    expect(stepQty(2.7, 1)).toBe(3);
  });
});

describe("distributeTotal", () => {
  it("splits evenly when it divides", () => {
    expect(distributeTotal(24, 3)).toEqual([8, 8, 8]);
  });

  it("gives the remainder to the first variants so the parts sum to the total", () => {
    expect(distributeTotal(25, 3)).toEqual([9, 8, 8]);
    expect(distributeTotal(25, 3).reduce((a, b) => a + b, 0)).toBe(25);
  });

  it("returns an empty list for no variants", () => {
    expect(distributeTotal(10, 0)).toEqual([]);
  });

  it("clamps the total before splitting", () => {
    expect(distributeTotal(-4, 2)).toEqual([0, 0]);
  });
});

describe("totalStock", () => {
  it("sums the variant quantities", () => {
    expect(totalStock([4, 6, 8])).toBe(18);
  });

  it("treats a bad value as 0", () => {
    expect(totalStock([4, Number.NaN, 6])).toBe(10);
  });
});
