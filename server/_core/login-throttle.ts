import { TRPCError } from "@trpc/server";
import { inArray } from "drizzle-orm";
import { db } from "./db";
import { loginAttempts } from "../../drizzle/schema";

// ─────────────────────────────────────────────────────────────────────────────
// DB-backed login / signup throttle.
//
// The in-memory limiter in `_core/rate-limit.ts` is a per-instance fixed window:
// on a serverless platform each warm instance keeps its OWN counters, so a
// credential-stuffing burst spread across cold instances is only seen in slices,
// and a restart clears it. A lockout that must actually hold has to be shared,
// so this one lives in the database (`login_attempts`, migration 0009).
//
// Two independent keys guard `auth.login`:
//   • per ACCOUNT  - stops an attacker grinding one address from many IPs.
//   • per IP       - stops one host spraying many addresses.
// Both must be clear for a sign-in to proceed, and a SUCCESSFUL sign-in deletes
// both rows, so a legitimate user is never locked out permanently.
//
// Every helper is BEST-EFFORT: if the throttle store is unreachable (a cold
// database, or migration 0009 not yet applied) the failure is logged and the
// call is allowed through. A throttle outage must never take authentication
// down with it - the in-memory limiter and the credential check still stand.
// ─────────────────────────────────────────────────────────────────────────────

export interface ThrottleRule {
  /** Failures allowed inside the window before a lockout is applied. */
  max: number;
  /** How long a lockout lasts, in ms. */
  lockMs: number;
  /** How long a failure keeps counting toward the limit, in ms. */
  windowMs: number;
}

/** 5 failed sign-ins for one account → 15-minute lockout. */
export const LOGIN_ACCOUNT_RULE: ThrottleRule = { max: 5, lockMs: 15 * 60_000, windowMs: 15 * 60_000 };
/** 20 failed sign-ins from one IP → 15-minute lockout (higher: shared NATs). */
export const LOGIN_IP_RULE: ThrottleRule = { max: 20, lockMs: 15 * 60_000, windowMs: 15 * 60_000 };
/** 10 rejected signups from one IP → 1-hour lockout. */
export const SIGNUP_IP_RULE: ThrottleRule = { max: 10, lockMs: 60 * 60_000, windowMs: 60 * 60_000 };

/** One message for every lockout, whatever the key or rule. Deliberately does
 *  NOT say whether the account exists, how many attempts were seen, or which
 *  limit was hit - that would help an attacker tune and would leak account
 *  existence. */
export const LOCKED_MESSAGE =
  "Too many failed attempts. Please wait a few minutes and try again.";

export interface ThrottleKey {
  key: string;
  rule: ThrottleRule;
}

function logThrottleFailure(op: string, e: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[login-throttle] ${op} failed (throttle degraded, request allowed)`, e);
}

/**
 * Throw TOO_MANY_REQUESTS if ANY of the given keys is currently locked.
 * Best-effort: a store failure is logged and treated as "not locked".
 */
export async function assertNotLocked(entries: ThrottleKey[], now = new Date()): Promise<void> {
  const keys = entries.map((e) => e.key);
  if (keys.length === 0) return;
  let rows: { key: string; lockedUntil: Date | null }[];
  try {
    rows = await db
      .select({ key: loginAttempts.key, lockedUntil: loginAttempts.lockedUntil })
      .from(loginAttempts)
      .where(inArray(loginAttempts.key, keys));
  } catch (e) {
    logThrottleFailure("assertNotLocked", e);
    return;
  }
  for (const row of rows) {
    if (row.lockedUntil && row.lockedUntil.getTime() > now.getTime()) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: LOCKED_MESSAGE });
    }
  }
}

/**
 * Record one failure against a key, applying the rule's lockout once the count
 * reaches `max`. The window rolls over (and an expired lock clears) so the
 * counter can never grow without bound. Best-effort.
 */
export async function recordFailure(key: string, rule: ThrottleRule, now = new Date()): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(loginAttempts)
      .where(inArray(loginAttempts.key, [key]))
      .limit(1);

    const windowStart = now.getTime() - rule.windowMs;
    const windowRolled = !row || row.firstAt.getTime() <= windowStart;
    // Only an ACTIVE lock that has since expired resets the counter. A null
    // `locked_until` is the normal, unlocked state - treating it as "expired"
    // would reset the count on every call and the limit would never be reached.
    const lockExpired = row?.lockedUntil != null && row.lockedUntil.getTime() <= now.getTime();
    const reset = windowRolled || lockExpired;

    const count = reset ? 1 : row.count + 1;
    const firstAt = reset ? now : row.firstAt;
    const lockedUntil = count >= rule.max ? new Date(now.getTime() + rule.lockMs) : null;

    if (!row) {
      await db
        .insert(loginAttempts)
        .values({ key, count, firstAt, lastAt: now, lockedUntil })
        .onConflictDoNothing();
      return;
    }
    await db
      .update(loginAttempts)
      .set({ count, firstAt, lastAt: now, lockedUntil })
      .where(inArray(loginAttempts.key, [key]));
  } catch (e) {
    logThrottleFailure("recordFailure", e);
  }
}

/** Clear the counters for the given keys - called after a SUCCESSFUL sign-in so
 *  a legitimate user is never locked out by their own earlier typos. */
export async function clearFailures(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys));
  } catch (e) {
    logThrottleFailure("clearFailures", e);
  }
}

/** The two keys that guard one sign-in attempt. */
export function loginKeys(email: string, ip: string): { account: string; ip: string } {
  return { account: `login_account:${email.trim().toLowerCase()}`, ip: `login_ip:${ip}` };
}
