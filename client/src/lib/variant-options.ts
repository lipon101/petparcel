// The buy-box option model, built from a product's REAL variants.
//
// This module is the thin, page-facing adapter over `@shared/variant-axes`,
// which is where the work of reading a product's option dimensions now lives.
// The split matters: the page needs a small, stable shape (a list of axes to
// draw, and a way to resolve a pick), while the axis logic needs to be shared
// with the server-side tests and the catalogue checks.
//
// WHY IT WAS REWRITTEN. The previous version decided which axis was the COLOUR
// and which the SIZE from the POSITION of the two halves of the stored label -
// "the part before the middle dot is the size, the part after is the colour".
// For a garment label like "S (14-20 in girth) . Black" that happens to be
// right, and for the towel's own label "BLUE-M . 100x50cm" it is exactly
// backwards: the first half is the COLOUR ("BLUE-M" is the supplier's fused
// "Blue, size M") and the second half is the SIZE ("100x50cm"). The page then
// offered a group headed "Choose a colour" whose options were sizes, and asked
// its colour-name table for a hex for "100x50cm" - which contains no colour
// word, so EVERY swatch fell through to the same neutral stone. Two identical
// grey dots, one of them wrongly disabled, on a product whose real options are
// five colours and two sizes: the fake-looking picker.
//
// The axes are now read from each option VALUE's meaning, never its position, so
// a colour-first and a colour-last label both work, a size group is never headed
// "Choose a colour", and one control is drawn per real option value.
import {
  buildVariantSelector,
  chipLabels,
  decomposeOption,
  displayName,
  colorHex,
  colorNeedsBorder,
  colorIsMulti,
  isPackCountLabel,
  isPlaceholderOptionLabel,
  type AxisKind,
  type AxisVariant,
  type SelectorAxis,
  type VariantSelection as AxisSelection,
} from "@shared/variant-axes";
import type { StoreVariant } from "./types";
import type { SupplierDimensions } from "@shared/variant-axes";

// Re-exported so the page keeps importing its swatch helpers from one place, and
// so every swatch is coloured by the SAME vocabulary the axes are read with.
export { colorHex, colorNeedsBorder, colorIsMulti, displayName, decomposeOption };

export type VariantAxis = "size_color" | "size" | "color" | "single";

export interface VariantSelection {
  size: string | null;
  color: string | null;
}

/** One dimension of the picker, ready to draw. */
export interface OptionAxis {
  kind: AxisKind;
  /** "Colour" | "Size" | "Option". */
  label: string;
  /** "Choose a colour" | "Choose a size" | "Choose an option". */
  ariaLabel: string;
  /** The REAL option values, in catalogue order. One control per value. */
  values: string[];
  /** True when this row's heading is the SUPPLIER'S OWN dimension name rather
   *  than one inferred from the values. A supplier-stated row is drawn even when
   *  it holds a single value - the listing really has that one option. */
  supplierStated: boolean;
  /** The token a chip shows for a value ("S (14-20 in girth)" -> "S"). */
  chipLabel: (value: string) => string;
  /** The proper display spelling ("PINK" -> "Pink") for the tooltip and label. */
  displayValue: (value: string) => string;
  /** Is this value buyable? Real stock only, given the other axis' live value. */
  available: (value: string, otherValue: string | null) => boolean;
}

export interface VariantOptions {
  /** The dimensions to draw, in order. Empty when there is nothing to choose. */
  axes: OptionAxis[];
  /** The live pick, as a (size, colour) pair. */
  defaultSelection: VariantSelection;
  /** The pair a press on `value` in `axisIndex` should select. */
  nextSelection: (axisIndex: number, value: string, sel: VariantSelection) => VariantSelection;
  /** The ONE real variant a (size, colour) pair resolves to, or null. */
  find: (size: string | null, color: string | null) => StoreVariant | null;

  // ── The LOSSLESS positional view. A (size, colour) pair can only carry two
  //    dimensions when one of them is a colour; a product whose two dimensions
  //    are BOTH non-colour (a pattern row and a size row) has no colour half, so
  //    the pair model wrote both axes into `size` and the pick resolved to
  //    nothing. These read one value per DRAWN AXIS, in axis order, so any
  //    number of dimensions survives. The page uses these. ──
  /** The live pick, one value per drawn axis (null where an axis is unset). */
  defaultAxisSelection: (string | null)[];
  /** The axis-order pick a press on `value` in `axisIndex` should select. */
  nextAxisSelection: (
    axisIndex: number,
    value: string,
    sel: (string | null)[],
  ) => (string | null)[];
  /** The ONE real variant an axis-order pick resolves to, or null. */
  findAxis: (sel: (string | null)[]) => StoreVariant | null;
  /** Resolve a (size, colour) pair, the page's primary path. Identical to
   *  `find` - kept as its own name because the page reads the pair as a whole. */
  resolve: (sel: VariantSelection) => StoreVariant | null;
  /** The CSS background for a colour swatch dot (handles a multicolour wheel). */
  swatchStyle: (value: string) => { background: string };
  /** A colour swatch needs a hairline border (white / very light shades). */
  swatchNeedsBorder: (value: string) => boolean;

  // ── The two-axis convenience view. `colors`/`sizes` are the COLOUR and the
  //    OTHER dimension whenever the product really has them, so the page's
  //    swatch row and chip row can read straight off this. ──
  sizes: string[];
  colors: string[];
  sizeAvailable: (size: string) => boolean;
  colorAvailable: (color: string, size: string | null) => boolean;
  colorsInStockFor: (size: string | null) => string[];
  shortLabel: (size: string) => string;
  sizeLabel: string;
  colorLabel: string;
  /** Nothing to choose between: the one real configuration. */
  singleLabel: string | null;
  /** The heading for that one configuration - the supplier's own dimension name
   *  ("Pack", "Set", "Colour") when it states one, else "Option". */
  singleLabelHeading: string | null;
  /** True when the supplier really states a dimension for this product, so the
   *  single-option row is genuinely an option ("QTY: 2pcs"). False when the
   *  supplier states none, which means the product has one configuration and no
   *  option row should be drawn at all. */
  singleDimensionStated: boolean;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** The CSS for a swatch dot: a real colour, and a conic wheel for a colourway
 *  that is genuinely several colours at once ("Multicolour", "Rainbow"). */
export function swatchBackground(value: string): string {
  if (colorIsMulti(value)) {
    return "conic-gradient(#e0574f, #e0b04f, #6cc06a, #4f9fe0, #a05fd0, #e0574f)";
  }
  return colorHex(value);
}

/** Build the picker model from a product's real variants.
 *
 *  `supplierDims` is the SUPPLIER'S OWN option schema for the product, as stored
 *  on its row. It supplies the dimension HEADINGS the values alone cannot always
 *  justify - a one-value listing whose real dimension is "Set" or "Pack" - and
 *  is what stops a real single-option product from collapsing into a bare value
 *  under a vague "Option" heading. */
export function buildVariantOptions(
  variants: StoreVariant[],
  supplierDims?: readonly SupplierDimensions[] | null,
): VariantOptions {
  const selector = buildVariantSelector(
    variants.map((v): AxisVariant => ({
      id: v.id,
      name: v.name,
      active: v.active,
      inventoryQty: v.inventoryQty,
    })),
    supplierDims,
  );

  const byId = new Map(variants.map((v) => [v.id, v]));
  const toStore = (v: AxisVariant | null): StoreVariant | null =>
    v ? (byId.get(v.id) ?? null) : null;

  const order: SelectorAxis[] = selector.axes;
  /** Where the colour axis sits, when the product has one. */
  const colorAxisIndex = order.findIndex((a) => a.kind === "color");
  /** Where the non-colour axis sits, when the product has one. */
  const otherAxisIndex = order.findIndex((_, i) => i !== colorAxisIndex);

  /** A page-shaped (size, colour) pair expressed in the selector's axis order. */
  const toAxisSelection = (sel: VariantSelection): AxisSelection => {
    if (order.length === 0) return { primary: variants[0]?.name ?? "", secondary: null };
    const values = order.map((axis) => (axis.kind === "color" ? sel.color : sel.size) ?? "");
    return order.length === 1
      ? { primary: values[0], secondary: null }
      : { primary: values[0], secondary: values[1] };
  };

  /** An axis-order selection expressed back as a page (size, colour) pair. */
  const toPageSelection = (sel: AxisSelection): VariantSelection => {
    const out: VariantSelection = { size: null, color: null };
    order.forEach((axis, i) => {
      const value = (i === 0 ? sel.primary : sel.secondary) || null;
      if (axis.kind === "color") out.color = value;
      else out.size = value;
    });
    return out;
  };

  const axes: OptionAxis[] = order.map((axis, i) => {
    const chip = chipLabels(axis.values);
    return {
      kind: axis.kind,
      label: axis.label,
      ariaLabel: axis.ariaLabel,
      values: axis.values,
      supplierStated: axis.supplierStated,
      chipLabel: (value) => (axis.kind === "color" ? displayName(value) : chip(value)),
      displayValue: (value) => displayName(value),
      available: (value, otherValue) => {
        const sel: AxisSelection =
          order.length <= 1
            ? { primary: value, secondary: null }
            : i === 0
              ? { primary: value, secondary: otherValue }
              : { primary: otherValue ?? "", secondary: value };
        return selector.valueAvailable(i, value, sel);
      },
    };
  });

  const resolve = (sel: VariantSelection): StoreVariant | null =>
    toStore(selector.find(toAxisSelection(sel)));
  const find = (size: string | null, color: string | null) => resolve({ size, color });

  // The lossless positional view: one value per DRAWN AXIS, in axis order. This
  // is what the page reads, so a product with two non-colour dimensions (a
  // pattern row and a size row) keeps both instead of collapsing them into the
  // single `size` slot of the pair model.
  const toAxisArray = (sel: AxisSelection): (string | null)[] =>
    order.length <= 1 ? [sel.primary || null] : [sel.primary || null, sel.secondary || null];
  const fromAxisArray = (sel: (string | null)[]): AxisSelection =>
    order.length <= 1
      ? { primary: sel[0] ?? "", secondary: null }
      : { primary: sel[0] ?? "", secondary: sel[1] ?? null };
  const findAxis = (sel: (string | null)[]): StoreVariant | null =>
    toStore(selector.find(fromAxisArray(sel)));
  const defaultAxisSelection = toAxisArray(selector.defaultSelection);
  const nextAxisSelection = (
    axisIndex: number,
    value: string,
    sel: (string | null)[],
  ): (string | null)[] => toAxisArray(selector.nextSelection(axisIndex, value, fromAxisArray(sel)));

  const colors = colorAxisIndex >= 0 ? order[colorAxisIndex].values : [];
  const sizes = otherAxisIndex >= 0 ? order[otherAxisIndex].values : [];
  const defaultSelection = toPageSelection(selector.defaultSelection);

  const sizeAvailable = (size: string): boolean =>
    otherAxisIndex >= 0 && probeAvailable(otherAxisIndex, size);

  /** Is `value` on `axisIndex` in stock, with the other axis left free? */
  const probeAvailable = (axisIndex: number, value: string): boolean => {
    for (const other of otherAxisIndex >= 0 ? order[otherAxisIndex].values : [null]) {
      const sel: AxisSelection =
        order.length <= 1
          ? { primary: value, secondary: null }
          : axisIndex === 0
            ? { primary: value, secondary: other }
            : { primary: other ?? "", secondary: value };
      if (selector.valueAvailable(axisIndex, value, sel)) return true;
    }
    return false;
  };

  const colorAvailable = (color: string, size: string | null): boolean => {
    if (colorAxisIndex < 0) return false;
    return selector.valueAvailable(
      colorAxisIndex,
      color,
      toAxisSelection({ size, color }),
    );
  };

  const shortLabel = chipLabels(sizes);
  // A lone variant whose label says NOTHING about which option it is (the
  // supplier's "as pic", "as shown", "Default Title", the store's "Standard")
  // is not a value a shopper can pick, and it is not something to print under a
  // heading: the live water fountain printed "COLOUR: as pic", which sold a
  // placeholder as a choice. So it is never shown - the buy box states one
  // configuration and says nothing about options.
  //
  // A bare PACK COUNT ("2 pcs", "1 pack") is different: it is a real value -
  // the pack size - and it answers the supplier's "Pack"/"Set" heading, so it
  // stays. It is only a stand-in when the dimension it would sit under is
  // asking for something else ("COLOUR: 1 box").
  const statedDimension = (supplierDims ?? [])
    .map((d) => `${d.token ?? ""} ${d.label ?? ""}`.trim())
    .filter(Boolean)
    .join(" ");
  const countDimension = /pack|qty|quantity|count|piece|pcs|\bset\b/i.test(statedDimension);
  const singleValue = selector.singleLabel;
  const singleName =
    singleValue !== null &&
    isPlaceholderOptionLabel(singleValue) &&
    !(isPackCountLabel(singleValue) && (countDimension || statedDimension === ""))
      ? null
      : singleValue;

  return {
    axes,
    defaultSelection,
    nextSelection: (axisIndex, value, sel) =>
      toPageSelection(selector.nextSelection(axisIndex, value, toAxisSelection(sel))),
    find,
    resolve,
    defaultAxisSelection,
    nextAxisSelection,
    findAxis,
    swatchStyle: (value) => ({ background: swatchBackground(value) }),
    swatchNeedsBorder: (value) => colorNeedsBorder(value),

    sizes,
    colors,
    sizeAvailable,
    colorAvailable,
    colorsInStockFor: (size) => colors.filter((c) => colorAvailable(c, size)),
    shortLabel,
    sizeLabel: otherAxisIndex >= 0 ? order[otherAxisIndex].label : "Option",
    colorLabel: colorAxisIndex >= 0 ? order[colorAxisIndex].label : "Colour",
    singleLabel: singleName,
    singleLabelHeading:
      singleName === null
        ? null
        : (selector.singleDimensionLabel ?? (selector.singleKind === "color" ? "Colour" : null)),
    singleDimensionStated: singleName !== null && selector.singleDimensionLabel !== null,
  };
}

/** A compact, canonical option label for a variant ("S (14-20 in girth) . Black"),
 *  for the sticky buy bar. Each half is read by its MEANING, not its position,
 *  and a fused supplier half ("BLUE-M" = Blue, size M) is split so the bar is
 *  never printed backwards as "100x50cm . BLUE-M".
 *
 *  Sized dimensions are listed first because that is the order the buy box draws
 *  them, so the bar and the page agree about the option the shopper picked. */
export function compactVariantLabel(name: string): string {
  const parts = name.split("\u00b7").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return displayName(name);
  const colored: string[] = [];
  const rest: string[] = [];
  for (const part of parts) {
    const d = decomposeOption(part);
    if (d.color && !d.rest) colored.push(d.color);
    else if (d.color) rest.push(`${d.color} ${d.rest}`.trim());
    else rest.push(part);
  }
  const out = unique([...rest, ...colored]);
  return out.length > 0 ? out.join(" \u00b7 ") : displayName(name);
}