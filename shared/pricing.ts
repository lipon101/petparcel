// ── Retail pricing rule ──────────────────────────────────────────────────────
//
// ONE documented, configurable rule turns a REAL supplier cost into the price a
// customer pays. It exists so per-variant pricing is consistent across the whole
// catalogue instead of being hand-set per product, and so the margin is explicit
// rather than implied.
//
// THE RULE, in order:
//   1. target = cost × MARKUP_MULTIPLIER
//   2. target is raised to at least cost + MIN_MARGIN_CENTS, so a very cheap
//      item still clears a real absolute margin (payment fees + the shipping
//      subsidy on a small order) and the store can never sell at a loss.
//   3. the target is rounded UP to the next price ending in .99 - the standard
//      retail point - so the shelf price reads cleanly and the rounding can only
//      ever move the price UP, never below the margin floor.
//
// WHY 3×. CJ's own `variantSugSellPrice` (the supplier's suggested retail)
// averages ~5.8× cost across this catalogue, ranging 2.9×–9.5×. 3× sits at the
// conservative end of the supplier's own guidance: it leaves a ~67% gross margin
// - comfortably covering card fees, the free-shipping subsidy and returns -
// while keeping the shelf price well below what the supplier itself suggests, so
// the store stays the attractive place to buy. It is deliberately NOT the
// maximum the market would bear.
//
// CONFIGURABLE. Both numbers can be overridden per deployment with
// PRICING_MARKUP_MULTIPLIER / PRICING_MIN_MARGIN_CENTS, so the owner can tune
// the margin without a code change. The defaults are the documented policy.

/** Default markup over the real supplier cost. */
export const DEFAULT_MARKUP_MULTIPLIER = 3;

/** Default absolute margin floor, in cents ($5.00). */
export const DEFAULT_MIN_MARGIN_CENTS = 500;

/** Read a positive number from the environment, else the fallback. */
function envNumber(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

/** The active markup multiplier (env-overridable). */
export function markupMultiplier(): number {
  return envNumber("PRICING_MARKUP_MULTIPLIER", DEFAULT_MARKUP_MULTIPLIER);
}

/** The active absolute margin floor in cents (env-overridable). */
export function minMarginCents(): number {
  return Math.round(envNumber("PRICING_MIN_MARGIN_CENTS", DEFAULT_MIN_MARGIN_CENTS));
}

/**
 * Round a cent amount UP to the next price ending in .99.
 *
 * Monotonic and never below its input: the smallest N with `N*100 - 1 >= cents`.
 * So $30.75 → $30.99, $30.00 → $30.99, and an already-clean $30.99 stays put.
 */
export function cleanPricePoint(cents: number): number {
  const safe = Math.max(0, Math.round(cents));
  const n = Math.ceil((safe + 1) / 100);
  return n * 100 - 1;
}

/**
 * The retail price for a variant, from its REAL supplier cost.
 *
 * `costCents` is the live CJ `variantSellPrice` for that exact variant. The
 * result is always at least `costCents + minMarginCents()`, so the store never
 * sells below cost plus its floor, whatever the multiplier is set to.
 */
export function retailPriceCents(costCents: number): number {
  const cost = Math.max(0, Math.round(costCents));
  const byMarkup = Math.round(cost * markupMultiplier());
  const target = Math.max(byMarkup, cost + minMarginCents());
  return cleanPricePoint(target);
}

/** The gross margin (cents) a retail price leaves over a cost. */
export function marginCents(costCents: number, priceCents: number): number {
  return Math.max(0, Math.round(priceCents) - Math.round(costCents));
}

/** The gross margin as a fraction of the retail price (0–1). */
export function marginRatio(costCents: number, priceCents: number): number {
  const price = Math.round(priceCents);
  if (price <= 0) return 0;
  return marginCents(costCents, price) / price;
}
