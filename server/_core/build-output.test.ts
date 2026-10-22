// Guards the SHIPPED artifact, not the source.
//
// WHY THIS SUITE EXISTS. Every other tag test reads `client/index.html` - the
// SOURCE. But what a browser (and a preview host) actually receives is the
// BUILT `dist/public/index.html`, and the two can diverge: a Vite plugin, a
// minifier, or a future build step could rewrite or drop the inline snippets
// without touching the source, and the source-level tests would stay green while
// the deployed page loaded Clarity and GA4 on a `*.vercel.app` preview.
//
// So this reads the built HTML and asserts the production-host gating for BOTH
// the Clarity snippet and the GA4/Google Tag loader is present in the artifact
// that ships. It is a build-output test, so it SKIPS (rather than fails) when
// `dist/` has not been built - `pnpm test` runs before `pnpm build` in CI, and a
// missing build output is not a regression in the code under test.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCTION_HOSTS } from "@shared/production-host";

const BUILT_INDEX = path.resolve(import.meta.dirname, "..", "..", "dist", "public", "index.html");
const built = existsSync(BUILT_INDEX) ? readFileSync(BUILT_INDEX, "utf-8") : null;

/**
 * The full inline `<script>` block that contains `marker`, so a test can assert
 * on the gate AND the loader together. Slicing from the marker alone would miss
 * the host check, which sits BEFORE the loader in the snippet.
 */
function inlineScriptContaining(html: string, marker: string): string {
  const at = html.indexOf(marker);
  if (at === -1) return "";
  const start = html.lastIndexOf("<script", at);
  const end = html.indexOf("</script>", at);
  if (start === -1 || end === -1) return "";
  return html.slice(start, end);
}

// `describe.skipIf` keeps the suite honest: it runs against a real build (CI's
// build jobs, and any local `pnpm build && pnpm test`) and is skipped otherwise.
describe.skipIf(built === null)("the built dist/public/index.html", () => {
  it("still carries the Microsoft Clarity snippet", () => {
    expect(built).toContain("clarity.ms/tag/");
    expect(built).toContain("yy21hlsr6z");
  });

  it("still carries the GA4 / Google Tag loader", () => {
    expect(built).toContain("googletagmanager.com/gtag/js");
    expect(built).toContain("G-ZYJNEHXX7Z");
  });

  it("gates the Clarity snippet on the production host in the SHIPPED bytes", () => {
    // The host check must survive the build, and it must name every production
    // host - a minifier that dropped the comparison would leave the tag loading
    // everywhere.
    const clarity = inlineScriptContaining(built!, "clarity.ms/tag/");
    expect(clarity).not.toBe("");
    for (const host of PRODUCTION_HOSTS) {
      expect(clarity).toContain(host);
    }
    expect(clarity).toContain("location.hostname");
  });

  it("gates the GA4 / Google Tag loader on the production host in the SHIPPED bytes", () => {
    const tag = inlineScriptContaining(built!, "googletagmanager.com/gtag/js");
    expect(tag).not.toBe("");
    for (const host of PRODUCTION_HOSTS) {
      expect(tag).toContain(host);
    }
  });

  it("does not load the Google tag from a static <script src> (it is injected after the gate)", () => {
    // The loader is created in JS only once the host is known good. A static
    // `<script src="...googletagmanager.com/gtag/js...">` would load the tag
    // BEFORE any host check could run, defeating the gate.
    expect(built).not.toMatch(/<script[^>]+src="[^"]*googletagmanager\.com\/gtag\/js/);
  });
});
