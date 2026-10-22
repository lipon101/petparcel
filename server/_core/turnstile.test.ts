import { afterEach, describe, expect, it, vi } from "vitest";
import { assertTurnstile, turnstileConfigured, verifyTurnstile } from "./turnstile";

// The Turnstile check is the one control that decides whether an anonymous
// visitor may make the server do work (create an account, send mail). These
// tests pin the two properties that matter: it is a NO-OP until configured, and
// once configured it FAILS CLOSED - a missing token, a rejected token, and an
// unreachable Cloudflare all refuse the submission.

const ORIGINAL = process.env.TURNSTILE_SECRET_KEY;

function setSecret(v: string | undefined) {
  if (v === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = v;
}

afterEach(() => {
  setSecret(ORIGINAL);
  vi.restoreAllMocks();
});

describe("turnstileConfigured", () => {
  it("is false with no secret and true with one", () => {
    setSecret(undefined);
    expect(turnstileConfigured()).toBe(false);
    setSecret("0x4AAAAAAAsomesecret");
    expect(turnstileConfigured()).toBe(true);
  });
});

describe("verifyTurnstile", () => {
  it("passes without calling Cloudflare when unconfigured", async () => {
    setSecret(undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const verdict = await verifyTurnstile(undefined);
    expect(verdict.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a missing token once configured", async () => {
    setSecret("0x4AAAAAAAsomesecret");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const verdict = await verifyTurnstile(undefined);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("missing-input-response");
    // A missing token is decided locally - no round trip needed.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes when Cloudflare says success", async () => {
    setSecret("0x4AAAAAAAsomesecret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const verdict = await verifyTurnstile("a-real-token", "203.0.113.7");
    expect(verdict.ok).toBe(true);
  });

  it("refuses when Cloudflare rejects the token, surfacing its codes", async () => {
    setSecret("0x4AAAAAAAsomesecret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), {
        status: 200,
      }),
    );
    const verdict = await verifyTurnstile("a-bad-token");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain("invalid-input-response");
  });

  it("FAILS CLOSED when Cloudflare is unreachable", async () => {
    setSecret("0x4AAAAAAAsomesecret");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const verdict = await verifyTurnstile("a-token");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("verification-unreachable");
  });
});

describe("assertTurnstile", () => {
  it("resolves (no-op) when unconfigured, even with no token", async () => {
    setSecret(undefined);
    await expect(assertTurnstile(undefined)).resolves.toBeUndefined();
  });

  it("throws a shopper-safe BAD_REQUEST when configured and the token is missing", async () => {
    setSecret("0x4AAAAAAAsomesecret");
    await expect(assertTurnstile(undefined)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("verify that you're human"),
    });
  });

  it("resolves when configured and the token verifies", async () => {
    setSecret("0x4AAAAAAAsomesecret");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    await expect(assertTurnstile("good-token")).resolves.toBeUndefined();
  });
});
