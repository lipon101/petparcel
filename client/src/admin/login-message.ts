// The admin sign-in's message rules, kept as PURE functions so they can be
// tested without a DOM (vitest runs `environment: "node"` here and jsdom is
// deliberately not a dependency - see vitest.config.ts).
//
// Two jobs, both of which matter for a management door:
//
//   1. Present the server's refusal as a plain, non-revealing sentence. The
//      server answers every rejected account with ONE sentence (see
//      `ADMIN_LOGIN_DENIED_MESSAGE`), so the wording a visitor sees can never be
//      used to learn whether an address exists, carries the admin role, or is
//      merely not the one designated admin.
//
//   2. Distinguish a LOCKOUT from an ordinary refusal, so the page can show "too
//      many attempts" as a warning (amber) rather than as a credential mistake
//      (red). The distinction is drawn from the error CODE first and from the
//      server's own lockout sentence second - never from a substring of an
//      arbitrary error, which would let any future message mis-classify itself.

/**
 * The one sentence every rejected account gets, mirroring the server's
 * `ADMIN_LOGIN_DENIED_MESSAGE`. Used as the fallback so a reframed or missing
 * message still says nothing revealing.
 */
export const ADMIN_LOGIN_REFUSED = "This account can't sign in here.";

/** What the page shows when the lockout has been tripped. Matches the server's
 *  `ADMIN_LOGIN_LOCKED_MESSAGE` so the client and server never disagree. */
export const ADMIN_LOGIN_LOCKED =
  "Too many failed attempts. Please wait a few minutes and try again.";

export type AdminLoginErrorKind = "locked" | "refused";

export interface AdminLoginError {
  kind: AdminLoginErrorKind;
  /** True for a lockout, so the UI can use its amber treatment. */
  locked: boolean;
  message: string;
}

/** The shape of a tRPC client error we care about (structural, so a test can
 *  pass a bare `{ data: { code } }`). */
interface ErrorLike {
  data?: { code?: string | null } | null;
  message?: string | null;
}

/** How many failed attempts the page warns about before the server trips the
 *  DB-backed lockout (the strict admin door allows 5 per minute per IP). */
export const ADMIN_LOGIN_WARN_THRESHOLD = 5;

/** A rough, clamped guess at the remaining attempts, for the quiet hint under
 *  the form. Never negative, never above the threshold. */
export function attemptsRemaining(failures: number): number {
  const n = Number.isFinite(failures) ? Math.floor(failures) : 0;
  return Math.max(0, ADMIN_LOGIN_WARN_THRESHOLD - Math.max(0, n));
}

/**
 * Classify a failed admin sign-in for display.
 *
 * The server signals a lockout as a `TOO_MANY_REQUESTS` code and an ordinary
 * refusal as `FORBIDDEN`; a bad credential for a non-admin address is
 * deliberately indistinguishable from the refusal. Anything else (a network
 * blip, a 500) falls through to the human sentence the caller passes in, or the
 * generic fallback - so a raw error can never reach the page.
 */
export function classifyAdminLoginError(
  err: unknown,
  fallback: string = ADMIN_LOGIN_REFUSED,
): AdminLoginError {
  const e = (err ?? {}) as ErrorLike;
  const code = (e.data?.code ?? "").toUpperCase();
  const raw = (e.message ?? "").trim();

  if (code === "TOO_MANY_REQUESTS" || raw === ADMIN_LOGIN_LOCKED) {
    return { kind: "locked", locked: true, message: ADMIN_LOGIN_LOCKED };
  }
  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") {
    return { kind: "refused", locked: false, message: ADMIN_LOGIN_REFUSED };
  }
  return { kind: "refused", locked: false, message: raw || fallback };
}
