import { TRPCError } from "@trpc/server";

export interface RateLimitOptions {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum allowed attempts inside the window. */
  max: number;
}

interface Hit {
  count: number;
  resetAt: number;
}

/**
 * A fixed-window counter kept in process memory.
 *
 * Deliberately small and dependency-free. Its job is to blunt the two abuse
 * patterns that actually matter on this store - credential stuffing against
 * `auth.login` and order spam against `checkout.place` - not to be a
 * distributed quota service. Two honest limits: each warm serverless instance
 * keeps its OWN counters, so a burst spread across many cold instances is only
 * seen in slices; and a restart clears them. For a single-tenant storefront that
 * is the right trade against introducing another moving part (and another bill).
 */
export function createRateLimiter({ windowMs, max }: RateLimitOptions) {
  const hits = new Map<string, Hit>();

  // Bound the map so a flood of DISTINCT keys (each a spoofed address, say)
  // cannot grow it without limit - an unbounded limiter is itself a memory leak.
  const MAX_KEYS = 10_000;

  function evict(now: number) {
    for (const [key, hit] of hits) if (hit.resetAt <= now) hits.delete(key);
    if (hits.size <= MAX_KEYS) return;
    // Still over budget: drop the entries closest to expiry first.
    for (const [key] of hits) {
      hits.delete(key);
      if (hits.size <= MAX_KEYS) break;
    }
  }

  return {
    /** Record one attempt. Returns false once the caller is over the limit. */
    check(key: string, now = Date.now()): boolean {
      const hit = hits.get(key);
      if (!hit || hit.resetAt <= now) {
        if (hits.size >= MAX_KEYS) evict(now);
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      hit.count += 1;
      return hit.count <= max;
    },
    /** Test-only: drop every counter. */
    reset() {
      hits.clear();
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

// ── The global interactive-API ceiling ──────────────────────────────────────
/**
 * Window and ceiling for the GLOBAL limit that fronts the whole interactive API.
 *
 * WHY 300/MINUTE. This is a BACKSTOP, not the primary control: the per-endpoint
 * limits above guard the specific abuse patterns (credential stuffing, order
 * spam). What this catches is broad automated hammering of any path - including a
 * route that has no dedicated limit of its own.
 *
 * The ceiling is chosen to be unreachable by a real shopper and still useless to a
 * script. A browsable storefront issues roughly 10-40 calls a minute; a cold,
 * cache-miss first load on the home page is the busiest thing a human generates.
 * 300 leaves roughly a 10x margin over that worst case, so no genuine visitor -
 * on any connection speed - is ever throttled, while a scraper that would fire
 * thousands is capped two orders of magnitude below its intent. It is also
 * deliberately looser than every per-endpoint limit, so this can never mask a more
 * specific rule with a vaguer 429.
 */
export const GLOBAL_API_LIMIT_WINDOW_MS = 60_000;
export const GLOBAL_API_LIMIT_MAX = 300;

/**
 * Paths that must NOT be counted against the global interactive limit.
 *
 * WHY THESE ARE EXEMPT. They are machine-to-machine traffic from a trusted sender,
 * and EACH already authenticates its caller cryptographically before doing any
 * work - a signature, not a rate limit, is the real control:
 *
 *   /api/webhooks/   Svix-signed (Resend delivery events)
 *   /api/payments/   HMAC-signed (NOWPayments IPN)
 *   /api/cron/       Bearer CRON_SECRET
 *   /api/_jobs/      platform job signature
 *
 * Throttling them would buy no security while risking real harm: a retry storm is
 * exactly when a payment notification is most likely to be re-sent, so a 429 here
 * could DROP a legitimate payment notification or a delivery event. The exemption
 * is therefore by path, and it is covered by a test so it cannot be widened by
 * accident.
 */
const EXEMPT_PREFIXES = [
  "/api/webhooks/",
  "/api/payments/",
  "/api/cron/",
  "/api/_jobs/",
] as const;

/** Whether a request path bypasses the global limit (see the note above). */
export function isRateLimitExemptPath(path: string): boolean {
  return EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Whether a request path is subject to the global interactive limit. Only the
 * API surfaces are: the SPA's own assets and the HTML shell are served from the
 * CDN, never by this app, so throttling them here would be pointless.
 */
export function isGlobalRateLimitedPath(path: string): boolean {
  if (isRateLimitExemptPath(path)) return false;
  return path.startsWith("/api/") || path.startsWith("/trpc");
}

/** Raise the error a throttled caller should see. Deliberately vague about the
 *  exact limit - telling an attacker the precise ceiling only helps them tune. */
export function enforceRateLimit(limiter: RateLimiter, key: string): void {
  if (!limiter.check(key)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Please wait a minute and try again.",
    });
  }
}

/**
 * Best-effort caller identity: the first hop in `x-forwarded-for`, else the
 * socket address header, else a shared bucket. Behind a proxy (Vercel always is)
 * the left-most entry is the client; a determined caller can forge it, which is
 * exactly why the limiter is the second line of defence and every rule it guards
 * is ALSO enforced on its own merits.
 */
export function callerKey(c: {
  req: { header: (name: string) => string | undefined };
}): string {
  const forwarded = c.req.header("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || c.req.header("x-real-ip") || "unknown";
}
