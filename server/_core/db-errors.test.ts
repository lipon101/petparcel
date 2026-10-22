import { describe, expect, it } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";

import { isDbUnavailable, isUniqueViolation, schemaDriftDetail } from "./db-errors";

// The real driver error, as node-postgres builds it: the SQLSTATE and the
// constraint name live on the error object, and the human-readable wording is
// Postgres's own.
function pgUniqueViolation(constraint = "users_email_unique"): Error {
  return Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    { code: "23505", constraint, severity: "ERROR" },
  );
}

describe("isUniqueViolation", () => {
  // The regression this whole module exists for (observed 2026-08-26, signup on
  // a published app): Drizzle does NOT re-throw the driver error, it WRAPS it.
  // The wrapper's own message is "Failed query: <sql>\nparams: <bound values>"
  // - no "unique", no "duplicate", no SQLSTATE anywhere in it - so a caller
  // that pattern-matches `e.message` sees nothing and lets a duplicate signup
  // fall through as a 500 quoting the INSERT and every bound param (including
  // the bcrypt hash) back to the browser.
  it("sees through the DrizzleQueryError wrapper to the driver's SQLSTATE", () => {
    const wrapped = new DrizzleQueryError(
      'insert into "users" ("id", "email", "password_hash") values (default, $1, $2)',
      ["asce1885@gmail.com", "$2b$10$lz3khdQ4ZWLRwguG"],
      pgUniqueViolation(),
    );

    expect(wrapped.message).not.toMatch(/unique|duplicate/i); // why the old check missed it
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("recognises a bare driver error that was never wrapped", () => {
    expect(isUniqueViolation(pgUniqueViolation())).toBe(true);
  });

  it("matches a named constraint so callers can tell two unique indexes apart", () => {
    const e = pgUniqueViolation("notes_owner_title_unique");
    expect(isUniqueViolation(e, "notes_owner_title_unique")).toBe(true);
    expect(isUniqueViolation(e, "users_email_unique")).toBe(false);
  });

  it("falls back to Postgres's wording when the driver omits the code", () => {
    const e = new Error('duplicate key value violates unique constraint "users_email_unique"');
    expect(isUniqueViolation(e)).toBe(true);
    expect(isUniqueViolation(e, "users_email_unique")).toBe(true);
    expect(isUniqueViolation(e, "notes_owner_title_unique")).toBe(false);
  });

  it("is false for every other failure - a FK violation is not a duplicate", () => {
    const fk = Object.assign(new Error("violates foreign key constraint"), { code: "23503" });
    expect(isUniqueViolation(new DrizzleQueryError("insert into ...", [], fk))).toBe(false);
    expect(isUniqueViolation(new Error("connection terminated"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });

  it("does not hang on an error whose cause chain loops", () => {
    const a = new Error("a") as Error & { cause?: unknown };
    const b = new Error("b") as Error & { cause?: unknown };
    a.cause = b;
    b.cause = a;
    expect(isUniqueViolation(a)).toBe(false);
  });
});

// `isDbUnavailable` decides whether a router answers with an honest
// "temporarily unavailable" message instead of the opaque generic one. The
// regression it must never repeat: Drizzle NEVER re-throws the driver's error -
// it wraps it in a `DrizzleQueryError` whose own message is
// `Failed query: select ... params: ...` and hangs the real reason off `.cause`.
// A predicate that reads only the top-level message matches NOTHING for the
// exact failures it exists to catch.
describe("isDbUnavailable", () => {
  it("treats a missing required env var as the database being unavailable", () => {
    expect(isDbUnavailable(new Error("Missing required env var: DATABASE_URL"))).toBe(true);
  });

  it("DETECTS a real connection failure HIDDEN INSIDE a Drizzle query error", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND ep-cold-pooler.neon.tech"), {
      errno: -3007,
      code: "ENOTFOUND",
      syscall: "getaddrinfo",
      hostname: "ep-cold-pooler.neon.tech",
    });
    const wrapper = Object.assign(
      new Error('Failed query: select "id" from "products" where "active" = $1\nparams: true'),
      { cause },
    );
    expect(isDbUnavailable(wrapper)).toBe(true);
  });

  it("does NOT mask a genuine application bug as a database outage", () => {
    const wrapper = Object.assign(new Error("Failed query: insert ...\nparams: 1,2"), {
      cause: new TypeError("Cannot read properties of undefined (reading 'id')"),
    });
    expect(isDbUnavailable(wrapper)).toBe(false);
  });

  it("recognises the driver error code even when the message is generic", () => {
    expect(isDbUnavailable(Object.assign(new Error("oh no"), { code: "ECONNREFUSED" }))).toBe(true);
    expect(isDbUnavailable(Object.assign(new Error("oh no"), { code: "ETIMEDOUT" }))).toBe(true);
  });

  it("recognises a Neon serverless (HTTP driver) failure", () => {
    expect(
      isDbUnavailable(Object.assign(new Error("NeonDbError: Error connecting to database"), { name: "NeonDbError" })),
    ).toBe(true);
  });

  it("accepts a raw string and rejects an unrelated one", () => {
    expect(isDbUnavailable("connection refused")).toBe(true);
    expect(isDbUnavailable("Product not found")).toBe(false);
  });

  it("terminates on a cyclic cause chain instead of spinning", () => {
    const a: { message: string; cause?: unknown } = { message: "one" };
    const b = { message: "two", cause: a };
    a.cause = b;
    expect(isDbUnavailable(a)).toBe(false);
  });
});

// `schemaDriftDetail` turns an opaque "database unavailable" log line into one
// that names the exact missing column/relation and the fix. It is the difference
// between an operator guessing and running `pnpm db:migrate`. It must NEVER be
// surfaced to the browser - the router keeps the short, leak-free user message.
describe("schemaDriftDetail", () => {
  it("names the missing column and table, and points at the migration command", () => {
    // The exact production failure: `products.specs` (migration 0004) unapplied.
    const cause = Object.assign(new Error('column "specs" does not exist'), {
      code: "42703",
      severity: "ERROR",
      routine: "errorMissingColumn",
    });
    const wrapper = new DrizzleQueryError(
      'select "id", "name", "specs" from "products" where "active" = $1',
      [true],
      cause,
    );
    const detail = schemaDriftDetail(wrapper);
    expect(detail).toContain('missing column "specs"');
    expect(detail).toContain("pnpm db:migrate");
  });

  it("names a missing relation (a table a migration never created)", () => {
    const cause = Object.assign(new Error('relation "wishlist_items" does not exist'), {
      code: "42P01",
    });
    const wrapper = new DrizzleQueryError("select * from wishlist_items", [], cause);
    const detail = schemaDriftDetail(wrapper);
    expect(detail).toContain('missing relation "wishlist_items"');
    expect(detail).toContain("pnpm db:migrate");
  });

  it("is null for a plain connection failure - that is not schema drift", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND ep-cold-pooler.neon.tech"), {
      code: "ENOTFOUND",
    });
    expect(schemaDriftDetail(new DrizzleQueryError("select 1", [], cause))).toBeNull();
  });

  it("is null for a genuine application bug", () => {
    expect(schemaDriftDetail(new TypeError("Cannot read properties of undefined"))).toBeNull();
    expect(schemaDriftDetail(null)).toBeNull();
  });

  it("terminates on a cyclic cause chain instead of spinning", () => {
    const a: { message: string; cause?: unknown } = { message: "one" };
    const b = { message: "two", cause: a };
    a.cause = b;
    expect(schemaDriftDetail(a)).toBeNull();
  });
});
