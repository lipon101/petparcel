// Server-side pagination for the admin lists, at its boundaries.
//
// The reason this is a test file of its own: these numbers are the ONLY thing
// standing between a page request and an unbounded query, and the interesting
// cases are all edge cases. Each one below is a real shape of input - a browser
// omitting a field, a stale page control after a delete, a hand-crafted request
// asking for a million rows - and each must land somewhere safe rather than
// throwing or being taken at face value.
import { describe, expect, it } from "vitest";
import {
  ADMIN_PAGE_SIZE_DEFAULT,
  ADMIN_PAGE_SIZE_MAX,
  lastPageOffset,
  pageCountFor,
  pageForOffset,
  pageRange,
  resolvePaging,
} from "./admin-paging";

describe("resolvePaging", () => {
  it("defaults to the first page at the default size when nothing is asked for", () => {
    expect(resolvePaging()).toEqual({
      page: 1,
      pageSize: ADMIN_PAGE_SIZE_DEFAULT,
      offset: 0,
      limit: ADMIN_PAGE_SIZE_DEFAULT,
    });
  });

  it("turns a page number into the matching offset", () => {
    expect(resolvePaging({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      offset: 20,
      limit: 10,
    });
  });

  it("caps the size so one request cannot pull the whole table", () => {
    const r = resolvePaging({ page: 1, pageSize: 100_000 });
    expect(r.pageSize).toBe(ADMIN_PAGE_SIZE_MAX);
    expect(r.limit).toBe(ADMIN_PAGE_SIZE_MAX);
  });

  it("caps the page number so the offset cannot run away", () => {
    const r = resolvePaging({ page: 10_000_000, pageSize: 100 });
    expect(r.page).toBeLessThan(10_000_000);
    expect(r.offset).toBe((r.page - 1) * 100);
  });

  // Every unusable input resolves to something sensible. A malformed page
  // request is not worth a 400 - the caller just gets the first page.
  it.each([
    ["zero page", { page: 0, pageSize: 10 }],
    ["negative page", { page: -3, pageSize: 10 }],
    ["negative size", { page: 1, pageSize: -10 }],
    ["zero size", { page: 1, pageSize: 0 }],
    ["NaN", { page: Number.NaN, pageSize: Number.NaN }],
    ["Infinity", { page: Number.POSITIVE_INFINITY, pageSize: Number.POSITIVE_INFINITY }],
  ])("falls back to page 1 for %s", (_label, input) => {
    const r = resolvePaging(input);
    expect(r.page).toBe(1);
    expect(r.offset).toBe(0);
    expect(r.pageSize).toBeGreaterThan(0);
    expect(r.pageSize).toBeLessThanOrEqual(ADMIN_PAGE_SIZE_MAX);
  });

  it("floors a fractional page and size", () => {
    expect(resolvePaging({ page: 2.9, pageSize: 10.9 })).toEqual({
      page: 2,
      pageSize: 10,
      offset: 10,
      limit: 10,
    });
  });

  it("never returns a size below one, so the query is always valid", () => {
    expect(resolvePaging({ pageSize: 0.4 }).pageSize).toBeGreaterThanOrEqual(1);
  });
});

describe("pageCountFor", () => {
  it("counts ceiling pages", () => {
    expect(pageCountFor(0, 10)).toBe(1);
    expect(pageCountFor(1, 10)).toBe(1);
    expect(pageCountFor(10, 10)).toBe(1);
    expect(pageCountFor(11, 10)).toBe(2);
    expect(pageCountFor(312, 25)).toBe(13);
  });

  it("reads an empty list as one page, so the controls are not meaningless", () => {
    // "0 of 0" looks broken; "1 of 1" with no rows reads as an empty list.
    expect(pageCountFor(0, 25)).toBe(1);
  });

  it("guards a zero or nonsense size", () => {
    expect(pageCountFor(10, 0)).toBe(10);
    expect(Number.isFinite(pageCountFor(10, Number.NaN))).toBe(true);
  });
});

describe("lastPageOffset - the boundary a delete creates", () => {
  it("is 0 for an empty list", () => {
    expect(lastPageOffset(0, 25)).toBe(0);
  });

  it("lands on the page that still has rows", () => {
    // 25 rows at 10/page leaves page 3 with 5 rows; its offset is 20.
    expect(lastPageOffset(25, 10)).toBe(20);
    // 20 rows fills pages 1-2 exactly; the last page starts at 10.
    expect(lastPageOffset(20, 10)).toBe(10);
    expect(lastPageOffset(21, 10)).toBe(20);
  });

  it("keeps page 1 for a list shorter than one page", () => {
    expect(lastPageOffset(4, 10)).toBe(0);
  });

  it("is the offset that recovers a caller past the end", () => {
    // 11 rows, 10 per page: page 3 does not exist. The recovered offset is the
    // start of page 2, which is where the row they were looking at now lives.
    const total = 11;
    const size = 10;
    const requestedPage = 3;
    const requested = (requestedPage - 1) * size; // 20 - past the end
    const recovered = Math.min(requested, lastPageOffset(total, size));
    expect(recovered).toBe(10);
    expect(pageForOffset(recovered, size)).toBe(2);
  });
});

describe("pageForOffset", () => {
  it("is the inverse of resolvePaging's offset", () => {
    for (const page of [1, 2, 7, 13]) {
      const { offset, pageSize } = resolvePaging({ page, pageSize: 25 });
      expect(pageForOffset(offset, pageSize)).toBe(page);
    }
  });

  it("treats a negative offset as the first page", () => {
    expect(pageForOffset(-50, 10)).toBe(1);
  });
});

describe("pageRange", () => {
  it("reports 0-0 for an empty list", () => {
    expect(pageRange(1, 10, 0)).toEqual({ from: 0, to: 0 });
  });

  it("numbers the rows on a full page", () => {
    expect(pageRange(2, 10, 312)).toEqual({ from: 11, to: 20 });
  });

  it("clamps the end of a short final page to the total", () => {
    // 25 rows at 10/page: page 3 holds rows 21-25, not 21-30.
    expect(pageRange(3, 10, 25)).toEqual({ from: 21, to: 25 });
  });

  it("clamps a page number past the end onto the last real page", () => {
    expect(pageRange(99, 10, 25)).toEqual({ from: 21, to: 25 });
  });
});
