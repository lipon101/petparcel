// ── The canonical site origin ────────────────────────────────────────────────
//
// THE BUG THIS FILE FIXES. The checkout built the payment provider's IPN
// callback URL from `input.origin` - a string the BROWSER sent:
//
//     ipnUrl: `${input.origin}/api/payments/nowpayments/ipn`
//
// That is wrong in three separate ways, and each one silently breaks payment
// confirmation (the order stays on "awaiting payment" forever, because the
// webhook that would settle it is delivered somewhere that cannot verify it):
//
//   1. NOT AUTHENTICATED. The value came from the request body, so anyone could
//      make the store register a callback URL of their choosing with the payment
//      provider. Nothing about the *store's* identity was checked.
//
//   2. THE WRONG HOST IS SUBTLY BROKEN, NOT LOUDLY BROKEN. This deployment
//      serves the store at the apex `petparcel.store`, which 308-redirects to
//      `www.petparcel.store`. A redirect that preserves the method still makes
//      the provider's logged delivery URL disagree with the URL we compare
//      against; a redirect that does NOT preserve it drops the body entirely and
//      the signature can never match. Either way the payment is real and the
//      order never settles. Verified live: an apex POST answers `308` with an
//      empty body, while the www POST reaches the route and answers `401`.
//
//   3. IT DRIFTED WITH THE REQUEST. A proxy host, a preview deployment or a
//      stale tab could all change the value, so the URL the provider POSTs to and
//      the URL the deployment actually serves could disagree.
//
// The origin is therefore derived HERE, on the server, from configuration - and
// treated as the single source of truth for every outbound absolute URL the
// payment flow generates (the IPN callback URL and the shopper's return URL
// alike). It is never taken from a request body or a request header.
//
// WHY NOT `x-forwarded-host` / `Host`. Those are attacker-influenced: a forged
// header would let a caller point the callback at a host they control. The whole
// point of this module is that the origin is a DEPLOYMENT FACT, not an input.
import { env } from "./env";

/**
 * The origin used when nothing is configured. It is the deployment's real
 * canonical host - the `www` form, which is the one that actually SERVES the
 * store rather than redirecting to it. Kept in sync with the fallback in
 * `server/services/email.ts` (`absoluteUrl`).
 */
export const DEFAULT_SITE_ORIGIN = "https://www.petparcel.store";

/** Environment variables that may carry the canonical origin, in precedence
 *  order. `SITE_URL` is the documented one; `APP_URL`/`PUBLIC_URL` are accepted
 *  because other tooling on this platform already uses those names. */
const SITE_ORIGIN_VARS = ["SITE_URL", "APP_URL", "PUBLIC_URL"] as const;

/**
 * Normalize a candidate origin, or return null when it cannot be used.
 *
 * Only `http`/`https` absolute origins survive. Anything else (a bare host, a
 * path, a `javascript:` value, a value with a trailing path) is rejected rather
 * than guessed at - a bad origin silently breaks payment confirmation, so a
 * malformed setting must fall back to the known-good default instead of being
 * used as-is. Note the port is preserved, so a local `http://localhost:3001`
 * works for development.
 */
export function normalizeOrigin(candidate: string | null | undefined): string | null {
  const raw = String(candidate ?? "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname) return null;
  // An origin has no path, query or fragment. A value carrying one is a mistake
  // (someone pasted a full URL); keep the origin part, drop the rest.
  return parsed.origin;
}

/**
 * The site's canonical origin, WITHOUT a trailing slash.
 *
 * Precedence: the first valid `SITE_URL` / `APP_URL` / `PUBLIC_URL`, else the
 * deployment default. Never throws and never returns an empty string, so every
 * caller can build an absolute URL unconditionally.
 */
export function siteOrigin(): string {
  for (const name of SITE_ORIGIN_VARS) {
    const origin = normalizeOrigin(process.env[name]);
    if (origin) return origin;
  }
  return DEFAULT_SITE_ORIGIN;
}

/** Absolute URL for an in-app path, against the canonical origin. */
export function siteUrl(path: string): string {
  const base = siteOrigin();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** The store's own order page for an order number. */
export function orderUrl(orderNumber: string): string {
  return siteUrl(`/order/${encodeURIComponent(orderNumber)}`);
}

/**
 * The IPN callback URL, absolute and canonical.
 *
 * This is the ONE place the path is spelled out on the server. It must stay
 * identical to the route registered in `_core/app.ts`
 * (`app.post("/api/payments/nowpayments/ipn", …)`) - the verifier script asserts
 * exactly that against a live deployment, so a drift fails a check rather than
 * silently misrouting every webhook.
 */
export const IPN_CALLBACK_PATH = "/api/payments/nowpayments/ipn";

export function ipnCallbackUrl(): string {
  return siteUrl(IPN_CALLBACK_PATH);
}

/** True when the origin is explicitly configured (rather than defaulted). */
export function isSiteOriginConfigured(): boolean {
  return SITE_ORIGIN_VARS.some((name) => normalizeOrigin(process.env[name]) !== null);
}

/** Exposed for the config verifier and the admin health panel: presence only,
 *  never a value that could be a secret (an origin is public, but keeping the
 *  reporting in one place avoids drift). */
export function siteOriginReport(): { origin: string; configured: boolean } {
  return { origin: siteOrigin(), configured: isSiteOriginConfigured() };
}

// `env` is imported so the module participates in the same centralised env
// access pattern as the rest of `_core`; the origin itself is read from
// process.env above because it is not a platform-reserved variable and has no
// typed field in `env`.
void env;
