import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
import { compare, hash as bcryptHash } from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { atomic, db } from "./db";
import { isUniqueViolation } from "./db-errors";
import { authSessions, emailVerifications, users } from "../../drizzle/schema";
import { mintVerificationToken } from "./verification-token";
import {
  sanitizeSignupName,
  validateSignupEmail,
  validateSignupPassword,
} from "../../shared/signup-validation";
import { env } from "./env";
import {
  NeonAuthEmailTakenError,
  NeonAuthError,
  NeonAuthOriginError,
  neonAuthChangePassword,
  neonAuthConfigured,
  neonAuthGetVerifiedUser,
  neonAuthSignIn,
  neonAuthSignOut,
  neonAuthSignUp,
  neonAuthSocialSignInStart,
  neonAuthSessionFromVerifier,
  neonAuthVerifiedIdentity,
} from "./neon-auth";
import { sessionCookieName, type UserRole } from "../../shared/constants";
import type { SessionUser } from "../../shared/types";
import {
  requestIsSecure,
  sessionCookieClearOptions,
  sessionCookieOptions,
} from "./session-cookie";

// ─────────────────────────────────────────────────────────────────────────────
// AuthProvider abstraction (DESIGN §5.1). Business code depends only on the
// SessionUser it yields, NEVER on how the user authenticated. M1 wires only
// LocalAuthProvider; SsoAuthProvider is a reserved stub. Swapping/adding a
// provider later touches only this file + config - zero business-code churn.
// ─────────────────────────────────────────────────────────────────────────────
export interface AuthProvider {
  /** Resolve the current user from the request, or null if unauthenticated.
   *  `requireSession` additionally rejects a token that sign-out has revoked. */
  getSession(c: Context, opts?: { requireSession?: boolean }): Promise<SessionUser | null>;
  /** Resolve the user or throw - the strict form used by cart WRITES, which must
   *  fail closed rather than trust a token nobody has confirmed is still live. */
  requireSession(c: Context): Promise<SessionUser>;
  /** Begin a session (sets the auth cookie). Throws on bad credentials. */
  login(c: Context, email: string, password: string): Promise<SessionUser>;
  /** End the current session (clears the auth cookie). */
  logout(c: Context): Promise<void>;
  /** Establish a session for an ALREADY-authenticated user (used by signup,
   *  where the provider has just created the account and returned a session).
   *  Optional: a provider that has no such shortcut simply omits it and the
   *  caller falls back to `login`. */
  establishSession?(c: Context, user: SessionUser, providerToken?: string): Promise<void>;
  /** Change the signed-in user's password AT THE PROVIDER. The credential lives
   *  with the provider (Neon Auth's hash is scrypt, not bcrypt), so a local
   *  `users.password_hash` write would NOT change what sign-in accepts. Optional:
   *  a provider without a password (SSO) omits it. Throws AuthError on a
   *  rejected current password. */
  changePassword?(c: Context, currentPassword: string, newPassword: string): Promise<void>;
}

const COOKIE = sessionCookieName(env.appSlug);

// Session lifetime. The cookie's max-age and the token's `exp` must agree, and
// the `auth_sessions` row's `expires_at` mirrors the same instant so a sweep can
// drop dead revocation rows without guessing.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// LAZY: `env.jwtSecret` is a required var. Encoding it at module load meant
// importing auth.ts (which api/index.ts does transitively) threw when
// JWT_SECRET was unset - a 500 on every request before the function could
// answer. Deferring to first use keeps the module importable and moves the
// error to the auth call that actually needs the secret.
let _secretKey: Uint8Array | undefined;
function secretKey(): Uint8Array {
  if (!_secretKey) _secretKey = new TextEncoder().encode(env.jwtSecret);
  return _secretKey;
}

function toSessionUser(row: typeof users.$inferSelect): SessionUser {
  // password_hash is intentionally dropped here - never leaves the auth layer.
  return { id: row.id, email: row.email, name: row.name, role: row.role as UserRole };
}

class LocalAuthProvider implements AuthProvider {
  /** Resolve the current user, or null when the caller is anonymous.
   *
   *  `requireSession: true` additionally enforces that the token is still
   *  PRESENT in `auth_sessions`. A stateless JWT cannot be revoked, so this row
   *  is the only thing that makes sign-out real: without it, a token copied
   *  before logout stayed valid for its full 30 days. Reads (`auth.me`, page
   *  loads) deliberately accept a token even when its row is missing, so a
   *  deployment predating migration 0032 - or a wiped table - degrades to "a
   *  token nobody revoked" rather than signing every shopper out. Writes
   *  (cart mutations) pass the strict form, because a write must fail closed. */
  async getSession(c: Context, opts?: { requireSession?: boolean }): Promise<SessionUser | null> {
    const token = getCookie(c, COOKIE);
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, secretKey);
      const userId = payload.sub;
      if (!userId) return null;
      if (opts?.requireSession) {
        if (!payload.jti) return null;
        const [sess] = await db
          .select({ id: authSessions.id })
          .from(authSessions)
          .where(and(eq(authSessions.id, payload.jti), eq(authSessions.userId, userId)))
          .limit(1);
        if (!sess) return null; // revoked by sign-out
      }
      const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return row ? toSessionUser(row) : null;
    } catch {
      return null; // expired / tampered / wrong key → treat as anonymous
    }
  }

  async login(c: Context, email: string, password: string): Promise<SessionUser> {
    const [row] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    // Constant-ish: still run a compare when the user is missing to blunt timing.
    const hash = row?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
    const ok = await compare(password, hash);
    if (!row || !row.passwordHash || !ok) throw new AuthError("Invalid email or password");
    await this.#setSession(c, row.id);
    return toSessionUser(row);
  }

  async logout(c: Context): Promise<void> {
    // REVOKE FIRST, THEN CLEAR. Deleting the cookie alone only removed the
    // browser's copy; the token itself stayed valid until it expired. Dropping
    // the row makes the token unusable everywhere, immediately - including a
    // copy captured before sign-out. Best-effort on the database: a shopper
    // must always be able to sign out, even mid-outage, so a failed delete is
    // logged and the cookie is still cleared.
    const token = getCookie(c, COOKIE);
    if (token) {
      try {
        const { payload } = await jwtVerify(token, secretKey);
        if (payload.jti) await db.delete(authSessions).where(eq(authSessions.id, payload.jti));
      } catch {
        /* an unreadable token has no session row to revoke */
      }
    }
    for (const opt of sessionCookieClearOptions()) {
      deleteCookie(c, COOKIE, opt);
    }
  }

  /** Refuse anything but a live, un-revoked session. Throws AuthError so both
   *  the tRPC and Hono callers answer with a proper auth error. */
  async requireSession(c: Context): Promise<SessionUser> {
    const user = await this.getSession(c, { requireSession: true });
    if (!user) throw new AuthError("Please sign in to continue.");
    return user;
  }

  /** Mint our session cookie for an already-verified user. */
  async establishSession(c: Context, user: SessionUser): Promise<void> {
    await this.#setSession(c, user.id);
  }

  /** Change the local bcrypt credential. Verifies the current password first so
   *  a stolen session alone cannot silently rotate the password. */
  async changePassword(c: Context, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.getSession(c);
    if (!user) throw new AuthError("You need to be signed in to change your password.");
    const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!row?.passwordHash) throw new AuthError("This account has no password to change.");
    const ok = await compare(currentPassword, row.passwordHash);
    if (!ok) throw new AuthError("That current password is not correct.");
    const clean = validateSignupPassword(newPassword);
    const passwordHash = await bcryptHash(clean, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
  }

  async #setSession(c: Context, userId: string): Promise<void> {
    // `jti` identifies THIS token, and a matching row makes it revocable. The
    // row is written before the cookie is set, so a token that reached the
    // browser always has a record sign-out can delete.
    const jti = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.insert(authSessions).values({ id: jti, userId, expiresAt });
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime("30d")
      .sign(secretKey());
    setCookie(c, COOKIE, token, sessionCookieOptions(env.isProd || requestIsSecure(c)));
  }
}

// ── Neon Auth (Better Auth) provider ──────────────────────────────────────────
//
// The credential store moves OUT of the app's own tables: Neon Auth keeps its
// users in the `neon_auth` schema and owns the password hashing, the session and
// the JWT. This provider is the seam that keeps the rest of the app unchanged -
// it still yields a `SessionUser` and still sets OUR session cookie, so
// context.ts, protectedProcedure and every FK to `users.id` are untouched.
//
// The bridge (Neon Auth user -> local `users` row) lives in `bridgeNeonUser`
// below, because it needs the database and the local `users` table.
class NeonAuthProvider implements AuthProvider {
  async getSession(c: Context, _opts?: { requireSession?: boolean }): Promise<SessionUser | null> {
    // Our own cookie carries the Neon Auth session token. We re-verify it
    // against Neon Auth on every request (JWKS), so a revoked or expired Neon
    // Auth session stops working here too - the cookie alone is not trusted.
    // `_opts.requireSession` is a no-op here: Neon Auth owns revocation, and a
    // token it no longer recognises already fails the verification below.
    const token = getCookie(c, COOKIE);
    if (!token) return null;
    const identity = await neonAuthVerifiedIdentity(token);
    if (!identity) return null;
    return bridgeNeonUser(identity);
  }

  async requireSession(c: Context): Promise<SessionUser> {
    const user = await this.getSession(c, { requireSession: true });
    if (!user) throw new AuthError("Please sign in to continue.");
    return user;
  }

  async login(c: Context, email: string, password: string): Promise<SessionUser> {
    let session;
    try {
      session = await neonAuthSignIn({ email, password, origin: requestOrigin(c) });
    } catch (e) {
      // A missing/untrusted Origin is the provider refusing the REQUEST, not a
      // bad credential - rethrow it as-is so the router answers 400 instead of a
      // misleading "invalid password".
      if (e instanceof NeonAuthOriginError) throw e;
      if (e instanceof NeonAuthError) {
        // A rejected credential is a 401, never a 500. The message is ours, not
        // the provider's, so nothing internal leaks.
        throw new AuthError("Invalid email or password");
      }
      throw e;
    }
    const user = await bridgeNeonUser({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified,
    });
    await this.establishSession(c, user, session.token);
    return user;
  }

  async logout(c: Context): Promise<void> {
    const token = getCookie(c, COOKIE);
    if (token) await neonAuthSignOut(token, requestOrigin(c));
    for (const opt of sessionCookieClearOptions()) {
      deleteCookie(c, COOKIE, opt);
    }
  }

  /** Set OUR session cookie to the Neon Auth session token. The token is a
   *  credential: it is written to an httpOnly cookie and never logged. */
  async establishSession(c: Context, _user: SessionUser, providerToken?: string): Promise<void> {
    if (!providerToken) return;
    setCookie(c, COOKIE, providerToken, sessionCookieOptions(env.isProd || requestIsSecure(c)));
  }

  /** Change the password AT NEON AUTH. The live credential is Neon Auth's (its
   *  hash is scrypt, not bcrypt), so this is the ONLY way a password change
   *  actually takes effect on the live sign-in. Authenticated by the caller's
   *  own session cookie; a rejected current password becomes an AuthError (401),
   *  never a 500. */
  async changePassword(c: Context, currentPassword: string, newPassword: string): Promise<void> {
    const token = getCookie(c, COOKIE);
    if (!token) throw new AuthError("You need to be signed in to change your password.");
    try {
      await neonAuthChangePassword({
        currentPassword,
        newPassword,
        sessionToken: token,
        origin: requestOrigin(c),
      });
    } catch (e) {
      if (e instanceof NeonAuthError) {
        // Our wording, not the provider's - nothing internal leaks.
        throw new AuthError("That current password is not correct.");
      }
      throw e;
    }
  }
}

/** The browser's own origin, forwarded to Neon Auth so the value it checks is
 *  the real site origin. Falls back to the request URL's origin. Exported so the
 *  signup router can forward the SAME value (never a client-supplied string). */
export function requestOrigin(c: Context): string | undefined {
  const origin = c.req.header("origin");
  if (origin) return origin;
  try {
    return new URL(c.req.url).origin;
  } catch {
    return undefined;
  }
}

// Reserved for post-M1 SSO (OIDC / Teamily IdP). NOT implemented - its presence
// only proves the seam holds; it is never wired in M1 (DESIGN §5.1).
class SsoAuthProvider implements AuthProvider {
  async getSession(): Promise<SessionUser | null> {
    throw new Error("SsoAuthProvider not implemented (reserved seam - DESIGN §5.1).");
  }
  async requireSession(): Promise<SessionUser> {
    throw new Error("SsoAuthProvider not implemented (reserved seam - DESIGN §5.1).");
  }
  async login(): Promise<SessionUser> {
    throw new Error("SsoAuthProvider not implemented (reserved seam - DESIGN §5.1).");
  }
  async logout(): Promise<void> {
    throw new Error("SsoAuthProvider not implemented (reserved seam - DESIGN §5.1).");
  }
}

export class AuthError extends Error {}

/** Signup hit the `users.email` UNIQUE index - that address already has an
 *  account. A distinct type (not a string match on some driver's wording) so a
 *  router can answer 409 "log in instead" instead of leaking a 500. */
export class EmailTakenError extends AuthError {}

let _provider: AuthProvider | undefined;
export function authProvider(): AuthProvider {
  if (!_provider) {
    _provider =
      env.authProvider === "sso"
        ? new SsoAuthProvider()
        : env.authProvider === "neon" && neonAuthConfigured()
          ? new NeonAuthProvider()
          : new LocalAuthProvider();
  }
  return _provider;
}

/** True when the active provider is Neon Auth. The signup router branches on
 *  this because registration is inherently provider-specific (the credential is
 *  created at the provider, not in our `users` table). */
export function authProviderUsesNeon(): boolean {
  return env.authProvider === "neon" && neonAuthConfigured();
}

// ── Neon Auth -> local user bridge ────────────────────────────────────────────
//
// Neon Auth stores its users in the `neon_auth` schema with its OWN ids, which do
// NOT match the `users.id` UUIDs that orders / wishlist_items / contact_messages
// / reviews reference. Rather than repoint every foreign key (which would rewrite
// live order history), `users.id` stays the anchor and `users.neon_auth_user_id`
// records the Neon Auth id for accounts that authenticate through it.
//
// Resolution order, so existing data is preserved:
//   1. Already linked (neon_auth_user_id = the Neon Auth id) -> use that row.
//   2. A local row with the same email exists -> LINK it (set the id), keeping
//      its role and every order/wishlist/contact row it owns. This is how the
//      existing admin (`petparcel@proton.me`) keeps its admin role and history.
//   3. No local row -> CREATE one, with password_hash NULL (Neon Auth owns the
//      credential) and role 'user'.
//
// Race-safe: two concurrent first-sign-ins for the same new account both try to
// insert; the unique index on `neon_auth_user_id` (and on `email`) makes the
// loser a 23505, which we swallow and re-read.
export interface NeonIdentity {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export async function bridgeNeonUser(identity: NeonIdentity): Promise<SessionUser> {
  const email = identity.email.trim().toLowerCase();

  // 1. Already linked.
  const [linked] = await db
    .select()
    .from(users)
    .where(eq(users.neonAuthUserId, identity.id))
    .limit(1);
  if (linked) return toSessionUser(linked);

  // 2. Link an existing local account by email (preserves role + history).
  const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (byEmail) {
    if (byEmail.neonAuthUserId !== identity.id) {
      try {
        await db
          .update(users)
          .set({ neonAuthUserId: identity.id })
          .where(eq(users.id, byEmail.id));
      } catch (e) {
        // A concurrent request linked a different Neon Auth id to this email
        // first; re-read rather than fail the sign-in.
        if (!isUniqueViolation(e)) throw e;
      }
    }
    const [fresh] = await db.select().from(users).where(eq(users.id, byEmail.id)).limit(1);
    return toSessionUser(fresh ?? byEmail);
  }

  // 3. Create a new local row for this Neon Auth account.
  const cleanName = sanitizeSignupName(identity.name);
  try {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: cleanName,
        neonAuthUserId: identity.id,
        // Neon Auth owns the credential; the local hash stays NULL.
        passwordHash: null,
        ...(identity.emailVerified ? { emailVerifiedAt: new Date() } : {}),
      })
      .returning();
    return toSessionUser(created);
  } catch (e) {
    if (isUniqueViolation(e)) {
      // Lost a race - the row now exists; read it back.
      const [row] = await db
        .select()
        .from(users)
        .where(eq(users.neonAuthUserId, identity.id))
        .limit(1);
      if (row) return toSessionUser(row);
      const [byEmail2] = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (byEmail2) return toSessionUser(byEmail2);
    }
    throw e;
  }
}

/** Create the account in Neon Auth, then bridge it to a local row. Returns the
 *  local user plus the Neon Auth session token (so the caller can set the
 *  cookie). Throws EmailTakenError when the address is already registered. */
export async function registerNeonUser(
  email: string,
  password: string,
  name?: string,
  origin?: string,
): Promise<{ user: SessionUser; providerToken: string }> {
  const cleanEmail = validateSignupEmail(email);
  const cleanPassword = validateSignupPassword(password);
  const cleanName = sanitizeSignupName(name);

  let session;
  try {
    session = await neonAuthSignUp({
      email: cleanEmail,
      password: cleanPassword,
      name: cleanName,
      origin,
    });
  } catch (e) {
    if (e instanceof NeonAuthEmailTakenError) {
      throw new EmailTakenError("That email is already registered - try logging in instead.");
    }
    throw e;
  }

  const user = await bridgeNeonUser({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? cleanName,
    emailVerified: session.user.emailVerified,
  });
  return { user, providerToken: session.token };
}

/** The cookie that carries the OAuth session-challenge value between the START
 *  of a Google sign-in and its callback.
 *
 *  It has to live on OUR origin. The provider sets its own copy `Partitioned`
 *  while the top-level site is the provider's own origin, so the browser will
 *  never send that copy back from the store's origin - and the verifier exchange
 *  cannot succeed without it. Parking the value here, on the origin the callback
 *  actually runs on, is what makes the exchange work. Short-lived and httpOnly:
 *  it is a credential, not something a script should read. */
const OAUTH_CHALLENGE_COOKIE = "pp_oauth_challenge";
const OAUTH_CHALLENGE_MAX_AGE = 60 * 10;

export function setOAuthChallengeCookie(c: Context, value: string): void {
  setCookie(c, OAUTH_CHALLENGE_COOKIE, value, {
    httpOnly: true,
    path: "/",
    maxAge: OAUTH_CHALLENGE_MAX_AGE,
    sameSite: "Lax",
    secure: env.isProd || requestIsSecure(c),
  });
}

export function readOAuthChallengeCookie(c: Context): string | null {
  return getCookie(c, OAUTH_CHALLENGE_COOKIE) ?? null;
}

export function clearOAuthChallengeCookie(c: Context): void {
  deleteCookie(c, OAUTH_CHALLENGE_COOKIE, { path: "/" });
}

/** Begin a Google sign-in: the provider's authorise URL, plus the challenge
 *  cookie the caller must park on our origin (see above). Throws AuthError (so
 *  the router answers 400, never 500) when the store is not on the Neon Auth
 *  provider or the provider refuses to start the flow. */
export async function googleSignInStart(
  c: Context,
  callbackURL: string,
): Promise<{ url: string; challengeCookie: string | null }> {
  if (!authProviderUsesNeon()) {
    throw new AuthError("Google sign-in is not available on this store.");
  }
  try {
    return await neonAuthSocialSignInStart({
      provider: "google",
      callbackURL,
      origin: requestOrigin(c),
    });
  } catch (e) {
    if (e instanceof NeonAuthError) {
      throw new AuthError("Google sign-in is not available right now. Please try again.");
    }
    throw e;
  }
}

/** Complete a GOOGLE sign-in from the one-time verifier the provider appended to
 *  the callback URL.
 *
 *  The verifier is exchanged - together with the challenge cookie captured when
 *  the flow started - for the provider session, and only then is the account
 *  bridged to a local row (an existing account with the same address keeps its
 *  role and history, via `bridgeNeonUser`). OUR httpOnly cookie is what actually
 *  signs the browser in. The session token is a credential: it is written to the
 *  cookie and never logged or returned. */
export async function loginViaGoogleVerifier(
  c: Context,
  verifier: string,
  challengeCookie: string,
): Promise<SessionUser> {
  if (!authProviderUsesNeon()) {
    throw new AuthError("Google sign-in is not available on this store.");
  }
  let session;
  try {
    session = await neonAuthSessionFromVerifier({
      verifier,
      challengeCookie,
      origin: requestOrigin(c),
    });
  } catch {
    // A transport failure must not read as "your credentials are wrong".
    throw new AuthError("We couldn't reach the sign-in service. Please try again.");
  }
  if (!session) {
    throw new AuthError(
      "That sign-in link has expired or was already used. Please start again.",
    );
  }
  // The provider's answer is cross-checked before it is believed: when the
  // session token can be independently confirmed, the confirmed identity must be
  // the same account. The verifier exchange already authenticated the session,
  // so a null cross-check falls back to the session's own user rather than
  // failing a legitimate sign-in.
  const verified = await neonAuthGetVerifiedUser(session.token, requestOrigin(c));
  const identity = verified && verified.id === session.user.id ? verified : session.user;
  const user = await bridgeNeonUser(identity);
  await authProvider().establishSession?.(c, user, session.token);
  return user;
}

/** Change the signed-in user's password at the ACTIVE provider. The credential
 *  lives with the provider (Neon Auth's hash is scrypt, not bcrypt), so this
 *  delegates rather than writing `users.password_hash` - a local write would not
 *  change what the live sign-in accepts. Throws AuthError on a rejected current
 *  password so the router answers 401, never 500. */
export async function changePassword(
  c: Context,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const provider = authProvider();
  if (!provider.changePassword) {
    throw new AuthError("Password changes are not available for this account.");
  }
  await provider.changePassword(c, currentPassword, newPassword);
}

// Local-only helper for the signup flow (registration is inherently
// provider-specific; SSO signup happens at the IdP). Kept out of the interface.
//
// Returns the created user AND the raw verification token minted alongside it,
// so the caller can email the link. The token is created in the SAME atomic unit
// as the user row, which is the fix for the "first submit errors, second says
// already registered" bug: a failure after the insert can no longer leave a
// committed user behind for the retry to collide with.
export interface RegisteredUser {
  user: SessionUser;
  /** Raw token for the verification link - goes in the email, never stored. */
  verificationToken: string;
}

export async function registerLocalUser(
  email: string,
  password: string,
  name?: string,
): Promise<RegisteredUser> {
  // Validate + normalise BEFORE any write, so a bad payload never reaches the
  // database and the verdict is deterministic: the same input always produces
  // the same answer, on the first attempt as on the second.
  const cleanEmail = validateSignupEmail(email);
  const cleanPassword = validateSignupPassword(password);
  const cleanName = sanitizeSignupName(name);

  const passwordHash = await bcryptHash(cleanPassword, 10);
  const { token, tokenHash, expiresAt } = mintVerificationToken();
  // The id is generated here, not by the column default, so the verification
  // row can reference it in the same batch (the statements all leave together,
  // so the first insert's RETURNING is not readable before the second runs).
  const userId = crypto.randomUUID();

  try {
    const [userRows] = await atomic((d) => [
      d
        .insert(users)
        .values({ id: userId, email: cleanEmail, passwordHash, name: cleanName })
        .returning(),
      d.insert(emailVerifications).values({ userId, tokenHash, expiresAt }).returning(),
    ]);
    const row = userRows[0];
    return {
      user: { id: row.id, email: row.email, name: row.name, role: row.role as UserRole },
      verificationToken: token,
    };
  } catch (e) {
    // `users` carries exactly one UNIQUE index (email) - `id` is generated - so
    // a 23505 on this INSERT can only mean the address is taken. Translating it
    // HERE, rather than in each app's routers.ts, is what keeps a second signup
    // from surfacing as a 500 that quotes the INSERT and its bound params
    // (password hash included) back to the browser.
    if (isUniqueViolation(e)) {
      throw new EmailTakenError("That email is already registered - try logging in instead.");
    }
    throw e;
  }
}
