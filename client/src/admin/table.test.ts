import { describe, expect, it } from "vitest";
import { compareValues, filterRows, paginate, queryTable, sortRows } from "./table";

interface Row extends Record<string, unknown> {
  name: string;
  qty: number;
  active: boolean;
  note: string | null;
}

const rows: Row[] = [
  { name: "Banana", qty: 3, active: true, note: "ripe" },
  { name: "apple", qty: 10, active: false, note: null },
  { name: "Cherry", qty: 1, active: true, note: "sweet" },
];

describe("compareValues", () => {
  it("compares numbers numerically, not lexically", () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
    expect(compareValues(10, 2)).toBeGreaterThan(0);
  });

  it("compares strings case-insensitively", () => {
    expect(compareValues("apple", "Banana")).toBeLessThan(0);
  });

  it("orders booleans false before true", () => {
    expect(compareValues(false, true)).toBeLessThan(0);
  });

  it("sorts null/undefined last regardless of direction input", () => {
    expect(compareValues(null, "x")).toBeGreaterThan(0);
    expect(compareValues("x", null)).toBeLessThan(0);
    expect(compareValues(null, null)).toBe(0);
  });
});

describe("sortRows", () => {
  it("returns a new array and does not mutate the input", () => {
    const out = sortRows(rows, { key: "qty", dir: "asc" });
    expect(out).not.toBe(rows);
    expect(rows.map((r) => r.qty)).toEqual([3, 10, 1]);
  });

  it("sorts ascending and descending", () => {
    expect(sortRows(rows, { key: "qty", dir: "asc" }).map((r) => r.qty)).toEqual([1, 3, 10]);
    expect(sortRows(rows, { key: "qty", dir: "desc" }).map((r) => r.qty)).toEqual([10, 3, 1]);
  });

  it("sorts strings case-insensitively", () => {
    expect(sortRows(rows, { key: "name", dir: "asc" }).map((r) => r.name)).toEqual([
      "apple",
      "Banana",
      "Cherry",
    ]);
  });

  it("returns a copy when sort is null", () => {
    const out = sortRows(rows, null);
    expect(out).toEqual(rows);
    expect(out).not.toBe(rows);
  });
});

describe("filterRows", () => {
  it("matches case-insensitive substrings across the given fields", () => {
    expect(filterRows(rows, "an", ["name"]).map((r) => r.name)).toEqual(["Banana"]);
    expect(filterRows(rows, "APP", ["name"]).map((r) => r.name)).toEqual(["apple"]);
  });

  it("matches across any of several fields", () => {
    expect(filterRows(rows, "sweet", ["name", "note"]).map((r) => r.name)).toEqual(["Cherry"]);
  });

  it("returns everything for an empty query", () => {
    expect(filterRows(rows, "   ", ["name"])).toHaveLength(3);
  });

  it("ignores null field values without throwing", () => {
    expect(filterRows(rows, "ripe", ["note"]).map((r) => r.name)).toEqual(["Banana"]);
  });
});

describe("paginate", () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ i }));

  it("slices the requested page and reports bounds", () => {
    const p = paginate(many, 2, 10);
    expect(p.rows.map((r) => r.i)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect(p.page).toBe(2);
    expect(p.pageCount).toBe(3);
    expect(p.total).toBe(25);
    expect(p.from).toBe(11);
    expect(p.to).toBe(20);
  });

  it("clamps an out-of-range page into range", () => {
    expect(paginate(many, 99, 10).page).toBe(3);
    expect(paginate(many, 0, 10).page).toBe(1);
    expect(paginate(many, -5, 10).page).toBe(1);
  });

  it("reports an empty page cleanly", () => {
    const p = paginate([], 1, 10);
    expect(p.rows).toEqual([]);
    expect(p.pageCount).toBe(1);
    expect(p.from).toBe(0);
    expect(p.to).toBe(0);
  });
});

describe("queryTable", () => {
  it("runs filter -> sort -> paginate in one call", () => {
    const p = queryTable(rows, {
      query: "a",
      fields: ["name"],
      sort: { key: "qty", dir: "desc" },
      page: 1,
      pageSize: 2,
    });
    // "a" matches Banana and apple; sorted by qty desc -> apple(10), Banana(3)
    expect(p.rows.map((r) => r.name)).toEqual(["apple", "Banana"]);
    expect(p.total).toBe(2);
  });

  it("defaults to page 1 with a page size of 10", () => {
    const p = queryTable(rows, {});
    expect(p.page).toBe(1);
    expect(p.rows).toHaveLength(3);
  });
});
