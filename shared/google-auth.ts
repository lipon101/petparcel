// Google sign-in, browser side.
//
// Neon Auth runs the OAuth exchange on ITS OWN origin, so the shopper leaves the
// site, authorises on Google, and comes back to a callback page here carrying a
// ONE-TIME verifier in the query string. The callback has to turn that verifier
// into "this site is signed in".
//
// HOW the callback gets a credential, and why this way:
//   The verifier is only half of the handshake. The provider also sets an OAuth
//   session-challenge cookie when the flow STARTS, and the exchange is refused
//   without it. That cookie is set `Partitioned` while the top-level site is the
//   provider's own origin, so the browser will never send it back from the
//   store's origin - which is exactly why a browser-side exchange can never
//   work, and why the callback used to spin forever. The server therefore parks
//   the challenge on OUR origin when the flow starts, and performs the exchange
//   itself; the browser only has to hand over the verifier.
//
// Lives in `shared/` because the callback PATH must be one value on both sides:
// the server builds the URL it hands to the provider, and the client route has
// to match it. Pure functions only - no React, no fetch - so they are unit-
// testable in this repo's node test environment.

/** Where Neon Auth should send the shopper back to. A single, fixed path means
 *  the trusted-origin entry in the provider console is one value, and the route
 *  can never be pointed somewhere else by a crafted link. */
export const GOOGLE_CALLBACK_PATH = "/auth/callback";

/** The full callback URL for a given site origin. */
export function googleCallbackUrl(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${GOOGLE_CALLBACK_PATH}`;
}

/** The query parameter Neon Auth appends to the callback URL.
 *
 *  It carries a ONE-TIME verifier that must be exchanged - server-side, together
 *  with the OAuth session-challenge cookie captured when the flow started - for
 *  the provider session. It is a credential: it is consumed exactly once and is
 *  stripped from the address bar the moment the callback renders, so it can
 *  never be bookmarked, shared, or left behind in the browser's history. */
export const GOOGLE_SESSION_VERIFIER_PARAM = "neon_auth_session_verifier";

/** The verifier out of a callback URL's query string, or null when absent. */
export function readSessionVerifier(search: string): string | null {
  const value = new URLSearchParams(search).get(GOOGLE_SESSION_VERIFIER_PARAM);
  return value && value.trim() ? value.trim() : null;
}

/** The same URL with the verifier removed, keeping every other parameter and the
 *  hash. Handed to `history.replaceState` so the credential never lingers. */
export function stripSessionVerifier(href: string): string {
  try {
    const url = new URL(href);
    url.searchParams.delete(GOOGLE_SESSION_VERIFIER_PARAM);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

/** One neutral sentence for any failed completion. The shopper is told what to
 *  do, never what the provider said - a provider message can name internals. */
export const GOOGLE_FAILURE_MESSAGE =
  "We couldn't complete the Google sign-in. Please try again, or sign in with your email and password.";

/** Shown when the one-time verifier is missing, expired or already used - the
 *  shopper needs to start again, and telling them that is kinder than a spinner
 *  that never resolves. */
export const GOOGLE_EXPIRED_MESSAGE =
  "That sign-in link has expired or was already used. Please start again - it only takes a moment.";

/** Whether the return was the shopper declining / the provider refusing, which
 *  is not an error worth alarming them about. `error` and `error_description`
 *  are what an OAuth provider appends to the callback URL. */
export function googleReturnedError(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("error");
}
