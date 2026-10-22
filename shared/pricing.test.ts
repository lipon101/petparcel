// The retail pricing rule and the email provider routing: both are pure
// functions that decide money and delivery, so they are pinned here.
import { describe, expect, it } from "vitest";
import {
  cleanPricePoint,
  marginRatio,
  retailPriceCents,
  DEFAULT_MARKUP_MULTIPLIER,
} from "./pricing";
import { providerForKind, isCriticalEmail, CRITICAL_EMAIL_KINDS } from "../server/_core/email-routing";

describe("cleanPricePoint", () => {
  it("rounds UP to the next .99 and never below its input", () => {
    expect(cleanPricePoint(3075)).toBe(3099);
    expect(cleanPricePoint(3000)).toBe(3099);
    expect(cleanPricePoint(3099)).toBe(3099);
    expect(cleanPricePoint(1)).toBe(99);
  });
});

describe("retailPriceCents", () => {
  it("applies the documented markup over the real supplier cost", () => {
    // $10.01 cost x 3 = $30.03 -> next .99 = $30.99
    expect(retailPriceCents(1001)).toBe(3099);
  });

  it("never sells below cost plus the margin floor", () => {
    // A very cheap item: 3x would be tiny, so the $5 floor wins.
    const price = retailPriceCents(50);
    expect(price).toBeGreaterThanOrEqual(50 + 500);
  });

  it("leaves a healthy margin on every real cost", () => {
    for (const cost of [58, 413, 1001, 1796, 3499, 7943]) {
      const price = retailPriceCents(cost);
      expect(price).toBeGreaterThan(cost);
      expect(marginRatio(cost, price)).toBeGreaterThan(0.5);
    }
  });

  it("is monotonic: a dearer variant never prices below a cheaper one", () => {
    let prev = 0;
    for (const cost of [100, 500, 1001, 2000, 5000, 10000]) {
      const price = retailPriceCents(cost);
      expect(price).toBeGreaterThanOrEqual(prev);
      prev = price;
    }
  });

  it("uses a 3x default markup", () => {
    expect(DEFAULT_MARKUP_MULTIPLIER).toBe(3);
  });
});

describe("email provider routing", () => {
  it("sends order/payment confirmation through Resend", () => {
    expect(providerForKind("order_confirmation")).toBe("resend");
    expect(providerForKind("shipping_notification")).toBe("resend");
    expect(providerForKind("admin_new_order")).toBe("resend");
  });

  it("sends everything else through the secondary provider", () => {
    for (const kind of [
      "auth_verification",
      "auth_password_reset",
      "auth_magic_link",
      "contact_message",
      "welcome",
    ]) {
      expect(providerForKind(kind)).toBe("smtp");
    }
  });

  it("routes an UNKNOWN kind to the secondary provider, never spending Resend's cap", () => {
    expect(providerForKind("some_future_kind")).toBe("smtp");
  });

  it("keeps the critical list small and explicit", () => {
    expect(CRITICAL_EMAIL_KINDS).toHaveLength(5);
    expect(isCriticalEmail("order_confirmation")).toBe(true);
    expect(isCriticalEmail("payment_confirmation")).toBe(true);
    expect(isCriticalEmail("unpaid_alert")).toBe(true);
    expect(isCriticalEmail("welcome")).toBe(false);
  });
});
