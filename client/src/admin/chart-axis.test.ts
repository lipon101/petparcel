// Unit tests for the admin revenue chart's axis arithmetic.
//
// These pin the two defects the redesign fixed: the axis maximum must be a
// "nice" money value (so two ticks never round to the same label), and the
// X-axis must expose four evenly spaced ticks whose last one is the most recent
// day - the old first/middle/last trio of "MM-DD" strings collided into
// "09-2810-0410-11" on a phone.
import { describe, expect, it } from "vitest";
import { axisLabel, axisTickIndices, niceCeil } from "./chart-axis";

describe("niceCeil", () => {
  it("rounds up to 1/2/5/10 x 10^k", () => {
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(120)).toBe(200);
    expect(niceCeil(430)).toBe(500);
    expect(niceCeil(700)).toBe(1000);
    expect(niceCeil(1200)).toBe(2000);
  });

  it("returns 0 for a non-positive amount so the caller can floor it", () => {
    expect(niceCeil(0)).toBe(0);
    expect(niceCeil(-5)).toBe(0);
  });
});

describe("axisLabel", () => {
  it("renders a compact, unambiguous month-day label", () => {
    expect(axisLabel("2026-10-11")).toBe("Oct 11");
    expect(axisLabel("2026-09-28")).toBe("Sep 28");
    expect(axisLabel("2026-01-01")).toBe("Jan 1");
  });

  it("passes through anything it cannot parse", () => {
    expect(axisLabel("nonsense")).toBe("nonsense");
  });
});

describe("axisTickIndices", () => {
  it("returns four evenly spaced ticks ending on the last point", () => {
    const idx = axisTickIndices(14);
    expect(idx).toHaveLength(4);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(13);
    // Strictly increasing, so no two labels land on the same day.
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
  });

  it("handles a single point without dividing by zero", () => {
    expect(axisTickIndices(1)).toEqual([0]);
    expect(axisTickIndices(0)).toEqual([0]);
  });
});
