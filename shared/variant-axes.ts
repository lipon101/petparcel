// Derive a product's REAL option dimensions from its real variant labels.
//
// WHY THIS EXISTS. A variant label is the supplier's own option text, e.g.
// "BLUE-M 100x50cm" or "L . Red" or "Wine Red Three People . 190x230cm". The
// storefront used to decide which axis was a COLOUR and which a SIZE from the
// POSITION of the two halves of the label - "the part before the middle dot is
// the size, the part after is the colour". For a garment-style label like
// "S . Military Green" that happens to be right. For the towel's own label
// "BLUE-M . 100x50cm" it is exactly backwards: the first half is the COLOUR
// ("BLUE-M" is CJ's fused "Blue, size M") and the second half is the SIZE
// ("100x50cm"). The page therefore offered a "Choose a colour" group whose
// options were sizes, and asked a colour-name lookup for a hex for the string
// "100x50cm" - which has no colour word in it, so EVERY swatch fell through to
// the same neutral stone. Two swatches, identical grey dots, one of them
// wrongly disabled: the fake-looking picker.
//
// THE FIX. Never infer an axis from position. Read each option VALUE and ask
// what it actually IS:
//
//   * a real colour name (a curated vocabulary of the colour words the
//     catalogue genuinely uses, each with its own accurate hex), or
//   * a real size (a garment token, a measurement, a pack count), or
//   * something else the shopper still has to choose (a style, a plug type, a
//     bundle name).
//
// Then pick the decomposition - colour x rest, or per-half, or a single flat
// axis - that actually FITS the product: every real variant must land on its own
// cell, and the grid must not be mostly holes. A product whose options really
// are a clean cross gets a clean two-step picker; a product whose options are NOT
// a clean cross gets one honest flat list rather than a grid of phantom choices.
//
// Nothing here invents an option, a colour or a hex for an option the product
// does not really have. Every value comes from the variant's own name, which is
// the supplier's own option text, and the SKU/VID/price/stock that a selection
// resolves to are the store's real per-variant rows.

export interface AxisVariant {
  id: string;
  name: string;
  active?: boolean;
  inventoryQty: number;
}

/** What an option axis actually is, which decides how it is drawn. */
export type AxisKind = "color" | "size" | "option";

export interface SelectorAxis {
  kind: AxisKind;
  /** The heading shown above the row: "Colour" / "Size" / "Option". */
  label: string;
  /** The accessible group label, e.g. "Choose a colour". */
  ariaLabel: string;
  values: string[];
  /** True when the heading came from the SUPPLIER'S OWN option schema rather
   *  than being inferred from the values. A supplier-stated row is drawn even
   *  when it carries one value, because the supplier's listing really has that
   *  one option and saying so is honest - whereas an inferred one-value row is a
   *  constant of the product, not a choice, and is not drawn at all. */
  supplierStated: boolean;
}

export interface VariantSelection {
  primary: string;
  secondary: string | null;
}

export interface VariantSelector {
  /** One or two axes, or none when the product has nothing to choose between. */
  axes: SelectorAxis[];
  defaultSelection: VariantSelection;
  /** The one variant a selection resolves to, or null when it matches none. */
  find(sel: VariantSelection): AxisVariant | null;
  /** Every variant on one value of the primary axis. */
  variantsForPrimary(primary: string): AxisVariant[];
  /** Is this value in this axis buyable, given the rest of the selection? */
  valueAvailable(axisIndex: number, value: string, sel: VariantSelection): boolean;
  /** The first buyable value of an axis given the rest of the selection. */
  firstAvailable(axisIndex: number, sel: VariantSelection): string | null;
  /** The selection that results from choosing `value` on `axisIndex`. Never
   *  lands on an unbuyable pair: it carries the other axis across when that
   *  still works and falls back to the first buyable value when it does not. */
  nextSelection(axisIndex: number, value: string, sel: VariantSelection): VariantSelection;
  /** The single configuration, for a product with nothing to choose between. */
  singleLabel: string | null;
  singleKind: "color" | "option" | null;
  /** The SUPPLIER'S OWN heading for the single configuration, when the supplier
   *  states one ("Pack", "Set", "Colour"). Null when the supplier states no
   *  dimension at all, which is the honest "this product has no options" case. */
  singleDimensionLabel: string | null;
}

/** The supplier's own option schema for a product, as stored on the product row.
 *  Shape-compatible with `OptionDimension` in shared/cj-option-schema.ts, but
 *  declared here so the axis builder carries no import of the generated data. */
export interface SupplierDimensions {
  token: string;
  kind: string;
  label: string;
}

// ── The colour vocabulary ──────────────────────────────────────────────────
// Exactly the colour names the catalogue's real option values use, so a named
// colour always draws as THAT colour. Names are canonical (so "PINK", "Pink"
// and "pink" collapse to one swatch) and multi-word names are matched as
// phrases, longest first, so "Light Blue" never renders as "Blue".
interface ColorRule {
  name: string;
  hex: string;
  /** A colourway that is genuinely several colours - drawn as a rainbow dot. */
  multi?: boolean;
}

const COLOR_RULES: Record<string, ColorRule> = {
  black: { name: "Black", hex: "#1b1b1b" },
  white: { name: "White", hex: "#ffffff" },
  grey: { name: "Grey", hex: "#8a8a8a" },
  gray: { name: "Grey", hex: "#8a8a8a" },
  silver: { name: "Silver", hex: "#c3c7cb" },
  charcoal: { name: "Charcoal", hex: "#4a4a4a" },
  red: { name: "Red", hex: "#c0392b" },
  blue: { name: "Blue", hex: "#2f5fd0" },
  green: { name: "Green", hex: "#2e7d52" },
  yellow: { name: "Yellow", hex: "#e6c229" },
  orange: { name: "Orange", hex: "#e08a2b" },
  pink: { name: "Pink", hex: "#eb3594" },
  purple: { name: "Purple", hex: "#7a4fb5" },
  brown: { name: "Brown", hex: "#8b5e3c" },
  beige: { name: "Beige", hex: "#e2d6bf" },
  cream: { name: "Cream", hex: "#f1e5cf" },
  natural: { name: "Natural", hex: "#d8c9a8" },
  tan: { name: "Tan", hex: "#c8a878" },
  khaki: { name: "Khaki", hex: "#c3b091" },
  apricot: { name: "Apricot", hex: "#f2c49b" },
  coffee: { name: "Coffee", hex: "#6f4e37" },
  navy: { name: "Navy", hex: "#22315b" },
  teal: { name: "Teal", hex: "#2f9e9e" },
  gold: { name: "Gold", hex: "#c69a4e" },
  blush: { name: "Blush", hex: "#f6d9e0" },
  sage: { name: "Sage", hex: "#a8b5a0" },
  ivory: { name: "Ivory", hex: "#f6f2e6" },
  mint: { name: "Mint", hex: "#b7e4cf" },
  lavender: { name: "Lavender", hex: "#c3b1e1" },
  maroon: { name: "Maroon", hex: "#6e2233" },
  turquoise: { name: "Turquoise", hex: "#2ec4c4" },
  indigo: { name: "Indigo", hex: "#3b3b98" },
  violet: { name: "Violet", hex: "#8a5cd6" },
  magenta: { name: "Magenta", hex: "#d0209a" },
  lime: { name: "Lime", hex: "#a6d64a" },
  cyan: { name: "Cyan", hex: "#29b6d8" },
  peach: { name: "Peach", hex: "#f6b28a" },
  burgundy: { name: "Burgundy", hex: "#6b1f2e" },
  olive: { name: "Olive", hex: "#6b7a3a" },
  bronze: { name: "Bronze", hex: "#a97142" },
  copper: { name: "Copper", hex: "#b46b3f" },
  sand: { name: "Sand", hex: "#d9c9a3" },
  stone: { name: "Stone", hex: "#b3ab9d" },
  walnut: { name: "Walnut", hex: "#6b4a2f" },
  camel: { name: "Camel", hex: "#c19a6b" },
  coral: { name: "Coral", hex: "#ef6f6c" },
  rose: { name: "Rose", hex: "#e295a8" },
  chocolate: { name: "Chocolate", hex: "#5a3a22" },
  // A patterned colourway IS the colour the shopper picks, so it carries a hex
  // like any other rather than falling through to the neutral fallback.
  camo: { name: "Camo", hex: "#5f6b47" },
  camouflage: { name: "Camo", hex: "#5f6b47" },
  "gray camo": { name: "Gray Camo", hex: "#5f6b47" },
  "grey camo": { name: "Gray Camo", hex: "#5f6b47" },
  graycamo: { name: "Gray Camo", hex: "#5f6b47" },
  "leopard print": { name: "Leopard", hex: "#c39a5c" },
  leopard: { name: "Leopard", hex: "#c39a5c" },
  multicolor: { name: "Multicolour", hex: "#c76fa8", multi: true },
  multicolour: { name: "Multicolour", hex: "#c76fa8", multi: true },
  "multi color": { name: "Multicolour", hex: "#c76fa8", multi: true },
  "multi colour": { name: "Multicolour", hex: "#c76fa8", multi: true },
  rainbow: { name: "Rainbow", hex: "#c76fa8", multi: true },
  // Multi-word colourways, longest-phrase-first so the whole name wins.
  "light blue": { name: "Light Blue", hex: "#a9cdf0" },
  "sky blue": { name: "Sky Blue", hex: "#6cb4e8" },
  "dark blue": { name: "Dark Blue", hex: "#1f3b7a" },
  "navy blue": { name: "Navy Blue", hex: "#22315b" },
  "lake blue": { name: "Lake Blue", hex: "#2f8fbf" },
  "royal blue": { name: "Royal Blue", hex: "#2b4fd0" },
  "light green": { name: "Light Green", hex: "#a8d5a2" },
  "dark green": { name: "Dark Green", hex: "#1f5c3a" },
  "fluorescent green": { name: "Fluorescent Green", hex: "#7cf03d" },
  "military green": { name: "Military Green", hex: "#4b5320" },
  "army green": { name: "Army Green", hex: "#556b2f" },
  "green grey": { name: "Green Grey", hex: "#7f8c7a" },
  "light grey": { name: "Light Grey", hex: "#cfcfcf" },
  "light gray": { name: "Light Grey", hex: "#cfcfcf" },
  "dark grey": { name: "Dark Grey", hex: "#3f4448" },
  "dark gray": { name: "Dark Grey", hex: "#3f4448" },
  "bright red": { name: "Bright Red", hex: "#e63946" },
  "wine red": { name: "Wine Red", hex: "#7b2233" },
  "melon red": { name: "Melon Red", hex: "#e35d6a" },
  "rose red": { name: "Rose Red", hex: "#d14b6a" },
  "dark red": { name: "Dark Red", hex: "#8e1f2a" },
  "orange red": { name: "Orange Red", hex: "#d94f22" },
  "bright yellow": { name: "Bright Yellow", hex: "#f2d024" },
  "advanced yellow": { name: "Advanced Yellow", hex: "#d9a832" },
  "sunflower yellow": { name: "Sunflower Yellow", hex: "#f0b400" },
  "straw yellow": { name: "Straw Yellow", hex: "#e3c46a" },
  "fluorescent yellow": { name: "Fluorescent Yellow", hex: "#eaff00" },
  "light pink": { name: "Light Pink", hex: "#f4a6cf" },
  "rice pink": { name: "Rice Pink", hex: "#f0d5cd" },
  "dark brown": { name: "Dark Brown", hex: "#5a3a22" },
  "light brown": { name: "Light Brown", hex: "#c19a6b" },
  "beige brown": { name: "Beige Brown", hex: "#b39376" },
  "coffee color": { name: "Coffee", hex: "#6f4e37" },
  "coffee colour": { name: "Coffee", hex: "#6f4e37" },
  "light coffee": { name: "Light Coffee", hex: "#c8a887" },
  "gradient coffee": { name: "Gradient Coffee", hex: "#8d6b4f" },
  "grey stars blue": { name: "Grey Stars Blue", hex: "#4a6fb5" },
  "gray stars blue": { name: "Grey Stars Blue", hex: "#4a6fb5" },
  "light purple": { name: "Light Purple", hex: "#b79ce0" },
  "dark purple": { name: "Dark Purple", hex: "#5c3a8f" },
  // "Rubber colour" is the neutral grey the supplier actually ships.
  "rubber color": { name: "Rubber", hex: "#a8a49c" },
  "rubber colour": { name: "Rubber", hex: "#a8a49c" },
};

/** Phrases as WORD arrays, longest first, so "Bright Red" beats "Red". */
const COLOR_PHRASES: { words: string[]; rule: ColorRule }[] = Object.entries(COLOR_RULES)
  .map(([key, rule]) => ({ words: key.split(" "), rule }))
  .sort((a, b) => b.words.length - a.words.length);

/** Compact key ("lightblue") -> rule, so a fused all-lowercase name still hits. */
const COLOR_COMPACT: Record<string, ColorRule> = {};
for (const [key, rule] of Object.entries(COLOR_RULES)) {
  const compact = key.replace(/\s+/g, "");
  if (!(compact in COLOR_COMPACT)) COLOR_COMPACT[compact] = rule;
}

/** Hexes light enough to vanish on a white card, so the swatch carries a border. */
const LIGHT_HEXES = new Set(["#ffffff", "#f1e5cf", "#f6d9e0", "#e2d6bf", "#d8c9a8", "#f6f2e6"]);

/** A dot colour for a named colour, or a legible neutral for an unknown name. */
export function colorHex(name: string): string {
  return colorRule(name)?.hex ?? "#c9c2bd";
}

/** Does this named colour need a hairline border to stay visible? */
export function colorNeedsBorder(name: string): boolean {
  const rule = colorRule(name);
  if (!rule) return false;
  return LIGHT_HEXES.has(rule.hex);
}

/** A colourway that is genuinely several colours at once (multicolour/rainbow). */
export function colorIsMulti(name: string): boolean {
  return colorRule(name)?.multi === true;
}

/** The canonical display name for a colour value, when it is a colour at all. */
export function canonicalColor(name: string): string | null {
  return colorRule(name)?.name ?? null;
}

function colorRule(name: string): ColorRule | null {
  const direct = COLOR_RULES[name.trim().toLowerCase()];
  if (direct) return direct;
  const compact = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return COLOR_COMPACT[compact] ?? null;
}

// ── Tokenising an option value ─────────────────────────────────────────────
interface Token {
  text: string;
  start: number;
  end: number;
}

/** Word runs, then camel-case boundaries, each keeping its span in the source
 *  so a matched colour phrase can be cut back out of the original text. */
export function tokenizeWithSpans(s: string): Token[] {
  const out: Token[] = [];
  const runRe = /[A-Za-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = runRe.exec(s)) !== null) {
    const run = m[0];
    const base = m.index;
    // "DarkBrown" -> "Dark" | "Brown"; "GrayCamo" -> "Gray" | "Camo".
    const parts = run.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
    let cursor = 0;
    for (const part of parts) {
      const at = run.indexOf(part, cursor);
      out.push({ text: part, start: base + at, end: base + at + part.length });
      cursor = at + part.length;
    }
  }
  return out;
}

/** The longest colour phrase anywhere in the value, with the span it occupies. */
function findColorSpan(value: string): { rule: ColorRule; start: number; end: number } | null {
  const tokens = tokenizeWithSpans(value);
  for (let i = 0; i < tokens.length; i++) {
    for (const phrase of COLOR_PHRASES) {
      const end = i + phrase.words.length - 1;
      if (end >= tokens.length) continue;
      let hit = true;
      for (let k = 0; k < phrase.words.length; k++) {
        if (tokens[i + k].text.toLowerCase() !== phrase.words[k]) {
          hit = false;
          break;
        }
      }
      if (!hit) continue;
      // The words must be genuinely adjacent (only non-alphanumerics between),
      // so "Red" inside "Reddish" can never match.
      for (let k = i; k < end; k++) {
        if (/[A-Za-z0-9]/.test(value.slice(tokens[k].end, tokens[k + 1].start))) {
          // camelCase neighbours ("DarkBrown") sit flush; a gap of letters does not.
          if (tokens[k].end !== tokens[k + 1].start) { hit = false; break; }
        }
      }
      if (!hit) continue;
      return { rule: phrase.rule, start: tokens[i].start, end: tokens[end].end };
    }
  }
  // Nothing phrase-matched: a fused all-lowercase name may still be a colour.
  const whole = COLOR_COMPACT[value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")];
  if (whole) return { rule: whole, start: 0, end: value.length };
  return null;
}

/** An option value split into its colour (canonical) and everything else. */
export interface Decomposed {
  color: string | null;
  /** The value with the colour phrase cut out, trimmed of stray separators. */
  rest: string;
}

function tidy(s: string): string {
  // Collapse whitespace and strip separators from the EDGES only. Internal
  // characters are preserved verbatim, because the rest string doubles as the key
  // that resolves a pick back to the real variant row - collapsing an internal
  // "-" turned "S (14-20 in girth)" into "S (14 20 in girth)", which silently
  // missed every lookup and dropped the whole page onto the first colour.
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s\u00b7,\-\u2013\u2014/+]+/, "")
    .replace(/[\s\u00b7,\-\u2013\u2014/+]+$/, "")
    .trim();
}

export function decomposeOption(value: string): Decomposed {
  const raw = value.trim();
  const span = findColorSpan(raw);
  if (!span) return { color: null, rest: tidy(raw) };
  const rest = tidy(raw.slice(0, span.start) + " " + raw.slice(span.end));
  return { color: span.rule.name, rest };
}

/** A value with each colour phrase replaced by its canonical spelling, leaving
 *  everything else (sizes, measurements, punctuation) exactly as it stands. */
export function canonicalizeValue(value: string): string {
  const span = findColorSpan(value);
  if (!span) return value.trim();
  return (value.slice(0, span.start) + span.rule.name + value.slice(span.end))
    .replace(/\s+/g, " ")
    .trim();
}

// ── Size detection ─────────────────────────────────────────────────────────
const SIZE_WORD = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-9]xl|[2-9]l|[3-9]m)$/i;
const SIZE_PHRASE =
  /^(small|medium|large|x-?large|xx-?large|single|double|three people|four people|for four people|people|standard|size)$/i;
/** A bare measurement: "65cm", "100 x 50 x 30", "9m", "27L", "12.5 cm". */
const MEASURE = /^\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)*\s*(?:cm|mm|in|inch|inches|ft|feet|m|kg|g|lbs?|lb|ml|yards?|yds?|l|w|h)?$/i;
const PACK = /^\d+\s*(?:p|pcs|pc|pack|packs|box|boxes|pairs?|sets?)$/i;

function isSizeToken(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return SIZE_WORD.test(t) || SIZE_PHRASE.test(t) || MEASURE.test(t) || PACK.test(t);
}

/** Does this axis read as a size to a shopper? True only when EVERY value does,
 *  so a row of mixed values is headed "Option" rather than claiming to be a
 *  size. A value may carry extra words after the size ("M 100x50cm"). */
function looksLikeSize(values: string[]): boolean {
  if (values.length === 0) return false;
  return values.every((v) => {
    const tokens = v.trim().split(/\s+/);
    if (tokens.length === 0) return false;
    if (isSizeToken(tokens[0])) return true;
    // "Three people 190x230cm" / "M 100x50cm" - a size phrase split over words.
    return SIZE_PHRASE.test(tokens.slice(0, Math.min(2, tokens.length)).join(" "));
  });
}

// ── Building the selector ──────────────────────────────────────────────────
interface Row {
  variant: AxisVariant;
  parts: string[];
  /** The same halves with each colour phrase properly spelled, so a chip can
   *  show "Blue M 100x50cm" instead of the supplier's "BLUE-M 100x50cm" while the
   *  row still resolves through these very strings. */
  canonParts: string[];
  /** The whole value, canonicalised. */
  canonical: string;
  color: string | null;
  rest: string;
  sellable: boolean;
}

/** True when a lone variant's label says nothing about WHICH option it is, so it
 *  must not be dressed up as a chooser entry. These are the store's seeded
 *  "Standard", a supplier's bare "Default Title", a "1 pcs"-style pack value that
 *  carries no dimension, and the various "no variation" markers. A real value -
 *  a colour, a size, a style - is never a placeholder and is always shown. */
export function isPlaceholderOptionLabel(label: string): boolean {
  const s = String(label ?? "").trim().toLowerCase();
  if (!s) return true;
  if (PLACEHOLDER_LABELS.has(s)) return true;
  // A bare pack/count value with no dimension word ("2 pcs", "1box", "3 pack").
  if (/^\d+\s*(pcs?|pieces?|pack|packs|box|boxes|set|sets|pair|pairs|units?|ct|count)\b/.test(s)) return true;
  return false;
}

const PLACEHOLDER_LABELS = new Set([
  "standard",
  "default",
  "default title",
  "defaulttitle",
  "no variation",
  "none",
  "n/a",
  "na",
  "as shown",
  "as pic",
  "option",
  "option 1",
  "regular",
  "-",
]);

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

/** One way of splitting a product's real options into choosable axes. */
interface Candidate {
  /** The axis values, axis by axis, in the order they are drawn. */
  axes: string[][];
  /** What each axis IS, which decides how it is drawn and headed. */
  kinds: AxisKind[];
  /** The value each ROW sits on, per axis, in the same order as `axes`. A null
   *  means the row has no value there, so no pick can ever reach it. */
  valuesOf: (r: Row) => (string | null)[];
  /** Every variant occupies its OWN cell, so a pick resolves to one variant. */
  injective: boolean;
  /** The share of the grid's cells a real variant actually fills. */
  coverage: number;
  /** The supplier dimension EACH axis maps to, positionally, or null when there
   *  is no honest one-to-one assignment. Carried per-axis so a shape can be
   *  rejected for mixing dimensions into one axis - see `allRealDimensionsUsed`. */
  statedFor: (SupplierDimensions | null)[];
}

/** Score a candidate shape: it is only usable when a pick resolves to exactly
 *  one variant (injective) and the grid is not mostly holes. */
function buildCandidate(
  axes: string[][],
  kinds: AxisKind[],
  rows: Row[],
  valuesOf: (r: Row) => (string | null)[],
  /** The supplier's real dimensions, so each axis can be mapped to the one it
   *  IS. Positional when the counts line up; by kind when the shape draws fewer
   *  axes than the supplier states. */
  realDims: SupplierDimensions[] = [],
): Candidate {
  const cells = new Set<string>();
  let reachable = 0;
  for (const r of rows) {
    const v = valuesOf(r);
    if (v.some((x) => x === null)) continue;
    reachable += 1;
    cells.add(v.join("\u0000"));
  }
  const product = axes.reduce((n, a) => n * a.length, 1);
  // Map each axis to the supplier dimension it IS. The supplier's own KIND is
  // what decides: a colour axis belongs to the stated colour dimension even when
  // the supplier lists its dimensions in the other order (a "Size, Colour"
  // schema against axes that came out colour-first). Assigning by INDEX there
  // put the colours under a "Size" heading and the sizes under "Colour" - the
  // exact swap this exists to prevent. Each dimension is claimed at most once;
  // whatever is left over falls back to its position, and a "Colour" heading is
  // only ever given to an axis whose values really contain a colour.
  const DIM_KIND = (k: string): AxisKind =>
    /colou?r/i.test(k) ? "color" : /\bsizes?\b|measurement/i.test(k) ? "size" : "option";
  const axisHasAColour = (i: number): boolean =>
    (axes[i] ?? []).some((v) => decomposeOption(v).color !== null);
  const statedFor: (SupplierDimensions | null)[] = [];
  const claimed = new Set<SupplierDimensions>();
  for (let i = 0; i < axes.length; i += 1) {
    const byKind = realDims.find(
      (d) => !claimed.has(d) && kinds[i] !== "option" && DIM_KIND(d.kind) === kinds[i],
    );
    if (byKind) {
      statedFor.push(byKind);
      claimed.add(byKind);
    } else {
      statedFor.push(null);
    }
  }
  // The dimensions no axis claimed by kind, against the axes still unclaimed.
  const openAxes = axes.map((_, i) => i).filter((i) => statedFor[i] === null);
  const openDims = realDims.filter((d) => !claimed.has(d));
  for (const i of openAxes) {
    const pickDim = openDims.find(
      (d) =>
        !claimed.has(d) &&
        (DIM_KIND(d.kind) === "option" ||
          (DIM_KIND(d.kind) === "size" && kinds[i] === "size") ||
          // Never head a row "Colour" when it holds no colour at all.
          (DIM_KIND(d.kind) === "color" && axisHasAColour(i))),
    );
    if (pickDim) {
      statedFor[i] = pickDim;
      claimed.add(pickDim);
    }
  }
  return {
    axes,
    kinds,
    valuesOf,
    injective: reachable === rows.length && cells.size === rows.length,
    coverage: product === 0 ? 0 : reachable / product,
    statedFor,
  };
}

/** Does this axis read as a COLOUR row? True only when EVERY value is a pure
 *  colourway, so "Black | Blue" is a colour row and "S | M" is not. */
function looksLikeColor(values: string[]): boolean {
  if (values.length === 0) return false;
  return values.every((v) => {
    const d = decomposeOption(v);
    return d.color !== null && d.rest === "";
  });
}

/** The kind an axis takes from its own values: a colour when every value is a
 *  colourway, a size when every value reads as one, otherwise a plain option.
 *  Recognising the colour from the VALUES is what keeps the label honest
 *  whichever shape the decomposition arrived in. */
function kindOf(values: string[]): AxisKind {
  if (looksLikeColor(values)) return "color";
  return looksLikeSize(values) ? "size" : "option";
}

/** The canonical spelling of an option value, and the token a chip shows.
 *
 *  Both are presentation only - the value itself is never rewritten, because it
 *  is the key that resolves a pick back to the store's real variant row.
 *
 *  * A colour value becomes its proper name ("PINK" -> "Pink", "BLUE-M" stays
 *    intact because the size is part of the value), so a swatch tooltip is never
 *    the supplier shouting in capitals.
 *  * A size value drops a trailing measurement the shopper does not need on a
 *    chip ("S (14-20 in girth)" -> "S", "M 100x50cm" -> "M"). The measurement is
 *    only dropped when the remaining tokens still tell every value on the axis
 *    apart, so two values can never collapse onto one chip.
 */
export function chipLabels(values: string[]): (value: string) => string {
  const stripped = values.map(shortenSizeToken);
  const tellsApart = new Set(stripped).size === values.length;
  const canonical = new Map(values.map((v) => [v, displayName(v)]));
  return (value: string) => {
    if (tellsApart) return stripped[values.indexOf(value)] ?? value;
    return canonical.get(value) ?? value;
  };
}

function shortenSizeToken(value: string): string {
  const v = value.trim();
  // Drop a parenthetical first: "S (14-20 in girth)" -> "S".
  const bare = v.replace(/\s*\(.*?\)\s*/g, " ").trim();
  // A rest that still carries a dimension separator ("Bow . 26 Yards") is a
  // decoration followed by the real size, so the size segment is what belongs on
  // a chip - the whole string would print a product's own decoration as if it
  // were a size. A leading garment size wins; otherwise the last size segment.
  const segments = bare.split("\u00b7").map((s) => s.trim()).filter(Boolean);
  if (segments.length > 1) {
    // A LEADING garment size is the shopper's size: "M . 100x50cm" -> "M".
    if (isSizeToken(segments[0])) return segments[0];
    // A leading decoration is not a size, so the real size is the last segment
    // that reads as one: "Bow . 26 Yards" -> "26 Yards".
    for (let i = segments.length - 1; i >= 0; i--) {
      if (isSizeToken(segments[i])) return segments[i];
    }
  }
  const tokens = bare.split(/\s+/).filter(Boolean);
  // A leading garment token wins: "M . 100x50cm" -> "M", "XL 35-44cm" -> "XL".
  if (tokens.length > 1 && isSizeToken(tokens[0])) return tokens[0];
  // A two-word size phrase: "Three People . 190x230cm" -> "Three People".
  if (tokens.length > 2 && SIZE_PHRASE.test(tokens.slice(0, 2).join(" "))) {
    return tokens.slice(0, 2).join(" ");
  }
  // A measurement is the token already: "100x50cm" - its edge trim stands.
  return tokens.length > 1 ? tokens.join(" ") : bare || v;
}

/** The proper display spelling of an option value (colour names get capitalised). */
export function displayName(value: string): string {
  const rule = colorRule(value);
  if (rule) return rule.name;
  return value.trim();
}

export function buildVariantSelector(
  variants: AxisVariant[],
  /** The supplier's own option schema for this product, when the store has it.
   *  It supplies the DIMENSION HEADINGS ("Pack", "Set", "Specifications") that
   *  the values alone cannot always justify, and it is what lets a real
   *  single-option listing name its row instead of collapsing to a bare value. */
  supplierDims?: readonly SupplierDimensions[] | null,
): VariantSelector {
  const rows: Row[] = variants.map((variant) => {
    const raw = variant.name ?? "";
    const d = decomposeOption(raw);
    const parts = raw.split("\u00b7").map((p) => p.trim()).filter(Boolean);
    return {
      variant,
      parts,
      canonParts: parts.map((p) => canonicalizeValue(p)),
      canonical: canonicalizeValue(raw),
      color: d.color,
      rest: d.rest,
      sellable: variant.active !== false && variant.inventoryQty > 0,
    };
  });

  const colors = uniq(rows.map((r) => r.color).filter((c): c is string => c !== null));
  const everyRowHasColor = rows.length > 0 && rows.every((r) => r.color !== null);

  // The supplier's own stated dimensions, minus the ones it gives no heading for
  // (an internal code) or states as "Default"/"Title" (no options at all). Needed
  // here, before the shapes are built, because a stated dimension is what tells a
  // size+colour pair apart from a size+shape pair.
  const realDims = expandStatedDimensions(
    (supplierDims ?? []).filter((d) => (d.label ?? "").trim() !== ""),
  );

  // (a) COLOUR x REST. Built only when EVERY variant really carries a colour, so
  // an option that merely has a colour word inside it ("Rabbit door curtain")
  // can never masquerade as a colourway. This is the shape that fixes the
  // swapped-axis products: the towel's "BLUE-M" is the COLOUR and its
  // "100x50cm" is the rest, whatever order they sit in on the label.
  let colorXRest: Candidate | null = null;
  if (colors.length >= 2 && everyRowHasColor) {
    const restValues = uniq(rows.map((r) => r.rest));
    // Only when EVERY row carries a real second half. A row with an empty rest
    // ("Pink" beside "Pink 2L") has no second dimension to name, and filling the
    // blank with "Standard" would put a value on the page that the supplier never
    // listed - so that shape is refused and the flat list of real values is used.
    if (restValues.length >= 2 && rows.every((r) => r.rest !== "")) {
      colorXRest = buildCandidate(
        [colors, restValues],
        ["color", kindOf(restValues)],
        rows,
        (r) => [r.color, r.rest],
        realDims,
      );
    } else {
      colorXRest = buildCandidate([colors], ["color"], rows, (r) => [r.color], realDims);
    }
  }

  // (b) PER-HALF. The label really is "axis A . axis B", so its own halves are
  // used as they stand. A three-half label folds its tail into the last axis so
  // no value is lost.
  let perHalf: Candidate | null = null;
  const partCount = rows.length > 0 ? rows[0].parts.length : 0;
  if (partCount >= 2 && rows.every((r) => r.parts.length === partCount)) {
    const first = uniq(rows.map((r) => r.parts[0]));
    const tail = uniq(rows.map((r) => r.parts.slice(1).join(" \u00b7 ")));
    perHalf = buildCandidate(
      [first, tail],
      [kindOf(first), kindOf(tail)],
      rows,
      (r) => [r.parts[0], r.parts.slice(1).join(" \u00b7 ")],
      realDims,
    );
  }

  // (c) ONE FLAT AXIS. The honest fallback for a product whose options are not a
  // grid at all. Every value is a real buyable option and nothing is invented.
  const flatValues = uniq(rows.map((r) => r.variant.name));
  const flat = buildCandidate([flatValues], [kindOf(flatValues)], rows, (r) => [r.variant.name], realDims);

  // The supplier states how many dimensions this product really has. A shape is
  // only usable when it does not SWALLOW one dimension into another axis: if the
  // supplier states two (Colour, Size) a two-axis picker must show both, not one
  // axis that is really size+style under a single heading - that is how a picker
  // comes to offer "Colour: Khaki / Size: Small Bow" with no way to say which
  // binding. A shape that cannot map every stated dimension is dropped, and the
  // honest flat list is used instead.
  const statedCount = (c: Candidate): number => c.statedFor.filter((d) => d !== null).length;
  // Injectivity is the CORRECTNESS property (a pick must resolve to exactly one
  // variant). Coverage is only a comfort one: real supplier grids are sparse -
  // an 11-colour by 10-size listing holds 20 rows in 110 cells - and a high floor
  // here collapsed such a product to a single flat "Option" list, hiding both
  // real dimensions. The floor is kept low enough to reject an absurd shape while
  // letting a genuinely sparse grid through, and the best-covered shape is
  // preferred when more than one fits.
  const usableTwoAxis = (c: Candidate | null): c is Candidate =>
    c !== null &&
    c.axes.length === 2 &&
    c.injective &&
    c.coverage >= 0.15 &&
    statedCount(c) === Math.min(2, realDims.length);
  const twoStep = [colorXRest, perHalf]
    .filter(usableTwoAxis)
    .sort((a, b) => b.coverage - a.coverage);
  const oneStep = [colorXRest, flat].filter(
    (c): c is Candidate => c !== null && c.axes.length === 1 && c.axes[0].length >= 2,
  );
  const pick: Candidate = twoStep[0] ?? oneStep[0] ?? flat;

  // An axis carrying a single value is not a choice, so a one-chip row is never
  // drawn: the value is a constant of the product. The supplier's own heading for
  // that constant is reported separately below, which is what lets a genuine
  // single-option listing say "Set: 2 pcs" instead of a vague "Option".
  const keepAxis = (axisLength: number): boolean => axisLength > 1;
  const kept = pick.axes.map((a, i) => (keepAxis(a.length) ? i : -1)).filter((i) => i >= 0);
  const chosen: Candidate =
    kept.length === pick.axes.length
      ? pick
      : buildCandidate(
          kept.map((i) => pick.axes[i]),
          kept.map((i) => pick.kinds[i]),
          rows,
          (r) => {
            const v = pick.valuesOf(r);
            return kept.map((i) => v[i]);
          },
          realDims,
        );

  const axisValues = chosen.axes;
  const isSingle = axisValues.length === 0;

  const axes: SelectorAxis[] = isSingle
    ? []
    : axisValues.map((values, i) => {
        const kind = chosen.kinds[i] ?? kindOf(values);
        const stated = chosen.statedFor[i] ?? null;
        // The supplier's own word is used when it NAMES the dimension. A generic
        // supplier token ("Specification", "Specifications", "Style") names
        // nothing, so a colour row headed "Specification" would read as noise -
        // the canonical word for the axis the values actually are is used
        // instead. The values are unchanged either way.
        const statedLabel = stated?.label?.trim() ?? "";
        const statedIsGeneric = GENERIC_DIMENSION_LABEL.test(statedLabel);
        const label =
          stated && statedLabel && !statedIsGeneric
            ? capitalizeWord(statedLabel)
            : kind === "color"
              ? "Colour"
              : kind === "size"
                ? "Size"
                : "Option";
        const named = stated !== null && statedLabel !== "" && !statedIsGeneric;
        return {
          kind,
          label,
          ariaLabel: named
            ? `Choose ${label.toLowerCase()}`
            : kind === "color"
              ? "Choose a colour"
              : kind === "size"
                ? "Choose a size"
                : "Choose an option",
          values,
          supplierStated: stated !== null,
        };
      });

  /** The value a row sits on for one axis (null when it has none there). */
  const at = (r: Row, axisIndex: number): string | null => chosen.valuesOf(r)[axisIndex] ?? null;

  /** Value equality that tolerates the supplier's spelling: a caller holding the
   *  raw stored text ("PINK") still resolves against the canonical axis value
   *  ("Pink"), even though the two are different strings. */
  const eq = (a: string | null, b: string | null): boolean =>
    a !== null && b !== null && (a === b || canonicalizeValue(a) === canonicalizeValue(b));

  const find = (sel: VariantSelection): AxisVariant | null => {
    for (const r of rows) {
      if (isSingle) {
        if (eq(r.canonical, sel.primary) || eq(r.variant.name, sel.primary)) return r.variant;
        continue;
      }
      if (axisValues.length === 1) {
        if (eq(at(r, 0), sel.primary)) return r.variant;
        continue;
      }
      if (eq(at(r, 0), sel.primary) && eq(at(r, 1), sel.secondary)) return r.variant;
    }
    return null;
  };

  const variantsForPrimary = (primary: string): AxisVariant[] =>
    rows.filter((r) => eq(at(r, 0), primary)).map((r) => r.variant);

  const valueAvailable = (
    axisIndex: number,
    value: string,
    sel: VariantSelection,
  ): boolean => {
    if (isSingle) return rows.some((r) => r.sellable && eq(at(r, 0), value));
    if (axisIndex === 0) return rows.some((r) => r.sellable && eq(at(r, 0), value));
    return rows.some((r) => r.sellable && eq(at(r, 0), sel.primary) && eq(at(r, 1), value));
  };

  const firstAvailable = (axisIndex: number, sel: VariantSelection): string | null => {
    const values = axisValues[axisIndex] ?? [];
    for (const v of values) if (valueAvailable(axisIndex, v, sel)) return v;
    return values.length > 0 ? values[0] : null;
  };

  /** The first value on the SECOND axis buyable together with `primary` - used
   *  when a press needs a partner value the product really stocks. */
  const firstSecondaryWith = (primary: string): string | null => {
    for (const v of axisValues[1] ?? []) {
      if (rows.some((r) => r.sellable && at(r, 0) === primary && at(r, 1) === v)) return v;
    }
    return null;
  };

  /** The mirror of that helper, for the FIRST axis. */
  const firstPrimaryWith = (secondary: string): string | null => {
    for (const v of axisValues[0] ?? []) {
      if (rows.some((r) => r.sellable && at(r, 0) === v && at(r, 1) === secondary)) return v;
    }
    return null;
  };

  const nextSelection = (
    axisIndex: number,
    value: string,
    sel: VariantSelection,
  ): VariantSelection => {
    if (axisValues.length <= 1) return { primary: value, secondary: null };
    if (axisIndex === 0) {
      // The axis the shopper PRESSED always wins, and the other axis adjusts to
      // keep the pair real: the held value is carried across when the product
      // still stocks it, otherwise the column's first buyable value is taken.
      const carried = sel.secondary !== null && eq(firstSecondaryWith(value), sel.secondary);
      return {
        primary: value,
        secondary: carried ? sel.secondary : firstSecondaryWith(value),
      };
    }
    // The same rule for the second axis: honour the press, and move the first
    // axis to the first value really in stock alongside it. Keeping the old first
    // value and silently reverting the press is what made a size click look like
    // it did nothing.
    if (rows.some((r) => r.sellable && at(r, 0) === sel.primary && at(r, 1) === value)) {
      return { primary: sel.primary, secondary: value };
    }
    return { primary: firstPrimaryWith(value) ?? sel.primary, secondary: value };
  };

  // Default to the first buyable cell, falling back to the first row so a
  // sold-out product still draws its real options (greyed) rather than nothing.
  const firstRow = rows.find((r) => r.sellable) ?? rows[0] ?? null;
  const defaultSelection: VariantSelection = !firstRow
    ? { primary: "", secondary: null }
    : isSingle
      ? { primary: firstRow.variant.name, secondary: null }
      : {
          primary: at(firstRow, 0) ?? "",
          secondary: axisValues.length >= 2 ? at(firstRow, 1) : null,
        };

  const soleRow = rows[0] ?? null;
  const soleColor = soleRow ? decomposeOption(soleRow.variant.name).color : null;
  // A lone value that is the supplier's own INTERNAL CODE ("7018NATURAL" - one
  // unbroken run of letters and digits) tells a shopper nothing, so it is treated
  // exactly like a placeholder: the buy box states no configuration rather than
  // printing the supplier's code at a customer.
  const soleIsCode =
    soleRow !== null &&
    /^(?=.{4,}$)(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9]+$/.test((soleRow.variant.name ?? "").trim());
  // "Pure colour" means the WHOLE option is the colourway. "USA Plug (V1) . White"
  // contains a colour word but the option is the plug type, so it must not be
  // headed "Colour".
  const soleIsPureColor = soleColor !== null && (soleRow?.rest ?? "") === "";
  // "A product with one option states it" - see the return block below.
  return {
    axes,
    defaultSelection,
    find,
    variantsForPrimary,
    valueAvailable,
    firstAvailable,
    nextSelection,
    // A product with one option states it; a pure colourway gets its proper
    // spelling ("PINK" reads as "Pink") instead of the supplier's shouting.
    singleLabel:
      isSingle && soleRow && !soleIsCode ? (soleIsPureColor ? soleColor : soleRow.canonical) : null,
    singleKind: isSingle && soleRow && !soleIsCode ? (soleIsPureColor ? "color" : "option") : null,
    // The supplier's own heading for the one configuration. Reported only when
    // the supplier really states a dimension: an optionless listing ("Default"/
    // "Title", or no schema at all) gets null, so the page says the product comes
    // in one configuration rather than inventing a heading for it.
    singleDimensionLabel: isSingle && !soleIsCode ? honestDimensionHeading(realDims[0]) : null,
  };
}

/** A supplier token that names NO dimension a shopper can act on. These are
 *  filler or an internal abbreviation, so the buy box heads the row with the
 *  canonical word for the axis the VALUES actually are instead. A token that
 *  DOES name one ("Style", "Type", "Pack", "Set", "Electrical outlet") is kept
 *  verbatim - demoting those printed "Option" over a row of real styles, which
 *  is exactly the vague heading this list exists to prevent. */
const GENERIC_DIMENSION_LABEL =
  /^(specifications?|specs?|materials?|attributes?|options?|variants?|q|qty)$/i;

/** The supplier's own heading for a dimension, or null when its token names
 *  nothing readable ("Specifications", "Q", "Materials"). A lower-case real word
 *  ("style") is title-cased, because the supplier's raw field case reads as a
 *  database column rather than a heading. */
function honestDimensionHeading(dim: SupplierDimensions | undefined): string | null {
  const label = (dim?.label ?? "").trim();
  if (!label) return null;
  if (GENERIC_DIMENSION_LABEL.test(label)) return null;
  return capitalizeWord(label);
}

function capitalizeWord(raw: string): string {
  return /^[a-z]+$/.test(raw) ? raw[0].toUpperCase() + raw.slice(1) : raw;
}

/** The supplier sometimes states TWO dimensions in ONE token - `Color and Size`
 *  survives as a single stored token when the sync could not split it. It names
 *  both, so it is expanded into the two dimensions it really is, mapped to the
 *  canonical words for what it says. Nothing is guessed: the token's own words
 *  are the source. */
function expandStatedDimensions(dims: SupplierDimensions[]): SupplierDimensions[] {
  const out: SupplierDimensions[] = [];
  for (const d of dims) {
    if (/^colou?r\s*(?:and|&|\/|\+)\s*size$/i.test((d.label ?? "").trim())) {
      out.push({ token: "Color", kind: "color", label: "Colour" });
      out.push({ token: "Size", kind: "size", label: "Size" });
      continue;
    }
    out.push(d);
  }
  return out;
}