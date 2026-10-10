// Cart — line items with quantity controls, remove, and a running total that
// shows exactly how the free-shipping threshold is applied.
import { Link } from "wouter";
import { Minus, Plus, ShoppingBag, Trash2, Truck } from "lucide-react";
import { useCart } from "@/lib/petparcel";
import { useSeo } from "@/lib/petparcel";
import { formatMoney } from "@shared/store";
import { useSite } from "@/components/site/Layout";
import { Breadcrumbs, CtaLink, EmptyState, Section, SectionHeading } from "@/components/site/Bits";

export default function Cart() {
  const s = useSite();
  const { lines, subtotalCents, setQty, remove, count } = useCart();

  useSeo({
    title: "Your Cart",
    description: "Review your PetParcel cart and check out securely. Free US shipping over $49.",
    path: "/cart",
    noindex: true,
  });

  const freeShip = subtotalCents >= s.free_shipping_threshold_cents;
  const shippingCents = freeShip ? 0 : s.shipping_flat_cents;
  const taxCents = Math.round((subtotalCents * s.tax_rate_bps) / 10000);
  const totalCents = subtotalCents + shippingCents + taxCents;
  const toFreeShip = Math.max(0, s.free_shipping_threshold_cents - subtotalCents);

  return (
    <Section className="!pt-8">
      <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Cart" }]} />
      <SectionHeading
        title={count > 0 ? `Your cart (${count} item${count === 1 ? "" : "s"})` : "Your cart"}
        subtitle={count > 0 ? "Prices include everything except shipping and any applicable tax." : undefined}
      />

      {lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="Your cart is empty"
          body="Nothing here yet. Browse the catalog and add something your pet will actually use — free US shipping kicks in over $49."
          action={
            <CtaLink to="/shop">
              Start shopping
            </CtaLink>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          {/* ── Lines ─────────────────────────────────────────────────── */}
          <div className="space-y-4">
            {!freeShip && (
              <div className="card-soft flex items-center gap-3 p-4 text-sm">
                <Truck className="h-5 w-5 shrink-0 text-primary" />
                <p>
                  Add <strong>{formatMoney(toFreeShip)}</strong> more to unlock{" "}
                  <strong>free US shipping</strong>.
                </p>
              </div>
            )}

            {lines.map((l) => (
              <div key={`${l.slug}-${l.variantId ?? "base"}`} className="card-soft flex gap-4 p-4">
                <Link
                  to={`/product/${l.slug}`}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-muted"
                >
                  {l.image ? (
                    <img src={l.image} alt={l.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl">🐾</span>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold">
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

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex h-10 items-center rounded-full border border-input">
                      <button
                        type="button"
                        onClick={() => setQty(l.slug, l.variantId, l.qty - 1)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-l-full hover:bg-secondary"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-9 text-center text-sm font-bold">{l.qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(l.slug, l.variantId, l.qty + 1)}
                        disabled={l.qty >= (l.maxQty || 99)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-r-full hover:bg-secondary disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-sm font-extrabold">{formatMoney(l.priceCents * l.qty)}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3 pt-2">
              <CtaLink to="/shop" variant="outline">
                Continue shopping
              </CtaLink>
            </div>
          </div>

          {/* ── Summary ───────────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card-soft space-y-4 p-6">
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
                Proceed to checkout
              </CtaLink>

              <p className="text-center text-xs text-muted-foreground">
                Secure checkout · card details never touch our servers
              </p>
            </div>

            <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
              <li>• Ships from US warehouses in {s.shipping_estimate}.</li>
              <li>• {s.return_window_days}-day returns on everything.</li>
              <li>• Need help? {s.contact_email}</li>
            </ul>
          </aside>
        </div>
      )}
    </Section>
  );
}
