// The daily Telegram reconciliation: the backstop for a notification nothing
// else noticed.
//
// WHY EACH PROPERTY IS TESTED. This job's whole value is that it finds what every
// other path missed, so the failure modes that matter are:
//
//   1. IT MUST FIND FROM `orders`, NOT THE QUEUE. A reminder only exists if
//      something remembered to write one; the order nothing queued is exactly the
//      one this must catch.
//   2. IT MUST ALWAYS RE-QUEUE. The summary is a convenience; the repair is the
//      re-queue. So even when the summary is skipped or fails, every missing
//      order must already be back in the outbox.
//   3. THE SUMMARY IS ONCE PER DAY. A second identical alert is noise the owner
//      learns to ignore, so the claim must admit exactly one sender per day - and
//      a run that LOST the claim must still do the re-queueing.
//
// The DB and the transport are mocked so the decision logic is exercised, not the
// network.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  missing: [] as Array<{ id: string; orderNumber: string; createdAt: Date }>,
  enqueued: [] as Array<{ orderId: string; orderNumber: string }>,
  listThrows: false,
  claimWon: true,
  claimCalls: [] as Array<{ job: string; period: string }>,
  released: [] as Array<{ job: string; period: string }>,
  sends: [] as string[],
  sendStatus: "sent" as "sent" | "failed" | "skipped",
  configured: true,
}));

vi.mock("../db", () => ({
  listPaidOrdersMissingTelegramNotification: async () => {
    if (state.listThrows) throw new Error("relation \"orders\" does not exist");
    return state.missing;
  },
  enqueueTelegramOutbox: async (input: { orderId: string; orderNumber: string }) => {
    state.enqueued.push({ orderId: input.orderId, orderNumber: input.orderNumber });
  },
  claimJobRun: async (job: string, period: string) => {
    state.claimCalls.push({ job, period });
    return state.claimWon;
  },
  releaseJobRun: async (job: string, period: string) => {
    state.released.push({ job, period });
  },
}));

vi.mock("./telegram", async () => {
  const actual = await vi.importActual<typeof import("./telegram")>("./telegram");
  return {
    ...actual,
    isTelegramConfigured: () => state.configured,
    sendTelegramMessage: vi.fn(async (text: string) => {
      state.sends.push(text);
      if (state.sendStatus === "sent") return { status: "sent", messageId: 1, messagesSent: 1, attempts: 1 };
      return { status: state.sendStatus, reason: "Telegram rejected the message (503)", messagesSent: 0, attempts: 1 };
    }),
  };
});

const {
  runTelegramReconciliation,
  buildReconciliationMessage,
  reconciliationPeriod,
  RECONCILIATION_JOB,
} = await import("./telegram-reconciliation");

const NOW = new Date("2026-10-16T09:30:00Z");

function order(id: string, orderNumber: string, hoursAgo = 3) {
  return { id, orderNumber, createdAt: new Date(NOW.getTime() - hoursAgo * 3_600_000) };
}

beforeEach(() => {
  state.missing = [];
  state.enqueued = [];
  state.listThrows = false;
  state.claimWon = true;
  state.claimCalls = [];
  state.released = [];
  state.sends = [];
  state.sendStatus = "sent";
  state.configured = true;
});

describe("runTelegramReconciliation - finds, reports and re-queues", () => {
  it("does nothing when every paid order has been notified", async () => {
    const result = await runTelegramReconciliation(undefined, NOW);
    expect(result.missing).toBe(0);
    expect(result.requeued).toBe(0);
    expect(state.sends).toHaveLength(0);
    expect(state.claimCalls).toHaveLength(0);
  });

  it("re-queues every un-notified paid order AND sends one summary", async () => {
    state.missing = [order("o1", "PP-1"), order("o2", "PP-2", 30)];
    const result = await runTelegramReconciliation(undefined, NOW);
    expect(result.missing).toBe(2);
    expect(result.requeued).toBe(2);
    expect(state.enqueued.map((e) => e.orderNumber)).toEqual(["PP-1", "PP-2"]);
    expect(result.summarySent).toBe(true);
    expect(state.sends).toHaveLength(1);
    const text = state.sends[0];
    expect(text).toContain("PP-1");
    expect(text).toContain("PP-2");
    expect(text).toContain("<b>2</b>");
  });

  it("uses a once-per-day claim so a second run the same day sends NO second summary", async () => {
    state.missing = [order("o1", "PP-1")];
    const first = await runTelegramReconciliation(undefined, NOW);
    expect(first.summarySent).toBe(true);

    state.claimWon = false; // another run already claimed today
    const second = await runTelegramReconciliation(undefined, NOW);
    expect(second.summarySkipped).toBe(true);
    expect(second.summarySent).toBe(false);
    expect(state.sends).toHaveLength(1); // still just the one
    // And the RE-QUEUE still happened for the losing run - the repair (raising a
    // reminder) is never skipped just because the summary was already sent.
    expect(second.requeued).toBe(1);
    // One missing order, re-queued once per run = two upserts, and the second
    // run's upsert is what reopens/heals the row.
    expect(state.enqueued.map((e) => e.orderNumber)).toEqual(["PP-1", "PP-1"]);
  });

  it("claims the summary against the UTC day bucket", async () => {
    state.missing = [order("o1", "PP-1")];
    await runTelegramReconciliation(undefined, NOW);
    expect(state.claimCalls[0]).toEqual({ job: RECONCILIATION_JOB, period: "2026-10-16" });
    expect(reconciliationPeriod(NOW)).toBe("2026-10-16");
  });

  it("still re-queues when Telegram is unconfigured, but sends no summary", async () => {
    state.configured = false;
    state.missing = [order("o1", "PP-1")];
    const result = await runTelegramReconciliation(undefined, NOW);
    expect(result.telegramUnconfigured).toBe(true);
    expect(result.requeued).toBe(1);
    expect(result.summarySent).toBe(false);
    expect(state.sends).toHaveLength(0);
    expect(state.claimCalls).toHaveLength(0);
  });

  it("RELEASES the day's claim if the summary did not land, so a later run can retry it", async () => {
    state.missing = [order("o1", "PP-1")];
    state.sendStatus = "failed";
    const result = await runTelegramReconciliation(undefined, NOW);
    expect(result.summarySent).toBe(false);
    expect(result.error).toContain("503");
    expect(state.released).toEqual([{ job: RECONCILIATION_JOB, period: "2026-10-16" }]);
    // The re-queue still happened - nothing was lost to the summary failure.
    expect(result.requeued).toBe(1);
  });

  it("never throws out of a cron entry point, and reports the failure instead", async () => {
    // The cron has no caller to catch anything, so a failure in the query must
    // surface as a returned error rather than an exception that kills the run.
    state.listThrows = true;
    const result = await runTelegramReconciliation(undefined, NOW);
    expect(result.error).toContain("does not exist");
    expect(result.missing).toBe(0);
    expect(result.requeued).toBe(0);
  });
});

describe("buildReconciliationMessage", () => {
  it("counts the total and lists each order with its age", () => {
    const text = buildReconciliationMessage({
      total: 2,
      orders: [
        { orderNumber: "PP-1", ageHours: 3.4 },
        { orderNumber: "PP-2", ageHours: 30 },
      ],
    });
    expect(text).toContain("<b>2</b>");
    expect(text).toContain("<b>PP-1</b>");
    expect(text).toContain("3h ago");
    expect(text).toContain("30h ago");
  });

  it("ESCAPES a hostile order number - no markup injection", () => {
    const text = buildReconciliationMessage({
      total: 1,
      orders: [{ orderNumber: "<b>x</b>&co", ageHours: 1 }],
    });
    expect(text).not.toContain("<b>x</b>");
    expect(text).toContain("&lt;b&gt;");
    expect(text).toContain("&amp;");
  });

  it("stays under the Telegram limit and summarises the remainder", () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      orderNumber: `PP-${i}-ABCDEFGHIJKLMNOPQRSTUVWXYZ`,
      ageHours: i,
    }));
    const text = buildReconciliationMessage({ total: 400, orders: many });
    expect(text.length).toBeLessThan(4096);
    expect(text).toContain("<b>400</b>");
    expect(text).toMatch(/…and \d+ more/);
  });

  it("says 'order' singular for one missing order", () => {
    const text = buildReconciliationMessage({ total: 1, orders: [{ orderNumber: "PP-1", ageHours: 1 }] });
    expect(text).toContain("<b>1</b> paid order ");
    expect(text).not.toContain("paid orders");
  });
});
