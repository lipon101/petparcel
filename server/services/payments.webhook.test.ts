// ── The webhook fulfilment rules ─────────────────────────────────────────────
//
// These pin the decisions that decide whether an ORDER SHIPS. They are not
// conveniences: each one is a rule about money, and each one has a way of
// going wrong that is invisible until a real customer is affected.
//
//   1. A SETTLED payment settles the order - and only that one does. A short
//      payment never ships.
//   2. A failed ATTEMPT is not a failed order. The provider is explicit that
//      the checkout stays open and the customer can try again, so the order
//      stays "awaiting payment" rather than being closed out.
//   3. A late event never walks a paid order BACKWARDS. The provider says
//      events are not guaranteed to arrive in order, and a retried event can
//      arrive after a newer one - so a `collection.failed` that lands after a
//      `collection.succeeded` must not un-settle an order that has shipped.
//   4. A REPEATED delivery does nothing. The provider guarantees at-least-once
//      delivery, and the event id is claimed in a durable ledger, so the
//      second copy finds the claim taken and does no work at all.
//   5. A refund event updates the order's refund state.
//
// The DB is mocked with a small in-memory store, so these are asserted against
// the REAL handler rather than a re-implementation.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Read the env lazily so a test can set a key and have the config pick it up.
vi.mock("../_core/env", () => ({
  env: {
    isProd: false,
    get bachs() {
      return {
        apiKey: process.env.BACHS_API_KEY ?? "",
        webhookSecret: process.env.BACHS_WEBHOOK_SECRET ?? "",
        baseUrl: "",
      };
    },
  },
}));

const store = {
  orders: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  events: [] as Array<Record<string, unknown>>,
  /** The event ids already claimed in `payment_webhook_events`. */
  claimed: new Set<string>(),
  /** The claimed rows, so a release can find them again. */
  claims: [] as Array<Record<string, unknown>>,
  forwarded: [] as string[],
  receipts: [] as Array<Record<string, unknown>>,
  notified: [] as Array<Record<string, unknown>>,
};

/** Pull the column and the value out of a drizzle `eq(...)` condition, so the
 *  mocked lookup can answer "which row did the handler ask for?" instead of
 *  returning every row for every lookup.
 *
 *  A drizzle condition is a list of chunks: a literal, the COLUMN, an
 *  operator, and a bound parameter. The column is the only chunk that carries
 *  both a `name` and a `dataType`; the parameter is the only chunk whose
 *  `value` is a primitive (the literal chunks hold arrays of text). */
function whereTarget(cond: unknown): { column: string; value: unknown } | null {
  const chunks = (cond as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return null;
  let column: string | null = null;
  let value: unknown;
  for (const chunk of chunks) {
    const c = chunk as { name?: unknown; value?: unknown; dataType?: unknown };
    if (typeof c?.name === "string" && c.dataType) column = c.name;
    else if (c && "value" in c && typeof c.value !== "object") value = c.value;
  }
  if (!column) return null;
  return { column, value };
}

vi.mock("../_core/db", () => ({
  db: {
    select: vi.fn(() => {
      let rows: unknown[] = [];
      let filtered: unknown[] | null = null;
      const c: Record<string, unknown> = {};
      c.from = vi.fn(() => {
        rows = store.orders;
        return c;
      });
      c.where = vi.fn((cond: unknown) => {
        const target = whereTarget(cond);
        if (target) {
          // The condition names the SQL column (`order_number`); the fixture
          // rows are keyed by the property name (`orderNumber`).
          const camel = target.column.replace(/_([a-z])/g, (_m, ch: string) =>
            ch.toUpperCase(),
          );
          filtered = rows.filter((r) => {
            const row = r as Record<string, unknown>;
            const v = row[target.column] ?? row[camel];
            return v === target.value;
          });
        }
        return c;
      });
      c.limit = vi.fn(() => c);
      c.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(filtered ?? rows).then(resolve);
      c.catch = (reject: (e: unknown) => unknown) =>
        Promise.resolve(filtered ?? rows).catch(reject);
      c.finally = (fn: () => void) => Promise.resolve(filtered ?? rows).finally(fn);
      return c;
    }),
    insert: vi.fn((table: unknown) => {
      const c: Record<string, unknown> = {};
      c.values = vi.fn((v: Record<string, unknown>) => {
        if (table === WEBHOOK_EVENTS) {
          // The durable event ledger: an insert that loses the conflict
          // returns no rows, which is how a repeat is detected.
          const id = String(v.id ?? "");
          if (store.claimed.has(id)) {
            c.onConflictDoNothing = vi.fn(() => c);
            c.returning = vi.fn(() => Promise.resolve([]));
            return c;
          }
          store.claimed.add(id);
          store.claims.push(v);
          c.onConflictDoNothing = vi.fn(() => c);
          c.returning = vi.fn(() => Promise.resolve([{ id }]));
          return c;
        }
        store.events.push(v);
        c.onConflictDoNothing = vi.fn(() => c);
        c.returning = vi.fn(() => Promise.resolve([]));
        return c;
      });
      c.onConflictDoNothing = vi.fn(() => c);
      c.returning = vi.fn(() => Promise.resolve([]));
      return c;
    }),
    update: vi.fn(() => {
      const c: Record<string, unknown> = {};
      c.set = vi.fn((s: Record<string, unknown>) => {
        store.updates.push(s);
        return c;
      });
      c.where = vi.fn(() => c);
      c.returning = vi.fn(() => Promise.resolve([]));
      c.then = (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve);
      c.catch = (reject: (e: unknown) => unknown) => Promise.resolve([]).catch(reject);
      c.finally = (fn: () => void) => Promise.resolve([]).finally(fn);
      return c;
    }),
    delete: vi.fn(() => {
      const c: Record<string, unknown> = {};
      c.where = vi.fn((cond: unknown) => {
        const target = whereTarget(cond);
        if (target) {
          const camel = target.column.replace(/_([a-z])/g, (_m, ch: string) =>
            ch.toUpperCase(),
          );
          for (const row of store.claims) {
            const r = row as Record<string, unknown>;
            const v = r[target.column] ?? r[camel];
            if (v === target.value) store.claimed.delete(String(v));
          }
        }
        return c;
      });
      c.returning = vi.fn(() => Promise.resolve([]));
      c.then = (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve);
      c.catch = (reject: (e: unknown) => unknown) => Promise.resolve([]).catch(reject);
      c.finally = (fn: () => void) => Promise.resolve([]).finally(fn);
      return c;
    }),
  },
  atomic: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})),
  isUniqueViolation: vi.fn(() => false),
}));

// The table identity the insert mock distinguishes on. It is compared by
// reference, so the same module instance has to be used.
const WEBHOOK_EVENTS = await import("../../drizzle/schema").then(
  (m) => m.paymentWebhookEvents,
);

vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return { ...actual, getOrderDetail: vi.fn(async () => null) };
});

vi.mock("./cj-order-forward", () => ({
  forwardOrderToCj: vi.fn(async (orderId: string) => {
    store.forwarded.push(orderId);
  }),
}));
vi.mock("./order-receipt", () => ({
  sendPaidReceiptOnce: vi.fn(async (input: Record<string, unknown>) => {
    store.receipts.push(input);
    return { status: "sent" };
  }),
}));
vi.mock("./order-notify", () => ({
  notifyPaidOrderOnce: vi.fn(async (input: Record<string, unknown>) => {
    store.notified.push(input);
    return { status: "sent" };
  }),
}));

const { handleWebhook } = await import("./payments");

// ── fixtures ────────────────────────────────────────────────────────────────

const ORDER = {
  id: "order-1",
  orderNumber: "PP-TEST0001",
  email: "ada@example.com",
  totalCents: 8497,
  currency: "USD",
  status: "pending",
  paymentStatus: "unpaid",
  paymentProvider: "bachs",
  paymentRef: null,
  paymentInvoiceId: "chk_TEST0001",
  paymentUrl: "https://checkout.bachs.io/c/TEST0001",
  paymentLastIpn: null,
  paymentLastIpnAt: null,
  paymentLastIpnStatus: null,
  refundStatus: null,
  refundRef: null,
  refundAmount: null,
  refundCurrency: null,
  refundedAt: null,
};

function succeededEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_succeeded_1",
    type: "collection.succeeded",
    created_at: "2026-04-27T12:04:00Z",
    organization_id: "acct_7KpQ2mNv4XbR9dLc",
    data: {
      charge_id: "ch_1a2b3c4d5e6f",
      checkout_id: "chk_TEST0001",
      reference: "PP-TEST0001",
      status: "SUCCEEDED",
      amount: "84.97",
      currency: "USD",
      metadata: { order_number: "PP-TEST0001" },
      ...overrides,
    },
  };
}

/** The single UPDATE the handler made, or null. */
function lastUpdate(): Record<string, unknown> | null {
  return store.updates.length ? store.updates[store.updates.length - 1] : null;
}

beforeEach(() => {
  store.orders = [{ ...ORDER }];
  store.updates = [];
  store.events = [];
  store.claimed.clear();
  store.claims = [];
  store.forwarded = [];
  store.receipts = [];
  store.notified = [];
  process.env.BACHS_API_KEY = "sk_test_key";
  process.env.BACHS_WEBHOOK_SECRET = "whsec_test";
});

// ── 1. a settled payment settles the order ──────────────────────────────────

describe("a settled payment settles the order", () => {
  it("marks the order paid and fires every fulfilment side effect once", async () => {
    const outcome = await handleWebhook("bachs", succeededEvent());
    expect(outcome).toMatchObject({ handled: true, paid: true, orderNumber: "PP-TEST0001" });

    const update = lastUpdate();
    expect(update?.paymentStatus).toBe("paid");
    expect(update?.paymentStatusDetail).toBe("succeeded");
    expect(update?.paymentRef).toBe("ch_1a2b3c4d5e6f");
    expect(update?.paymentInvoiceId).toBe("chk_TEST0001");
    // The event is kept verbatim - the single most useful fact when a payment
    // looks stuck.
    expect(update?.paymentLastIpn).toBeTruthy();
    expect(update?.status).toBe("paid");

    expect(store.forwarded).toEqual(["order-1"]);
    expect(store.receipts).toHaveLength(1);
    expect(store.notified).toHaveLength(1);
  });

  it("does NOT settle a short payment", async () => {
    // The charge succeeded but for less than the order total. Shipping a short
    // payment is a real, unrecoverable loss.
    const outcome = await handleWebhook(
      "bachs",
      succeededEvent({ amount: "80.00", status: "SUCCEEDED" }),
    );
    expect(outcome.paid).toBe(false);
    expect(lastUpdate()?.paymentStatus).toBe("unpaid");
    expect(store.forwarded).toHaveLength(0);
    expect(store.receipts).toHaveLength(0);
  });

  it("does NOT settle an underpaid charge", async () => {
    const outcome = await handleWebhook(
      "bachs",
      succeededEvent({ status: "UNDERPAID", amount_paid: "50.00", amount_expected: "84.97" }),
    );
    expect(outcome.paid).toBe(false);
    expect(lastUpdate()?.paymentStatus).toBe("unpaid");
    expect(store.forwarded).toHaveLength(0);
  });
});

// ── 2. a failed ATTEMPT is not a failed order ───────────────────────────────

describe("a failed attempt is not a failed order", () => {
  it("leaves the order awaiting payment when the attempt fails", async () => {
    // The provider is explicit: "the checkout stays open, so the customer can
    // try again" - and "don't cancel the order on it".
    const outcome = await handleWebhook("bachs", {
      id: "evt_failed_1",
      type: "collection.failed",
      data: {
        charge_id: "ch_fail",
        checkout_id: "chk_TEST0001",
        reference: "PP-TEST0001",
        status: "FAILED",
        amount: "84.97",
        currency: "USD",
      },
    });
    expect(outcome.handled).toBe(true);
    expect(lastUpdate()?.paymentStatus).toBe("unpaid");
    // The raw reason IS recorded, so the shopper can be told what happened.
    expect(lastUpdate()?.paymentStatusDetail).toBe("failed");
    expect(store.forwarded).toHaveLength(0);
  });

  it("fails the order when the checkout itself expires", async () => {
    const outcome = await handleWebhook("bachs", {
      id: "evt_expired_1",
      type: "checkout.expired",
      data: { checkout_id: "chk_TEST0001", reference: "PP-TEST0001", status: "expired" },
    });
    expect(outcome.handled).toBe(true);
    expect(lastUpdate()?.paymentStatus).toBe("failed");
  });
});

// ── 3. a late event never walks a paid order backwards ──────────────────────

describe("a late event never walks a paid order backwards", () => {
  it("leaves a paid order paid when a failure arrives afterwards", async () => {
    store.orders = [{ ...ORDER, paymentStatus: "paid" }];
    const outcome = await handleWebhook("bachs", {
      id: "evt_late_fail",
      type: "collection.failed",
      data: {
        charge_id: "ch_1a2b3c4d5e6f",
        checkout_id: "chk_TEST0001",
        reference: "PP-TEST0001",
        status: "FAILED",
      },
    });
    expect(outcome).toMatchObject({ handled: true, paid: true, reason: "already paid" });
    // Nothing was written and nothing was re-fired.
    expect(store.updates).toHaveLength(0);
    expect(store.forwarded).toHaveLength(0);
    expect(store.receipts).toHaveLength(0);
  });
});

// ── 4. a repeated delivery does nothing ─────────────────────────────────────

describe("a repeated delivery does nothing", () => {
  it("claims the event id once and ignores the second copy", async () => {
    const first = await handleWebhook("bachs", succeededEvent());
    expect(first.paid).toBe(true);
    const writesAfterFirst = store.updates.length;
    const forwardsAfterFirst = store.forwarded.length;

    const second = await handleWebhook("bachs", succeededEvent());
    expect(second).toMatchObject({ handled: true, reason: "duplicate event" });
    expect(store.updates).toHaveLength(writesAfterFirst);
    expect(store.forwarded).toHaveLength(forwardsAfterFirst);
  });

  it("releases the claim when the work fails, so the retry can try again", async () => {
    // A claim that is never released would swallow the provider's RETRY: the
    // provider re-sends a delivery that did not get a 2xx, and if the claim is
    // still standing the retry would do nothing - so a transient database blip
    // would leave a paid order unsettled FOREVER.
    const failing = { ...ORDER, orderNumber: "PP-FAILING" };
    store.orders = [failing];
    const before = store.claimed.size;

    // Make the fulfilment write throw, the way a database blip would.
    const db = await import("../_core/db");
    const update = db.db.update as unknown as {
      mockImplementationOnce: (fn: () => never) => void;
    };
    update.mockImplementationOnce(() => {
      throw new Error("database is down");
    });

    await expect(
      handleWebhook("bachs", {
        ...succeededEvent(),
        id: "evt_failing_1",
        data: { ...succeededEvent().data, reference: "PP-FAILING" },
      }),
    ).rejects.toThrow(/database is down/);

    // The claim was taken, and then released - so a retry is not swallowed.
    expect(store.claimed.size).toBe(before);
  });
});

// ── 5. an unknown order is acknowledged, not retried ─────────────────────────

describe("an unknown order", () => {
  it("is not handled, and writes nothing", async () => {
    store.orders = [];
    const outcome = await handleWebhook("bachs", succeededEvent());
    expect(outcome.handled).toBe(false);
    expect(outcome.reason).toBe("unknown order");
    expect(store.updates).toHaveLength(0);
  });
});

// ── 6. refund events ────────────────────────────────────────────────────────

describe("a refund event", () => {
  it("marks the refund settled and the order refunded", async () => {
    store.orders = [
      {
        ...ORDER,
        paymentStatus: "paid",
        paymentRef: "ch_1a2b3c4d5e6f",
        refundStatus: "created",
        refundRef: "rfnd_4b9c2e7a1d35a0f81c62",
      },
    ];
    const outcome = await handleWebhook("bachs", {
      id: "evt_refund_paid",
      type: "refund.paid",
      data: {
        refund_id: "rfnd_4b9c2e7a1d35a0f81c62",
        charge_id: "ch_1a2b3c4d5e6f",
        reference: "refund-PP-TEST0001",
        status: "success",
        requested_amount: "84.97",
        refunded_amount: "84.97",
        currency: "USD",
      },
    });
    expect(outcome.handled).toBe(true);
    expect(lastUpdate()?.refundStatus).toBe("refunded");
    expect(lastUpdate()?.paymentStatus).toBe("refunded");
    expect(lastUpdate()?.refundedAt).toBeTruthy();
  });

  it("records a failed refund without claiming the money went back", async () => {
    store.orders = [
      {
        ...ORDER,
        paymentStatus: "paid",
        paymentRef: "ch_1a2b3c4d5e6f",
        refundStatus: "created",
        refundRef: "rfnd_4b9c2e7a1d35a0f81c62",
      },
    ];
    await handleWebhook("bachs", {
      id: "evt_refund_failed",
      type: "refund.failed",
      data: {
        refund_id: "rfnd_4b9c2e7a1d35a0f81c62",
        charge_id: "ch_1a2b3c4d5e6f",
        reference: "refund-PP-TEST0001",
        status: "failed",
      },
    });
    expect(lastUpdate()?.refundStatus).toBe("failed");
    // A failed refund moved no money, so the order is NOT marked refunded.
    expect(lastUpdate()?.paymentStatus).toBeUndefined();
  });
});

// ── 7. a body that is not a Bachs event ─────────────────────────────────────

describe("a body that is not a Bachs event", () => {
  it("is ignored rather than guessed at", async () => {
    const outcome = await handleWebhook("bachs", { hello: "world" });
    expect(outcome.handled).toBe(false);
    expect(outcome.reason).toMatch(/no event type/i);
    expect(store.updates).toHaveLength(0);
  });
});
