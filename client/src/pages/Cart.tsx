// Cart - line items with quantity controls, remove, and a running total that
// shows exactly how the free-shipping threshold is applied.
//
// ── Diagnosis: the horizontal-overflow mechanism ─────────────────────────────
// The cart row overflowed on phones because of TWO compounding CSS defaults,
// neither of which is obvious from the JSX:
//
//  1. A flex item defaults to `min-width: auto`, so it refuses to shrink below
//     its content's MIN-CONTENT width. A long product title carried that
//     min-content width up the whole ancestor chain, forcing the row wider than
//     the viewport. Every flex ancestor of the title therefore needs `min-w-0`.
//  2. `truncate` (overflow:hidden + text-overflow:ellipsis + white-space:nowrap)
//     cannot ellipsize a long UNBROKEN token - nowrap only stops it wrapping, so
//     the text still laid out at full width and pushed the row wide. The fix is
//     `line-clamp-2 break-words [overflow-wrap:anywhere]`: it WRAPS (and
//     `anywhere` permits a break inside a long token), then clamps to 2 lines.
//
// The two-column grid needed `minmax(0, …)` tracks for the same reason: a bare
// `fr` track's minimum is `auto`, so the Order Summary column floored at the
// widest child's max-content and escaped the right edge. And a global
// `overflow-x: clip` on html/body MASKED all of it - the page was clipped, not
// scrollable, which is why it read as "broken / not responsive".
//
// Guards now in place on this page: `min-w-0` on every flex ancestor of the
// title, the clamp+wrap classes on the title itself, `overflow-hidden` on the
// row, and a wrapping (qty + price) sub-row with `shrink-0` controls.
import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowRight, CreditCard, Headphones, Lock, Minus, Plus, RefreshCw, ShoppingBag, Trash2, Truck } from "lucide-react";
import { useCart } from "@/lib/petparcel";
import { useSeo } from "@/lib/petparcel";
import { trackBeginCheckout, trackViewCart, useConsentState } from "@/lib/analytics";
import { formatMoney } from "@shared/store";
import { productImageSrcSet } from "@shared/product-media";
import { useSite } from "@/components/site/Layout";
import { cn } from "@/lib/utils";
import { Breadcrumbs, CtaLink, EmptyState, LoadingState, Section, SectionHeading } from "@/components/site/Bits";

export default function Cart() {
  const s = useSite();
  const { lines, subtotalCents, setQty, remove, count, signedIn, cartLoading } = useCart();

  useSeo({
    title: "Your Cart",
    description: "Review your PetParcel cart and check out. Fast, tracked US shipping and 30-day returns.",
    path: "/cart",
    noindex: true,
  });

  // ── GA4 `view_cart` + `begin_checkout` on the CART page ───────────────────
  // The checkout flow already fires `begin_checkout` (see Checkout.tsx), but a
  // shopper who fills a cart and abandons it BEFORE reaching checkout was
  // invisible in analytics - the funnel only started once they were already on
  // the checkout page. Firing the same event here, with the same `items` array,
  // makes those abandoned carts visible.
  //
  // `view_cart` is fired alongside it: it records that the basket was VIEWED at
  // all, which is the step before `begin_checkout` and the one that separates
  // "never opened the cart" from "opened it and left".
  //
  // Both reuse the SAME helper style the checkout flow uses, so the payload
  // shape, consent gating and dedupe are identical - no second schema to drift.
  // Each helper dedupes on a fingerprint of the basket, so a re-render, a
  // refresh or React Query re-delivering the same basket cannot inflate the
  // step, while a basket the shopper actually changed records the new one. The
  // consent state is a dependency on purpose: a visitor who has not chosen yet
  // fires nothing, and the moment they accept the banner this effect re-runs and
  // the events are sent, without a reload.
  const consent = useConsentState();
  useEffect(() => {
    if (cartLoading || lines.length === 0) return;
    trackViewCart(lines);
    trackBeginCheckout(lines);
  }, [cartLoading, lines, consent]);

  const toFreeShipBase = s.free_shipping_threshold_cents;
  const hasFreeTier = toFreeShipBase > 0;
  const freeShip = hasFreeTier && subtotalCents >= toFreeShipBase;
  const shippingCents = freeShip ? 0 : s.shipping_flat_cents;
  const taxCents = Math.round((subtotalCents * s.tax_rate_bps) / 10000);
  const totalCents = subtotalCents + shippingCents + taxCents;
  const toFreeShip = hasFreeTier ? Math.max(0, toFreeShipBase - subtotalCents) : 0;
  const freeProgress = hasFreeTier ? Math.min(100, Math.round((subtotalCents / toFreeShipBase) * 100)) : 0;

  return (
    <Section className="!pt-8">
      <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Cart" }]} />
      <SectionHeading
        title={count > 0 ? `Your cart (${count} item${count === 1 ? "" : "s"})` : "Your cart"}
        subtitle={count > 0 ? "Prices include everything except shipping and any applicable tax." : undefined}
      />

      {cartLoading ? (
        <LoadingState rows={3} />
      ) : lines.length === 0 ? (
        /* Two DIFFERENT empty states, never conflated:
             - signed out: there is no cart to show, because a basket belongs to
               an account. Ask for the sign-in rather than implying the shopper
               never added anything.
             - signed in and genuinely empty: the normal nudge to shop. */
        signedIn ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Your cart is empty"
            body="Nothing here yet. Browse the catalog and add something your pet will actually use - every order ships fast and tracked."
            action={
              <CtaLink to="/shop">
                Start shopping
              </CtaLink>
            }
          />
        ) : (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Sign in to see your cart"
            body="Your cart is saved to your account, so it follows you between devices. Sign in and anything you left here will be waiting."
            action={<CtaLink to="/login">Sign in or create an account</CtaLink>}
          />
        )
      ) : (
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* ── Lines ─────────────────────────────────────────────────── */}
          <div className="min-w-0 space-y-4">
            {hasFreeTier && (
              <div
                className={cn(
                  "card-soft p-4 text-sm",
                  freeShip && "border-emerald-200 bg-emerald-50/60",
                )}
              >
                <div className="flex items-center gap-3">
                  <Truck
                    className={cn("h-5 w-5 shrink-0", freeShip ? "text-emerald-600" : "text-primary")}
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
                    className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
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

            {lines.map((l) => (
              <div key={`${l.slug}-${l.variantId ?? "base"}`} className="card-soft flex min-w-0 gap-3 overflow-hidden p-4 sm:gap-4">
                <Link
                  to={`/product/${l.slug}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-muted sm:h-24 sm:w-24"
                >
                  {l.image ? (
                    <img
                      src={l.image}
                      srcSet={productImageSrcSet(l.image)}
                      sizes="96px"
                      alt={l.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl">🐾</span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 break-words text-sm font-bold [overflow-wrap:anywhere]">
                        <Link to={`/product/${l.slug}`} className="hover:text-primary hover:underline">
                          {l.name}
                        </Link>
                      </h3>
                      {l.variantName && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{l.variantName}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatMoney(l.priceCents)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(l.slug, l.variantId)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${l.name} from cart`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex h-10 shrink-0 items-center rounded-sm border border-input">
                      <button
                        type="button"
                        onClick={() => setQty(l.slug, l.variantId, l.qty - 1)}
                        className="inline-flex h-10 w-10 items-center justify-center hover:bg-muted"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm font-bold">{l.qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(l.slug, l.variantId, l.qty + 1)}
                        disabled={l.qty >= (l.maxQty || 99)}
                        className="inline-flex h-10 w-10 items-center justify-center hover:bg-muted disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="whitespace-nowrap text-sm font-extrabold">{formatMoney(l.priceCents * l.qty)}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3 pt-2">
            <CtaLink to="/shop" variant="outline">
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              Continue shopping
            </CtaLink>
            </div>
          </div>

          {/* ── Summary ───────────────────────────────────────────────── */}
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="card-soft space-y-4 p-5 sm:p-6">
              <h2 className="text-lg font-extrabold">Order summary</h2>

              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="font-semibold">{formatMoney(subtotalCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className="font-semibold">
                    {shippingCents === 0 ? (
                      <span className="text-emerald-700">Free</span>
                    ) : (
                      formatMoney(shippingCents)
                    )}
                  </dd>
                </div>
                {taxCents > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Estimated tax</dt>
                    <dd className="font-semibold">{formatMoney(taxCents)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-3 text-base">
                  <dt className="font-bold">Total</dt>
                  <dd className="font-extrabold">{formatMoney(totalCents)}</dd>
                </div>
              </dl>

              <CtaLink to="/checkout" size="lg" className="w-full">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Proceed to checkout
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </CtaLink>

              <p className="text-center text-xs text-muted-foreground">
                Secure checkout &middot; Tracked shipping &middot; {s.return_window_days}-day free returns
              </p>

              <ul className="mt-1 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Encrypted, PCI-compliant checkout.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>Tracked shipping on every order.</span>
                </li>
                <li className="flex items-start gap-3">
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{s.return_window_days}-day free returns on everything.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="break-words">
                    Need help?{" "}
                    <a href={`mailto:${s.contact_email}`} className="font-semibold text-primary hover:underline">
                      {s.contact_email}
                    </a>
                  </span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </Section>
  );
}