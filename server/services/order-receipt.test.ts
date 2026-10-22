// The paid receipt: the confirmation email.
//
// WHY THIS IS TESTED EXHAUSTIVELY. Two properties have to hold, and both broke
// in production before this module existed:
//
//   1. ONLY after payment is 100% confirmed. A real order (PP-5VJGT7AS) told the
//      customer "a confirmation email is on its way" while the order was still
//      awaiting payment. So the NEGATIVE cases are the important ones: every
//      unfinished, failed, expired, cancelled, partial or refunded status must
//      send NOTHING. `partially_paid` is called out specifically - shipping a
//      short payment is a real, unrecoverable loss.
//
//   2. EXACTLY ONE per order. The IPN webhook, the live reconciliation and the
//      admin resend can all observe the same settlement, and NOWPayments retries
//      a webhook until it gets a 2xx. So a duplicate delivery must not produce a
//      second email.
//
// The DB is mocked with a small in-memory store that models the ATOMIC claim the
// real SQL performs (`UPDATE ... WHERE confirmation_email_sent_at IS NULL`), so
// the idempotency is exercised rather than asserted.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  order: null as Record<string, unknown> | null,
  /** how many times the claim was actually WON. */
  claims: 0,
  /** every send the module attempted, in order. */
  sends: [] as Array<Record<string, unknown>>,
  sendStatus: "sent" as "sent" | "skipped" | "failed",
  sendThrows: false,
}));

// NOTE: the path is relative to THIS file (server/services/), so `../db` is
// server/db.ts. Mocking `./db` would resolve to a non-existent module and the
// real, connection-binding db.ts would be loaded instead.
vi.mock("../db", () => ({
  getOrderDetail: async (id: string) => {
    if (!state.order || state.order.id !== id) return null;
    return { order: state.order, items: [], events: [] };
  },
  claimOrderConfirmationEmail: async (id: string) => {
    if (!state.order || state.order.id !== id) return false;
    // The real SQL: the UPDATE only matches while the column IS NULL.
    if (state.order.confirmationEmailSentAt) return false;
    state.order.confirmationEmailSentAt = new Date();
    state.claims += 1;
    return true;
  },
  releaseOrderConfirmationEmail: async (id: string) => {
    if (!state.order || state.order.id !== id) return;
    state.order.confirmationEmailSentAt = null;
  },
  getOrderConfirmationEmailSentAt: async (id: string) =>
    state.order && state.order.id === id
      ? ((state.order.confirmationEmailSentAt as Date | null) ?? null)
      : null,
}));

vi.mock("../store-settings", () => ({
  getSettings: vi.fn(async () => ({ brand_name: "PetParcel", currency: "USD" })),
}));

// Only the two functions order-receipt.ts uses are stubbed, so the real email
// module (and its transport/DB imports) never loads for these tests.
vi.mock("./email", () => ({
  toEmailLines: vi.fn((i: unknown[]) => i),
  sendPaymentConfirmation: vi.fn(async (order: Record<string, unknown>) => {
    state.sends.push(order);
    if (state.sendThrows) throw new Error("mail provider exploded");
    if (state.sendStatus === "sent") return { status: "sent", providerMessageId: "msg_1" };
    return {
      status: state.sendStatus,
      reason: state.sendStatus === "skipped" ? "RESEND_API_KEY is not set" : "provider refused",
    };
  }),
}));

const { sendPaidReceiptOnce } = await import("./order-receipt");

function makeOrder(over: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    orderNumber: "PP-5VJGT7AS",
    email: "petparcel@proton.me",
    currency: "USD",
    subtotalCents: 4999,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 4999,
    paymentStatus: "unpaid",
    confirmationEmailSentAt: null,
    shippingAddress: { fullName: "Ada Lovelace", line1: "1 Way", city: "Dallas", state: "TX", postalCode: "75201", country: "US" },
    ...over,
  };
}

beforeEach(() => {
  state.order = makeOrder();
  state.claims = 0;
  state.sends = [];
  state.sendStatus = "sent";
  state.sendThrows = false;
});

// ── The negative cases: nothing may be sent for an unsettled payment ────────
describe("sendPaidReceiptOnce - NEVER sends unless the payment is settled", () => {
  // The raw provider statuses that mean "the shopper has not finished paying",
  // including the ones that look settled but are not.
  const UNPAID_RAW_STATUSES = [
    "waiting",
    "confirming",
    "confirmed",
    "sending",
    "partially_paid",
    "failed",
    "expired",
    "refunded",
    "cancelled",
    "",
  ];

  for (const raw of UNPAID_RAW_STATUSES) {
    it(`sends NOTHING for raw status "${raw || "(empty)"}"`, async () => {
      const outcome = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: raw });
      expect(outcome.status).toBe("not_paid");
      expect(state.sends).toHaveLength(0);
      expect(state.order!.confirmationEmailSentAt).toBeNull();
    });
  }

  it("sends NOTHING when the order is stored unpaid and the caller has not verified", async () => {
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    // `finished` alone is enough - this asserts the OTHER path is also refused.
    expect(outcome.status).toBe("sent");
    state.sends = [];
    state.order!.confirmationEmailSentAt = null;
    state.claims = 0;

    const second = await sendPaidReceiptOnce({ orderId: "order-1" });
    expect(second.status).toBe("not_paid");
    expect(state.sends).toHaveLength(0);
  });

  it("sends NOTHING for a cancelled order even with verifiedPaid", async () => {
    state.order = makeOrder({ paymentStatus: "unpaid", status: "cancelled" });
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", verifiedPaid: true });
    // verifiedPaid requires the STORED status to be paid as well.
    expect(outcome.status).toBe("not_paid");
    expect(state.sends).toHaveLength(0);
  });

  it("sends NOTHING for a refunded order", async () => {
    state.order = makeOrder({ paymentStatus: "refunded" });
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", verifiedPaid: true });
    expect(outcome.status).toBe("not_paid");
    expect(state.sends).toHaveLength(0);
  });

  it("never sends for a partially-paid payment (a short payment is a real loss)", async () => {
    state.order = makeOrder({ paymentStatus: "unpaid" });
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "partially_paid" });
    expect(outcome.status).toBe("not_paid");
    expect(state.sends).toHaveLength(0);
  });

  it("reports no_order for an unknown order and sends nothing", async () => {
    state.order = null;
    const outcome = await sendPaidReceiptOnce({ orderId: "nope", rawStatus: "finished" });
    expect(outcome.status).toBe("no_order");
    expect(state.sends).toHaveLength(0);
  });
});

// ── The positive case: exactly one email for a settled payment ──────────────
describe("sendPaidReceiptOnce - sends exactly once for a paid order", () => {
  it("sends the receipt when the raw status is finished", async () => {
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(outcome.status).toBe("sent");
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0].orderNumber).toBe("PP-5VJGT7AS");
  });

  it("sends the receipt on the verified path (stored paid + verifiedPaid)", async () => {
    state.order = makeOrder({ paymentStatus: "paid" });
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", verifiedPaid: true });
    expect(outcome.status).toBe("sent");
    expect(state.sends).toHaveLength(1);
  });

  it("sends EXACTLY ONCE when the same payment is settled twice (duplicate IPN)", async () => {
    // A retried webhook: two calls, both carrying `finished`.
    const first = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    const second = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(first.status).toBe("sent");
    expect(second.status).toBe("already_sent");
    expect(state.sends).toHaveLength(1);
  });

  it("sends EXACTLY ONCE when the webhook and a poll race (concurrent claims)", async () => {
    // Both paths observe the settlement before either has finished sending: the
    // atomic claim is what stops a second email. The mock honours the same
    // `IS NULL` guard the real UPDATE uses, so only one call can win.
    const [a, b] = await Promise.all([
      sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" }),
      sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual(["already_sent", "sent"]);
    expect(state.sends).toHaveLength(1);
    expect(state.claims).toBe(1);
  });

  it("does not re-send after a restart (the claim is persisted on the order)", async () => {
    await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    // A brand-new handler run reads the SAME persisted column. A re-delivered
    // webhook still carries `finished`, so the gate passes and only the CLAIM
    // stops the duplicate.
    const again = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(again.status).toBe("already_sent");
    expect(state.sends).toHaveLength(1);
  });

  it("does not re-send via the verified path once the stored status is paid", async () => {
    state.order!.paymentStatus = "paid";
    await sendPaidReceiptOnce({ orderId: "order-1", verifiedPaid: true });
    const again = await sendPaidReceiptOnce({ orderId: "order-1", verifiedPaid: true });
    expect(again.status).toBe("already_sent");
    expect(state.sends).toHaveLength(1);
  });
});

// ── The claim must always reflect reality ──────────────────────────────────
describe("sendPaidReceiptOnce - the claim tracks the real send", () => {
  it("RELEASES the claim when no API key is configured, so a later attempt can deliver", async () => {
    state.sendStatus = "skipped";
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(outcome.status).toBe("not_delivered");
    expect(state.order!.confirmationEmailSentAt).toBeNull();

    // RESEND_API_KEY added later -> the receipt can still go out, exactly once.
    state.sendStatus = "sent";
    const retry = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(retry.status).toBe("sent");
    expect(state.sends).toHaveLength(2);
  });

  it("RELEASES the claim when the provider refuses, and never throws", async () => {
    state.sendStatus = "failed";
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(outcome.status).toBe("not_delivered");
    expect(state.order!.confirmationEmailSentAt).toBeNull();
  });

  it("RELEASES the claim (and never throws) when the send throws", async () => {
    state.sendThrows = true;
    const outcome = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(outcome.status).toBe("not_delivered");
    expect(outcome).toHaveProperty("reason", expect.stringContaining("exploded"));
    expect(state.order!.confirmationEmailSentAt).toBeNull();
  });

  it("a released claim does NOT allow a second send once one has truly succeeded", async () => {
    await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(state.order!.confirmationEmailSentAt).not.toBeNull();
    // Nothing may clear a successful claim.
    const again = await sendPaidReceiptOnce({ orderId: "order-1", rawStatus: "finished" });
    expect(again.status).toBe("already_sent");
    expect(state.sends).toHaveLength(1);
  });
});
