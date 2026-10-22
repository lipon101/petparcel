import { beforeEach, describe, expect, it, vi } from "vitest";

// A stateful in-memory stand-in for the `login_attempts` table. The real table
// is a plain key/count/locked_until row, so a Map is a faithful model - and it
// lets us drive the clock explicitly to prove the window rollover and the
// cooldown expiry without waiting.
type Row = { key: string; count: number; firstAt: Date; lastAt: Date; lockedUntil: Date | null };
const store = new Map<string, Row>();

function rowsFor(keys: string[]): Row[] {
  return keys.map((k) => store.get(k)).filter((r): r is Row => Boolean(r));
}

vi.mock("./db", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: (cond: { keys: string[] }) => ({
          limit: () => Promise.resolve(rowsFor(cond.keys)),
          then: (f: (v: unknown) => unknown) => Promise.resolve(rowsFor(cond.keys)).then(f),
        }),
      }),
    }),
    insert: () => ({
      values: (v: Row) => ({
        onConflictDoNothing: () => {
          if (!store.has(v.key)) store.set(v.key, v);
          return Promise.resolve([]);
        },
      }),
    }),
    update: () => ({
      set: (patch: Partial<Row>) => ({
        where: (cond: { keys: string[] }) => {
          for (const k of cond.keys) {
            const row = store.get(k);
            if (row) store.set(k, { ...row, ...patch });
          }
          return Promise.resolve([]);
        },
      }),
    }),
    delete: () => ({
      where: (cond: { keys: string[] }) => {
        for (const k of cond.keys) store.delete(k);
        return Promise.resolve([]);
      },
    }),
  };
  return { db };
});

// `inArray(col, keys)` is only used to carry the key list into the fake above.
vi.mock("drizzle-orm", () => ({
  inArray: (_col: unknown, keys: string[]) => ({ keys }),
}));

const {
  assertNotLocked,
  recordFailure,
  clearFailures,
  loginKeys,
  LOGIN_ACCOUNT_RULE,
  LOCKED_MESSAGE,
} = await import("./login-throttle");

beforeEach(() => store.clear());

describe("login-throttle", () => {
  it("locks the account after 5 failures and refuses with a non-enumerating message", async () => {
    const key = "login_account:victim@example.com";
    const t0 = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 5; i++) await recordFailure(key, LOGIN_ACCOUNT_RULE, t0);
    expect(store.get(key)?.count).toBe(5);
    expect(store.get(key)?.lockedUntil).not.toBeNull();

    const err = await assertNotLocked([{ key, rule: LOGIN_ACCOUNT_RULE }], t0).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as { code?: string }).code).toBe("TOO_MANY_REQUESTS");
    expect((err as Error).message).toBe(LOCKED_MESSAGE);
    // The message must not reveal whether the account exists.
    expect(LOCKED_MESSAGE).not.toMatch(/exist|found|account|email/i);
  });

  it("does not lock before the limit is reached", async () => {
    const key = "login_account:ok@example.com";
    const t0 = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 4; i++) await recordFailure(key, LOGIN_ACCOUNT_RULE, t0);
    await expect(assertNotLocked([{ key, rule: LOGIN_ACCOUNT_RULE }], t0)).resolves.toBeUndefined();
  });

  it("lets a caller back in once the cooldown has passed", async () => {
    const key = "login_account:cooldown@example.com";
    const t0 = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 5; i++) await recordFailure(key, LOGIN_ACCOUNT_RULE, t0);
    const after = new Date(t0.getTime() + LOGIN_ACCOUNT_RULE.lockMs + 1);
    await expect(assertNotLocked([{ key, rule: LOGIN_ACCOUNT_RULE }], after)).resolves.toBeUndefined();
  });

  it("clears the counters on a successful sign-in (no permanent lockout)", async () => {
    const key = "login_account:reset@example.com";
    const t0 = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 4; i++) await recordFailure(key, LOGIN_ACCOUNT_RULE, t0);
    expect(store.get(key)?.count).toBe(4);
    await clearFailures([key]);
    expect(store.has(key)).toBe(false);
  });

  it("rolls the window over so the counter cannot grow without bound", async () => {
    const key = "login_account:window@example.com";
    const t0 = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 4; i++) await recordFailure(key, LOGIN_ACCOUNT_RULE, t0);
    const later = new Date(t0.getTime() + LOGIN_ACCOUNT_RULE.windowMs + 1);
    await recordFailure(key, LOGIN_ACCOUNT_RULE, later);
    expect(store.get(key)?.count).toBe(1);
  });

  it("builds a lower-cased account key and an IP key", () => {
    expect(loginKeys("  Admin@Example.COM ", "1.2.3.4")).toEqual({
      account: "login_account:admin@example.com",
      ip: "login_ip:1.2.3.4",
    });
  });
});
