import { beforeEach, describe, expect, it } from "vitest";
import {
  LAST_ORDER_KEY,
  LAST_ORDER_TTL_MS,
  clearLastOrder,
  lastOrderPath,
  parseLastOrder,
  readLastOrder,
  rememberLastOrder,
  serializeLastOrder,
  type StorageLike,
} from "./last-order";

// ── Returning from the payment provider ─────────────────────────────────────
//
// THE BUG THESE TESTS PIN. A shopper placed an order, went to NOWPayments, and
// came back to the store. The cart is (correctly) cleared the moment the order
// is placed, so /checkout found an empty cart and rendered "There's nothing to
// check out" - the order was unreachable and the shopper could not see whether
// they had paid.
//
// The fix is the pointer this module owns: the order is remembered BEFORE the
// browser is handed to the provider, so an empty cart no longer means "no
// order". These tests cover the module's contract; the page wiring that uses it
// is checked in pages/checkout-return.test.ts.

/** An in-memory stand-in for localStorage, so no DOM is needed. */
function fakeStorage(seed: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...seed };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

/** A storage that throws on every access (Safari private mode, storage disabled). */
const hostileStorage: StorageLike = {
  getItem: () => {
    throw new Error("storage blocked");
  },
  setItem: () => {
    throw new Error("storage blocked");
  },
  removeItem: () => {
    throw new Error("storage blocked");
  },
};

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);

describe("rememberLastOrder / readLastOrder", () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
  });

  it("remembers the order number and email, and reads them back", () => {
    rememberLastOrder("pp-5vjgt7as", "Buyer@Example.com", NOW, storage);
    const read = readLastOrder(NOW, storage);
    expect(read).not.toBeNull();
    expect(read?.orderNumber).toBe("PP-5VJGT7AS");
    expect(read?.email).toBe("Buyer@Example.com");
    expect(read?.at).toBe(NOW);
  });

  it("normalizes the order number so a lowercase value still matches the lookup", () => {
    rememberLastOrder("pp-abcdefgh", "buyer@example.com", NOW, storage);
    expect(readLastOrder(NOW, storage)?.orderNumber).toBe("PP-ABCDEFGH");
  });

  it("THE REGRESSION: the order is still recoverable once the cart is gone", () => {
    // Step 1 - the shopper checks out. The order is remembered here, BEFORE the
    // redirect to the provider.
    rememberLastOrder("PP-5VJGT7AS", "buyer@example.com", NOW, storage);

    // Step 2 - the cart is cleared (on order placement) and the shopper is sent
    // to NOWPayments. Nothing about the cart exists any more - only the pointer.

    // Step 3 - the shopper returns to /checkout. There is no cart, but the order
    // must still be identifiable, which is what stops the empty-cart message.
    const recovered = readLastOrder(NOW + 60_000, storage);
    expect(recovered).not.toBeNull();
    expect(recovered?.orderNumber).toBe("PP-5VJGT7AS");
    expect(lastOrderPath(recovered!.orderNumber)).toBe("/order/PP-5VJGT7AS");
  });

  it("survives a fresh page load (the value is in storage, not in memory)", () => {
    rememberLastOrder("PP-5VJGT7AS", "buyer@example.com", NOW, storage);
    // A "new page load" is a new reader against the SAME storage.
    expect(readLastOrder(NOW, storage)?.orderNumber).toBe("PP-5VJGT7AS");
    expect(storage.data[LAST_ORDER_KEY]).toBeDefined();
  });

  it("keeps only one order - a newer checkout replaces an older pointer", () => {
    rememberLastOrder("PP-OLDORDER", "buyer@example.com", NOW, storage);
    rememberLastOrder("PP-NEWORDER", "buyer@example.com", NOW + 1000, storage);
    expect(readLastOrder(NOW + 1000, storage)?.orderNumber).toBe("PP-NEWORDER");
  });

  it("no remembered order reads as null (the genuinely-empty case)", () => {
    expect(readLastOrder(NOW, storage)).toBeNull();
  });

  it("expires after the TTL, so a stale pointer cannot hijack a later visit", () => {
    rememberLastOrder("PP-5VJGT7AS", "buyer@example.com", NOW, storage);
    // Just inside the window: still recoverable.
    expect(readLastOrder(NOW + LAST_ORDER_TTL_MS - 1, storage)).not.toBeNull();
    // Past the window: treated as absent, so /checkout shows the normal empty state.
    expect(readLastOrder(NOW + LAST_ORDER_TTL_MS + 1, storage)).toBeNull();
  });

  it("clearLastOrder forgets the pointer", () => {
    rememberLastOrder("PP-5VJGT7AS", "buyer@example.com", NOW, storage);
    clearLastOrder(storage);
    expect(readLastOrder(NOW, storage)).toBeNull();
  });

  it("never throws when storage is unavailable, and still reports the order", () => {
    const written = rememberLastOrder("PP-5VJGT7AS", "buyer@example.com", NOW, hostileStorage);
    expect(written?.orderNumber).toBe("PP-5VJGT7AS");
    expect(readLastOrder(NOW, hostileStorage)).toBeNull();
    expect(() => clearLastOrder(hostileStorage)).not.toThrow();
  });

  it("ignores a null storage instead of throwing", () => {
    expect(() => rememberLastOrder("PP-5VJGT7AS", "a@b.co", NOW, null)).not.toThrow();
    expect(readLastOrder(NOW, null)).toBeNull();
    expect(() => clearLastOrder(null)).not.toThrow();
  });
});

describe("parseLastOrder - a malformed value must never point anywhere", () => {
  const cases: Array<[string, string | null]> = [
    ["empty string", ""],
    ["not JSON", "{oops"],
    ["JSON null", "null"],
    ["JSON array", "[]"],
    ["JSON string", '"PP-1"'],
    ["no order number", JSON.stringify({ email: "a@b.co", at: NOW })],
    ["blank order number", JSON.stringify({ orderNumber: "   ", at: NOW })],
    ["order number is a number", JSON.stringify({ orderNumber: 123, at: NOW })],
  ];
  for (const [label, raw] of cases) {
    it(`treats ${label} as absent`, () => {
      expect(parseLastOrder(raw, NOW)).toBeNull();
    });
  }

  it("keeps an unexpired record", () => {
    const raw = serializeLastOrder({ orderNumber: "PP-1", email: "a@b.co", at: NOW });
    expect(parseLastOrder(raw, NOW + 1000)?.orderNumber).toBe("PP-1");
  });

  it("treats a record with no timestamp as just-now, so a pre-upgrade pointer still works", () => {
    // Written by the older client, which stored only orderNumber + email.
    const raw = JSON.stringify({ orderNumber: "PP-5VJGT7AS", email: "buyer@example.com" });
    expect(parseLastOrder(raw, NOW)?.orderNumber).toBe("PP-5VJGT7AS");
  });

  it("drops an expired record", () => {
    const raw = serializeLastOrder({ orderNumber: "PP-1", email: "a@b.co", at: NOW });
    expect(parseLastOrder(raw, NOW + LAST_ORDER_TTL_MS + 1)).toBeNull();
  });
});

describe("lastOrderPath", () => {
  it("builds the order status path the app routes at /order/:orderNumber", () => {
    expect(lastOrderPath("PP-5VJGT7AS")).toBe("/order/PP-5VJGT7AS");
    expect(lastOrderPath("pp-5vjgt7as")).toBe("/order/PP-5VJGT7AS");
  });

  it("encodes a value that would otherwise change the path", () => {
    expect(lastOrderPath("PP 1/2")).toBe("/order/PP%201%2F2");
  });
});
