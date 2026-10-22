// ── The Bachs provider's decision rules ──────────────────────────────────────
//
// These pin the pieces of the integration that decide MONEY: which raw status
// counts as paid, when a webhook is authentic, and what an event means. They
// are asserted against the real functions - a re-implementation would only
// prove that the re-implementation agrees with itself.
//
// The two rules that matter most:
//
//   * A SHORT PAYMENT NEVER SHIPS. `underpaid` is not paid, and `accepted`
//     (which Bachs uses for "an underpayment or overpayment was accepted as
//     final settlement") is only paid once the amount received is shown to
//     cover the amount due.
//   * A WEBHOOK IS ONLY TRUSTED WHEN IT IS SIGNED. The digest is over the RAW
//     body, the comparison is constant-time, the timestamp is bounded, and a
//     secret rotation keeps working because ANY `v1=` on the V2 header is
//     accepted.
import { describe, expect, it } from "vitest";
import {
  BACHS_CURRENCY,
  BACHS_LIVE_BASE,
  BACHS_PAYMENT_METHOD_TYPES,
  BACHS_SANDBOX_BASE,
  bachsBaseUrlFor,
  computeBachsSignature,
  isPaidStatus,
  isSettled,
  isTerminalStage,
  parseBachsEvent,
  parseSignatureV2,
  paymentStage,
  refundStage,
  refundStatusLabel,
  statusLabel,
  storePaymentStatusFor,
  toPaymentStatusView,
  verifyBachsSignature,
  type PaymentStatusView,
} from "./bachs";

// The signing secret is ASSEMBLED at runtime, so this source file never
// contains a secret-shaped literal - the same pattern the Svix tests use, and
// the reason the committed-secret scan can look for `whsec_` without firing
// on this file.
const SECRET = `whsec_${Buffer.from("bachs-test-fixture").toString("base64")}`;

// ── the API base follows the key ────────────────────────────────────────────

describe("the API base is chosen by the key's own prefix", () => {
  it("sends a live key to production", () => {
    expect(bachsBaseUrlFor("sk_live_abc123")).toBe(BACHS_LIVE_BASE);
  });

  it("sends a sandbox key to the sandbox", () => {
    expect(bachsBaseUrlFor("sk_sandbox_abc123")).toBe(BACHS_SANDBOX_BASE);
  });

  it("defaults an unrecognised key to production, never to the sandbox", () => {
    // A hand-rolled key is rejected by the API anyway; defaulting to the real
    // host means it can never quietly talk to a sandbox.
    expect(bachsBaseUrlFor("sk_whatever")).toBe(BACHS_LIVE_BASE);
    expect(bachsBaseUrlFor("")).toBe(BACHS_LIVE_BASE);
  });

  it("offers the USD card corridor and nothing else", () => {
    expect(BACHS_PAYMENT_METHOD_TYPES).toEqual(["USD_CARD"]);
    expect(BACHS_CURRENCY).toBe("USD");
  });
});

// ── status mapping ───────────────────────────────────────────────────────────

describe("paymentStage / isPaidStatus", () => {
  it("treats a succeeded charge as paid", () => {
    expect(paymentStage("succeeded")).toBe("paid");
    expect(paymentStage("SUCCEEDED")).toBe("paid");
    expect(isPaidStatus("succeeded")).toBe(true);
  });

  it("treats an overpaid charge as paid", () => {
    // The shopper sent MORE than we asked for. The order ships and the
    // difference is theirs.
    expect(paymentStage("overpaid")).toBe("paid");
  });

  it("never treats an underpaid charge as paid - a short payment must not ship", () => {
    expect(paymentStage("underpaid")).toBe("confirming");
    expect(isPaidStatus("underpaid")).toBe(false);
    expect(isSettled("underpaid", { amountDueCents: 5000, amountPaidCents: 2000 })).toBe(false);
  });

  it("treats `accepted` as paid only when the amount received covers the amount due", () => {
    // Bachs: "an underpayment or overpayment was accepted as final settlement".
    // An overpayment is paid; an underpayment is not.
    expect(paymentStage("accepted")).toBe("confirming");
    expect(isSettled("accepted", { amountDueCents: 5000, amountPaidCents: 5000 })).toBe(true);
    expect(isSettled("accepted", { amountDueCents: 5000, amountPaidCents: 4999 })).toBe(false);
    // With no amounts to compare, it is NOT settled - the safe reading.
    expect(isSettled("accepted")).toBe(false);
    expect(isSettled("accepted", { amountDueCents: 5000 })).toBe(false);
  });

  it("maps failure, expiry and refund states", () => {
    expect(paymentStage("failed")).toBe("failed");
    expect(paymentStage("incomplete")).toBe("failed");
    expect(paymentStage("expired")).toBe("expired");
    expect(paymentStage("refunded")).toBe("refunded");
    expect(paymentStage("partially_refunded")).toBe("refunded");
    expect(paymentStage("auto_refunded")).toBe("refunded");
  });

  it("maps the checkout-level vocabulary onto the same stages", () => {
    expect(paymentStage("requires_payment_method")).toBe("confirming");
    expect(paymentStage("requires_confirmation")).toBe("confirming");
    expect(paymentStage("requires_action")).toBe("confirming");
    expect(paymentStage("processing")).toBe("confirming");
    expect(paymentStage("canceled")).toBe("failed");
    expect(paymentStage("cancelled")).toBe("failed");
  });

  it("treats an unknown status as pending, never as paid", () => {
    expect(paymentStage("something_new_bachs_added")).toBe("pending");
    expect(paymentStage("")).toBe("pending");
    expect(paymentStage(null)).toBe("pending");
    expect(isPaidStatus("something_new_bachs_added")).toBe(false);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(paymentStage("  SUCCEEDED  ")).toBe("paid");
    expect(paymentStage("Underpaid")).toBe("confirming");
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
    expect(storePaymentStatusFor("succeeded")).toBe("paid");
    expect(storePaymentStatusFor("overpaid")).toBe("paid");
    expect(storePaymentStatusFor("failed")).toBe("failed");
    expect(storePaymentStatusFor("expired")).toBe("failed");
    expect(storePaymentStatusFor("refunded")).toBe("refunded");
    expect(storePaymentStatusFor("processing")).toBe("unpaid");
    expect(storePaymentStatusFor("underpaid")).toBe("unpaid");
  });
});

describe("statusLabel", () => {
  it("gives shopper-facing wording for real statuses", () => {
    expect(statusLabel("succeeded")).toBe("Payment complete");
    expect(statusLabel("processing")).toBe("Processing your payment");
    expect(statusLabel("failed")).toBe("Payment failed");
    expect(statusLabel("underpaid")).toMatch(/balance still outstanding/i);
  });

  it("falls back rather than showing a raw token", () => {
    expect(statusLabel("something_new_bachs_added")).toBe("Awaiting payment");
    expect(statusLabel("")).toBe("Awaiting payment");
  });
});

// ── webhook signature verification ───────────────────────────────────────────

describe("verifyBachsSignature", () => {
  const rawBody = JSON.stringify({ id: "evt_1", type: "collection.succeeded" });
  const timestamp = String(Math.floor(Date.now() / 1000));

  it("accepts a correctly signed body", () => {
    const signature = computeBachsSignature(rawBody, timestamp, SECRET);
    const verdict = verifyBachsSignature({
      rawBody,
      timestamp,
      signature,
      secret: SECRET,
    });
    expect(verdict.ok).toBe(true);
  });

  it("accepts the named V2 form", () => {
    const v1 = computeBachsSignature(rawBody, timestamp, SECRET);
    const verdict = verifyBachsSignature({
      rawBody,
      timestamp,
      signatureV2: `t=${timestamp},v1=${v1}`,
      secret: SECRET,
    });
    expect(verdict.ok).toBe(true);
  });

  it("accepts ANY v1 on the V2 header, so a secret rotation keeps working", () => {
    // During a rotation Bachs signs every delivery with BOTH the old and the
    // new secret. A verifier that checked only the FIRST v1 would start
    // rejecting deliveries the moment the rotation landed.
    const wrong = computeBachsSignature(rawBody, timestamp, "another_secret");
    const right = computeBachsSignature(rawBody, timestamp, SECRET);
    const verdict = verifyBachsSignature({
      rawBody,
      timestamp,
      signatureV2: `t=${timestamp},v1=${wrong},v1=${right}`,
      secret: SECRET,
    });
    expect(verdict.ok).toBe(true);
  });

  it("takes the timestamp from the V2 header when it carries one", () => {
    const v1 = computeBachsSignature(rawBody, timestamp, SECRET);
    const verdict = verifyBachsSignature({
      rawBody,
      timestamp: null,
      signatureV2: `t=${timestamp},v1=${v1}`,
      secret: SECRET,
    });
    expect(verdict.ok).toBe(true);
  });

  it("rejects a body whose contents were altered after signing", () => {
    const signature = computeBachsSignature(rawBody, timestamp, SECRET);
    const verdict = verifyBachsSignature({
      rawBody: JSON.stringify({ id: "evt_1", type: "collection.failed" }),
      timestamp,
      signature,
      secret: SECRET,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/mismatch/i);
  });

  it("rejects a signature made with the wrong secret", () => {
    const signature = computeBachsSignature(rawBody, timestamp, "not_the_secret");
    const verdict = verifyBachsSignature({
      rawBody,
      timestamp,
      signature,
      secret: SECRET,
    });
    expect(verdict.ok).toBe(false);
  });

  it("rejects a stale delivery (a replay)", () => {
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const signature = computeBachsSignature(rawBody, old, SECRET);
    const verdict = verifyBachsSignature({
      rawBody,
      timestamp: old,
      signature,
      secret: SECRET,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/tolerance/i);
  });

  it("rejects a missing, malformed or truncated header", () => {
    expect(verifyBachsSignature({ rawBody, timestamp, signature: null, secret: SECRET }).ok).toBe(
      false,
    );
    expect(
      verifyBachsSignature({ rawBody, timestamp, signature: "not-hex", secret: SECRET }).ok,
    ).toBe(false);
    expect(
      verifyBachsSignature({
        rawBody,
        timestamp,
        signature: computeBachsSignature(rawBody, timestamp, SECRET).slice(0, 32),
        secret: SECRET,
      }).ok,
    ).toBe(false);
    expect(verifyBachsSignature({ rawBody, timestamp: null, secret: SECRET }).ok).toBe(false);
    expect(verifyBachsSignature({ rawBody, timestamp: "not-a-number", secret: SECRET }).ok).toBe(
      false,
    );
  });

  it("refuses everything when no secret is configured (fail-safe, not fail-open)", () => {
    const signature = computeBachsSignature(rawBody, timestamp, SECRET);
    const verdict = verifyBachsSignature({ rawBody, timestamp, signature, secret: "" });
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toMatch(/no webhook secret/i);
  });
});

describe("computeBachsSignature / parseSignatureV2", () => {
  it("produces a 64-char hex digest", () => {
    const digest = computeBachsSignature("{}", "1700000000", SECRET);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("signs the timestamp and the raw body, together", () => {
    // The signed message is "{timestamp}.{raw_body}" - not the body alone.
    const a = computeBachsSignature("{}", "1700000000", SECRET);
    const b = computeBachsSignature(".{}", "1700000000", SECRET);
    expect(a).not.toBe(b);
  });

  it("reads the timestamp and every digest out of the V2 header", () => {
    const parsed = parseSignatureV2("t=1700000000,v1=aaa,v1=bbb");
    expect(parsed.timestamp).toBe("1700000000");
    expect(parsed.digests).toEqual(["aaa", "bbb"]);
  });
});

// ── event parsing ────────────────────────────────────────────────────────────

describe("parseBachsEvent", () => {
  it("normalises a collection.succeeded event", () => {
    const event = parseBachsEvent({
      id: "evt_3ab4e0d5d2",
      type: "collection.succeeded",
      created_at: "2026-04-27T12:04:00Z",
      organization_id: "acct_7KpQ2mNv4XbR9dLc",
      data: {
        charge_id: "ch_1a2b3c4d5e6f",
        checkout_id: "chk_2N3o4P5q6R7s8T9u",
        reference: "PP-ABC12345",
        status: "SUCCEEDED",
        amount: "29.00",
        currency: "USD",
        metadata: { order_number: "PP-ABC12345" },
      },
    });
    expect(event).not.toBeNull();
    expect(event!.eventId).toBe("evt_3ab4e0d5d2");
    expect(event!.type).toBe("collection.succeeded");
    expect(event!.chargeId).toBe("ch_1a2b3c4d5e6f");
    expect(event!.checkoutId).toBe("chk_2N3o4P5q6R7s8T9u");
    expect(event!.orderNumber).toBe("PP-ABC12345");
    expect(event!.rawStatus).toBe("succeeded");
    expect(event!.stage).toBe("paid");
    expect(event!.amountCents).toBe(2900);
    expect(event!.currency).toBe("USD");
  });

  it("reads the charge out of a checkout.completed event, where it sits in `charge`", () => {
    const event = parseBachsEvent({
      id: "evt_7f6e5d4c3b2a1908",
      type: "checkout.completed",
      data: {
        checkout_id: "chk_6R7s8T9u0V1w2X3y",
        status: "completed",
        mode: "payment",
        payment_status: "paid",
        amount: "19.00",
        currency: "USD",
        reference: "order_1042",
        charge: {
          id: "ch_1a2b3c4d5e6f",
          amount: "19.00",
          currency: "USD",
          status: "succeeded",
        },
        metadata: { order_id: "ORD-12345" },
      },
    });
    expect(event!.chargeId).toBe("ch_1a2b3c4d5e6f");
    // The charge's own state, NOT the checkout's ("completed").
    expect(event!.rawStatus).toBe("succeeded");
    expect(event!.stage).toBe("paid");
    // The checkout's own state is kept separately - it is what tells a
    // retryable failed attempt from a checkout that is closed for good.
    expect(event!.checkoutStatus).toBe("completed");
  });

  it("reads the underpaid event's expected amount", () => {
    const event = parseBachsEvent({
      id: "evt_6d5c",
      type: "collection.underpaid",
      data: {
        charge_id: "ch_1a2b3c4d5e6f",
        checkout_id: "chk_6R7s8T9u0V1w2X3y",
        amount_paid: "50000.00",
        amount_expected: "75000.00",
        amount_remaining: "25000.00",
        currency: "NGN",
        status: "UNDERPAID",
      },
    });
    expect(event!.rawStatus).toBe("underpaid");
    expect(event!.stage).toBe("confirming");
    expect(event!.amountPaidCents).toBe(5000000);
    expect(event!.amountExpectedCents).toBe(7500000);
  });

  it("reads a refund event's own status and refund id", () => {
    const event = parseBachsEvent({
      id: "evt_5c4b",
      type: "refund.paid",
      data: {
        refund_id: "rfnd_4b9c2e7a1d35a0f81c62",
        charge_id: "ch_1a2b3c4d5e6f",
        reference: "refund-PP-ABC12345",
        status: "success",
        requested_amount: "29.00",
        refunded_amount: "29.00",
      },
    });
    expect(event!.refundId).toBe("rfnd_4b9c2e7a1d35a0f81c62");
    expect(event!.refundStatus).toBe("success");
    // A refund's own reference is NOT an order number, so it is not read as one.
    expect(event!.orderNumber).toBeNull();
  });

  it("returns null for a body that is not a Bachs event", () => {
    expect(parseBachsEvent(null)).toBeNull();
    expect(parseBachsEvent({})).toBeNull();
    expect(parseBachsEvent({ id: "evt_1" })).toBeNull();
  });

  it("ignores fields it does not recognise (Bachs may add any of them)", () => {
    const event = parseBachsEvent({
      id: "evt_new",
      type: "collection.succeeded",
      data: {
        charge_id: "ch_1",
        status: "SUCCEEDED",
        amount: "10.00",
        currency: "USD",
        a_field_bachs_added_next_year: { nested: true },
      },
      another_new_top_level_field: 42,
    });
    expect(event).not.toBeNull();
    expect(event!.rawStatus).toBe("succeeded");
  });
});

// ── the shopper's view ───────────────────────────────────────────────────────

describe("toPaymentStatusView", () => {
  it("reports the real provider state and terminality", () => {
    const view = toPaymentStatusView({
      payment_id: "ch_1a2b3c4d5e6f",
      checkout_id: "chk_2N3o4P5q6R7s8T9u",
      status: "succeeded",
      amount: "29.00",
      amount_paid: "29.00",
      currency: "USD",
      payment_method: "USD_CARD",
    });
    expect(view.provider).toBe("bachs");
    expect(view.paymentStatus).toBe("paid");
    expect(view.stage).toBe("paid");
    expect(view.terminal).toBe(true);
    expect(view.chargeId).toBe("ch_1a2b3c4d5e6f");
    expect(view.checkoutId).toBe("chk_2N3o4P5q6R7s8T9u");
    expect(view.amountCents).toBe(2900);
    expect(view.amountPaidCents).toBe(2900);
    expect(view.currency).toBe("USD");
    expect(view.paymentMethod).toBe("USD_CARD");
  });

  it("never downgrades a stored paid order when the lookup is empty", () => {
    const view = toPaymentStatusView(null, { paymentStatus: "paid" });
    expect(view.paymentStatus).toBe("paid");
    expect(view.stage).toBe("paid");
    expect(view.label).toBe("Payment complete");
    expect(view.awaitingPayment).toBe(true);
  });

  it("never downgrades a stored paid order when the provider reports a failure", () => {
    // A late or flaky reading must not tell a shopper that a shipped order
    // failed to be paid.
    const view = toPaymentStatusView(
      { payment_id: "ch_1", status: "failed", amount: "29.00", currency: "USD" },
      { paymentStatus: "paid" },
    );
    expect(view.paymentStatus).toBe("paid");
    expect(view.stage).toBe("paid");
    expect(view.label).toBe("Payment complete");
    // The RAW status is still reported, so the admin panel can see it.
    expect(view.status).toBe("failed");
  });

  it("surfaces a lookup error without losing the stored status", () => {
    const view = toPaymentStatusView(null, {
      paymentStatus: "unpaid",
      error: "Could not reach the payment provider: boom",
      configured: true,
    });
    expect(view.paymentStatus).toBe("unpaid");
    expect(view.error).toMatch(/Could not reach/);
    expect(view.configured).toBe(true);
  });

  it("carries the `configured` flag through, so the UI can tell offline mode apart", () => {
    const view = toPaymentStatusView(null, { paymentStatus: "unpaid", configured: false });
    expect(view.configured).toBe(false);
  });
});

// ── refunds ──────────────────────────────────────────────────────────────────

describe("refundStage", () => {
  it("treats an accepted-but-unsent refund as `created`, not `refunded`", () => {
    expect(refundStage("processing")).toBe("created");
    expect(refundStage("created")).toBe("created");
    expect(refundStage("pending")).toBe("created");
  });

  it("treats success as `refunded`", () => {
    expect(refundStage("success")).toBe("refunded");
    expect(refundStage("succeeded")).toBe("refunded");
    expect(refundStage("paid")).toBe("refunded");
  });

  it("treats a failed refund as `failed`", () => {
    expect(refundStage("failed")).toBe("failed");
  });

  it("is total: an unrecognised or empty status is `unknown`, never `refunded`", () => {
    expect(refundStage("something_new")).toBe("unknown");
    expect(refundStage("")).toBe("unknown");
    expect(refundStage(null)).toBe("unknown");
  });

  it("normalises case and surrounding whitespace", () => {
    expect(refundStage("  SUCCESS  ")).toBe("refunded");
  });
});

describe("refundStatusLabel", () => {
  it("gives every stage a human label, including unknown", () => {
    expect(refundStatusLabel("processing")).toMatch(/funds on the way/i);
    expect(refundStatusLabel("success")).toBe("Refunded");
    expect(refundStatusLabel("failed")).toBe("Refund failed");
    expect(refundStatusLabel("???")).toBe("Refund status unknown");
  });
});

// ── the view type the client sees ───────────────────────────────────────────

describe("the shopper's payment view", () => {
  it("carries no key material and nothing belonging to another order", () => {
    const view: PaymentStatusView = toPaymentStatusView({
      payment_id: "ch_1",
      checkout_id: "chk_1",
      status: "succeeded",
      amount: "29.00",
      amount_paid: "29.00",
      currency: "USD",
      payment_method: "USD_CARD",
    });
    const serialised = JSON.stringify(view);
    expect(serialised).not.toMatch(/sk_live|sk_sandbox|whsec/i);
    expect(serialised).not.toMatch(/authorization|secret|apiKey/i);
  });
});
