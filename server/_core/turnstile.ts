// Cloudflare Turnstile verification for the storefront's public forms.
//
// WHY THIS EXISTS. The signup and contact forms are the two places an anonymous
// visitor can make the server do work (create an account, send mail). They are
// already rate-limited per host, but a rate limit only slows a distributed
// script down - it does not tell a human from a bot. Turnstile is the signal
// that does, and it is the control Cloudflare's Security Center asks for.
//
// FAIL-OPEN WHEN UNCONFIGURED, FAIL-CLOSED WHEN CONFIGURED. With no
// `TURNSTILE_SECRET_KEY` in the environment the check is a no-op, so a
// deployment that has not yet created the widget keeps working exactly as
// before - the same "absent key is a normal state" rule the email providers
// follow. The moment the secret IS set, a missing or invalid token is refused.
// That ordering matters: it means turning the feature on is a single env change
// with no code deploy, and turning it off is the same.
//
// The secret is read from the environment ONLY - never hardcoded, never
// committed. The site key (public, safe to ship) is served to the browser by
// the client from `VITE_TURNSTILE_SITE_KEY`.

import { TRPCError } from "@trpc/server";

/** Cloudflare's verification endpoint. Fixed, public, and the only one. */
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** The secret key, or "" when Turnstile has not been configured. */
export function turnstileSecret(): string {
  return process.env.TURNSTILE_SECRET_KEY ?? "";
}

/** Whether Turnstile is active. When false every check below is a no-op. */
export function turnstileConfigured(): boolean {
  return turnstileSecret().length > 0;
}

export interface TurnstileVerdict {
  ok: boolean;
  /** Cloudflare's error codes, joined - for the server log only, never the UI. */
  reason?: string;
}

/**
 * Verify a Turnstile token against Cloudflare.
 *
 * `remoteIp` is optional and only improves Cloudflare's own risk scoring; the
 * token is the thing that must be valid. A network failure is treated as a
 * FAILED verification (not a pass): if we cannot ask Cloudflare, we cannot
 * claim the visitor is human, and the safe answer to "is this a bot?" is no.
 */
export async function verifyTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<TurnstileVerdict> {
  const secret = turnstileSecret();
  if (!secret) return { ok: true }; // not configured - nothing to check
  if (!token) return { ok: false, reason: "missing-input-response" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    return { ok: false, reason: (data["error-codes"] ?? ["verification-failed"]).join(",") };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[turnstile] verification request failed", e);
    return { ok: false, reason: "verification-unreachable" };
  }
}

/**
 * Enforce Turnstile for a public form. No-op when unconfigured; throws a
 * shopper-safe BAD_REQUEST when configured and the token does not verify.
 *
 * The thrown message is deliberately generic - Cloudflare's error codes name
 * our configuration, which is not something a visitor should see.
 */
export async function assertTurnstile(
  token: string | undefined,
  remoteIp?: string,
): Promise<void> {
  if (!turnstileConfigured()) return;
  const verdict = await verifyTurnstile(token, remoteIp);
  if (verdict.ok) return;
  // eslint-disable-next-line no-console
  console.warn(`[turnstile] rejected a submission: ${verdict.reason}`);
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "We couldn't verify that you're human. Please refresh the page and try again.",
  });
}
