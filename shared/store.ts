// Shared client↔server domain constants and helpers for PetParcel.

export const STORE_NAME = "PetParcel";
export const STORE_DOMAIN = "www.petparcel.store";
export const STORE_URL = `https://${STORE_DOMAIN}`;

// ── Order lifecycle ─────────────────────────────────────────────────────────
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
  pending: "Pending payment",
  paid: "Paid",
  processing: "Preparing your parcel",
  shipped: "Shipped",
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

// ── Address snapshot stored on an order ─────────────────────────────────────
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

// ── Store settings ──────────────────────────────────────────────────────────
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
}

export const SETTINGS_DEFAULTS: SettingsMap = {
  brand_name: "PetParcel",
  tagline: "Happy pets, delivered to your door.",
  announcement: "Free US shipping on orders over $49 · 30-day happy-pet returns",
  hero_headline: "Everything your best friend needs",
  hero_subhead:
    "Vet-approved toys, beds, and gear for dogs and cats — shipped free across the USA from our US warehouses.",
  contact_email: "support@petparcel.store",
  contact_phone: "+1 (800) 555-0142",
  support_hours: "Mon–Fri, 9am–6pm EST",
  business_address: "PetParcel LLC, 1200 Market St, Wilmington, DE 19801, USA",
  shipping_flat_cents: 599,
  free_shipping_threshold_cents: 4900,
  tax_rate_bps: 0,
  shipping_estimate: "3–6 business days",
  return_window_days: 30,
  payment_provider: "2checkout",
  currency: "USD",
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
  { key: "shipping_estimate", label: "Delivery estimate", hint: "e.g. 3–6 business days", type: "text", group: "Shipping & tax" },
  { key: "tax_rate_bps", label: "Tax rate (basis points)", hint: "0 = no tax. 825 = 8.25%.", type: "number", group: "Shipping & tax" },
  { key: "return_window_days", label: "Return window (days)", type: "number", group: "Shipping & tax" },
  { key: "currency", label: "Currency code", type: "text", group: "Shipping & tax" },
];

// ── Formatting helpers shared by client and server ──────────────────────────
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

export const TRUST_BADGES = [
  { title: "Free US shipping", body: "On every order over $49, coast to coast." },
  { title: "30-day returns", body: "Not a hit with your pet? Send it back, no drama." },
  { title: "Secure checkout", body: "256-bit encrypted payments. We never store card data." },
  { title: "US-based support", body: "Real humans in Wilmington, DE — Mon–Fri, 9am–6pm EST." },
] as const;
