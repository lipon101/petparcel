// ── Transactional email - order confirmation + shipping notification ────────
//
// Rendered here, sent through Resend's HTTPS API with the platform's outbound
// HTTP primitive (never a raw provider SDK), and recorded in `email_log`.
//
// GRACEFUL DEGRADATION is the point of the status column. With no
// RESEND_API_KEY the store must neither crash nor quietly lose the fact that a
// customer was never told, so every attempt is written to `email_log` as:
//
//   sent     - Resend accepted it; `provider_message_id` holds the receipt
//   skipped  - no API key configured yet (the pre-setup state)
//   failed   - Resend refused or the request errored; `error` says why
//
// The admin order view reads that log, so "did the customer get their email?"
// has an answer that comes from the database rather than from hope.
import { desc, eq } from "drizzle-orm";
import { db } from "../_core/db";
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";
import { designatedAdminEmail } from "../_core/admin-access";
import { emailLog, type EmailLog } from "../../drizzle/schema";
import { providerForKind } from "../_core/email-routing";
import { sendViaSmtp } from "../_core/smtp";
import type { SettingsMap } from "../../shared/store";
import { formatMoney, cleanAddress } from "../../shared/store";

export type EmailKind =
  | "order_confirmation"
  | "payment_confirmation"
  | "shipping_notification"
  | "contact_message"
  | "welcome"
  | "admin_new_order"
  | "unpaid_alert"
  // Neon Auth-triggered auth emails. Their text is rendered by
  // `services/auth-email-templates.ts` and delivered from here, so they share
  // the same `email_log` receipt and the same Resend transport as everything
  // else. They are logged with a null order id (they belong to no order).
  | "auth_verification"
  | "auth_password_reset"
  | "auth_magic_link";

export const EMAIL_KIND_LABEL: Record<EmailKind, string> = {
  order_confirmation: "Order confirmation",
  payment_confirmation: "Payment confirmation",
  shipping_notification: "Shipping notification",
  contact_message: "Contact message",
  welcome: "Welcome",
  admin_new_order: "New-order alert (admin)",
  unpaid_alert: "Unpaid-order alert (admin)",
  auth_verification: "Email verification",
  auth_password_reset: "Password reset",
  auth_magic_link: "Magic-link sign-in",
};

/** What CAUSED a send, for the kinds where more than one path can produce it.
 *  Recorded on `email_log.trigger` so the admin email-history panel can tell a
 *  webhook-driven receipt from a manual resend. */
export type EmailTrigger =
  | "ipn"
  | "reconciliation"
  | "post_return"
  | "admin_resend"
  | "unpaid_alert";

export const EMAIL_TRIGGER_LABEL: Record<EmailTrigger, string> = {
  ipn: "IPN webhook",
  reconciliation: "Live status reconciliation",
  post_return: "Post-return confirmation",
  admin_resend: "Admin resend",
  unpaid_alert: "Unpaid-order alert",
};

/** One line of a cart/order, as it appears in the itemised table. */
export interface EmailLine {
  name: string;
  variant?: string | null;
  qty: number;
  priceCents: number;
  imageUrl?: string | null;
}

export interface OrderEmailData {
  orderNumber: string;
  email: string;
  customerName: string;
  lines: EmailLine[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  orderUrl: string;
  trackUrl: string;
}

// ── Brand tokens, mirroring the storefront palette ──────────────────────────
// PetParcel brand ramp, mirrored from the storefront's own design tokens
// (client/src/index.css): rose/magenta accent on a warm cream ground, with a
// near-black ink for body copy. Keeping the hex values here - rather than
// reading the stylesheet - is deliberate: an email client cannot load our CSS,
// so every colour has to be inlined, and these MUST stay in step with the site.
const PINK = "#eb3594";
const ACCENT = "#d0337f";
const PINK_DEEP = "#b03a6e";
const INK = "#1b1b1b";
const MUTED = "#6b6b6b";
const CREAM = "#faf3f1";
const LINE = "#efe3e0";
const FOOTER_BG = "#fbf7f6";
const FAINT = "#9a8f8c";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * `Name <local@domain>` - the form Resend (and every mail client) expects.
 *
 * The stricter local-part + domain-with-a-TLD pattern is deliberate: a From of
 * `PetParcel <orders@petparcel>` is accepted by our own form, rejected by the
 * provider, and the failure lands on a customer's order rather than on the
 * person who typed the setting. Falling back to the bare address keeps the
 * email sendable when the local-part has dots/plus signs this pattern misses.
 */
export function resolveFrom(name: string, address: string): string {
  const addr = String(address ?? "").trim();
  const strict = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
  if (addr && strict.test(addr)) {
    const label = String(name ?? "").trim();
    return label ? `${label} <${addr}>` : addr;
  }
  // Not a usable address - hand it back raw so Resend's own error is what the
  // admin sees in `email_log.error`, not a silently mangled string.
  return addr;
}

/** Absolute URL for an in-app path. Falls back to the production domain when the
 *  caller (a server-side admin action) has no origin to hand. */
export function absoluteUrl(origin: string | null | undefined, path: string): string {
  const base = (origin ?? "").trim().replace(/\/+$/, "");
  return `${base || "https://www.petparcel.store"}${path}`;
}

/**
 * `List-Unsubscribe` / `List-Unsubscribe-Post` headers for a message, or null
 * when there is nothing to unsubscribe from.
 *
 * A *transactional* message (an order confirmation or a receipt) gets NO
 * unsubscribe header on purpose: offering a way out of a receipt is a spam
 * signal, and the customer expects the message. A *bulk/marketing* message (the
 * store's newsletter) MUST carry one - Gmail and Yahoo require it for bulk
 * senders, and its absence is a leading cause of the promotions tab or a
 * straight rejection. `unsubscribeUrl` is a `mailto:` or `https:` URI; a
 * one-click POST is advertised only when it is an `https:` endpoint.
 */
export function listUnsubscribeHeaders(
  unsubscribeUrl: string | null | undefined,
): Record<string, string> | null {
  const url = String(unsubscribeUrl ?? "").trim();
  if (!url) return null;
  const headers: Record<string, string> = { "List-Unsubscribe": `<${url}>` };
  if (/^https?:/i.test(url)) headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  return headers;
}

/** The footer's visible unsubscribe line. Kept next to `listUnsubscribeHeaders`
 *  so the header and the link a reader sees can never drift apart. */
export function unsubscribeFooterLine(address: string): string {
  const to = String(address ?? "").trim();
  const mailto = `mailto:${to}?subject=unsubscribe`;
  return `Prefer fewer emails? <a href="${esc(mailto)}" style="color:${PINK_DEEP};font-weight:600;text-decoration:none;">Unsubscribe</a> or manage your preferences any time.`;
}

// ── Shared shell ────────────────────────────────────────────────────────────
// Table-based with inline styles: email clients strip <style> blocks, and the
// newer ones are aggressive about it. 600px max width, single column, so it
// reflows cleanly on a phone.
function shell(
  brand: string,
  preheader: string,
  body: string,
  footerNote?: string,
  unsubscribeLine?: string,
): string {
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  // The wordmark is real text, not an image: an image-only header is a classic
  // spam signal and is invisible when images are blocked, which is the default
  // in many clients. The paw badge is a gradient-tinted table cell with an HTML
  // entity glyph, so it renders even with images off.
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(brand)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:${CREAM};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:18px;overflow:hidden;font-family:${font};color:${INK};">
      <tr><td style="height:5px;line-height:5px;font-size:0;background:${PINK};background-image:linear-gradient(90deg,${PINK} 0%,${ACCENT} 100%);">&nbsp;</td></tr>
      <tr><td style="padding:22px 28px 20px;border-bottom:1px solid ${LINE};">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td width="34" valign="middle" style="width:34px;">
            <span style="display:inline-block;width:34px;height:34px;border-radius:10px;background:${PINK};background-image:linear-gradient(135deg,${PINK} 0%,${ACCENT} 100%);color:#ffffff;font-size:17px;line-height:34px;text-align:center;font-family:${font};">&#128062;</span>
          </td>
          <td valign="middle" style="padding-left:10px;font-family:${font};font-size:21px;font-weight:800;letter-spacing:-0.02em;color:${INK};">
            Pet<span style="color:${PINK};">Parcel</span>
          </td>
        </tr></table>
      </td></tr>
      ${body}
      <tr><td style="padding:22px 28px;background:${FOOTER_BG};border-top:1px solid ${LINE};font-family:${font};">
        <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${MUTED};">
          Questions? Reply to this email or write to ${esc("{{SUPPORT_EMAIL}}")}.
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};white-space:nowrap;">
          ${esc("{{BUSINESS_ADDRESS}}")}
        </p>
        ${unsubscribeLine ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">${unsubscribeLine}</p>` : ""}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:${FAINT};font-family:${font};">
      ${esc(footerNote ?? `You're receiving this because you placed an order with ${brand}.`)}
    </p>
  </td></tr>
</table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>
    <td style="background:${PINK};background-image:linear-gradient(135deg,${PINK} 0%,${ACCENT} 100%);border-radius:11px;">
      <a href="${esc(href)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(label)}</a>
    </td></tr></table>`;
}

function itemRows(lines: EmailLine[], currency: string): string {
  return lines
    .map(
      (l) => `<tr>
      <td style="padding:12px 0;border-bottom:1px solid ${LINE};">
        <div style="font-size:14px;font-weight:600;color:${INK};">${esc(l.name)}</div>
        ${l.variant ? `<div style="font-size:12px;color:${MUTED};margin-top:2px;">${esc(l.variant)}</div>` : ""}
        <div style="font-size:12px;color:${MUTED};margin-top:2px;">Qty ${l.qty}</div>
      </td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid ${LINE};font-size:14px;font-weight:700;white-space:nowrap;vertical-align:top;">
        ${esc(formatMoney(l.priceCents * l.qty, currency))}
      </td></tr>`,
    )
    .join("");
}

function totalsRows(d: OrderEmailData): string {
  const row = (label: string, value: string, strong = false) => `<tr>
    <td style="padding:4px 0;font-size:${strong ? "16px" : "14px"};color:${strong ? INK : MUTED};font-weight:${strong ? "800" : "500"};">${esc(label)}</td>
    <td align="right" style="padding:4px 0;font-size:${strong ? "16px" : "14px"};color:${INK};font-weight:${strong ? "800" : "600"};">${esc(value)}</td></tr>`;
  const parts = [
    row("Subtotal", formatMoney(d.subtotalCents, d.currency)),
    row(
      "Shipping",
      d.shippingCents === 0 ? "Free" : formatMoney(d.shippingCents, d.currency),
    ),
  ];
  if (d.taxCents > 0) parts.push(row("Tax", formatMoney(d.taxCents, d.currency)));
  parts.push(
    `<tr><td colspan="2" style="padding:8px 0 0;border-top:1px solid ${LINE};"></td></tr>`,
    row("Total", formatMoney(d.totalCents, d.currency), true),
  );
  return parts.join("");
}

function addressBlock(d: OrderEmailData): string {
  const a = d.shippingAddress;
  const lines = [a.fullName, a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`, a.country]
    .filter(Boolean)
    .map((x) => esc(String(x)))
    .join("<br>");
  return `<p style="margin:0;font-size:14px;line-height:1.6;color:${INK};">${lines}</p>`;
}

// ── Templates ───────────────────────────────────────────────────────────────
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export function renderOrderConfirmation(
  d: OrderEmailData,
  brand = "PetParcel",
  supportEmail = "support@petparcel.store",
  businessAddress = "1600 Pacific Ave, Dallas, TX 75201, USA",
): RenderedEmail {
  businessAddress = cleanAddress(businessAddress);
  const subject = `Order ${d.orderNumber} confirmed - thank you, ${d.customerName.split(" ")[0] || "friend"}!`;
  const body = `
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">Thanks - your order is in! 🎉</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
          Hi ${esc(d.customerName.split(" ")[0] || "there")}, we've received order
          <strong style="color:${INK};">${esc(d.orderNumber)}</strong> and we're getting it ready.
          We'll email you again the moment it ships.
        </p>
      </td></tr>
      <tr><td style="padding:16px 28px 0;">
        ${button(d.orderUrl, "Track your order")}
        <p style="margin:0;font-size:12px;color:${MUTED};">Or look it up any time at ${esc(d.trackUrl.replace(/^https?:\/\//, ""))}</p>
      </td></tr>
      <tr><td style="padding:26px 28px 0;">
        <h2 style="margin:0 0 4px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Your order</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(d.lines, d.currency)}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${totalsRows(d)}</table>
      </td></tr>
      <tr><td style="padding:26px 28px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="50%" valign="top" style="padding-right:12px;">
            <h2 style="margin:0 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Shipping to</h2>
            ${addressBlock(d)}
          </td>
          <td width="50%" valign="top">
            <h2 style="margin:0 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Need help?</h2>
            <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">
              Reply to this email or write to ${esc(supportEmail)}.
            </p>
          </td>
        </tr></table>
      </td></tr>`;

  const text = [
    `Thanks - your order is in!`,
    ``,
    `Hi ${d.customerName.split(" ")[0] || "there"}, we've received order ${d.orderNumber} and we're getting it ready.`,
    `We'll email you again the moment it ships.`,
    ``,
    `Track your order: ${d.orderUrl}`,
    `Look it up any time: ${d.trackUrl}`,
    ``,
    `YOUR ORDER`,
    ...d.lines.map(
      (l) =>
        `  ${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ""} - ${formatMoney(l.priceCents * l.qty, d.currency)}`,
    ),
    ``,
    `  Subtotal: ${formatMoney(d.subtotalCents, d.currency)}`,
    `  Shipping: ${d.shippingCents === 0 ? "Free" : formatMoney(d.shippingCents, d.currency)}`,
    ...(d.taxCents > 0 ? [`  Tax: ${formatMoney(d.taxCents, d.currency)}`] : []),
    `  Total: ${formatMoney(d.totalCents, d.currency)}`,
    ``,
    `SHIPPING TO`,
    `  ${d.shippingAddress.fullName}`,
    `  ${d.shippingAddress.line1}`,
    ...(d.shippingAddress.line2 ? [`  ${d.shippingAddress.line2}`] : []),
    `  ${d.shippingAddress.city}, ${d.shippingAddress.state} ${d.shippingAddress.postalCode}`,
    `  ${d.shippingAddress.country}`,
    ``,
    `Questions? Write to ${supportEmail}.`,
    `${businessAddress}`,
  ].join("\n");

  return {
    subject,
    html: shell(brand, `Order ${d.orderNumber} is confirmed - we're getting it ready.`, body)
      .replace(/\{\{SUPPORT_EMAIL\}\}/g, esc(supportEmail))
      .replace(/\{\{BUSINESS_ADDRESS\}\}/g, esc(businessAddress)),
    text,
  };
}

export function renderShippingNotification(
  d: OrderEmailData,
  brand = "PetParcel",
  supportEmail = "support@petparcel.store",
  businessAddress = "1600 Pacific Ave, Dallas, TX 75201, USA",
): RenderedEmail {
  businessAddress = cleanAddress(businessAddress);
  const carrier = d.carrier || "the carrier";
  const subject = `Order ${d.orderNumber} is on its way 📦`;
  const trackingBlock = d.trackingNumber
    ? `<tr><td style="padding:4px 28px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;">
              <tr><td style="padding:16px 18px;">
                <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};margin-bottom:6px;">Tracking</div>
                <div style="font-size:15px;font-weight:700;color:${INK};">${esc(carrier)} &middot; ${esc(d.trackingNumber)}</div>
              </td></tr>
            </table>
          </td></tr>`
    : "";

  const body = `
      <tr><td style="padding:30px 28px 26px;">
        <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">Your parcel is on the move 🚚</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
          Hi ${esc(d.customerName.split(" ")[0] || "there")}, order
          <strong style="color:${INK};">${esc(d.orderNumber)}</strong> has left our warehouse
          and is on its way to you.
        </p>
      </td></tr>
      ${trackingBlock}
      <tr><td style="padding:22px 28px 0;">
        ${d.trackingUrl ? button(d.trackingUrl, "Track with " + carrier) : button(d.orderUrl, "View your order")}
        <p style="margin:0;font-size:12px;color:${MUTED};">
          ${d.trackingNumber ? `Tracking number: <strong style="color:${INK};">${esc(d.trackingNumber)}</strong> &middot; ` : ""}Order ${esc(d.orderNumber)}
        </p>
      </td></tr>
      <tr><td style="padding:24px 28px 30px;">
        <h2 style="margin:0 0 4px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">In this parcel</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(d.lines, d.currency)}</table>
      </td></tr>`;

  const text = [
    `Your parcel is on the move!`,
    ``,
    `Hi ${d.customerName.split(" ")[0] || "there"}, order ${d.orderNumber} has left our warehouse and is on its way to you.`,
    ``,
    ...(d.trackingNumber
      ? [`Carrier: ${carrier}`, `Tracking number: ${d.trackingNumber}`]
      : []),
    ...(d.trackingUrl ? [`Track it: ${d.trackingUrl}`] : [`View your order: ${d.orderUrl}`]),
    ``,
    `IN THIS PARCEL`,
    ...d.lines.map(
      (l) => `  ${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ""}`,
    ),
    ``,
    `Questions? Write to ${supportEmail}.`,
    `${businessAddress}`,
  ].join("\n");

  return {
    subject,
    html: shell(brand, `Order ${d.orderNumber} has shipped - tracking inside.`, body)
      .replace(/\{\{SUPPORT_EMAIL\}\}/g, esc(supportEmail))
      .replace(/\{\{BUSINESS_ADDRESS\}\}/g, esc(businessAddress)),
    text,
  };
}

/** Deep link for the carrier, when we can build one. Only the carriers that
 *  publish a stable, predictable tracking URL get one - a guessed URL that
 *  404s is worse than sending the customer to their order page. */
export function carrierTrackingUrl(carrier: string | null, trackingNumber: string | null): string | null {
  const n = (trackingNumber ?? "").trim();
  if (!n) return null;
  const c = (carrier ?? "").trim().toLowerCase();
  const q = encodeURIComponent(n);
  if (c.includes("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${q}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${q}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${q}`;
  if (c.includes("dhl")) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${q}`;
  return null;
}

// ── Sending ─────────────────────────────────────────────────────────────────
export interface SendResult {
  status: "sent" | "skipped" | "failed";
  reason?: string;
  providerMessageId?: string | null;
  logId?: string;
}

interface SendArgs {
  kind: EmailKind;
  to: string;
  rendered: RenderedEmail;
  settings: SettingsMap;
  orderId?: string | null;
  orderNumber?: string | null;
  /**
   * Override the resolved From header for this one send.
   *
   * The store's Settings -> Email value normally wins; this is for a caller
   * that MUST send from a specific address - e.g. Neon Auth emails, which go
   * out from the auth sender (`AUTH_EMAIL_FROM`) rather than the orders inbox.
   * An empty/undefined value falls back to the normal resolution.
   */
  from?: string | null;
  /**
   * Address to advertise in a `List-Unsubscribe` header. Set this for a
   * BULK/marketing message only - transactional mail (a receipt, a shipping
   * notice) leaves it unset on purpose, because offering a way out of a receipt
   * is a spam signal. `listUnsubscribeHeaders` turns it into the header pair.
   */
  listUnsubscribe?: string | null;
  /** What caused this send, recorded on `email_log.trigger`. Only meaningful for
   *  the kinds more than one path can produce (the paid receipt, the unpaid
   *  alert); left unset elsewhere. */
  trigger?: EmailTrigger | null;
}

/**
 * Send one transactional email and record the attempt.
 *
 * Never throws: a customer placing an order must not have it fail because the
 * mail provider is down or the key is not configured yet. The caller gets a
 * status, and the database keeps the receipt.
 */
export async function sendTransactionalEmail(args: SendArgs): Promise<SendResult> {
  const { kind, to, rendered, settings } = args;
  // The store's Settings -> Email value wins; `EMAIL_FROM` is the env fallback
  // for a deployment that keeps the sender out of the database. `resolveFrom`
  // handles both the `Name <addr>` and bare-address forms. An explicit
  // per-send `from` (auth emails) takes precedence over both.
  const explicitFrom = String(args.from ?? "").trim();
  const from = explicitFrom
    ? explicitFrom
    : settings.email_from_address?.trim()
      ? resolveFrom(settings.email_from_name, settings.email_from_address)
      : resolveFrom(settings.email_from_name, env.email.from);
  const replyTo = (settings.email_reply_to ?? "").trim();
  // Only a bulk send asks for the unsubscribe header; everything transactional
  // gets none (see `listUnsubscribeHeaders`).
  const unsubscribeHeaders = listUnsubscribeHeaders(args.listUnsubscribe);

  const finish = async (
    status: SendResult["status"],
    reason: string | null,
    providerMessageId: string | null,
  ): Promise<SendResult> => {
    let logId: string | undefined;
    try {
      const [row] = await db
        .insert(emailLog)
        .values({
          orderId: args.orderId ?? null,
          orderNumber: args.orderNumber ?? null,
          kind,
          toEmail: to,
          fromEmail: from || null,
          replyTo: replyTo || null,
          subject: rendered.subject,
          status,
          error: reason,
          providerId: status === "skipped" ? null : providerForKind(kind),
          providerMessageId,
          trigger: args.trigger ?? null,
        })
        .returning({ id: emailLog.id });
      logId = row?.id;
    } catch (e) {
      // Logging must not break the send path either.
      // eslint-disable-next-line no-console
      console.warn(`[email] could not write email_log for ${kind}: ${(e as Error).message}`);
    }
    return { status, reason: reason ?? undefined, providerMessageId, logId };
  };

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
    return finish("failed", `Not a valid recipient address: "${to}"`, null);
  }
  if (!from) {
    return finish("failed", "No sender address configured (Settings → Email).", null);
  }

  // ── Provider routing ──────────────────────────────────────────────────────
  // Critical mail (order / payment confirmation, the admin's new-order alert)
  // goes through Resend; everything else - sign-in links, password resets,
  // contact replies, welcome mail - goes through the secondary SMTP provider.
  // The two have SEPARATE quotas, so a burst of signups can never exhaust the
  // allowance a customer's receipt depends on. See _core/email-routing.ts.
  if (providerForKind(kind) === "smtp") {
    const r = await sendViaSmtp({
      to: to.trim(),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      from,
      replyTo: replyTo || undefined,
      headers: unsubscribeHeaders ?? undefined,
    });
    return finish(r.status, r.reason ?? null, r.providerMessageId ?? null);
  }

  const apiKey = env.email.resendApiKey;
  if (!apiKey) {
    // The documented pre-setup state: nobody is notified, and the store says so
    // rather than pretending. Add RESEND_API_KEY to switch sending on.
    return finish(
      "skipped",
      "RESEND_API_KEY is not set - add it in Settings → Environment variables to send order emails.",
      null,
    );
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
        to: [to.trim()],
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(unsubscribeHeaders ? { headers: unsubscribeHeaders } : {}),
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
      return finish("failed", `Resend rejected the send (${res.status}): ${detail}`, null);
    }
    return finish("sent", null, body.id ?? null);
  } catch (e) {
    return finish("failed", `Could not reach Resend: ${(e as Error).message}`, null);
  }
}

// ── Order-shaped helpers used by the routers ────────────────────────────────
export interface OrderEmailContext {
  id: string;
  orderNumber: string;
  email: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingAddress: OrderEmailData["shippingAddress"];
  carrier?: string | null;
  trackingNumber?: string | null;
}

export function toEmailLines(
  items: Array<{
    nameSnapshot: string;
    variantSnapshot: string | null;
    qty: number;
    priceCents: number;
    imageUrl: string | null;
  }>,
): EmailLine[] {
  return items.map((i) => ({
    name: i.nameSnapshot,
    variant: i.variantSnapshot,
    qty: i.qty,
    priceCents: i.priceCents,
    imageUrl: i.imageUrl,
  }));
}

export function buildOrderEmailData(
  order: OrderEmailContext,
  lines: EmailLine[],
  origin: string | null | undefined,
): OrderEmailData {
  const orderUrl = absoluteUrl(origin, `/order/${encodeURIComponent(order.orderNumber)}`);
  return {
    orderNumber: order.orderNumber,
    email: order.email,
    customerName: order.shippingAddress?.fullName || "there",
    lines,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    currency: order.currency,
    shippingAddress: order.shippingAddress,
    carrier: order.carrier ?? null,
    trackingNumber: order.trackingNumber ?? null,
    trackingUrl: carrierTrackingUrl(order.carrier ?? null, order.trackingNumber ?? null),
    orderUrl,
    trackUrl: absoluteUrl(origin, "/track"),
  };
}

/** Send the order-confirmation email for an order. */
export async function sendOrderConfirmation(
  order: OrderEmailContext,
  lines: EmailLine[],
  settings: SettingsMap,
  origin?: string | null,
): Promise<SendResult> {
  const data = buildOrderEmailData(order, lines, origin);
  const rendered = renderOrderConfirmation(
    data,
    settings.brand_name,
    settings.contact_email,
    settings.business_address,
  );
  return sendTransactionalEmail({
    kind: "order_confirmation",
    to: order.email,
    rendered,
    settings,
    orderId: order.id,
    orderNumber: order.orderNumber,
  });
}

/** Send the shipping-notification email for an order. */
export async function sendShippingNotification(
  order: OrderEmailContext,
  lines: EmailLine[],
  settings: SettingsMap,
  origin?: string | null,
): Promise<SendResult> {
  const data = buildOrderEmailData(order, lines, origin);
  const rendered = renderShippingNotification(
    data,
    settings.brand_name,
    settings.contact_email,
    settings.business_address,
  );
  return sendTransactionalEmail({
    kind: "shipping_notification",
    to: order.email,
    rendered,
    settings,
    orderId: order.id,
    orderNumber: order.orderNumber,
  });
}

/**
 * Render the PAYMENT-confirmation email.
 *
 * Deliberately SEPARATE from the order confirmation. The order confirmation only
 * acknowledges that an order was PLACED (which happens before the shopper has
 * paid); this is the receipt that says the payment actually SETTLED, and it is
 * only ever sent after the store has independently verified the payment with the
 * gateway (see `confirmPayment` in routers.ts). It is a CRITICAL kind, so it
 * goes out through Resend alongside the receipt-class mail.
 */
export function renderPaymentConfirmation(
  d: OrderEmailData,
  brand = "PetParcel",
  supportEmail = "support@petparcel.store",
  businessAddress = "1600 Pacific Ave, Dallas, TX 75201, USA",
): RenderedEmail {
  businessAddress = cleanAddress(businessAddress);
  const subject = `Payment received for order ${d.orderNumber} ✅`;
  const first = d.customerName.split(" ")[0] || "there";
  const body = `
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">Payment received ✅</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
          Hi ${esc(first)}, we've received your payment of
          <strong style="color:${INK};">${esc(formatMoney(d.totalCents, d.currency))}</strong>
          for order <strong style="color:${INK};">${esc(d.orderNumber)}</strong>.
          Your order is confirmed and heading into fulfilment - we'll email you again
          the moment it ships.
        </p>
      </td></tr>
      <tr><td style="padding:16px 28px 0;">
        ${button(d.orderUrl, "Track your order")}
        <p style="margin:0;font-size:12px;color:${MUTED};">Or look it up any time at ${esc(d.trackUrl.replace(/^https?:\/\//, ""))}</p>
      </td></tr>
      <tr><td style="padding:26px 28px 0;">
        <h2 style="margin:0 0 4px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Your order</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(d.lines, d.currency)}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${totalsRows(d)}</table>
      </td></tr>
      <tr><td style="padding:26px 28px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="50%" valign="top" style="padding-right:12px;">
            <h2 style="margin:0 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Shipping to</h2>
            ${addressBlock(d)}
          </td>
          <td width="50%" valign="top">
            <h2 style="margin:0 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Need help?</h2>
            <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">
              Reply to this email or write to ${esc(supportEmail)}.
            </p>
          </td>
        </tr></table>
      </td></tr>`;

  const text = [
    `Payment received`,
    ``,
    `Hi ${first}, we've received your payment of ${formatMoney(d.totalCents, d.currency)} for order ${d.orderNumber}.`,
    `Your order is confirmed and heading into fulfilment.`,
    ``,
    `Track your order: ${d.orderUrl}`,
    ``,
    `YOUR ORDER`,
    ...d.lines.map(
      (l) =>
        `  ${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ""} - ${formatMoney(l.priceCents * l.qty, d.currency)}`,
    ),
    ``,
    `  Subtotal: ${formatMoney(d.subtotalCents, d.currency)}`,
    `  Shipping: ${d.shippingCents === 0 ? "Free" : formatMoney(d.shippingCents, d.currency)}`,
    ...(d.taxCents > 0 ? [`  Tax: ${formatMoney(d.taxCents, d.currency)}`] : []),
    `  Total: ${formatMoney(d.totalCents, d.currency)}`,
    ``,
    `Questions? Write to ${supportEmail}.`,
    `${businessAddress}`,
  ].join("\n");

  return {
    subject,
    html: shell(brand, `Payment received for order ${d.orderNumber}.`, body)
      .replace(/\{\{SUPPORT_EMAIL\}\}/g, esc(supportEmail))
      .replace(/\{\{BUSINESS_ADDRESS\}\}/g, esc(businessAddress)),
    text,
  };
}

/**
 * Send the payment-confirmation email for an order.
 *
 * Called ONLY after the payment gateway has been asked directly and answered
 * that the order is paid, so it can never be triggered by a forged return URL.
 */
export async function sendPaymentConfirmation(
  order: OrderEmailContext,
  lines: EmailLine[],
  settings: SettingsMap,
  origin?: string | null,
  trigger?: EmailTrigger | null,
): Promise<SendResult> {
  const data = buildOrderEmailData(order, lines, origin);
  const rendered = renderPaymentConfirmation(
    data,
    settings.brand_name,
    settings.contact_email,
    settings.business_address,
  );
  return sendTransactionalEmail({
    kind: "payment_confirmation",
    to: order.email,
    rendered,
    settings,
    orderId: order.id,
    orderNumber: order.orderNumber,
    trigger: trigger ?? null,
  });
}

// ── Contact message notification ─────────────────────────────────────────────
export interface ContactMessageData {
  name: string;
  email: string;
  topic: string;
  message: string;
  receivedAt: Date;
}

/** Internal notification for a new contact-form message - sent to the store's
 *  own support inbox, never to the customer. */
export function renderContactMessage(
  d: ContactMessageData,
  brand = "PetParcel",
): RenderedEmail {
  const subject = `New contact message: ${d.topic}`;
  const body = `
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">New contact message</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
          <strong style="color:${INK};">${esc(d.name)}</strong> &lt;${esc(d.email)}&gt; wrote in about
          <strong style="color:${INK};">${esc(d.topic)}</strong>.
        </p>
      </td></tr>
      <tr><td style="padding:10px 28px 6px;">
        <div style="border:1px solid ${LINE};border-radius:12px;padding:16px;background:#ffffff;font-size:15px;line-height:1.7;color:${INK};white-space:pre-wrap;">${esc(d.message)}</div>
      </td></tr>
      <tr><td style="padding:14px 28px 30px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">
          Reply to this email to answer ${esc(d.name)} directly. Received ${esc(d.receivedAt.toISOString())}.
        </p>
      </td></tr>`;
  const text = `New contact message\nFrom: ${d.name} <${d.email}>\nTopic: ${d.topic}\n\n${d.message}\n`;
  return { subject, html: shell(brand, subject, body), text };
}

/** Notify the store owner that a contact message arrived. Never throws - the
 *  message is already saved in the database, so a mail outage must not surface
 *  as a failed submission (the caller records the outcome either way). */
export async function sendContactMessageEmail(
  data: ContactMessageData,
  settings: SettingsMap,
): Promise<SendResult> {
  const rendered = renderContactMessage(data, settings.brand_name);
  return sendTransactionalEmail({
    kind: "contact_message",
    to: (settings.contact_email || settings.email_reply_to || "support@petparcel.store").trim(),
    rendered,
    settings,
  });
}

/** The reply an admin sends to a shopper who used the contact form.
 *
 *  This is the customer-facing half of the inbox: the panel could always flip a
 *  message to "replied", but nothing was ever actually sent, so the customer got
 *  silence. This renders their original message above our answer, so the reply
 *  stands on its own without them having to remember what they asked. */
export function renderContactReply(
  d: { name: string; originalMessage: string; replyBody: string; brandName?: string },
  brand = "PetParcel",
  supportEmail = "support@petparcel.store",
  businessAddress = "1600 Pacific Ave, Dallas, TX 75201, USA",
): RenderedEmail {
  businessAddress = cleanAddress(businessAddress);
  const first = (d.name || "").trim().split(" ")[0] || "there";
  const subject = `Re: your message to ${brand}`;
  const body = `
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">Thanks for getting in touch</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
          Hi ${esc(first)}, here is our reply to your message.
        </p>
      </td></tr>
      <tr><td style="padding:16px 28px 0;">
        <div style="border:1px solid ${LINE};border-radius:12px;padding:16px;background:#ffffff;font-size:15px;line-height:1.7;color:${INK};white-space:pre-wrap;">${esc(d.replyBody)}</div>
      </td></tr>
      <tr><td style="padding:18px 28px 0;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Your message</p>
        <div style="border-left:3px solid ${LINE};padding:2px 0 2px 14px;font-size:14px;line-height:1.7;color:${MUTED};white-space:pre-wrap;">${esc(d.originalMessage)}</div>
      </td></tr>
      <tr><td style="padding:22px 28px 30px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${MUTED};">
          Need anything else? Just reply to this email or write to ${esc(supportEmail)}.
        </p>
      </td></tr>`;
  const text = [
    `Hi ${first}, here is our reply to your message.`,
    ``,
    d.replyBody,
    ``,
    `--- Your message ---`,
    d.originalMessage,
    ``,
    `Questions? Write to ${supportEmail}.`,
    `${businessAddress}`,
  ].join("\n");
  return { subject, html: shell(brand, subject, body), text };
}

/** Send a contact-form reply to the shopper. Never throws - the reply is already
 *  recorded against the message, so a mail outage must not turn into a failed
 *  reply in the panel (the caller records the outcome either way).
 *
 *  Kind is `contact_message`, which is NON-critical, so it routes to the
 *  secondary SMTP provider and never spends Resend's daily cap. */
export async function sendContactReplyEmail(
  data: { to: string; name: string; originalMessage: string; replyBody: string },
  settings: SettingsMap,
): Promise<SendResult> {
  const rendered = renderContactReply(
    {
      name: data.name,
      originalMessage: data.originalMessage,
      replyBody: data.replyBody,
      brandName: settings.brand_name,
    },
    settings.brand_name,
    settings.contact_email,
    settings.business_address,
  );
  return sendTransactionalEmail({
    kind: "contact_message",
    to: data.to,
    rendered,
    settings,
  });
}

// ── Welcome email (new customer) ─────────────────────────────────────────────
export interface WelcomeEmailData {
  name: string;
  email: string;
  shopUrl: string;
  accountUrl: string;
}

/** The first email a new account receives. Branded, single column, with a
 *  plain-text fallback - same shell as the order emails. */
export function renderWelcome(
  d: WelcomeEmailData,
  brand = "PetParcel",
  supportEmail = "support@petparcel.store",
  businessAddress = "1600 Pacific Ave, Dallas, TX 75201, USA",
): RenderedEmail {
  businessAddress = cleanAddress(businessAddress);
  const first = (d.name || "").trim().split(" ")[0] || "there";
  const subject = `Welcome to ${brand} 🐾`;
  const body = `
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">Welcome to ${esc(brand)}! 🐾</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
          Hi ${esc(first)}, thanks for creating an account. You're all set to shop
          food, treats, beds, crates, harnesses, toys and grooming for every pet -
          with fast, tracked US shipping and 30-day returns.
        </p>
      </td></tr>
      <tr><td style="padding:16px 28px 0;">
        ${button(d.shopUrl, "Start shopping")}
      </td></tr>
      <tr><td style="padding:24px 28px 30px;">
        <h2 style="margin:0 0 8px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Your account</h2>
        <p style="margin:0;font-size:14px;line-height:1.7;color:${MUTED};">
          Track orders and manage your details any time at
          <a href="${esc(d.accountUrl)}" style="color:${PINK_DEEP};font-weight:600;text-decoration:none;">your account</a>.
          Questions? Just reply to this email or write to ${esc(supportEmail)}.
        </p>
      </td></tr>`;
  const text = [
    `Welcome to ${brand}!`,
    ``,
    `Hi ${first}, thanks for creating an account. You're all set to shop.`,
    ``,
    `Start shopping: ${d.shopUrl}`,
    `Your account: ${d.accountUrl}`,
    ``,
    `Questions? Write to ${supportEmail}.`,
    `${businessAddress}`,
  ].join("\n");
  return {
    subject,
    html: shell(
      brand,
      `Welcome to ${brand} - your account is ready.`,
      body,
      `You're receiving this because you created an account with ${brand}.`,
      unsubscribeFooterLine(supportEmail),
    )
      .replace(/\{\{SUPPORT_EMAIL\}\}/g, esc(supportEmail))
      .replace(/\{\{BUSINESS_ADDRESS\}\}/g, esc(businessAddress)),
    text,
  };
}

/** Send the welcome email for a newly created account. Never throws - a mail
 *  outage must not fail the signup (the account already exists). */
export async function sendWelcomeEmail(
  data: WelcomeEmailData,
  settings: SettingsMap,
): Promise<SendResult> {
  const rendered = renderWelcome(
    data,
    settings.brand_name,
    settings.contact_email,
    settings.business_address,
  );
  return sendTransactionalEmail({ kind: "welcome", to: data.email, rendered, settings });
}

// ── Admin new-order notification ─────────────────────────────────────────────
/** The store owner's alert that an order came in. Sent to the SINGLE designated
 *  admin address (`ADMIN_EMAIL`) when set, else the store's support inbox. */
export function renderAdminNewOrder(
  d: OrderEmailData,
  brand = "PetParcel",
  orderUrl?: string | null,
  supportEmail = "support@petparcel.store",
  businessAddress = "1600 Pacific Ave, Dallas, TX 75201, USA",
): RenderedEmail {
  businessAddress = cleanAddress(businessAddress);
  const subject = `New order ${d.orderNumber} - ${formatMoney(d.totalCents, d.currency)}`;
  const body = `
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">New order received 🎉</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
          <strong style="color:${INK};">${esc(d.customerName)}</strong> &lt;${esc(d.email)}&gt; just placed
          order <strong style="color:${INK};">${esc(d.orderNumber)}</strong> for
          <strong style="color:${INK};">${esc(formatMoney(d.totalCents, d.currency))}</strong>.
        </p>
      </td></tr>
      ${orderUrl ? `<tr><td style="padding:16px 28px 0;">${button(orderUrl, "View order")}</td></tr>` : ""}
      <tr><td style="padding:24px 28px 0;">
        <h2 style="margin:0 0 4px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Items</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(d.lines, d.currency)}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${totalsRows(d)}</table>
      </td></tr>
      <tr><td style="padding:24px 28px 30px;">
        <h2 style="margin:0 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${PINK_DEEP};">Ship to</h2>
        ${addressBlock(d)}
      </td></tr>`;
  const text = [
    `New order received!`,
    ``,
    `${d.customerName} <${d.email}> placed order ${d.orderNumber} for ${formatMoney(d.totalCents, d.currency)}.`,
    ...(orderUrl ? [``, `View order: ${orderUrl}`] : []),
    ``,
    `ITEMS`,
    ...d.lines.map(
      (l) => `  ${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ""} - ${formatMoney(l.priceCents * l.qty, d.currency)}`,
    ),
    ``,
    `  Subtotal: ${formatMoney(d.subtotalCents, d.currency)}`,
    `  Shipping: ${d.shippingCents === 0 ? "Free" : formatMoney(d.shippingCents, d.currency)}`,
    ...(d.taxCents > 0 ? [`  Tax: ${formatMoney(d.taxCents, d.currency)}`] : []),
    `  Total: ${formatMoney(d.totalCents, d.currency)}`,
    ``,
    `SHIP TO`,
    `  ${d.shippingAddress.fullName}`,
    `  ${d.shippingAddress.line1}`,
    ...(d.shippingAddress.line2 ? [`  ${d.shippingAddress.line2}`] : []),
    `  ${d.shippingAddress.city}, ${d.shippingAddress.state} ${d.shippingAddress.postalCode}`,
    `  ${d.shippingAddress.country}`,
  ].join("\n");
  return {
    subject,
    html: shell(
      brand,
      subject,
      body,
      `Internal notification - a new order was placed on ${brand}.`,
    )
      .replace(/\{\{SUPPORT_EMAIL\}\}/g, esc(supportEmail))
      .replace(/\{\{BUSINESS_ADDRESS\}\}/g, esc(businessAddress)),
    text: [text, ``, `Questions? Write to ${supportEmail}.`, `${businessAddress}`].join("\n"),
  };
}

/** Notify the store owner of a new order. Recipient is the single designated
 *  admin address (`ADMIN_EMAIL`) when set, else the store's support inbox.
 *  Never throws - the order is already placed, so a mail outage must not fail
 *  checkout (the caller records the outcome either way). */
export async function sendAdminNewOrderEmail(
  order: OrderEmailContext,
  lines: EmailLine[],
  settings: SettingsMap,
  origin?: string | null,
): Promise<SendResult> {
  const to = (designatedAdminEmail() ?? settings.contact_email ?? "").trim();
  if (!to) {
    return { status: "skipped", reason: "No admin address configured (set ADMIN_EMAIL)." };
  }
  const data = buildOrderEmailData(order, lines, origin);
  const rendered = renderAdminNewOrder(
    data,
    settings.brand_name,
    data.orderUrl,
    settings.contact_email,
    settings.business_address,
  );
  return sendTransactionalEmail({
    kind: "admin_new_order",
    to,
    rendered,
    settings,
    orderId: order.id,
    orderNumber: order.orderNumber,
  });
}

// ── Unpaid-order alert (admin) ────────────────────────────────────────────────
/** What the owner needs to act on an order that has not been paid. */
export interface UnpaidOrderAlertContext {
  id: string;
  orderNumber: string;
  email: string;
  customerName: string;
  totalCents: number;
  currency: string;
  /** When the order was placed - the alert reports its age from this. */
  createdAt: Date;
  /** The provider's current view of the payment, shown verbatim so the owner
   *  can tell "never started" from "started but not settled". */
  paymentStatus: string;
  orderUrl: string;
}

/** Whole hours between the order and now, floored, never negative. */
export function orderAgeHours(createdAt: Date, now: Date = new Date()): number {
  const ms = now.getTime() - createdAt.getTime();
  return ms <= 0 ? 0 : Math.floor(ms / 3_600_000);
}

/** The store owner's alert that an order is still unpaid after the threshold.
 *  Deliberately factual: it states the age and the provider's status and links
 *  to the order - it does not claim the payment failed, because an unpaid
 *  invoice may simply be a shopper who has not got round to it yet. */
export function renderUnpaidOrderAlert(
  d: UnpaidOrderAlertContext,
  brand = "PetParcel",
  supportEmail = "support@petparcel.store",
  businessAddress = "1600 Pacific Ave, Dallas, TX 75201, USA",
): RenderedEmail {
  businessAddress = cleanAddress(businessAddress);
  const age = orderAgeHours(d.createdAt);
  const ageLabel = age >= 48 ? `${Math.floor(age / 24)} days` : `${age} hours`;
  const subject = `Still unpaid: order ${d.orderNumber} (${ageLabel} old)`;
  const body = `
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">Order still unpaid</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:${MUTED};">
          Order <strong style="color:${INK};">${esc(d.orderNumber)}</strong> has been waiting
          <strong style="color:${INK};">${esc(ageLabel)}</strong> and has not been paid.
        </p>
      </td></tr>
      <tr><td style="padding:16px 28px 0;">${button(d.orderUrl, "Open order")}</td></tr>
      <tr><td style="padding:24px 28px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;font-size:14px;color:${MUTED};">Customer</td>
              <td align="right" style="padding:4px 0;font-size:14px;color:${INK};font-weight:600;">${esc(d.customerName)} &lt;${esc(d.email)}&gt;</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:${MUTED};">Total</td>
              <td align="right" style="padding:4px 0;font-size:14px;color:${INK};font-weight:700;">${esc(formatMoney(d.totalCents, d.currency))}</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:${MUTED};">Payment status</td>
              <td align="right" style="padding:4px 0;font-size:14px;color:${INK};font-weight:600;">${esc(d.paymentStatus)}</td></tr>
          <tr><td style="padding:4px 0;font-size:14px;color:${MUTED};">Placed</td>
              <td align="right" style="padding:4px 0;font-size:14px;color:${INK};font-weight:600;">${esc(d.createdAt.toISOString().replace("T", " ").slice(0, 16))} UTC</td></tr>
        </table>
      </td></tr>`;
  const text = [
    `Order still unpaid`,
    ``,
    `Order ${d.orderNumber} has been waiting ${ageLabel} and has not been paid.`,
    ``,
    `Open order: ${d.orderUrl}`,
    ``,
    `  Customer: ${d.customerName} <${d.email}>`,
    `  Total: ${formatMoney(d.totalCents, d.currency)}`,
    `  Payment status: ${d.paymentStatus}`,
    `  Placed: ${d.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC`,
  ].join("\n");
  return {
    subject,
    html: shell(
      brand,
      subject,
      body,
      `Internal notification - an order on ${brand} is still unpaid.`,
    )
      .replace(/\{\{SUPPORT_EMAIL\}\}/g, esc(supportEmail))
      .replace(/\{\{BUSINESS_ADDRESS\}\}/g, esc(businessAddress)),
    text: [text, ``, `Questions? Write to ${supportEmail}.`, `${businessAddress}`].join("\n"),
  };
}

/** Alert the store owner that an order is still unpaid. Recipient is the single
 *  designated admin address (`ADMIN_EMAIL`) when set, else the store's support
 *  inbox. Never throws - the caller records the outcome either way. */
export async function sendUnpaidOrderAlertEmail(
  alert: UnpaidOrderAlertContext,
  settings: SettingsMap,
): Promise<SendResult> {
  const to = (designatedAdminEmail() ?? settings.contact_email ?? "").trim();
  if (!to) {
    return { status: "skipped", reason: "No admin address configured (set ADMIN_EMAIL)." };
  }
  const rendered = renderUnpaidOrderAlert(
    alert,
    settings.brand_name,
    settings.contact_email,
    settings.business_address,
  );
  return sendTransactionalEmail({
    kind: "unpaid_alert",
    to,
    rendered,
    settings,
    orderId: alert.id,
    orderNumber: alert.orderNumber,
    trigger: "unpaid_alert",
  });
}

export async function listEmailsForOrder(orderId: string): Promise<EmailLog[]> {
  return db
    .select()
    .from(emailLog)
    .where(eq(emailLog.orderId, orderId))
    .orderBy(desc(emailLog.createdAt));
}

export async function listRecentEmails(limit = 50): Promise<EmailLog[]> {
  return db.select().from(emailLog).orderBy(desc(emailLog.createdAt)).limit(limit);
}