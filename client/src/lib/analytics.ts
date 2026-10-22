// ─────────────────────────────────────────────────────────────────────────────
// Analytics - ONE typed, consent-aware seam for every Google tag call.
//
// WHY THIS FILE EXISTS. The gtag.js snippet in `client/index.html` defines
// `window.gtag` and sets the Consent Mode v2 DEFAULT (everything denied). Every
// event the storefront fires afterwards has to (a) use the same measurement ID,
// (b) carry a correctly-shaped GA4 payload, and (c) respect whatever the visitor
// chose in the consent banner. Spreading `window.gtag(...)` calls across pages
// makes all three easy to get wrong - a typo'd parameter name silently drops a
// field, and a page that forgets the consent check leaks a hit for a visitor who
// said no. So every call goes through here instead.
//
// CONSENT MODEL. The banner writes a choice to localStorage and calls
// `gtag('consent', 'update', ...)`. This module mirrors that choice in memory so
// an event can be gated WITHOUT touching storage on every call:
//
//   * GA4 events (view_item / add_to_cart / purchase) require
//     `analytics_storage: granted`.
//   * The Google Ads conversion requires `ad_storage` AND `ad_user_data`
//     granted (that is what "ads measurement" means under Consent Mode v2).
//
// A denied event is NOT marked as fired, so a visitor who grants consent later
// still gets it - see `trackOrderConversion`.
//
// DEDUPE. `purchase` and the Ads conversion must fire exactly once per order,
// even across a re-render, a refresh, or a return from the payment gateway. The
// order number is the natural key; `fireOnce` remembers it in localStorage (with
// an in-memory fallback) so a reload cannot double-count a conversion.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { CONSENT_COOKIE_NAME, CONSENT_STORAGE_KEY } from "@shared/consent-mode";
import { isProductionHost } from "@shared/production-host";
import type { StoreOrder, StoreOrderItem, StoreProduct, StoreVariant } from "./types";

/** The GA4 measurement ID. Also the Google Ads conversion ID - the store runs
 *  both on the same Google tag, so there is exactly one tag on the page. */
export const GA_MEASUREMENT_ID = "G-ZYJNEHXX7Z";
export const GOOGLE_ADS_CONVERSION_ID = "G-ZYJNEHXX7Z";

/**
 * The Google Ads conversion ACTION label, i.e. the part after the slash in
 * `send_to: "G-ZYJNEHXX7Z/<label>"`. Google Ads issues this label per conversion
 * action (Google Ads -> Goals -> Conversions -> the action -> Tag setup).
 *
 * It is read from `VITE_GOOGLE_ADS_CONVERSION_LABEL` so the label can be set per
 * environment without a code change. When it is unset the Ads conversion is
 * simply not sent - the GA4 `purchase` still fires, and nothing is sent to a
 * malformed `send_to`. Set it in the deploy environment to switch Ads on.
 */
export const GOOGLE_ADS_CONVERSION_LABEL: string =
  (import.meta.env?.VITE_GOOGLE_ADS_CONVERSION_LABEL as string | undefined)?.trim() ?? "";

/** The full `send_to` for the Ads conversion, or undefined when no label is
 *  configured (in which case the conversion is skipped). */
export function googleAdsSendTo(): string | undefined {
  return GOOGLE_ADS_CONVERSION_LABEL
    ? `${GOOGLE_ADS_CONVERSION_ID}/${GOOGLE_ADS_CONVERSION_LABEL}`
    : undefined;
}

/** Where the visitor's consent choice is remembered. The value lives in
 *  `@shared/consent-mode` because the INLINE tag in `client/index.html` reads
 *  the same cookie this module writes - a second copy here could drift and
 *  silently strand a returning visitor on the denied default. Re-exported so
 *  existing importers (and the test suite) keep working unchanged. */
export { CONSENT_STORAGE_KEY, CONSENT_COOKIE_NAME } from "@shared/consent-mode";

/** One year, in seconds - the lifetime of the consent cookie. A consent choice
 *  is expected to be remembered for at least this long. */
const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Mirror the choice to a first-party cookie so the INLINE tag in
 * `client/index.html` can re-apply it synchronously, before any bundle or React
 * has run and therefore before the first hit fires.
 *
 * `localStorage` cannot serve that purpose: the inline script runs first and
 * would have to duplicate the storage-exception handling. The cookie carries the
 * CONSENT DECISION only - never visitor activity - and the inline script deletes
 * it immediately after applying it, so it exists for a single page load.
 *
 * Never throws: a browser with cookies disabled still keeps the choice in
 * localStorage and applies it via React on the next load.
 */
function writeConsentCookie(state: ConsentState): void {
  if (typeof document === "undefined") return;
  try {
    const value = encodeURIComponent(JSON.stringify(state));
    document.cookie = `${CONSENT_COOKIE_NAME}=${value}; Path=/; Max-Age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    /* cookies unavailable - the inline tag falls back to the region defaults */
  }
}

/** Remove the consent cookie (used when a choice is cleared). */
function clearConsentCookie(): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${CONSENT_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** Where the "already fired" event keys are remembered, for dedupe. */
export const FIRED_EVENTS_KEY = "petparcel_analytics_fired_v1";

export type ConsentValue = "granted" | "denied";

/** The four Consent Mode v2 signals the banner controls. `functionality_storage`
 *  and `security_storage` are always granted (they are not optional), so they
 *  are not part of the visitor's choice. */
export interface ConsentState {
  ad_storage: ConsentValue;
  ad_user_data: ConsentValue;
  ad_personalization: ConsentValue;
  analytics_storage: ConsentValue;
}

export const DENY_ALL: ConsentState = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
};

export const GRANT_ALL: ConsentState = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
};

/** The subset of the Storage API this module needs, so a test can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The browser's localStorage, or null when it is unavailable (SSR, a privacy
 *  mode that throws on access, or a test that passes its own fake). */
function browserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Coerce anything into a valid consent state. A missing or malformed field is
 *  DENIED - the safe default, and the one the page's Consent Mode default uses. */
export function normalizeConsent(input: Partial<ConsentState> | null | undefined): ConsentState {
  const pick = (v: unknown): ConsentValue => (v === "granted" ? "granted" : "denied");
  return {
    ad_storage: pick(input?.ad_storage),
    ad_user_data: pick(input?.ad_user_data),
    ad_personalization: pick(input?.ad_personalization),
    analytics_storage: pick(input?.analytics_storage),
  };
}

// ── The in-memory mirror of the visitor's choice ─────────────────────────────
// Kept so an event can be gated without a storage read on every call, and so a
// component can subscribe to a change (the banner granting consent should let a
// pending purchase fire without a reload).
let currentConsent: ConsentState | null = null;
const consentListeners = new Set<(state: ConsentState) => void>();

function emitConsent(state: ConsentState): void {
  for (const fn of consentListeners) fn(state);
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function subscribeConsent(fn: (state: ConsentState) => void): () => void {
  consentListeners.add(fn);
  return () => {
    consentListeners.delete(fn);
  };
}

/** The visitor's current choice, or null when they have not chosen yet. */
export function getConsent(): ConsentState | null {
  if (currentConsent) return currentConsent;
  currentConsent = readStoredConsent();
  return currentConsent;
}

/** Read the stored choice, or null when there is none / it is unreadable. */
export function readStoredConsent(storage: StorageLike | null = browserStorage()): ConsentState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return normalizeConsent(JSON.parse(raw) as Partial<ConsentState>);
  } catch {
    return null;
  }
}

/** Persist a choice. Never throws - a blocked/full storage still lets the choice
 *  apply for the current page view. */
export function writeStoredConsent(
  state: ConsentState,
  storage: StorageLike | null = browserStorage(),
): void {
  // The cookie is written FIRST and independently of localStorage: it is what
  // the inline tag in index.html reads on the NEXT load, and localStorage may be
  // unavailable (private mode) while cookies still work.
  writeConsentCookie(state);
  if (!storage) return;
  try {
    storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ ...state, ts: Date.now() }));
  } catch {
    /* storage unavailable - the in-memory mirror still applies */
  }
}

/** Forget the stored choice (used by "manage preferences" / a reset). */
export function clearStoredConsent(storage: StorageLike | null = browserStorage()): void {
  currentConsent = null;
  clearConsentCookie();
  if (!storage) return;
  try {
    storage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// ── The gtag bridge ──────────────────────────────────────────────────────────
type GtagArgs = unknown[];

/**
 * Push a command to the Google tag. Uses `window.gtag` when the snippet has
 *  defined it, and otherwise queues onto `dataLayer` (which is exactly what the
 *  snippet's own shim does), so a call made before the tag loads is not lost.
 *
 * THE PRODUCTION-HOST GATE LIVES HERE, at the single choke point every Google
 * tag command passes through. Gating the individual senders would leave the
 * next tag - a new event, a consent update, a future Ads call - free to fire on
 * a preview host unless its author remembered the check. Routing them all
 * through this one function means a tag added later is covered by default.
 * `tagSendAllowed()` is the shared decision; see it for why it is safe in a
 * non-browser context.
 */
export function gtagSafe(...args: GtagArgs): void {
  if (!tagSendAllowed()) return;
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    dataLayer?: unknown[];
    gtag?: (...a: GtagArgs) => void;
  };
  if (typeof w.gtag === "function") {
    w.gtag(...args);
    return;
  }
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(args);
}

/** Tell Google the visitor's choice. This is the `consent update` half of the
 *  Consent Mode v2 pair whose `default` lives in client/index.html. */
export function applyConsent(state: ConsentState): void {
  gtagSafe("consent", "update", { ...state });
}

/** Persist AND apply a choice, and notify subscribers. The banner calls this. */
export function saveConsent(
  state: ConsentState,
  storage: StorageLike | null = browserStorage(),
): ConsentState {
  const normalized = normalizeConsent(state);
  currentConsent = normalized;
  writeStoredConsent(normalized, storage);
  applyConsent(normalized);
  emitConsent(normalized);
  return normalized;
}

/** Re-apply a previously stored choice on page load, so a returning visitor's
 *  decision is honoured before the first hit. Returns the choice, or null. */
export function restoreConsent(storage: StorageLike | null = browserStorage()): ConsentState | null {
  const stored = readStoredConsent(storage);
  if (stored) {
    currentConsent = stored;
    applyConsent(stored);
  }
  return stored;
}

/** Whether GA4 measurement may run for this visitor. */
export function analyticsAllowed(state: ConsentState | null = getConsent()): boolean {
  return state?.analytics_storage === "granted";
}

/** Whether Google Ads measurement may run. Consent Mode v2 splits ads into
 *  storage + user-data, and BOTH must be granted for a conversion to count. */
export function adsAllowed(state: ConsentState | null = getConsent()): boolean {
  return state?.ad_storage === "granted" && state?.ad_user_data === "granted";
}

/**
 * Whether the CURRENT HOST may send measurement at all.
 *
 * A Vercel project serves the same build on a fresh `*.vercel.app` URL for every
 * preview and deployment, and those public URLs were being recorded by GA4 and
 * Microsoft Clarity. The tags are not even loaded off the production host (see
 * `client/index.html`), so this is the belt-and-braces guard for the event
 * senders: even if a tag were somehow present, no event leaves a non-production
 * host. The host decision lives in `shared/production-host.ts`.
 *
 * Returns true when there is no host to judge (SSR, a test double), so the
 * helper never silently disables measurement in a non-browser context.
 */
export function trackingHostAllowed(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location?.hostname;
  if (!host) return true;
  return isProductionHost(host);
}

/**
 * The ONE guard every tag sender consults before a command leaves the page.
 *
 * It is deliberately the same decision as `trackingHostAllowed()` - the host
 * allow-list in `shared/production-host.ts` - exposed under a name that reads
 * correctly at the choke point in `gtagSafe`, so GA4, Google Ads and any tag
 * added later all share a single, centralised production-host check rather than
 * each re-deriving it. A `*.vercel.app` preview or a local run therefore sends
 * nothing, whatever the caller.
 *
 * Returns true when there is no host to judge (SSR, a test double), so the
 * helper never silently disables measurement in a non-browser context.
 */
export function tagSendAllowed(): boolean {
  return trackingHostAllowed();
}

// ── Dedupe ───────────────────────────────────────────────────────────────────
const memoryFired = new Set<string>();

function readFiredList(storage: StorageLike | null): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(FIRED_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Whether an event key has already fired (in this tab or a previous one). */
export function hasFired(key: string, storage: StorageLike | null = browserStorage()): boolean {
  if (memoryFired.has(key)) return true;
  return readFiredList(storage).includes(key);
}

/** Remember that an event key fired. The list is capped so it cannot grow
 *  without bound in a long-lived browser profile. */
export function markFired(key: string, storage: StorageLike | null = browserStorage()): void {
  memoryFired.add(key);
  if (!storage) return;
  try {
    const list = readFiredList(storage);
    if (!list.includes(key)) list.push(key);
    storage.setItem(FIRED_EVENTS_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* ignore - the in-memory set still dedupes within this page view */
  }
}

/** Run `fire` at most once for `key`. Returns true when it actually ran. */
export function fireOnce(
  key: string,
  fire: () => void,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (hasFired(key, storage)) return false;
  markFired(key, storage);
  fire();
  return true;
}

// ── GA4 payload builders ─────────────────────────────────────────────────────
/** One GA4 `items` entry. Prices are in CURRENCY UNITS (dollars), not cents -
 *  GA4 expects a decimal, and the store stores cents, so every builder converts
 *  through `centsToUnits` rather than letting a raw cent value leak out. */
export interface GaItem {
  item_id: string;
  item_name: string;
  item_variant?: string;
  item_category?: string;
  price: number;
  quantity: number;
}

/** Cents -> currency units, rounded to 2dp so a float artefact never ships. */
export function centsToUnits(cents: number | null | undefined): number {
  return round2((Number(cents) || 0) / 100);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Build a GA4 item from a catalog product (and the chosen variant, if any).
 *  `item_id` stays the PRODUCT id so product-level reporting is not split by
 *  variant; the variant rides in `item_variant`, which is the GA4 convention. */
export function toGaItem(
  product: Pick<StoreProduct, "id" | "name" | "category" | "priceCents">,
  variant?: Pick<StoreVariant, "name" | "priceCents"> | null,
  quantity = 1,
): GaItem {
  const item: GaItem = {
    item_id: product.id,
    item_name: product.name,
    item_category: product.category,
    price: centsToUnits(variant?.priceCents ?? product.priceCents),
    quantity: Math.max(1, Math.round(quantity) || 1),
  };
  if (variant?.name) item.item_variant = variant.name;
  return item;
}

/** Build GA4 items from an order's line items (the purchase payload). */
export function orderToGaItems(items: StoreOrderItem[]): GaItem[] {
  return items.map((it) => {
    const item: GaItem = {
      item_id: it.productId ?? it.slug ?? it.id,
      item_name: it.nameSnapshot,
      price: centsToUnits(it.priceCents),
      quantity: Math.max(1, Math.round(it.qty) || 1),
    };
    if (it.variantSnapshot) item.item_variant = it.variantSnapshot;
    return item;
  });
}

// ── Cart-line builders (the mid-funnel steps) ───────────────────────────────
/**
 * The minimum a cart line must expose to be measured. Declared structurally
 * rather than imported from `lib/petparcel.tsx` so this module stays free of a
 * runtime import cycle with the cart provider (which renders the components that
 * call in here). `CartLine` satisfies it as-is.
 */
export interface CartAnalyticsLine {
  /** The PRODUCT id, so `item_id` matches the value `view_item` and
   *  `add_to_cart` send for the same product and GA4 does not split one product
   *  across two ids in its funnel report. Optional only so an older cart payload
   *  still parses; `slug` is the fallback when it is absent. */
  productId?: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  priceCents: number;
  qty: number;
}

/** Build GA4 items from the CART's own lines. */
export function cartItemsToGaItems(lines: CartAnalyticsLine[]): GaItem[] {
  return lines.map((l) => {
    const item: GaItem = {
      item_id: l.productId || l.slug,
      item_name: l.name,
      price: centsToUnits(l.priceCents),
      quantity: Math.max(1, Math.round(l.qty) || 1),
    };
    if (l.variantName) item.item_variant = l.variantName;
    return item;
  });
}

/** The cart's value in currency units, summed from its items. */
export function cartValue(items: GaItem[]): number {
  return round2(items.reduce((sum, it) => sum + it.price * it.quantity, 0));
}

/**
 * A stable fingerprint of a cart, used as the dedupe key for the mid-funnel
 * events. Order-independent (lines are sorted), so a cart whose rows come back
 * in a different order from the server is still recognised as the same cart -
 * otherwise React Query handing us the same basket twice would double-count.
 */
export function cartSignature(lines: CartAnalyticsLine[]): string {
  return lines
    .map((l) => `${l.productId || l.slug}:${l.variantName ?? "-"}:${l.qty}`)
    .sort()
    .join("|");
}

// ── Event senders (each gated on consent) ────────────────────────────────────
/** Fire a GA4 event. Returns false (and sends nothing) when analytics consent
 *  has not been granted. */
export function trackEvent(name: string, params: Record<string, unknown> = {}): boolean {
  if (!tagSendAllowed()) return false;
  if (!analyticsAllowed()) return false;
  gtagSafe("event", name, params);
  return true;
}

/** `view_item` - a shopper opened a product page. */
export function trackViewItem(
  product: Pick<StoreProduct, "id" | "name" | "category" | "priceCents">,
  variant?: Pick<StoreVariant, "name" | "priceCents"> | null,
  currency = "USD",
): boolean {
  const item = toGaItem(product, variant);
  return trackEvent("view_item", { currency, value: item.price, items: [item] });
}

/** `add_to_cart` - a shopper added a product (optionally a variant) to the cart. */
export function trackAddToCart(
  product: Pick<StoreProduct, "id" | "name" | "category" | "priceCents">,
  variant: Pick<StoreVariant, "name" | "priceCents"> | null,
  quantity: number,
  currency = "USD",
): boolean {
  const item = toGaItem(product, variant, quantity);
  return trackEvent("add_to_cart", {
    currency,
    value: round2(item.price * item.quantity),
    items: [item],
  });
}

/**
 * Dedupe that RESPECTS CONSENT.
 *
 * `fireOnce` deliberately marks the key as fired whether or not the work
 * succeeded, which is correct for a one-shot side effect but wrong for a gated
 * analytics event: a visitor who has not chosen yet would have the key burned and
 * would never be measured even after granting consent. Here the key is recorded
 * only when the event actually went out, so the mid-funnel steps - which are
 * re-run by the caller on every relevant change - land as soon as consent allows.
 */
function fireOnceAllowed(key: string, fire: () => boolean): boolean {
  if (hasFired(key)) return false;
  const sent = fire();
  if (sent) markFired(key);
  return sent;
}

/**
 * `view_cart` - the shopper OPENED the cart with a live basket.
 *
 * This is the step BEFORE `begin_checkout`: it records that a basket was viewed
 * at all, so a cart that is filled and then abandoned without ever reaching
 * checkout is still visible in the funnel. Fires only when the cart has items.
 *
 * DEDUPE. Keyed on the cart's fingerprint, exactly like `begin_checkout`, so a
 * re-render, a refresh or React Query re-delivering the same basket cannot
 * inflate the step, while a basket the shopper actually changed records the new
 * one.
 */
export function trackViewCart(lines: CartAnalyticsLine[], currency = "USD"): boolean {
  const items = cartItemsToGaItems(lines);
  if (items.length === 0) return false;
  return fireOnceAllowed(`view_cart:${cartSignature(lines)}`, () =>
    trackEvent("view_cart", { currency, value: cartValue(items), items }),
  );
}

/**
 * `begin_checkout` - the shopper reached the checkout with a live basket.
 *
 * DEDUPE. Keyed on the cart's fingerprint, so refreshing the checkout page, or
 * React Query re-delivering the same basket, cannot inflate the checkout step;
 * but a shopper who goes back, changes the basket and returns DOES record the new
 * checkout, because the fingerprint changed with it.
 */
export function trackBeginCheckout(
  lines: CartAnalyticsLine[],
  currency = "USD",
): boolean {
  const items = cartItemsToGaItems(lines);
  if (items.length === 0) return false;
  return fireOnceAllowed(`begin_checkout:${cartSignature(lines)}`, () =>
    trackEvent("begin_checkout", { currency, value: cartValue(items), items }),
  );
}

/**
 * `add_shipping_info` - shipping details have been entered or the tier selected.
 *
 * `shippingTier` is part of the dedupe key, so switching tier (standard to free,
 * say) records the new choice while a re-render of the same choice does not.
 */
export function trackAddShippingInfo(
  lines: CartAnalyticsLine[],
  shippingTier: string,
  currency = "USD",
): boolean {
  const items = cartItemsToGaItems(lines);
  if (items.length === 0 || !shippingTier) return false;
  return fireOnceAllowed(`add_shipping_info:${cartSignature(lines)}:${shippingTier}`, () =>
    trackEvent("add_shipping_info", {
      currency,
      value: cartValue(items),
      shipping_tier: shippingTier,
      items,
    }),
  );
}

export interface PurchaseInput {
  transactionId: string;
  /** Order total, in currency units. */
  value: number;
  tax?: number;
  shipping?: number;
  currency?: string;
  items: GaItem[];
  coupon?: string;
}

/** `purchase` - the order was placed. */
export function trackPurchase(input: PurchaseInput): boolean {
  const params: Record<string, unknown> = {
    transaction_id: input.transactionId,
    value: round2(input.value),
    currency: input.currency ?? "USD",
    items: input.items,
  };
  if (typeof input.tax === "number") params.tax = round2(input.tax);
  if (typeof input.shipping === "number") params.shipping = round2(input.shipping);
  if (input.coupon) params.coupon = input.coupon;
  return trackEvent("purchase", params);
}

export interface AdsConversionInput {
  /** `send_to`, e.g. "G-ZYJNEHXX7Z/AbC-D_efG". */
  sendTo: string;
  transactionId?: string;
  value?: number;
  currency?: string;
  newCustomer?: boolean;
}

/** The Google Ads conversion event. Gated on ads consent (storage + user data). */
export function trackAdsConversion(input: AdsConversionInput): boolean {
  if (!tagSendAllowed()) return false;
  if (!adsAllowed()) return false;
  const params: Record<string, unknown> = { send_to: input.sendTo };
  if (input.transactionId) params.transaction_id = input.transactionId;
  if (typeof input.value === "number") params.value = round2(input.value);
  if (input.currency) params.currency = input.currency;
  if (typeof input.newCustomer === "boolean") params.new_customer = input.newCustomer;
  gtagSafe("event", "conversion", params);
  return true;
}

export interface OrderConversionResult {
  /** True when the GA4 purchase actually went out on this call. */
  purchase: boolean;
  /** True when the Ads conversion actually went out on this call. */
  conversion: boolean;
  /** True when this order had already been reported (dedupe hit). */
  alreadyFired: boolean;
}

/**
 * Report a completed order exactly once: the GA4 `purchase` plus, when an Ads
 * `send_to` is configured, the Google Ads conversion.
 *
 * DEDUPE + CONSENT INTERACTION. The order number is the dedupe key, so a
 * re-render, a refresh or a return from the payment gateway cannot double-count.
 * Crucially, the key is only remembered when at least one event ACTUALLY fired -
 * a visitor who has not yet granted consent is not marked as reported, so the
 * caller can re-run this when consent changes and the event still lands.
 */
export function trackOrderConversion(
  order: Pick<StoreOrder, "orderNumber" | "totalCents" | "taxCents" | "shippingCents" | "currency">,
  items: StoreOrderItem[],
  adsSendTo?: string,
): OrderConversionResult {
  const key = `order:${order.orderNumber}`;
  if (hasFired(key)) return { purchase: false, conversion: false, alreadyFired: true };

  const currency = order.currency || "USD";
  const value = centsToUnits(order.totalCents);

  const purchase = trackPurchase({
    transactionId: order.orderNumber,
    value,
    tax: centsToUnits(order.taxCents),
    shipping: centsToUnits(order.shippingCents),
    currency,
    items: orderToGaItems(items),
  });

  const conversion = adsSendTo
    ? trackAdsConversion({
        sendTo: adsSendTo,
        transactionId: order.orderNumber,
        value,
        currency,
      })
    : false;

  // Only remember the order once something actually went out, so a later
  // consent grant can still report it.
  if (purchase || conversion) markFired(key);

  return { purchase, conversion, alreadyFired: false };
}

// ── React binding ────────────────────────────────────────────────────────────
/** The visitor's consent choice as React state, re-rendering when the banner
 *  changes it. Used by the order page so a purchase can fire the moment consent
 *  is granted, without a reload. */
export function useConsentState(): ConsentState | null {
  const [state, setState] = useState<ConsentState | null>(() => getConsent());
  useEffect(() => subscribeConsent(setState), []);
  return state;
}
