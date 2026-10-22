// Binds the Content-Security-Policy to the tag that must actually run under it.
//
// WHY THIS SUITE EXISTS. The policy shipped as `script-src 'self'` and
// `connect-src 'self'`. On the Vercel deploy those headers are not applied to the
// static SPA, so nothing broke - but the SAME policy IS applied by the Hono app
// on every self-hosted origin (`pnpm start`, the Docker image, a preview host).
// There, a `'self'`-only script-src silently refuses the gtag.js loader AND the
// inline snippet, so the tag never runs and GA4 records nothing while the page
// looks perfectly healthy. Nothing asserted the two agreed, so nothing failed.
//
// The tests below recompute the sha256 of the REAL inline snippet and require the
// policy to carry it, so an edit to `client/index.html` that is not mirrored into
// the CSP fails here instead of quietly disabling measurement in production.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_SECURITY_POLICY } from "./security-headers";
import { extractInlineScripts } from "@shared/consent-mode";
import { PRODUCTION_HOSTS } from "@shared/production-host";

// This test file lives in server/_core, so the repo root is two levels up.
const INDEX_HTML = path.resolve(import.meta.dirname, "..", "..", "client", "index.html");

/** The directives, split into name -> value so a test can read one out. */
function directive(name: string): string {
  const found = CONTENT_SECURITY_POLICY.split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `) || d === name);
  return found ?? "";
}

/**
 * The document as it is DEPLOYED.
 *
 * The deployed bytes come from the repository, which is LF (see .gitattributes).
 * A checkout that rewrote line endings to CRLF would hash a snippet that is not
 * the one that ships, and the policy would be reported as broken when it is
 * not - so the text is normalised to LF before it is hashed. The substance is
 * unchanged: an edit to the snippet still changes the hash and still fails.
 */
function deployedDocument(): string {
  return readFileSync(INDEX_HTML, "utf-8").replace(/\r\n/g, "\n");
}

describe("the CSP and the Google tag must agree", () => {
  it("allows the gtag.js loader host in script-src", () => {
    expect(directive("script-src")).toContain("https://www.googletagmanager.com");
  });

  it("carries the sha256 of the REAL inline tag snippet", () => {
    // Computed from the deployed document, not from a copy of the constant: if
    // the snippet is edited without updating the policy, this fails.
    const inline = extractInlineScripts(deployedDocument());
    // Two inline scripts ship: the Google tag/consent snippet and the Microsoft
    // Clarity snippet. Both must be pinned by hash.
    expect(inline).toHaveLength(2);
    const hashes = inline.map(
      (s) => `'sha256-${createHash("sha256").update(s.body, "utf8").digest("base64")}'`,
    );
    for (const hash of hashes) {
      expect(directive("script-src")).toContain(hash);
    }
  });

  it("allows the Microsoft Clarity tag host in script-src", () => {
    expect(directive("script-src")).toContain("https://www.clarity.ms");
  });

  it("allows the Clarity collection beacon in connect-src", () => {
    const connect = directive("connect-src");
    expect(connect).toContain("https://www.clarity.ms");
    expect(connect).toContain("https://*.clarity.ms");
  });

  it("never falls back to a blanket 'unsafe-inline' for scripts", () => {
    // The hash authorises exactly one snippet; 'unsafe-inline' would authorise
    // any injected script and silently neuter the policy.
    expect(directive("script-src")).not.toContain("unsafe-inline");
    expect(directive("script-src")).not.toContain("unsafe-eval");
  });

  it("allows the GA4 collection beacon in connect-src", () => {
    // The hit itself goes to google-analytics.com/g/collect; with connect-src
    // 'self' alone the browser drops it and the tag appears to do nothing.
    const connect = directive("connect-src");
    expect(connect).toContain("https://www.google-analytics.com");
    expect(connect).toContain("https://*.google-analytics.com");
    expect(connect).toContain("https://www.googletagmanager.com");
  });

  it("allows the tag's image beacons", () => {
    expect(directive("img-src")).toContain("https://www.google-analytics.com");
  });
});

// The inline snippets carry their OWN copy of the production-host allow-list,
// because they run before any bundle (and therefore before `isProductionHost`
// is importable). A copy can drift, and a drifted copy fails SILENTLY: a preview
// host that still loads the tag looks perfectly healthy. These tests pin the
// inline copies to the single source of truth in `shared/production-host.ts`, so
// adding or renaming a production host fails here instead of quietly leaving the
// tags enabled on a preview deployment.
describe("the inline tag host gates match shared/production-host.ts", () => {
  const inline = extractInlineScripts(deployedDocument());

  it("ships exactly the two gated inline scripts (Google tag, Clarity)", () => {
    expect(inline).toHaveLength(2);
  });

  it("names every production host in the Google tag snippet", () => {
    const googleTag = inline.find((s) => s.body.includes("googletagmanager.com"));
    expect(googleTag).toBeDefined();
    for (const host of PRODUCTION_HOSTS) {
      expect(googleTag!.body).toContain(host);
    }
  });

  it("names every production host in the Clarity snippet", () => {
    const clarity = inline.find((s) => s.body.includes("clarity.ms"));
    expect(clarity).toBeDefined();
    for (const host of PRODUCTION_HOSTS) {
      expect(clarity!.body).toContain(host);
    }
  });

  it("gates the Clarity snippet on the host BEFORE it loads the tag", () => {
    // The early `return` must precede the loader, or the tag initializes on a
    // preview host and the gate is decorative.
    const clarity = inline.find((s) => s.body.includes("clarity.ms"))!;
    const gate = clarity.body.indexOf("location.hostname");
    const loader = clarity.body.indexOf("clarity.ms/tag/");
    expect(gate).toBeGreaterThan(-1);
    expect(loader).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(loader);
  });
});
