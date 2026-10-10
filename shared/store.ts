// Shared client↔server domain constants and helpers for PetParcel.

export const STORE_NAME = "PetParcel";
export const STORE_DOMAIN = "www.petparcel.store";
export const STORE_URL = `https://${STORE_DOMAIN}`;

// ── Order lifecycle ──────────────────────────────────────────────────────────
export const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  processing: "Packing your order",
  shipped: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/** Tailwind classes per status, used by both the customer and admin tables. */
export const ORDER_STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 ring-amber-200",
  paid: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  processing: "bg-sky-100 text-sky-800 ring-sky-200",
  shipped: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  delivered: "bg-teal-100 text-teal-800 ring-teal-200",
  cancelled: "bg-slate-100 text-slate-700 ring-slate-200",
  refunded: "bg-rose-100 text-rose-800 ring-rose-200",
};

/** The happy-path timeline shown to customers on the tracking page. */
export const ORDER_TIMELINE: OrderStatus[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
];

// ── Address snapshot stored on an order ──────────────────────────────────────
export interface AddressSnapshot {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
}

// ── Store settings ───────────────────────────────────────────────────────────
export interface SettingsMap {
  brand_name: string;
  tagline: string;
  announcement: string;
  hero_headline: string;
  hero_subhead: string;
  contact_email: string;
  contact_phone: string;
  support_hours: string;
  business_address: string;
  shipping_flat_cents: number;
  free_shipping_threshold_cents: number;
  tax_rate_bps: number;
  shipping_estimate: string;
  return_window_days: number;
  payment_provider: string;
  currency: string;
  email_from_name: string;
  email_from_address: string;
  email_reply_to: string;
}

export const SETTINGS_DEFAULTS: SettingsMap = {
  brand_name: "PetParcel",
  tagline: "Everything Your Pet Deserves.",
  // Honest, no-timeframe messaging: we ship fast with the best carrier available
  // and never promise a delivery window we can't guarantee.
  announcement: "Fast, tracked US shipping · 30-day returns · Real support",
  hero_headline: "Everything Your Pet Deserves.",
  hero_subhead:
    "Thoughtfully chosen beds, harnesses, feeders and toys for dogs and cats — the gear we'd put in our own homes. Shipped fast and tracked, with 30 days to change your mind.",
  contact_email: "hello@petparcel.store",
  contact_phone: "+1 (800) 555-0142",
  support_hours: "Mon–Fri, 9am–6pm EST",
  business_address: "PetParcel LLC, 1200 Market St, Wilmington, DE 19801, USA",
  shipping_flat_cents: 599,
  // 0 = no free-shipping tier. We don't advertise a threshold we'd have to
  // invent; shipping is a flat, clearly-shown rate. Set a value here to
  // re-enable a free-shipping threshold from the admin panel.
  free_shipping_threshold_cents: 0,
  tax_rate_bps: 0,
  shipping_estimate: "Fast, tracked delivery",
  return_window_days: 30,
  payment_provider: "2checkout",
  currency: "USD",
  email_from_name: "PetParcel",
  // Must be an address on a domain verified in Resend, or Resend refuses the send.
  email_from_address: "orders@petparcel.store",
  email_reply_to: "hello@petparcel.store",
};

export const SETTINGS_KEYS = Object.keys(SETTINGS_DEFAULTS) as (keyof SettingsMap)[];

/** Human labels + grouping for the admin settings form. */
export const SETTINGS_FIELDS: {
  key: keyof SettingsMap;
  label: string;
  hint?: string;
  type: "text" | "textarea" | "money" | "number" | "email";
  group: string;
}[] = [
  { key: "brand_name", label: "Brand name", type: "text", group: "Brand" },
  { key: "tagline", label: "Tagline", type: "text", group: "Brand" },
  { key: "announcement", label: "Announcement bar", hint: "Shown above the header. Empty hides it.", type: "text", group: "Brand" },
  { key: "hero_headline", label: "Hero headline", type: "text", group: "Brand" },
  { key: "hero_subhead", label: "Hero sub-headline", type: "textarea", group: "Brand" },
  { key: "contact_email", label: "Support email", type: "email", group: "Contact" },
  { key: "contact_phone", label: "Support phone", type: "text", group: "Contact" },
  { key: "support_hours", label: "Support hours", type: "text", group: "Contact" },
  { key: "business_address", label: "Business address", type: "textarea", group: "Contact" },
  { key: "shipping_flat_cents", label: "Flat shipping rate", hint: "Charged when the cart is below the free-shipping threshold.", type: "money", group: "Shipping & tax" },
  { key: "free_shipping_threshold_cents", label: "Free shipping over", type: "money", group: "Shipping & tax" },
  { key: "shipping_estimate", label: "Shipping message", hint: "Shown to customers. Keep it honest — avoid promising an exact delivery window.", type: "text", group: "Shipping & tax" },
  { key: "tax_rate_bps", label: "Tax rate (basis points)", hint: "0 = no tax. 825 = 8.25%.", type: "number", group: "Shipping & tax" },
  { key: "return_window_days", label: "Return window (days)", type: "number", group: "Shipping & tax" },
  { key: "currency", label: "Currency code", type: "text", group: "Shipping & tax" },
  { key: "email_from_name", label: "Email sender name", hint: "Shown as the sender on order emails.", type: "text", group: "Email (Resend)" },
  { key: "email_from_address", label: "Email from address", hint: "Must be on a domain you have verified in Resend, e.g. orders@petparcel.store.", type: "email", group: "Email (Resend)" },
  { key: "email_reply_to", label: "Reply-to address", hint: "Where customer replies land.", type: "email", group: "Email (Resend)" },
];

// ── Formatting helpers shared by client and server ───────────────────────────
export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  const value = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

/** URL-safe slug from a display name. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Parse a dollars string from a form field ("29.99") into integer cents.
 *  Returns null for blank or unparseable input so callers can branch on it. */
export function parseDollarsToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  const cleaned = String(input).replace(/[^0-9.]/g, "");
  // Nothing numeric survived — treat it as "no value" rather than silently $0.
  if (!/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Order numbers are short, uppercase and unambiguous (no O/0/I/1). */
export function newOrderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `PP-${out}`;
}

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"] as const;

/** Category nav order; unknown categories fall to the end alphabetically. */
export const CATEGORY_ORDER = ["Dogs", "Cats", "Feeding", "Grooming", "Travel & Outdoors"];

export function sortCategories(list: string[]): string[] {
  return [...list].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// Trust strip copy. Every line here is something we can actually stand behind:
// no invented delivery windows, no invented free-shipping thresholds, no
// unverifiable security badges.
export const TRUST_BADGES = [
  {
    title: "Fast, tracked shipping",
    body: "We ship quickly with the best carrier available, and every parcel is tracked door to door.",
  },
  { title: "30-day returns", body: "Didn't work out? Send it back within 30 days for a full refund." },
  {
    title: "Straightforward checkout",
    body: "Card details are handled by our payment provider — never by us.",
  },
  { title: "Real support", body: "Questions answered by people, not a bot." },
] as const;
