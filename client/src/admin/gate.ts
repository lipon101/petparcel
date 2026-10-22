// The admin panel's client-side gate decision, as a PURE function so the rule
// can be tested without a DOM (vitest runs `environment: "node"` here and jsdom
// is deliberately not a dependency - see vitest.config.ts).
//
// The gate is DEFENCE IN DEPTH, never the authority. The server is the real
// gate: every `admin.*` procedure is an `adminProcedure`, so an anonymous caller
// gets UNAUTHORIZED and a signed-in non-admin (or a non-designated admin) gets
// FORBIDDEN no matter what the client renders. This function only decides what
// the browser SHOWS and where it sends someone who is not allowed in - so a
// public visitor never sees the panel's layout, navigation or data.
//
// A signed-out visitor is shown the DEDICATED admin sign-in IN PLACE, at the
// admin root itself (`{ kind: "login" }`) - never redirected to the storefront's
// shared customer login. Keeping the two doors apart means a shopper never lands
// on an admin surface, the admin's credentials are typed at a page the public has
// no link to, and the admin-login endpoint on the server refuses any account that
// is not the one designated admin.

export type AdminGateDecision =
  | { kind: "loading" }
  | { kind: "login" }
  | { kind: "redirect"; to: string }
  | { kind: "allow" };

/** The slice of the session the gate needs. Kept structural so a test can pass a
 *  bare `{ role }` without constructing a full SessionUser. */
export interface AdminGateUser {
  role?: string | null;
}

/** The dedicated admin sign-in route, e.g. `/lostsec/login`. */
export function adminLoginPath(adminRoot: string): string {
  return `${adminRoot}/login`;
}

/**
 * Decide what the panel does for the current session.
 *
 * - `requireAuth` false   -> always allow (the single documented switch).
 * - session still loading -> "loading", so there is never a flash of admin
 *                            content before the session is known.
 * - no user               -> "login": render the DEDICATED admin sign-in IN
 *                            PLACE, at the admin root (no redirect to /login).
 * - signed-in non-admin   -> redirect to the storefront root (never the login).
 * - admin                 -> allow.
 *
 * The caller renders the admin sign-in for the "login" decision; see `AdminApp`.
 */
export function adminGateDecision(
  requireAuth: boolean,
  isLoading: boolean,
  user: AdminGateUser | null,
): AdminGateDecision {
  if (!requireAuth) return { kind: "allow" };
  if (isLoading) return { kind: "loading" };
  if (!user) return { kind: "login" };
  if (user.role !== "admin") return { kind: "redirect", to: "/" };
  return { kind: "allow" };
}
