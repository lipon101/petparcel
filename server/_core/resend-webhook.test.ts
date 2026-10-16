// Resend webhook: Svix signature verification + event mapping.
//
// The verifier is the one thing that must never be wrong, so it is exercised
// directly: a correct signature passes, and every way of getting it wrong
// (missing headers, wrong key, tampered body, stale timestamp, no secret) is
// refused. The mapper is checked against the real Resend payload shapes.
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  RESEND_EVENT_TYPES,
  SIGNATURE_TOLERANCE_SECONDS,
  decodeSvixSecret,
  isKnownEventType,
  parseResendEvent,
  verifySvixSignature,
} from "./resend-webhook";

// A fixed key so the signatures are deterministic. The secret Resend shows is
// `whsec_<base64>`; the raw key is the DECODED bytes.
const KEY = Buffer.from("test-webhook-signing-key-0123456789");
const SECRET = `whsec_${KEY.toString("base64")}`;
const NOW = 1_800_000_000;

function sign(id: string, ts: number, body: string, key: Buffer = KEY): string {
  return createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
}

function headers(id: string, ts: number, body: string, key?: Buffer) {
  return { id, timestamp: String(ts), signature: `v1,${sign(id, ts, body, key)}` };
}

describe("decodeSvixSecret", () => {
  it("decodes the whsec_ base64 form to the raw key", () => {
    expect(decodeSvixSecret(SECRET)?.toString()).toBe(KEY.toString());
  });
  it("accepts a bare base64 secret", () => {
    expect(decodeSvixSecret(KEY.toString("base64"))?.toString()).toBe(KEY.toString());
  });
  it("returns null for empty / missing", () => {
    expect(decodeSvixSecret("")).toBeNull();
    expect(decodeSvixSecret(undefined)).toBeNull();
    expect(decodeSvixSecret(null)).toBeNull();
  });
});

describe("verifySvixSignature", () => {
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });

  it("accepts a correctly signed request", () => {
    expect(verifySvixSignature(headers("msg_1", NOW, body), body, SECRET, NOW)).toEqual({ ok: true });
  });

  it("rejects a missing signature header", () => {
    const r = verifySvixSignature({ id: "msg_1", timestamp: String(NOW), signature: null }, body, SECRET, NOW);
    expect(r.ok).toBe(false);
  });

  it("rejects a missing svix-id", () => {
    const r = verifySvixSignature({ id: "", timestamp: String(NOW), signature: "v1,abc" }, body, SECRET, NOW);
    expect(r.ok).toBe(false);
  });

  it("rejects a tampered body", () => {
    const h = headers("msg_1", NOW, body);
    const r = verifySvixSignature(h, body + " ", SECRET, NOW);
    expect(r.ok).toBe(false);
  });

  it("rejects a signature made with the wrong key", () => {
    const h = headers("msg_1", NOW, body, Buffer.from("a-different-key"));
    expect(verifySvixSignature(h, body, SECRET, NOW).ok).toBe(false);
  });

  it("rejects a stale timestamp (replay window)", () => {
    const h = headers("msg_1", NOW - SIGNATURE_TOLERANCE_SECONDS - 1, body);
    const r = verifySvixSignature(h, body, SECRET, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/tolerance/);
  });

  it("rejects when no secret is configured", () => {
    const h = headers("msg_1", NOW, body);
    expect(verifySvixSignature(h, body, "", NOW).ok).toBe(false);
  });

  it("rejects a non-numeric timestamp", () => {
    const h = { id: "msg_1", timestamp: "not-a-number", signature: "v1,abc" };
    expect(verifySvixSignature(h, body, SECRET, NOW).ok).toBe(false);
  });

  it("accepts when a valid v1 signature is one of several (rotation)", () => {
    const good = sign("msg_1", NOW, body);
    const h = { id: "msg_1", timestamp: String(NOW), signature: `v1,AAAA v1,${good}` };
    expect(verifySvixSignature(h, body, SECRET, NOW)).toEqual({ ok: true });
  });

  it("ignores non-v1 signature versions", () => {
    const good = sign("msg_1", NOW, body);
    const h = { id: "msg_1", timestamp: String(NOW), signature: `v2,${good}` };
    expect(verifySvixSignature(h, body, SECRET, NOW).ok).toBe(false);
  });
});

describe("isKnownEventType", () => {
  it("recognises every documented Resend event", () => {
    for (const t of RESEND_EVENT_TYPES) expect(isKnownEventType(t)).toBe(true);
  });
  it("rejects an unknown type", () => {
    expect(isKnownEventType("email.teleported")).toBe(false);
  });
});

describe("parseResendEvent", () => {
  it("maps a delivered event", () => {
    const body = JSON.stringify({
      type: "email.delivered",
      created_at: "2026-10-11T05:00:00.000Z",
      data: {
        email_id: "msg_abc",
        from: "PetParcel <orders@petparcel.store>",
        to: ["customer@example.com"],
        subject: "Order PP-1 confirmed",
      },
    });
    const r = parseResendEvent("svix_1", body);
    expect(r).not.toBeNull();
    expect(r!.type).toBe("email.delivered");
    expect(r!.providerMessageId).toBe("msg_abc");
    expect(r!.toEmail).toBe("customer@example.com");
    expect(r!.fromEmail).toBe("PetParcel <orders@petparcel.store>");
    expect(r!.subject).toBe("Order PP-1 confirmed");
    expect(r!.occurredAt?.toISOString()).toBe("2026-10-11T05:00:00.000Z");
  });

  it("maps a bounce and captures the reason", () => {
    const body = JSON.stringify({
      type: "email.bounced",
      data: { email_id: "msg_b", to: "x@example.com", bounce: { message: "mailbox full" } },
    });
    const r = parseResendEvent("svix_2", body);
    expect(r!.type).toBe("email.bounced");
    expect(r!.reason).toBe("mailbox full");
  });

  it("maps a complaint", () => {
    const body = JSON.stringify({
      type: "email.complained",
      data: { email_id: "msg_c", complaint: { message: "marked as spam" } },
    });
    expect(parseResendEvent("svix_3", body)!.reason).toBe("marked as spam");
  });

  it("tolerates a missing data object", () => {
    const r = parseResendEvent("svix_4", JSON.stringify({ type: "email.sent" }));
    expect(r!.type).toBe("email.sent");
    expect(r!.providerMessageId).toBeNull();
    expect(r!.toEmail).toBeNull();
  });

  it("returns null for a non-JSON body", () => {
    expect(parseResendEvent("svix_5", "not json")).toBeNull();
  });

  it("returns null when there is no type", () => {
    expect(parseResendEvent("svix_6", JSON.stringify({ data: {} }))).toBeNull();
  });
});
