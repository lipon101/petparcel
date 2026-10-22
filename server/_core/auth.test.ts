import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";

// Hoisted, so auth.ts sees them at import time: env.ts calls
// required("DATABASE_URL")/required("JWT_SECRET") at module load, and db.ts
// opens a real driver - neither can run in a unit test.
vi.mock("./env", () => ({
  env: { jwtSecret: "test-secret", appSlug: "test", isProd: false, authProvider: "local" },
}));

const insert: { throws?: unknown; values?: Record<string, unknown> } = {};

// `registerLocalUser` now writes the user row AND its verification token in one
// `atomic(...)` unit, so the mock has to expose `atomic` and hand the builder a
// `d` whose `.insert().values().returning()` behaves like the real one. The
// first statement's `returning()` is where a duplicate-email 23505 surfaces.
vi.mock("./db", () => ({
  db: { insert: () => ({ values: () => ({ returning: async () => [] }) }) },
  atomic: async (build: (d: unknown) => unknown[]) => {
    const d = {
      insert: () => ({
        values(v: Record<string, unknown>) {
          insert.values = v;
          return {
            async returning() {
              // Only the USERS insert (the one carrying an email) is the write
              // the tests make fail; the verification-token insert that follows
              // it in the same atomic unit must resolve, or its promise would
              // reject unhandled once the first statement throws.
              if (insert.throws && "email" in v) throw insert.throws;
              return [{ id: v.id ?? "u_1", email: v.email, name: v.name, role: "user" }];
            },
          };
        },
      }),
    };
    const out: unknown[] = [];
    for (const stmt of build(d)) out.push(await stmt);
    return out;
  },
}));

const { registerLocalUser, EmailTakenError, AuthError } = await import("./auth");

/** What signup actually gets back from Postgres on a second registration. */
function duplicateEmailError() {
  return new DrizzleQueryError(
    'insert into "users" ("id", "email", "password_hash", "name") values (default, $1, $2, $3)',
    ["asce1885@gmail.com", "$2b$10$lz3khdQ4ZWLRwguG/EufKu", "asce"],
    Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), {
      code: "23505",
      constraint: "users_email_unique",
    }),
  );
}

beforeEach(() => {
  insert.throws = undefined;
  insert.values = undefined;
});

describe("registerLocalUser", () => {
  it("rejects a second signup on the same email with EmailTakenError", async () => {
    insert.throws = duplicateEmailError();

    await expect(registerLocalUser("asce1885@gmail.com", "hunter2hunter2", "asce")).rejects.toBeInstanceOf(
      EmailTakenError,
    );
  });

  // The user-visible half of the bug: the thrown message is what the signup
  // form prints, and the old 500 printed the INSERT statement plus every bound
  // param - the bcrypt hash of the password included - into the page.
  it("says the email is taken without quoting the query or the password hash", async () => {
    insert.throws = duplicateEmailError();

    const err = await registerLocalUser("asce1885@gmail.com", "hunter2hunter2", "asce").then(
      () => new Error("expected registerLocalUser to reject"),
      (e: Error) => e,
    );

    expect(err.message).toMatch(/already registered/i);
    expect(err.message).not.toMatch(/insert into|Failed query|params:|\$2b\$/);
  });

  it("stays an AuthError, so callers that only know that type still catch it", async () => {
    insert.throws = duplicateEmailError();

    await expect(registerLocalUser("a@b.co", "hunter2hunter2")).rejects.toBeInstanceOf(AuthError);
  });

  it("lets any other write failure through untouched", async () => {
    const outage = new DrizzleQueryError("insert into \"users\" ...", [], new Error("connection terminated"));
    insert.throws = outage;

    await expect(registerLocalUser("a@b.co", "hunter2hunter2")).rejects.toBe(outage);
  });
});
