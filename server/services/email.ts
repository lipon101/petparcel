// ── Transactional email — order confirmation + shipping notification ────────
//
// Rendered here, sent through Resend's HTTPS API with the platform's outbound
// HTTP primitive (never a raw provider SDK), and recorded in `email_log`.
//
// GRACEFUL DEGRADATION is the point of the status column. With no
// RESEND_API_KEY the store must neither crash nor quietly lose the fact that a
// customer was never told, so every attempt is written to `email_log` as:
//
//   sent     — Resend accepted it; `provider_message_id` holds the receipt
//   skipped  — no API key configured yet (the pre-setup state)
//   failed   — Resend refused or the request errored; `error` says why
//
// The admin order view reads that log, so "did the customer get their email?"
// has an answer that comes from the database rather than from hope.
import { desc, eq } from "drizzle-orm";
import { db } from "../_core/db";
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";
import { emailLog, type EmailLog } from "../../drizzle/schema";
import type { SettingsMap } from "../../shared/store";
import { formatMoney } from "../../shared/store";

export type EmailKind = "order_confirmation" | "shipping_notification";

export const EMAIL_KIND_LABEL: Record<EmailKind, string> = {
  order_confirmation: "Order confirmation",
  shipping_notification: "Shipping notification",
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
const TEAL = "#0e7a6d";
const TEAL_DARK = "#0a5f55";
const CORAL = "#e8654a";
const INK = "#1c2b2a";
const MUTED = "#6b7b79";
const CREAM = "#f6f1ea";
const LINE = "#e6e1d8";

const esc = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * `Name <local@domain>` — the form Resend (and every mail client) expects.
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
  // Not a usable address — hand it back raw so Resend's own error is what the
  // admin sees in `email_log.error`, not a silently mangled string.
  return addr;
}

/** Absolute URL for an in-app path. Falls back to the production domain when the
 *  caller (a server-side admin action) has no origin to hand. */
export function absoluteUrl(origin: string | null | undefined, path: string): string {
  const base = (origin ?? "").trim().replace(/\/+$/, "");
  return `${base || "https://www.petparcel.store"}${path}`;
}

// ── Shared shell ────────────────────────────────────────────────────────────
// Table-based with inline styles: email clients strip <style> blocks, and the
// newer ones are aggressive about it. 600px max width, single column, so it
// reflows cleanly on a phone.
function shell(brand: string, preheader: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(brand)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:${CREAM};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
      <tr><td style="background:${TEAL};padding:22px 28px;">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">🐾 ${esc(brand)}</span>
      </td></tr>
      ${body}
      <tr><td style="padding:22px 28px;background:#faf7f2;border-top:1px solid ${LINE};">
        <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${MUTED};">
          Questions? Reply to this email or write to ${esc("{{SUPPORT_EMAIL}}")}.
        </p>
        <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">
          ${esc("{{BUSINESS_ADDRESS}}")}
        </p>
      </td></tr>
    </table>
    <p style="margin:14px 0 0;font-size:11px;color:#9aa8a6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      You're receiving this because you placed an order with ${esc(brand)}.
    </p>
  </td></tr>
</table>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>
    <td style="background:${CORAL};border-radius:10px;">
      <a href="${esc(href)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(label)}</a>
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
  supportEmail = "hello@petparcel.store",
  businessAddress = "PetParcel LLC",
): RenderedEmail {
  const subject = `Order ${d.orderNumber} confirmed — thank you, ${d.customerName.split(" ")[0] || "friend"}!`;
  const body = `
      <tr><td style="padding:30px 28px 8px;">
        <h1 style="margin:0 0 8px;font-size:24px;line-height:1.25;font-weight:800;letter-spacing:-0.02em;">Thanks — your order is in! 🎉</h1>
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
        <h2 style="margin:0 0 4px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${TEAL_DARK};">Your order</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(d.lines, d.currency)}</table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">${totalsRows(d)}</table>
      </td></tr>
      <tr><td style="padding:26px 28px 30px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="50%" valign="top" style="padding-right:12px;">
            <h2 style="margin:0 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${TEAL_DARK};">Shipping to</h2>
            ${addressBlock(d)}
          </td>
          <td width="50%" valign="top">
            <h2 style="margin:0 0 6px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${TEAL_DARK};">Need help?</h2>
            <p style="margin:0;font-size:14px;line-height:1.6;color:${MUTED};">
              Reply to this email or write to ${esc(supportEmail)}.
            </p>
          </td>
        </tr></table>
      </td></tr>`;

  const text = [
    `Thanks — your order is in!`,
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
        `  ${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ""} — ${formatMoney(l.priceCents * l.qty, d.currency)}`,
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
    html: shell(brand, `Order ${d.orderNumber} is confirmed — we're getting it ready.`, body)
      .replace(/\{\{SUPPORT_EMAIL\}\}/g, esc(supportEmail))
      .replace(/\{\{BUSINESS_ADDRESS\}\}/g, esc(businessAddress)),
    text,
  };
}

export function renderShippingNotification(
  d: OrderEmailData,
  brand = "PetParcel",
  supportEmail = "hello@petparcel.store",
  businessAddress = "PetParcel LLC",
): RenderedEmail {
  const carrier = d.carrier || "the carrier";
  const subject = `Order ${d.orderNumber} is on its way 📦`;
  const trackingBlock = d.trackingNumber
    ? `<tr><td style="padding:4px 28px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};border-radius:12px;">
              <tr><td style="padding:16px 18px;">
                <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${TEAL_DARK};margin-bottom:6px;">Tracking</div>
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
        <h2 style="margin:0 0 4px;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:${TEAL_DARK};">In this parcel</h2>
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
    html: shell(brand, `Order ${d.orderNumber} has shipped — tracking inside.`, body)
      .replace(/\{\{SUPPORT_EMAIL\}\}/g, esc(supportEmail))
      .replace(/\{\{BUSINESS_ADDRESS\}\}/g, esc(businessAddress)),
    text,
  };
}

/** Deep link for the carrier, when we can build one. Only the carriers that
 *  publish a stable, predictable tracking URL get one — a guessed URL that
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
  const from = resolveFrom(settings.email_from_name, settings.email_from_address);
  const replyTo = (settings.email_reply_to ?? "").trim();

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
          providerId: status === "skipped" ? null : "resend",
          providerMessageId,
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

  const apiKey = env.email.resendApiKey;
  if (!apiKey) {
    // The documented pre-setup state: nobody is notified, and the store says so
    // rather than pretending. Add RESEND_API_KEY to switch sending on.
    return finish(
      "skipped",
      "RESEND_API_KEY is not set — add it in Settings → Environment variables to send order emails.",
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

// ── Admin read model ────────────────────────────────────────────────────────
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
