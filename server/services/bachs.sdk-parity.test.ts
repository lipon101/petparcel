// ── Parity with Bachs' own SDK ───────────────────────────────────────────────
//
// WHY THIS EXISTS. The store verifies its own webhooks rather than depending
// on the SDK, because the route needs the RAW BYTES and the exact refusal
// reasons the store's own policy depends on. But a hand-rolled verifier that
// quietly disagrees with the provider's reference implementation is a way to
// lose real money: a legitimate delivery refused means a paid order that never
// settles.
//
// So this test runs the SAME inputs through BOTH implementations and asserts
// they agree, case by case. Bachs' SDK (`@bachs/sdk`, MIT licensed, and the
// implementation the provider's own documentation points at) is the reference.
//
// It is a DEVELOPMENT dependency on purpose: the store's production bundle
// does not ship it. This test is the only thing that imports it.
//
// Two defects were found this way, and both are the kind that only bite in
// production:
//   * the reference accepts an UPPERCASE hex digest (hex is case-insensitive)
//     and the store's first implementation did not - so a legitimate
//     signature could be refused;
//   * the reference hashes the raw BYTES and the store's first implementation
//     re-encoded the body as a string - which differs for a body that is not
//     valid UTF-8.
//
// The rule the store now follows, stated once: hash the bytes that arrived,
// accept either case of hex, accept any `v1=` on the V2 header (so a secret
// rotation keeps working), and bound the timestamp.
import { createHmac } from "node:crypto";
import { webhooks } from "@bachs/sdk";
import { describe, expect, it } from "vitest";
import { computeBachsSignature, verifyBachsSignature } from "./bachs";

const SECRET = "parity-check-secret";

/** A body that satisfies the reference implementation's envelope check. */
const BODY = JSON.stringify({
  id: "evt_parity_check",
  type: "collection.succeeded",
  created_at: "2026-04-27T12:04:00Z",
  organization_id: "acct_7KpQ2mNv4XbR9dLc",
  data: { charge_id: "ch_1a2b3c4d5e6f", status: "SUCCEEDED", amount: "29.00", currency: "USD" },
});

function sign(body: string, timestamp: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(`${timestamp}.`).update(body, "utf8").digest("hex");
}

/** What the reference implementation says about a delivery. */
function sdkAccepts(
  body: string,
  headers: Record<string, string>,
  secret = SECRET,
): boolean {
  try {
    webhooks.constructEvent(body, new Headers(headers), secret);
    return true;
  } catch {
    return false;
  }
}

/** What the store's own verifier says about the same delivery. */
function storeAccepts(
  body: string,
  headers: Record<string, string>,
  secret = SECRET,
): boolean {
  return verifyBachsSignature({
    rawBody: body,
    timestamp: headers["x-bachs-timestamp"],
    signature: headers["x-bachs-signature"],
    signatureV2: headers["x-bachs-signature-v2"],
    secret,
  }).ok;
}

/** The case matrix. Every row must be judged IDENTICALLY by both. */
function cases(): Array<{ label: string; headers: Record<string, string>; body?: string }> {
  const now = String(Math.floor(Date.now() / 1000));
  const old = String(Math.floor(Date.now() / 1000) - 3600);
  const good = sign(BODY, now);
  const wrong = sign(BODY, now, "some-other-secret");
  const otherBody = sign(JSON.stringify({ ...JSON.parse(BODY), id: "evt_other" }), now);

  return [
    { label: "V2 with one digest", headers: { "x-bachs-timestamp": now, "x-bachs-signature-v2": `t=${now},v1=${good}` } },
    {
      label: "V2 with two digests (a secret rotation)",
      headers: { "x-bachs-timestamp": now, "x-bachs-signature-v2": `t=${now},v1=${wrong},v1=${good}` },
    },
    { label: "V2 with an UPPERCASE digest", headers: { "x-bachs-timestamp": now, "x-bachs-signature-v2": `t=${now},v1=${good.toUpperCase()}` } },
    { label: "the plain V1 header only", headers: { "x-bachs-timestamp": now, "x-bachs-signature": good } },
    {
      label: "an UPPERCASE plain V1 header",
      headers: { "x-bachs-timestamp": now, "x-bachs-signature": good.toUpperCase() },
    },
    { label: "V2 and the plain header together", headers: { "x-bachs-timestamp": now, "x-bachs-signature": good, "x-bachs-signature-v2": `t=${now},v1=${good}` } },
    { label: "a digest made with the wrong secret", headers: { "x-bachs-timestamp": now, "x-bachs-signature-v2": `t=${now},v1=${wrong}` } },
    { label: "a digest over a DIFFERENT body", headers: { "x-bachs-timestamp": now, "x-bachs-signature-v2": `t=${now},v1=${otherBody}` } },
    { label: "a stale timestamp (a replay)", headers: { "x-bachs-timestamp": old, "x-bachs-signature-v2": `t=${old},v1=${sign(BODY, old)}` } },
    { label: "no signature at all", headers: { "x-bachs-timestamp": now } },
    { label: "a malformed digest", headers: { "x-bachs-timestamp": now, "x-bachs-signature-v2": `t=${now},v1=nothex` } },
    { label: "a truncated digest", headers: { "x-bachs-timestamp": now, "x-bachs-signature-v2": `t=${now},v1=${good.slice(0, 32)}` } },
    { label: "no timestamp", headers: { "x-bachs-signature-v2": `t=${now},v1=${good}` } },
    { label: "a non-numeric timestamp", headers: { "x-bachs-timestamp": "not-a-time", "x-bachs-signature": good } },
    { label: "the V2 header carrying the timestamp only", headers: { "x-bachs-signature-v2": `t=${now}` } },
  ];
}

describe("the store's webhook verifier agrees with Bachs' own SDK", () => {
  const matrix = cases();

  it("has a matrix worth checking", () => {
    expect(matrix.length).toBeGreaterThan(10);
  });

  for (const row of matrix) {
    it(`judges "${row.label}" the same way`, () => {
      const body = row.body ?? BODY;
      const sdk = sdkAccepts(body, row.headers);
      const store = storeAccepts(body, row.headers);
      expect(store, `the store and the SDK disagree on "${row.label}"`).toBe(sdk);
    });
  }
});

describe("the digest itself", () => {
  it("is the HMAC-SHA256 of the timestamp and the raw bytes", () => {
    const timestamp = "1700000000";
    const expected = createHmac("sha256", SECRET)
      .update(`${timestamp}.`, "utf8")
      .update(BODY, "utf8")
      .digest("hex");
    expect(computeBachsSignature(BODY, timestamp, SECRET)).toBe(expected);
  });

  it("is the same whether the body arrives as a string or as bytes", () => {
    const timestamp = "1700000000";
    expect(computeBachsSignature(BODY, timestamp, SECRET)).toBe(
      computeBachsSignature(new TextEncoder().encode(BODY), timestamp, SECRET),
    );
  });
});
