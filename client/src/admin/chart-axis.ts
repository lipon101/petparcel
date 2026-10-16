// Pure helpers for the admin revenue chart's axes.
//
// Kept out of the component so the arithmetic is unit-testable without a DOM
// (vitest runs in a node environment here). The chart itself is hand-rolled
// inline SVG in Dashboard.tsx; only the numbers live here.

/** Round a cents amount UP to a "nice" axis maximum (1, 2, 5 or 10 x 10^k), so
 *  the axis ticks read as clean money values instead of arbitrary amounts.
 *  Returns 0 for a non-positive input so the caller can fall back to a floor. */
export function niceCeil(cents: number): number {
  if (!(cents > 0)) return 0;
  const pow = Math.pow(10, Math.floor(Math.log10(cents)));
  const n = cents / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-11" -> "Oct 11". A compact, unambiguous axis label short enough that
 *  four of them sit side by side without touching on a 375px screen - the old
 *  first/middle/last trio of "MM-DD" strings collided into "09-2810-0410-11". */
export function axisLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${month} ${Number(m[3])}`;
}

/** Four evenly spaced tick indices across `n` points (or just [0] for a single
 *  point), so the labels never crowd each other at any width. The last index is
 *  always `n - 1`, i.e. the most recent day in the window. */
export function axisTickIndices(n: number): number[] {
  if (n <= 1) return [0];
  return [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];
}
