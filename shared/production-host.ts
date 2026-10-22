// ── The production host allow-list ──────────────────────────────────────────
// ONE definition of "is this the live storefront?", shared by every surface
// that must behave differently on a preview deployment.
//
// WHY THIS EXISTS. A Vercel project serves the SAME build on many hostnames:
// the production domain, and a fresh `*.vercel.app` URL for every preview and
// every deployment. Those preview URLs are public, and they were being picked
// up by Google Search Console, Bing and Microsoft Clarity - which recorded
// HeadlessChrome bot sessions against `petparcel-<hash>-<team>.vercel.app`
// instead of the store. The fix is to make the production host a single,
// explicit fact and to consult it from every place that could leak:
//
//   * the analytics/tracking tags (GA4, Google Ads, Microsoft Clarity) must
//     only INITIALIZE on the production host,
//   * non-production hosts must never be indexed (a noindex robots meta and an
//     `X-Robots-Tag: noindex` response header),
//   * canonical URLs must always name the production origin, whatever host
//     served the page.
//
// Keeping the list here (rather than repeating the string in each file) is what
// stops the three from drifting apart - a drift that is silent, because a
// preview host that still loads the tag looks perfectly healthy.

/** The hostnames that serve the LIVE storefront. `www` is the canonical one;
 *  the apex is accepted because it 308-redirects to `www` and a request can
 *  still arrive on it before the redirect. */
export const PRODUCTION_HOSTS: readonly string[] = ["www.petparcel.store", "petparcel.store"];

/** The canonical production origin, without a trailing slash. Every canonical
 *  URL and every absolute OG/JSON-LD URL is built against this. */
export const PRODUCTION_ORIGIN = "https://www.petparcel.store";

/**
 * Is `host` the production storefront?
 *
 * Accepts a bare hostname, a `host:port`, or a full URL, and is
 * case-insensitive. Anything that is not one of `PRODUCTION_HOSTS` - a
 * `*.vercel.app` preview, `localhost`, an IP, an empty value - is NOT
 * production, which is the safe default: an unrecognised host must never be
 * treated as the live store.
 */
export function isProductionHost(host: string | null | undefined): boolean {
  const raw = String(host ?? "").trim().toLowerCase();
  if (!raw) return false;
  // A full URL (or a value carrying a path) - keep only the hostname.
  let candidate = raw;
  if (candidate.includes("://")) {
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      return false;
    }
  }
  // Drop a port and any trailing path/query/fragment.
  candidate = candidate.split("/")[0].split("?")[0].split("#")[0];
  candidate = candidate.replace(/:\d+$/, "");
  return PRODUCTION_HOSTS.includes(candidate);
}
