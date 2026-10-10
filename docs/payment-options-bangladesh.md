# Accepting US Card Payments as a Bangladesh-Based Merchant

**Context.** PetParcel is operated from Bangladesh and sells physical pet products to
customers in the USA who pay by **Visa / Mastercard / Amex**. The merchant has **no Stripe
and no PayPal** account. This document compares the realistic options, recommends one, and
gives setup steps. The store's checkout is already wired to a pluggable abstraction, so
switching provider is a config change plus credentials.

> ⚠️ **Verify current terms before you commit.** Provider availability, pricing tiers and
> country eligibility change frequently, and several are gated by an application review.
> Treat the figures below as *typical, researched ranges* and confirm them on the provider's
> own site for your entity type.

---

## 1. Why the two obvious choices are out

| Option | Why it does not work here |
|---|---|
| **Stripe** | Stripe does not support payouts to / accounts registered in Bangladesh. |
| **PayPal** | Business accounts with withdrawals are not available for Bangladesh. |
| **Razorpay** | India-only merchant onboarding. |
| **bKash** | Bangladeshi mobile wallet — great for *domestic* customers, irrelevant for US card payments. |

---

## 2. The realistic shortlist

| Provider | BD merchant? | Physical goods? | US cards? | Typical cost | Verdict |
|---|---|---|---|---|---|
| **2Checkout (Verifone)** | ✅ Yes | ✅ Yes | ✅ Visa/MC/Amex | ~3.5% + $0.35 per txn, no monthly fee on standard plans | **Recommended primary** |
| **SSLCommerz** | ✅ Yes (local entity) | ✅ Yes | ✅ international cards in USD | ~2.5–3.5% | **Recommended fallback / local** |
| **Paddle** | ⚠️ | ❌ Digital/SaaS only | ✅ | 5% + $0.50 | ❌ Physical goods prohibited |
| **Lemon Squeezy** | ⚠️ | ❌ Digital only | ✅ | 5% + $0.50 | ❌ Physical goods prohibited |
| **Gumroad** | ⚠️ | ⚠️ Limited physical support | ✅ | ~10% | ❌ Poor fit for a real storefront |
| **Payoneer** | ✅ | n/a | n/a | varies | Receiving/payouts only — **not** a card gateway |
| **Wise** | ✅ | n/a | n/a | varies | Transfers/multi-currency — **not** a card gateway |
| **Airwallex** | ⚠️ Limited | ✅ | ✅ | custom | Worth checking; BD availability is restricted |
| **Stripe Atlas / US entity** | ✅ via US LLC | ✅ | ✅ | higher setup cost | A longer-term route if volume justifies it |

**Two important distinctions the research turned up**

- **Merchant-of-Record (MoR) vs. payment gateway.** Paddle and Lemon Squeezy are MoRs —
  they buy your product and resell it, which is why they can serve merchants Stripe cannot.
  But both **prohibit physical goods**, which rules them out for a pet-supplies store.
- **Money-transfer services are not gateways.** Payoneer and Wise are excellent for
  *receiving* funds, but neither offers a hosted card-checkout you can embed in a store.

---

## 3. Recommendation

**Primary: 2Checkout (Verifone)** — supports Bangladesh-based merchants, explicitly permits
physical goods, accepts US Visa/Mastercard/Amex, requires no monthly fee on standard plans,
and gives you a hosted checkout you simply redirect to. That matches exactly what this app
implements.

**Fallback / local: SSLCommerz** — a Bangladeshi gateway that settles internationally and
handles local payment methods too. Useful if 2Checkout's underwriting declines your
application, or if you later want to sell domestically.

**Meanwhile: `manual` mode** — the store ships with this active. Orders are recorded as
*unpaid* and you invoice by bank transfer. Nothing blocks you from launching and taking
orders before a gateway is approved.

---

## 4. Setup — 2Checkout (Verifone)

1. Apply for a **2Checkout / Verifone** account as a Bangladesh-registered business.
   Have ready: business registration, owner ID, a bank account for settlement, and your
   store URL.
2. Complete underwriting. Once approved, note your **Seller ID** (also called Merchant Code).
3. In your 2Checkout dashboard, go to *Integrations → API* and generate a **Secret Key**.
   Note the **Buy Link** / hosted checkout URL format — the app builds it for you.
4. Set the environment variables:
   ```
   TWOCHECKOUT_SELLER_ID=your_seller_id
   TWOCHECKOUT_SECRET_KEY=your_secret_key
   TWOCHECKOUT_MODE=test        # switch to "live" once test orders pass
   ```
5. In the admin panel → **Settings → Payments**, set `payment_provider` to `2checkout`.
6. Place a **test order** end-to-end. On the hosted page pay with a 2Checkout test card,
   then confirm the order flips to *paid* (the server pulls the status from the API after
   the buyer returns).
7. Switch `TWOCHECKOUT_MODE=live` and re-verify with a small real order.

---

## 5. Setup — SSLCommerz

1. Open an **SSLCommerz** merchant account (requires a Bangladeshi business entity and bank).
2. From the merchant panel, copy the **Store ID** and **Store Password** (sandbox credentials
   are available immediately for testing).
3. Set:
   ```
   SSLCOMMERZ_STORE_ID=your_store_id
   SSLCOMMERZ_STORE_PASSWORD=your_store_password
   SSLCOMMERZ_MODE=sandbox       # switch to "live" for production
   ```
4. In admin → **Settings → Payments**, set `payment_provider` to `sslcommerz`.
5. Run a sandbox transaction and confirm the order marks paid.

---

## 6. How the integration is built

`server/services/payments.ts` exposes one small interface. Adding a provider means
implementing it and registering it — no changes to checkout, orders or the admin panel.

```ts
interface PaymentProvider {
  id: string;                     // "2checkout" | "sslcommerz" | "manual"
  label: string;
  isConfigured(): boolean;        // are the env credentials present?
  start(input): Promise<{ redirectUrl: string; instructions?: string }>;
  verifyPayment(orderNumber): Promise<boolean>;  // pulled server-side
}
```

Flow in this app:

1. Checkout creates the order **unpaid** and records the chosen provider.
2. For a hosted provider, the buyer is redirected to the gateway's secure page with the
   order number as the merchant reference.
3. On return, the server **pulls** the order status from the provider and marks the order
   *paid* (and logs it to the order's activity timeline).
4. For `manual`, no call is made — you settle offline and mark it paid in the admin panel.

Because confirmation is a server-side pull, no public webhook endpoint is required. If you
later add one, keep `verifyPayment` as the authority — never trust a redirect alone.

---

## 7. Practical tips

- **Test mode first.** Both gateways have sandbox credentials; use them before going live.
- **Watch FX and settlement.** You will be paid in USD and settle to a BDT account — compare
  both the processing fee and the FX spread, not just the headline percentage.
- **Keep a manual path.** If a payment fails or a card is declined, `manual` mode means you
  can still close the sale instead of losing the order.
- **Re-check fees annually.** Card processing pricing and Bangladesh eligibility both move.
