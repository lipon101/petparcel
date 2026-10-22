// The unpaid-order alert: the 24h boundary and the one-shot claim.
//
// WHY THIS IS TESTED. Two properties have to hold, and both are easy to get
// wrong in a way that only shows up in production:
//
//   1. THE BOUNDARY. An order must be alerted only once it is OLDER than the
//      threshold. An order at 23h must be left alone; one at 25h must be
//      alerted. An off-by-one here either nags the owner about fresh orders or
//      never chases the stale ones.
//
//   2. EXACTLY ONCE, EVEN UNDER CONCURRENCY. The sweep can run concurrently
//      (two serverless instances, or a manual run overlapping the cron), and an
//      owner who gets the same nudge every hour will start ignoring it. So the
//      send is guarded by an ATOMIC claim - a single conditional UPDATE that
//      exactly one run can win - not by an if-not-sent check two runs can both
//      pass.
//
// The DB is mocked with a small in-memory store that models the real SQL
// (`UPDATE ... WHERE unpaid_alert_sent_at IS NULL AND payment_status NOT IN
// ('paid','refunded') AND status <> 'cancelled' AND created_at < now() - 24h`),
// so the boundary and the idempotency are EXERCISED rather than asserted.
import { beforeEach, describe, expect, it, vi } from "vitest";

const HOUR = 3_600_000;

const state = vi.hoisted(() => ({
  orders: [] as Array<Record<string, unknown>>,
  /** how many times the claim was actually WON, per order id. */
  claims: {} as Record<string, number>,
  /** every alert the module attempted, in order. */
  sends: [] as Array<Record<string, unknown>>,
  sendStatus: "sent" as "sent" | "skipped" | "failed",
}));

vi.mock("../db", () => ({
  UNPAID_ALERT_AFTER_HOURS: 24,
  listUnpaidOrdersForAlert: async (olderThanHours: number) => {
    const cutoff = Date.now() - olderThanHours * HOUR;
    return state.orders.filter(
      (o) =>
        o.unpaidAlertSentAt == null &&
        o.paymentStatus !== "paid" &&
        o.paymentStatus !== "refunded" &&
        o.status !== "cancelled" &&
        (o.createdAt as Date).getTime() < cutoff,
    );
  },
  claimUnpaidOrderAlert: async (id: string) => {
    const o = state.orders.find((x) => x.id === id);
    if (!o) return false;
    // The real SQL: the UPDATE only matches while the column IS NULL AND the
    // order is still genuinely unpaid AND old enough.
    if (o.unpaidAlertSentAt != null) return false;
    if (o.paymentStatus === "paid" || o.paymentStatus === "refunded") return false;
    if (o.status === "cancelled") return false;
    if ((o.createdAt as Date).getTime() >= Date.now() - 24 * HOUR) return false;
    o.unpaidAlertSentAt = new Date();
    state.claims[id] = (state.claims[id] ?? 0) + 1;
    return true;
  },
  releaseUnpaidOrderAlert: async (id: string) => {
    const o = state.orders.find((x) => x.id === id);
    if (o && o.unpaidAlertSentAt != null) o.unpaidAlertSentAt = null;
  },
}));

vi.mock("../store-settings", () => ({
  getSettings: vi.fn(async () => ({ brand_name: "PetParcel", currency: "USD" })),
}));

vi.mock("./email", () => ({
  absoluteUrl: (origin: string, path: string) => `${origin}${path}`,
  sendUnpaidOrderAlertEmail: vi.fn(async (alert: Record<string, unknown>) => {
    state.sends.push(alert);
    if (state.sendStatus === "sent") return { status: "sent", providerMessageId: "msg_1" };
    return {
      status: state.sendStatus,
      reason: state.sendStatus === "skipped" ? "RESEND_API_KEY is not set" : "provider refused",
    };
  }),
}));

vi.mock("../../shared/store", () => ({ STORE_URL: "https://www.petparcel.store" }));

const { runUnpaidOrderAlerts } = await import("./unpaid-alerts");

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "PP-5VJGT7AS",
    email: "petparcel@proton.me",
    currency: "USD",
    totalCents: 1998,
    paymentStatus: "unpaid",
    status: "pending",
    unpaidAlertSentAt: null,
    createdAt: new Date(Date.now() - 30 * HOUR),
    shippingAddress: { fullName: "Ada Lovelace" },
    ...over,
  };
}

beforeEach(() => {
  state.orders = [];
  state.claims = {};
  state.sends = [];
  state.sendStatus = "sent";
});

// ── The 24h boundary ─────────────────────────────────────────────────────────
describe("runUnpaidOrderAlerts - the 24h boundary", () => {
  it("does NOT alert an order that is only 23 hours old", async () => {
    state.orders = [makeOrder({ createdAt: new Date(Date.now() - 23 * HOUR) })];
    const result = await runUnpaidOrderAlerts();
    expect(result.candidates).toBe(0);
    expect(result.sent).toBe(0);
    expect(state.sends).toHaveLength(0);
  });

  it("DOES alert an order that is 25 hours old", async () => {
    state.orders = [makeOrder({ createdAt: new Date(Date.now() - 25 * HOUR) })];
    const result = await runUnpaidOrderAlerts();
    expect(result.candidates).toBe(1);
    expect(result.sent).toBe(1);
    expect(state.sends).toHaveLength(1);
    expect(result.alerted).toEqual(["PP-5VJGT7AS"]);
  });

  it("honours a custom threshold", async () => {
    state.orders = [makeOrder({ createdAt: new Date(Date.now() - 30 * HOUR) })];
    const result = await runUnpaidOrderAlerts(48);
    expect(result.candidates).toBe(0);
    expect(result.sent).toBe(0);
  });
});

// ── Only genuinely unpaid orders ─────────────────────────────────────────────
describe("runUnpaidOrderAlerts - only genuinely unpaid orders", () => {
  it.each([
    ["paid", { paymentStatus: "paid" }],
    ["refunded", { paymentStatus: "refunded" }],
    ["cancelled", { status: "cancelled" }],
  ])("never alerts a %s order", async (_label, over) => {
    state.orders = [makeOrder(over)];
    const result = await runUnpaidOrderAlerts();
    expect(result.candidates).toBe(0);
    expect(result.sent).toBe(0);
    expect(state.sends).toHaveLength(0);
  });

  it("alerts a genuinely unpaid order", async () => {
    state.orders = [makeOrder()];
    const result = await runUnpaidOrderAlerts();
    expect(result.sent).toBe(1);
  });
});

// ── Exactly once, even under concurrency ─────────────────────────────────────
describe("runUnpaidOrderAlerts - exactly one alert per order", () => {
  it("does not re-alert on a second run", async () => {
    state.orders = [makeOrder()];
    const first = await runUnpaidOrderAlerts();
    const second = await runUnpaidOrderAlerts();
    expect(first.sent).toBe(1);
    expect(second.sent).toBe(0);
    expect(state.sends).toHaveLength(1);
    expect(state.claims["order-1"]).toBe(1);
  });

  it("sends exactly one alert when two runs race the same order", async () => {
    state.orders = [makeOrder()];
    // Both runs read the same candidate list before either claims - the exact
    // race the atomic claim exists to resolve.
    const [a, b] = await Promise.all([runUnpaidOrderAlerts(), runUnpaidOrderAlerts()]);
    expect(a.sent + b.sent).toBe(1);
    expect(state.sends).toHaveLength(1);
    expect(state.claims["order-1"]).toBe(1);
  });

  it("releases the claim when the provider does not accept the send, so a later run retries", async () => {
    state.orders = [makeOrder()];
    state.sendStatus = "failed";
    const first = await runUnpaidOrderAlerts();
    expect(first.sent).toBe(0);
    expect(first.failed).toBe(1);
    // The claim was given back, so the order is a candidate again.
    expect(state.orders[0].unpaidAlertSentAt).toBeNull();

    state.sendStatus = "sent";
    const second = await runUnpaidOrderAlerts();
    expect(second.sent).toBe(1);
    expect(state.sends).toHaveLength(2);
  });
});
