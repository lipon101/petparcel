// ── Money, in integer cents ──────────────────────────────────────────────────
//
// WHY THIS FILE EXISTS. The checkout the store sends to the payment provider
// must equal the order total EXACTLY - not to within a cent, not "after
// rounding". A one-cent difference is a real failure: a checkout for $84.96
// when the order says $84.97 settles to `underpaid`, which this store
// deliberately refuses to ship.
//
// The store holds money as INTEGER CENTS everywhere (the DB columns, the cart,
// the settings). The only lossy step is converting cents to the major unit the
// provider's API expects (`price_amount` is dollars, e.g. `84.97`), and the only
// place that can drift is a float division by 100 compounded with a second
// rounding. So the conversion happens ONCE, here, and is asserted round-trip-safe
// against the integer the order was stored with.
//
// The rules this module enforces:
//   * amounts in this codebase are integers (a fractional cent is a bug, not a
//     rounding opportunity);
//   * `centsToMajor` is the single, documented cents→dollars conversion;
//   * `majorToCents` is its exact inverse for every amount the store can hold, so
//     the value sent to the provider converts back to precisely the stored total.

/** A safe, non-negative integer cent amount. */
export function toCents(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

/** True when `value` is an exact integer number of cents. */
export function isIntegerCents(value: number): boolean {
  return Number.isInteger(value);
}

/**
 * Convert integer cents to the major-unit amount the provider's API expects.
 *
 * The result is rounded to 2 decimals to strip binary-float representation noise
 * (`8497 / 100` is `84.97` exactly in the shortest decimal form JS prints, but
 * values like `1234 / 100` can print as `12.34` only after this round). The
 * round is a no-op for every integer-cent input: `majorToCents(centsToMajor(n))`
 * === `n` for all n in the range this store can hold, which the tests assert.
 */
export function centsToMajor(cents: number): number {
  return Math.round(toCents(cents)) / 100;
}

/**
 * Convert a major-unit amount back to integer cents - the exact inverse of
 * `centsToMajor` for integer-cent inputs.
 *
 * Used to VERIFY, not to compute: after the provider echoes the invoice amount
 * back, converting it and comparing to the stored total is what proves no drift
 * occurred between "what the customer owes" and "what was charged".
 */
export function majorToCents(major: number | string | null | undefined): number {
  const n = typeof major === "string" ? Number(major) : Number(major ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Format integer cents as a plain major-unit string, e.g. `84.97`. */
export function formatMajor(cents: number): string {
  return (toCents(cents) / 100).toFixed(2);
}

/**
 * The order total, from its parts, in integer cents.
 *
 * `subtotalCents` must already be the sum of the server-resolved line prices;
 * shipping and tax are each computed by the caller from settings. Kept here so
 * the arithmetic is one expression that a test can pin, rather than being
 * re-derived (and re-rounded) at each call site.
 */
export function orderTotalCents(parts: {
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
}): number {
  return toCents(parts.subtotalCents) + toCents(parts.shippingCents) + toCents(parts.taxCents);
}

/**
 * Tax on a subtotal at `rateBps` basis points (825 = 8.25%), in integer cents.
 *
 * Rounded HALF-UP on the integer product, not on a float percentage: computing
 * `subtotal * 8.25 / 100` in floating point and rounding the result can land a
 * cent below the exact value for a large cart, which would then disagree with the
 * invoice. The integer form `round(subtotal * bps / 10000)` has no such drift.
 */
export function taxCentsFor(subtotalCents: number, rateBps: number): number {
  const sub = toCents(subtotalCents);
  const bps = Number.isFinite(rateBps) ? Math.round(rateBps) : 0;
  if (bps <= 0) return 0;
  return Math.round((sub * bps) / 10000);
}

/**
 * Shipping for a subtotal, from the store's settings.
 *
 * Free at or above the threshold; otherwise the flat rate. Extracted so the rule
 * is stated once and the price-integrity test can exercise the boundary.
 */
export function shippingCentsFor(
  subtotalCents: number,
  settings: { shipping_flat_cents: number; free_shipping_threshold_cents: number },
): number {
  const sub = toCents(subtotalCents);
  const threshold = toCents(settings.free_shipping_threshold_cents);
  if (threshold > 0 && sub >= threshold) return 0;
  return toCents(settings.shipping_flat_cents);
}
