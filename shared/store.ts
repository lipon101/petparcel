// Shared client↔server domain constants and helpers for PetParcel.
import { stripSupplierMentions } from "./supplier-guard";

export const STORE_NAME = "PetParcel";
export const STORE_DOMAIN = "www.petparcel.store";
export const STORE_URL = `https://${STORE_DOMAIN}`;

// ── Inventory ───────────────────────────────────────────────────────────────
// The low-stock threshold is a PERSISTED store setting (`low_stock_threshold`
// in settings), so the owner can tune it from the admin panel and every surface
// - the dashboard "Low on stock" card, the admin Products list and the
// storefront stock messaging - reads the same value and can never disagree.
// This constant is only the DEFAULT / fallback (matching SETTINGS_DEFAULTS);
// runtime code should pass the live setting into `isLowStock`. The store
// back-orders nothing, so this is purely a reorder/urgency signal.
export const LOW_STOCK_THRESHOLD = 10;

/** The sane range for the low-stock threshold setting. A value outside it is
 *  clamped rather than trusted, so a typo (0, -3, 99999) can never flag every
 *  product as low - or none at all. */
export const LOW_STOCK_MIN = 1;
export const LOW_STOCK_MAX = 500;

/** Coerce any incoming value into a valid low-stock threshold. A number is
 *  rounded and clamped into [LOW_STOCK_MIN, LOW_STOCK_MAX]; a form STRING is
 *  accepted only when it is genuinely numeric; blank or unparseable input falls
 *  back to the default (never to 0, which would flag nothing... or to a
 *  clamp-to-minimum, which would flag everything). */
export function normalizeLowStockThreshold(value: unknown, fallback = LOW_STOCK_THRESHOLD): number {
  const clamp = (n: number) => Math.min(LOW_STOCK_MAX, Math.max(LOW_STOCK_MIN, Math.round(n)));
  if (typeof value === "number") return Number.isFinite(value) ? clamp(value) : fallback;
  const cleaned = String(value ?? "").trim();
  if (cleaned === "") return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? clamp(n) : fallback;
}

/** Is this quantity at or below the low-stock threshold? Prefer passing the
 *  live setting; the default keeps existing call sites correct. */
export function isLowStock(quantity: number, threshold: number = LOW_STOCK_THRESHOLD): boolean {
  return quantity <= normalizeLowStockThreshold(threshold);
}

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
  /** At or below this many units a variant is flagged "low on stock". Owner-
   *  editable in Settings; drives the dashboard, the products list and the
   *  storefront from one source of truth. */
  low_stock_threshold: number;
  payment_provider: string;
  currency: string;
  email_from_name: string;
  email_from_address: string;
  email_reply_to: string;
  /** Admin-selected product id for the home page "Just landed" promo card.
   *  Empty string = no explicit pick; the storefront falls back to the newest
   *  product so the card never renders empty. */
  promo_new_arrivals_product_id: string;
  /** Admin-selected product id for the home page "Most reordered" promo card.
   *  Empty string = no explicit pick; falls back to the most-ordered product. */
  promo_best_sellers_product_id: string;
  /** The home page "Our featured picks" rail, as a comma-separated list of
   *  product ids in the owner's chosen order. Empty = no explicit picks, so the
   *  rail falls back to the products flagged `featured`, then the newest. */
  featured_pick_ids: string;
}

export const SETTINGS_DEFAULTS: SettingsMap = {
  brand_name: "PetParcel",
  tagline: "Pet supplies for every pet, shipped across the USA.",
  // Honest, no-timeframe messaging: we ship fast with the best carrier available
  // and never promise a delivery window we can't guarantee.
  announcement: "Fast, tracked US shipping · 30-day returns · Support Mon-Fri, 9am-6pm EST",
  // The home hero's own headline; also the store's brand line, used by the admin
  // panel and anywhere a single-sentence pitch is needed.
  hero_headline: "Everything your pet needs, all in one place",
  hero_subhead:
    "From food and treats to beds, crates, harnesses, toys and grooming, we stock the everyday pet supplies dog, cat, bird, fish and small-pet owners reach for. Fast, tracked shipping across the USA and 30-day returns.",
  contact_email: "support@petparcel.store",
  contact_phone: "+1 (800) 555-0142",
  support_hours: "Mon-Fri, 9am-6pm EST",
  business_address: "1600 Pacific Ave, Dallas, TX 75201, USA",
  // Realistic US small-parcel economics, charged ONCE PER ORDER (never per item),
  // so a multi-item cart is consolidated into a single tracked shipment - the
  // standard practice that neither overcharges the customer nor leaves the store
  // absorbing the carrier cost on a single cheap item.
  //   - $6.99 flat covers one tracked US small-parcel shipment, on every order.
  //   - NO free-shipping tier: `0` means the flat rate is what every order is
  //     charged. The store's published policy is "flat $6.99 shipping and returns
  //     are free", so a free-over-$X tier would contradict the policy page, the
  //     product pages and the Merchant Center shipping settings at once. A
  //     positive value here re-introduces that contradiction - do not set one
  //     without changing the policy copy in the same commit.
  shipping_flat_cents: 699,
  free_shipping_threshold_cents: 0,
  tax_rate_bps: 0,
  shipping_estimate: "Tracked delivery, 5-9 business days after dispatch",
  return_window_days: 30,
  low_stock_threshold: LOW_STOCK_THRESHOLD,
  payment_provider: "nowpayments",
  currency: "USD",
  email_from_name: "PetParcel",
  // Must be an address on a domain verified in Resend, or Resend refuses the send.
  email_from_address: "orders@petparcel.store",
  email_reply_to: "support@petparcel.store",
  // No explicit promo pick by default - the home page cards fall back to the
  // newest / most-ordered product until the owner chooses one in the admin panel.
  promo_new_arrivals_product_id: "",
  promo_best_sellers_product_id: "",
  // No explicit featured picks by default - the home rail falls back to the
  // products flagged `featured`, then the newest, until the owner chooses.
  featured_pick_ids: "",
};

/**
 * Every store-settings key the application actually reads.
 *
 * A `store_settings` row is only ever looked up by key, so a row whose key is
 * not in `SettingsMap` is dead: nothing can render it, and the admin panel - 
 * which is built from the same map - cannot edit it back into use. The deploy
 * reconciler retires exactly those, and this is the list it compares against.
 *
 * Typed as `SettingsMap`, so the compiler is what guarantees that the defaults
 * cover every key the code can ask for; adding a field to the interface without
 * a default fails the build rather than silently making the new key look dead.
 */
export function plannedSettingKeys(): string[] {
  return Object.keys(SETTINGS_DEFAULTS);
}

/** The store's postal address, normalised for display.
 *
 *  The address appears in the footer, on the contact page, in the policy pages
 *  and in the order emails. It must always read as the bare address - never with
 *  the brand name glued on the front - and always on a single line. Older rows
 *  in the settings table may still carry a "PetParcel, " prefix from a previous
 *  default, so every render site runs the value through here instead of trusting
 *  the stored string. */
export function cleanAddress(address: string | null | undefined): string {
  return String(address ?? "")
    .replace(/^\s*PetParcel\s*,\s*/i, "")
    .trim();
}

/** The top announcement strip, normalised for display.
 *
 *  The strip is a single line of copy. Support is answered by people during the
 *  store's stated business hours (Mon-Fri, 9am-6pm EST), so the strip says that
 *  rather than claiming round-the-clock cover the store does not staff. A
 *  settings row written before this change can still hold the retired "24/7
 *  Support" / "Real support" wording, and because the header renders the stored
 *  value verbatim that stale string would keep appearing on the live site no
 *  matter what the code default says. Every render site therefore runs the value
 *  through here, which rewrites the retired wording to the current one and
 *  collapses any stray whitespace - so the strip can only ever show the single,
 *  current line. */
export function cleanAnnouncement(value: string | null | undefined): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return SETTINGS_DEFAULTS.announcement;
  return text
    .replace(/\bReal\s+support\b/gi, "Support Mon-Fri, 9am-6pm EST")
    .replace(/\b24\s*\/\s*7\s+Support\b/gi, "Support Mon-Fri, 9am-6pm EST");
}

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
  { key: "shipping_estimate", label: "Shipping message", hint: "Shown to customers. Keep it honest - avoid promising an exact delivery window.", type: "text", group: "Shipping & tax" },
  { key: "tax_rate_bps", label: "Tax rate (basis points)", hint: "0 = no tax. 825 = 8.25%.", type: "number", group: "Shipping & tax" },
  { key: "return_window_days", label: "Return window (days)", type: "number", group: "Shipping & tax" },
  { key: "low_stock_threshold", label: "Low-stock threshold", hint: "A variant at or below this many units is flagged low on stock, everywhere. 1-500.", type: "number", group: "Inventory" },
  { key: "featured_pick_ids", label: "Featured picks", hint: "Comma-separated product ids for the home page featured rail. Managed on the Featured picks page.", type: "text", group: "Home page" },
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
  // Nothing numeric survived - treat it as "no value" rather than silently $0.
  if (!/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A premium, human display name for an account.
 *
 * The raw handle (`petparcel`, `bubt1337`) is not something to show a customer.
 * This prefers, in order: the profile's full name, the account's `name`, then a
 * title-cased version of the email local-part - so "petparcel" renders as
 * "Petparcel" and "harry.potter" as "Harry Potter". It is derived from the REAL
 * record, never hardcoded, and falls back to a neutral greeting when there is
 * nothing to show.
 */
export function displayName(input: {
  fullName?: string | null;
  name?: string | null;
  email?: string | null;
}): string {
  const full = input.fullName?.trim();
  if (full) return full;
  const name = input.name?.trim();
  if (name) return name;
  const local = input.email?.split("@")[0]?.trim();
  if (!local) return "there";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

/** Category nav order; unknown categories fall to the end alphabetically.
 *
 *  This is the store's REAL browse taxonomy - the ten top-level aisles the
 *  supplier catalogue declares (see shared/category-tree.ts), which is what the
 *  browse tree, the header search menu and the footer actually render. Keeping
 *  this list in step with that tree is what stops a real aisle from being ranked
 *  as an unknown name, and what lets the featured rail below name the aisles the
 *  store genuinely stocks. */
export const CATEGORY_ORDER = [
  // The real supplier aisles the browse tree renders today, in the store's
  // chosen browse order.
  "Pet Furnitures",
  "Pet Outdoor Supplies",
  "Pet Bedding",
  "Pet Toys",
  "Pet Drinking & Feeding",
  "Pet Collars, Harnesses & Accessories",
  "Pet Groomings",
  "Pet Apparels",
  "Bird Supplies",
  "Fish & Aquatic Pets",
  // Legacy aisles from the store's earlier pet-niche taxonomy. Kept LAST so a
  // real aisle always outranks an unused legacy name, and kept at all so a row
  // that still carries one is ranked as KNOWN rather than dumped to the
  // alphabetical tail.
  "Dogs",
  "Cats",
  "Food & Treats",
  "Beds & Furniture",
  "Crates & Carriers",
  "Collars, Leashes & Harnesses",
  "Apparel",
  "Grooming",
  "Health & Supplements",
  "Feeders & Fountains",
  "Litter & Litter Boxes",
  "Toys",
  "Training",
  "Travel",
  "Aquatics",
  "Small Pets",
  "Birds",
];

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

/** A row in the storefront's browse tree: a top-level aisle with the
 *  subcategories filed under it.
 *
 *  Shared (rather than declared on either side) because it crosses the wire:
 *  `catalog.categories` returns this shape and the shop page, the header menus
 *  and the admin pickers all consume it. `productCount` on an AISLE is the
 *  ROLL-UP of its own products plus its subcategories', so an aisle that holds
 *  nothing directly still reads as stocked when its children do. */
export interface StoreCategoryNode {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  featured: boolean;
  children: StoreCategoryChild[];
}

/** A subcategory within a `StoreCategoryNode`. */
export interface StoreCategoryChild {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

/** How many categories a condensed surface shows before offering the full list.
 *
 *  The search control, the header menu, the mobile drawer's category tab and the
 *  home roundels all cap at this number, laid out as a responsive multi-column
 *  grid so five reads as a considered selection rather than a wall - and every
 *  one of them links on to the complete list on the shop page.
 */
export const FEATURED_CATEGORY_COUNT = 5;

/** Tie-break order for the condensed surfaces, best-first.
 *
 *  This is only the tie-break for the UNNAMED tail: the named aisles below always
 *  come first, in the order declared here, and a live count only decides between
 *  the aisles the store stocks but has not named. That is what keeps the row
 *  stable - it is identical on the first paint (bundled counts) and after the
 *  server's counts land, instead of reordering itself a moment after it appears.
 *  These five are the deepest shelves in the bundled catalog, so the row is the
 *  best of what the store actually stocks. Anything not named here simply ranks
 *  behind these on a tie, and the complete taxonomy stays one click away behind
 *  the "All categories" tile. */
export const FEATURED_CATEGORY_ORDER = [
  "Pet Furnitures",
  "Pet Outdoor Supplies",
  "Pet Bedding",
  "Pet Toys",
  "Pet Drinking & Feeding",
] as const;

/** How many categories the FOOTER's Shop column lists.
 *
 *  The footer used to print the whole taxonomy, which ran to fifteen rows and
 *  read as a wall of links beside the three short columns next to it. It now
 *  shows the best handful the roundel rail does, over an "All products" link,
 *  and the complete list stays one click away on the shop page - so nothing is
 *  hidden, only summarised. Kept one shorter than the rail so the footer reads
 *  as a summary of it rather than a second copy. */
export const FOOTER_CATEGORY_COUNT = 4;

/** The best `limit` categories for a condensed surface, most-stocked first.
 *
 *  The names in `FEATURED_CATEGORY_ORDER` come first, in that order; `counts`
 *  then ranks whatever is left, so an aisle the store stocks but has not named
 *  still earns a slot over one it holds nothing in. `CATEGORY_ORDER` breaks a
 *  remaining tie. Omit `counts` and the unnamed tail simply falls back to catalog
 *  order. */
export function topCategories(
  categories: string[],
  limit = FEATURED_CATEGORY_COUNT,
  counts?: Record<string, number>,
): string[] {
  // De-duplicate first: the API and the bundled catalog are both unfiltered
  // sources, and a repeated name would otherwise take two of the slots.
  const catalogRank = sortCategories(Array.from(new Set(categories)));
  const featuredRank = (c: string) => {
    const i = (FEATURED_CATEGORY_ORDER as readonly string[]).indexOf(c);
    return i === -1 ? FEATURED_CATEGORY_ORDER.length : i;
  };
  // A NAMED aisle always outranks an unnamed one, and among the named ones the
  // declared order is final. A live stock count therefore only decides between
  // aisles the store sells but has not named, so a new supplier shelf can earn a
  // slot without a single extra product displacing one of the names the row was
  // designed around. That is also what keeps the row identical between the first
  // paint (bundled counts) and the settled paint (server counts), instead of
  // quietly reordering itself a moment after it appears.
  const ranked = [...catalogRank].sort(
    (a, b) =>
      featuredRank(a) - featuredRank(b) ||
      (counts?.[b] ?? 0) - (counts?.[a] ?? 0) ||
      catalogRank.indexOf(a) - catalogRank.indexOf(b),
  );
  return ranked.slice(0, Math.max(0, limit));
}

// Trust strip copy. Every line here is something we can actually stand behind:
// no invented delivery windows, no invented free-shipping thresholds, no
// unverifiable security badges.
export const TRUST_BADGES = [
  {
    title: "Fast, tracked shipping",
    body: "Shipped fast with the best carrier for your address, tracked the whole way.",
  },
  { title: "30-day returns", body: "Changed your mind? Send it back within 30 days for a full refund - returns are free." },
  {
    title: "Straightforward checkout",
    body: "Your card details go to our payment provider, never to us.",
  },
  { title: "Support Mon-Fri", body: "Mon-Fri, 9am-6pm EST - reach us by email or phone." },
] as const;

/** The four-promise strip on a product page.
 *
 *  Deliberately narrower than the home page's benefits: a shopper who has
 *  already opened a product is deciding whether to buy THIS item now, so these
 *  are the four things that unblock that decision - when it ships, that paying
 *  is safe, that returning it is easy, and that it arrives properly packed.
 *
 *  Each line stays inside what the store can actually honour: shipping and
 *  returns read their real values from store settings, so a change in the admin
 *  panel flows through to this strip (see `productTrustStrip`). */
export const PRODUCT_TRUST = [
  { key: "shipping", title: "Tracked Shipping", body: "Tracked the whole way, at a flat rate shown at checkout." },
  { key: "payment", title: "Secure Payment", body: "Your card details go to our payment provider, never to us." },
  { key: "returns", title: "Easy Returns", body: "Changed your mind? Send it back within 30 days for a full refund - returns are free." },
  { key: "packaging", title: "Careful Packaging", body: "Packed with care so it arrives ready to use." },
] as const;

export type ProductTrustKey = (typeof PRODUCT_TRUST)[number]["key"];

/** The one sentence a product page uses to say what shipping costs.
 *
 *  A single source of truth, so the buy box, the trust strip and the Shipping
 *  & Returns tab can never disagree: a POSITIVE threshold is a real free-over
 *  tier, and `0` means the store has NO free tier - the flat rate is what every
 *  order is charged. Read the other way round, that inverted rule put "Free
 *  shipping on every order" on live product pages while checkout charged the
 *  flat rate, which is exactly the contradiction this helper exists to prevent. */
export function productShippingLine(settings: {
  free_shipping_threshold_cents: number;
  shipping_flat_cents: number;
}): string {
  return settings.free_shipping_threshold_cents > 0
    ? `Free shipping on orders over ${formatMoney(settings.free_shipping_threshold_cents)}, tracked door to door with the best carrier for your address.`
    : `A flat ${formatMoney(settings.shipping_flat_cents)} covers shipping, tracked door to door with the best carrier for your address.`;
}

/** The product-page trust strip with the live store settings folded in, so the
 *  shipping and return promises on a product page match the real policy instead
 *  of a hard-coded number that drifts when the admin edits it. */
export function productTrustStrip(settings: {
  free_shipping_threshold_cents: number;
  shipping_flat_cents: number;
  return_window_days: number;
  shipping_estimate: string;
}): { key: ProductTrustKey; title: string; body: string }[] {
  // `free_shipping_threshold_cents === 0` means the store has NO free-shipping
  // tier (see SETTINGS_DEFAULTS): shipping is a flat, clearly-shown rate. So the
  // flat rate is what we state - never "free", which the store does not offer.
  // A positive threshold is a real free-over-$X tier and is stated as such.
  const shipBody =
    settings.free_shipping_threshold_cents > 0
      ? `Free over ${formatMoney(settings.free_shipping_threshold_cents)}, tracked the whole way.`
      : `${formatMoney(settings.shipping_flat_cents)} flat across the USA, tracked the whole way.`;
  return PRODUCT_TRUST.map((item) => {
    if (item.key === "shipping") return { ...item, body: shipBody };
    if (item.key === "returns") {
      return {
        ...item,
        body: `Changed your mind? Send it back within ${settings.return_window_days} days for a full refund - returns are free.`,
      };
    }
    return { ...item };
  });
}

/** The line under the price that summarises the product in one sentence, so a
 *  shopper who reads nothing else still knows what they are looking at. Cut at
 *  the first sentence of the description rather than on a character count, so it
 *  never trails off mid-word. */
export function oneLineSummary(description: string): string {
  const trimmed = stripMarkdown(description).trim();
  if (!trimmed) return "";
  const firstStop = trimmed.search(/\.\s/);
  const first = firstStop === -1 ? trimmed : trimmed.slice(0, firstStop + 1);
  return first.length <= 180 ? first : `${first.slice(0, 177).trimEnd()}...`;
}

// ── The product page's ONE short line ─────────────────────────────────────────
// WHAT THIS REPLACES AND WHY. The line under the price used to be the first
// sentence of the product description (`oneLineSummary` above). That is fine for
// hand-written copy, but this store's descriptions open with the supplier's own
// title, which runs to ~200 characters - so the "first sentence" was itself
// ~180 characters and could not fit ONE line on a phone. It wrapped to two,
// three or four rows inside an already-tight buy box, which is what made the
// product page read as cramped and pushed the layout around.
//
// Shortening it by hand for 98 products would rot the moment a product was
// added, so the line is DERIVED from two fields every product already has: its
// category and its material. A product created tomorrow therefore gets a
// correct short line with no edit at all.
//
// NOTHING IS INVENTED. Both parts are real stored values. A part is DROPPED
// rather than padded when it is missing, generic ("Others" is the supplier's
// own placeholder, not a material) or long enough that the line would stop
// fitting one row - which is why the bound below exists.

/** A part of the short line may not exceed this many characters. 22 keeps the
 *  composed line (at most two parts plus the separator) inside 46 characters,
 *  which renders on ONE row even at a 320px viewport - see the measured
 *  assertion in `scripts/verify-ui-fixes.mjs`. */
export const SHORT_LINE_PART_MAX = 22;

/** The bound when only ONE part survives and therefore carries the whole line.
 *  It may run longer than {@link SHORT_LINE_PART_MAX} because it is alone: the
 *  line is still the same length or shorter than a two-part line built from two
 *  maximum-length parts.
 *
 *  Set from a MEASUREMENT, not a guess. In a real headless Chromium at 14.5px,
 *  the worst real line this produces is 224px of text inside a 285.8px buy box
 *  at a 320px viewport - about 78%, with the rest of the three-part budget still
 *  free. `work/measure-short-lines.ts` is the script that produced that number
 *  against all 98 real products, and it is re-runnable. */
export const SHORT_LINE_SINGLE_MAX = 44;

/** The derived line's fallback, used only when a product has neither a usable
 *  category nor a usable material. Deliberately a plain statement of what the
 *  store sells rather than a claim about the item. */
export const SHORT_LINE_FALLBACK = "Everyday pet supplies";

/** The separator between the two parts. A middot, not a hyphen: it reads as a
 *  pair of attributes rather than a compound word. */
export const SHORT_LINE_SEPARATOR = " · ";

/** A category's short form: collapse whitespace and strip the generic "Pet"/
 *  "Dog"/"Cat" prefix the catalogue uses on nearly every category, so the line
 *  spends its characters on the distinguishing word ("Towels", "Training Pads &
 *  Diapers") instead of on "Pet" repeated. Left alone when stripping would leave
 *  nothing, and dropped entirely when still over `max`. */
function shortCategoryToken(raw: string | null | undefined, max = SHORT_LINE_PART_MAX): string {
  const collapsed = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return "";
  const stripped = collapsed.replace(/^(pets?|dogs?|cats?|birds?|fish)\s+/i, "").trim();
  const token = stripped || collapsed;
  return token.length <= max ? token : "";
}

/** A material's short form. The stored value is either a plain string or a JSON
 *  array of supplier tags (`["Cloth"]`, `["Plastic","Leather"]`), so the first
 *  tag is unwrapped. The supplier's own "Others" tag carries no information and
 *  is treated as absent, as is any value too long to keep the line on one row. */
function shortMaterialToken(
  raw: string | null | undefined,
  max = SHORT_LINE_PART_MAX,
): string {
  let value = String(raw ?? "");
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) value = String(parsed[0] ?? "");
  } catch {
    /* a plain string, not a JSON array - use it as-is */
  }
  const collapsed = value
    .replace(/\s+/g, " ")
    .replace(/^[\s"'\[]+|[\s"'\]]+$/g, "")
    .trim();
  if (!collapsed || isMeaninglessPart(collapsed)) return "";
  return collapsed.length <= max ? collapsed : "";
}

/**
 * The single short line the product page prints under the price.
 *
 * Bounded by construction, so it always renders on exactly one row. The line is
 * a category token plus a material token where both are usable, and otherwise a
 * single token, which is allowed a longer budget because it is alone. Callers
 * pair it with `.pd-short` in `client/src/index.css`, which pins it to one row.
 *
 * The two-pass structure is what keeps the line INFORMATIVE as well as short:
 * a product in a long-named category whose material value is useless (the
 * supplier's "Others" placeholder) would otherwise have both parts dropped and
 * fall back to a line that says nothing about the product. Retrying the category
 * alone rescues those, using the wider single-part budget the measurement above
 * shows is available.
 */
export function productShortLine(
  product:
    | {
        category?: string | null;
        specs?: { materials?: string | null; keyAttribute?: string | null } | null;
        /** The product's real option values (variant option text), used ONLY as
         *  the last resort for the key attribute when the specs do not carry one. */
        optionValues?: readonly string[] | null;
      }
    | null
    | undefined,
): string {
  const category = shortCategoryToken(product?.category);
  const material = shortMaterialToken(product?.specs?.materials);

  // Both parts are usable at the two-part budget: the line is their pair.
  if (category && material) return [category, material].join(SHORT_LINE_SEPARATOR);

  // One or both dropped. The product's own STATED key attribute fills the second
  // half, or carries the line alone. This keeps the line INFORMATIVE for the
  // large share of the catalogue whose material is the supplier's "Others"
  // placeholder - but ONLY when that attribute is not a value the buy box already
  // draws, because repeating one of those is what made the line duplicate the
  // option row below it. See `shortAttributeToken`.
  const alone = category || material ? [category || material] : [];
  const keyAttribute = shortAttributeToken(
    product?.specs?.keyAttribute,
    product?.optionValues,
    alone.length > 0 ? SHORT_LINE_PART_MAX : SHORT_LINE_SINGLE_MAX,
  );
  if (keyAttribute) {
    return alone.length > 0
      ? [alone[0], keyAttribute].join(SHORT_LINE_SEPARATOR)
      : keyAttribute;
  }
  if (alone.length > 0) return alone[0];

  // Neither a usable part nor a real attribute. A part that was dropped only for
  // being over the two-part budget may still fit alone, using the wider
  // single-part budget the measurement shows is available.
  const wider = [
    shortCategoryToken(product?.category, SHORT_LINE_SINGLE_MAX),
    shortMaterialToken(product?.specs?.materials, SHORT_LINE_SINGLE_MAX),
  ].filter(Boolean);
  return wider.length > 0 ? wider[0] : SHORT_LINE_FALLBACK;
}

/** Normalise an option value to a comparable key: case-, punctuation- and
 *  whitespace-insensitive, so the supplier's shouted "PINK" and the canonical
 *  "Pink" are recognised as the SAME option value. */
function optionKey(value: string): string {
  return collapse(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** A product's key attribute stated short, or "" when there is no honest one.
 *
 *  It reads the product's own STATED attribute only. The product's real OPTION
 *  VALUES are deliberately never used as content: the buy box draws them itself -
 *  one control per value when the product has a choice, or the single
 *  configuration row when it does not - so a line built from one of them printed
 *  the SAME string twice on one page ("Pink" under the price and "Pink" again as
 *  the option row), which reads as the page contradicting itself. Worse, it
 *  presented ONE of several choices as though it were the product's own property
 *  (the anti-bark collar's line read "Black" while the real choice is
 *  Black / White).
 *
 *  A stated attribute that merely repeats a value the picker draws is skipped for
 *  the same reason. What is left - a genuine attribute the buy box does not state
 *  - is real extra information, and that is what the line is for. Never a
 *  placeholder, and never a compound value sliced into nonsense. */
function shortAttributeToken(
  stated: string | null | undefined,
  optionValues: readonly string[] | null | undefined,
  max: number,
): string {
  const drawn = new Set((optionValues ?? []).map(optionKey).filter(Boolean));
  const direct = collapse(stated);
  if (!direct || direct.length > max || !isSingleAttribute(direct)) return "";
  // The picker prints this very string, so the line must not repeat it.
  if (drawn.has(optionKey(direct))) return "";
  return tidyCase(direct);
}

/** The supplier shouts ("BLACK", "BROWN"); a lone ALL-CAPS word of four or more
 *  letters is its colour written in capitals, so it is spelled properly for the
 *  shopper. Shorter tokens are left alone because they are real size labels
 *  ("XL", "XXL"), which must never become "Xl". */
function tidyCase(value: string): string {
  if (!/^[A-Z]{4,}$/.test(value)) return value;
  return value[0] + value.slice(1).toLowerCase();
}

/** Is this text ONE attribute rather than several run together? A key attribute
 *  is a single value such as "Red" or "Light Pink". A compound label like
 *  "BLUE-M 100x50cm" is a colour AND a size at once, so it is not an attribute
 *  and is rejected rather than printed whole or sliced. */
function isSingleAttribute(value: string): boolean {
  if (!value) return false;
  // A value that tells a shopper NOTHING is not an attribute: the supplier's
  // "Others", a syntactic placeholder ("Standard"), a bare pack size ("2 pcs",
  // the supplier's QTY dimension rather than a quality of THIS product) and the
  // supplier's own internal code ("7018NATURAL"). Without this the derived line
  // printed "Hair Removers & Combs . Standard" and "Furniture Tools .
  // 7018NATURAL" - real stored values, but not ones a shopper can read.
  if (isMeaninglessPart(value)) return false;
  // A lone character is a supplier's row code, not an attribute ("A", "B") -
  // unless it is a real garment size ("S", "M", "L"), which IS an attribute.
  if (value.length === 1 && !/^[sml]$/i.test(value)) return false;
  // A measurement anywhere ("100x50cm", "18.5 in") makes it more than a name.
  if (/\d+\s*(?:x|\u00d7)\s*\d+/i.test(value)) return false;
  if (/\d+(?:\.\d+)?\s*(?:cm|mm|in|inch|inches|ft|kg|g|lb|lbs|oz|ml|l)\b/i.test(value)) return false;
  // A short, word-like value only - no long run of prose.
  if (value.split(/\s+/).length > 3) return false;
  if (value.length > 24) return false;
  return /^[\p{L}\p{N}][\p{L}\p{N}\s./&+-]*$/u.test(value);
}

/** Words that name NO choice a shopper is making: the supplier's own
 *  placeholders and the store's seeded "Standard". */
const PLACEHOLDER_PART =
  /^(standards?|defaults?|default title|no variation|none|n\/?a|as shown|as pic|regular|one ?size|universal|options?|variations?|other|others)$/i;

/** The supplier's QTY dimension as a bare value ("2 pcs", "1pack", "3 sets"):
 *  a PACK SIZE, not a quality of the product, so it never belongs on the short
 *  line however cheap its characters are. */
const PACK_COUNT_PART =
  /^\d+\s*(?:pcs?|pieces?|packs?|box(?:es)?|sets?|pairs?|units?|ct|count|pods?|bags?)\b/i;

/** The supplier's internal code fused into one run ("7018NATURAL",
 *  "CJ7KHPLFMSHY"): letters AND digits in a single unbroken token of four or
 *  more characters. A real attribute is a word ("Black") or a measurement
 *  ("100x50cm"), and a measurement is rejected by the rules below regardless. */
const CODE_RUN_PART = /^(?=.{4,}$)(?=.*[0-9])(?=.*[A-Za-z])[A-Za-z0-9]+$/;

/** Does this text carry no information about the product at all? */
function isMeaninglessPart(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  return PLACEHOLDER_PART.test(v) || PACK_COUNT_PART.test(v) || CODE_RUN_PART.test(v);
}

/** Collapse whitespace and trim stray quotes/brackets (the stored spec values
 *  are sometimes JSON-ish). */
function collapse(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/^[\s"'[\]]+|[\s"'[\]]+$/g, "")
    .trim();
}

// ── Product copy ────────────────────────────────────────────────────────────
// Supplier copy arrives as a single string that may still carry light markdown
// (`**Bold**: text` runs, `- ` bullets) and HTML entities. A shopper must never
// see a raw asterisk, so every surface that prints product copy runs it through
// here first. The parser is deliberately forgiving: it accepts the clean
// bullet form the catalog now stores AND the legacy inline form, so an
// admin-pasted description is rendered properly rather than dumped verbatim.

/** Decode the handful of HTML entities supplier copy actually contains. */
function decodeCopyEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "\u2019")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013");
}

/** Strip inline markdown emphasis and decode entities, leaving plain prose.
 *  Supplier mentions are removed first, so no surface that prints product copy
 *  can ever name the supplier - even a row an admin pasted by hand. */
export function stripMarkdown(input: string): string {
  return stripSupplierMentions(decodeCopyEntities(String(input ?? "")))
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(?!\s)(.+?)(?<!\s)\*(?=\s|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** A product description split into the shape a modern sales page renders:
 *  intro paragraphs, a list of key features, and closing paragraphs. */
export interface ProductCopy {
  paragraphs: string[];
  features: string[];
}

/** Parse a product description into paragraphs + key features.
 *
 *  Two input shapes are handled, and both end up as the same structure:
 *   1. the clean form the catalog stores - prose paragraphs, then a block of
 *      `- Feature: detail` lines;
 *   2. the legacy supplier form - one paragraph with `**Feature**: detail` runs
 *      inline. Each run becomes a feature; the prose around them stays prose.
 *
 *  Nothing is invented: every feature line is text that was already in the
 *  description, just lifted out of the wall of copy. */
export function parseProductCopy(description: string): ProductCopy {
  const text = decodeCopyEntities(String(description ?? ""))
    .replace(/\r\n/g, "\n")
    .replace(/[\u2014\u2013]/g, "-");
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const paragraphs: string[] = [];
  const features: string[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const bullets = lines.filter((l) => /^[-*\u2022]\s+/.test(l));
    if (bullets.length > 0 && bullets.length === lines.length) {
      for (const b of bullets) features.push(stripMarkdown(b.replace(/^[-*\u2022]\s+/, "")));
      continue;
    }
    // Legacy inline form: split on `**Title**` runs, keeping the prose between.
    const parts = block.split(/\*\*(.+?)\*\*/g);
    if (parts.length > 1) {
      const lead = stripMarkdown(parts[0]);
      if (lead) paragraphs.push(lead);
      for (let i = 1; i < parts.length; i += 2) {
        const title = stripMarkdown(parts[i] ?? "");
        const body = stripMarkdown(parts[i + 1] ?? "").replace(/^[\s:.\-]+/, "");
        if (title) features.push(body ? `${title}: ${body}` : title);
      }
      continue;
    }
    paragraphs.push(stripMarkdown(block));
  }

  return { paragraphs, features };
}

/** How many tiles the product gallery's rail shows.
 *
 *  The rail holds the product's REAL shots - the picked option's own photograph
 *  first, then the product's photographs - so a product with more photographs
 *  than this shows the ones it has, and a product with fewer is filled by
 *  repeating one of its own (never an invented URL, never a placeholder
 *  graphic). The tiles themselves are built by `client/src/lib/gallery-tiles.ts`. */
export const GALLERY_SIZE = 5;

/** A representative photo for each category, one image per category.
 *
 *  Used for the promo pair's art. Products in this catalog legitimately share
 *  photos (a toy's picture is reused by a training clicker, a litter box's by
 *  training pads), so picking each category's first product independently is not
 *  enough to keep two adjacent tiles from looking identical.
 *
 *  Each category in rank order therefore takes the first of its own products
 *  whose photo is still unclaimed, and a category whose photos have all been
 *  taken returns nothing. One walk of the ranked list, no invented image, and no
 *  two tiles alike. */
export function roundelImages(
  rankedCategories: string[],
  products: { category: string; images: string[] }[],
): Record<string, string> {
  const taken = new Set<string>();
  const out: Record<string, string> = {};
  for (const category of rankedCategories) {
    const pick = products.find(
      (p) => p.category === category && p.images[0] && !taken.has(p.images[0]),
    );
    if (pick) {
      out[category] = pick.images[0];
      taken.add(pick.images[0]);
    }
  }
  return out;
}
