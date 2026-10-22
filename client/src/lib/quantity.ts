// The quantity rules for the buy box's stepper and the basket line it feeds.
//
// The stepper used to be decorative. The input was `readOnly` and - more to the
// point - the ONE place the count was actually consumed, the add-to-cart call,
// silently dropped it, so every add landed in the basket as a single unit no
// matter what the shopper had dialled in. The arithmetic lives here, pure and
// DOM-free, so the stepper, the basket and the unit tests cannot disagree about
// what a valid quantity is.
//
// Two numbers govern one line:
//
//   * the FLOOR, always 1. Zero is not a line, it is a removal; the stepper must
//     never produce it, so "-" stops at one instead of vanishing the item.
//   * the CEILING, the stock actually on hand for the variant on screen, capped
//     at MAX_ORDER_QTY. The cap keeps a fat-fingered entry (or a scripted one)
//     from writing an absurd number into an order, while sitting far above any
//     real basket. An untracked line (null stock) allows the full cap.

/** The most units of a single line the store will sell in one order. */
export const MAX_ORDER_QTY = 99;

/** The smallest a line can be. A shopper removes a line; they never order zero. */
export const MIN_ORDER_QTY = 1;

/**
 * Coerce anything at all to a valid line quantity: a whole number in
 * [MIN_ORDER_QTY, ceiling].
 *
 * Every input that is not a finite number - a blank field, "abc", NaN, Infinity,
 * null - becomes a floor of 1 rather than NaN, so a half-typed or corrupted
 * value can never reach the basket. `ceiling` is itself floored at 1, so an
 * out-of-stock variant yields a range of exactly {1} instead of an impossible
 * one that would render a broken control.
 */
export function clampQuantity(value: number | string, ceiling: number = MAX_ORDER_QTY): number {
  const max = Math.max(MIN_ORDER_QTY, Math.floor(Number(ceiling)) || MIN_ORDER_QTY);
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return MIN_ORDER_QTY;
  return Math.min(max, Math.max(MIN_ORDER_QTY, Math.trunc(n)));
}

/**
 * One stepper press. `delta` is +1 for "+" and -1 for "-"; the result is
 * clamped, so holding "-" at the floor stays at 1 and holding "+" at the
 * ceiling stays there instead of running away.
 */
export function stepQuantity(
  current: number,
  delta: number,
  ceiling: number = MAX_ORDER_QTY,
): number {
  return clampQuantity(clampQuantity(current, ceiling) + delta, ceiling);
}

/**
 * The most units of a line a shopper may take: the stock on hand, capped at
 * MAX_ORDER_QTY.
 *
 * `null` / `undefined` mean the line is not stock-tracked, which allows the full
 * cap. Stock of 0 still yields a ceiling of 1 so the control keeps a valid range
 * - the variant being sold out is handled by disabling the buy buttons, not by
 * making the stepper's arithmetic undefined.
 */
export function orderCeiling(stock: number | null | undefined): number {
  if (stock === null || stock === undefined) return MAX_ORDER_QTY;
  if (!Number.isFinite(stock)) return MAX_ORDER_QTY;
  return Math.max(MIN_ORDER_QTY, Math.min(MAX_ORDER_QTY, Math.floor(stock)));
}

/** Whether the line is already at its floor, so "-" should be disabled. */
export function atFloor(qty: number): boolean {
  return !Number.isFinite(qty) || qty <= MIN_ORDER_QTY;
}

/** Whether the line is already at its ceiling, so "+" should be disabled. */
export function atCeiling(qty: number, ceiling: number = MAX_ORDER_QTY): boolean {
  return clampQuantity(qty, ceiling) >= orderCeiling(ceiling);
}
