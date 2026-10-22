// Pure stock-editing arithmetic for the admin Products page. Kept free of React
// and of any data source so the rules are trivially testable and identical
// wherever stock is edited.
//
// The store sells physical goods, so a quantity is always a non-negative whole
// number. The ceiling is deliberately generous but finite: it stops a fat-finger
// entry (or a paste) from writing an absurd number that would then be shown to
// shoppers, while never getting in the way of a real restock.

/** The largest quantity the editor will accept. */
export const MAX_STOCK = 100_000;

/** Coerce any input to a valid stock quantity: a whole number in [0, MAX_STOCK].
 *  A blank or unparseable value becomes 0 rather than NaN, so a half-typed field
 *  can never write a broken number. */
export function clampQty(value: number | string): number {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_STOCK, Math.max(0, Math.trunc(n)));
}

/** One stepper press. `delta` is +1 / -1 (or a larger jump); the result is
 *  clamped, so holding "down" at 0 stays at 0 and "up" at the ceiling stays
 *  there. */
export function stepQty(current: number, delta: number): number {
  return clampQty(clampQty(current) + delta);
}

/** Split a desired TOTAL across `count` variants as evenly as possible, giving
 *  the remainder to the first variants so the parts always sum to the total.
 *  Used by the "set total across variants" control: an owner who has 24 units
 *  and 3 variants gets 8/8/8, and 25 units gets 9/8/8. */
export function distributeTotal(total: number, count: number): number[] {
  const t = clampQty(total);
  if (count <= 0) return [];
  const base = Math.floor(t / count);
  const remainder = t - base * count;
  return Array.from({ length: count }, (_, i) => (i < remainder ? base + 1 : base));
}

/** The sum of a product's variant quantities - the number the list shows. */
export function totalStock(quantities: readonly number[]): number {
  return quantities.reduce((sum, q) => sum + clampQty(q), 0);
}
