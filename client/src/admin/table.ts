// Pure table helpers for the admin panel: sorting, text filtering and
// pagination. Kept free of React and of any data source so they are trivially
// testable and reusable by every table in the panel.
//
// The panel's tables are all "load the whole list, then sort/filter/page in the
// browser" - the demo dataset is small and the real admin lists are bounded
// (products capped at 500, orders at a few hundred), so this is the right shape
// and avoids a round-trip per keystroke.

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

/** Compare two values of unknown type in a stable, predictable way. Numbers
 *  compare numerically, booleans false<true, everything else as a
 *  case-insensitive string. Null/undefined always sort last. */
export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
  return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
}

/** Sort a copy of `rows` by `sort.key`. A null sort returns the rows unchanged
 *  (a fresh array, so callers can still treat the result as immutable). */
export function sortRows<T extends object>(rows: readonly T[], sort: SortState | null): T[] {
  const copy = [...rows];
  if (!sort) return copy;
  const factor = sort.dir === "asc" ? 1 : -1;
  return copy.sort(
    (a, b) =>
      factor *
      compareValues(
        (a as Record<string, unknown>)[sort.key],
        (b as Record<string, unknown>)[sort.key],
      ),
  );
}

/** Case-insensitive substring match across the named fields. An empty query
 *  matches everything. Non-string field values are stringified first. */
export function filterRows<T extends object>(
  rows: readonly T[],
  query: string,
  fields: readonly (keyof T)[],
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) =>
    fields.some((field) => {
      const value = (row as Record<string, unknown>)[field as string];
      if (value == null) return false;
      return String(value).toLowerCase().includes(q);
    }),
  );
}

export interface Page<T> {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
}

/** Slice `rows` into a 1-based page of `pageSize`. The page number is clamped
 *  into range, so a filter that shrinks the list can never strand the user on an
 *  empty page. */
export function paginate<T>(rows: readonly T[], page: number, pageSize: number): Page<T> {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (safePage - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return {
    rows: slice,
    page: safePage,
    pageCount,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

/** A single entry in a numbered pager: a real page number, or a gap marker. */
export type PageItem = number | "ellipsis";

/** The numbered page buttons to render, with smart ellipsis. Always shows the
 *  first and last page, the current page and `siblings` pages either side of it,
 *  and collapses the gaps into a single "ellipsis" marker. A short list (fits in
 *  the window) is returned in full with no markers. */
export function pageItems(page: number, pageCount: number, siblings = 1): PageItem[] {
  const total = Math.max(0, Math.floor(pageCount));
  if (total <= 1) return total === 1 ? [1] : [];
  const current = Math.min(Math.max(1, Math.floor(page) || 1), total);
  const windowSize = siblings * 2 + 5; // first + last + current + siblings + 2 gaps
  if (total <= windowSize) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const left = Math.max(2, current - siblings);
  const right = Math.min(total - 1, current + siblings);
  const items: PageItem[] = [1];
  if (left > 2) items.push("ellipsis");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

/** One call that runs the whole pipeline: filter -> sort -> paginate. */
export function queryTable<T extends object>(
  rows: readonly T[],
  opts: {
    query?: string;
    fields?: readonly (keyof T)[];
    sort?: SortState | null;
    page?: number;
    pageSize?: number;
  },
): Page<T> {
  const filtered = opts.query && opts.fields ? filterRows(rows, opts.query, opts.fields) : [...rows];
  const sorted = sortRows(filtered, opts.sort ?? null);
  return paginate(sorted, opts.page ?? 1, opts.pageSize ?? 10);
}
