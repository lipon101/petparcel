// Regression tests for the NOWPayments integration.
//
// These pin the three things that decide whether money is handled correctly:
//   1. the IPN signature rule (a forged callback must never be trusted),
//   2. the status mapping (only `finished` may ship goods),
//   3. the fail-safe posture (no keys = no charge, no secret = no trust).
//
// The signature is checked against a vector computed the same way NOWPayments
// documents it - recursively key-sorted JSON, HMAC-SHA512, hex - so a change to
// the sort or the digest fails here rather than in production.
import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  computeIpnSignature,
  isPaidStatus,
  isTerminalStage,
  parseNotification,
  paymentStage,
  refundStage,
  refundStatusLabel,
  sortObject,
  statusLabel,
  storePaymentStatusFor,
  toPaymentStatusView,
  verifyIpnSignature,
} from "./nowpayments";

const SECRET = "test-ipn-secret";

/** Sign a body exactly as the provider does, for use as a known-good vector. */
function sign(payload: unknown, secret = SECRET): string {
  return createHmac("sha512", secret).update(JSON.stringify(sortObject(payload))).digest("hex");
}

describe("sortObject", () => {
  it("sorts keys recursively, including inside nested objects", () => {
    const sorted = sortObject({ b: 1, a: { d: 2, c: 3 } }) as Record<string, unknown>;
    expect(Object.keys(sorted)).toEqual(["a", "b"]);
    expect(Object.keys(sorted.a as Record<string, unknown>)).toEqual(["c", "d"]);
  });

  it("preserves array order while sorting objects inside it", () => {
    const sorted = sortObject([{ b: 1, a: 2 }]) as Array<Record<string, unknown>>;
    expect(Object.keys(sorted[0])).toEqual(["a", "b"]);
  });
});

describe("verifyIpnSignature", () => {
  const body = {
    payment_id: 12345,
    payment_status: "finished",
    order_id: "PP-ABCDEFGH",
    price_amount: 84.97,
    fee: { currency: "usd", amount: 1.2 },
  };

  it("accepts a correctly signed body", () => {
    expect(verifyIpnSignature(body, sign(body), SECRET).ok).toBe(true);
  });

  it("accepts a signature regardless of header case", () => {
    expect(verifyIpnSignature(body, sign(body).toUpperCase(), SECRET).ok).toBe(true);
  });

  it("rejects a body whose contents were altered after signing", () => {
    const sig = sign(body);
    const tampered = { ...body, payment_status: "finished", price_amount: 0.01 };
    expect(verifyIpnSignature(tampered, sig, SECRET).ok).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifyIpnSignature(body, sign(body, "other-secret"), SECRET).ok).toBe(false);
  });

  it("rejects a missing, malformed or truncated header", () => {
    expect(verifyIpnSignature(body, null, SECRET).ok).toBe(false);
    expect(verifyIpnSignature(body, "", SECRET).ok).toBe(false);
    expect(verifyIpnSignature(body, "not-hex", SECRET).ok).toBe(false);
    expect(verifyIpnSignature(body, sign(body).slice(0, 64), SECRET).ok).toBe(false);
  });

  it("refuses everything when no secret is configured (fail-safe, not fail-open)", () => {
    const verdict = verifyIpnSignature(body, sign(body), "");
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/no IPN secret/i);
  });

  it("is insensitive to key order in the incoming body", () => {
    const reordered = {
      order_id: "PP-ABCDEFGH",
      fee: { amount: 1.2, currency: "usd" },
      price_amount: 84.97,
      payment_status: "finished",
      payment_id: 12345,
    };
    expect(verifyIpnSignature(reordered, sign(body), SECRET).ok).toBe(true);
  });
});

describe("computeIpnSignature", () => {
  it("produces a 128-char hex digest", () => {
    expect(computeIpnSignature({ a: 1 }, SECRET)).toMatch(/^[0-9a-f]{128}$/);
  });
});

describe("paymentStage / isPaidStatus", () => {
  it("treats ONLY finished as paid", () => {
    expect(paymentStage("finished")).toBe("paid");
    expect(isPaidStatus("finished")).toBe(true);
    for (const s of ["waiting", "confirming", "confirmed", "sending", "partially_paid"]) {
      expect(isPaidStatus(s)).toBe(false);
    }
  });

  it("never treats partially_paid as paid - a short payment must not ship", () => {
    expect(paymentStage("partially_paid")).toBe("confirming");
    expect(isPaidStatus("partially_paid")).toBe(false);
  });

  it("maps failure, expiry and refund states", () => {
    expect(paymentStage("failed")).toBe("failed");
    expect(paymentStage("expired")).toBe("expired");
    expect(paymentStage("refunded")).toBe("refunded");
  });

  it("treats an unknown status as pending, never as paid", () => {
    expect(paymentStage("something_new")).toBe("pending");
    expect(paymentStage("")).toBe("pending");
    expect(paymentStage(undefined as unknown as string)).toBe("pending");
  });

  it("is case- and whitespace-insensitive", () => {
    expect(paymentStage("  FINISHED ")).toBe("paid");
  });
});

describe("isTerminalStage", () => {
  it("is true only for states that will not change on their own", () => {
    expect(isTerminalStage("paid")).toBe(true);
    expect(isTerminalStage("failed")).toBe(true);
    expect(isTerminalStage("expired")).toBe(true);
    expect(isTerminalStage("refunded")).toBe(true);
    expect(isTerminalStage("pending")).toBe(false);
    expect(isTerminalStage("confirming")).toBe(false);
  });
});

describe("storePaymentStatusFor", () => {
  it("maps the provider vocabulary onto the store's own", () => {
    expect(storePaymentStatusFor("finished")).toBe("paid");
    expect(storePaymentStatusFor("failed")).toBe("failed");
    expect(storePaymentStatusFor("expired")).toBe("failed");
    expect(storePaymentStatusFor("refunded")).toBe("refunded");
    expect(storePaymentStatusFor("waiting")).toBe("unpaid");
    expect(storePaymentStatusFor("confirming")).toBe("unpaid");
    expect(storePaymentStatusFor("partially_paid")).toBe("unpaid");
  });
});

describe("statusLabel", () => {
  it("gives shopper-facing wording for real statuses", () => {
    expect(statusLabel("waiting")).toMatch(/waiting/i);
    expect(statusLabel("confirming")).toMatch(/blockchain/i);
    expect(statusLabel("finished")).toMatch(/complete/i);
    expect(statusLabel("partially_paid")).toMatch(/outstanding/i);
  });

  it("falls back rather than showing a raw token", () => {
    expect(statusLabel("weird_status")).toBe("Awaiting payment");
  });
});

describe("parseNotification", () => {
  it("normalises a payment notification", () => {
    const note = parseNotification({
      payment_id: 999,
      invoice_id: 555,
      payment_status: "finished",
      order_id: "PP-ABCDEFGH",
      price_amount: "84.97",
      price_currency: "usd",
      pay_currency: "usdttrc20",
      actually_paid: 84.97,
    });
    expect(note).not.toBeNull();
    expect(note!.paymentId).toBe("999");
    expect(note!.invoiceId).toBe("555");
    expect(note!.orderId).toBe("PP-ABCDEFGH");
    expect(note!.stage).toBe("paid");
    expect(note!.priceAmount).toBe(84.97);
    expect(note!.payCurrency).toBe("usdttrc20");
  });

  it("returns null for a payout notification (no payment_status)", () => {
    expect(parseNotification({ payout_id: 1, status: "finished" })).toBeNull();
    expect(parseNotification(null)).toBeNull();
    expect(parseNotification({})).toBeNull();
  });
});

describe("toPaymentStatusView", () => {
  it("reports the real provider state and terminality", () => {
    const view = toPaymentStatusView(
      { payment_id: 1, payment_status: "confirming", pay_currency: "btc", pay_amount: 0.001 },
      { paymentStatus: "unpaid" },
    );
    expect(view.stage).toBe("confirming");
    expect(view.terminal).toBe(false);
    expect(view.paymentStatus).toBe("unpaid");
    expect(view.payCurrency).toBe("btc");
  });

  it("never downgrades a stored paid order when the lookup is empty", () => {
    const view = toPaymentStatusView(null, { paymentStatus: "paid" });
    expect(view.paymentStatus).toBe("paid");
    expect(view.awaitingPayment).toBe(true);
  });

  it("surfaces a lookup error without losing the stored status", () => {
    const view = toPaymentStatusView(null, { paymentStatus: "unpaid", error: "provider down" });
    expect(view.error).toBe("provider down");
    expect(view.paymentStatus).toBe("unpaid");
  });

  it("marks a finished payment as paid and terminal", () => {
    const view = toPaymentStatusView({ payment_status: "finished" }, { paymentStatus: "unpaid" });
    expect(view.paymentStatus).toBe("paid");
    expect(view.terminal).toBe(true);
  });

  it("carries the `configured` flag through, so the UI can tell offline mode apart", () => {
    expect(toPaymentStatusView(null, { paymentStatus: "unpaid", configured: false }).configured).toBe(
      false,
    );
    expect(toPaymentStatusView(null, { paymentStatus: "unpaid", configured: true }).configured).toBe(
      true,
    );
  });
});

// A crypto refund is a PAYOUT, not an instant reversal. These pin the mapping
// that decides whether the store claims money moved back: the single most
// dangerous mistake here is reporting a refund as done when it is still in
// flight, or as failed when it succeeded.
describe("refundStage", () => {
  it("treats an accepted-but-unsent refund as `created`, not `refunded`", () => {
    expect(refundStage("created")).toBe("created");
    expect(refundStage("pending")).toBe("created");
    expect(refundStage("processing")).toBe("created");
  });

  it("treats finished/success as `refunded`", () => {
    expect(refundStage("refunded")).toBe("refunded");
    expect(refundStage("finished")).toBe("refunded");
    expect(refundStage("success")).toBe("refunded");
  });

  it("treats a rejected refund as `failed`", () => {
    expect(refundStage("failed")).toBe("failed");
    expect(refundStage("rejected")).toBe("failed");
  });

  it("is total: an unrecognised or empty status is `unknown`, never `refunded`", () => {
    expect(refundStage("something_new")).toBe("unknown");
    expect(refundStage("")).toBe("unknown");
    expect(refundStage(null)).toBe("unknown");
    expect(refundStage(undefined)).toBe("unknown");
  });

  it("normalises case and surrounding whitespace", () => {
    expect(refundStage("  REFUNDED ")).toBe("refunded");
    expect(refundStage("Failed")).toBe("failed");
  });
});

describe("refundStatusLabel", () => {
  it("gives every stage a human label, including unknown", () => {
    expect(refundStatusLabel("created")).toMatch(/created/i);
    expect(refundStatusLabel("refunded")).toMatch(/refunded/i);
    expect(refundStatusLabel("failed")).toMatch(/failed/i);
    expect(refundStatusLabel("garbage")).toMatch(/unknown/i);
  });
});
