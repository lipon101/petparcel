import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OPTION_KIND_OPTIONS, buildOptionCombos, splitList } from "./product-options";

// The app's vitest runs in a node environment (no DOM), so the pure option
// arithmetic is tested directly and the page's WIRING is pinned by reading the
// source text - the same approach the other admin tests use.

describe("splitList", () => {
  it("splits on commas and newlines and trims", () => {
    expect(splitList("S, M, L")).toEqual(["S", "M", "L"]);
    expect(splitList("Black\nBlue\nRed")).toEqual(["Black", "Blue", "Red"]);
    expect(splitList("  Small , Large  ")).toEqual(["Small", "Large"]);
  });

  it("drops empty entries so a trailing comma makes no blank option", () => {
    expect(splitList("S,M,,L,")).toEqual(["S", "M", "L"]);
    expect(splitList("   ")).toEqual([]);
    expect(splitList("")).toEqual([]);
  });
});

describe("buildOptionCombos", () => {
  it("returns the sizes for a size product", () => {
    expect(buildOptionCombos("size", ["S", "M", "L"], [])).toEqual(["S", "M", "L"]);
  });

  it("returns the colours for a colour product", () => {
    expect(buildOptionCombos("color", [], ["Black", "Blue"])).toEqual(["Black", "Blue"]);
  });

  it("returns the size x colour cross product in size-major order", () => {
    const out = buildOptionCombos("sizeColor", ["S", "M"], ["Black", "Blue"]);
    expect(out).toEqual(["S \u00b7 Black", "S \u00b7 Blue", "M \u00b7 Black", "M \u00b7 Blue"]);
    // every size keeps its colours together, so the table reads S/M/L per colour
    expect(out.indexOf("S \u00b7 Black")).toBeLessThan(out.indexOf("M \u00b7 Black"));
  });

  it("yields nothing for a half-filled combination", () => {
    expect(buildOptionCombos("sizeColor", ["S", "M"], [])).toEqual([]);
    expect(buildOptionCombos("sizeColor", [], ["Black"])).toEqual([]);
  });

  it("yields nothing when there are no options", () => {
    expect(buildOptionCombos("none", ["S"], ["Black"])).toEqual([]);
  });
});

describe("OPTION_KIND_OPTIONS", () => {
  it("offers exactly the four shapes the editor supports", () => {
    expect(OPTION_KIND_OPTIONS.map((o) => o.value)).toEqual(["none", "size", "color", "sizeColor"]);
    expect(OPTION_KIND_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });
});

describe("ProductEditor wiring", () => {
  const source = readFileSync(resolve(__dirname, "pages/ProductEditor.tsx"), "utf8");

  it("offers the option-type picker and the list inputs", () => {
    expect(source).toContain("OPTION_KIND_OPTIONS");
    expect(source).toContain("buildOptionCombos");
    expect(source).toContain("Generate options");
    expect(source).toContain('aria-label="Sizes"');
    expect(source).toContain('aria-label="Colours"');
  });

  it("generates ordinary variant drafts that save through the same path", () => {
    // the generated rows carry the same fields a hand-added variant does
    expect(source).toMatch(/name: label, sku: "", price: base, inventoryQty: "0", active: true/);
  });
});
