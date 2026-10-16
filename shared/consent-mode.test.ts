// Guards for the Google tag in `client/index.html`.
//
// WHY THIS SUITE EXISTS. The tag failed in production in a way three separate
// green signals all missed: Google Tag Assistant SAW the tag and reported a
// page_view, the built HTML contained the snippet, and every unit test passed -
// yet GA4 recorded no data, because the Consent Mode default denied
// `analytics_storage` for EVERY visitor (not just the EEA) and no banner
// acceptance ever happened on the audit session. Nothing in the repo asserted
// the SHAPE of the deployed tag, so nothing could fail.
//
// These tests assert the properties that actually decide whether measurement
// works, against the REAL `client/index.html`:
//
//   * exactly one tag (a second loader double-counts sessions),
//   * the defaults precede `gtag('config')` (a config that runs first reads a
//     consent state that was never set - Google's own documented failure),
//   * the defaults are REGION-SCOPED with a granted rest-of-world default, so a
//     non-EEA visitor is measured normally,
//   * the deployed region list matches EEA_CONSENT_REGIONS exactly, so the list
//     cannot drift from the shared constant,
//   * the storage keys the inline restore reads match the shared constants.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSENT_COOKIE_NAME,
  CONSENT_STORAGE_KEY,
  EEA_CONSENT_REGIONS,
  EEA_REGIONS_JSON,
  extractInlineScripts,
  stripHtmlComments,
  tagPlacementIssues,
  validateTagPlacement,
} from "./consent-mode";

const INDEX_HTML = path.resolve(import.meta.dirname, "..", "client", "index.html");
const rawHtml = readFileSync(INDEX_HTML, "utf-8");
// Audits run on the comment-free document: the explanatory comment above the
// snippet mentions `gtag('config', ...)` in prose, which must not be counted as
// a real command.
const html = stripHtmlComments(rawHtml);

describe("the deployed tag in client/index.html", () => {
  it("carries exactly ONE Google tag and ONE config command", () => {
    // Two loaders would send every hit twice; a missing one means no tag at all.
    expect((html.match(/googletagmanager\.com\/gtag\/js/g) ?? []).length).toBe(1);
    expect((html.match(/gtag\(\s*['"]config['"]/g) ?? []).length).toBe(1);
    expect(html).toContain("G-ZYJNEHXX7Z");
    // The declaration and the config must name the SAME id.
    const ids = new Set(html.match(/G-[A-Z0-9]{9,}/g) ?? []);
    expect([...ids]).toEqual(["G-ZYJNEHXX7Z"]);
  });

  it("sets consent defaults BEFORE gtag('config')", () => {
    // The documented order is: load tag -> consent default -> consent update ->
    // config. A config that runs first reads an unset consent state, and the
    // first hit goes out with the wrong signals.
    const audits = validateTagPlacement(html);
    expect(audits.consentDefaultCount).toBeGreaterThanOrEqual(2);
    expect(audits.consentPrecedesConfig).toBe(true);
    expect(tagPlacementIssues(html)).toEqual([]);
  });

  it("denies by default in the EEA/UK/CH and GRANTS by default everywhere else", () => {
    // This is the fix for "GA4 receives no data": previously EVERY visitor was
    // denied until they accepted the banner, so an un-accepted session produced
    // only cookieless pings. The region-scoped pair keeps prior-consent
    // behaviour where the law requires it and normal measurement in the US.
    const audits = validateTagPlacement(html);
    expect(audits.hasRegionScopedDefault).toBe(true);
    expect(audits.hasGrantedGeneralDefault).toBe(true);
    expect(audits.hasWaitForUpdate).toBe(true);
  });

  it("deploys the region list defined by the shared constant, byte for byte", () => {
    // If this fails, the HTML and `EEA_CONSENT_REGIONS` have diverged - one of
    // the two lists is stale, and some region is getting the wrong default.
    expect(html).toContain(EEA_REGIONS_JSON);
    // No other `region:` array may appear, or two commands would disagree.
    expect((html.match(/region\s*:/g) ?? []).length).toBe(1);
  });

  it("keeps functionality_storage and security_storage granted in every consent command", () => {
    // These are not optional signals; denying them breaks basic site function
    // (and Google requires them granted). There are THREE commands that set
    // them: the EEA default, the rest-of-world default, and the restore of a
    // returning visitor's choice - each must keep both granted.
    expect((html.match(/functionality_storage:\s*'granted'/g) ?? []).length).toBe(3);
    expect((html.match(/security_storage:\s*'granted'/g) ?? []).length).toBe(3);
  });
});

describe("the inline restore of a returning visitor's choice", () => {
  it("reads the SAME cookie name the analytics helper writes", () => {
    // A drift here is silent: the restore simply never matches, and a returning
    // visitor who had accepted is measured as denied on every page load.
    expect(CONSENT_COOKIE_NAME).toBe("pp_consent");
    expect(html).toContain(`${CONSENT_COOKIE_NAME}=`);
  });

  it("emits a consent UPDATE, clears the cookie, and tolerates a missing one", () => {
    expect(html).toContain("gtag('consent', 'update'");
    expect(html).toMatch(/Max-Age=0/); // the cookie is single-use
    // Wrapped in try/catch so a corrupt cookie cannot throw before the tag and
    // take the rest of the head down with it.
    expect(html).toMatch(/catch\s*\(/);
  });

  it("uses the same storage key the banner and helper share", () => {
    expect(CONSENT_STORAGE_KEY).toBe("petparcel_consent_v1");
  });
});

describe("shared consent constants", () => {
  it("lists the 35 EEA + UK + CH + Crown Dependency regions", () => {
    expect(EEA_CONSENT_REGIONS).toHaveLength(35);
    // Spot-check the ones a mis-edit is most likely to drop.
    for (const code of ["DE", "FR", "ES", "IT", "NL", "IE", "PL", "SE", "GB", "CH", "IS", "NO", "LI"]) {
      expect(EEA_CONSENT_REGIONS).toContain(code);
    }
  });

  it("uses unique, upper-case ISO 3166 alpha-2 codes", () => {
    const set = new Set(EEA_CONSENT_REGIONS);
    expect(set.size).toBe(EEA_CONSENT_REGIONS.length);
    for (const code of EEA_CONSENT_REGIONS) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("serialises to the exact JSON array the tag must carry", () => {
    expect(EEA_REGIONS_JSON).toBe(JSON.stringify(EEA_CONSENT_REGIONS));
    expect(EEA_REGIONS_JSON.startsWith('["')).toBe(true);
    expect(EEA_REGIONS_JSON.endsWith('"]')).toBe(true);
  });
});

describe("extractInlineScripts", () => {
  it("returns only executable inline scripts", () => {
    // The document has two inline tag scripts (the Google tag/consent snippet
    // and the Microsoft Clarity snippet); the ld+json schema block is DATA and
    // the other scripts are external, so none of those may be hashed.
    const inline = extractInlineScripts(rawHtml);
    expect(inline).toHaveLength(2);
    expect(inline[0].body).toContain("gtag('config'");
    expect(inline[1].body).toContain("clarity");
    for (const s of inline) expect(s.attrs).not.toMatch(/\bsrc\s*=/i);
  });
});
