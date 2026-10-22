// ── Email verification ───────────────────────────────────────────────────────
//
// A signup is not trusted until the address is proven. This module mints a
// single-use, expiring token, emails a link, and can consume that link exactly
// once. It is what turns "anyone can type any address" into "you must control
// the inbox" - the real defence against temp-mail / fake / spam signups, of
// which the disposable-domain blocklist in shared/signup-validation.ts is only
// the first, cheap layer.
//
// The token is stored HASHED (SHA-256), never in the clear: a leaked database
// row must not be a working verification link. Only the raw token - which lives
// solely in the email - can be redeemed.
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { env } from "./env";
import { outboundFetch } from "./fetch";
import { emailVerifications, users } from "../../drizzle/schema";
import { hashToken, mintVerificationToken } from "./verification-token";

export { VERIFICATION_TTL_MS } from "./verification-token";

// PetParcel brand ramp, kept in step with `services/email.ts` and the
// storefront tokens (client/src/index.css). Inlined because an email client
// cannot load our stylesheet.
const PINK = "#eb3594";
const ACCENT = "#d0337f";
const PINK_DEEP = "#b03a6e";
const INK = "#1b1b1b";
const MUTED = "#6b6b6b";
const CREAM = "#faf3f1";
const LINE = "#efe3e0";
const FOOTER_BG = "#fbf7f6";
const FAINT = "#9a8f8c";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const BUSINESS_ADDRESS = "1600 Pacific Ave, Dallas, TX 75201, USA";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export interface VerificationSendResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
}

function verificationLink(token: string, origin?: string | null): string {
  const base = (origin ?? "").trim().replace(/\/+$/, "") || "https://www.petparcel.store";
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

/** Render + send the verification email for an ALREADY-MINTED token. Used right
 *  after signup, where the token was created inside the signup transaction.
 *  Never throws: a mail outage must not fail the signup itself. */
export async function sendVerificationEmailForToken(
  email: string,
  token: string,
  origin?: string | null,
): Promise<VerificationSendResult> {
  const link = verificationLink(token, origin);
  const apiKey = env.email.resendApiKey;
  if (!apiKey) {
    // Pre-setup state: the account exists but cannot be verified yet. The
    // storefront says so rather than pretending the mail went out.
    return {
      status: "skipped",
      reason:
        "RESEND_API_KEY is not set - add it in Settings → Environment variables to send verification emails.",
    };
  }

  const from = env.config("EMAIL_FROM", "PetParcel <orders@petparcel.store>");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm your PetParcel email</title></head>
<body style="margin:0;padding:0;background:${CREAM};">
<div style="display:none;font-size:1px;color:${CREAM};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Confirm your email to finish setting up your PetParcel account.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:18px;overflow:hidden;font-family:${FONT};color:${INK};">
<tr><td style="height:5px;line-height:5px;font-size:0;background:${PINK};background-image:linear-gradient(90deg,${PINK} 0%,${ACCENT} 100%);">&nbsp;</td></tr>
<tr><td style="padding:22px 28px 20px;border-bottom:1px solid ${LINE};">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td width="34" valign="middle" style="width:34px;"><span style="display:inline-block;width:34px;height:34px;border-radius:10px;background:${PINK};background-image:linear-gradient(135deg,${PINK} 0%,${ACCENT} 100%);color:#ffffff;font-size:17px;line-height:34px;text-align:center;">&#128062;</span></td>
<td valign="middle" style="padding-left:10px;font-size:21px;font-weight:800;letter-spacing:-0.02em;color:${INK};">Pet<span style="color:${PINK};">Parcel</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:30px 28px 8px;">
<h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;color:${INK};">Confirm your email</h1>
<p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">Tap the button below to verify <strong style="color:${INK};">${esc(email)}</strong> and finish setting up your account. The link expires in 24 hours.</p>
</td></tr>
<tr><td style="padding:18px 28px 30px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${PINK};background-image:linear-gradient(135deg,${PINK} 0%,${ACCENT} 100%);border-radius:11px;">
<a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">Verify my email</a>
</td></tr></table>
<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">If the button doesn't work, paste this into your browser:<br><span style="color:${PINK_DEEP};">${esc(link)}</span></p>
</td></tr>
<tr><td style="padding:20px 28px;background:${FOOTER_BG};border-top:1px solid ${LINE};">
<p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${MUTED};">Didn't create an account? You can safely ignore this email.</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};white-space:nowrap;">${BUSINESS_ADDRESS}</p>
</td></tr>
<tr><td style="padding:0 28px 22px;"><p style="margin:0;font-size:11px;line-height:1.5;color:${FAINT};">You're receiving this because you signed up at PetParcel.</p></td></tr>
</table></td></tr></table></body></html>`;

  try {
    const res = await outboundFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Confirm your PetParcel email",
        html,
        text: `Confirm your email for PetParcel:\n\n${link}\n\nThis link expires in 24 hours.`,
      }),
      timeoutMs: 15_000,
    });
    if (!res.ok) {
      const raw = await res.text();
      return { status: "failed", reason: `Resend rejected the send (${res.status}): ${raw.slice(0, 200)}` };
    }
    return { status: "sent" };
  } catch (e) {
    return { status: "failed", reason: `Could not reach Resend: ${(e as Error).message}` };
  }
}

/** Mint a fresh token for a user, retire any outstanding ones, and email the
 *  link. Used for a resend. Never throws. */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  origin?: string | null,
): Promise<VerificationSendResult> {
  const { token, tokenHash, expiresAt } = mintVerificationToken();
  try {
    // One live token per user: retire the previous ones so an old link cannot be
    // replayed after a resend.
    await db
      .update(emailVerifications)
      .set({ consumedAt: sql`now()` })
      .where(and(eq(emailVerifications.userId, userId), isNull(emailVerifications.consumedAt)));
    await db.insert(emailVerifications).values({ userId, tokenHash, expiresAt });
  } catch (e) {
    return { status: "failed", reason: `Could not store the verification token: ${(e as Error).message}` };
  }
  return sendVerificationEmailForToken(email, token, origin);
}

export type VerifyResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Redeem a verification token. Single-use and time-boxed. */
export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  const raw = String(token ?? "").trim();
  if (!raw) return { ok: false, reason: "invalid" };
  const tokenHash = hashToken(raw);

  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(eq(emailVerifications.tokenHash, tokenHash))
    .limit(1);
  if (!row) return { ok: false, reason: "invalid" };
  if (row.consumedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  // Consume it and mark the user verified. The `isNull` guard on the UPDATE
  // means a concurrent double-click can only win once.
  const [updated] = await db
    .update(emailVerifications)
    .set({ consumedAt: sql`now()` })
    .where(and(eq(emailVerifications.id, row.id), isNull(emailVerifications.consumedAt)))
    .returning({ id: emailVerifications.id });
  if (!updated) return { ok: false, reason: "used" };

  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: sql`now()` })
    .where(eq(users.id, row.userId))
    .returning({ id: users.id, email: users.email });
  if (!user) return { ok: false, reason: "invalid" };

  return { ok: true, userId: user.id, email: user.email };
}

/** Whether a user has proven control of their address. */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ verifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.verifiedAt);
}

/** Resend a verification link for an address, if it has an unverified account.
 *  Always resolves the same way (no throw, no distinct result) so it cannot be
 *  used to probe which addresses have accounts. */
export async function resendVerificationForEmail(
  email: string,
  origin?: string | null,
): Promise<void> {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return;
  const [row] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  if (row && !row.emailVerifiedAt) {
    await sendVerificationEmail(row.id, row.email, origin);
  }
}
