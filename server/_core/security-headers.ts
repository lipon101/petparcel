// Response security headers, applied to EVERY response this app produces.
//
// WHY IN THE APP AND NOT ONLY IN vercel.json. `vercel.json` applies headers on
// the Vercel edge, which covers the deployed storefront - but the SAME Hono app
// also runs as a plain Node process (`pnpm start`, and
// every gate that boots `dist/index.js`). Headers configured only in the edge
// config are therefore absent on those origins, and a header that exists on one
// host and not another is exactly the kind of gap an auditor finds and a
// developer cannot reproduce. Setting them HERE means every response from every
// entry point carries them; `vercel.json` keeps its copy for the statically
// served SPA, which never reaches this code.
//
// The policies are deliberately narrow and each one has a reason:
//
//   Content-Security-Policy - the storefront loads its own hashed bundles, its
//     own images on the R2 media host, Google Fonts, and the Google tag
//     (gtag.js) that carries GA4 + Google Ads measurement. Everything else is
//     refused. `frame-ancestors` is the modern replacement for X-Frame-Options
//     and covers the hosts the app is legitimately embedded in; `object-src
//     'none'` kills plugin content, and `base-uri 'self'` stops an injected
//     <base> from re-pointing every relative URL on the page.
//
//     THE GOOGLE TAG IS WHY script-src IS NOT JUST 'self'. Measurement needs
//     three things a bare 'self' policy refuses: the gtag.js loader itself, the
//     INLINE snippet in client/index.html that defines gtag() and sets the
//     consent defaults, and the collection beacon the tag then sends. A
//     script-src of 'self' silently blocks all three -- the page still renders,
//     the tag is simply never allowed to run -- so a self-hosted deploy would
//     look perfectly healthy while GA4 recorded nothing. The allow-list below is
//     the minimum that makes the tag work: the two Google hosts, plus the
//     sha256 hash of the ONE inline snippet (a hash is preferred over
//     'unsafe-inline', which would permit ANY inline script). The hash is pinned
//     to the deployed document by google-tag-csp.test.ts, so an edit to the
//     snippet fails the suite instead of silently disabling the tag.
//
//   Strict-Transport-Security - browsers are told to keep this origin on HTTPS.
//     Only meaningful (and only sent) on HTTPS, since a browser ignores it over
//     plain HTTP; sending it from localhost would pin a developer's browser.
//
//   X-Content-Type-Options: nosniff - without it a browser may sniff a JSON
//     error page as HTML and render it, which is how a stray error response
//     becomes a page. `nosniff` is also what makes our strict `content-type`
//     actually bind.
//
//   X-Frame-Options: SAMEORIGIN - the legacy twin of `frame-ancestors`, kept for
//     browsers that do not implement CSP level 2.
//
//   Referrer-Policy - full URL to our own origin, bare origin elsewhere, so a
//     product URL never leaks to a third party through a referrer header.
//
//   Permissions-Policy - the store needs none of these; denying them means an
//     injected script cannot ask for the camera or the user's location.
//
//   Cross-Origin-Opener-Policy - severs the window handle a cross-origin opener
//     would otherwise hold, which closes the tab-napping class of attack.
//
//   X-Robots-Tag - a NON-PRODUCTION host (a `*.vercel.app` preview, a local run)
//     must never be indexed. The header is emitted ONLY when the request host is
//     not the production storefront, so the live site is unaffected. It is the
//     crawler-facing half of the same rule the client tag gate and the SSR
//     noindex enforce; the host decision lives in `shared/production-host.ts`.

import { isProductionHost } from "@shared/production-host";

/** The media host the storefront's product imagery is served from (Cloudflare
 *  R2 behind the store's own subdomain). Declared here so the CSP and the
 *  application cannot drift apart. */
const MEDIA_HOST = "https://media.petparcel.store";

/** The hosts the storefront is legitimately embedded in. Mirrors
 *  `HTTPS_HOST_SUFFIXES` in `session-cookie.ts`, which is the list that decides
 *  whether a partitioned session cookie is written - the two must agree, or an
 *  embed would be framed but unable to sign in. */
const FRAME_ANCESTORS = [
  "'self'",
  "https://*.teamily.run",
  "https://*.chainopera.run",
  "https://*.chainopera.io",
].join(" ");

/** The Google hosts the tag needs. `www.googletagmanager.com` serves gtag.js,
 *  the tag container and the measurement-config endpoint; `www.google-analytics.com`
 *  (and its region subdomains) receive the GA4 collection beacons; the
 *  `doubleclick` host carries the ads-side signals. Declared here so the CSP and
 *  the tag cannot drift apart. */
const GOOGLE_TAG_SCRIPT_HOSTS = ["https://www.googletagmanager.com"];
const GOOGLE_TAG_CONNECT_HOSTS = [
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://analytics.google.com",
  "https://stats.g.doubleclick.net",
  "https://www.google.com",
];
/** The image hosts the tag uses: the GA4 beacon pixel and Google Signals. */
const GOOGLE_TAG_IMG_HOSTS = [
  "https://www.google-analytics.com",
  "https://www.googletagmanager.com",
];

/**
 * The sha256 of the SINGLE inline `<script>` in `client/index.html` -- the Google
 * tag snippet that defines `gtag()`, sets the Consent Mode v2 defaults (scoped
 * to the EEA/UK/CH, with a granted rest-of-world default) and restores a
 * returning visitor's stored choice.
 *
 * A HASH, NOT 'unsafe-inline'. `script-src 'unsafe-inline'` would permit ANY
 * inline script on the page, which is the exact hole CSP exists to close. A
 * source hash authorises one byte-for-byte-identical snippet and nothing else.
 * The consequence is that the two must stay in lockstep: editing the snippet
 * changes its hash, and this constant then has to change with it. That coupling
 * is deliberate and it is enforced -- `google-tag-csp.test.ts` recomputes the
 * hash from the real `client/index.html` and fails if it drifts, so the tag can
 * never be silently disabled by a well-meaning edit.
 */
const INLINE_TAG_SCRIPT_HASH = "'sha256-CO2vLZQ8MzB/LAac/PCsOxWPG7J0rz7sk0kADV2H92M='";

/**
 * The sha256 of the SECOND inline `<script>` in `client/index.html` -- the
 * Microsoft Clarity snippet (session recordings + heatmaps). Like the Google tag
 * above it is pinned by hash rather than allowed with 'unsafe-inline', so only
 * this exact snippet is authorised. `google-tag-csp.test.ts` recomputes it from
 * the real document and fails if the snippet is edited without updating this
 * constant.
 */
const INLINE_CLARITY_SCRIPT_HASH = "'sha256-oT3a508jaLWte3/iT/0ag5hu416EGbr8lN2R1wuSrWY='";

/** The Microsoft Clarity hosts. `www.clarity.ms` serves the tag script; the
 *  `*.clarity.ms` hosts receive the collection beacons (and the `c.bing.com`
 *  host carries the ads-side signal Clarity shares with Microsoft Advertising).
 *  Declared here so the CSP and the tag cannot drift apart. */
const CLARITY_SCRIPT_HOSTS = ["https://www.clarity.ms"];
const CLARITY_CONNECT_HOSTS = [
  "https://www.clarity.ms",
  "https://*.clarity.ms",
  "https://c.bing.com",
];
const CLARITY_IMG_HOSTS = ["https://www.clarity.ms", "https://*.clarity.ms", "https://c.bing.com"];


/**
 * The CSP. Written as one line so it is easy to diff and to read in a header
 * dump. `'unsafe-inline'` is present for STYLE only: the SPA ships Tailwind
 * utility classes plus a small number of inline `style` attributes written by
 * React (swatch colours are the obvious one), and no nonce mechanism can cover
 * a `style=""` attribute. Scripts get NO such blanket allowance - the bundles
 * are content-addressed and self-hosted, and the one inline snippet is pinned
 * by hash.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors " + FRAME_ANCESTORS,
  "form-action 'self'",
  ["script-src 'self'", INLINE_TAG_SCRIPT_HASH, INLINE_CLARITY_SCRIPT_HASH, ...GOOGLE_TAG_SCRIPT_HOSTS, ...CLARITY_SCRIPT_HOSTS].join(" "),
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://tagassistant.google.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  ["img-src 'self' data: blob: https://static.teamily.ai", MEDIA_HOST, ...GOOGLE_TAG_IMG_HOSTS, ...CLARITY_IMG_HOSTS].join(" "),
  ["connect-src 'self'", ...GOOGLE_TAG_CONNECT_HOSTS, ...CLARITY_CONNECT_HOSTS].join(" "),
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

/**
 * The headers, as a plain map, so they can be asserted in a unit test without
 * booting a server. `https` decides the two that must not be sent over plain
 * HTTP. `host` (when supplied) decides whether the response is marked
 * `noindex` - a non-production host must never be indexed.
 */
export function securityHeaders(https: boolean, host?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
  // A non-production host must never be indexed. Only emitted when a host is
  // known AND it is not the live storefront, so the production response is
  // byte-for-byte what it was before.
  if (host !== undefined && !isProductionHost(host)) {
    headers["X-Robots-Tag"] = "noindex, nofollow";
  }
  if (https) {
    // HSTS on HTTPS only: a browser ignores it over http://, and sending it from
    // a local dev origin would pin the developer's browser to https.
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

/** Whether the request reached us over HTTPS, judged from the same positive
 *  signals the session cookie uses (`x-forwarded-proto`, host suffix, Origin).
 *  Kept structural so it accepts a Hono context without importing one. */
export function requestIsHttps(c: {
  req: { url: string; header: (name: string) => string | undefined };
}): boolean {
  const url = c.req.url ?? "";
  if (url.startsWith("https://")) return true;
  const first = (raw: string | undefined) => raw?.split(",")[0]?.trim().toLowerCase();
  if (first(c.req.header("x-forwarded-proto")) === "https") return true;
  if ((c.req.header("x-forwarded-ssl") ?? "").trim().toLowerCase() === "on") return true;
  const host = first(c.req.header("x-forwarded-host")) ?? first(c.req.header("host")) ?? "";
  if (/\.(teamily\.run|chainopera\.run|chainopera\.io|petparcel\.store)$/.test(host)) return true;
  for (const name of ["origin", "referer"]) {
    const value = c.req.header(name);
    if (value && value.startsWith("https://")) return true;
  }
  return false;
}

/**
 * The host the request was addressed to, judged from the same positive signals
 * `requestIsHttps` uses. `x-forwarded-host` wins over `host` because a proxy
 * (Vercel, Cloudflare) rewrites `host` to the upstream origin while the
 * forwarded header keeps the hostname the visitor actually asked for - which is
 * the one that decides whether this is the production storefront.
 *
 * Returns "" when no host can be determined, which `isProductionHost` treats as
 * NOT production (the safe default).
 */
export function requestHost(c: {
  req: { url: string; header: (name: string) => string | undefined };
}): string {
  const first = (raw: string | undefined) => raw?.split(",")[0]?.trim().toLowerCase() ?? "";
  const forwarded = first(c.req.header("x-forwarded-host"));
  if (forwarded) return forwarded;
  const host = first(c.req.header("host"));
  if (host) return host;
  try {
    return new URL(c.req.url).hostname;
  } catch {
    return "";
  }
}
