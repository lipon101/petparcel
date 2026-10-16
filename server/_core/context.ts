import type { Context as HonoContext } from "hono";
import { db } from "./db";
import { authProvider } from "./auth";

// tRPC request context. Carries the Hono context (for cookie writes in auth
// mutations), the db handle, and the resolved user (null if anonymous).
//
// The session is resolved STRICTLY: a token that sign-out has revoked (its
// `auth_sessions` row is gone) resolves to null, so a captured copy of a
// signed-out cookie is treated as anonymous by every procedure - including the
// cart, which is exactly the leak this closes. This is the single choke point;
// no procedure can opt out of it.
//
// NOTE: a token minted BEFORE revocation existed carries no `jti` and therefore
// cannot be proven live, so it resolves to null and its holder signs in once
// more. That one-time re-login is the cost of making sign-out real, and it is
// self-healing - every token issued from now on is revocable.
export async function createContext(c: HonoContext) {
  const user = await authProvider().getSession(c, { requireSession: true });
  return { c, db, user };
}

export type AppContext = Awaited<ReturnType<typeof createContext>>;
