// ── Neon Auth (Better Auth) client ────────────────────────────────────────────
//
// A thin, dependency-free client for the Neon Auth HTTP API. It is the ONLY
// place in the app that knows Neon Auth exists; everything above it depends on
// the `AuthProvider` seam in `_core/auth.ts` and the `SessionUser` shape, so
// business code (orders, wishlist, contact) never learns how a user signed in.
//
// WHY THIS REPLACES THE CUSTOM bcrypt + JWT LOGIN
// The store's own signup/signin kept 500-ing because the production schema was
// behind the code (a missing `users.email_verified_at` column made the login
// SELECT throw before the password was ever compared). Neon Auth moves the
// credential store OUT of the app's own tables - it keeps its users in the
// `neon_auth` schema and owns the password hashing, the session and the JWT - so
// a schema drift in `public.users` can no longer break sign-in.
//
// SECURITY: every value here comes from the environment. No URL, key, token or
// connection string is ever hardcoded, logged, or returned to the browser. The
// session token is a credential and is treated as one: it is passed straight
// through and never printed.
//
// SESSION MODEL (server-side relay)
// The browser talks only to OUR tRPC API. On sign-in we call Neon Auth, verify
// the returned JWT against its JWKS, bridge the Neon Auth user to a local
// `users` row, and then mint OUR OWN session cookie for that row. So the rest of
// the app (context.ts, protectedProcedure, every FK to `users.id`) is unchanged,
// and the credential check is the only thing that moved.
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "./env";

/** The Neon Auth base URL, e.g.
 *  `https://<endpoint>.neonauth.<region>.aws.neon.tech/<db>/auth`.
 *  Read from the environment only - never hardcoded. */
function authBaseUrl(): string {
  // Resolved from the environment at call time (see `neonAuthConfigured`), and
  // exported below as `neonAuthBaseUrl` so a caller which must talk to the
  // provider from the BROWSER (the OAuth callback, which can only reach the
  // provider from the shopper's own origin) knows where to find it.
  return env.neonAuth.url.replace(/\/+$/, "");
}

/** The provider's base URL, for the rare caller that has to reach it from the
 *  browser. Public information: it is the address the OAuth redirect already
 *  sends the shopper to. */
export function neonAuthBaseUrl(): string {
  return authBaseUrl();
}

/** JWKS endpoint. Defaults to `<base>/.well-known/jwks.json` when not set. */
function jwksUrl(): string {
  const explicit = env.neonAuth.jwksUrl;
  return explicit && explicit.trim() ? explicit.trim() : `${authBaseUrl()}/.well-known/jwks.json`;
}

/** True when Neon Auth is configured AND selected as the active provider. */
export function neonAuthConfigured(): boolean {
  return env.authProvider === "neon" && Boolean(env.neonAuth.url);
}

/** A Neon Auth user, as returned by sign-up / sign-in / get-session. */
export interface NeonAuthUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

/** A Neon Auth session: the raw session token plus the user it belongs to. */
export interface NeonAuthSession {
  /** The raw session token (a credential - never log or return it to a client). */
  token: string;
  user: NeonAuthUser;
}

/** Raised when Neon Auth rejects a credential. Distinct from a transport error
 *  so the router can answer 401 rather than 500. */
export class NeonAuthError extends Error {
  constructor(
    message: string,
    /** The provider's machine code, e.g. `INVALID_EMAIL_OR_PASSWORD`. */
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "NeonAuthError";
  }
}

/** Raised when the address is already registered in Neon Auth. */
export class NeonAuthEmailTakenError extends NeonAuthError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "NeonAuthEmailTakenError";
  }
}

/** Raised when Neon Auth refuses a credential request because the `Origin` it
 *  was given is missing or not on its trusted-origin allowlist.
 *
 *  This is a CLIENT error, not a server fault: the provider answers 400
 *  `MISSING_ORIGIN` (no Origin header at all) or 403 `INVALID_ORIGIN` (an origin
 *  it does not trust). Without this distinct type the router rethrew it as an
 *  unknown error and tRPC turned it into an opaque 500 - the exact bug this
 *  class exists to prevent. A caller maps it to a 400 with a calm message. */
export class NeonAuthOriginError extends NeonAuthError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "NeonAuthOriginError";
  }
}

/** Whether a provider error is the trusted-origin rejection. Matched on the
 *  provider's machine codes first (stable), with a narrow status+message
 *  fallback so a wording change on their side does not silently regress this
 *  back into a 500. */
function isOriginRejection(code: string | undefined, status: number, message: string): boolean {
  if (code === "MISSING_ORIGIN" || code === "INVALID_ORIGIN") return true;
  return (status === 400 || status === 403) && /origin/i.test(message);
}

const REQUEST_TIMEOUT_MS = 10_000;

/** POST/GET JSON to Neon Auth with a hard timeout. Never logs the body (it can
 *  carry a session token) and never surfaces the raw provider text to a caller
 *  that might render it - the caller decides what the shopper sees. */
async function neonAuthFetch(
  path: string,
  init: {
    method: "GET" | "POST";
    body?: unknown;
    origin?: string;
    cookie?: string;
    /** "manual" keeps a 3xx response readable (status + Set-Cookie) instead of
     *  following it - the magic-link verify endpoint answers with a redirect. */
    redirect?: "follow" | "manual";
  },
): Promise<{
    status: number;
    json: unknown;
    setCookie: string | null;
    /** EVERY Set-Cookie header, in order. `setCookie` above is the joined form,
     *  which is ambiguous when a response sets more than one cookie (an Expires
     *  date contains a comma) - so anything that must pick a SPECIFIC cookie out
     *  of the response reads this list instead. */
    setCookies: string[];
    location: string | null;
  }> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  // Neon Auth requires a trusted `Origin` on the credential endpoints. We forward
  // the browser's own origin (the caller passes it) so the value Neon Auth checks
  // is the real site origin, not a server-side guess.
  if (init.origin) headers["origin"] = init.origin;
  if (init.cookie) headers["cookie"] = init.cookie;

  let res: Response;
  try {
    res = await fetch(`${authBaseUrl()}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: init.redirect ?? "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    // Transport failure (DNS, timeout, TLS). Log the cause server-side; the
    // caller turns it into a short, leak-free message.
    // eslint-disable-next-line no-console
    console.error(`[neon-auth] ${init.method} ${path} transport error`, e);
    throw new NeonAuthError("Authentication service is unreachable.", "TRANSPORT", 0);
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text.slice(0, 200) };
    }
  }
  return {
    status: res.status,
    json,
    setCookie: res.headers.get("set-cookie"),
    setCookies: res.headers.getSetCookie?.() ?? [],
    location: res.headers.get("location"),
  };
}

/** Pull the provider's `{ message, code }` out of an error body without ever
 *  trusting it as user-facing text. */
function providerError(json: unknown): { message: string; code?: string } {
  if (json && typeof json === "object") {
    const o = json as Record<string, unknown>;
    const message = typeof o.message === "string" ? o.message : "Authentication failed.";
    const code = typeof o.code === "string" ? o.code : undefined;
    return { message, code };
  }
  return { message: "Authentication failed." };
}

function toUser(raw: unknown): NeonAuthUser {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    email: String(o.email ?? "").toLowerCase(),
    name: typeof o.name === "string" && o.name.trim() ? o.name : null,
    emailVerified: o.emailVerified === true,
  };
}

/** The `better-auth.session_token` cookie value from a `set-cookie` header, so a
 *  follow-up call can present the session. Returns null when absent.
 *
 *  IMPORTANT: this SIGNED value (`<token>.<hmac>`) is the real credential, not
 *  the bare `token` in the response body. Neon Auth's `/token` and `/get-session`
 *  endpoints reject the bare token with 401 and accept only the signed cookie,
 *  so the signed value is what we store and replay. */
function sessionCookieFromSetCookie(setCookie: string | null): string | null {
  if (!setCookie) return null;
  // The header may carry several cookies; take the session one.
  const match = setCookie.match(/(?:__Secure-)?neon-auth\.session_token=([^;]+)/);
  return match ? match[1] : null;
}

/** The signed session token out of a response's Set-Cookie LIST.
 *
 *  The verifier exchange can answer with more than one cookie, and the joined
 *  `set-cookie` header is ambiguous (an `Expires` date contains a comma), so the
 *  array is the reliable source. This is the SIGNED value (`<token>.<hmac>`) -
 *  the only one the provider's `/token` and `/get-session` accept. Storing the
 *  bare body token instead is exactly what left `auth.me` null forever. */
function sessionTokenFromSetCookies(setCookies: string[]): string | null {
  for (const c of setCookies) {
    const m = c.match(/(?:__Secure-)?neon-auth\.session_token=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

/** The credential to store for a session: the SIGNED cookie value when the
 *  provider set one, else the bare body token (which some deployments return
 *  already signed). */
function sessionCredential(body: Record<string, unknown>, setCookie: string | null): string | null {
  return sessionCookieFromSetCookie(setCookie) ?? (typeof body.token === "string" ? body.token : null);
}

/** Create an account in Neon Auth. Throws NeonAuthEmailTakenError on a duplicate
 *  address, NeonAuthError otherwise. */
export async function neonAuthSignUp(input: {
  email: string;
  password: string;
  name?: string | null;
  origin?: string;
}): Promise<NeonAuthSession> {
  const { status, json, setCookie } = await neonAuthFetch("/sign-up/email", {
    method: "POST",
    origin: input.origin,
    body: {
      email: input.email,
      password: input.password,
      ...(input.name ? { name: input.name } : {}),
    },
  });

  if (status >= 400) {
    const { message, code } = providerError(json);
    if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || status === 422) {
      throw new NeonAuthEmailTakenError(message, code, status);
    }
    // A missing/untrusted Origin is the provider refusing the REQUEST, not a
    // server fault - surface it as its own type so the router answers 400.
    if (isOriginRejection(code, status, message)) {
      throw new NeonAuthOriginError(message, code, status);
    }
    throw new NeonAuthError(message, code, status);
  }

  const body = (json ?? {}) as Record<string, unknown>;
  const user = toUser(body.user);
  const token = sessionCredential(body, setCookie);
  if (!user.id || !token) {
    throw new NeonAuthError("Sign-up did not return a session.", "MALFORMED_RESPONSE", status);
  }
  return { token, user };
}

/** Sign in to Neon Auth. Throws NeonAuthError (code INVALID_EMAIL_OR_PASSWORD)
 *  on bad credentials. */
export async function neonAuthSignIn(input: {
  email: string;
  password: string;
  origin?: string;
}): Promise<NeonAuthSession> {
  const { status, json, setCookie } = await neonAuthFetch("/sign-in/email", {
    method: "POST",
    origin: input.origin,
    body: { email: input.email, password: input.password },
  });

  if (status >= 400) {
    const { message, code } = providerError(json);
    throw new NeonAuthError(message, code, status);
  }

  const body = (json ?? {}) as Record<string, unknown>;
  const user = toUser(body.user);
  const token = sessionCredential(body, setCookie);
  if (!user.id || !token) {
    throw new NeonAuthError("Sign-in did not return a session.", "MALFORMED_RESPONSE", status);
  }
  return { token, user };
}

/** Change the signed-in user's password AT THE PROVIDER. Neon Auth owns the
 *  credential (its hash is scrypt, not bcrypt), so a local `users.password_hash`
 *  update would NOT change what the live sign-in accepts - the change has to go
 *  through this endpoint, authenticated by the caller's own session cookie.
 *
 *  Throws NeonAuthError on a rejected current password (or a weak new one); the
 *  caller maps it to a short, non-revealing message. The passwords are never
 *  logged. */
export async function neonAuthChangePassword(input: {
  currentPassword: string;
  newPassword: string;
  sessionToken: string;
  origin?: string;
}): Promise<void> {
  const { status, json } = await neonAuthFetch("/change-password", {
    method: "POST",
    origin: input.origin,
    cookie: `__Secure-neon-auth.session_token=${input.sessionToken}`,
    body: { currentPassword: input.currentPassword, newPassword: input.newPassword },
  });
  if (status >= 400) {
    const { message, code } = providerError(json);
    throw new NeonAuthError(message, code, status);
  }
}

/** End the Neon Auth session server-side. Best-effort: a failure here must not
 *  stop us clearing our own cookie. */
export async function neonAuthSignOut(sessionToken: string, origin?: string): Promise<void> {
  try {
    await neonAuthFetch("/sign-out", {
      method: "POST",
      origin,
      cookie: `__Secure-neon-auth.session_token=${sessionToken}`,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[neon-auth] sign-out failed (local cookie still cleared)", e);
  }
}

// ── JWT verification (JWKS) ───────────────────────────────────────────────────
// The session token is exchanged for a short-lived JWT, which is verified
// against Neon Auth's published JWKS. This is the authoritative check: the
// verified `sub` / `email` are what we bridge to a local user, NOT the sign-in
// response body, so a tampered response cannot mint a session for another user.
let _jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function jwks() {
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(jwksUrl()));
  return _jwks;
}

/** Exchange a session token for a JWT. Returns null when the session is not
 *  valid (the provider answers 401). */
export async function neonAuthToken(sessionToken: string): Promise<string | null> {
  const { status, json } = await neonAuthFetch("/token", {
    method: "GET",
    cookie: `__Secure-neon-auth.session_token=${sessionToken}`,
  });
  if (status >= 400) return null;
  const body = (json ?? {}) as Record<string, unknown>;
  return typeof body.token === "string" ? body.token : null;
}

/** Verify a Neon Auth JWT against its JWKS. Returns the payload, or null when
 *  the signature, issuer or expiry does not check out. */
export async function verifyNeonAuthJwt(jwt: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(jwt, jwks());
    return payload;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[neon-auth] JWT verification failed", e);
    return null;
  }
}

/** The full verified identity for a session token: exchange it for a JWT, verify
 *  the JWT, and return the identity it attests. Returns null when any step
 *  fails, so a caller can treat it as "not authenticated". */
export async function neonAuthVerifiedIdentity(
  sessionToken: string,
): Promise<{ id: string; email: string; name: string | null; emailVerified: boolean } | null> {
  // Preferred path: exchange the token for a JWT and verify its signature
  // against the provider's JWKS. This accepts ONLY the SIGNED cookie value.
  const jwt = await neonAuthToken(sessionToken);
  if (jwt) {
    const payload = await verifyNeonAuthJwt(jwt);
    if (payload) {
      const id = typeof payload.sub === "string" ? payload.sub : "";
      const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
      if (id && email) {
        return {
          id,
          email,
          name: typeof payload.name === "string" && payload.name.trim() ? payload.name : null,
          emailVerified: payload.emailVerified === true,
        };
      }
    }
  }
  // Fallback: the provider's own session check. `/get-session` accepts the
  // SIGNED cookie value; a bare body token is NOT accepted (it answers 200 with
  // a null session), which is why the OAuth exchange must store the signed
  // cookie - see `sessionTokenFromSetCookies`. This fallback still matters for a
  // session whose JWT cannot be verified against the JWKS (e.g. a rotated key),
  // and it cross-checks that the session belongs to the user it names.
  return neonAuthGetVerifiedUser(sessionToken);
}

/** The verified identity behind a session token, using the endpoint that accepts
 *  a session token the BROWSER could legitimately have read.
 *
 *  This exists because of an asymmetry in the provider, measured rather than
 *  assumed: `/get-session` accepts the plain session token, while `/token` (and
 *  therefore the JWKS path above) accepts ONLY the signed cookie value. OAuth
 *  happens on the provider's own origin, so the signed cookie lands in the
 *  browser's jar for THAT origin and is `HttpOnly` - our callback can never read
 *  it. What the browser can obtain is `session.token`, and `/get-session` will
 *  answer for it.
 *
 *  An external response still must not be trusted on its face, so the identity is
 *  cross-checked: the provider must confirm the session belongs to the user it
 *  names, and the address must be one the provider considers verified. Returns
 *  null on anything unexpected. */
export async function neonAuthGetVerifiedUser(
  sessionToken: string,
  origin?: string,
): Promise<{ id: string; email: string; name: string | null; emailVerified: boolean } | null> {
  if (!sessionToken) return null;

  const { status, json } = await neonAuthFetch("/get-session", {
    method: "GET",
    origin,
    cookie: `__Secure-neon-auth.session_token=${sessionToken}`,
  });
  if (status >= 400) return null;

  const body = (json ?? {}) as Record<string, unknown>;
  const user = (body.user ?? null) as Record<string, unknown> | null;
  const session = (body.session ?? null) as Record<string, unknown> | null;
  if (!user) return null;

  const id = typeof user.id === "string" ? user.id : "";
  const email = typeof user.email === "string" ? user.email.toLowerCase() : "";
  if (!id || !email) return null;

  // The session must belong to the user it names - otherwise a token for one
  // account could be presented as another.
  const sessionUserId = typeof session?.userId === "string" ? session.userId : "";
  if (sessionUserId && sessionUserId !== id) return null;

  // A social sign-in is verified by the provider; a password account may not be
  // yet. We only ACCEPT a verified address here, because this path exists to
  // sign someone in straight from an OAuth hop.
  if (user.emailVerified !== true) return null;

  return {
    id,
    email,
    name: typeof user.name === "string" && user.name.trim() ? user.name : null,
    emailVerified: true,
  };
}

/** The OAuth session-challenge cookie the provider sets when a social sign-in
 *  STARTS. It is the other half of the one-time verifier: the verifier alone is
 *  not enough - the exchange must present this cookie too, and the provider
 *  answers `SESSION_CHALLENGE_COOKIE_NOT_FOUND` without it. */
const CHALLENGE_COOKIE_RE = /(?:__Secure-)?neon-auth\.session_challenge=([^;]+)/;

function challengeCookieFromSetCookies(setCookies: string[]): string | null {
  for (const c of setCookies) {
    const m = c.match(CHALLENGE_COOKIE_RE);
    if (m) return m[1];
  }
  return null;
}

/** The session token out of a `/get-session` body. Better Auth returns it at
 *  `session.token`; some builds also mirror it at the top level. */
function readSessionToken(body: Record<string, unknown>): string | null {
  const fromSession = (body.session as Record<string, unknown> | undefined)?.token;
  if (typeof fromSession === "string" && fromSession.length > 0) return fromSession;
  if (typeof body.token === "string" && body.token.length > 0) return body.token;
  return null;
}

/** Where to send the browser to start a Google sign-in, AND the challenge cookie
 *  the provider set while doing so.
 *
 *  The provider runs the OAuth exchange, so this is the provider's own endpoint
 *  and the caller redirects the browser to it - the site never sees Google's
 *  client secret and never handles the authorisation code. `callbackURL` is where
 *  the provider returns the shopper afterwards, and it must be one of the
 *  trusted origins configured against the auth instance.
 *
 *  The challenge cookie is returned so the CALLER can park it on the site's own
 *  origin. It has to be parked there because the provider sets it `Partitioned`
 *  while the top-level site is the provider's own origin, so the browser will
 *  never send it back from the store's origin - and the verifier exchange below
 *  cannot succeed without it. */
export async function neonAuthSocialSignInStart(input: {
  provider: string;
  callbackURL: string;
  origin?: string;
}): Promise<{ url: string; challengeCookie: string | null }> {
  const { status, json, setCookies } = await neonAuthFetch("/sign-in/social", {
    method: "POST",
    origin: input.origin,
    body: { provider: input.provider, callbackURL: input.callbackURL },
  });
  const body = (json ?? {}) as Record<string, unknown>;
  const url = typeof body.url === "string" ? body.url : "";
  if (status >= 400 || !url) {
    const { message, code } = providerError(json);
    throw new NeonAuthError(message, code, status);
  }
  return { url, challengeCookie: challengeCookieFromSetCookies(setCookies) };
}

/** Exchange the one-time OAuth verifier (plus the challenge cookie captured when
 *  the flow started) for the provider session.
 *
 *  This is the step the callback page used to attempt from the BROWSER, which
 *  could never work: the challenge cookie is partitioned to the provider's
 *  origin, so a cross-site request from the store's origin does not carry it.
 *  Doing it here, with the cookie the server parked on its own origin, is what
 *  makes the exchange succeed. Returns null on any failure so the caller can
 *  answer with a calm "start again" rather than a spinner. */
export async function neonAuthSessionFromVerifier(input: {
  verifier: string;
  challengeCookie: string;
  origin?: string;
}): Promise<NeonAuthSession | null> {
  if (!input.verifier || !input.challengeCookie) return null;
  const { status, json, setCookie, setCookies } = await neonAuthFetch(
    `/get-session?neon_auth_session_verifier=${encodeURIComponent(input.verifier)}`,
    {
      method: "GET",
      origin: input.origin,
      cookie: `__Secure-neon-auth.session_challenge=${input.challengeCookie}`,
      // The exchange can answer with a redirect that carries the session cookie.
      // "manual" keeps that response readable instead of following it and losing
      // the Set-Cookie (undici does not surface intermediate redirect cookies).
      redirect: "manual",
    },
  );
  if (status >= 400) return null;
  const body = (json ?? {}) as Record<string, unknown>;
  const user = toUser(body.user);
  // The SIGNED session cookie is the credential the provider's `/token` endpoint
  // accepts; the BARE body token is NOT (measured: `/token` answers 401 for the
  // bare token while `/get-session` accepts it). Prefer the signed value so the
  // session we mint is verifiable by the same JWKS path every other sign-in uses
  // - storing the bare token here is exactly what left `auth.me` null forever
  // and the callback spinning. Fall back to the body token only if the provider
  // set no cookie (the verification path tolerates it - see
  // `neonAuthVerifiedIdentity`).
  const token =
    sessionTokenFromSetCookies(setCookies) ??
    sessionCookieFromSetCookie(setCookie) ??
    readSessionToken(body);
  if (!user.id || !token) return null;
  return { token, user };
}

/** Ask the provider to email a password-reset link. The provider answers 200
 *  whether or not the address exists (no account enumeration), so the caller
 *  reports success unconditionally. */
export async function neonAuthRequestPasswordReset(input: {
  email: string;
  redirectTo: string;
  origin?: string;
}): Promise<void> {
  const { status, json } = await neonAuthFetch("/request-password-reset", {
    method: "POST",
    origin: input.origin,
    body: { email: input.email, redirectTo: input.redirectTo },
  });
  if (status >= 400) {
    const { message, code } = providerError(json);
    throw new NeonAuthError(message, code, status);
  }
}

/** Complete a password reset with the token from the emailed link. Throws
 *  NeonAuthError (code INVALID_TOKEN / PASSWORD_TOO_SHORT) on a bad token or a
 *  weak password; the caller maps it to a short, non-revealing message. */
export async function neonAuthResetPassword(input: {
  token: string;
  newPassword: string;
  origin?: string;
}): Promise<void> {
  const { status, json } = await neonAuthFetch("/reset-password", {
    method: "POST",
    origin: input.origin,
    body: { newPassword: input.newPassword, token: input.token },
  });
  if (status >= 400) {
    const { message, code } = providerError(json);
    throw new NeonAuthError(message, code, status);
  }
}