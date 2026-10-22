// The low-stock threshold is an OWNER-EDITABLE setting, so its coercion has to
// be bullet-proof: a typo must never flag the whole catalogue as low (or hide a
// genuine shortage). These pin the clamping the Settings form and the
// store-settings reader both rely on.
import { describe, expect, it } from "vitest";
import {
  LOW_STOCK_MAX,
  LOW_STOCK_MIN,
  LOW_STOCK_THRESHOLD,
  SETTINGS_DEFAULTS,
  isLowStock,
  normalizeLowStockThreshold,
} from "./store";

describe("normalizeLowStockThreshold", () => {
  it("keeps a sensible integer as-is", () => {
    expect(normalizeLowStockThreshold(25)).toBe(25);
    expect(normalizeLowStockThreshold(1)).toBe(1);
    expect(normalizeLowStockThreshold(500)).toBe(500);
  });

  it("clamps out-of-range values instead of trusting them", () => {
    expect(normalizeLowStockThreshold(99999)).toBe(LOW_STOCK_MAX);
    expect(normalizeLowStockThreshold(0)).toBe(LOW_STOCK_MIN);
    expect(normalizeLowStockThreshold(-5)).toBe(LOW_STOCK_MIN);
  });

  it("rounds a fractional value to a whole number of units", () => {
    expect(normalizeLowStockThreshold(12.6)).toBe(13);
  });

  it("falls back to the default for blank or unparseable input", () => {
    expect(normalizeLowStockThreshold("")).toBe(LOW_STOCK_THRESHOLD);
    expect(normalizeLowStockThreshold(null)).toBe(LOW_STOCK_THRESHOLD);
    expect(normalizeLowStockThreshold(undefined)).toBe(LOW_STOCK_THRESHOLD);
    expect(normalizeLowStockThreshold("nonsense")).toBe(LOW_STOCK_THRESHOLD);
  });

  it("reads a numeric string (a form field always sends text)", () => {
    expect(normalizeLowStockThreshold("8")).toBe(8);
  });
});

describe("isLowStock", () => {
  it("flags at or below the threshold, and not above", () => {
    expect(isLowStock(10, 10)).toBe(true);
    expect(isLowStock(11, 10)).toBe(false);
    expect(isLowStock(0, 10)).toBe(true);
  });

  it("follows the threshold it is given, so one setting drives every surface", () => {
    expect(isLowStock(40, 10)).toBe(false);
    expect(isLowStock(40, 60)).toBe(true);
  });
});

describe("the low-stock setting is a first-class store setting", () => {
  it("ships a default inside the allowed range", () => {
    expect(SETTINGS_DEFAULTS.low_stock_threshold).toBe(LOW_STOCK_THRESHOLD);
    expect(SETTINGS_DEFAULTS.low_stock_threshold).toBeGreaterThanOrEqual(LOW_STOCK_MIN);
    expect(SETTINGS_DEFAULTS.low_stock_threshold).toBeLessThanOrEqual(LOW_STOCK_MAX);
  });
});
