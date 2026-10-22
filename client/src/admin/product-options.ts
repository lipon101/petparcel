// Variant option shapes for the product editor.
//
// Products differ: some need sizes, some colours, some both, some neither. The
// editor offers those four shapes and this module turns the chosen one into the
// variant labels, so an admin never hand-types a cross-product list and each
// product ends up with the options that actually apply to it.
//
// Kept pure and separate from the page so the arithmetic is unit-tested without
// a DOM (the app's vitest runs in the node environment).

export type OptionKind = "none" | "size" | "color" | "sizeColor";

export const OPTION_KIND_OPTIONS: { value: OptionKind; label: string }[] = [
  { value: "none", label: "No options" },
  { value: "size", label: "Sizes" },
  { value: "color", label: "Colours" },
  { value: "sizeColor", label: "Sizes and colours" },
];

/** Split a comma- or newline-separated list into trimmed, non-empty labels. */
export function splitList(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The variant labels for a product's option shape.
 *
 *  `sizeColor` returns the cross product in size-major order, so the generated
 *  table reads S/M/L within each colour - the order a shopper scans. An empty
 *  side of a combination yields nothing rather than a dangling separator, so the
 *  caller can rely on a non-empty result meaning "safe to replace the table". */
export function buildOptionCombos(kind: OptionKind, sizes: string[], colors: string[]): string[] {
  if (kind === "size") return [...sizes];
  if (kind === "color") return [...colors];
  if (kind === "sizeColor") {
    if (sizes.length === 0 || colors.length === 0) return [];
    const out: string[] = [];
    sizes.forEach((s) => colors.forEach((c) => out.push(`${s} \u00b7 ${c}`)));
    return out;
  }
  return [];
}
