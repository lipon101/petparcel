// ── Admin list pagination ─────────────────────────────────────────────────────
//
// ONE place that decides what a valid page request is, and the shape every
// paginated admin list returns.
//
// WHY SHARED, AND WHY PURE. The bounds are enforced on the SERVER, so how many
// rows a caller may pull in one request is not theirs to choose: an admin list
// that honoured an unbounded `limit` would answer a single request with the
// whole table. But the CLIENT needs the same numbers too - it builds its page
// controls and its size selector from them, and it has to know when a page
// number is past the end. One definition, used by both, is the only way those
// two cannot drift apart.
//
// Kept free of React, of the database and of the data source, so it is trivially
// testable and safe to import from either side.

/** Rows per page when the caller names no size. */
export const ADMIN_PAGE_SIZE_DEFAULT = 25;

/** The page sizes the panel offers. A size outside this list is still handled
 *  safely - it is clamped, not trusted. */
export const ADMIN_PAGE_SIZES = [10, 25, 50, 100] as const;

/** The most rows one request may return. Caps the work a single call can cause
 *  and keeps the response bounded no matter what the caller sends. */
export const ADMIN_PAGE_SIZE_MAX = 100;

/** The highest page number accepted. A page number is multiplied by the page
 *  size to become an OFFSET, so an unbounded page number would become an
 *  unbounded offset; this is the ceiling that keeps the arithmetic sane. */
export const ADMIN_PAGE_MAX = 100_000;

/** What a caller may ask for. Both fields are optional - omitted means "the
 *  first page, default size". */
export interface PageRequest {
  page?: number;
  pageSize?: number;
}

/** A page request after clamping: the numbers the data layer actually uses. */
export interface ResolvedPaging {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  /** Rows to skip. Always `(page - 1) * pageSize`. */
  offset: number;
  /** Rows to take. Always `pageSize`. */
  limit: number;
}

/** The shape every paginated admin list returns.
 *
 *  `total` is the count of ALL matching rows, not of `rows`, so the caller can
 *  print "showing 26-50 of 312" and size its page controls from the same
 *  response rather than from a second guess. */
export interface Paginated<T> {
  rows: T[];
  total: number;
  /** The page actually served - which is NOT always the page requested; see
   *  `lastPageOffset`. */
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Clamp a caller's page request into the allowed range.
 *
 * Every unusable input resolves to something sensible rather than throwing:
 * missing, NaN, zero, negative and fractional values all land on the default
 * page/size, and an over-large value is capped. A malformed page request is not
 * worth a 400 - the caller simply gets the first page.
 */
export function resolvePaging(
  input: PageRequest = {},
  opts: { defaultSize?: number; maxSize?: number } = {},
): ResolvedPaging {
  const defaultSize = opts.defaultSize ?? ADMIN_PAGE_SIZE_DEFAULT;
  const maxSize = opts.maxSize ?? ADMIN_PAGE_SIZE_MAX;

  const rawSize = Math.floor(Number(input.pageSize));
  const size = Number.isFinite(rawSize) && rawSize > 0 ? rawSize : defaultSize;
  const pageSize = Math.min(Math.max(size, 1), maxSize);

  const rawPage = Math.floor(Number(input.page));
  const wanted = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const page = Math.min(Math.max(wanted, 1), ADMIN_PAGE_MAX);

  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

/** How many pages a total makes at a size.
 *
 *  Zero rows still reads as ONE page, so the controls render "1 of 1" rather
 *  than a meaningless "0 of 0" and an empty list looks like an empty list
 *  instead of a broken control. */
export function pageCountFor(total: number, pageSize: number): number {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/**
 * The offset of the LAST page for a total - i.e. where to send a caller whose
 * page number is past the end.
 *
 * THIS IS THE FIX FOR A DELETED FINAL ROW. When the admin deletes the last
 * subscriber on the last page, the page they are on no longer holds any rows.
 * Answering with an empty slice would read as "the list is empty" and strand
 * them on a blank table; serving the last real page instead puts them back on
 * data that exists. Returns 0 for an empty total, which is the only page there
 * is.
 */
export function lastPageOffset(total: number, pageSize: number): number {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  return total <= 0 ? 0 : Math.floor((total - 1) / size) * size;
}

/** The 1-based page an offset lands on - the inverse of `resolvePaging`'s
 *  `offset`, so a caller can report the page it was ACTUALLY served. */
export function pageForOffset(offset: number, pageSize: number): number {
  const size = Math.max(1, Math.floor(pageSize) || 1);
  return Math.floor(Math.max(0, offset) / size) + 1;
}

/** The `from`/`to` row numbers for a "Showing X-Y of Z" line. `to` is clamped to
 *  the total, so a short final page never claims to end past the last row. */
export function pageRange(
  page: number,
  pageSize: number,
  total: number,
): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  const size = Math.max(1, Math.floor(pageSize) || 1);
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pageCountFor(total, size));
  const from = (p - 1) * size + 1;
  return { from, to: Math.min(total, from + size - 1) };
}
