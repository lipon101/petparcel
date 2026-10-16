import { describe, expect, it } from "vitest";
import {
  classifyDimension,
  dimensionAriaLabel,
  dimensionHeading,
  isOptionlessToken,
  looksLikeSupplierCode,
  parseDimensionSchema,
} from "./cj-option-schema";

// The supplier states each product's option dimensions itself, in `productKeyEn`
// / `productKey`. These tests pin the vocabulary mapping and the two shapes the
// supplier writes - because a heading the supplier never used is exactly what
// made the buy box look like a placeholder.
describe("classifyDimension - the supplier's words, mapped without inventing", () => {
  it("maps the supplier's COLOR to the storefront's 'Colour'", () => {
    expect(classifyDimension("COLOR")).toEqual({ token: "COLOR", kind: "color", label: "Colour" });
    expect(classifyDimension("Color").kind).toBe("color");
  });

  it("maps SIZE, including the supplier's Chinese form", () => {
    expect(classifyDimension("SIZE").label).toBe("Size");
    expect(classifyDimension("\u5c3a\u5bf8").label).toBe("Size");
  });

  it("maps a quantity dimension to 'Pack', not to 'Colour'", () => {
    expect(classifyDimension("QTY").label).toBe("Pack");
    expect(classifyDimension("Quantity").label).toBe("Pack");
    expect(classifyDimension("QTY").kind).toBe("pack");
  });

  it("maps Set to 'Set'", () => {
    expect(classifyDimension("Set")).toEqual({ token: "Set", kind: "set", label: "Set" });
  });

  it("maps the supplier's Chinese colour token", () => {
    expect(classifyDimension("\u989c\u8272").label).toBe("Colour");
  });

  it("carries an unknown dimension's own word through as its heading", () => {
    expect(classifyDimension("Metal").label).toBe("Metal");
  });

  it("gives a supplier's internal CODE no heading at all", () => {
    // "CJ7KHPLFMSHY" is not a word a shopper can read, so it must never become
    // a heading - the caller falls back to reading the option VALUES instead.
    const d = classifyDimension("CJ7KHPLFMSHY");
    expect(d.label).toBe("");
    expect(looksLikeSupplierCode("CJ7KHPLFMSHY")).toBe(true);
    expect(looksLikeSupplierCode("Color")).toBe(false);
  });
});

describe("parseDimensionSchema - both shapes the supplier writes", () => {
  it("parses a JSON array of tokens", () => {
    const dims = parseDimensionSchema('["COLOR","SIZE"]');
    expect(dims.map((d) => d.label)).toEqual(["Colour", "Size"]);
  });

  it("parses a delimited string", () => {
    const dims = parseDimensionSchema("Color-Size");
    expect(dims.map((d) => d.label)).toEqual(["Colour", "Size"]);
  });

  it("drops the optionless marker, so a Default listing has NO dimensions", () => {
    expect(parseDimensionSchema('["Default"]')).toEqual([]);
    expect(parseDimensionSchema("Default")).toEqual([]);
    expect(parseDimensionSchema("Default Title")).toEqual([]);
    expect(isOptionlessToken("Default Title")).toBe(true);
  });

  it("returns nothing for a product with no stated schema", () => {
    expect(parseDimensionSchema(null)).toEqual([]);
    expect(parseDimensionSchema(undefined)).toEqual([]);
    expect(parseDimensionSchema("")).toEqual([]);
  });

  it("deduplicates a schema the supplier repeats", () => {
    expect(parseDimensionSchema('["COLOR","COLOR","SIZE"]').length).toBe(2);
  });
});

describe("the heading and the accessible label", () => {
  it("never heads anything with the optionless marker", () => {
    expect(dimensionHeading(classifyDimension("Default"))).toBeNull();
    expect(dimensionHeading(null)).toBeNull();
  });

  it("heads with the supplier's own word", () => {
    expect(dimensionHeading(classifyDimension("Set"))).toBe("Set");
    expect(dimensionHeading(classifyDimension("QTY"))).toBe("Pack");
  });

  it("describes each dimension in the inclusive wording the store uses", () => {
    expect(dimensionAriaLabel(classifyDimension("COLOR"))).toBe("Choose a colour");
    expect(dimensionAriaLabel(classifyDimension("SIZE"))).toBe("Choose a size");
    expect(dimensionAriaLabel(classifyDimension("QTY"))).toBe("Choose a pack size");
  });
});
