// Recording a Resend webhook event into `email_events`.
//
// The DB is mocked with a tiny stateful store so the two properties that matter
// can be checked without a database: a first delivery writes a row, a Svix
// RETRY (same svix_id) is a no-op, and a write failure is swallowed (the caller
// must still ACK, or Svix retries forever).
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  fail: false,
}));

vi.mock("../_core/db", () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (state.fail) throw new Error("db down");
            if (state.rows.some((r) => r.svixId === v.svixId)) return [];
            state.rows.push(v);
            return [{ id: `row-${state.rows.length}` }];
          },
        }),
      }),
    }),
  },
}));

const { recordEmailEvent } = await import("./email-events");

const record = {
  svixId: "svix_1",
  type: "email.delivered",
  providerMessageId: "msg_1",
  toEmail: "a@example.com",
  fromEmail: "orders@petparcel.store",
  subject: "Order confirmed",
  reason: null,
  occurredAt: new Date("2026-10-11T05:00:00.000Z"),
};

beforeEach(() => {
  state.rows = [];
  state.fail = false;
});

describe("recordEmailEvent", () => {
  it("writes a row for a first delivery", async () => {
    const r = await recordEmailEvent(record);
    expect(r.inserted).toBe(true);
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].type).toBe("email.delivered");
    expect(state.rows[0].svixId).toBe("svix_1");
  });

  it("is idempotent on a Svix retry (same svix_id)", async () => {
    await recordEmailEvent(record);
    const second = await recordEmailEvent(record);
    expect(second.inserted).toBe(false);
    expect(state.rows).toHaveLength(1);
  });

  it("never throws when the write fails, and reports the error", async () => {
    state.fail = true;
    const r = await recordEmailEvent(record);
    expect(r.inserted).toBe(false);
    expect(r.error).toMatch(/db down/);
  });
});
