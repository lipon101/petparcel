// Tests for the admin panel's top bar (the `.ah-*` header).
//
// vitest runs `environment: "node"` here and jsdom is deliberately not a
// dependency (see vitest.config.ts), so the header is pinned by reading the
// source text: the shell renders `<AdminHeader />`, the bar carries the brand
// lockup + a divider + the two action controls, "Back to storefront" is a
// tasteful outline control and "Sign out" is a distinct understated control,
// both with accessible labels, and the old plain-text sidebar footer links are
// gone. A second block pins the scoped `.ah-*` styles (including the phone
// label-collapse rule) in index.css.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSrc = readFileSync(path.resolve(import.meta.dirname, "AdminApp.tsx"), "utf-8");
const cssSrc = readFileSync(
  path.resolve(import.meta.dirname, "../index.css"),
  "utf-8",
);

describe("admin header (AdminApp.tsx)", () => {
  it("renders the header inside the gated shell, above the content grid", () => {
    expect(appSrc).toMatch(/<AdminHeader \/>/);
    // The header must sit inside the shell, before the sidebar/content grid.
    const headerAt = appSrc.indexOf("<AdminHeader />");
    const gridAt = appSrc.indexOf("grid-cols-[minmax(0,1fr)] gap-8");
    expect(headerAt).toBeGreaterThan(-1);
    expect(gridAt).toBeGreaterThan(headerAt);
  });

  it("has a brand lockup with the wordmark and a subtle divider", () => {
    expect(appSrc).toMatch(/className="ah-bar"/);
    expect(appSrc).toMatch(/className="ah-mark"/);
    expect(appSrc).toMatch(/className="ah-wordmark"/);
    // "Parcel" is the brand accent, matching the storefront wordmark.
    expect(appSrc).toMatch(/Pet<span className="brand-accent">Parcel<\/span>/);
    expect(appSrc).toMatch(/className="ah-divider"/);
  });

  it("styles 'Back to storefront' as an outline control with an icon + label", () => {
    expect(appSrc).toMatch(/to="\/" className="ah-btn ah-btn--outline" aria-label="Back to storefront"/);
    expect(appSrc).toMatch(/<span className="ah-label">Back to storefront<\/span>/);
  });

  it("styles 'Sign out' as a distinct understated control with an icon + label", () => {
    expect(appSrc).toMatch(/className="ah-btn ah-btn--signout"/);
    expect(appSrc).toMatch(/aria-label="Sign out"/);
    expect(appSrc).toMatch(/<span className="ah-label">Sign out<\/span>/);
  });

  it("signs out then returns to the storefront home", () => {
    expect(appSrc).toMatch(/void logout\(\)\.then\(\(\) => \{/);
    expect(appSrc).toMatch(/window\.location\.href = "\/";/);
  });

  it("no longer renders the old plain-text footer links in the sidebar", () => {
    // The sidebar is now nav-only; the two controls live in the header.
    const sidebar = appSrc.slice(
      appSrc.indexOf("function Sidebar("),
      appSrc.indexOf("function RequireAdmin("),
    );
    expect(sidebar).not.toMatch(/Back to storefront/);
    expect(sidebar).not.toMatch(/Sign out/);
  });
});

describe("admin header styles (index.css)", () => {
  it("defines the scoped .ah-* block", () => {
    for (const cls of [
      ".ah-bar",
      ".ah-mark",
      ".ah-wordmark",
      ".ah-divider",
      ".ah-actions",
      ".ah-btn",
      ".ah-btn--outline",
      ".ah-btn--signout",
    ]) {
      expect(cssSrc).toContain(cls);
    }
  });

  it("collapses the labels to icons on a phone so the bar never overflows", () => {
    expect(cssSrc).toMatch(/@media \(max-width: 600px\)[\s\S]*?\.ah-btn \.ah-label \{\s*display: none;/);
  });

  it("gives the controls a visible focus ring", () => {
    expect(cssSrc).toMatch(/\.ah-btn:focus-visible \{/);
  });
});
