// Source-level checks that the storefront chrome shows a CURATED category nav
// rather than dumping the taxonomy.
//
// vitest runs in a node environment (no jsdom), so Layout cannot be mounted.
// These read it as text and pin the wiring: the header menu and the footer both
// read the curated lists, the full tree is always one link away, and the menu
// cannot overflow the viewport.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HEADER_AISLE_LIMIT, FOOTER_AISLE_LIMIT } from "@shared/nav-curation";

const src = readFileSync(join(__dirname, "Layout.tsx"), "utf8");

describe("storefront nav is curated, not the whole taxonomy", () => {
  it("reads the curated lists from the catalog hook", () => {
    expect(src).toContain("const { top: topCats, nav, hiddenAisles } = useTopCategories();");
    expect(src).toContain("const { footerNav } = useTopCategories();");
  });

  it("does not render every aisle in the footer", () => {
    // The old code spread `shopCats` (a stock-ranked slice) but called the link
    // "All products"; now the column is the curated aisle list plus one explicit
    // hand-off to the full tree.
    expect(src).toContain("Shop all categories");
    expect(src).not.toContain('label: "All products"');
  });

  it("always keeps the full tree one link away from both chrome surfaces", () => {
    const shopAll = src.match(/Shop all categories/g) ?? [];
    // Header menu + mobile drawer + footer column.
    expect(shopAll.length).toBeGreaterThanOrEqual(3);
    expect(src).toContain('to="/shop"');
  });

  it("says how many aisles the header cap is holding back", () => {
    expect(src).toContain("hiddenAisles");
    expect(src).toContain("more aisle");
  });

  it("caps the mega-menu against the viewport so it cannot overflow", () => {
    // The width/height/scroll live in the stylesheet; the panel must use the
    // class that carries them.
    expect(src).toContain("hd-mega");
  });
});

describe("curation limits keep the chrome small", () => {
  it("shows far fewer aisles in the header than the full taxonomy (15)", () => {
    expect(HEADER_AISLE_LIMIT).toBeLessThan(15);
  });

  it("shows far fewer aisles in the footer than the full taxonomy (15)", () => {
    expect(FOOTER_AISLE_LIMIT).toBeLessThan(15);
  });
});

// The skip link is the storefront's keyboard entry point. It must be the FIRST
// focusable element (so one Tab reaches it, before the three-row header's many
// links) and it must point at the real <main> region, which has to be focusable
// for the jump to move focus and not just the scroll position.
describe("the skip link", () => {
  it("is rendered before the header, so it is the first focusable element", () => {
    const skip = src.indexOf('href="#main-content"');
    const header = src.indexOf("<Header />");
    expect(skip).toBeGreaterThan(-1);
    expect(header).toBeGreaterThan(-1);
    expect(skip).toBeLessThan(header);
  });

  it("points at a main region that carries the matching id", () => {
    expect(src).toContain('id="main-content"');
    // tabIndex={-1} is what lets the anchor move FOCUS into <main>, not merely
    // scroll to it - without it a screen reader stays on the header.
    expect(src).toContain("tabIndex={-1}");
  });

  it("is labelled for assistive technology", () => {
    expect(src).toContain("Skip to main content");
  });
});
