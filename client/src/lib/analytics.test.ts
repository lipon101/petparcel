import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONSENT_COOKIE_NAME,
  CONSENT_STORAGE_KEY,
  DENY_ALL,
  FIRED_EVENTS_KEY,
  GRANT_ALL,
  adsAllowed,
  analyticsAllowed,
  centsToUnits,
  clearStoredConsent,
  fireOnce,
  getConsent,
  hasFired,
  markFired,
  normalizeConsent,
  orderToGaItems,
  readStoredConsent,
  restoreConsent,
  saveConsent,
  toGaItem,
  trackAddToCart,
  trackAdsConversion,
  trackEvent,
  trackOrderConversion,
  trackPurchase,
  trackViewItem,
  writeStoredConsent,
  cartItemsToGaItems,
  cartSignature,
  cartValue,
  trackAddShippingInfo,
  trackBeginCheckout,
  trackViewCart,
  trackingHostAllowed,
  tagSendAllowed,
  gtagSafe,
  type CartAnalyticsLine,
  type StorageLike,
} from "./analytics";
import type { StoreOrderItem } from "./types";

// A minimal in-memory Storage, so the module's persistence paths are exercised
// without a DOM (vitest runs in the `node` environment here).
function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// Capture every gtag command the module emits.
let calls: unknown[][];

/** Every `gtag('event', <name>, params)` call, in order. Filtering by name (and
 *  not indexing `calls[0]`) keeps a test independent of the consent-update call
 *  that `saveConsent` emits first. */
function eventsNamed(name: string): unknown[][] {
  return calls.filter((c) => c[0] === "event" && c[1] === name);
}

/** A unique order number per test, so the module's in-memory dedupe set (which
 *  lives for the whole file) cannot leak between tests. */
let orderSeq = 0;
function nextOrderNumber(): string {
  orderSeq += 1;
  return `PP-TEST${orderSeq}`;
}

/** A cart carrying a UNIQUE product id per call, for the same reason: the fired
 *  set is module-level and survives between tests, so two tests sharing a basket
 *  would see the second one deduped away rather than genuinely re-sent. */
let cartSeq = 0;
function freshCart(over: Partial<CartAnalyticsLine> = {}): CartAnalyticsLine[] {
  cartSeq += 1;
  return [
    {
      productId: `c${cartSeq}`,
      slug: `c-${cartSeq}`,
      name: "Bed",
      variantName: null,
      priceCents: 4999,
      qty: 1,
      ...over,
    },
  ];
}

beforeEach(() => {
  calls = [];
  (globalThis as unknown as { window: unknown }).window = {
    dataLayer: [],
    gtag: (...args: unknown[]) => void calls.push(args),
  };
  // Reset the module's in-memory consent mirror between tests.
  clearStoredConsent(null);
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("normalizeConsent", () => {
  it("treats anything that is not 'granted' as denied", () => {
    expect(normalizeConsent({ analytics_storage: "granted" })).toEqual({
      ...DENY_ALL,
      analytics_storage: "granted",
    });
    expect(normalizeConsent({ ad_storage: "yes" as never })).toEqual(DENY_ALL);
    expect(normalizeConsent(null)).toEqual(DENY_ALL);
    expect(normalizeConsent(undefined)).toEqual(DENY_ALL);
  });
});

describe("centsToUnits", () => {
  it("converts cents to a 2dp currency value", () => {
    expect(centsToUnits(1999)).toBe(19.99);
    expect(centsToUnits(0)).toBe(0);
    expect(centsToUnits(null)).toBe(0);
    expect(centsToUnits(undefined)).toBe(0);
  });
});

describe("toGaItem", () => {
  const product = { id: "p1", name: "Chew Toy", category: "Toys", priceCents: 1299 };

  it("uses the product id and converts the price", () => {
    expect(toGaItem(product)).toEqual({
      item_id: "p1",
      item_name: "Chew Toy",
      item_category: "Toys",
      price: 12.99,
      quantity: 1,
    });
  });

  it("prefers the variant price and records the variant name", () => {
    const item = toGaItem(product, { name: "Large / Blue", priceCents: 1599 }, 3);
    expect(item.price).toBe(15.99);
    expect(item.item_variant).toBe("Large / Blue");
    expect(item.quantity).toBe(3);
  });

  it("clamps a non-positive quantity to 1", () => {
    expect(toGaItem(product, null, 0).quantity).toBe(1);
  });
});

describe("orderToGaItems", () => {
  it("maps order lines to GA4 items", () => {
    const items: StoreOrderItem[] = [
      {
        id: "i1",
        orderId: "o1",
        productId: "p1",
        variantId: "v1",
        slug: "chew-toy",
        nameSnapshot: "Chew Toy",
        variantSnapshot: "Large / Blue",
        priceCents: 1599,
        qty: 2,
        imageUrl: null,
      },
    ];
    expect(orderToGaItems(items)).toEqual([
      {
        item_id: "p1",
        item_name: "Chew Toy",
        item_variant: "Large / Blue",
        price: 15.99,
        quantity: 2,
      },
    ]);
  });
});

describe("consent gating", () => {
  it("sends nothing while consent is denied", () => {
    saveConsent(DENY_ALL);
    expect(analyticsAllowed()).toBe(false);
    expect(trackEvent("view_item", {})).toBe(false);
    expect(eventsNamed("view_item")).toHaveLength(0);
  });

  it("sends GA4 events once analytics consent is granted", () => {
    saveConsent(GRANT_ALL);
    expect(trackEvent("view_item", { currency: "USD" })).toBe(true);
    expect(eventsNamed("view_item")).toEqual([["event", "view_item", { currency: "USD" }]]);
  });

  it("requires BOTH ad_storage and ad_user_data for ads", () => {
    saveConsent({ ...GRANT_ALL, ad_user_data: "denied" });
    expect(adsAllowed()).toBe(false);
    expect(trackAdsConversion({ sendTo: "G-ZYJNEHXX7Z/abc" })).toBe(false);
    expect(eventsNamed("conversion")).toHaveLength(0);
  });

  it("emits a consent update when a choice is saved", () => {
    saveConsent(GRANT_ALL);
    expect(calls[0]).toEqual(["consent", "update", GRANT_ALL]);
  });
});

describe("event payloads", () => {
  const product = { id: "p1", name: "Chew Toy", category: "Toys", priceCents: 1299 };

  beforeEach(() => saveConsent(GRANT_ALL));

  it("view_item carries currency, value and one item", () => {
    trackViewItem(product);
    expect(eventsNamed("view_item")[0]).toEqual([
      "event",
      "view_item",
      { currency: "USD", value: 12.99, items: [toGaItem(product)] },
    ]);
  });

  it("add_to_cart multiplies value by quantity", () => {
    trackAddToCart(product, null, 3);
    const params = eventsNamed("add_to_cart")[0][2] as {
      value: number;
      items: { quantity: number }[];
    };
    expect(params.value).toBe(38.97);
    expect(params.items[0].quantity).toBe(3);
  });

  it("purchase carries transaction_id, tax, shipping and items", () => {
    trackPurchase({
      transactionId: "PP-1",
      value: 50,
      tax: 4,
      shipping: 0,
      items: [toGaItem(product)],
    });
    const params = eventsNamed("purchase")[0][2] as Record<string, unknown>;
    expect(params.transaction_id).toBe("PP-1");
    expect(params.value).toBe(50);
    expect(params.tax).toBe(4);
    expect(params.shipping).toBe(0);
    expect(params.currency).toBe("USD");
  });
});

describe("dedupe", () => {
  it("fireOnce runs a key at most once", () => {
    const storage = fakeStorage();
    const fn = vi.fn();
    expect(fireOnce("k1", fn, storage)).toBe(true);
    expect(fireOnce("k1", fn, storage)).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("markFired / hasFired round-trip through storage", () => {
    const storage = fakeStorage();
    expect(hasFired("k2", storage)).toBe(false);
    markFired("k2", storage);
    expect(hasFired("k2", storage)).toBe(true);
    expect(JSON.parse(storage.map.get(FIRED_EVENTS_KEY) as string)).toContain("k2");
  });
});

describe("trackOrderConversion", () => {
  const items: StoreOrderItem[] = [
    {
      id: "i1",
      orderId: "o1",
      productId: "p1",
      variantId: null,
      slug: "chew-toy",
      nameSnapshot: "Chew Toy",
      variantSnapshot: null,
      priceCents: 4999,
      qty: 1,
      imageUrl: null,
    },
  ];
  const orderFor = (orderNumber: string) => ({
    orderNumber,
    totalCents: 4999,
    taxCents: 400,
    shippingCents: 0,
    currency: "USD",
  });

  it("fires purchase + conversion once, then dedupes by order number", () => {
    saveConsent(GRANT_ALL);
    const order = orderFor(nextOrderNumber());
    const first = trackOrderConversion(order, items, "G-ZYJNEHXX7Z/abc");
    expect(first).toEqual({ purchase: true, conversion: true, alreadyFired: false });

    const second = trackOrderConversion(order, items, "G-ZYJNEHXX7Z/abc");
    expect(second).toEqual({ purchase: false, conversion: false, alreadyFired: true });

    expect(eventsNamed("purchase")).toHaveLength(1);
    expect(eventsNamed("conversion")).toHaveLength(1);
  });

  it("does NOT mark the order as fired while consent is denied, so a later grant still reports it", () => {
    const order = orderFor(nextOrderNumber());
    saveConsent(DENY_ALL);
    const denied = trackOrderConversion(order, items, "G-ZYJNEHXX7Z/abc");
    expect(denied).toEqual({ purchase: false, conversion: false, alreadyFired: false });
    expect(eventsNamed("purchase")).toHaveLength(0);

    // The visitor now accepts - the same order must still be reportable.
    saveConsent(GRANT_ALL);
    const granted = trackOrderConversion(order, items, "G-ZYJNEHXX7Z/abc");
    expect(granted.purchase).toBe(true);
    expect(granted.conversion).toBe(true);
  });

  it("skips the Ads conversion when no send_to is configured", () => {
    saveConsent(GRANT_ALL);
    const result = trackOrderConversion(orderFor(nextOrderNumber()), items, undefined);
    expect(result.purchase).toBe(true);
    expect(result.conversion).toBe(false);
    expect(eventsNamed("conversion")).toHaveLength(0);
  });
});

describe("persistence", () => {
  it("writes, reads and restores a choice", () => {
    const storage = fakeStorage();
    writeStoredConsent(GRANT_ALL, storage);
    expect(JSON.parse(storage.map.get(CONSENT_STORAGE_KEY) as string)).toMatchObject(GRANT_ALL);
    expect(readStoredConsent(storage)).toEqual(GRANT_ALL);

    clearStoredConsent(storage);
    expect(readStoredConsent(storage)).toBeNull();
  });

  it("restoreConsent re-applies a stored choice to the tag", () => {
    const storage = fakeStorage();
    writeStoredConsent(GRANT_ALL, storage);
    expect(restoreConsent(storage)).toEqual(GRANT_ALL);
    expect(calls[0]).toEqual(["consent", "update", GRANT_ALL]);
    expect(getConsent()).toEqual(GRANT_ALL);
  });

  it("ignores a malformed stored value", () => {
    const storage = fakeStorage();
    storage.setItem(CONSENT_STORAGE_KEY, "{not json");
    expect(readStoredConsent(storage)).toBeNull();
  });
});

// The consent cookie is what lets the INLINE tag in client/index.html re-apply a
// returning visitor's choice before any bundle (or React) has run - and therefore
// before the first hit fires. If the write here stopped matching the read there,
// the restore would silently never match and a visitor who had already accepted
// would be measured as denied on every subsequent page load. A silent failure, so
// the round-trip is pinned rather than left to the tag to notice.
describe("the consent cookie mirror", () => {
  /** Install a fake `document` that records every cookie write. */
  function withFakeDocument(written: string[]): () => void {
    (globalThis as unknown as { document: unknown }).document = {
      get cookie() {
        return "";
      },
      set cookie(value: string) {
        written.push(value);
      },
    };
    return () => {
      delete (globalThis as unknown as { document?: unknown }).document;
    };
  }

  it("writes a first-party cookie alongside localStorage", () => {
    const written: string[] = [];
    const restore = withFakeDocument(written);
    try {
      const storage = fakeStorage();
      writeStoredConsent(GRANT_ALL, storage);

      const cookie = written.find((c) => c.startsWith(`${CONSENT_COOKIE_NAME}=`));
      expect(cookie).toBeDefined();
      expect(cookie).toContain("Path=/");
      expect(cookie).toContain("SameSite=Lax");

      // The value must be exactly what the inline script JSON.parses back.
      const raw = decodeURIComponent((cookie as string).split("=").slice(1).join("=").split(";")[0]);
      expect(JSON.parse(raw)).toMatchObject(GRANT_ALL);

      // localStorage still carries the canonical copy the banner reads.
      expect(readStoredConsent(storage)).toEqual(GRANT_ALL);
    } finally {
      restore();
    }
  });

  it("expires the cookie when the choice is cleared", () => {
    const written: string[] = [];
    const restore = withFakeDocument(written);
    try {
      clearStoredConsent(fakeStorage());
      expect(written.some((c) => c.includes("Max-Age=0"))).toBe(true);
    } finally {
      restore();
    }
  });

  it("never throws when cookies are unavailable, and still persists locally", () => {
    (globalThis as unknown as { document: unknown }).document = {
      get cookie(): string {
        throw new Error("cookies blocked");
      },
      set cookie(_value: string) {
        throw new Error("cookies blocked");
      },
    };
    try {
      const storage = fakeStorage();
      expect(() => writeStoredConsent(GRANT_ALL, storage)).not.toThrow();
      expect(readStoredConsent(storage)).toEqual(GRANT_ALL);
    } finally {
      delete (globalThis as unknown as { document?: unknown }).document;
    }
  });

  it("is a no-op with no document at all (the node test environment)", () => {
    expect(() => writeStoredConsent(GRANT_ALL, fakeStorage())).not.toThrow();
  });
});

// ── The mid-funnel steps ────────────────────────────────────────────────────
describe("cartItemsToGaItems", () => {
  const line = (over: Partial<CartAnalyticsLine> = {}): CartAnalyticsLine => ({
    productId: "p1",
    slug: "chew-toy",
    name: "Chew Toy",
    variantName: null,
    priceCents: 1299,
    qty: 1,
    ...over,
  });

  it("uses the PRODUCT id so item_id matches the other funnel steps", () => {
    expect(cartItemsToGaItems([line()])).toEqual([
      { item_id: "p1", item_name: "Chew Toy", price: 12.99, quantity: 1 },
    ]);
  });

  it("falls back to the slug when a cached basket predates productId", () => {
    const item = cartItemsToGaItems([line({ productId: null })])[0];
    expect(item.item_id).toBe("chew-toy");
  });

  it("records the variant and keeps its own price", () => {
    const item = cartItemsToGaItems([
      line({ variantName: "Large / Blue", priceCents: 1599, qty: 2 }),
    ])[0];
    expect(item).toEqual({
      item_id: "p1",
      item_name: "Chew Toy",
      item_variant: "Large / Blue",
      price: 15.99,
      quantity: 2,
    });
  });
});

describe("cartValue", () => {
  it("sums price x quantity and rounds to 2dp", () => {
    expect(
      cartValue([
        { item_id: "a", item_name: "A", price: 12.99, quantity: 2 },
        { item_id: "b", item_name: "B", price: 0.1, quantity: 3 },
      ]),
    ).toBe(26.28);
  });
});

describe("cartSignature", () => {
  const a: CartAnalyticsLine = {
    productId: "p1", slug: "a", name: "A", variantName: null, priceCents: 100, qty: 1,
  };
  const b: CartAnalyticsLine = {
    productId: "p2", slug: "b", name: "B", variantName: null, priceCents: 200, qty: 2,
  };

  it("is order-independent, so a re-ordered basket is the same basket", () => {
    expect(cartSignature([a, b])).toBe(cartSignature([b, a]));
  });

  it("changes when the shopper changes the basket", () => {
    expect(cartSignature([a, b])).not.toBe(cartSignature([a, { ...b, qty: 3 }]));
    expect(cartSignature([a])).not.toBe(cartSignature([a, b]));
  });

  it("distinguishes two variants of the same product", () => {
    const blue = { ...a, variantName: "Blue" };
    const red = { ...a, variantName: "Red" };
    expect(cartSignature([blue])).not.toBe(cartSignature([red]));
  });
});

describe("trackBeginCheckout", () => {
  it("sends nothing while analytics consent is denied", () => {
    expect(trackBeginCheckout(freshCart())).toBe(false);
    expect(eventsNamed("begin_checkout")).toHaveLength(0);
  });

  it("sends currency, value and items once consent is granted", () => {
    const cart = freshCart();
    saveConsent(GRANT_ALL, null);
    expect(trackBeginCheckout(cart)).toBe(true);
    const [event] = eventsNamed("begin_checkout");
    expect(event[2]).toEqual({
      currency: "USD",
      value: 49.99,
      items: [{ item_id: cart[0].productId, item_name: "Bed", price: 49.99, quantity: 1 }],
    });
  });

  it("dedupes the same basket, so a re-render or refresh cannot inflate it", () => {
    const cart = freshCart();
    saveConsent(GRANT_ALL, null);
    expect(trackBeginCheckout(cart)).toBe(true);
    expect(trackBeginCheckout(cart)).toBe(false);
    expect(eventsNamed("begin_checkout")).toHaveLength(1);
  });

  it("sends nothing for an empty basket", () => {
    saveConsent(GRANT_ALL, null);
    expect(trackBeginCheckout([])).toBe(false);
    expect(eventsNamed("begin_checkout")).toHaveLength(0);
  });

  it("does NOT burn the dedupe key while denied, so it lands after consent", () => {
    // Denied: nothing sent, and critically nothing remembered either - otherwise
    // the visitor would never be measured even after accepting the banner.
    const cart = freshCart();
    expect(trackBeginCheckout(cart)).toBe(false);
    saveConsent(GRANT_ALL, null);
    expect(trackBeginCheckout(cart)).toBe(true);
    expect(eventsNamed("begin_checkout")).toHaveLength(1);
  });
});

describe("trackAddShippingInfo", () => {
  const priced = () => freshCart({ priceCents: 2599, qty: 2 });

  it("sends nothing while analytics consent is denied", () => {
    expect(trackAddShippingInfo(priced(), "Standard shipping")).toBe(false);
    expect(eventsNamed("add_shipping_info")).toHaveLength(0);
  });

  it("carries the shipping tier alongside the basket value", () => {
    const cart = priced();
    saveConsent(GRANT_ALL, null);
    expect(trackAddShippingInfo(cart, "Free shipping")).toBe(true);
    const [event] = eventsNamed("add_shipping_info");
    expect(event[2]).toEqual({
      currency: "USD",
      value: 51.98,
      shipping_tier: "Free shipping",
      items: [{ item_id: cart[0].productId, item_name: "Bed", price: 25.99, quantity: 2 }],
    });
  });

  it("dedupes the same basket AND tier", () => {
    const cart = priced();
    saveConsent(GRANT_ALL, null);
    expect(trackAddShippingInfo(cart, "Standard shipping")).toBe(true);
    expect(trackAddShippingInfo(cart, "Standard shipping")).toBe(false);
    expect(eventsNamed("add_shipping_info")).toHaveLength(1);
  });

  it("records a CHANGE of tier, which is a real shopper decision", () => {
    const cart = priced();
    saveConsent(GRANT_ALL, null);
    expect(trackAddShippingInfo(cart, "Standard shipping")).toBe(true);
    expect(trackAddShippingInfo(cart, "Free shipping")).toBe(true);
    expect(eventsNamed("add_shipping_info")).toHaveLength(2);
  });

  it("sends nothing without a tier or without items", () => {
    saveConsent(GRANT_ALL, null);
    expect(trackAddShippingInfo(priced(), "")).toBe(false);
    expect(trackAddShippingInfo([], "Standard shipping")).toBe(false);
    expect(eventsNamed("add_shipping_info")).toHaveLength(0);
  });
});

describe("trackViewCart", () => {
  it("sends nothing while analytics consent is denied", () => {
    expect(trackViewCart(freshCart())).toBe(false);
    expect(eventsNamed("view_cart")).toHaveLength(0);
  });

  it("sends currency, value and items once consent is granted", () => {
    const cart = freshCart();
    saveConsent(GRANT_ALL, null);
    expect(trackViewCart(cart)).toBe(true);
    const [event] = eventsNamed("view_cart");
    expect(event[2]).toEqual({
      currency: "USD",
      value: 49.99,
      items: [{ item_id: cart[0].productId, item_name: "Bed", price: 49.99, quantity: 1 }],
    });
  });

  it("dedupes the same basket, so a re-render or refresh cannot inflate it", () => {
    const cart = freshCart();
    saveConsent(GRANT_ALL, null);
    expect(trackViewCart(cart)).toBe(true);
    expect(trackViewCart(cart)).toBe(false);
    expect(eventsNamed("view_cart")).toHaveLength(1);
  });

  it("sends nothing for an empty basket", () => {
    saveConsent(GRANT_ALL, null);
    expect(trackViewCart([])).toBe(false);
    expect(eventsNamed("view_cart")).toHaveLength(0);
  });

  it("does NOT burn the dedupe key while denied, so it lands after consent", () => {
    const cart = freshCart();
    expect(trackViewCart(cart)).toBe(false);
    saveConsent(GRANT_ALL, null);
    expect(trackViewCart(cart)).toBe(true);
    expect(eventsNamed("view_cart")).toHaveLength(1);
  });
});

// The tags are not even loaded off the production host (see client/index.html),
// so this is the belt-and-braces guard: no event may leave a preview host even if
// a tag were somehow present.
describe("production-host gating", () => {
  function setHost(hostname: string): void {
    (globalThis as unknown as { window: { location: { hostname: string } } }).window.location = {
      hostname,
    };
  }

  it("sends nothing from a Vercel preview host", () => {
    saveConsent(GRANT_ALL, null);
    setHost("petparcel-bpwf726dl-lipon.vercel.app");
    expect(trackingHostAllowed()).toBe(false);
    expect(trackEvent("view_item", {})).toBe(false);
    expect(eventsNamed("view_item")).toHaveLength(0);
  });

  it("sends normally from the production host", () => {
    saveConsent(GRANT_ALL, null);
    setHost("www.petparcel.store");
    expect(trackingHostAllowed()).toBe(true);
    expect(trackEvent("view_item", {})).toBe(true);
    expect(eventsNamed("view_item")).toHaveLength(1);
  });

  it("exposes the SAME decision as tagSendAllowed (one centralised check)", () => {
    setHost("petparcel-bpwf726dl-lipon.vercel.app");
    expect(tagSendAllowed()).toBe(false);
    setHost("www.petparcel.store");
    expect(tagSendAllowed()).toBe(true);
  });

  // The choke point itself, not just the senders: a tag added later that calls
  // gtagSafe directly (a new event, a consent update, a future Ads call) must
  // still be gated, which is the whole point of centralising the check here.
  it("gates gtagSafe itself, so a future tag is covered by default", () => {
    setHost("petparcel-bpwf726dl-lipon.vercel.app");
    gtagSafe("event", "some_future_tag", {});
    expect(calls).toHaveLength(0);

    setHost("www.petparcel.store");
    gtagSafe("event", "some_future_tag", {});
    expect(calls).toHaveLength(1);
  });
});
