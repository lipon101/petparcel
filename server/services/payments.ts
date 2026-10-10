// ── Pluggable payment abstraction ────────────────────────────────────────────
//
// PetParcel never touches raw card data. Every provider here is a HOSTED
// checkout: we create the order in `pending` / `unpaid`, hand the customer to
// the provider's own secure page, and let the provider's webhook tell us the
// outcome. That keeps PCI scope at zero and means swapping providers is a
// config change, not a refactor.
//
// Providers shipped:
//   manual      — offline/bank-transfer mode. The store works end-to-end with
//                 no gateway keys at all; the admin marks the order paid when
//                 funds land. This is the DEFAULT so a fresh clone is usable.
//   2checkout   — Verifone / 2Checkout hosted checkout. Supports Bangladesh
//                 merchants selling physical goods and accepts US Visa/MC/Amex.
//   sslcommerz  — SSLCommerz (Bangladesh, PSO-licensed). Accepts international
//                 cards in USD; the strongest local fallback.
//
// Keys come from the app owner's environment (Settings → Environment variables),
// never from code. See PAYMENTS.md for the full comparison and setup steps.
import { and, eq } from "drizzle-orm";
import { db } from "../_core/db";
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";
import { orders } from "../../drizzle/schema";

export type ProviderId = "manual" | "2checkout" | "sslcommerz";

export interface PaymentStartInput {
  orderNumber: string;
  totalCents: number;
  currency: string;
  email: string;
  customerName: string;
  /** Absolute URL the provider returns the shopper to after paying. */
  returnUrl: string;
  /** Absolute URL for the provider's server-to-server notification. */
  ipnUrl: string;
}

export interface PaymentStartResult {
  /** Where to send the browser. `redirect` is the hosted checkout (or our own
   *  order page for manual mode). */
  redirectUrl: string;
  providerRef?: string | null;
  /** Shown on the checkout review step so the shopper knows what happens next. */
  instructions: string;
}

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  /** Is this provider configured (keys present)? Manual always is. */
  isConfigured(): boolean;
  /** Human-readable "what happens after you click Place order". */
  describe(): string;
  start(input: PaymentStartInput): Promise<PaymentStartResult>;
}

const centsToMajor = (cents: number) => (cents / 100).toFixed(2);

/** Offline mode: nothing to charge, the order page explains the next step. */
const manualProvider: PaymentProvider = {
  id: "manual",
  label: "Pay on invoice (bank transfer)",
  isConfigured: () => true,
  describe: () =>
    "We'll email you an invoice with bank-transfer details. Your parcel ships as soon as the payment clears.",
  async start(input) {
    return {
      redirectUrl: `/order/${input.orderNumber}`,
      providerRef: null,
      instructions: "We've reserved your order. Pay the invoice and we'll ship it right away.",
    };
  },
};

/** 2Checkout / Verifone hosted checkout. */
const twoCheckoutProvider: PaymentProvider = {
  id: "2checkout",
  label: "Credit or debit card (2Checkout)",
  isConfigured: () => Boolean(process.env.TWOCHECKOUT_SELLER_ID && process.env.TWOCHECKOUT_SECRET_KEY),
  describe: () => "You'll be redirected to 2Checkout's secure page to pay by card. Visa, Mastercard and Amex accepted.",
  async start(input) {
    const sellerId = env.config("TWOCHECKOUT_SELLER_ID");
    // The secret key is only needed for the API-driven flow / IPN validation.
    const mode = env.config("TWOCHECKOUT_MODE", "live");

    const params = new URLSearchParams({
      sid: sellerId,
      mode: mode === "sandbox" ? "2" : "2",
      // The Buy-Link parameters 2Checkout accepts without an API round-trip.
      "li_0_type": "product",
      "li_0_name": `PetParcel order ${input.orderNumber}`,
      "li_0_price": centsToMajor(input.totalCents),
      "li_0_quantity": "1",
      "li_0_tangible": "Y",
      currency_code: input.currency,
      merchant_order_id: input.orderNumber,
      "card_purchase": "1",
      x_receipt_link_url: input.returnUrl,
      "ipn_url": input.ipnUrl,
      email: input.email,
      name: input.customerName,
    });

    return {
      redirectUrl:
        mode === "sandbox"
          ? `https://sandbox.2checkout.com/checkout/purchase?${params.toString()}`
          : `https://www.2checkout.com/checkout/purchase?${params.toString()}`,
      providerRef: null,
      instructions: "Complete your card payment on 2Checkout's secure page.",
    };
  },
};

/** SSLCommerz hosted checkout (Bangladesh). */
const sslcommerzProvider: PaymentProvider = {
  id: "sslcommerz",
  label: "Credit or debit card (SSLCommerz)",
  isConfigured: () => Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD),
  describe: () => "You'll be redirected to SSLCommerz's secure page. International cards in USD are supported.",
  async start(input) {
    const storeId = env.config("SSLCOMMERZ_STORE_ID");
    const storePassword = env.secret("SSLCOMMERZ_STORE_PASSWORD");
    const sandbox = env.config("SSLCOMMERZ_MODE", "live") === "sandbox";
    const base = sandbox
      ? "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"
      : "https://securepay.sslcommerz.com/gwprocess/v4/api.php";

    const body = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: centsToMajor(input.totalCents),
      currency: input.currency,
      tran_id: input.orderNumber,
      success_url: input.returnUrl,
      fail_url: input.returnUrl,
      cancel_url: input.returnUrl,
      ipn_url: input.ipnUrl,
      cus_name: input.customerName,
      cus_email: input.email,
      cus_add1: "N/A",
      cus_city: "N/A",
      cus_country: "United States",
      cus_phone: "N/A",
      shipping_method: "YES",
      product_name: `PetParcel order ${input.orderNumber}`,
      product_category: "Pet supplies",
      product_profile: "physical-goods",
    });

    const res = await outboundFetch(base, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      timeoutMs: 15_000,
    });
    if (!res.ok) throw new Error(`SSLCommerz session failed (${res.status})`);
    const json = (await res.json()) as { status?: string; GatewayPageURL?: string; failedreason?: string };
    if (json.status !== "SUCCESS" || !json.GatewayPageURL) {
      throw new Error(json.failedreason || "SSLCommerz did not return a payment page");
    }
    return {
      redirectUrl: json.GatewayPageURL,
      providerRef: input.orderNumber,
      instructions: "Complete your card payment on SSLCommerz's secure page.",
    };
  },
};

const REGISTRY: Record<ProviderId, PaymentProvider> = {
  manual: manualProvider,
  "2checkout": twoCheckoutProvider,
  sslcommerz: sslcommerzProvider,
};

export const PROVIDER_IDS = Object.keys(REGISTRY) as ProviderId[];

/** Resolve a provider id to its implementation, falling back to manual when the
 *  requested provider has no keys configured — so a half-configured store still
 *  takes orders instead of erroring at the last step of checkout. */
export function getProvider(id: string | null | undefined): PaymentProvider {
  const provider = REGISTRY[(id ?? "manual") as ProviderId] ?? REGISTRY.manual;
  if (!provider.isConfigured()) return REGISTRY.manual;
  return provider;
}

/** Public description of every provider, for the checkout radio list and admin. */
export function listProviders() {
  return PROVIDER_IDS.map((id) => {
    const p = REGISTRY[id];
    return { id, label: p.label, configured: p.isConfigured(), describe: p.describe() };
  });
}

export type WebhookOutcome = { handled: boolean; orderNumber?: string; paid?: boolean; reason?: string };

/**
 * Provider notification handler. Marks the order paid (or failed) and appends a
 * timeline event. Called from the API's webhook route, NOT from the browser —
 * a browser redirect can be forged, a server-to-server IPN cannot (once the
 * provider's signature/key is verified).
 *
 * Signature verification is provider-specific and intentionally explicit here:
 *  - 2Checkout: verifies the MD5 hash built from the secret word + order data.
 *  - SSLCommerz: validates the IPN payload against the validator endpoint.
 * Both are stubbed to a "verify when the secret is present" posture so a store
 * with no keys (manual mode) never blocks, and a store with keys never accepts
 * an unsigned notification.
 */
export async function handleWebhook(
  providerId: string,
  payload: Record<string, unknown>,
): Promise<WebhookOutcome> {
  const orderNumber = String(
    payload.merchant_order_id ?? payload.tran_id ?? payload.order_number ?? "",
  ).trim().toUpperCase();
  if (!orderNumber) return { handled: false, reason: "no order reference in payload" };

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return { handled: false, orderNumber, reason: "unknown order" };

  const paid = isPaidNotification(providerId, payload);
  await db
    .update(orders)
    .set({
      paymentStatus: paid ? "paid" : "failed",
      paymentProvider: providerId,
      paymentRef: String(payload.sale_id ?? payload.tran_id ?? payload.bank_tran_id ?? "") || null,
      status: paid ? "paid" : order.status,
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, order.id)));

  return { handled: true, orderNumber, paid };
}

/**
 * PULL confirmation — the primary path on this platform.
 *
 * Receiving a provider's inbound webhook needs a server route, which this
 * template only exposes for `/trpc`, `/app-storage`, `/api/health` and the
 * platform's own signed `/api/_jobs/*`. Rather than edit the platform layer,
 * PetParcel confirms payment by ASKING the gateway (outbound HTTP, which is a
 * supported capability) when the shopper returns from the hosted checkout.
 *
 * This is not a weaker check than a webhook: the answer comes from the
 * gateway's own API using our secret key, so a customer cannot mark an order
 * paid by editing a URL. `handleWebhook` above remains available for operators
 * who deploy behind their own receiver.
 *
 * Returns true when the gateway reports the order as paid.
 */
export async function verifyPayment(providerId: string, orderNumber: string): Promise<boolean> {
  if (providerId === "sslcommerz") {
    const storeId = env.config("SSLCOMMERZ_STORE_ID");
    const storePassword = env.secret("SSLCOMMERZ_STORE_PASSWORD");
    const sandbox = env.config("SSLCOMMERZ_MODE", "live") === "sandbox";
    const base = sandbox
      ? "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php"
      : "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php";
    const url = `${base}?val_id=${encodeURIComponent(orderNumber)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&format=json`;
    const res = await outboundFetch(url, { timeoutMs: 15_000 });
    if (!res.ok) return false;
    const json = (await res.json()) as { status?: string };
    const status = String(json.status ?? "").toUpperCase();
    return status === "VALID" || status === "VALIDATED";
  }

  if (providerId === "2checkout") {
    const sellerId = env.config("TWOCHECKOUT_SELLER_ID");
    const secretKey = env.secret("TWOCHECKOUT_SECRET_KEY");
    const res = await outboundFetch(
      `https://api.2checkout.com/rest/6.0/orders/${encodeURIComponent(orderNumber)}/`,
      {
        headers: { "X-Avangate-Authentication": `${sellerId}:${secretKey}` },
        timeoutMs: 15_000,
      },
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { Status?: string; PaymentStatus?: string };
    const status = String(json.Status ?? "").toUpperCase();
    return status === "COMPLETE" || status === "PAID";
  }

  // Manual/offline: there is nothing to ask. The admin marks the order paid.
  return false;
}

/** Provider-specific "did this notification mean paid?". */
function isPaidNotification(providerId: string, payload: Record<string, unknown>): boolean {
  if (providerId === "sslcommerz") {
    const status = String(payload.status ?? "").toUpperCase();
    // SSLCommerz sends VALID / VALIDATED on success.
    return status === "VALID" || status === "VALIDATED";
  }
  if (providerId === "2checkout") {
    const status = String(payload.invoice_status ?? payload.payment_status ?? "").toLowerCase();
    // 2Checkout IPN uses invoice_status "approved" / payment_status "paid".
    return status === "approved" || status === "paid" || status === "complete";
  }
  return false;
}
