// Checkout — contact, shipping address, payment method, review, place order.
// Works for guests and signed-in customers; signed-in shoppers can save the
// address to their account in the same step.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { CreditCard, Lock, ShieldCheck, Truck } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useCart, useSeo, currentOrigin } from "@/lib/petparcel";
import { US_STATES, formatMoney } from "@shared/store";
import { useSite } from "@/components/site/Layout";
import { Breadcrumbs, CtaLink, EmptyState, Section, SectionHeading } from "@/components/site/Bits";
import { cn } from "@/lib/utils";

const LAST_ORDER_KEY = "petparcel_last_order";

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
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { lines, subtotalCents, clear } = useCart();

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

  useSeo({
    title: "Secure Checkout",
    description: "Complete your PetParcel order — secure card checkout, free US shipping over $49.",
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

  const selectedProvider = useMemo(
    () => providers?.find((p) => p.id === paymentProvider),
    [providers, paymentProvider],
  );

  const placeOrder = trpc.checkout.place.useMutation({
    onSuccess: (result) => {
      // Remember the email locally so the confirmation page can show the order
      // to a guest without asking them to retype it.
      try {
        window.localStorage.setItem(
          LAST_ORDER_KEY,
          JSON.stringify({ orderNumber: result.orderNumber, email }),
        );
        // Carry the email outcome onto the confirmation page so it can tell the
        // customer whether a confirmation actually went — and, when it didn't,
        // that their order is still safe.
        window.localStorage.setItem(
          "petparcel_last_order_email",
          JSON.stringify({
            status: result.emailStatus,
            reason: result.emailReason,
            email,
          }),
        );
      } catch {
        /* storage unavailable — the confirmation page will ask for the email */
      }
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
      paymentProvider: paymentProvider || "2checkout",
      notes: notes || undefined,
      saveAddress: Boolean(user) && saveAddress,
      origin: currentOrigin(),
    });
  };

  if (lines.length === 0 && !placeOrder.isPending) {
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

      <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          {serverError && (
            <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">
              {serverError}
            </div>
          )}

          {/* Contact */}
          <div className="card-soft p-6">
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
          <div className="card-soft p-6">
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
          <div className="card-soft p-6">
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
          <div className="card-soft p-6">
            <h2 className="text-lg font-medium">Payment method</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Card details are entered on the gateway's own secure page — PetParcel never sees them.
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
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card-soft space-y-4 p-6">
            <h2 className="text-lg font-medium">Order summary</h2>

            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={`${l.slug}-${l.variantId ?? "base"}`} className="flex gap-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-sm bg-muted">
                    {l.image ? (
                      <img src={l.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">🐾</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{l.name}</span>
                    {l.variantName && (
                      <span className="block text-xs text-muted-foreground">{l.variantName}</span>
                    )}
                    <span className="block text-xs text-muted-foreground">Qty {l.qty}</span>
                  </span>
                  <span className="text-sm font-bold">{formatMoney(l.priceCents * l.qty)}</span>
                </li>
              ))}
            </ul>

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
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Card details handled by our payment provider
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

export { LAST_ORDER_KEY };
