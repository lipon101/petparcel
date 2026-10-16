// Resend webhook receiver - signature verification + event parsing.
//
// Resend signs webhooks with **Svix**. Every delivery carries three headers:
//
//   svix-id         a unique message id (stable across retries)
//   svix-timestamp  unix seconds when Svix signed it
//   svix-signature  one or more `v1,<base64>` signatures, space-separated
//
// The signed content is the string `${svix-id}.${svix-timestamp}.${rawBody}`,
// HMAC-SHA256'd with the secret's key. The secret is the `whsec_...` value from
// the Resend dashboard; the part after `whsec_` is base64 and must be DECODED
// before it is used as the HMAC key (using the literal string is the classic
// mistake - it verifies nothing).
//
// This module is deliberately PURE: no db, no env, no network. It takes the
// headers + raw body and answers "is this authentic?" and "what does it say?".
// That is what makes the security rule unit-testable without a database, and it
// keeps the one thing that must never be wrong (the signature check) in a file
// small enough to read in full.
//
// SECURITY POSTURE: the body is NEVER trusted before verification. The route
// reads the RAW bytes, verifies, and only then parses. A bad or missing
// signature is a 400 and nothing is recorded.
import { createHmac, timingSafeEqual } from "node:crypto";

/** The Resend event types this receiver understands. */
export const RESEND_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
] as const;

export type ResendEventType = (typeof RESEND_EVENT_TYPES)[number];

const KNOWN = new Set<string>(RESEND_EVENT_TYPES);

/** True when `type` is one of the documented Resend email events. */
export function isKnownEventType(type: string): type is ResendEventType {
  return KNOWN.has(type);
}

/** How far a signature's timestamp may be from now before it is refused.
 *  Svix's own default is 5 minutes; a wider window is a replay opportunity. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export interface SvixHeaders {
  id: string | null | undefined;
  timestamp: string | null | undefined;
  signature: string | null | undefined;
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/**
 * Decode a Svix signing secret to its raw key bytes.
 *
 * Accepts the `whsec_<base64>` form Resend shows, or a bare base64 string.
 * Returns null when the value is empty or not decodable - the caller treats
 * that as "cannot verify", never as "verified".
 */
export function decodeSvixSecret(secret: string | null | undefined): Buffer | null {
  const raw = String(secret ?? "").trim();
  if (!raw) return null;
  const b64 = raw.startsWith("whsec_") ? raw.slice("whsec_".length) : raw;
  try {
    const buf = Buffer.from(b64, "base64");
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Verify a Svix-signed webhook.
 *
 * `body` MUST be the exact raw request body (the bytes that were signed) - a
 * re-serialised JSON object will not match. `now` is injectable for tests.
 *
 * Returns `{ ok: true }` only when a `v1` signature matches AND the timestamp
 * is within tolerance. Every other path returns `{ ok: false, reason }` with a
 * short, non-secret reason (safe to log).
 */
export function verifySvixSignature(
  headers: SvixHeaders,
  body: string,
  secret: string | null | undefined,
  now: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  const key = decodeSvixSecret(secret);
  if (!key) return { ok: false, reason: "no signing secret configured" };

  const id = String(headers.id ?? "").trim();
  const ts = String(headers.timestamp ?? "").trim();
  const sigHeader = String(headers.signature ?? "").trim();
  if (!id || !ts || !sigHeader) {
    return { ok: false, reason: "missing svix-id, svix-timestamp or svix-signature" };
  }

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "svix-timestamp is not a number" };
  if (Math.abs(now - tsNum) > SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, reason: "svix-timestamp outside tolerance" };
  }

  const signedContent = `${id}.${ts}.${body}`;
  const expected = createHmac("sha256", key).update(signedContent).digest();

  // The header is a space-separated list of `version,base64sig` entries; a
  // rotation can put more than one. Accept if ANY `v1` entry matches.
  const candidates = sigHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const comma = part.indexOf(",");
      return comma === -1 ? { version: "", sig: part } : { version: part.slice(0, comma), sig: part.slice(comma + 1) };
    })
    .filter((c) => c.version === "v1" && c.sig);

  if (candidates.length === 0) return { ok: false, reason: "no v1 signature present" };

  for (const c of candidates) {
    let given: Buffer;
    try {
      given = Buffer.from(c.sig, "base64");
    } catch {
      continue;
    }
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "signature mismatch" };
}

/** The normalised record we persist for one webhook event. */
export interface ResendEventRecord {
  svixId: string;
  type: string;
  providerMessageId: string | null;
  toEmail: string | null;
  fromEmail: string | null;
  subject: string | null;
  reason: string | null;
  occurredAt: Date | null;
}

function firstString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v)) {
    const first = v.find((x) => typeof x === "string" && x.trim());
    return typeof first === "string" ? first.trim() : null;
  }
  return null;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Map a Resend webhook payload to the row we store.
 *
 * Tolerant by design: Resend's `data` shape varies a little by event type
 * (a bounce carries `bounce.message`, a click carries `click.link`), so every
 * field is read defensively and a missing one becomes null rather than a throw.
 * Returns null only when the payload is not an object with a `type` - the
 * caller answers 400 for that, since a signed-but-unparseable body is a bug on
 * the sender's side, not something to record.
 */
export function parseResendEvent(svixId: string, rawBody: string): ResendEventRecord | null {
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const type = typeof p.type === "string" ? p.type.trim() : "";
  if (!type) return null;

  const data = (p.data && typeof p.data === "object" ? p.data : {}) as Record<string, unknown>;

  // Bounce / complaint detail. Resend nests it under `bounce` (and sometimes
  // `complaint`); fall back to a top-level `reason`/`message` if present.
  const bounce = (data.bounce && typeof data.bounce === "object" ? data.bounce : {}) as Record<string, unknown>;
  const complaint = (data.complaint && typeof data.complaint === "object" ? data.complaint : {}) as Record<string, unknown>;
  const reason =
    firstString(bounce.message) ??
    firstString(complaint.message) ??
    firstString(data.reason) ??
    firstString(data.message) ??
    null;

  return {
    svixId,
    type,
    providerMessageId: firstString(data.email_id) ?? firstString(data.id),
    toEmail: firstString(data.to),
    fromEmail: firstString(data.from),
    subject: firstString(data.subject),
    reason,
    occurredAt: parseDate(data.created_at) ?? parseDate(p.created_at),
  };
}
