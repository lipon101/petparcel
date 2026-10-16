// NOWPayments integration - the store's crypto payment rail.
//
// PetParcel takes crypto through NOWPayments. It is a HOSTED checkout: we create
// an invoice, hand the shopper to NOWPayments' own payment page, and confirm the
// outcome server-to-server. PetParcel never touches a private key or wallet
// material, so there is no card-like or custodial secret to hold here.
//
// TWO CREDENTIALS, TWO DIFFERENT JOBS - and keeping them apart IS the security
// model:
//
//   NOWPAYMENTS_API_KEY     authenticates OUR OUTBOUND calls (create an invoice,
//                           read a payment's status). It can move money, so it
//                           lives on the server and is NEVER sent to a browser.
//
//   NOWPAYMENTS_IPN_SECRET  verifies THEIR INBOUND callbacks. It is used for
//                           exactly one thing - recomputing the HMAC-SHA512 over
//                           a webhook body and comparing it to the
//                           `x-nowpayments-sig` header. A wrong or missing
//                           signature is a rejection, never a trust.
//
// Both are read from the environment ONLY - never the DB, never committed. See
// the NOWPayments dashboard (Settings -> API keys / IPN) for the steps that
// produce them.
//
// FAIL-SAFE, NOT FAIL-OPEN.
//   * With NO API KEY the store still runs end to end: `createInvoice` is not
//     attempted at all, checkout records the order `unpaid` for offline
//     settlement, and the admin marks it paid when funds land. That is the same
//     posture the store had before crypto was switched on - checkout is never
//     blocked by a missing key.
//   * With NO IPN SECRET the webhook route REFUSES every request, because a
//     signature cannot be verified without a key. Payments are then still
//     confirmed by the PULL path (the status endpoint asks NOWPayments
//     directly), so a missing secret degrades reliability rather than opening a
//     hole where an unsigned POST could mark an order paid.
//
// Real endpoints, as documented at
// https://documenter.getpostman.com/view/7907941/2s93JusNJt :
//   POST /v1/invoice             create the hosted invoice we redirect to
//   GET  /v1/payment/{payment_id}  the authoritative payment status
//   GET  /v1/invoice-payment     payments belonging to an invoice

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";
import { formatMajor, majorToCents } from "../../shared/money";

/** Production base. Overridable ONLY for a stub server in tests - never point a
 *  live deployment somewhere else by accident, which is why the default is the
 *  real host and the override is an explicit variable. */
export const NOWPAYMENTS_DEFAULT_BASE = "https://api.nowpayments.io/v1";

export interface NowPaymentsConfig {
  apiKey: string;
  ipnSecret: string;
  baseUrl: string;
  /** Optional fixed `pay_currency`, e.g. "usdttrc20". Empty = let the shopper
   *  choose any coin NOWPayments supports on the hosted invoice. */
  payCurrency: string;
}

export function nowPaymentsConfig(): NowPaymentsConfig {
  const baseUrl = (env.nowpayments.baseUrl || NOWPAYMENTS_DEFAULT_BASE).replace(/\/+$/, "");
  return {
    apiKey: env.nowpayments.apiKey.trim(),
    ipnSecret: env.nowpayments.ipnSecret.trim(),
    baseUrl,
    payCurrency: env.nowpayments.payCurrency.trim().toLowerCase(),
  };
}

/** Can we CREATE payments? Without this the provider runs in offline mode. */
export function isNowPaymentsConfigured(): boolean {
  return Boolean(nowPaymentsConfig().apiKey);
}

/** Can we VERIFY inbound webhooks? Without this the IPN route refuses. */
export function isIpnVerificationConfigured(): boolean {
  return Boolean(nowPaymentsConfig().ipnSecret);
}

/** An error from the NOWPayments API, carrying the upstream status so a caller
 *  can tell "the merchant key is wrong" (401/403) from "the upstream is down"
 *  (5xx) without string-matching a message. */
export class NowPaymentsError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status = 502, details: unknown = null) {
    super(message);
    this.name = "NowPaymentsError";
    this.status = status;
    this.details = details;
  }
}

// ── status mapping ───────────────────────────────────────────────────────────
//
// NOWPayments reports a RAW provider status. The store has its own, narrower
// vocabulary, and the mapping between them is the piece that decides whether an
// order ships - so it is explicit, total, and pinned by tests.
//
//   waiting          the invoice is open, no funds seen yet
//   confirming       funds seen, network is confirming
//   confirmed        the network confirmed the deposit
//   sending          NOWPayments is settling the funds
//   partially_paid   LESS than the invoice total arrived - NOT paid
//   finished         settled and complete - the ONLY status that ships goods
//   failed           the payment failed
//   refunded         sent back to the customer
//   expired          the invoice's payment window closed
//
// `partially_paid` is deliberately NOT paid: shipping a short payment is a real,
// unrecoverable loss. It stays "confirming" so the shopper sees that something
// arrived and that the balance is outstanding.
export type PaymentStage = "pending" | "confirming" | "paid" | "failed" | "expired" | "refunded";

const PAID_STATUSES = new Set(["finished"]);
const FAILED_STATUSES = new Set(["failed"]);
const EXPIRED_STATUSES = new Set(["expired"]);
const REFUNDED_STATUSES = new Set(["refunded"]);
const CONFIRMING_STATUSES = new Set(["confirming", "confirmed", "sending", "partially_paid"]);

/** Raw NOWPayments status -> the store's stage. Total: an unknown status is
 *  treated as pending, never as paid. */
export function paymentStage(rawStatus: string): PaymentStage {
  const s = String(rawStatus ?? "").trim().toLowerCase();
  if (PAID_STATUSES.has(s)) return "paid";
  if (FAILED_STATUSES.has(s)) return "failed";
  if (EXPIRED_STATUSES.has(s)) return "expired";
  if (REFUNDED_STATUSES.has(s)) return "refunded";
  if (CONFIRMING_STATUSES.has(s)) return "confirming";
  return "pending";
}

export function isPaidStatus(rawStatus: string): boolean {
  return paymentStage(rawStatus) === "paid";
}

/** Has the payment reached a state that will not change on its own? Used to stop
 *  the confirmation page polling forever. */
export function isTerminalStage(stage: PaymentStage): boolean {
  return stage === "paid" || stage === "failed" || stage === "expired" || stage === "refunded";
}

/** Shopper-facing wording for a RAW status (or a stage). Kept here, next to the
 *  mapping, so the server and the client can never disagree about what
 *  "partially_paid" is called. */
const STATUS_LABEL: Record<string, string> = {
  waiting: "Waiting for your payment",
  confirming: "Confirming on the blockchain",
  confirmed: "Payment confirmed, settling",
  sending: "Settling your payment",
  partially_paid: "Part-paid - balance still outstanding",
  finished: "Payment complete",
  failed: "Payment failed",
  refunded: "Payment refunded",
  expired: "Payment window expired",
  pending: "Waiting for your payment",
  paid: "Payment complete",
};

export function statusLabel(rawStatusOrStage: string): string {
  const key = String(rawStatusOrStage ?? "").trim().toLowerCase();
  return STATUS_LABEL[key] ?? "Awaiting payment";
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────

/** Pull a human-readable message out of whatever error shape the API used. The
 *  endpoint answers `{message}` for most faults and `{message:{...}}` for
 *  validation ones, so this descends rather than assuming. */
export function extractApiMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const key of ["message", "error", "detail"]) {
    const value = p[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      const nested = extractApiMessage(value);
      if (nested) return nested;
    }
  }
  return null;
}

async function nowPaymentsFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { apiKey, baseUrl } = nowPaymentsConfig();
  if (!apiKey) {
    throw new NowPaymentsError(
      "NOWPayments is not configured (NOWPAYMENTS_API_KEY is unset).",
      503,
    );
  }

  const res = await outboundFetch(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      // The key authenticates US to THEM. It is added here, on the server, and
      // never leaves it - no client code path can reach this function.
      "x-api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
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
    throw new NowPaymentsError(
      extractApiMessage(parsed) ?? `NOWPayments returned HTTP ${res.status}.`,
      res.status,
      parsed,
    );
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new NowPaymentsError("NOWPayments returned an unreadable response.", 502, text.slice(0, 300));
  }
  return parsed as T;
}

// ── response shapes ──────────────────────────────────────────────────────────

export interface InvoiceResponse {
  id?: string | number | null;
  order_id?: string | null;
  order_description?: string | null;
  price_amount?: number | string | null;
  price_currency?: string | null;
  pay_currency?: string | null;
  invoice_url?: string | null;
  success_url?: string | null;
  cancel_url?: string | null;
  ipn_callback_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PaymentStatusResponse {
  payment_id?: string | number | null;
  invoice_id?: string | number | null;
  parent_payment_id?: string | number | null;
  payment_status?: string | null;
  pay_address?: string | null;
  pay_currency?: string | null;
  price_amount?: number | string | null;
  price_currency?: string | null;
  pay_amount?: number | string | null;
  actually_paid?: number | string | null;
  outcome_amount?: number | string | null;
  outcome_currency?: string | null;
  order_id?: string | null;
  order_description?: string | null;
  purchase_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InvoicePaymentsResponse {
  invoice_id?: string | number | null;
  payments?: PaymentStatusResponse[] | null;
}

// ── outbound calls ───────────────────────────────────────────────────────────

export interface CreateInvoiceInput {
  /** Amount in MAJOR units of `priceCurrency` (e.g. 84.97 for $84.97). It comes
   *  from the order the server just priced - never from the browser. */
  priceAmount: number;
  priceCurrency: string;
  /** Our order number. NOWPayments echoes it back on every notification and
   *  status read, which is how a callback is tied to an order. */
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl: string;
  cancelUrl: string;
  payCurrency?: string;
}

export interface CreateInvoiceResult {
  invoiceId: string | null;
  invoiceUrl: string;
  orderId: string;
  raw: InvoiceResponse;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Create a hosted invoice and return the URL to send the browser to.
 *
 * This is the Invoice API (POST /v1/invoice) rather than the direct Payment API
 * (POST /v1/payment) on purpose: an invoice gives the shopper NOWPayments' own
 * hosted page - coin selection, live rate, address and QR - so the storefront
 * never has to render payment instructions, and a rate that goes stale in the
 * browser cannot become a wrong amount charged.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
  const body: Record<string, unknown> = {
    price_amount: round2(input.priceAmount),
    price_currency: (input.priceCurrency || "usd").toLowerCase(),
    order_id: input.orderId,
    order_description: input.orderDescription.slice(0, 200),
    ipn_callback_url: input.ipnCallbackUrl,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    // The customer carries the network/computing fee, so the amount the store
    // collects is the amount the order was priced at.
    is_fee_paid_by_user: false,
  };
  if (input.payCurrency) body.pay_currency = input.payCurrency.toLowerCase();

  const raw = await nowPaymentsFetch<InvoiceResponse>("/invoice", { method: "POST", body });
  const invoiceUrl = typeof raw.invoice_url === "string" ? raw.invoice_url.trim() : "";
  if (!invoiceUrl) {
    throw new NowPaymentsError("NOWPayments did not return an invoice URL.", 502, raw);
  }

  // ── The invoice must agree with the order, or it is refused ────────────────
  // Both values below are the provider ECHOING BACK what we sent, so a mismatch
  // means the customer would be charged something other than the order total, or
  // the settlement webhook would be delivered somewhere that cannot verify it.
  // Either one silently strands a paid order on "awaiting payment", so an
  // inconsistent invoice is rejected outright rather than persisted.
  //
  // The price is compared in INTEGER CENTS, so a float representation difference
  // (84.97 vs 84.97000000000001) is not a false alarm, while a genuine one-cent
  // disagreement still is.
  if (raw.price_amount !== null && raw.price_amount !== undefined) {
    const echoedCents = majorToCents(raw.price_amount);
    const sentCents = majorToCents(input.priceAmount);
    if (echoedCents !== sentCents) {
      throw new NowPaymentsError(
        `NOWPayments priced the invoice at ${formatMajor(echoedCents)} but the order total is ${formatMajor(sentCents)}.`,
        502,
        raw,
      );
    }
  }
  if (
    typeof raw.ipn_callback_url === "string" &&
    raw.ipn_callback_url.trim() &&
    raw.ipn_callback_url.trim() !== input.ipnCallbackUrl
  ) {
    throw new NowPaymentsError(
      "NOWPayments registered a different IPN callback URL than the store sent.",
      502,
      raw,
    );
  }
  return {
    invoiceId: raw.id !== null && raw.id !== undefined ? String(raw.id) : null,
    invoiceUrl,
    orderId: String(raw.order_id ?? input.orderId),
    raw,
  };
}

/** The authoritative status of a single payment, straight from NOWPayments. */
export async function getPaymentStatus(paymentId: string | number): Promise<PaymentStatusResponse> {
  const id = String(paymentId ?? "").trim();
  if (!id) throw new NowPaymentsError("A payment id is required to read a payment status.", 400);
  return nowPaymentsFetch<PaymentStatusResponse>(`/payment/${encodeURIComponent(id)}`);
}

/** Every payment recorded against an invoice. Used when the store knows only the
 *  invoice id (which is what `createInvoice` returns) and not yet a
 *  `payment_id` - the latter only exists once the shopper has actually started
 *  paying. */
export async function getInvoicePayments(invoiceId: string | number): Promise<InvoicePaymentsResponse> {
  const id = String(invoiceId ?? "").trim();
  if (!id) throw new NowPaymentsError("An invoice id is required.", 400);
  return nowPaymentsFetch<InvoicePaymentsResponse>(
    `/invoice-payment?invoice_id=${encodeURIComponent(id)}`,
  );
}

/**
 * Resolve the live payment status for an invoice id with NO payment id yet.
 * Returns the most advanced payment on the invoice, because an invoice can carry
 * more than one attempt (a customer who underpaid and topped up produces two).
 */
export async function getInvoiceStatus(invoiceId: string | number): Promise<PaymentStatusResponse | null> {
  const res = await getInvoicePayments(invoiceId);
  const payments = Array.isArray(res.payments) ? res.payments : [];
  if (payments.length === 0) return null;
  const rank: Record<PaymentStage, number> = {
    paid: 5,
    confirming: 4,
    pending: 3,
    refunded: 2,
    failed: 1,
    expired: 0,
  };
  return payments.reduce((best, candidate) =>
    rank[paymentStage(String(candidate.payment_status ?? ""))] >
    rank[paymentStage(String(best.payment_status ?? ""))]
      ? candidate
      : best,
  );
}

// ── health + capability probes ───────────────────────────────────────────────
//
// These two are what the verification script uses to prove the API key is REAL
// and not merely present: `/status` is the documented availability probe, and
// `/currencies` is an AUTHENTICATED read - it only answers 200 when the key is
// valid, so a 401/403 here is the definitive "this key does not work" signal.

export interface ApiStatusResponse {
  message?: string | null;
}

/** GET /status - the documented API availability probe. */
export async function getApiStatus(): Promise<ApiStatusResponse> {
  return nowPaymentsFetch<ApiStatusResponse>("/status");
}

export interface CurrenciesResponse {
  currencies?: string[] | null;
}

/** GET /currencies - the coins this account can accept. NOTE: this endpoint is
 *  PUBLIC - it answers 200 even with no key at all, so it proves nothing about
 *  the key. Use `getBalance` to actually authenticate. */
export async function getCurrencies(): Promise<CurrenciesResponse> {
  return nowPaymentsFetch<CurrenciesResponse>("/currencies");
}

export interface BalanceResponse {
  [currency: string]: unknown;
}

/** GET /balance - the account's balances. This is a genuinely AUTHENTICATED
 *  read: a bad or missing key is refused with 403 INVALID_API_KEY, so a 200
 *  here is proof the key is real. This is what the verifier authenticates with. */
export async function getBalance(): Promise<BalanceResponse> {
  return nowPaymentsFetch<BalanceResponse>("/balance");
}

// ── refunds ──────────────────────────────────────────────────────────────────
//
// POST /refund returns the funds for a payment. It is the ONE money-moving call
// the admin panel can make, so it is deliberately narrow: it takes a payment id
// (never a client-supplied amount unless the operator explicitly asks for a
// partial refund) and it is only ever reached from an admin-authenticated
// procedure.
//
// NOWPayments reports a refund's own lifecycle, which is separate from the
// payment's: `created` (accepted, not yet sent), `refunded` (funds sent),
// `failed`. A refund is NOT instant - it is a payout that has to be signed and
// broadcast - so the order keeps a refund STATUS rather than a boolean.

export interface RefundResponse {
  id?: string | number | null;
  payment_id?: string | number | null;
  invoice_id?: string | number | null;
  amount?: number | string | null;
  currency?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface CreateRefundInput {
  /** The NOWPayments payment id to refund. Required. */
  paymentId: string | number;
  /** Amount in the PAYMENT (crypto) currency. Omit for a full refund. */
  amount?: number;
  /** Where NOWPayments should POST the refund's status changes. */
  ipnCallbackUrl?: string;
  /** Free-form reason, recorded on the refund for reconciliation. */
  reason?: string;
}

/** POST /refund - return funds for a payment. */
export async function createRefund(input: CreateRefundInput): Promise<RefundResponse> {
  const paymentId = String(input.paymentId ?? "").trim();
  if (!paymentId) throw new NowPaymentsError("A payment id is required to refund.", 400);
  const body: Record<string, unknown> = { payment_id: paymentId };
  if (input.amount !== undefined && Number.isFinite(input.amount) && input.amount > 0) {
    body.amount = input.amount;
  }
  if (input.ipnCallbackUrl) body.ipn_callback_url = input.ipnCallbackUrl;
  if (input.reason) body.reason = input.reason.slice(0, 200);
  return nowPaymentsFetch<RefundResponse>("/refund", { method: "POST", body });
}

export type RefundStage = "created" | "refunded" | "failed" | "unknown";

/** Raw refund status -> the store's refund stage. Total: unknown is `unknown`,
 *  never `refunded`. */
export function refundStage(rawStatus: string | null | undefined): RefundStage {
  const s = String(rawStatus ?? "").trim().toLowerCase();
  if (s === "refunded" || s === "finished" || s === "success") return "refunded";
  if (s === "failed" || s === "rejected") return "failed";
  if (s === "created" || s === "pending" || s === "processing") return "created";
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

// ── IPN signature verification ───────────────────────────────────────────────
//
// The spec (and NOWPayments' own sample) is: alphabetically sort the body's keys
// RECURSIVELY, `JSON.stringify` the result, HMAC-SHA512 it with the IPN secret,
// hex-encode, and compare to `x-nowpayments-sig`.
//
// The sort must be recursive because the notification body contains NESTED
// objects (a `fee` object, and in some events a `payment_extra_ids` array) - a
// shallow sort produces a different digest and would reject legitimate
// callbacks. And the comparison must be constant-time, because a byte-by-byte
// `===` leaks how much of a forged signature was correct, which is enough to
// recover one a character at a time.

/** Recursively sort every object's keys, preserving arrays element-wise. */
export function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = sortObject(source[key]);
    return out;
  }
  return value;
}

/** The hex HMAC-SHA512 of a notification body, exactly as NOWPayments computes
 *  it. Exported so the verification rule can be tested against a known vector
 *  rather than only through the route. */
export function computeIpnSignature(payload: unknown, secret: string): string {
  return createHmac("sha512", secret).update(JSON.stringify(sortObject(payload))).digest("hex");
}

export interface IpnVerdict {
  ok: boolean;
  reason?: string;
}

/**
 * Verify a callback's signature.
 *
 * Refuses - rather than allows - when no secret is configured: an unverifiable
 * notification must never be trusted, and the pull path still confirms payments
 * without it.
 */
export function verifyIpnSignature(
  payload: unknown,
  signature: string | null | undefined,
  secret: string = env.nowpayments.ipnSecret,
): IpnVerdict {
  const key = String(secret ?? "").trim();
  if (!key) return { ok: false, reason: "no IPN secret configured" };

  const given = String(signature ?? "").trim().toLowerCase();
  if (!given) return { ok: false, reason: "missing x-nowpayments-sig header" };
  // A hex SHA-512 digest is exactly 128 hex characters. Checking the shape first
  // means a truncated or non-hex header can never reach the comparison.
  if (!/^[0-9a-f]{128}$/.test(given)) return { ok: false, reason: "malformed signature header" };

  let expected: Buffer;
  try {
    expected = Buffer.from(computeIpnSignature(payload, key), "hex");
  } catch {
    return { ok: false, reason: "could not compute the signature" };
  }
  const actual = Buffer.from(given, "hex");
  if (actual.length !== expected.length) return { ok: false, reason: "signature length mismatch" };
  return timingSafeEqual(actual, expected) ? { ok: true } : { ok: false, reason: "signature mismatch" };
}

// ── inbound notification parsing ─────────────────────────────────────────────

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export interface ParsedNotification {
  paymentId: string | null;
  invoiceId: string | null;
  parentPaymentId: string | null;
  /** The merchant order id we set at invoice creation (our order number). */
  orderId: string | null;
  rawStatus: string;
  stage: PaymentStage;
  priceAmount: number | null;
  priceCurrency: string | null;
  payAmount: number | null;
  payCurrency: string | null;
  actuallyPaid: number | null;
  outcomeAmount: number | null;
  outcomeCurrency: string | null;
  payAddress: string | null;
  purchaseId: string | null;
}

/**
 * Normalise a webhook / status body into the fields the store acts on.
 *
 * Returns null when the body carries no `payment_status` at all - which is how a
 * payout notification (a different event family that this endpoint also
 * receives) is recognised and ignored instead of being mistaken for a payment.
 */
export function parseNotification(payload: Record<string, unknown> | null | undefined): ParsedNotification | null {
  if (!payload || typeof payload !== "object") return null;
  const rawStatus = str(payload.payment_status);
  if (!rawStatus) return null;
  return {
    paymentId: str(payload.payment_id),
    invoiceId: str(payload.invoice_id),
    parentPaymentId: str(payload.parent_payment_id),
    orderId: str(payload.order_id),
    rawStatus: rawStatus.toLowerCase(),
    stage: paymentStage(rawStatus),
    priceAmount: num(payload.price_amount),
    priceCurrency: str(payload.price_currency),
    payAmount: num(payload.pay_amount),
    payCurrency: str(payload.pay_currency),
    actuallyPaid: num(payload.actually_paid),
    outcomeAmount: num(payload.outcome_amount),
    outcomeCurrency: str(payload.outcome_currency),
    payAddress: str(payload.pay_address),
    purchaseId: str(payload.purchase_id),
  };
}

/** A compact, JSON-safe view of a live payment, for the storefront's status
 *  panel. This is the shape the client is allowed to see: it is the CUSTOMER's
 *  own payment, so the address and amounts are appropriate - and it carries no
 *  key material and nothing belonging to another order. */
export interface PaymentStatusView {
  provider: "nowpayments";
  /** The store's coarse state: unpaid | paid | failed | refunded. */
  paymentStatus: string;
  /** The RAW provider status ("waiting", "confirming", "finished", ...), so the
   *  shopper sees the real state rather than a smoothed-over one. */
  status: string | null;
  stage: PaymentStage;
  label: string;
  terminal: boolean;
  paymentId: string | null;
  invoiceId: string | null;
  payAddress: string | null;
  payCurrency: string | null;
  payAmount: number | null;
  actuallyPaid: number | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  outcomeAmount: number | null;
  outcomeCurrency: string | null;
  /** True when the provider is reachable but this order has no payment yet. */
  awaitingPayment: boolean;
  /** True when the store has a NOWPayments API key, so a live lookup is even
   *  possible. False means the store is running in offline-settlement mode and
   *  the UI must say so plainly rather than implying a payment is in flight. */
  configured: boolean;
  /** Set when the live lookup could not be performed (provider down / not
   *  configured). The stored order status is still returned, so the page always
   *  renders - it just says the live figure is stale. */
  error: string | null;
}

/** Turn a raw status response into the view above. */
export function toPaymentStatusView(
  payment: PaymentStatusResponse | null,
  fallback: {
    paymentStatus: string;
    storedStatus?: string | null;
    error?: string | null;
    configured?: boolean;
  } = {
    paymentStatus: "unpaid",
  },
): PaymentStatusView {
  const rawStatus = payment?.payment_status ? String(payment.payment_status).toLowerCase() : null;
  const stage: PaymentStage = rawStatus ? paymentStage(rawStatus) : "pending";
  // The store's own status is the PRIORITY field: once an order is recorded
  // paid, a later flaky lookup must never downgrade it back to pending.
  const paymentStatus =
    fallback.paymentStatus === "paid" || stage === "paid" ? "paid" : fallback.paymentStatus;
  return {
    provider: "nowpayments",
    paymentStatus,
    status: rawStatus,
    stage,
    label: statusLabel(rawStatus ?? fallback.storedStatus ?? ""),
    terminal: isTerminalStage(stage),
    paymentId: payment ? str(payment.payment_id) : null,
    invoiceId: payment ? str(payment.invoice_id) : null,
    payAddress: payment?.pay_address ? String(payment.pay_address) : null,
    payCurrency: payment?.pay_currency ? String(payment.pay_currency) : null,
    payAmount: payment ? num(payment.pay_amount) : null,
    actuallyPaid: payment ? num(payment.actually_paid) : null,
    priceAmount: payment ? num(payment.price_amount) : null,
    priceCurrency: payment?.price_currency ? String(payment.price_currency) : null,
    outcomeAmount: payment ? num(payment.outcome_amount) : null,
    outcomeCurrency: payment?.outcome_currency ? String(payment.outcome_currency) : null,
    awaitingPayment: !payment,
    configured: fallback.configured ?? isNowPaymentsConfigured(),
    error: fallback.error ?? null,
  };
}

/** Map a raw provider status onto the store's own payment_status vocabulary
 *  (`unpaid` | `paid` | `failed` | `refunded`, per shared/store.ts), so the
 *  admin panel and the order timeline keep working unchanged. `partially_paid`
 *  and every in-flight status stay `unpaid` - see the mapping note above. */
export function storePaymentStatusFor(rawStatus: string): "unpaid" | "paid" | "failed" | "refunded" {
  const stage = paymentStage(rawStatus);
  if (stage === "paid") return "paid";
  if (stage === "failed" || stage === "expired") return "failed";
  if (stage === "refunded") return "refunded";
  return "unpaid";
}
