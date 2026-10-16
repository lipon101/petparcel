// ─────────────────────────────────────────────────────────────────────────────
// Consent UI control - the seam that lets any component REOPEN the banner.
//
// WHY THIS EXISTS. `saveConsent(...)` in `lib/analytics.ts` already handles
// everything about a consent DECISION: persisting it, pushing
// `gtag('consent', 'update', ...)`, and notifying subscribers. What it cannot do
// is put the UI back on screen. Withdrawing consent has to stay reachable from
// every page, though - that is the GDPR right, and a choice a visitor can only
// make once is not a real choice - so the footer's "Cookie settings" link needs a
// way to ask the banner to reappear, pre-filled with what the visitor already
// said.
//
// This module is that request channel, and nothing else:
//
//   * `openConsentPreferences()` - a component calls this to reopen the banner.
//   * `CONSENT_OPEN_EVENT` - the event name `ConsentBanner` listens for.
//
// It is deliberately a DOM CustomEvent rather than React context: the footer sits
// inside the routed tree while the banner is mounted by `main.tsx` OUTSIDE it, so
// a context provider would have to wrap both and the admin surface alone would
// still be uncovered. A window event needs no provider and reaches the banner
// wherever it is mounted.
//
// Kept in a leaf module (no React, no imports from the banner) so the footer can
// depend on it without pulling the banner into its bundle.
// ─────────────────────────────────────────────────────────────────────────────

/** The window event `ConsentBanner` listens for. Namespaced to avoid a clash. */
export const CONSENT_OPEN_EVENT = "petparcel:open-consent";

/**
 * Ask the consent banner to reappear so the visitor can review or change their
 * choice. A no-op outside the browser, so it is safe to call from any handler.
 *
 * The banner re-reads the STORED choice when it opens, so the visitor's current
 * preferences arrive already toggled - reopening is a review, not a reset.
 */
export function openConsentPreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}
