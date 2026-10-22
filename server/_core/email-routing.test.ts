// The provider-routing contract, as a pure function.
//
// WHY THIS IS TESTED. The split exists so Resend's hard daily cap can never cut
// off a sign-in link or a contact reply. That guarantee is only real if EVERY
// kind resolves to exactly one provider and the critical set stays small - a
// kind that silently drifted to Resend would spend the scarce allowance, and a
// kind that drifted the other way would put a customer's receipt on the
// secondary provider. Both are invisible until an outage, so they are pinned
// here.
import { describe, expect, it } from "vitest";
import {
  CRITICAL_EMAIL_KINDS,
  isCriticalEmail,
  providerForKind,
  type EmailKind,
} from "./email-routing";

const ALL_KINDS: EmailKind[] = [
  "order_confirmation",
  "payment_confirmation",
  "shipping_notification",
  "contact_message",
  "welcome",
  "admin_new_order",
  "auth_verification",
  "auth_password_reset",
  "auth_magic_link",
];

describe("email provider routing", () => {
  it("sends order/payment confirmation and the admin alert through Resend", () => {
    expect(providerForKind("order_confirmation")).toBe("resend");
    expect(providerForKind("payment_confirmation")).toBe("resend");
    expect(providerForKind("shipping_notification")).toBe("resend");
    expect(providerForKind("admin_new_order")).toBe("resend");
  });

  it("sends sign-in, password reset, contact replies and welcome through the secondary provider", () => {
    expect(providerForKind("auth_verification")).toBe("smtp");
    expect(providerForKind("auth_password_reset")).toBe("smtp");
    expect(providerForKind("auth_magic_link")).toBe("smtp");
    expect(providerForKind("contact_message")).toBe("smtp");
    expect(providerForKind("welcome")).toBe("smtp");
  });

  it("routes an UNKNOWN kind to the secondary provider, never to the scarce one", () => {
    // A future kind added without updating the list must not be able to spend
    // Resend's allowance.
    expect(providerForKind("some_future_kind")).toBe("smtp");
    expect(providerForKind("")).toBe("smtp");
  });

  it("resolves every known kind to exactly one provider", () => {
    for (const kind of ALL_KINDS) {
      const provider = providerForKind(kind);
      expect(["resend", "smtp"]).toContain(provider);
      expect(isCriticalEmail(kind)).toBe(provider === "resend");
    }
  });

  it("keeps the critical set small - only the mail whose loss is an incident", () => {
    expect([...CRITICAL_EMAIL_KINDS].sort()).toEqual([
      "admin_new_order",
      "order_confirmation",
      "payment_confirmation",
      "shipping_notification",
      // The unpaid-order alert is an OWNER alert about money that has not
      // arrived - losing it means an order is never chased.
      "unpaid_alert",
    ]);
  });
});
