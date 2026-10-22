// Regression tests for the two input-hardening helpers. These are the guards
// that stand between a crafted request and a stored order, so each rule is
// pinned here rather than trusted to review.
import { describe, expect, it } from "vitest";
import {
  assertCardDetailsAcceptable,
  cvvValid,
  detectBrand,
  expiryValid,
  inspectCard,
  luhnValid,
} from "./card-validate";
import { createRateLimiter } from "./rate-limit";

describe("luhnValid", () => {
  it("accepts a number that passes the mod-10 checksum", () => {
    // A real-format Visa, already in the blocklist below but checksum-valid.
    expect(luhnValid("4242424242424242")).toBe(true);
  });

  it("rejects a single mistyped digit", () => {
    expect(luhnValid("4242424242424241")).toBe(false);
  });

  it("rejects non-numeric and out-of-range lengths", () => {
    expect(luhnValid("4242 4242 4242 4242")).toBe(false);
    expect(luhnValid("1234")).toBe(false);
    expect(luhnValid("1".repeat(20))).toBe(false);
  });
});

describe("detectBrand", () => {
  it("identifies the major networks", () => {
    expect(detectBrand("4111111111111111")).toBe("visa");
    expect(detectBrand("5555555555554444")).toBe("mastercard");
    expect(detectBrand("378282246310005")).toBe("amex");
    expect(detectBrand("6011111111111117")).toBe("discover");
    expect(detectBrand("3566002020360505")).toBe("jcb");
  });

  it("returns unknown rather than guessing", () => {
    expect(detectBrand("9999999999999999")).toBe("unknown");
  });
});

describe("expiryValid", () => {
  const now = new Date("2026-06-15T00:00:00Z");

  it("accepts a card good through the current month", () => {
    expect(expiryValid("06/26", now)).toBe(true); // last day of June is still ahead
  });

  it("rejects a month that has already passed", () => {
    expect(expiryValid("05/26", now)).toBe(false);
  });

  it("rejects impossible months and absurd years", () => {
    expect(expiryValid("13/26", now)).toBe(false);
    expect(expiryValid("00/26", now)).toBe(false);
    expect(expiryValid("06/99", now)).toBe(false); // not 1999, and not 2099
  });

  it("accepts the four-digit year form", () => {
    expect(expiryValid("12/2027", now)).toBe(true);
  });
});

describe("cvvValid", () => {
  it("wants three digits on everything except Amex", () => {
    expect(cvvValid("123", "visa")).toBe(true);
    expect(cvvValid("1234", "visa")).toBe(false);
    expect(cvvValid("1234", "amex")).toBe(true);
    expect(cvvValid("123", "amex")).toBe(false);
  });
});

describe("assertCardDetailsAcceptable", () => {
  it("allows an absent card group (the hosted-checkout path)", () => {
    expect(() => assertCardDetailsAcceptable(undefined)).not.toThrow();
    expect(() => assertCardDetailsAcceptable(null)).not.toThrow();
    expect(() => assertCardDetailsAcceptable({})).not.toThrow();
  });

  it("refuses a published test card even though it passes the checksum", () => {
    // The whole point of the blocklist: Luhn alone would let this order through.
    expect(inspectCard({ number: "4242424242424242" }).luhn).toBe(true);
    expect(() =>
      assertCardDetailsAcceptable({
        number: "4242424242424242",
        expiry: "12/29",
        cvv: "123",
      }),
    ).toThrow(/test card/i);
  });

  it("refuses a number that fails the checksum", () => {
    expect(() =>
      assertCardDetailsAcceptable({ number: "4242424242424241", expiry: "12/29", cvv: "123" }),
    ).toThrow(/doesn't look right/i);
  });

  it("refuses a past expiry", () => {
    const past = String(new Date().getFullYear() - 1).slice(-2);
    expect(() =>
      assertCardDetailsAcceptable({ number: "4033300000000007", expiry: `01/${past}`, cvv: "123" }),
    ).toThrow(/expiry/i);
  });

  it("refuses a malformed CVV", () => {
    expect(() =>
      assertCardDetailsAcceptable({ number: "4033300000000007", expiry: "12/29", cvv: "1" }),
    ).toThrow(/security code/i);
  });

  it("refuses a 3-digit CVV on an Amex", () => {
    expect(() =>
      assertCardDetailsAcceptable({ number: "370123456789017", expiry: "12/29", cvv: "123" }),
    ).toThrow(/American Express/i);
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit inside the window, then blocks", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("a")).toBe(false); // 4th attempt in the window
  });

  it("counts each caller separately", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    expect(limiter.check("a")).toBe(true);
    expect(limiter.check("b")).toBe(true);
    expect(limiter.check("a")).toBe(false);
  });

  it("lets a caller back in once the window has rolled over", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    expect(limiter.check("a", 0)).toBe(true);
    expect(limiter.check("a", 500)).toBe(false);
    expect(limiter.check("a", 1_001)).toBe(true);
  });
});
