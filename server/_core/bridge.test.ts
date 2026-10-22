import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The Neon Auth -> local `users` bridge. It needs the database, so `./db` is
// mocked with a tiny chainable that hands back a queued result per query. The
// point of these tests is the LINK-OR-CREATE decision: an existing local row
// must be REUSED (its role and history preserved), never shadowed by a fresh
// account - the bug that let a mixed-case admin row be duplicated.
vi.mock("./env", () => ({
  env: {
    jwtSecret: "test-secret",
    appSlug: "test",
    isProd: false,
    authProvider: "neon",
    neonAuth: { url: "https://auth.test/db/auth", jwksUrl: "" },
  },
}));

const state: {
  results: unknown[][];
  insertCalled: boolean;
  updateCalled: boolean;
} = { results: [], insertCalled: false, updateCalled: false };

vi.mock("./db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => state.results.shift() ?? [] }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          state.updateCalled = true;
        },
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: async () => {
          state.insertCalled = true;
          return state.results.shift() ?? [];
        },
      }),
    }),
  },
  atomic: async () => [],
}));

const { bridgeNeonUser } = await import("./auth");

beforeEach(() => {
  state.results = [];
  state.insertCalled = false;
  state.updateCalled = false;
});

describe("bridgeNeonUser", () => {
  it("reuses an existing local row found by email instead of creating a duplicate", async () => {
    // 1st query: not already linked. 2nd query: the email lookup finds the row.
    state.results = [
      [],
      [{ id: "u_admin", email: "owner@store.com", name: "Owner", role: "admin", neonAuthUserId: null }],
    ];

    const user = await bridgeNeonUser({
      id: "neon_1",
      email: "owner@store.com",
      name: "Owner",
      emailVerified: false,
    });

    expect(user.id).toBe("u_admin");
    expect(user.role).toBe("admin");
    expect(state.insertCalled).toBe(false); // no duplicate account
    expect(state.updateCalled).toBe(true); // the row was linked to the provider id
  });

  it("creates a local row only when no account exists for the address", async () => {
    state.results = [
      [], // not already linked
      [], // no local row for this email
      [{ id: "u_new", email: "new@store.com", name: "New", role: "user", neonAuthUserId: "neon_2" }],
    ];

    const user = await bridgeNeonUser({
      id: "neon_2",
      email: "new@store.com",
      name: "New",
      emailVerified: false,
    });

    expect(user.id).toBe("u_new");
    expect(state.insertCalled).toBe(true);
  });

  it("links a MIXED-CASE local row to a lowercase Neon Auth account (same row, no duplicate, role preserved)", async () => {
    // The regression: a local row stored with mixed case (e.g. an admin created
    // by hand) plus a Neon Auth account whose email is lower-cased. A
    // case-SENSITIVE email lookup misses the row and the bridge creates a
    // DUPLICATE account, shadowing the real role with a fresh `user` row.
    state.results = [
      [], // not already linked
      [
        {
          id: "u_mixed",
          email: "MixedCase.Owner@Store.com",
          name: "Owner",
          role: "admin",
          neonAuthUserId: null,
        },
      ],
    ];

    const user = await bridgeNeonUser({
      id: "neon_mixed",
      email: "mixedcase.owner@store.com", // Neon Auth lower-cases the address
      name: "Owner",
      emailVerified: true,
    });

    expect(user.id).toBe("u_mixed"); // the SAME row, not a new one
    expect(user.role).toBe("admin"); // role preserved
    expect(state.insertCalled).toBe(false); // no duplicate account
    expect(state.updateCalled).toBe(true); // the row was linked to the provider id
  });

  it("returns the already-linked row without touching email or inserting", async () => {
    state.results = [
      [{ id: "u_linked", email: "linked@store.com", name: "L", role: "user", neonAuthUserId: "neon_3" }],
    ];

    const user = await bridgeNeonUser({
      id: "neon_3",
      email: "linked@store.com",
      name: "L",
      emailVerified: false,
    });

    expect(user.id).toBe("u_linked");
    expect(state.insertCalled).toBe(false);
    expect(state.updateCalled).toBe(false);
  });
});

// Pin the fix at the source level: the email lookup must be case-INSENSITIVE
// (`lower(email)`), because a case-sensitive match misses a mixed-case row and
// the bridge then creates a duplicate account for the same person.
describe("bridge email matching is case-insensitive", () => {
  it("matches on lower(email) in the bridge", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "auth.ts"), "utf8");
    expect(src).toContain("lower(${users.email})");
  });
});
