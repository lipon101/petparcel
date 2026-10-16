// The owner's Telegram order notification: the paid gate, the one-shot claim,
// the escaping, and the promise that it can never break the order flow.
//
// WHY EACH PROPERTY IS TESTED. This module sits ON the payment-confirmation path
// - the same code that marks an order paid and sends the customer a receipt. If
// it throws, or if it can be told an unpaid order is paid, or if it notifies
// twice, the damage is on a real sale. So:
//
//   1. THE PAID GATE. An unfinished, failed, expired, partially-paid or refunded
//      order must notify NOBODY. `partially_paid` is called out specifically.
//   2. EXACTLY ONCE. The IPN webhook, the reconciliation and the admin re-send
//      can all observe the same settlement, and NOWPayments retries a webhook
//      until it gets a 2xx - so a second attempt must no-op.
//   3. NEVER THROWS. A Telegram outage must leave the order flow working, and a
//      failed send must RELEASE its claim so a later attempt can still deliver.
//   4. THE COUNTRY FALLS BACK. An order with no country must still notify.
//
// The DB is mocked with an in-memory store that models the real ATOMIC claim
// (`UPDATE ... WHERE telegram_notified_at IS NULL`), so idempotency is exercised
// rather than asserted.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  items: [] as Array<Record<string, unknown>>,
  /** how many times the claim was actually WON. */
  claims: 0,
  /** reasons recorded via setTelegramNotifyError. */
  errors: [] as Array<string | null>,
  sends: [] as string[],
  sendStatus: "sent" as "sent" | "skipped" | "failed",
  sendThrows: false,
  configured: true,
}));

// The path is relative to THIS file (server/services/), so `../db` is server/db.ts.
vi.mock("../db", () => ({
  getOrderDetail: async (id: string) => {
    if (!state.order || state.order.id !== id) return null;
    return { order: state.order, items: state.items, events: [] };
  },
  claimTelegramNotification: async (id: string) => {
    if (!state.order || state.order.id !== id) return false;
    // The real SQL: the UPDATE only matches while the column IS NULL.
    if (state.order.telegramNotifiedAt) return false;
    state.order.telegramNotifiedAt = new Date();
    state.claims += 1;
    return true;
  },
  releaseTelegramNotification: async (id: string) => {
    if (!state.order || state.order.id !== id) return;
    state.order.telegramNotifiedAt = null;
  },
  setTelegramNotifyError: async (_id: string, err: string | null) => {
    state.errors.push(err);
  },
  getTelegramNotifiedAt: async (id: string) =>
    state.order && state.order.id === id
      ? ((state.order.telegramNotifiedAt as Date | null) ?? null)
      : null,
}));

vi.mock("../store-settings", () => ({
  getSettings: vi.fn(async () => ({ brand_name: "PetParcel", currency: "USD" })),
}));

vi.mock("./telegram", async () => {
  const actual = await vi.importActual<typeof import("./telegram")>("./telegram");
  return {
    ...actual,
    isTelegramConfigured: () => state.configured,
    sendTelegramMessage: vi.fn(async (text: string) => {
      if (state.sendThrows) throw new Error("transport exploded");
      state.sends.push(text);
      if (state.sendStatus === "sent") return { status: "sent", messageId: 1, messagesSent: 1, attempts: 1 };
      return {
        status: state.sendStatus,
        reason: state.sendStatus === "skipped" ? "not configured" : "Telegram rejected the message (401)",
        messagesSent: 0,
        attempts: 1,
      };
    }),
  };
});

const { buildOrderNotification, customerCountry, notifyPaidOrderOnce } = await import("./order-notify");

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "PP-5VJGT7AS",
    email: "shopper@example.com",
    currency: "USD",
    totalCents: 4998,
    paymentStatus: "paid",
    status: "paid",
    telegramNotifiedAt: null,
    shippingAddress: { fullName: "Ada Lovelace", country: "United States" },
    ...over,
  };
}

beforeEach(() => {
  state.order = null;
  state.items = [];
  state.claims = 0;
  state.errors = [];
  state.sends = [];
  state.sendStatus = "sent";
  state.sendThrows = false;
  state.configured = true;
});

// ── The paid gate ───────────────────────────────────────────────────────────
describe("notifyPaidOrderOnce - only a settled payment notifies", () => {
  it("sends for a stored-paid order verified with the provider", async () => {
    state.order = makeOrder();
    const out = await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true, trigger: "ipn" });
    expect(out.status).toBe("sent");
    expect(state.sends).toHaveLength(1);
    expect(state.claims).toBe(1);
  });

  it("sends when the RAW status is `finished` even if the caller did not assert paid", async () => {
    state.order = makeOrder({ paymentStatus: "unpaid" });
    const out = await notifyPaidOrderOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(out.status).toBe("sent");
  });

  it("refuses every unfinished status", async () => {
    for (const raw of ["waiting", "confirming", "confirmed", "sending", "failed", "expired", "refunded"]) {
      state.order = makeOrder({ paymentStatus: "unpaid" });
      state.sends = [];
      const out = await notifyPaidOrderOnce({ orderId: "order-1", rawStatus: raw });
      expect(out.status, `raw=${raw}`).toBe("not_paid");
      expect(state.sends).toHaveLength(0);
    }
  });

  it("refuses `partially_paid` - a short payment is a real loss if treated as paid", async () => {
    state.order = makeOrder({ paymentStatus: "unpaid" });
    const out = await notifyPaidOrderOnce({ orderId: "order-1", rawStatus: "partially_paid" });
    expect(out.status).toBe("not_paid");
    expect(state.sends).toHaveLength(0);
  });

  it("refuses when the caller claims paid but the order is not recorded paid", async () => {
    state.order = makeOrder({ paymentStatus: "unpaid" });
    const out = await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true });
    expect(out.status).toBe("not_paid");
  });

  it("reports no_order for an unknown reference", async () => {
    const out = await notifyPaidOrderOnce({ orderId: "nope", verifiedPaid: true });
    expect(out.status).toBe("no_order");
  });

  it("skips WITHOUT spending the claim when Telegram is not configured", async () => {
    state.configured = false;
    state.order = makeOrder();
    const out = await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true });
    expect(out.status).toBe("skipped");
    // The claim must be untouched, so adding the token later still delivers it.
    expect(state.order.telegramNotifiedAt).toBeNull();
    expect(state.claims).toBe(0);
  });
});

// ── Idempotency ─────────────────────────────────────────────────────────────
describe("notifyPaidOrderOnce - exactly one notification per order", () => {
  it("no-ops on a second call, and never sends twice", async () => {
    state.order = makeOrder();
    const first = await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true, trigger: "ipn" });
    const second = await notifyPaidOrderOnce({
      orderId: "order-1",
      verifiedPaid: true,
      trigger: "reconciliation",
    });
    expect(first.status).toBe("sent");
    expect(second.status).toBe("already_notified");
    expect(state.sends).toHaveLength(1);
    expect(state.claims).toBe(1);
  });

  it("survives CONCURRENT calls - the atomic claim admits exactly one sender", async () => {
    state.order = makeOrder();
    const [a, b] = await Promise.all([
      notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true, trigger: "ipn" }),
      notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true, trigger: "post_return" }),
    ]);
    const sent = [a, b].filter((o) => o.status === "sent");
    expect(sent).toHaveLength(1);
    expect(state.sends).toHaveLength(1);
  });
});

// ── Failure must not break the order flow ───────────────────────────────────
describe("notifyPaidOrderOnce - a Telegram problem never breaks the order", () => {
  it("returns not_delivered (never throws) on an API failure, and releases the claim", async () => {
    state.order = makeOrder();
    state.sendStatus = "failed";
    const out = await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true, trigger: "ipn" });
    expect(out.status).toBe("not_delivered");
    // Released, so a retried webhook / an admin re-send can still deliver it.
    expect(state.order.telegramNotifiedAt).toBeNull();
    expect(state.errors.some((e) => typeof e === "string" && e.length > 0)).toBe(true);
  });

  it("lets a LATER attempt succeed after a failure released the claim", async () => {
    state.order = makeOrder();
    state.sendStatus = "failed";
    await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true });
    state.sendStatus = "sent";
    const retry = await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true, trigger: "admin_resend" });
    expect(retry.status).toBe("sent");
  });

  it("still returns an outcome when the transport itself throws", async () => {
    state.order = makeOrder();
    state.sendThrows = true;
    const out = await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true });
    expect(out.status).toBe("not_delivered");
    expect(state.order.telegramNotifiedAt).toBeNull();
  });
});

// ── The message content ─────────────────────────────────────────────────────
describe("buildOrderNotification", () => {
  it("carries the order id, amount, currency, products and country", async () => {
    state.order = makeOrder();
    state.items = [
      { nameSnapshot: "Orthopedic Dog Bed", variantSnapshot: "Large · Grey", qty: 1, priceCents: 4998 },
    ];
    await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true });
    const text = state.sends[0];
    expect(text).toContain("PP-5VJGT7AS");
    expect(text).toContain("$49.98");
    expect(text).toContain("Orthopedic Dog Bed");
    expect(text).toContain("United States");
  });

  it("ESCAPES a hostile product name and country - no markup injection", () => {
    const text = buildOrderNotification({
      orderNumber: "PP-1",
      currency: "USD",
      totalCents: 100,
      country: "Bob & Sons <script>",
      lines: [{ name: "<b>Evil</b> & Co", variant: 'a"b', qty: 2, lineTotalCents: 200 }],
    });
    expect(text).not.toContain("<script>");
    expect(text).not.toContain("<b>Evil</b>");
    expect(text).toContain("&lt;script&gt;");
    expect(text).toContain("&amp;");
    expect(text).toContain("&quot;");
  });

  it("caps the item list and says how many were omitted, so ONE message is enough", () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      name: `Product number ${i} with a deliberately long descriptive name`,
      variant: null,
      qty: 1,
      lineTotalCents: 1000,
    }));
    const text = buildOrderNotification({
      orderNumber: "PP-1",
      currency: "USD",
      totalCents: 400000,
      country: "United States",
      lines: many,
    });
    expect(text.length).toBeLessThan(4096);
    expect(text).toMatch(/…and \d+ more items/);
    // The order number and total survive the cap - that is the point.
    expect(text).toContain("PP-1");
    expect(text).toContain("$4,000.00");
  });
});

describe("customerCountry", () => {
  it("reads the country from the stored address snapshot", () => {
    expect(customerCountry({ country: "Canada" })).toBe("Canada");
  });

  it("falls back gracefully when it is missing or blank", () => {
    expect(customerCountry(null)).toBe("Not provided");
    expect(customerCountry({ country: "  " })).toBe("Not provided");
    expect(customerCountry(undefined)).toBe("Not provided");
  });

  it("still notifies an order with no country", async () => {
    state.order = makeOrder({ shippingAddress: { fullName: "Ada" } });
    const out = await notifyPaidOrderOnce({ orderId: "order-1", verifiedPaid: true });
    expect(out.status).toBe("sent");
    expect(state.sends[0]).toContain("Not provided");
  });
});
