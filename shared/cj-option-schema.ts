// The REAL option dimension names for a product, as the SUPPLIER states them.
//
// WHY THIS EXISTS. A product's option values in the catalogue are the supplier's
// own option text, e.g. "BLUE-M 100x50cm" or "2pcs" or "Default Title". Two
// things used to be missing, and both made the buy box look like a placeholder:
//
//   1. The NAME of each dimension. The word "Standard" is not an option; it is a
//      product that has no options at all. The word "2 pcs" is not a colour; it
//      is the supplier's QUANTITY dimension. Without the supplier's own
//      dimension names the picker guessed from the values alone and, for a
//      single-value product, could only print a vague heading ("Option").
//
//   2. The knowledge that a dimension may legitimately carry exactly ONE value.
//      A product whose real listing is `QTY: 1pack` really does have one option,
//      and saying so is honest - but the heading must be the supplier's own
//      dimension ("Pack"), not a generic "Option".
//
// WHERE IT COMES FROM. CJ's product endpoint states the dimensions itself, in
// `productKey` (the supplier's own words, e.g. `["COLOR","SIZE"]`), `productKeyEn`
// (the English form, e.g. "Color-Size"), `productPro` (`["COLOR","QTY","SET"]`)
// and `productProEn`. This module reads that schema and maps each dimension onto
// the vocabulary the storefront draws with, WITHOUT inventing anything:
//
//   COLOR / 颜色 / Color   -> "Colour"  (drawn as colour swatches)
//   SIZE / 尺寸 / Size     -> "Size"    (drawn as size chips)
//   QTY / 数量 / Quantity  -> "Pack"    (drawn as chips)
//   SET / Set              -> "Set"
//   Default / Title        -> the product has NO options: no heading is drawn
//
// It is deliberately dependency-free so it can be used from the sync script, the
// shared catalogue and the tests.

/** What a supplier dimension IS, which decides how the storefront draws it. */
export type SupplierDimensionKind = "color" | "size" | "pack" | "set" | "option";

export interface SupplierDimension {
  /** The supplier's own dimension token, e.g. "COLOR", "QTY", "Set". */
  token: string;
  kind: SupplierDimensionKind;
  /** The heading the buy box draws above the row: "Colour" / "Size" / "Pack". */
  label: string;
}

const LABEL: Record<SupplierDimensionKind, string> = {
  color: "Colour",
  size: "Size",
  pack: "Pack",
  set: "Set",
  option: "Option",
};

/**
 * Classify ONE supplier dimension token.
 *
 * A supplier token is compared case-insensitively and, because CJ reports the
 * same dimension in Chinese for some listings (`颜色` colour, `尺寸` size,
 * `数量` quantity), both spellings are recognised. Anything unrecognised becomes
 * a plain "Option" carrying the supplier's OWN word as the heading - never a
 * guess at what it means.
 */
export function classifyDimension(token: string): SupplierDimension {
  const raw = String(token ?? "").trim();
  const t = raw.toLowerCase().replace(/[\s_\-]+/g, "");
  if (!raw) return { token: raw, kind: "option", label: LABEL.option };
  if (t === "color" || t === "colour" || raw === "颜色") {
    return { token: raw, kind: "color", label: LABEL.color };
  }
  if (t === "size" || raw === "尺寸" || t === "dimension" || t === "measurement") {
    return { token: raw, kind: "size", label: LABEL.size };
  }
  if (t === "qty" || t === "quantity" || t === "count" || t === "pcs" || raw === "数量") {
    return { token: raw, kind: "pack", label: LABEL.pack };
  }
  if (t === "set" || t === "bundle" || t === "pack") {
    return { token: raw, kind: "set", label: LABEL.set };
  }
  // "Default"/"Title" is CJ's marker for "this product has no options" - not a
  // dimension a shopper picks. It is reported as such so the caller draws nothing.
  if (t === "default" || t === "title" || t === "defaulttitle") {
    return { token: raw, kind: "option", label: LABEL.option };
  }
  // A few listings state their dimension as the supplier's own internal code
  // ("CJ7KHPLFMSHY", "CJ040B9NOYHY"). That is not a word a shopper can read, so
  // it is reported as an unknown dimension carrying NO heading - the caller then
  // falls back to reading the VALUES, which is where the real answer is
  // ("BLACK" is a colour, so the heading becomes "Colour").
  if (looksLikeSupplierCode(raw)) {
    return { token: raw, kind: "option", label: "" };
  }
  // An unrecognised dimension written in lower case is still a real word the
  // supplier uses ("style"), so it is title-cased for the heading rather than
  // printed in the supplier's own case, which reads as a raw field name.
  if (/^[a-z]+$/.test(raw) && raw.length > 2) {
    return { token: raw, kind: "option", label: raw[0].toUpperCase() + raw.slice(1) };
  }
  return { token: raw, kind: "option", label: raw };
}

/** Is this dimension token a supplier's internal code rather than a word?
 *  Such a code is a long, unbroken alphanumeric string that is not a real word -
 *  it carries no meaning for a shopper and must never become a heading. */
export function looksLikeSupplierCode(token: string): boolean {
  const t = String(token ?? "").trim();
  if (!t) return true;
  // A one- or two-character token is a code fragment, not a dimension word.
  if (t.length <= 2) return true;
  if (t.length < 6) return false;
  if (!/^[A-Za-z0-9]+$/.test(t)) return false;
  // A real word of >=6 letters that is not shouting (e.g. "Colour", "Sizes").
  if (/^[A-Za-z]+$/.test(t) && t !== t.toUpperCase()) return false;
  if (/^[A-Za-z]+$/.test(t) && t.length <= 7) return false;
  // Supplier codes mix letters and digits, or are a long SHOUTED run.
  return /\d/.test(t) || t.length >= 8;
}

/** True when a supplier dimension token means "the product has no options". */
export function isOptionlessToken(token: string): boolean {
  const t = String(token ?? "").trim().toLowerCase().replace(/[\s_\-]+/g, "");
  return t === "default" || t === "title" || t === "defaulttitle" || t === "";
}

/**
 * Parse the supplier's dimension schema.
 *
 * Input is the raw `productKey` / `productKeyEn` string. CJ writes these in two
 * shapes and both are accepted:
 *   * a JSON array of tokens - `["COLOR","SIZE"]`, `["颜色","尺寸"]`
 *   * a delimited string - `Color-Size`, `COLOR-SIZE`
 *
 * Returns the dimensions IN ORDER, with no duplicates. An empty array means the
 * supplier stated no dimensions (or only the optionless "Default"/"Title"), and
 * the caller should treat the product as having a single configuration.
 */
export function parseDimensionSchema(raw: string | null | undefined): SupplierDimension[] {
  const value = String(raw ?? "").trim();
  if (!value) return [];
  let tokens: string[] = [];
  // The delimiter between dimensions: a hyphen, pipe, slash or comma - and the
  // word "and". The supplier writes "Color-Size" and "Size-Color" most often, but
  // a real listing also states "Color and Size", which is TWO dimensions written
  // as one phrase; splitting on the word is what stops that from becoming a
  // single heading that reads "Color and Size".
  const split = (s: string): string[] => s.split(/\s+and\s+|[-|/,]/i);
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) tokens = parsed.map((x) => String(x)).flatMap(split);
    else if (typeof parsed === "string") tokens = split(parsed);
  } catch {
    tokens = split(value);
  }
  const out: SupplierDimension[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const trimmed = token.trim();
    if (!trimmed || isOptionlessToken(trimmed)) continue;
    if (seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    out.push(classifyDimension(trimmed));
  }
  return out;
}

/** The heading the buy box draws for a supplier dimension, or null when the
 *  product has no options and therefore draws no heading at all. */
export function dimensionHeading(dim: SupplierDimension | null | undefined): string | null {
  if (!dim) return null;
  const label = dim.label.trim();
  if (!label || isOptionlessToken(dim.token)) return null;
  // The supplier's own word is used verbatim for an unrecognised dimension, but
  // the optionless marker never becomes a heading.
  return label;
}

/** The singular possessive a chip row reads with, e.g. "Colour" -> "Choose a colour". */
export function dimensionAriaLabel(dim: SupplierDimension): string {
  switch (dim.kind) {
    case "color":
      return "Choose a colour";
    case "size":
      return "Choose a size";
    case "pack":
      return "Choose a pack size";
    case "set":
      return "Choose a set";
    default:
      return `Choose ${dim.label.toLowerCase()}`;
  }
}
