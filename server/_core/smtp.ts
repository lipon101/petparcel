// ── Secondary SMTP transport (Brevo) ─────────────────────────────────────────
//
// The second provider, used for every NON-critical email (see email-routing.ts).
// It exists so Resend's hard daily cap can never cut off sign-in links, password
// resets or contact-form replies: the two providers have separate allowances, so
// a burst of signups cannot exhaust the quota a customer's receipt depends on.
//
// WHY BREVO. It is a real SMTP relay with our own custom domain and DKIM/SPF, and
// it does not stamp its own branding on transactional mail sent through the relay
// - the customer sees only PetParcel. It also carries a free monthly allowance
// comfortably above this store's volume.
//
// GRACEFUL DEGRADATION, exactly like the Resend transport: with no SMTP
// credentials configured the module NO-OPS (returns `{ status: "skipped" }`) and
// NEVER throws, so local dev, CI and a not-yet-configured deployment all keep
// working. A send failure is a status, never an exception.
//
// BRANDING: every message goes out with `X-Mailer: PetParcel` (see
// SMTP_X_MAILER) and a Message-ID on the From domain, so neither the relay's nor
// the mailer library's identity is ever exposed to a customer.
//
// Secrets come from the environment ONLY (BREVO_SMTP_HOST / BREVO_SMTP_PORT /
// BREVO_SMTP_USER / BREVO_SMTP_PASS / BREVO_SMTP_SECURE, with the bare SMTP_*
// names accepted as a fallback alias) - never hardcoded, never committed.
import nodemailer from "nodemailer";
import { env } from "./env";

export interface SmtpSendInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SmtpSendResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
  providerMessageId?: string | null;
}

/**
 * The `X-Mailer` value every message from this store advertises.
 *
 * Set EXPLICITLY rather than left to the library. nodemailer adds no X-Mailer of
 * its own, but the value is a well-known fingerprint: leaving it unset (or
 * letting a library fill it in) tells the recipient - and a spam filter scoring
 * the message - which software and version built a mail from a vendor 
 * unrelated to PetParcel. Naming the brand here is the same hygiene reason the
 * `Message-ID` already resolves to `@petparcel.store` (it follows the From
 * domain) instead of the relay's.
 */
export const SMTP_X_MAILER = "PetParcel";

/** True when the secondary provider is configured and can be used. */
export function smtpConfigured(): boolean {
  return Boolean(env.email.smtpHost && env.email.smtpUser && env.email.smtpPass);
}

/**
 * Send one email through the secondary SMTP provider.
 *
 * Never throws. Returns a status the caller records:
 *   sent     - the relay accepted it (`providerMessageId` holds the receipt)
 *   skipped  - no SMTP credentials configured (the documented pre-setup state)
 *   failed   - the relay refused, or the connection errored (`reason` says why)
 */
export async function sendViaSmtp(input: SmtpSendInput): Promise<SmtpSendResult> {
  const to = (input.to ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { status: "failed", reason: `Not a valid recipient address: "${input.to}"` };
  }
  if (!smtpConfigured()) {
    // eslint-disable-next-line no-console
    console.warn(
      "[email] BREVO_SMTP_HOST/BREVO_SMTP_USER/BREVO_SMTP_PASS are not set - skipping secondary send " +
        "(add them in Settings → Environment variables).",
    );
    return {
      status: "skipped",
      reason:
        "BREVO_SMTP_HOST/BREVO_SMTP_USER/BREVO_SMTP_PASS are not set - add them in Settings → Environment variables to send this email.",
    };
  }

  try {
    const transport = nodemailer.createTransport({
      host: env.email.smtpHost,
      port: env.email.smtpPort,
      // Implicit TLS on 465; STARTTLS upgrade on 587/2525. The relay's own
      // certificate is verified - we never disable that.
      secure: env.email.smtpSecure,
      auth: { user: env.email.smtpUser, pass: env.email.smtpPass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });

    const info = await transport.sendMail({
      from: input.from,
      to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      // The brand's own mailer identity, with any caller-supplied header able to
      // override it (the newsletter, for example, has none of its own). This is
      // what keeps a library/relay fingerprint off customer-facing mail.
      headers: { "X-Mailer": env.email.smtpXMailer || SMTP_X_MAILER, ...(input.headers ?? {}) },
    });

    return { status: "sent", providerMessageId: info.messageId ?? null };
  } catch (e) {
    return { status: "failed", reason: `Could not send via SMTP: ${(e as Error).message}` };
  }
}
