// ── Low-level transactional email primitive ──────────────────────────────────
//
// The single place that talks to Resend's HTTPS API. Business code should call
// the higher-level senders in `server/services/email.ts` (order confirmation,
// shipping, welcome, admin notification) which render branded templates and
// record every attempt in `email_log`; this module is the thin transport they
// share, and is also usable directly for a one-off message.
//
// GRACEFUL DEGRADATION is the contract: with no `RESEND_API_KEY` the module
// NO-OPS (logs a warning, returns `{ status: "skipped" }`) and NEVER throws, so
// local dev, CI and a not-yet-configured deployment all keep working. A send
// failure is reported as a status, never as an exception - a customer placing
// an order must not have it fail because the mail provider is down.
//
// Secrets come from the environment ONLY (`RESEND_API_KEY`, `EMAIL_FROM`) -
// never hardcoded, never committed.
import { env } from "./env";
import { outboundFetch } from "./fetch";
import { providerForKind, type EmailKind } from "./email-routing";
import { sendViaSmtp } from "./smtp";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. Optional; Resend will derive one when omitted. */
  text?: string;
  /** Override the From header. Defaults to `EMAIL_FROM`, then a bare address. */
  from?: string;
  /** Where customer replies land. */
  replyTo?: string;
  /**
   * What kind of email this is. Decides the TRANSPORT: critical kinds (order /
   * payment confirmation) go through Resend, everything else through the
   * secondary SMTP provider, so Resend's hard daily cap can never cut off
   * sign-in links or contact replies. See _core/email-routing.ts. Defaults to a
   * non-critical kind, which routes to the secondary provider.
   */
  kind?: EmailKind;
  /** Extra headers (e.g. List-Unsubscribe for a bulk send). */
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  status: "sent" | "skipped" | "failed";
  /** Why it was skipped or failed. Never contains a secret. */
  reason?: string;
  /** Resend's message id, when the send succeeded. */
  providerMessageId?: string | null;
}

/** A usable `Name <local@domain>` / bare-address From, or "" when unset. */
function resolveFrom(explicit?: string): string {
  const raw = (explicit ?? env.email.from ?? "").trim();
  return raw;
}

/**
 * The From header for a message on the SECONDARY provider.
 *
 * Precedence: an explicit per-send override, then the secondary provider's own
 * sender (`BREVO_FROM_EMAIL`), then the shared `EMAIL_FROM`. It is separate so a
 * deployment can send critical mail from one inbox and everything else from
 * another without either being able to silently take over the other's mail.
 */
function resolveSecondaryFrom(explicit?: string): string {
  return (explicit ?? env.email.secondaryFrom ?? env.email.from ?? "").trim();
}

/**
 * Send one email through Resend.
 *
 * Never throws. Returns a status the caller can record:
 *   sent     - Resend accepted it (`providerMessageId` holds the receipt)
 *   skipped  - no API key configured (the documented pre-setup state)
 *   failed   - Resend refused, or the request errored (`reason` says why)
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = (input.to ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { status: "failed", reason: `Not a valid recipient address: "${input.to}"` };
  }

  const from = resolveFrom(input.from);

  // ── Provider routing ──────────────────────────────────────────────────────
  // Critical mail (order / payment confirmation) goes through Resend; everything
  // else goes through the secondary SMTP provider, so Resend's hard daily cap
  // can never cut off sign-in links or contact replies. See email-routing.ts.
  if (providerForKind(input.kind ?? "welcome") === "smtp") {
    // The secondary provider has its own sender when configured, so its mail
    // never has to go out from the critical inbox. Falls back to the shared
    // EMAIL_FROM so a deployment that sets only one sender still sends.
    const secondaryFrom = resolveSecondaryFrom(input.from);
    if (!secondaryFrom) {
      return { status: "failed", reason: "No sender address configured (set EMAIL_FROM or Settings → Email)." };
    }
    return sendViaSmtp({
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      from: secondaryFrom,
      replyTo: input.replyTo,
      headers: input.headers,
    });
  }

  const apiKey = env.email.resendApiKey;
  if (!apiKey) {
    // The documented pre-setup state: nobody is notified, and the store says so
    // rather than pretending. Add RESEND_API_KEY to switch sending on.
    // eslint-disable-next-line no-console
    console.warn(
      "[email] RESEND_API_KEY is not set - skipping send (add it in Settings → Environment variables).",
    );
    return {
      status: "skipped",
      reason: "RESEND_API_KEY is not set - add it in Settings → Environment variables to send email.",
    };
  }

  if (!from) {
    return { status: "failed", reason: "No sender address configured (set EMAIL_FROM or Settings → Email)." };
  }

  try {
    const res = await outboundFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
      timeoutMs: 15_000,
    });

    const raw = await res.text();
    let body: { id?: string; message?: string; name?: string; error?: string } = {};
    try {
      body = raw ? (JSON.parse(raw) as typeof body) : {};
    } catch {
      body = {};
    }

    if (!res.ok) {
      const detail =
        (body.message ?? body.error ?? body.name ?? raw.slice(0, 300)) || `HTTP ${res.status}`;
      return { status: "failed", reason: `Resend rejected the send (${res.status}): ${detail}` };
    }
    return { status: "sent", providerMessageId: body.id ?? null };
  } catch (e) {
    return { status: "failed", reason: `Could not reach Resend: ${(e as Error).message}` };
  }
}
