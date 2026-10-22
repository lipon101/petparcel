// Guards the global interactive-API rate limit added in front of every /api and
// /trpc call.
//
// TWO THINGS ARE WORTH PINNING HERE, and both are silent failure modes:
//
//   1. The EXEMPT list. If a path that authenticates its caller by signature
//      (webhooks, payments, cron, platform jobs) ever fell through to the global
//      limit, a retry storm could have a legitimate payment notification or
//      delivery event answered with a 429 - money and data lost, with no error
//      anyone would necessarily see.
//   2. The CEILING must stay clear of real human traffic. The whole premise of
//      the control is that a shopper is never throttled; if the number were
//      tightened to "look stricter", the site would start refusing real people.
import { describe, expect, it } from "vitest";
import {
  GLOBAL_API_LIMIT_MAX,
  GLOBAL_API_LIMIT_WINDOW_MS,
  createRateLimiter,
  isGlobalRateLimitedPath,
  isRateLimitExemptPath,
} from "./rate-limit";

describe("isRateLimitExemptPath", () => {
  // Every one of these verifies its caller's signature before doing any work, so
  // a rate limit adds no security - only the risk of dropping the request.
  it.each([
    ["/api/webhooks/resend"],
    ["/api/payments/bachs/webhook"],
    ["/api/cron/cj-stock-sync"],
    ["/api/cron/live-api-health-check"],
    ["/api/_jobs/cj-price-sync"],
  ])("exempts the signature-verified path %s", (path) => {
    expect(isRateLimitExemptPath(path)).toBe(true);
  });

  it.each([
    ["/api/health"],
    ["/trpc/auth.login"],
    ["/trpc/cart.add"],
    ["/assets/index-abc123.js"],
    ["/product/chew-toy"],
    ["/"],
  ])("does not exempt the ordinary path %s", (path) => {
    expect(isRateLimitExemptPath(path)).toBe(false);
  });
});

describe("isGlobalRateLimitedPath", () => {
  it("covers both interactive API surfaces", () => {
    expect(isGlobalRateLimitedPath("/api/health")).toBe(true);
    expect(isGlobalRateLimitedPath("/trpc/cart.get")).toBe(true);
  });

  it("leaves the signature-verified paths alone", () => {
    expect(isGlobalRateLimitedPath("/api/webhooks/resend")).toBe(false);
    expect(isGlobalRateLimitedPath("/api/payments/bachs/webhook")).toBe(false);
    expect(isGlobalRateLimitedPath("/api/cron/cj-stock-sync")).toBe(false);
    expect(isGlobalRateLimitedPath("/api/_jobs/cj-stock-sync")).toBe(false);
  });

  it("does not throttle the SPA shell or its assets, which the CDN serves", () => {
    expect(isGlobalRateLimitedPath("/")).toBe(false);
    expect(isGlobalRateLimitedPath("/index.html")).toBe(false);
    expect(isGlobalRateLimitedPath("/assets/index-abc.js")).toBe(false);
    expect(isGlobalRateLimitedPath("/product/chew-toy")).toBe(false);
  });
});

describe("the global ceiling", () => {
  it("allows a burst a real shopper could plausibly generate, then refuses", () => {
    const limiter = createRateLimiter({
      windowMs: GLOBAL_API_LIMIT_WINDOW_MS,
      max: GLOBAL_API_LIMIT_MAX,
    });
    // A cold, cache-miss first load is the busiest a human gets. 60 calls is a
    // generous stand-in for it, and every one must pass.
    for (let i = 0; i < 60; i += 1) {
      expect(limiter.check("198.51.100.7")).toBe(true);
    }
    // Run up to the ceiling.
    for (let i = 60; i < GLOBAL_API_LIMIT_MAX; i += 1) {
      expect(limiter.check("198.51.100.7")).toBe(true);
    }
    // The request past the ceiling is refused...
    expect(limiter.check("198.51.100.7")).toBe(false);
    // ...while a DIFFERENT caller is unaffected - the limit is per caller, so one
    // abuser cannot lock out the rest of the internet.
    expect(limiter.check("203.0.113.9")).toBe(true);
  });

  it("is set well above real human traffic and far below script volume", () => {
    expect(GLOBAL_API_LIMIT_MAX).toBeGreaterThanOrEqual(120);
    expect(GLOBAL_API_LIMIT_MAX).toBeLessThanOrEqual(1000);
    expect(GLOBAL_API_LIMIT_WINDOW_MS).toBe(60_000);
  });

  it("starts a fresh window once the old one expires", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const t0 = 1_000_000;
    expect(limiter.check("k", t0)).toBe(true);
    expect(limiter.check("k", t0 + 1)).toBe(true);
    expect(limiter.check("k", t0 + 2)).toBe(true);
    expect(limiter.check("k", t0 + 3)).toBe(false);
    // One millisecond past the window, the counter resets.
    expect(limiter.check("k", t0 + 60_001)).toBe(true);
  });
});
