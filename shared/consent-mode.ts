// ────────────────────────────────────────────────────────────────────────────
// Consent Mode v2 - the single source of truth shared by the inline Google tag
// in `client/index.html`, the consent banner, and the client analytics helper.
//
// WHY THIS MODULE EXISTS. Three separate places have to agree about consent:
//
//   1. the INLINE tag in `client/index.html` (defaults + the restore of a
//      returning visitor's stored choice, both of which run before any hit),
//   2. the BANNER (`ConsentBanner.tsx`), which writes the visitor's choice, and
//   3. the ANALYTICS helper (`lib/analytics.ts`), which gates every event.
//
// If the storage key in (1) drifts from the key in (2) and (3), a returning
// visitor's choice is silently ignored and every hit stays denied - which looks
// exactly like "GA4 receives no data". If the REGION list here drifts from the
// one deployed in the tag, a region loses (or gains) consent it should not.
// Both failure modes are silent, so the values live here once and are asserted
// against the deployed HTML by `consent-mode.test.ts`.
//
// This module is deliberately PURE: no `node:crypto`, no DOM, no React. It is
// imported by the client bundle (for the storage keys) and by the test suite,
// so it must stay free of anything that only exists in one of those worlds.
// ────────────────────────────────────────────────────────────────────────────

/** Where the visitor's consent choice is remembered in `localStorage`. Versioned
 *  so a future change to the consent model can invalidate old choices cleanly. */
export const CONSENT_STORAGE_KEY = "petparcel_consent_v1";

/**
 * The consent choice is ALSO mirrored to a first-party cookie.
 *
 * WHY BOTH. `localStorage` is the primary store, but the inline tag in
 * `client/index.html` runs before React (and therefore before `lib/analytics.ts`)
 * has done anything. Reading a small JSON cookie from an inline script is
 * synchronous, string-only and free of the storage-exception handling
 * `localStorage` needs in privacy modes - so the cookie is what lets a returning
 * visitor's GRANTED choice be applied to the tag before the very first hit,
 * instead of the first hit going out denied and only later being corrected.
 * It records the CONSENT DECISION itself (a functional record), never visitor
 * activity.
 */
export const CONSENT_COOKIE_NAME = "pp_consent";

/**
 * The regions whose default consent is DENIED (opt-in required).
 *
 * The 30 EEA states (EU-27 plus Iceland, Liechtenstein and Norway) - where the
 * ePrivacy Directive + GDPR require prior consent - joined by the UK (UK GDPR /
 * PECR), Switzerland (revised FADP) and the Crown Dependencies that apply the
 * same rules (Guernsey, Isle of Man, Jersey).
 *
 * Everything NOT listed here falls through to the general `granted` default,
 * which is what keeps normal GA4 measurement for the store's main US audience.
 * gtag accepts ISO 3166 alpha-2 country codes for a `region` value.
 */
export const EEA_CONSENT_REGIONS: readonly string[] = [
  "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GG", "GR", "HR", "HU", "IE", "IM", "IS",
  "IT", "JE", "LI", "LT", "LU", "LV", "MT", "NL", "NO", "PL",
  "PT", "RO", "SE", "SI", "SK",
];

/** The region list exactly as it must appear in the deployed tag, so the test
 *  can assert the HTML carries THIS list rather than a stale copy of it. */
export const EEA_REGIONS_JSON = JSON.stringify(EEA_CONSENT_REGIONS);

/** The four Consent Mode v2 signals a visitor chooses between. The rest
 *  (`functionality_storage`, `security_storage`) are always granted. */
export const CONSENT_SIGNALS = [
  "ad_storage",
  "ad_user_data",
  "ad_personalization",
  "analytics_storage",
] as const;

// ── HTML inspection ─────────────────────────────────────────────────────────
/** One inline script's inner text, paired with its attributes. */
export interface InlineScript {
  attrs: string;
  body: string;
}

/**
 * Every INLINE `<script>` in the document (i.e. one with no `src`), excluding
 * `application/ld+json` data blocks (which CSP does not apply to as script).
 *
 * This is what the CSP hash check runs over: a `script-src` allow-list of
 * `'self'` does NOT permit an inline script, so each inline script must either
 * carry a matching `'sha256-…'` hash or be blocked outright.
 */
export function extractInlineScripts(html: string): InlineScript[] {
  const out: InlineScript[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue; // external, covered by host allow-list
    if (/application\/ld\+json/i.test(attrs)) continue; // data, not executable
    out.push({ attrs, body: m[2] ?? "" });
  }
  return out;
}

/** The shape of the tag-placement audit, so a caller can report WHY it failed. */
export interface TagPlacement {
  /** How many gtag.js loader `<script src=…>` tags the document has. Must be 1. */
  loaderCount: number;
  /** How many `gtag('config', …)` commands the document has. Must be 1. */
  configCount: number;
  /** How many `gtag('consent', 'default', …)` commands. At least 1. */
  consentDefaultCount: number;
  /** True when every consent default precedes the config command. */
  consentPrecedesConfig: boolean;
  /** True when the deployed region list matches `EEA_CONSENT_REGIONS`. */
  hasRegionScopedDefault: boolean;
  /** True when a general (no-region) default GRANTS storage. */
  hasGrantedGeneralDefault: boolean;
  /** True when the tag waits for a consent update before firing. */
  hasWaitForUpdate: boolean;
  /** True when every rule above holds. */
  ok: boolean;
}

/** Strip HTML comments, so a `gtag('config', ...)` mentioned in PROSE (the
 *  explanatory comment above the snippet) is never mistaken for the real
 *  command. Every audit below runs on the comment-free document. */
export function stripHtmlComments(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

/** Audit one HTML document's Google tag + consent setup. */
export function validateTagPlacement(rawHtml: string): TagPlacement {
  const html = stripHtmlComments(rawHtml);
  const loaderCount = (html.match(/googletagmanager\.com\/gtag\/js/g) ?? []).length;
  const configCount = (html.match(/gtag\(\s*['"]config['"]/g) ?? []).length;
  const defaultRe = /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/g;
  const consentDefaultCount = (html.match(defaultRe) ?? []).length;

  // ORDER IS THE POINT: a `config` command that runs before a consent default
  // reads a consent state that has not been set yet, which is the documented
  // "tag read consent state before a default was set" failure.
  const configAt = html.search(/gtag\(\s*['"]config['"]/);
  const lastDefaultAt = html.lastIndexOf("'default'");
  return {
    loaderCount,
    configCount,
    consentDefaultCount,
    consentPrecedesConfig: configAt !== -1 && lastDefaultAt !== -1 && lastDefaultAt < configAt,
    hasRegionScopedDefault: html.includes(EEA_REGIONS_JSON),
    hasGrantedGeneralDefault: /analytics_storage:\s*['"]granted['"]/.test(html),
    hasWaitForUpdate: /wait_for_update\s*:/.test(html),
    ok:
      loaderCount === 1 &&
      configCount === 1 &&
      consentDefaultCount >= 1 &&
      configAt !== -1 &&
      lastDefaultAt !== -1 &&
      lastDefaultAt < configAt &&
      html.includes(EEA_REGIONS_JSON) &&
      /analytics_storage:\s*['"]granted['"]/.test(html) &&
      /wait_for_update\s*:/.test(html),
  };
}

/** Human-readable reasons a placement audit failed (empty when it passed). */
export function tagPlacementIssues(html: string): string[] {
  const p = validateTagPlacement(html);
  const issues: string[] = [];
  if (p.loaderCount !== 1) issues.push(`expected exactly 1 gtag.js loader, found ${p.loaderCount}`);
  if (p.configCount !== 1) issues.push(`expected exactly 1 gtag('config'), found ${p.configCount}`);
  if (p.consentDefaultCount < 1) issues.push("no gtag('consent','default') command found");
  if (!p.consentPrecedesConfig) issues.push("a consent default does not precede gtag('config')");
  if (!p.hasRegionScopedDefault) issues.push("the deployed region list does not match EEA_CONSENT_REGIONS");
  if (!p.hasGrantedGeneralDefault) issues.push("no general (rest-of-world) default GRANTS storage");
  if (!p.hasWaitForUpdate) issues.push("wait_for_update is missing from the default consent command");
  return issues;
}
