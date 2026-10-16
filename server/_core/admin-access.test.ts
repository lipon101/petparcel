// Tests for the SINGLE-ADMIN rule (server/_core/admin-access.ts).
//
// This is the rule every `admin.*` procedure and the dedicated admin login share,
// so it is worth testing on its own: an anonymous caller never reaches it (the
// protected layer refuses first), but a signed-in account that is not the store's
// ONE admin - even one carrying the `admin` role - must be refused here.
import { afterEach, describe, expect, it } from "vitest";
import {
  designatedAdminEmail,
  isDesignatedAdmin,
  normalizeEmail,
} from "./admin-access";

const ORIGINAL = process.env.ADMIN_EMAIL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = ORIGINAL;
});

describe("normalizeEmail", () => {
  it("trims and lower-cases, and treats a missing value as empty", () => {
    expect(normalizeEmail("  Owner@Store.COM ")).toBe("owner@store.com");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("designatedAdminEmail", () => {
  it("returns the lower-cased env value, or null when unset/blank", () => {
    process.env.ADMIN_EMAIL = " Owner@Store.com ";
    expect(designatedAdminEmail()).toBe("owner@store.com");
    process.env.ADMIN_EMAIL = "   ";
    expect(designatedAdminEmail()).toBeNull();
    delete process.env.ADMIN_EMAIL;
    expect(designatedAdminEmail()).toBeNull();
  });
});

describe("isDesignatedAdmin", () => {
  it("refuses anything without the admin role", () => {
    delete process.env.ADMIN_EMAIL;
    expect(isDesignatedAdmin(null)).toBe(false);
    expect(isDesignatedAdmin(undefined)).toBe(false);
    expect(isDesignatedAdmin({ role: "user" })).toBe(false);
    expect(isDesignatedAdmin({ role: null })).toBe(false);
    expect(isDesignatedAdmin({ role: "admin-ish" })).toBe(false);
  });

  it("falls back to role-only when ADMIN_EMAIL is not set", () => {
    delete process.env.ADMIN_EMAIL;
    expect(isDesignatedAdmin({ role: "admin", email: "anyone@store.com" })).toBe(true);
    process.env.ADMIN_EMAIL = "";
    expect(isDesignatedAdmin({ role: "admin", email: "anyone@store.com" })).toBe(true);
  });

  it("pins to the ONE address when ADMIN_EMAIL is set", () => {
    process.env.ADMIN_EMAIL = "owner@store.com";
    expect(isDesignatedAdmin({ role: "admin", email: "owner@store.com" })).toBe(true);
    // Case / whitespace differences still match the designated address.
    expect(isDesignatedAdmin({ role: "admin", email: " OWNER@Store.com " })).toBe(true);
    // A SECOND account that somehow holds the admin role is STILL refused.
    expect(isDesignatedAdmin({ role: "admin", email: "other-admin@store.com" })).toBe(false);
    // An admin role with no email cannot match a designated address.
    expect(isDesignatedAdmin({ role: "admin" })).toBe(false);
    expect(isDesignatedAdmin({ role: "admin", email: null })).toBe(false);
  });
});
