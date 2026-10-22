// Source-level wiring checks for the Categories page.
//
// vitest runs in a node environment here (no jsdom), so a component cannot be
// mounted. These read the .tsx as text and pin the things that must be true of
// it: both reorder affordances are present, they go through the ONE mutation,
// the whole sibling list is sent, and the page cannot overflow a phone.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HEADER_AISLE_LIMIT } from "@shared/nav-curation";

const src = readFileSync(join(__dirname, "pages", "Categories.tsx"), "utf8");

describe("Categories page reorder wiring", () => {
  it("offers a drag handle with an accessible label", () => {
    expect(src).toContain("GripVertical");
    expect(src).toContain("onPointerDown={startDrag(");
    expect(src).toContain("aria-label={`Drag to reorder ${label}`}");
  });

  it("offers up/down buttons as the keyboard-accessible fallback", () => {
    expect(src).toContain("ArrowUp");
    expect(src).toContain("ArrowDown");
    expect(src).toContain("aria-label={`Move ${label} up`}");
    expect(src).toContain("aria-label={`Move ${label} down`}");
    // The ends are disabled rather than wrapping, so the first row cannot be
    // "moved up" into last place.
    expect(src).toContain("disabled={busy || index === 0}");
    expect(src).toContain("disabled={busy || index === count - 1}");
  });

  it("saves through the one reorder mutation with the complete sibling list", () => {
    expect(src).toContain("data.reorderCategories(parentId, ids)");
    expect(src).not.toMatch(/reorderCategories\([^)]*slice\(/);
  });

  it("shows a drop indicator", () => {
    expect(src).toContain("dropLine");
    expect(src).toContain("bg-primary");
  });

  it("is touch-capable (no pointer-capture-only path, touch-action disabled on the handle)", () => {
    expect(src).toContain("touch-none");
    expect(src).toContain('window.addEventListener("pointermove"');
    expect(src).toContain('window.addEventListener("pointerup"');
  });

  it("reverts the view when a save fails, so it cannot show an unsaved order", () => {
    expect(src).toContain("rollback()");
    expect(src).toContain("showOrder(parentId, snapshot)");
  });

  it("keeps every row wrap-able so nothing overflows at 375px", () => {
    expect(src).toContain("flex-wrap");
    expect(src).toContain("break-words");
    expect(src).not.toContain("whitespace-nowrap");
  });
});

describe("nav curation limits", () => {
  it("keeps the header menu far smaller than the full taxonomy", () => {
    // The whole point of the curation: the header shows a slice, not 15+68.
    expect(HEADER_AISLE_LIMIT).toBeLessThan(15);
    expect(HEADER_AISLE_LIMIT).toBeGreaterThanOrEqual(4);
  });
});
