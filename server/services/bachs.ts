// ── Bachs integration ────────────────────────────────────────────────────────
//
// Bachs is the store's payment rail. It is a HOSTED checkout: we create a
// checkout session, hand the shopper to Bachs' own secure page, and confirm
// the outcome server-to-server. PetParcel never sees a card number - the card
// details go to Bachs' hosted page and come back to us as a charge id, so
// there is no card-like or custodial secret to hold here.
//
// TWO CREDENTIALS, TWO DIFFERENT JOBS - and keeping them apart IS the security
// model:
//
//   BACHS_API_KEY         authenticates OUR OUTBOUND calls (create a checkout
//                         session, read a charge, issue a refund). It can move
//                         money, so it is read here and used ONLY in this
//                         file - it is never sent to a browser and never
//                         logged.
//
//   BACHS_WEBHOOK_SECRET  verifies THEIR INBOUND callbacks: an HMAC-SHA256
//                         over "{timestamp}.{raw_body}", compared against the
//                         `x-bachs-signature` / `x-bachs-signature-v2` headers.
//                         A wrong or missing signature is a rejection, never a
//                         trust.
//
// Both are read from the environment ONLY - never the DB, never committed.
// See the Bachs dashboard (Developer Portal -> API Keys, and Developer Portal
// -> Webhooks for the endpoint's signing secret) for the steps that produce
// them.
//
// FAIL-SAFE, NOT FAIL-OPEN.
//   * With NO API KEY the store still runs end to end: no checkout session is
//     attempted at all, the order is recorded as `unpaid` for offline
//     settlement, and the admin marks it paid when the funds land. That is the
//     same posture the store had before any gateway was switched on - checkout
//     is never blocked by a missing key.
//   * With NO WEBHOOK SECRET the webhook route REFUSES every request, because
//     a signature cannot be verified without a key. Payments are then still
//     confirmed by the PULL path (the confirmation page asks Bachs directly),
//     so a missing secret degrades reliability rather than opening a hole
//     where an unsigned POST could mark an order paid.
//
// WHAT THE STORE ACCEPTS: CARDS IN USD. The checkout is pinned to the USD
// corridor (`payment_method_types: ["USD_CARD"]`) and to USD as the billing
// currency, so an American shopper is charged exactly the order total in
// dollars - no FX conversion, no crypto.
//
//   Why no crypto corridor? `CRYPTO` is one corridor covering every asset, and
//   Bachs requires a `refund_address` (the wallet the money goes back to) to
//   refund a crypto charge. This store's only refund path is the admin panel's
//   "Refund order" button, which has no place to collect a wallet address -
//   so offering crypto would mean offering a payment method we cannot refund.
//   Cards refund end to end with nothing extra, so cards are what the store
//   takes. The corridor is a single constant below, so enabling crypto later
//   is a one-line change that must also add a refund address to the refund
//   flow.
//
// Real endpoints, as documented at https://docs.bachs.io :
//   POST /v1/checkout-sessions             create the hosted checkout we redirect to
//   GET  /v1/checkout-sessions/{id}        read the session back (status, amount, charge)
//   GET  /v1/payments/{charge_id}          the authoritative charge status
//   POST /v1/refunds                       return funds for a charge
//
// MONEY IS A DECIMAL STRING. Bachs never accepts minor units: an amount is
// "29.00" paired with an ISO 4217 currency. The store holds integer cents
// everywhere else, so the conversion happens once, in `formatMajor` /
// `majorToCents` (shared/money.ts), and is asserted round-trip-safe.

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";
import { formatMajor, majorToCents } from "../../shared/money";

/** Production base. */
export const BACHS_LIVE_BASE = "https://api.bachs.io";
/** Sandbox base. Selected automatically by the API key's prefix. */
export const BACHS_SANDBOX_BASE = "https://sandbox-api.bachs.io";

/**
 * The corridors this store offers on its hosted checkout.
 *
 * `USD_CARD` is the US card corridor. Bachs' corridors are per-currency, not
 * per-type: `USD_CARD` and `NGN_CARD` are different corridors, so naming the
 * USD one is what keeps the shopper on a dollar card.
 */
export const BACHS_PAYMENT_METHOD_TYPES = ["USD_CARD"] as const;

/** The one currency this store prices and collects in. */
export const BACHS_CURRENCY = "USD";

/**
 * How long a hosted checkout stays payable, in minutes. Bachs accepts 1-1440
 * and defaults to 60. An hour is long enough for a shopper to fetch a card
 * and type it in, and short enough that a stale session is not sitting around
 * accepting a payment for an order the shopper has forgotten.
 */
export const BACHS_CHECKOUT_TTL_MINUTES = 60;

export interface BachsConfig {
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  /** True when the base URL is one of Bachs' own hosts (not a test stub). */
  isRealHost: boolean;
}

/**
 * The API base for a key.
 *
 * Bachs' own rule is that going live is a key swap: a `sk_live_` key talks to
 * production and a `sk_sandbox_` key talks to the sandbox. Deriving the host
 * from the key means the right environment is chosen automatically and a
 * sandbox key can never be pointed at production - the hosts are chosen by the
 * key's prefix, not by a setting that can disagree with it.
 *
 * `BACHS_API_BASE` overrides it, and exists ONLY so the test suite can point
 * at a local stub. A live deployment must leave it unset; the verifier checks
 * that.
 */
export function bachsBaseUrlFor(apiKey: string): string {
  const key = apiKey.trim();
  if (key.startsWith("sk_live_")) return BACHS_LIVE_BASE;
  if (key.startsWith("sk_sandbox_")) return BACHS_SANDBOX_BASE;
  // A key with no recognised prefix: default to production. Bachs' production
  // key format is `sk_live_...`; an unrecognised key will be rejected by the
  // API anyway, and defaulting to production means a hand-rolled key still
  // talks to the real host rather than to a sandbox.
  return BACHS_LIVE_BASE;
}

export function bachsConfig(): BachsConfig {
  const apiKey = env.bachs.apiKey.trim();
  const override = env.bachs.baseUrl.trim();
  const baseUrl = (override || bachsBaseUrlFor(apiKey)).replace(/\/+$/, "");
  return {
    apiKey,
    webhookSecret: env.bachs.webhookSecret.trim(),
    baseUrl,
    isRealHost: baseUrl === BACHS_LIVE_BASE || baseUrl === BACHS_SANDBOX_BASE,
  };
}

/** Can we CREATE payments? Without this the provider runs in offline mode. */
export function isBachsConfigured(): boolean {
  return Boolean(bachsConfig().apiKey);
}

/** Can we VERIFY inbound webhooks? Without this the webhook route refuses. */
export function isBachsWebhookConfigured(): boolean {
  return Boolean(bachsConfig().webhookSecret);
}

/** An error from the Bachs API, carrying the upstream status so a caller can
 *  tell "the merchant key is wrong" (401/403) from "the upstream is down"
 *  (5xx) without string-matching a message. */
export class BachsError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status = 502, details: unknown = null) {
    super(message);
    this.name = "BachsError";
    this.status = status;
    this.details = details;
  }
}

// ── status mapping ───────────────────────────────────────────────────────────
//
// Bachs reports a RAW status, and it reports DIFFERENT vocabularies in
// different places:
//
//   * the charge object (GET /v1/payments/{id}) -> `created`, `processing`,
//     `succeeded`, `accepted`, `failed`, `expired`, `cancelled`, `refunded`,
//     `partially_refunded`, `auto_refunded`, `underpaid`, `overpaid`
//   * a collection webhook -> the SAME states in UPPERCASE (`SUCCEEDED`,
//     `FAILED`, `UNDERPAID`, ...) - Bachs says outright that the two must not
//     be compared directly, so every status is lowercased before it is mapped
//   * a checkout session -> `payment_status` in `requires_payment_method`,
//     `requires_confirmation`, `requires_action`, `processing`, `succeeded`,
//     `failed`, `canceled`
//
// The store has its own, narrower vocabulary, and the mapping between them is
// the piece that decides whether an order ships - so it is explicit, total,
// and pinned by tests.
//
//   pending     nothing has been attempted yet
//   confirming  an attempt is in flight (or money arrived short)
//   paid        the money is collected and the order may ship
//   failed      the attempt failed
//   expired     the payment window closed
//   refunded    the money was sent back
//
// `underpaid` and `accepted` are deliberately NOT paid on their own: `accepted`
// means "an underpayment or overpayment was accepted as final settlement", so
// it is only paid once the amount received is shown to cover the amount due
// (see `isSettled`). Shipping a short payment is a real, unrecoverable loss.
export type PaymentStage = "pending" | "confirming" | "paid" | "failed" | "expired" | "refunded";

const PAID_STATUSES = new Set(["succeeded", "overpaid", "paid"]);
const FAILED_STATUSES = new Set(["failed", "incomplete", "canceled", "cancelled"]);
const EXPIRED_STATUSES = new Set(["expired"]);
const REFUNDED_STATUSES = new Set(["refunded", "partially_refunded", "auto_refunded"]);
const CONFIRMING_STATUSES = new Set([
  "processing",
  "requires_action",
  "requires_confirmation",
  "requires_payment_method",
  "underpaid",
  "accepted",
  "last_attempt_failed",
]);

/** Raw Bachs status -> the store's stage. Total: an unknown status is treated
 *  as pending, never as paid. */
export function paymentStage(rawStatus: string | null | undefined): PaymentStage {
  const s = String(rawStatus ?? "")
    .trim()
    .toLowerCase();
  if (PAID_STATUSES.has(s)) return "paid";
  if (FAILED_STATUSES.has(s)) return "failed";
  if (EXPIRED_STATUSES.has(s)) return "expired";
  if (REFUNDED_STATUSES.has(s)) return "refunded";
  if (CONFIRMING_STATUSES.has(s)) return "confirming";
  return "pending";
}

export function isPaidStatus(rawStatus: string | null | undefined): boolean {
  return paymentStage(rawStatus) === "paid";
}

/**
 * May this order ship?
 *
 * `succeeded` and `overpaid` always may: the money is there and, if there is
 * too much of it, the difference is the customer's.
 *
 * `accepted` may only when the amount received is shown to cover the amount
 * due. Bachs' own rule is to fulfil on `succeeded`, `accepted` or `overpaid`
 * "applying your own rules for the amount received" - this store's rule is
 * that the amount received must not be short.
 *
 * Everything else - `underpaid` included - may not. A short payment stays
 * `confirming` so the shopper sees that something arrived and that a balance
 * is outstanding.
 */
export function isSettled(
  rawStatus: string | null | undefined,
  amounts: { amountDueCents?: number | null; amountPaidCents?: number | null } = {},
): boolean {
  const s = String(rawStatus ?? "")
    .trim()
    .toLowerCase();
  const stage = paymentStage(s);
  if (stage === "paid") return true;
  if (s === "accepted") {
    const due = amounts.amountDueCents;
    const paid = amounts.amountPaidCents;
    if (due == null || paid == null) return false;
    return paid >= due;
  }
  return false;
}

/** Has the payment reached a state that will not change on its own? Used to stop
 *  the confirmation page polling forever. */
export function isTerminalStage(stage: PaymentStage): boolean {
  return stage === "paid" || stage === "failed" || stage === "expired" || stage === "refunded";
}

/** Shopper-facing wording for a RAW status (or a stage). Kept here, next to the
 *  mapping, so the server and the client can never disagree about what
 *  "underpaid" is called. */
const STATUS_LABEL: Record<string, string> = {
  open: "Waiting for your payment",
  created: "Waiting for your payment",
  requires_payment_method: "Waiting for your payment",
  requires_confirmation: "Confirming your payment",
  requires_action: "Waiting for your bank's approval",
  processing: "Processing your payment",
  last_attempt_failed: "That payment did not go through - try again",
  accepted: "Payment accepted - settling",
  underpaid: "Part-paid - balance still outstanding",
  succeeded: "Payment complete",
  paid: "Payment complete",
  overpaid: "Payment complete",
  failed: "Payment failed",
  incomplete: "Payment did not complete",
  canceled: "Checkout cancelled",
  cancelled: "Checkout cancelled",
  expired: "Payment window expired",
  refunded: "Payment refunded",
  partially_refunded: "Partly refunded",
  auto_refunded: "Payment refunded",
  confirming: "Processing your payment",
  pending: "Waiting for your payment",
};

export function statusLabel(rawStatusOrStage: string): string {
  const key = String(rawStatusOrStage ?? "")
    .trim()
    .toLowerCase();
  return STATUS_LABEL[key] ?? "Awaiting payment";
}

/** Map a raw Bachs status onto the store's own payment_status vocabulary
 *  (`unpaid` | `paid` | `failed` | `refunded`, per shared/store.ts), so the
 *  admin panel and the order timeline keep working unchanged. */
export function storePaymentStatusFor(rawStatus: string): "unpaid" | "paid" | "failed" | "refunded" {
  const stage = paymentStage(rawStatus);
  if (stage === "paid") return "paid";
  if (stage === "failed" || stage === "expired") return "failed";
  if (stage === "refunded") return "refunded";
  return "unpaid";
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────

/** Pull a human-readable message out of whatever error shape the API used.
 *  Bachs' errors are `{ detail, error_code, errors? }`; `detail` is the
 *  human-readable line and `error_code` the machine-readable one. */
export function extractApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const key of ["detail", "message", "error"]) {
    const value = p[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = extractApiMessage(value);
      if (nested) return nested;
    }
  }
  return null;
}

/** Bachs' machine-readable error code, when the response carries one. */
export function extractApiErrorCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const code = p.error_code;
  if (typeof code === "string" && code.trim()) return code.trim();
  return null;
}

async function bachsFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string } = {},
): Promise<T> {
  const { apiKey, baseUrl } = bachsConfig();
  if (!apiKey) {
    throw new BachsError("Bachs is not configured (BACHS_API_KEY is unset).", 503);
  }

  const headers: Record<string, string> = {
    // The key authenticates US to THEM. It is added here, on the server, and
    // never leaves it - no client code path can reach this function.
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    accept: "application/json",
  };
  if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;

  const res = await outboundFetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    timeoutMs: 20_000,
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const code = extractApiErrorCode(parsed);
    const message = extractApiMessage(parsed) ?? `Bachs returned HTTP ${res.status}.`;
    throw new BachsError(code ? `${message} (${code})` : message, res.status, parsed);
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new BachsError("Bachs returned an unreadable response.", 502, text.slice(0, 300));
  }
  return parsed as T;
}

// ── response shapes ──────────────────────────────────────────────────────────
//
// Every field is optional and every type is widened on purpose: Bachs says
// outright that it may add fields to the envelope "at any time" and that
// integrations must "parse leniently: read the fields you need and ignore the
// rest". A strict shape here would start failing the day a field is added.

export interface CheckoutSessionResponse {
  checkout_id?: string | null;
  checkout_url?: string | null;
  status?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  reference?: string | null;
  [key: string]: unknown;
}

/** GET /v1/checkout-sessions/{id}. `payment_status` is the checkout-level
 *  state; `charge` is the payment it produced (null before an attempt). */
export interface CheckoutSessionDetailResponse {
  checkout_id?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount?: string | null;
  currency?: string | null;
  reference?: string | null;
  payment_method?: string | null;
  billing_currency?: string | null;
  charge?: PaymentResponse | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

/** GET /v1/payments/{payment_id}. The id IS the charge id (`ch_...`). */
export interface PaymentResponse {
  payment_id?: string | null;
  checkout_id?: string | null;
  reference?: string | null;
  status?: string | null;
  is_refundable?: boolean | null;
  amount?: string | null;
  amount_paid?: string | null;
  amount_remaining?: string | null;
  currency?: string | null;
  fees?: { amount?: string | null; currency?: string | null } | null;
  fee_usd?: string | null;
  payment_method?: string | null;
  message?: string | null;
  customer?: { id?: string | null; email?: string | null; name?: string | null } | null;
  refunds?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

export interface RefundResponse {
  refund_id?: string | null;
  charge_id?: string | null;
  reference?: string | null;
  status?: string | null;
  requested_amount?: string | null;
  refunded_amount?: string | null;
  refund_fee_amount?: string | null;
  fee_bearer?: string | null;
  reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

// ── outbound calls ───────────────────────────────────────────────────────────

export interface CreateCheckoutSessionInput {
  /** Amount in MAJOR units of `currency` (e.g. 84.97 for $84.97). It comes
   *  from the order the server just priced - never from the browser. */
  amount: number;
  currency: string;
  /** Our order number. Bachs echoes it back on every notification and on the
   *  session itself, which is how a callback is tied to an order. */
  orderNumber: string;
  /** The order's DB id. Used to build the idempotency key. */
  orderId: string;
  /** The shoper's email. Omit it entirely for a guest checkout. */
  email?: string | null;
  /** The shopper's name. Omit it when blank - Bachs refuses a blank name. */
  customerName?: string | null;
  /** Absolute URL the shopper returns to after paying. */
  successUrl: string;
  /** Absolute URL the shopper returns to if they abandon the checkout. */
  cancelUrl: string;
  /** A stable key for THIS attempt, so a network retry cannot create a
   *  second session for one order. */
  idempotencyKey: string;
}

export interface CreateCheckoutSessionResult {
  checkoutId: string;
  checkoutUrl: string;
  expiresAt: string | null;
  raw: CheckoutSessionResponse;
}

/**
 * Create a hosted checkout session and return the URL to send the browser to.
 *
 * The session is priced with a RAW amount (`pricing`), not a product cart:
 * PetParcel's prices are computed at order time from the catalogue and the
 * store's own shipping and tax settings, so there is no Bachs product to
 * reference. Bachs supports exactly this - "the right choice when your pricing
 * is dynamic, computed at order time".
 *
 * `billing_currency: "USD"` pins the session to dollars. Left unset, Bachs
 * converts a USD price into the customer's local currency at the prevailing FX
 * rate, which is right for a global store and wrong for this one: an American
 * shopper must be charged the order total in dollars, to the cent.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<CreateCheckoutSessionResult> {
  const currency = (input.currency || BACHS_CURRENCY).toUpperCase();
  const body: Record<string, unknown> = {
    pricing: {
      currency,
      amount: formatMajor(majorToCents(input.amount)),
      price_type: "fixed",
    },
    // Exactly one pricing source: `pricing` here, and NO `product_cart`.
    billing_currency: currency,
    payment_method_types: [...BACHS_PAYMENT_METHOD_TYPES],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    reference: input.orderNumber.slice(0, 128),
    metadata: {
      order_number: input.orderNumber,
      order_id: input.orderId,
    },
    expires_in_minutes: BACHS_CHECKOUT_TTL_MINUTES,
  };

  // A blank name is refused by Bachs, so it is only sent when there is one.
  const email = (input.email ?? "").trim();
  const name = (input.customerName ?? "").trim();
  if (email) {
    body.customer = name ? { email, name } : { email };
  }

  const raw = await bachsFetch<CheckoutSessionResponse>("/v1/checkout-sessions", {
    method: "POST",
    body,
    idempotencyKey: input.idempotencyKey,
  });

  const checkoutId = typeof raw.checkout_id === "string" ? raw.checkout_id.trim() : "";
  const checkoutUrl = typeof raw.checkout_url === "string" ? raw.checkout_url.trim() : "";
  if (!checkoutId) {
    throw new BachsError("Bachs did not return a checkout id.", 502, raw);
  }
  if (!checkoutUrl) {
    throw new BachsError("Bachs did not return a checkout URL.", 502, raw);
  }
  return {
    checkoutId,
    checkoutUrl,
    expiresAt: typeof raw.expires_at === "string" ? raw.expires_at : null,
    raw,
  };
}

/**
 * Read a checkout session back.
 *
 * Two things are read from it. The first is the AMOUNT: Bachs' create response
 * does not echo what it was asked to charge, so the session is the only place
 * the store can see the figure that will actually be collected - and the
 * comparison against the order total is the price-integrity check (the same
 * job the old NOWPayments echo check did).
 *
 * The second is the CHARGE: after the shopper pays, the session carries the
 * payment it produced, which is how the pull path learns the charge id for an
 * order whose webhook never arrived.
 */
export async function getCheckoutSession(checkoutId: string): Promise<CheckoutSessionDetailResponse> {
  const id = String(checkoutId ?? "").trim();
  if (!id) throw new BachsError("A checkout id is required to read a checkout session.", 400);
  return bachsFetch<CheckoutSessionDetailResponse>(
    `/v1/checkout-sessions/${encodeURIComponent(id)}`,
  );
}

/**
 * The authoritative status of a charge, straight from Bachs.
 *
 * The path parameter is the `ch_...` id - Bachs calls it `payment_id` in the
 * path and `charge_id` in the webhook, and they are the same identifier.
 */
export async function getPayment(paymentId: string): Promise<PaymentResponse> {
  const id = String(paymentId ?? "").trim();
  if (!id) throw new BachsError("A charge id is required to read a payment.", 400);
  return bachsFetch<PaymentResponse>(`/v1/payments/${encodeURIComponent(id)}`);
}

/**
 * The account's most recent payments.
 *
 * A cheap AUTHENTICATED read: the list endpoint is refused with 401/403 for a
 * missing or wrong key, so a 200 here is proof the key is real. It needs only
 * `payments:read`, which `payments:write` already includes - so the key the
 * store actually uses can verify itself.
 */
export async function listPayments(limit = 1): Promise<{
  items: PaymentResponse[];
  pagination?: unknown;
}> {
  const capped = Math.min(Math.max(1, Math.trunc(limit) || 1), 100);
  const res = await bachsFetch<{ items?: PaymentResponse[]; pagination?: unknown }>(
    `/v1/payments?limit=${capped}`,
  );
  return { items: Array.isArray(res.items) ? res.items : [], pagination: res.pagination };
}

export interface PaymentMethodInfo {
  id?: string | null;
  display_name?: string | null;
  type?: string | null;
  enabled_by_default?: boolean | null;
  currencies?: string[] | null;
  [key: string]: unknown;
}

/**
 * The account's refunds, most recent first.
 *
 * A second AUTHENTICATED read, used by the configuration verifier to prove the
 * key carries the Refunds resource at all. The WRITE half of that scope cannot
 * be proven without actually issuing a refund - which moves money - so it is
 * reported as unverifiable rather than faked.
 */
export async function listRefunds(limit = 1): Promise<{
  items: RefundResponse[];
  pagination?: unknown;
}> {
  const capped = Math.min(Math.max(1, Math.trunc(limit) || 1), 100);
  const res = await bachsFetch<{ items?: RefundResponse[]; pagination?: unknown }>(
    `/v1/refunds?limit=${capped}`,
  );
  return { items: Array.isArray(res.items) ? res.items : [], pagination: res.pagination };
}

/**
 * The payment methods this account can offer.
 *
 * NOTE: this endpoint is OPEN - it answers 200 with no key at all - so it
 * proves NOTHING about the key. It is reported for context only (it is how an
 * operator sees whether `USD_CARD` is actually enabled on their account), and
 * it never gates the configuration check.
 */
export async function listPaymentMethods(): Promise<PaymentMethodInfo[]> {
  const res = await bachsFetch<{ payment_methods?: PaymentMethodInfo[] }>("/v1/payment-methods");
  return Array.isArray(res.payment_methods) ? res.payment_methods : [];
}

// ── refunds ──────────────────────────────────────────────────────────────────
//
// POST /v1/refunds returns the funds for a charge. It is the ONE money-moving
// call the admin panel can make, so it is deliberately narrow: it takes a
// charge id (never a client-supplied amount unless the operator explicitly
// asks for a partial refund) and it is only ever reached from an
// admin-authenticated procedure.
//
// A refund is NOT instant - Bachs settles it asynchronously and reports the
// outcome through the `refund.*` webhooks - so the order keeps a refund
// STATUS rather than a boolean.

export interface CreateRefundInput {
  /** The `ch_...` charge id to refund. Required. */
  chargeId: string;
  /** A unique reference for this refund (max 128 chars). */
  reference: string;
  /** Amount in the charge's settlement currency. Omit for a full refund. */
  amount?: number;
  /** Free-form reason, recorded on the refund for reconciliation. */
  reason?: string;
  /** A stable key for this attempt, so a retry cannot issue a second refund. */
  idempotencyKey?: string;
}

export async function createRefund(input: CreateRefundInput): Promise<RefundResponse> {
  const chargeId = String(input.chargeId ?? "").trim();
  if (!chargeId) throw new BachsError("A charge id is required to refund.", 400);
  const body: Record<string, unknown> = {
    charge_id: chargeId,
    reference: input.reference.slice(0, 128),
  };
  if (input.amount !== undefined && Number.isFinite(input.amount) && input.amount > 0) {
    body.amount = formatMajor(majorToCents(input.amount));
  }
  if (input.reason) body.reason = input.reason.slice(0, 200);
  if (input.idempotencyKey) body.idempotency_key = input.idempotencyKey.slice(0, 255);
  return bachsFetch<RefundResponse>("/v1/refunds", { method: "POST", body });
}

export type RefundStage = "created" | "refunded" | "failed" | "unknown";

/** Raw refund status -> the store's refund stage. Total: unknown is `unknown`,
 *  never `refunded`. */
export function refundStage(rawStatus: string | null | undefined): RefundStage {
  const s = String(rawStatus ?? "")
    .trim()
    .toLowerCase();
  if (s === "success" || s === "succeeded" || s === "refunded" || s === "paid") return "refunded";
  if (s === "failed") return "failed";
  if (s === "processing" || s === "created" || s === "pending") return "created";
  return "unknown";
}

const REFUND_LABEL: Record<RefundStage, string> = {
  created: "Refund created - funds on the way",
  refunded: "Refunded",
  failed: "Refund failed",
  unknown: "Refund status unknown",
};

export function refundStatusLabel(rawStatus: string | null | undefined): string {
  return REFUND_LABEL[refundStage(rawStatus)];
}

// ── webhook signature verification ───────────────────────────────────────────
//
// Every delivery carries:
//   x-bachs-timestamp    the Unix time (seconds) the event was sent
//   x-bachs-signature    HMAC-SHA256 hex of "{timestamp}.{raw_body}"
//   x-bachs-signature-v2 the same digest, named: "t={timestamp},v1={signature}"
//
// The V2 form is preferred: it names the scheme, so a new one can be introduced
// later without breaking this verifier, and it can carry MORE THAN ONE
// signature - which is what makes rotating the signing secret safe. During a
// rotation every delivery is signed with BOTH the old and the new secret for
// 24 hours, so a verifier that checks only the FIRST `v1=` starts rejecting
// deliveries the moment the rotation lands. This one accepts ANY `v1=`.
//
// Two things must be right or the check is worthless, and both are the reason
// the route reads the body as raw text:
//
//   1. The digest is over the RAW BODY, byte for byte. Parsing the JSON first
//      and re-serializing it can change whitespace and key order, which
//      breaks the digest.
//   2. The comparison is CONSTANT-TIME. A byte-by-byte `===` leaks how much
//      of a forged signature was correct, which is enough to recover one a
//      character at a time.
//
// The timestamp is also checked, with a tolerance: a delivery older than the
// tolerance is a replay, not a payment.

/** How far a delivery's timestamp may be from now, in seconds. */
export const BACHS_WEBHOOK_TOLERANCE_SECONDS = 300;

/** The hex HMAC-SHA256 of "{timestamp}.{raw_body}", exactly as Bachs computes
 *  it. Exported so the rule can be tested against a known vector rather than
 *  only through the route.
 *
 *  The BODY IS HASHED AS BYTES, not as a re-encoded string. The digest is
 *  taken over `timestamp + "." + body`, and the body is the exact byte
 *  sequence that arrived - a body that is not valid UTF-8 would round-trip
 *  differently through a string, and the digest would not match. Bachs' own
 *  SDK hashes the bytes, so this does the same. */
export function computeBachsSignature(
  rawBody: string | Uint8Array,
  timestamp: string,
  secret: string,
): string {
  const bytes = typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : Buffer.from(rawBody);
  return createHmac("sha256", secret)
    .update(`${timestamp}.`, "utf8")
    .update(bytes)
    .digest("hex");
}

export interface SignatureVerdict {
  ok: boolean;
  reason?: string;
}

export interface SignatureInput {
  /** The raw request body, read BEFORE any JSON parsing. Bytes, so the digest
   *  is taken over exactly what arrived. */
  rawBody: string | Uint8Array;
  /** The `X-Bachs-Timestamp` header. */
  timestamp: string | null | undefined;
  /** The `X-Bachs-Signature` header (the plain digest). */
  signature?: string | null;
  /** The `X-Bachs-Signature-V2` header (`t=...,v1=...`). */
  signatureV2?: string | null | undefined;
  /** The endpoint's signing secret. */
  secret: string;
  /** Tolerance for the timestamp, in seconds. */
  toleranceSeconds?: number;
}

/** Every `v1=` digest carried by a V2 header. */
export function parseSignatureV2(header: string): { timestamp: string | null; digests: string[] } {
  const digests: string[] = [];
  let timestamp: string | null = null;
  for (const part of String(header ?? "").split(",")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && value) timestamp = value;
    if (key === "v1" && value) digests.push(value);
  }
  return { timestamp, digests };
}

/**
 * Verify a delivery's signature.
 *
 * Refuses - rather than allows - when no secret is configured: an
 * unverifiable notification must never be trusted, and the pull path still
 * confirms payments without it.
 */
export function verifyBachsSignature(input: SignatureInput): SignatureVerdict {
  const secret = String(input.secret ?? "").trim();
  if (!secret) return { ok: false, reason: "no webhook secret configured" };

  const rawBody = input.rawBody;
  const v2 = parseSignatureV2(String(input.signatureV2 ?? ""));
  const timestamp = String(v2.timestamp ?? input.timestamp ?? "").trim();

  if (!timestamp) return { ok: false, reason: "missing X-Bachs-Timestamp header" };
  if (!/^\d+$/.test(timestamp) || !Number.isSafeInteger(Number(timestamp))) {
    return { ok: false, reason: "malformed timestamp header" };
  }

  const tolerance = input.toleranceSeconds ?? BACHS_WEBHOOK_TOLERANCE_SECONDS;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (age > tolerance) return { ok: false, reason: "timestamp outside the tolerance window" };

  // The digests we may accept: every `v1=` on the V2 header (so a secret
  // rotation keeps working), plus the plain header when it is present.
  const candidates = [...v2.digests];
  const plain = String(input.signature ?? "").trim();
  if (plain) candidates.push(plain);
  if (candidates.length === 0) return { ok: false, reason: "missing signature header" };

  // A hex SHA-256 digest is exactly 64 hex digits. The check accepts UPPERCASE
  // hex too, because hex is case-insensitive and Bachs' own SDK does: a
  // legitimate signature must never be refused over the case of its letters.
  // Checking the shape first means a truncated or non-hex header can never
  // reach the comparison.
  const valid = candidates
    .map((c) => c.trim().toLowerCase())
    .filter((c) => /^[0-9a-f]{64}$/.test(c));
  if (valid.length === 0) return { ok: false, reason: "malformed signature header" };

  let expected: Buffer;
  try {
    expected = Buffer.from(computeBachsSignature(rawBody, timestamp, secret), "hex");
  } catch {
    return { ok: false, reason: "could not compute the signature" };
  }

  for (const candidate of valid) {
    const actual = Buffer.from(candidate, "hex");
    if (actual.length !== expected.length) continue;
    if (timingSafeEqual(actual, expected)) return { ok: true };
  }
  return { ok: false, reason: "signature mismatch" };
}

// ── inbound event parsing ────────────────────────────────────────────────────

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** A decimal string ("29.00") as integer cents, or null. */
function cents(value: unknown): number | null {
  const s = str(value);
  if (s == null) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** The charge id, wherever this particular event carries it. */
function chargeIdOf(data: Record<string, unknown>): string | null {
  const direct = str(data.charge_id) ?? str(data.payment_id);
  if (direct) return direct;
  const charge = data.charge;
  if (charge && typeof charge === "object") {
    return str((charge as Record<string, unknown>).charge_id) ?? str((charge as Record<string, unknown>).id);
  }
  return null;
}

/** The raw charge state, wherever this particular event carries it.
 *
 *  The two event families put it in different places, and getting this wrong
 *  would read a checkout's own state as if it were the charge's:
 *   * a `collection.*` event carries it as `data.status` (UPPERCASE);
 *   * a `checkout.*` event carries `data.status` = the CHECKOUT's state
 *     ("completed", "expired") and the charge's state inside `data.charge`.
 *  So the charge is looked for FIRST, and only a checkout event with no charge
 *  falls back to the checkout's `payment_status`. */
function chargeStatusOf(type: string, data: Record<string, unknown>): string | null {
  const charge = data.charge;
  if (charge && typeof charge === "object") {
    const s = str((charge as Record<string, unknown>).status);
    if (s) return s.toLowerCase();
  }
  if (type.startsWith("checkout.")) {
    // A checkout event with no charge yet. `payment_status` is the checkout's
    // own view of the payment; failing that, `status` is the checkout's
    // lifecycle state ("completed", "expired", "cancelled"), which is still the
    // most useful thing to record.
    const ps = str(data.payment_status);
    if (ps) return ps.toLowerCase();
    const st = str(data.status);
    return st ? st.toLowerCase() : null;
  }
  const direct = str(data.status);
  return direct ? direct.toLowerCase() : null;
}

/** The CHECKOUT's own state, for the events that report it. */
function checkoutStatusOf(type: string, data: Record<string, unknown>): string | null {
  if (!type.startsWith("checkout.")) return null;
  const s = str(data.status);
  return s ? s.toLowerCase() : null;
}

export interface ParsedBachsEvent {
  /** The event id (`evt_...`), used to deduplicate deliveries. */
  eventId: string | null;
  /** The event type (`collection.succeeded`, `refund.paid`, ...). */
  type: string;
  /** The charge id (`ch_...`), when the event is about a charge. */
  chargeId: string | null;
  /** The checkout session id (`chk_...`), when there was one. */
  checkoutId: string | null;
  /** The order number, from the checkout reference or from our metadata. */
  orderNumber: string | null;
  /** The raw charge state, lowercased. */
  rawStatus: string | null;
  /** The store's stage for it. */
  stage: PaymentStage;
  /** The checkout's own state ("open", "completed", "expired"), when the event
   *  is a checkout event. It is what tells a retryable failed ATTEMPT apart
   *  from a checkout that is closed for good. */
  checkoutStatus: string | null;
  /** The amount charged, in cents. */
  amountCents: number | null;
  /** The amount actually received, in cents. */
  amountPaidCents: number | null;
  /** The amount that was due, in cents (an underpaid event carries it). */
  amountExpectedCents: number | null;
  currency: string | null;
  /** The payment method corridor (`USD_CARD`, `CARD`, ...). */
  paymentMethod: string | null;
  /** For a refund event: the refund id. */
  refundId: string | null;
  /** For a refund event: the raw refund status. */
  refundStatus: string | null;
  /** The whole `data` object, for the admin panel. */
  data: Record<string, unknown>;
}

/**
 * Normalise a webhook body into the fields the store acts on.
 *
 * Returns null when the body carries no event type - which is how a body that
 * is not a Bachs event at all is recognised and ignored instead of being
 * mistaken for a payment.
 *
 * Lenient by construction: Bachs may add fields to the envelope at any time,
 * and the events we care about carry the same facts in slightly different
 * places (`data.charge_id` on a collection event, `data.charge.id` on a
 * checkout event), so each fact is looked for in every place it can be.
 */
export function parseBachsEvent(payload: Record<string, unknown> | null | undefined): ParsedBachsEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const type = str(payload.type);
  if (!type) return null;

  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : {};

  const metadata =
    data.metadata && typeof data.metadata === "object"
      ? (data.metadata as Record<string, unknown>)
      : {};

  // A refund event's own `reference` is the REFUND reference, not an order
  // number, so it is deliberately not read as one here.
  const isRefund = type.startsWith("refund.");
  const reference = isRefund ? null : str(data.reference);
  const metaOrder = str(metadata.order_number) ?? str(metadata.order_id);

  // A `refund.*` event is about a refund, not a charge; its own status lives
  // in `data.status` too, but it means something different.
  const rawStatus = chargeStatusOf(type, data);
  const refundStatus = isRefund ? rawStatus : null;

  const chargeStatus = isRefund ? null : rawStatus;
  const stage: PaymentStage = isRefund ? "pending" : paymentStage(chargeStatus);

  return {
    eventId: str(payload.id),
    type: type.toLowerCase(),
    chargeId: isRefund ? str(data.charge_id) : chargeIdOf(data),
    checkoutId: str(data.checkout_id),
    orderNumber: metaOrder ?? reference,
    rawStatus: chargeStatus ?? refundStatus,
    stage,
    checkoutStatus: checkoutStatusOf(type, data),
    amountCents: cents(data.amount) ?? cents(data.requested_amount) ?? cents(data.amount_paid),
    amountPaidCents: cents(data.amount_paid) ?? cents(data.refunded_amount),
    amountExpectedCents: cents(data.amount_expected) ?? cents(data.amount),
    currency: str(data.currency) ?? str(data.settlement_currency),
    paymentMethod: str(data.payment_method),
    refundId: isRefund ? str(data.refund_id) : null,
    refundStatus,
    data,
  };
}

// ── the view the storefront renders ──────────────────────────────────────────
//
// A compact, JSON-safe view of a live payment, for the storefront's status
// panel. This is the shape the client is allowed to see: it is the CUSTOMER's
// own payment, so the amounts and the card's last four are appropriate - and
// it carries no key material and nothing belonging to another order.

export interface PaymentStatusView {
  provider: "bachs";
  /** The store's coarse state: unpaid | paid | failed | refunded. */
  paymentStatus: string;
  /** The RAW provider status ("succeeded", "processing", "failed", ...), so the
   *  shopper sees the real state rather than a smoothed-over one. */
  status: string | null;
  stage: PaymentStage;
  label: string;
  terminal: boolean;
  /** The charge id (`ch_...`). */
  chargeId: string | null;
  /** The checkout session id (`chk_...`). */
  checkoutId: string | null;
  /** The hosted checkout URL, so a shopper can return to an unfinished one. */
  checkoutUrl: string | null;
  /** The payment method that collected it (`USD_CARD` / `CARD`). */
  paymentMethod: string | null;
  /** The amount due, in cents. */
  amountCents: number | null;
  /** The amount actually received, in cents. */
  amountPaidCents: number | null;
  /** The currency the payment was collected in. */
  currency: string | null;
  /** True when Bachs is reachable but this order has no charge yet. */
  awaitingPayment: boolean;
  /** True when the store has a Bachs API key, so a live lookup is even
   *  possible. False means the store is running in offline-settlement mode and
   *  the UI must say so plainly rather than implying a payment is in flight. */
  configured: boolean;
  /** Set when the live lookup could not be performed (provider down / not
   *  configured). The stored order status is still returned, so the page always
   *  renders - it just says the live figure is stale. */
  error: string | null;
}

/** Turn a live charge into the view above. */
export function toPaymentStatusView(
  payment: PaymentResponse | null,
  fallback: {
    paymentStatus: string;
    storedStatus?: string | null;
    error?: string | null;
    configured?: boolean;
    checkoutUrl?: string | null;
    chargeId?: string | null;
    checkoutId?: string | null;
  } = {
    paymentStatus: "unpaid",
  },
): PaymentStatusView {
  const rawStatus = payment?.status ? String(payment.status).toLowerCase() : null;
  const stage: PaymentStage = rawStatus ? paymentStage(rawStatus) : "pending";
  // The store's own status is the PRIORITY field: once an order is recorded
  // paid, a later flaky lookup must never downgrade it back to pending - and
  // the STAGE and the LABEL must not be downgraded either, or the shopper
  // would be told "payment failed" about an order that has already shipped.
  const settled = fallback.paymentStatus === "paid" || stage === "paid";
  const effectiveStage: PaymentStage = settled && stage !== "paid" ? "paid" : stage;
  const paymentStatus = settled ? "paid" : fallback.paymentStatus;
  return {
    provider: "bachs",
    paymentStatus,
    status: rawStatus,
    stage: effectiveStage,
    label: statusLabel(settled ? "succeeded" : (rawStatus ?? fallback.storedStatus ?? "")),
    terminal: isTerminalStage(effectiveStage),
    chargeId: payment ? str(payment.payment_id) : (fallback.chargeId ?? null),
    checkoutId: payment ? str(payment.checkout_id) : (fallback.checkoutId ?? null),
    checkoutUrl: fallback.checkoutUrl ?? null,
    paymentMethod: payment ? str(payment.payment_method) : null,
    amountCents: payment ? cents(payment.amount) : null,
    amountPaidCents: payment ? cents(payment.amount_paid) : null,
    currency: payment ? str(payment.currency) : null,
    awaitingPayment: !payment,
    configured: fallback.configured ?? isBachsConfigured(),
    error: fallback.error ?? null,
  };
}
