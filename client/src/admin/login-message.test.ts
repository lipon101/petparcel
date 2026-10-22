// Tests for the admin sign-in's message rules (./login-message).
//
// Pure functions, so they need no DOM - vitest runs `environment: "node"` here
// and jsdom is deliberately not a dependency (see vitest.config.ts). These pin
// the two things that matter at a management door: a rejection never reveals
// whether an account exists, and a lockout is distinguishable from an ordinary
// refusal so the page can warn rather than blame.
import { describe, expect, it } from "vitest";
import {
  ADMIN_LOGIN_LOCKED,
  ADMIN_LOGIN_REFUSED,
  ADMIN_LOGIN_WARN_THRESHOLD,
  attemptsRemaining,
  classifyAdminLoginError,
} from "./login-message";

describe("classifyAdminLoginError", () => {
  it("treats TOO_MANY_REQUESTS as a lockout and uses the server's sentence", () => {
    const info = classifyAdminLoginError({ data: { code: "TOO_MANY_REQUESTS" } });
    expect(info.kind).toBe("locked");
    expect(info.locked).toBe(true);
    expect(info.message).toBe(ADMIN_LOGIN_LOCKED);
  });

  it("also recognises a lockout from the server's own sentence", () => {
    // Defensive: if the transport ever loses the code, the message still tells
    // us this is a lockout rather than a bad password.
    const info = classifyAdminLoginError({ message: ADMIN_LOGIN_LOCKED });
    expect(info.locked).toBe(true);
    expect(info.message).toBe(ADMIN_LOGIN_LOCKED);
  });

  it("treats FORBIDDEN as a plain refusal with the ONE non-revealing sentence", () => {
    const info = classifyAdminLoginError({ data: { code: "FORBIDDEN" }, message: "raw" });
    expect(info.kind).toBe("refused");
    expect(info.locked).toBe(false);
    // The wording must never be the server's raw text - it says the same thing
    // for every rejected account, so nothing about the account leaks.
    expect(info.message).toBe(ADMIN_LOGIN_REFUSED);
  });

  it("treats UNAUTHORIZED the same way", () => {
    expect(classifyAdminLoginError({ data: { code: "UNAUTHORIZED" } }).message).toBe(
      ADMIN_LOGIN_REFUSED,
    );
  });

  it("falls back to the caller's sentence for an unknown failure", () => {
    const info = classifyAdminLoginError({ data: { code: "INTERNAL_SERVER_ERROR" } }, "Try later.");
    expect(info.kind).toBe("refused");
    expect(info.message).toBe("Try later.");
  });

  it("never throws on an empty/unknown error and always yields a sentence", () => {
    for (const bad of [null, undefined, {}, { message: "  " }]) {
      const info = classifyAdminLoginError(bad);
      expect(info.message).toBe(ADMIN_LOGIN_REFUSED);
      expect(info.locked).toBe(false);
    }
  });
});

describe("attemptsRemaining", () => {
  it("counts down from the warn threshold and never goes negative", () => {
    expect(attemptsRemaining(0)).toBe(ADMIN_LOGIN_WARN_THRESHOLD);
    expect(attemptsRemaining(2)).toBe(ADMIN_LOGIN_WARN_THRESHOLD - 2);
    expect(attemptsRemaining(99)).toBe(0);
    expect(attemptsRemaining(-5)).toBe(ADMIN_LOGIN_WARN_THRESHOLD);
  });

  it("tolerates a non-finite count", () => {
    expect(attemptsRemaining(Number.NaN)).toBe(ADMIN_LOGIN_WARN_THRESHOLD);
  });
});
