// The admin order view's Telegram status: the wiring that answers "was the owner
// told, and if not, why and what happens next?".
//
// WHY THIS IS A SOURCE-LEVEL WIRING TEST. `getOrderTelegramStatus` is DB plumbing
// with no decision logic of its own - the meaning lives in WHICH columns it
// reads and in the chain that carries them to the panel. So the regressions that
// would actually hurt are structural, and each is pinned here:
//
//   1. THE ROUTE MUST STAY ADMIN-ONLY. A status view that leaked order/payment
//      state to an anonymous caller is a real disclosure, and the only thing
//      stopping it is `adminProcedure`. Asserted, not assumed.
//   2. THE AUTHORITY MUST BE THE ONE-SHOT CLAIM. `notifiedAt` has to come from
//      `telegramNotifiedAt` (what every send path claims), never from a derived
//      guess - the panel's "Delivered" badge is an assertion to the owner.
//   3. THE RETRY QUEUE MUST REACH THE PANEL. Without it, "not notified" and "not
//      notified, but a sweep will retry" look identical, and the second is the
//      reassuring one.
//
// vitest runs in a node environment here (no jsdom), so the .tsx cannot be
// mounted; reading the sources as text is the same approach the repo already uses
// for the Orders page wiring (`client/src/admin/orders-page.test.ts`).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const DB = read("server/db.ts");
const ROUTERS = read("server/routers.ts");
const TYPES = read("client/src/admin/types.ts");
const LIVE = read("client/src/admin/live-source.ts");
const UI = read("client/src/admin/pages/OrderDetail.tsx");
const SCHEMA = read("drizzle/schema.ts");

describe("getOrderTelegramStatus - reads the authoritative columns", () => {
  it("is exported from db.ts", () => {
    expect(DB).toContain("export async function getOrderTelegramStatus(");
  });

  it("takes `notifiedAt` from the one-shot claim and `notifyError` from the error column", () => {
    // The authority for "the owner was told" is `telegram_notified_at` - the same
    // column every send path claims. A derived value here would let the panel
    // claim a delivery that never happened.
    const fn = DB.slice(DB.indexOf("export async function getOrderTelegramStatus("));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain("notifiedAt: orders.telegramNotifiedAt");
    expect(body).toContain("notifyError: orders.telegramNotifyError");
    expect(body).toContain("getTelegramOutboxForOrder");
  });

  it("declares the shape the panel consumes", () => {
    expect(DB).toContain("export interface OrderTelegramStatus {");
    expect(DB).toContain("notifiedAt: Date | null;");
    expect(DB).toContain("notifyError: string | null;");
    expect(DB).toContain("outbox: TelegramOutboxRow[];");
  });
});

describe("the admin route is gated and wired", () => {
  it("exposes `telegramStatus` as an adminProcedure (never a public one)", () => {
    const idx = ROUTERS.indexOf("telegramStatus: adminProcedure");
    expect(idx, "the telegramStatus procedure must be an adminProcedure").toBeGreaterThan(-1);
    // Pin that it is NOT reachable through the two weaker procedure builders.
    expect(ROUTERS).not.toContain("telegramStatus: publicProcedure");
    expect(ROUTERS).not.toContain("telegramStatus: protectedProcedure");
  });

  it("returns 404 for an unknown order rather than an empty status", () => {
    const idx = ROUTERS.indexOf("telegramStatus: adminProcedure");
    const body = ROUTERS.slice(idx, idx + 700);
    expect(body).toContain("NOT_FOUND");
    expect(body).toContain("getOrderTelegramStatus(input.id)");
  });
});

describe("the status travels to the panel", () => {
  it("is declared on the admin view types", () => {
    expect(TYPES).toContain("export interface AdminOrderTelegramStatus {");
    expect(TYPES).toContain("export interface AdminTelegramOutboxEntry {");
    expect(TYPES).toContain("getTelegramStatus(id: string): Promise<AdminOrderTelegramStatus>;");
  });

  it("is requested from the data source on the order detail page", () => {
    expect(LIVE).toContain("async getTelegramStatus(id): Promise<AdminOrderTelegramStatus>");
    expect(LIVE).toContain("caller.admin.telegramStatus.query({ id })");
    expect(LIVE).toContain("function mapTelegramStatus(row: Row): AdminOrderTelegramStatus");
  });

  it("maps the retry-queue rows, not just the flag", () => {
    const fn = LIVE.slice(LIVE.indexOf("function mapTelegramStatus(row: Row)"));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain("notifiedAt: nullableStr(row.notifiedAt)");
    expect(body).toContain("notifyError: nullableStr(row.notifyError)");
    expect(body).toContain("asArray<Row>(row.outbox)");
    // The fields the panel's retry list renders.
    for (const field of ["status", "attempts", "lastError", "lastAttemptAt", "createdAt"]) {
      expect(body, `mapTelegramStatus must map ${field}`).toContain(`${field}:`);
    }
  });
});

describe("the panel renders the status, the error, and the pending retry", () => {
  it("fetches the status on the order detail page", () => {
    expect(UI).toContain("data.getTelegramStatus(id)");
    expect(UI).toContain("useAsync<AdminOrderTelegramStatus>");
  });

  it("shows the last error so the owner can act on it", () => {
    expect(UI).toContain('label="Last error"');
    expect(UI).toContain("telegramStatus.notifyError");
  });

  it("distinguishes a PENDING retry from a delivered notification", () => {
    // Both states exist and must be visually distinct: "not notified yet but a
    // sweep will retry" is the reassuring one and must not read as a failure or
    // as a delivery.
    expect(UI).toContain("Pending retry");
    expect(UI).toContain('o.status === "pending"');
    expect(UI).toContain("A retry is queued");
  });

  it("flags an exhausted retry budget as the actionable failure it is", () => {
    expect(UI).toContain('o.status === "failed"');
    expect(UI).toContain("the owner was NOT notified");
  });

  it("never renders the bot token or chat id", () => {
    // Belt and braces against a future edit: the panel is client code, so a
    // secret reaching it would be public.
    for (const src of [UI, LIVE, TYPES]) {
      expect(src).not.toContain("TELEGRAM_BOT_TOKEN");
      expect(src).not.toContain("TELEGRAM_CHAT_ID");
      expect(src).not.toMatch(/\d{8,12}:[A-Za-z0-9_-]{35}/);
    }
  });
});

describe("the retry queue's schema supports what the panel shows", () => {
  it("carries attempts, the last error, and the next attempt time", () => {
    const idx = SCHEMA.indexOf('export const telegramOutbox = pgTable(');
    expect(idx).toBeGreaterThan(-1);
    const body = SCHEMA.slice(idx, idx + 1600);
    for (const col of [
      'status: text("status")',
      'attempts: integer("attempts")',
      'lastError: text("last_error")',
      'nextAttemptAt: timestamp("next_attempt_at"',
      'lastAttemptAt: timestamp("last_attempt_at"',
    ]) {
      expect(body, `telegram_outbox must define ${col}`).toContain(col);
    }
  });

  it("is one row per order, which is what makes the enqueue idempotent", () => {
    expect(SCHEMA).toContain('uniqueIndex("telegram_outbox_order_idx").on(t.orderId)');
  });
});
