// Wiring tests for the auth surfaces. vitest runs in a node environment here (no
// jsdom), so component behaviour is pinned by reading the source text - the same
// approach the admin header/gate tests use. These assert the things that were
// actually broken: the verifier is stripped, the exchange is server-side, the
// callback cannot spin forever, and the forgot-password door exists.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), "utf8");

describe("GoogleCallback", () => {
  const src = read("./GoogleCallback.tsx");

  it("strips the verifier from the URL before the exchange", () => {
    expect(src).toContain("stripSessionVerifier");
    expect(src).toContain("history.replaceState");
    // The strip must happen while reading the verifier, i.e. before the effect
    // that performs the exchange.
    expect(src.indexOf("replaceState")).toBeLessThan(src.indexOf("void run()"));
  });

  it("races the exchange against a timeout so it can never spin forever", () => {
    expect(src).toContain("withTimeout");
    expect(src).toContain("EXCHANGE_TIMEOUT_MS");
  });

  it("offers a retry and a way back to sign in on failure", () => {
    expect(src).toContain("Try again");
    expect(src).toContain('to="/login"');
  });

  it("never renders a raw provider or error message", () => {
    // The catch collapses to the shared constant; nothing interpolates `err`.
    expect(src).toContain("GOOGLE_FAILURE_MESSAGE");
    expect(src).not.toMatch(/setError\(\s*(err|e)\b/);
  });
});

describe("useAuth google + reset wiring", () => {
  const src = read("../_core/useAuth.tsx");

  it("completes the sign-in on the server with the verifier, not in the browser", () => {
    expect(src).toContain("googleSignInComplete");
    expect(src).toContain("verifier");
    // The old browser-side /get-session exchange must be gone.
    expect(src).not.toContain("/get-session");
    expect(src).not.toContain("readProviderToken");
  });

  it("exposes the password-reset calls", () => {
    expect(src).toContain("requestPasswordReset");
    expect(src).toContain("resetPassword");
  });
});

describe("Login page", () => {
  const src = read("./Login.tsx");

  it("offers a Forgot password link to the reset request page", () => {
    expect(src).toContain("Forgot password?");
    expect(src).toContain('to="/forgot-password"');
  });
});

describe("App routes", () => {
  const src = read("../App.tsx");

  it("registers the forgot/reset password routes", () => {
    expect(src).toContain('path="/forgot-password"');
    expect(src).toContain('path="/reset-password"');
  });

  it("strips a stray verifier on any route", () => {
    expect(src).toContain("readSessionVerifier");
    expect(src).toContain("stripSessionVerifier");
  });
});
