// The Telegram outbox: the durable retry queue that survives a Telegram outage
// longer than the in-request retry window.
//
// WHY EACH PROPERTY IS TESTED. This queue exists so a real sale's alert cannot be
// lost to an outage. Three things would silently break that promise:
//
//   1. IT MUST ACTUALLY RETRY. A failed retry must stay queued below the attempt
//      budget, and only become `failed` when the budget is exhausted.
//   2. IT MUST NOT NOTIFY TWICE. The queue re-enters through
//      `notifyPaidOrderOnce`, so an `already_notified` outcome must be treated as
//      SPENT (the reminder is done) rather than as something to send again.
//   3. CONCURRENT SWEEPS MUST NOT DOUBLE-WORK. The claim pushes the row's next
//      attempt forward as a lease, so a second sweep in the same window finds
//      nothing due.
//
// The DB is mocked with an in-memory store that models the real claim
// (`UPDATE ... WHERE status='pending' AND next_attempt_at <= now() RETURNING`,
// which also increments `attempts`), so the retry ladder and the give-up are
// exercised rather than asserted.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  orderId: string;
  orderNumber: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
}

const state = vi.hoisted(() => ({
  rows: [] as Row[],
  /** Which outcome `notifyPaidOrderOnce` reports for the next call. */
  notifyStatus: "sent" as "sent" | "already_notified" | "not_delivered" | "skipped" | "not_paid",
  notifyReason: "Telegram rejected the message (503)",
  notifyCalls: [] as string[],
  markedSent: [] as string[],
  failureCalls: [] as Array<{ id: string; error: string; maxAttempts: number }>,
  /** Simulates the lease: after claiming, rows are not due again. */
  dueOverride: null as Row[] | null,
}));

vi.mock("../db", () => ({
  // Models the leased claim: due rows come back ONCE, with `attempts` incremented.
  claimDueTelegramOutbox: async () => {
    if (state.dueOverride !== null) {
      const out = state.dueOverride;
      state.dueOverride = null;
      return out;
    }
    const due = state.rows.filter((r) => r.status === "pending");
    for (const r of due) r.attempts += 1;
    return due;
  },
  markTelegramOutboxSent: async (id: string) => {
    state.markedSent.push(id);
    const row = state.rows.find((r) => r.id === id);
    if (row) {
      row.status = "sent";
      row.lastError = null;
    }
  },
  recordTelegramOutboxFailure: async (id: string, error: string, maxAttempts: number) => {
    state.failureCalls.push({ id, error, maxAttempts });
    const row = state.rows.find((r) => r.id === id);
    if (!row) return { status: "pending" as const, attempts: 0 };
    const giveUp = row.attempts >= maxAttempts;
    row.status = giveUp ? "failed" : "pending";
    row.lastError = error;
    return { status: row.status, attempts: row.attempts };
  },
}));

vi.mock("./order-notify", () => ({
  notifyPaidOrderOnce: async (input: { orderId: string }) => {
    state.notifyCalls.push(input.orderId);
    if (state.notifyStatus === "sent") return { status: "sent", sentAt: new Date(), messagesSent: 1 };
    if (state.notifyStatus === "already_notified") return { status: "already_notified", sentAt: new Date() };
    if (state.notifyStatus === "not_delivered") return { status: "not_delivered", reason: state.notifyReason };
    if (state.notifyStatus === "not_paid") return { status: "not_paid", reason: "not settled" };
    return { status: "skipped", reason: "Telegram is not configured" };
  },
}));

const { runTelegramOutboxSweep, OUTBOX_MAX_ATTEMPTS } = await import("./telegram-outbox");

function row(over: Partial<Row> = {}): Row {
  return {
    id: "out-1",
    orderId: "order-1",
    orderNumber: "PP-1",
    status: "pending",
    attempts: 0,
    lastError: null,
    ...over,
  };
}

beforeEach(() => {
  state.rows = [];
  state.notifyStatus = "sent";
  state.notifyCalls = [];
  state.markedSent = [];
  state.failureCalls = [];
  state.dueOverride = null;
});

describe("runTelegramOutboxSweep - a retry that delivers", () => {
  it("sends a queued reminder and marks it spent", async () => {
    state.rows = [row()];
    const result = await runTelegramOutboxSweep();
    expect(result.claimed).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.sentOrders).toEqual(["PP-1"]);
    expect(state.markedSent).toEqual(["out-1"]);
    expect(state.rows[0].status).toBe("sent");
  });

  it("treats an already-notified order as SPENT, never as something to re-send", async () => {
    state.rows = [row()];
    state.notifyStatus = "already_notified";
    const result = await runTelegramOutboxSweep();
    // The reminder is done (another path delivered it), and crucially this is NOT
    // counted as a send by this sweep.
    expect(result.already).toBe(1);
    expect(result.sent).toBe(0);
    expect(state.markedSent).toEqual(["out-1"]);
  });

  it("does nothing when the queue is empty", async () => {
    const result = await runTelegramOutboxSweep();
    expect(result.claimed).toBe(0);
    expect(state.notifyCalls).toHaveLength(0);
  });
});

describe("runTelegramOutboxSweep - retry, backoff and give-up", () => {
  it("keeps a failed retry queued below the attempt budget", async () => {
    state.rows = [row({ attempts: 1 })]; // claim makes it 2
    state.notifyStatus = "not_delivered";
    const result = await runTelegramOutboxSweep();
    expect(result.retried).toBe(1);
    expect(result.failed).toBe(0);
    expect(state.rows[0].status).toBe("pending");
    // The failure reason is recorded so the panel can explain it.
    expect(state.failureCalls[0].error).toContain("503");
    expect(state.rows[0].lastError).toContain("503");
  });

  it("marks the reminder PERMANENTLY failed once the attempt budget is spent", async () => {
    state.rows = [row({ attempts: OUTBOX_MAX_ATTEMPTS - 1 })]; // claim -> budget
    state.notifyStatus = "not_delivered";
    const result = await runTelegramOutboxSweep();
    expect(result.failed).toBe(1);
    expect(result.retried).toBe(0);
    expect(state.rows[0].status).toBe("failed");
    expect(state.rows[0].lastError).toBe(state.notifyReason);
  });

  it("stops retrying a permanently failed reminder (the sweep only revisits `pending`)", async () => {
    state.rows = [row({ status: "failed", attempts: OUTBOX_MAX_ATTEMPTS })];
    const result = await runTelegramOutboxSweep();
    expect(result.claimed).toBe(0);
    expect(state.notifyCalls).toHaveLength(0);
  });

  it("never marks a benign skip (`skipped`/`not_paid`) as failed or delivered", async () => {
    for (const s of ["skipped", "not_paid"] as const) {
      state.rows = [row()];
      state.notifyStatus = s;
      const result = await runTelegramOutboxSweep();
      expect(result.skipped, `status=${s}`).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.sent).toBe(0);
      // Still queued for a later, meaningful attempt.
      expect(state.rows[0].status).toBe("pending");
      expect(state.markedSent).toHaveLength(0);
    }
  });

  it("works every due reminder even when one throws", async () => {
    // Two rows; the first must not stop the second.
    state.rows = [row({ id: "out-1", orderId: "order-1", orderNumber: "PP-1" }), row({ id: "out-2", orderId: "order-2", orderNumber: "PP-2" })];
    const result = await runTelegramOutboxSweep();
    expect(result.claimed).toBe(2);
    expect(result.sent).toBe(2);
  });
});

describe("runTelegramOutboxSweep - concurrent sweeps cannot double-work", () => {
  it("a second sweep in the same window finds nothing due (the claim is a lease)", async () => {
    state.rows = [row()];
    const first = await runTelegramOutboxSweep();
    expect(first.sent).toBe(1);
    // The claim pushed `next_attempt_at` forward, so nothing is due now.
    state.rows = [row({ status: "sent" })];
    const second = await runTelegramOutboxSweep();
    expect(second.claimed).toBe(0);
    expect(state.notifyCalls).toEqual(["order-1"]);
  });
});
