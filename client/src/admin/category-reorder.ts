// Reorder arithmetic for the Categories page.
//
// Split out of the component because the interesting parts - where a dragged
// row lands, and what a move does to the list - are pure functions, and the test
// suite runs in a node environment with no DOM. Keeping them here means the drop
// maths is pinned by tests rather than only exercised by hand.

/** Move one item to another position, returning a NEW array. Out-of-range or
 *  no-op moves return a copy of the input, so a stray pointer event can never
 *  corrupt the list. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Move the item with `id` by `delta` places (±1 for an up/down press), clamped
 *  to the ends so pressing "up" on the first row is a harmless no-op. Returns a
 *  copy of the input when the id is not in the list. */
export function moveId(ids: readonly string[], id: string, delta: number): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return [...ids];
  const to = Math.max(0, Math.min(ids.length - 1, from + delta));
  return moveItem(ids, from, to);
}

/**
 * Where a dragged row should land, given the row it is hovering and whether the
 * pointer is past that row's midpoint.
 *
 * The subtlety: the destination index is counted in the array the item has
 * ALREADY been removed from, so a downward move lands one place earlier than the
 * naive `over + 1`. Getting this wrong makes a row dropped just below its
 * neighbour end up one slot short - the classic off-by-one in every
 * drag-and-drop list.
 */
export function dropTarget(from: number, over: number, below: boolean): number {
  const to = below ? over + 1 : over;
  return from < to ? to - 1 : to;
}

/** True when a pointer sitting at `y` is past the vertical midpoint of `rect`,
 *  i.e. the row should be dropped BELOW rather than above. */
export function isBelowMidpoint(rect: { top: number; height: number }, y: number): boolean {
  return y > rect.top + rect.height / 2;
}
