// ── Single-admin policy ──────────────────────────────────────────────────────
// The store has ONE owner. This module is the single place that decides who
// counts as that owner, and it is deliberately a LEAF (no db, no env.ts import)
// so it can be unit-tested directly and used from both the tRPC layer
// (`adminProcedure` in trpc.ts) and the admin-login router.
//
// Two independent conditions must BOTH hold for an admin session:
//
//   1. `users.role === 'admin'` - the coarse switch that grants the management
//      surface at all. It is set out-of-band only (a migration / `pnpm
//      admin:create`); no public or customer-facing procedure can write it.
//
//   2. the account is the ONE designated address in `ADMIN_EMAIL` (when set).
//      This is what makes the panel SINGLE-admin: a second account that somehow
//      acquired the admin role - a direct DB write, a restored backup, a
//      mistaken promotion - is still refused every `admin.*` call.
//
// `ADMIN_EMAIL` is read from the environment ONLY (never the DB, never a
// default baked into the code, never committed). When it is unset the role
// alone applies, so an existing deployment is not locked out of its own panel;
// set ADMIN_EMAIL to pin the panel to exactly one address.

/** Lower-cased, trimmed address, or "" for a missing one. */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * The one designated admin address, from the environment.
 * Returns null when it is unset or blank (⟹ role-only enforcement).
 */
export function designatedAdminEmail(): string | null {
  const v = normalizeEmail(process.env.ADMIN_EMAIL);
  return v || null;
}

/** The slice of the session this rule needs. Structural, so a test can pass a
 *  bare `{ role }` or `{ role, email }` without building a full SessionUser. */
export interface AdminCandidate {
  role?: string | null;
  email?: string | null;
}

/**
 * The single-admin rule: is this session the store's one admin?
 *
 * `false` for anything that is not an `admin`-role account, and `false` for an
 * admin-role account that is not the designated address while `ADMIN_EMAIL` is
 * set. The caller turns a `false` into FORBIDDEN (a signed-in account) - an
 * anonymous caller never reaches this, because `protectedProcedure` already
 * refused it with UNAUTHORIZED.
 */
export function isDesignatedAdmin(user: AdminCandidate | null | undefined): boolean {
  if (!user || user.role !== "admin") return false;
  const designated = designatedAdminEmail();
  if (!designated) return true; // role-only mode: role is the whole rule
  return normalizeEmail(user.email) === designated;
}

/** One message for every refusal, so a caller cannot learn from the wording
 *  whether an account exists, has the admin role, or merely is not the ONE
 *  designated address. */
export const ADMIN_FORBIDDEN_MESSAGE = "This account doesn't have access to the admin panel.";

/** What the dedicated admin login answers a non-designated account with. It is
 *  deliberately the same sentence for every rejected address. */
export const ADMIN_LOGIN_DENIED_MESSAGE = "This account can't sign in here.";

/** What the dedicated admin login answers after too many failed attempts. */
export const ADMIN_LOGIN_LOCKED_MESSAGE =
  "Too many failed attempts. Please wait a few minutes and try again.";

/** Is this role the admin/owner role? Structural, so both the router and the
 *  data layer can share ONE definition of "the account we must never delete".
 *  The owner's own account is the store's only way back in - deleting it would
 *  lock the owner out of their own panel forever - so this is checked twice:
 *  once in the router (a clear 403) and again in the data layer (defence in
 *  depth, so no future caller can bypass it). */
export function isAdminRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

/** The one sentence the panel answers an attempt to delete the owner's
 *  account with. It reveals nothing an admin doesn't already know, and it is
 *  the SAME wording whichever layer refuses. */
export const ADMIN_ACCOUNT_UNDELETABLE_MESSAGE =
  "The store owner's account can't be deleted - it is the only way back into this panel.";
