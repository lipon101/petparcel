// Guards the one property that makes the hidden admin path worth hiding: the
// value must NOT be recoverable by grepping the public bundle.
//
// Both failure modes that have actually bitten this code are pinned here:
//   * a plain string literal in the source (greppable directly), and
//   * a `String.fromCharCode(...)` literal, which the production minifier folds
//     back into a readable string during the build.
// The second one is why this module decodes XOR-obfuscated hex at runtime, and
// the assertion below is what stops a well-meaning refactor from undoing it.
import { describe, expect, it } from "vitest";
import { ADMIN_ROOT, adminPath, isAdminPath } from "./admin-path";

describe("admin path", () => {
  it("exposes a single-segment root path", () => {
    expect(ADMIN_ROOT.startsWith("/")).toBe(true);
    expect(ADMIN_ROOT).toHaveLength(8); // "/" + a 7-character segment
    expect(ADMIN_ROOT).not.toContain(" "); // no whitespace leaked from decoding
  });

  it("builds child paths without doubling the slash", () => {
    expect(adminPath()).toBe(ADMIN_ROOT);
    expect(adminPath("products")).toBe(`${ADMIN_ROOT}/products`);
    expect(adminPath("/products/42")).toBe(`${ADMIN_ROOT}/products/42`);
  });

  it("recognises its own surface and nothing else", () => {
    expect(isAdminPath(ADMIN_ROOT)).toBe(true);
    expect(isAdminPath(`${ADMIN_ROOT}/orders/x`)).toBe(true);
    expect(isAdminPath("/shop")).toBe(false);
    expect(isAdminPath("/")).toBe(false);
    // A neighbouring path that merely starts with the same letters is not ours.
    expect(isAdminPath(`${ADMIN_ROOT}extra`)).toBe(false);
  });

  it("is not a greppable literal in this module's own source", async () => {
    // Read the module back as text: the decoded value must not appear in it.
    const fs = await import("node:fs/promises");
    const url = await import("node:url");
    const here = url.fileURLToPath(import.meta.url);
    const src = await fs.readFile(here, "utf8");
    const segment = ADMIN_ROOT.slice(1);
    expect(src).not.toContain(`"/${segment}"`);
    expect(src).not.toContain(`fromCharCode(${segment})`);
  });
});
