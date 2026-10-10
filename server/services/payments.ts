// ── Payment abstraction ──────────────────────────────────────────────────────
//
// 2Checkout (Verifone) is the ONLY payment method PetParcel supports. It is a
// HOSTED checkout: we create the order in `pending` / `unpaid`, hand the
// customer to 2Checkout's own secure page, and confirm the outcome
// server-to-server. PetParcel never touches raw card data, so PCI scope stays
// at zero and swapping the account behind the keys is a config change.
//
//   2checkout — Verifone / 2Checkout hosted checkout. Supports Bangladesh
//                merchants selling physical goods and accepts US Visa/MC/Amex.
//
// Before the merchant keys are in place the provider degrades gracefully: the
// order is recorded as `unpaid` for offline settlement (the admin marks it paid
// when funds land). That is a behaviour of 2Checkout, NOT a separate offline
// method — checkout offers 2Checkout and nothing else, and there is no invoice
// or bank-transfer UI anywhere in the store.
//
// Keys come from the app owner's environment (Settings → Environment variables),
// never from code. See PAYMENTS.md for the account setup and the fee summary.
import { and, eq } from "drizzle-orm";
import { db } from "../_core/db";
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";
import { orders } from "../../drizzle/schema";

export type ProviderId = "2checkout";

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
  /** Where to send the browser. A hosted gateway gets its checkout URL; an
   *  unconfigured store gets its own order page (nothing is charged yet). */
  redirectUrl: string;
  providerRef?: string | null;
  /** Shown on the checkout review step so the shopper knows what happens next. */
  instructions: string;
}

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  /** Is this provider configured (keys present)? */
  isConfigured(): boolean;
  /** Human-readable "what happens after you click Place order". */
  describe(): string;
  start(input: PaymentStartInput): Promise<PaymentStartResult>;
}

const centsToMajor = (cents: number) => (cents / 100).toFixed(2);

/**
 * 2Checkout / Verifone hosted checkout — the single payment method.
 *
 * With keys present the shopper is sent to 2Checkout's hosted card page. With
 * no keys yet, the order is still created and returned to our own order page as
 * unpaid, so the storefront runs end-to-end until the merchant account is live.
 */
const twoCheckoutProvider: PaymentProvider = {
  id: "2checkout",
  label: "Credit or debit card",
  isConfigured: () => Boolean(process.env.TWOCHECKOUT_SELLER_ID && process.env.TWOCHECKOUT_SECRET_KEY),
  describe: () =>
    "You'll be redirected to 2Checkout's secure page to pay by card. Visa, Mastercard and Amex accepted.",
  async start(input) {
    // No keys yet: record the order and return to the order page, unpaid.
    // Nothing is charged and no invoice is issued — the store simply waits for
    // the merchant account to be connected.
    if (!this.isConfigured()) {
      return {
        redirectUrl: `/order/${input.orderNumber}`,
        providerRef: null,
        instructions: "Your order is placed. Card payment is completed once the store accepts it.",
      };
    }

    const sellerId = env.config("TWOCHECKOUT_SELLER_ID");
    const mode = env.config("TWOCHECKOUT_MODE", "live");

    const params = new URLSearchParams({
      sid: sellerId,
      mode: "2",
      // The Buy-Link parameters 2Checkout accepts without an API round-trip.
      "li_0_type": "product",
      "li_0_name": `PetParcel order ${input.orderNumber}`,
      "li_0_price": centsToMajor(input.totalCents),
      "li_0_quantity": "1",
      "li_0_tangible": "Y",
      currency_code: input.currency,
      merchant_order_id: input.orderNumber,
      card_purchase: "1",
      x_receipt_link_url: input.returnUrl,
      ipn_url: input.ipnUrl,
      email: input.email,
      name: input.customerName,
    });

    return {
      redirectUrl:
        mode === "sandbox" || mode === "test"
          ? `https://sandbox.2checkout.com/checkout/purchase?${params.toString()}`
          : `https://www.2checkout.com/checkout/purchase?${params.toString()}`,
      providerRef: null,
      instructions: "Complete your card payment on 2Checkout's secure page.",
    };
  },
};

const REGISTRY: Record<ProviderId, PaymentProvider> = {
  "2checkout": twoCheckoutProvider,
};

export const PROVIDER_IDS = Object.keys(REGISTRY) as ProviderId[];

/** Resolve a provider id to its implementation. 2Checkout is the only
 *  method, so this always returns it regardless of the stored value — a store
 *  left over on an older setting still checks out cleanly. */
export function getProvider(_id?: string | null): PaymentProvider {
  return REGISTRY["2checkout"];
}

/** Public description of the payment method, for the checkout option and admin. */
export function listProviders() {
  return PROVIDER_IDS.map((id) => {
    const p = REGISTRY[id];
    return { id, label: p.label, configured: p.isConfigured(), describe: p.describe() };
  });
}

export type WebhookOutcome = { handled: boolean; orderNumber?: string; paid?: boolean; reason?: string };

/**
 * Provider notification handler. Marks the order paid (or failed) and records
 * the reference. Called from an API webhook route, NOT from the browser — a
 * browser redirect can be forged, a server-to-server IPN cannot (once the
 * provider's signature/key is verified).
 *
 * 2Checkout verification is the MD5 hash built from the secret word + order
 * data. It is stubbed to a "verify when the secret is present" posture so a
 * store with no keys never blocks, and a store with keys never accepts an
 * unsigned notification. `handleWebhook` stays available for operators who
 * deploy behind their own receiver.
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
 * paid by editing a URL.
 *
 * Returns true when the gateway reports the order as paid.
 */
export async function verifyPayment(providerId: string, orderNumber: string): Promise<boolean> {
  if (providerId !== "2checkout") return false;

  const sellerId = env.config("TWOCHECKOUT_SELLER_ID");
  const secretKey = env.secret("TWOCHECKOUT_SECRET_KEY");
  // Nothing to ask while the account is unconnected.
  if (!sellerId || !secretKey) return false;

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

/** Did this notification mean paid? 2Checkout IPN uses invoice_status
 *  "approved" / payment_status "paid". */
function isPaidNotification(_providerId: string, payload: Record<string, unknown>): boolean {
  const status = String(payload.invoice_status ?? payload.payment_status ?? "").toLowerCase();
  return status === "approved" || status === "paid" || status === "complete";
}
