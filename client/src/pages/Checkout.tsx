// Checkout - contact, shipping address, payment method, review, place order.
// Works for guests and signed-in customers; signed-in shoppers can save the
// address to their account in the same step.
//
// ── Diagnosis: the horizontal-overflow mechanism ─────────────────────────────
// Two layout defaults, neither visible in the JSX, pushed the page wider than
// the viewport:
//
//  1. `min-width: auto` on a flex item. The Order Summary line items are a flex
//     row whose middle cell holds the product name; without `min-w-0` that cell
//     refused to shrink below the name's min-content width, so a long title
//     widened the row - and with it the whole summary card.
//  2. A bare `fr` grid track. `lg:grid-cols-[1.6fr_1fr]` gives each track an
//     `auto` minimum, so the summary column floored at its widest child's
//     max-content and escaped the right edge on medium screens. `minmax(0, …)`
//     is what allows the track to shrink.
//
// `truncate` was the wrong tool for the same reason as on the cart: it cannot
// break a long unbroken token, so the name must WRAP instead -
// `line-clamp-2 break-words [overflow-wrap:anywhere]`. A global `overflow-x: clip`
// on html/body hid the symptom by clipping the page rather than scrolling it.
//
// Guards now in place: `min-w-0` on the summary row and its text cell, the
// clamp+wrap classes on the product name, `overflow-hidden` on the row, and
// `shrink-0` + `whitespace-nowrap` on the thumbnail and the price.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { CreditCard, Lock, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useCart, useSeo } from "@/lib/petparcel";
import {
  trackAddShippingInfo,
  trackBeginCheckout,
  useConsentState,
} from "@/lib/analytics";
import {
  lastOrderPath,
  readLastOrder,
  rememberLastOrder,
  type LastOrder,
} from "@/lib/last-order";
import { US_STATES, formatMoney } from "@shared/store";
import { useSite } from "@/components/site/Layout";
import {
  Breadcrumbs,
  CtaLink,
  EmptyState,
  LoadingState,
  Section,
  SectionHeading,
} from "@/components/site/Bits";
import { cn } from "@/lib/utils";

interface AddressForm {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
}

const emptyAddress: AddressForm = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  phone: "",
};

const field =
  "mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const labelCls = "block text-sm font-semibold";

function AddressFields({
  value,
  onChange,
  idPrefix,
}: {
  value: AddressForm;
  onChange: (next: AddressForm) => void;
  idPrefix: string;
}) {
  const set = (k: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...value, [k]: e.target.value });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor={`${idPrefix}-name`}>
          Full name
        </label>
        <input id={`${idPrefix}-name`} className={field} value={value.fullName} onChange={set("fullName")} autoComplete="name" required />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor={`${idPrefix}-line1`}>
          Street address
        </label>
        <input id={`${idPrefix}-line1`} className={field} value={value.line1} onChange={set("line1")} autoComplete="address-line1" required />
      </div>
      <div className="sm:col-span-2">
        <label className={labelCls} htmlFor={`${idPrefix}-line2`}>
          Apartment, suite, etc. <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input id={`${idPrefix}-line2`} className={field} value={value.line2} onChange={set("line2")} autoComplete="address-line2" />
      </div>
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-city`}>
          City
        </label>
        <input id={`${idPrefix}-city`} className={field} value={value.city} onChange={set("city")} autoComplete="address-level2" required />
      </div>
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-state`}>
          State
        </label>
        <select id={`${idPrefix}-state`} className={field} value={value.state} onChange={set("state")} autoComplete="address-level1" required>
          <option value="">Select a state…</option>
          {US_STATES.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-zip`}>
          ZIP code
        </label>
        <input
          id={`${idPrefix}-zip`}
          className={field}
          value={value.postalCode}
          onChange={set("postalCode")}
          autoComplete="postal-code"
          inputMode="numeric"
          pattern="[0-9]{5}(-[0-9]{4})?"
          placeholder="97205"
          required
        />
      </div>
      <div>
        <label className={labelCls} htmlFor={`${idPrefix}-phone`}>
          Phone <span className="font-normal text-muted-foreground">(for delivery)</span>
        </label>
        <input id={`${idPrefix}-phone`} className={field} value={value.phone} onChange={set("phone")} autoComplete="tel" placeholder="+1 555 000 0000" />
      </div>
    </div>
  );
}

export default function Checkout() {
  const s = useSite();
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { lines, subtotalCents, clear, cartLoading } = useCart();

  const { data: providers } = trpc.settings.providers.useQuery();
  const { data: defaultAddress } = trpc.account.defaultAddress.useQuery(undefined, {
    enabled: Boolean(user),
  });

  const [email, setEmail] = useState("");
  const [shipping, setShipping] = useState<AddressForm>(emptyAddress);
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<AddressForm>(emptyAddress);
  const [saveAddress, setSaveAddress] = useState(true);
  const [paymentProvider, setPaymentProvider] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  // ── Returning from the payment provider ────────────────────────────────────
  // The cart is cleared the moment an order is placed (its items belong to the
  // ORDER now), so a shopper who comes back - back button, the provider's
  // "return to store" link, or a reopened tab - lands here with an EMPTY cart.
  // That is correct; treating it as "no order" was the bug. If we remember the
  // order they just placed, send them to its real status page instead of the
  // empty-cart message. See lib/last-order.ts for why this is stored locally.
  const [recentOrder, setRecentOrder] = useState<LastOrder | null>(null);
  useEffect(() => {
    setRecentOrder(readLastOrder());
  }, []);

  useSeo({
    title: "Checkout",
    description: "Complete your PetParcel order - fast, tracked US shipping and 30-day returns.",
    path: "/checkout",
    noindex: true,
  });

  // Seed the form from the account where we can, so returning customers type less.
  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!defaultAddress) return;
    setShipping((prev) => ({
      ...prev,
      fullName: prev.fullName || defaultAddress.fullName,
      line1: prev.line1 || defaultAddress.line1,
      line2: prev.line2 || defaultAddress.line2 || "",
      city: prev.city || defaultAddress.city,
      state: prev.state || defaultAddress.state,
      postalCode: prev.postalCode || defaultAddress.postalCode,
      phone: prev.phone || defaultAddress.phone || "",
    }));
  }, [defaultAddress]);

  // Pre-select the store's configured provider (falling back to the first one
  // that actually has keys, then to whatever is listed first).
  useEffect(() => {
    if (paymentProvider || !providers?.length) return;
    const preferred =
      providers.find((p) => p.id === s.payment_provider && p.configured) ??
      providers.find((p) => p.configured) ??
      providers[0];
    setPaymentProvider(preferred.id);
  }, [providers, s.payment_provider, paymentProvider]);

  const shippingCents =
    s.free_shipping_threshold_cents > 0 && subtotalCents >= s.free_shipping_threshold_cents
      ? 0
      : s.shipping_flat_cents;
  const taxCents = Math.round((subtotalCents * s.tax_rate_bps) / 10000);
  const totalCents = subtotalCents + shippingCents + taxCents;

  // Free-shipping progress, mirroring the cart page so the two never disagree.
  const hasFreeTier = s.free_shipping_threshold_cents > 0;
  const freeShip = hasFreeTier && subtotalCents >= s.free_shipping_threshold_cents;
  const toFreeShip = hasFreeTier ? Math.max(0, s.free_shipping_threshold_cents - subtotalCents) : 0;
  const freeProgress = hasFreeTier
    ? Math.min(100, Math.round((subtotalCents / s.free_shipping_threshold_cents) * 100))
    : 0;

  const selectedProvider = useMemo(
    () => providers?.find((p) => p.id === paymentProvider),
    [providers, paymentProvider],
  );

  // ── GA4 mid-funnel events ───────────────────────────────────────────────
  // `begin_checkout` and `add_shipping_info` complete the funnel between
  // `add_to_cart` and `purchase`. Both are gated on consent INSIDE the helper and
  // deduped there by a fingerprint of the basket, so re-renders, a refresh and
  // React Query re-delivering the same basket cannot inflate them - while a
  // basket the shopper actually changed records the new step.
  //
  // The consent state is a dependency on purpose: a visitor who has not chosen
  // yet fires nothing, and the moment they accept the banner these effects re-run
  // and the steps that were skipped are sent, without a reload.
  const consent = useConsentState();

  useEffect(() => {
    if (cartLoading || lines.length === 0) return;
    trackBeginCheckout(lines);
  }, [cartLoading, lines, consent]);

  // "Shipping info entered": the five fields checkout actually requires. Firing off
  // a completed block (rather than per keystroke) is what keeps this to one event
  // per basket per tier.
  const shippingComplete =
    Boolean(shipping.fullName && shipping.line1 && shipping.city && shipping.state && shipping.postalCode);
  const shippingTier = shippingCents === 0 ? "Free shipping" : "Standard shipping";

  useEffect(() => {
    if (cartLoading || lines.length === 0 || !shippingComplete) return;
    trackAddShippingInfo(lines, shippingTier);
  }, [cartLoading, lines, shippingComplete, shippingTier, consent]);

  const placeOrder = trpc.checkout.place.useMutation({
    onSuccess: (result) => {
      // Remember WHICH order was just placed, BEFORE handing the browser to the
      // payment provider. The cart is cleared on the next line (its items now
      // belong to the order), so without this pointer a shopper returning to
      // /checkout would find an empty cart and no way back to their order.
      //
      // NOTE: no "email sent" flag is cached here any more. The confirmation
      // email is only sent once the payment is confirmed, which can be minutes
      // after this redirect - so the order page reads the real, persisted send
      // record from the server instead of a client-side guess.
      rememberLastOrder(result.orderNumber, email);
      clear();
      // A hosted gateway gets an absolute URL; an unconnected store gets our own path.
      if (/^https?:\/\//i.test(result.redirectUrl)) {
        window.location.href = result.redirectUrl;
      } else {
        navigate(result.redirectUrl);
      }
    },
    onError: (err) => setServerError(err.message),
  });

  // Take the returning shopper to their order's real status page. This runs
  // only when the cart is empty (nothing to check out) and we know which order
  // they just placed, so it can never interrupt a live checkout. `replace`
  // keeps /checkout out of the history, so the back button does not bounce
  // between the two pages.
  useEffect(() => {
    if (cartLoading || placeOrder.isPending) return;
    if (lines.length > 0) return;
    if (!recentOrder) return;
    navigate(lastOrderPath(recentOrder.orderNumber), { replace: true });
  }, [cartLoading, placeOrder.isPending, lines.length, recentOrder, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (lines.length === 0) return;

    const toPayload = (a: AddressForm) => ({
      fullName: a.fullName,
      line1: a.line1,
      line2: a.line2 || null,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: "US",
      phone: a.phone || null,
    });

    placeOrder.mutate({
      email,
      items: lines.map((l) => ({ slug: l.slug, variantId: l.variantId, qty: l.qty })),
      shippingAddress: toPayload(shipping),
      billingAddress: billingSame ? undefined : toPayload(billing),
      paymentProvider: paymentProvider || "bachs",
      notes: notes || undefined,
      saveAddress: Boolean(user) && saveAddress,
    });
  };

  // An order requires an account; checkout.place is a protectedProcedure, so the
  // server refuses an anonymous order outright. Prompting here means the shopper
  // learns that before typing an address, not after the final click - and the
  // cart is preserved, so signing in picks up exactly where they left off.
  if (authLoading) {
    return (
      <Section className="!pt-8">
        <LoadingState rows={4} />
      </Section>
    );
  }

  if (!user) {
    return (
      <Section className="!pt-8">
        <Breadcrumbs
          trail={[{ label: "Home", to: "/" }, { label: "Cart", to: "/cart" }, { label: "Checkout" }]}
        />
        <EmptyState
          title="Sign in to check out"
          body="Every order, its tracking and the address you used live in your account, so checkout needs a quick sign-in or a new account. Your cart is kept exactly as it is."
          action={<CtaLink to="/login">Sign in or create an account</CtaLink>}
        />
      </Section>
    );
  }

  if (cartLoading) {
    return (
      <Section className="!pt-8">
        <LoadingState rows={4} />
      </Section>
    );
  }

  if (lines.length === 0 && !placeOrder.isPending) {
    // A remembered order means the shopper is RETURNING from payment, not
    // browsing an empty cart. Show a recovery state (the effect below takes them
    // to the order page) rather than "there's nothing to check out".
    if (recentOrder) {
      return (
        <Section className="!pt-8">
          <Breadcrumbs
            trail={[
              { label: "Home", to: "/" },
              { label: "Order", to: lastOrderPath(recentOrder.orderNumber) },
            ]}
          />
          <EmptyState
            icon={<PackageSearch className="h-6 w-6" />}
            title="Taking you back to your order"
            body={`Your cart is empty because your items are already in order ${recentOrder.orderNumber}. Opening its payment status now.`}
            action={
              <CtaLink to={lastOrderPath(recentOrder.orderNumber)}>
                View order {recentOrder.orderNumber}
              </CtaLink>
            }
          />
        </Section>
      );
    }
    return (
      <Section className="!pt-8">
        <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Cart", to: "/cart" }, { label: "Checkout" }]} />
        <EmptyState
          title="There's nothing to check out"
          body="Your cart is empty, so there's no order to place yet. Add a few items and come back."
          action={<CtaLink to="/shop">Browse products</CtaLink>}
        />
      </Section>
    );
  }

  return (
    <Section className="!pt-8">
      <Breadcrumbs
        trail={[
          { label: "Home", to: "/" },
          { label: "Cart", to: "/cart" },
          { label: "Checkout" },
        ]}
      />
      <SectionHeading
        eyebrow="Checkout"
        title="Complete your order"
        subtitle="Fast, tracked shipping and a 30-day return window on everything."
      />

      <form onSubmit={submit} className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          {serverError && (
            <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">
              {serverError}
            </div>
          )}

          {/* Contact */}
          <div className="card-soft p-5 sm:p-6">
            <h2 className="text-lg font-medium">Contact</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              We'll send order updates here, and you'll need it to track the order.
            </p>
            <div className="mt-4">
              <label className={labelCls} htmlFor="checkout-email">
                Email address
              </label>
              <input
                id="checkout-email"
                type="email"
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {!user && (
              <p className="mt-3 text-xs text-muted-foreground">
                Have an account?{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to save this address and keep your order history in one place.
              </p>
            )}
          </div>

          {/* Shipping */}
          <div className="card-soft p-5 sm:p-6">
            <h2 className="text-lg font-medium">Shipping address</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              We currently ship to US addresses only.
            </p>
            <div className="mt-4">
              <AddressFields value={shipping} onChange={setShipping} idPrefix="ship" />
            </div>
            {user && (
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Save this address to my account
              </label>
            )}
          </div>

          {/* Billing */}
          <div className="card-soft p-5 sm:p-6">
            <h2 className="text-lg font-medium">Billing address</h2>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billingSame}
                onChange={(e) => setBillingSame(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Same as my shipping address
            </label>
            {!billingSame && (
              <div className="mt-4">
                <AddressFields value={billing} onChange={setBilling} idPrefix="bill" />
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="card-soft p-5 sm:p-6">
            <h2 className="text-lg font-medium">Payment method</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              You'll pay on Bachs' own secure checkout - PetParcel never sees your card number.
            </p>
            <div className="mt-4 space-y-3">
              {(providers ?? []).map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-sm border p-4 transition",
                    paymentProvider === p.id ? "border-primary bg-secondary/60" : "border-border hover:border-primary/50",
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={p.id}
                    checked={paymentProvider === p.id}
                    onChange={() => setPaymentProvider(p.id)}
                    className="mt-1 h-4 w-4"
                  />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-bold">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {p.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {p.describe}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4">
              <label className={labelCls} htmlFor="checkout-notes">
                Order notes <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="checkout-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Delivery instructions, gift note…"
                className="mt-1.5 w-full rounded-sm border border-input bg-card p-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        {/* ── Summary ────────────────────────────────────────────────── */}
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="card-soft space-y-4 p-5 sm:p-6">
            <h2 className="text-lg font-medium">Order summary</h2>

            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={`${l.slug}-${l.variantId ?? "base"}`} className="flex min-w-0 gap-3 overflow-hidden">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-muted">
                    {l.image ? (
                      <img src={l.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">🐾</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-2 break-words text-sm font-semibold [overflow-wrap:anywhere]">{l.name}</span>
                    {l.variantName && (
                      <span className="block text-xs text-muted-foreground">{l.variantName}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">Qty {l.qty}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm font-bold">{formatMoney(l.priceCents * l.qty)}</span>
                </li>
              ))}
            </ul>

            {hasFreeTier && (
              <div
                className={cn(
                  "rounded-sm border border-border p-3 text-xs",
                  freeShip && "border-emerald-200 bg-emerald-50/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <Truck
                    className={cn("h-4 w-4 shrink-0", freeShip ? "text-emerald-600" : "text-primary")}
                    aria-hidden="true"
                  />
                  {freeShip ? (
                    <p>
                      <strong>Free shipping unlocked.</strong> Tracked delivery is on us.
                    </p>
                  ) : (
                    <p>
                      Add <strong>{formatMoney(toFreeShip)}</strong> more to unlock{" "}
                      <strong>free shipping</strong>.
                    </p>
                  )}
                </div>
                {!freeShip && (
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={freeProgress}
                    aria-label="Progress to free shipping"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${freeProgress}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <dl className="space-y-2.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-semibold">{formatMoney(subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-semibold">
                  {shippingCents === 0 ? <span className="text-emerald-700">Free</span> : formatMoney(shippingCents)}
                </dd>
              </div>
              {taxCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd className="font-semibold">{formatMoney(taxCents)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-3 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-extrabold">{formatMoney(totalCents)}</dd>
              </div>
            </dl>

            <button
              type="submit"
              disabled={placeOrder.isPending}
              className="btn btn-primary btn-lg w-full"
            >
              <Lock className="h-4 w-4" />
              {placeOrder.isPending ? "Placing order…" : `Place order · ${formatMoney(totalCents)}`}
            </button>

            {selectedProvider && (
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {`You'll continue to ${selectedProvider.label} to pay securely.`}
              </p>
            )}

            <ul className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Card payments secured by Bachs
              </li>
              <li className="flex items-center gap-2">
                <Truck className="h-3.5 w-3.5 text-primary" /> Fast, tracked shipping
              </li>
            </ul>
          </div>
        </aside>
      </form>
    </Section>
  );
}
