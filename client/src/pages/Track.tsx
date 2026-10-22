// Track order - public lookup by order number + email. This is the page support
// links to and the page a customer returns to when they've lost the email.
import { useState } from "react";
import { Link } from "wouter";
import { Mail, PackageSearch, Search } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useSeo } from "@/lib/petparcel";
import {
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  ORDER_TIMELINE,
  formatDateTime,
  formatMoney,
} from "@shared/store";
import { Breadcrumbs, CtaLink, EmptyState, ErrorState, Section, SectionHeading } from "@/components/site/Bits";

export default function Track() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState<{ orderNumber: string; email: string } | null>(null);

  useSeo({
    title: "Track Your Order",
    description:
      "Track your PetParcel order. Enter your order number and email to see live status, items and carrier tracking.",
    path: "/track",
    noindex: true,
  });

  const { data, isLoading, isError, error } = trpc.orders.lookup.useQuery(
    { orderNumber: query?.orderNumber ?? "", email: query?.email },
    { enabled: Boolean(query?.orderNumber && query?.email), retry: false },
  );

  const order = data?.order;
  const items = data?.items ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery({ orderNumber: orderNumber.trim().toUpperCase(), email: email.trim().toLowerCase() });
  };

  return (
    <Section className="!pt-8">
      <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Track order" }]} />
      <div className="mx-auto max-w-3xl">
        <SectionHeading
          align="center"
          eyebrow="Order tracking"
          title="Where's my parcel?"
          subtitle="Enter your order number and the email you used at checkout. Both are needed to keep your order private."
        />

        <form onSubmit={submit} className="card-soft grid gap-4 p-6 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label className="block text-sm font-semibold" htmlFor="track-order">
              Order number
            </label>
            <input
              id="track-order"
              required
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="PP-XXXXXXXX"
              className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 font-mono text-sm uppercase outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="track-email">
              Email address
            </label>
            <input
              id="track-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-md w-full gap-2 sm:w-auto"
            >
              <Search className="h-4 w-4" />
              {isLoading ? "Searching…" : "Track"}
            </button>
          </div>
        </form>

        <div className="mt-8">
          {!query && (
            <EmptyState
              icon={<PackageSearch className="h-6 w-6" />}
              title="Your order number is in your confirmation"
              body="It looks like PP-XXXXXXXX. If you checked out as a guest and lost it, contact support with the email you used and we'll find it."
              action={
                <CtaLink to="/contact" variant="outline">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Contact support
                </CtaLink>
              }
            />
          )}

          {query && isLoading && (
            <div className="card-soft p-8 text-center text-sm text-muted-foreground">Looking up your order…</div>
          )}

          {query && isError && (
            <ErrorState
              title="We couldn't find that order"
              body={error?.message ?? "Check the order number and email, then try again."}
            />
          )}

          {query && order && (
            <div className="card-soft overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/50 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Order {order.orderNumber}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Placed {formatDateTime(order.createdAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${
                    ORDER_STATUS_CLASS[order.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"
                  }`}
                >
                  {ORDER_STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>

              <div className="p-5">
                {/* Progress */}
                {!["cancelled", "refunded"].includes(order.status) && (
                  <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-3">
                    {ORDER_TIMELINE.map((step, i) => {
                      const currentIdx = ORDER_TIMELINE.indexOf(order.status as never);
                      const done = currentIdx >= i;
                      return (
                        <li key={step} className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {ORDER_STATUS_LABEL[step]}
                          </span>
                          {i < ORDER_TIMELINE.length - 1 && <span className="text-muted-foreground">→</span>}
                        </li>
                      );
                    })}
                  </ol>
                )}

                {order.trackingNumber ? (
                  <div className="rounded-lg bg-secondary/60 p-4 text-sm">
                    <p className="font-semibold">
                      {order.carrier ?? "Carrier"} · <span className="font-mono">{order.trackingNumber}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use this number on the carrier's site for live movement updates.
                    </p>
                  </div>
                ) : (
                  <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                    No tracking number yet - we add one the moment your parcel leaves the warehouse.
                  </p>
                )}

                <h3 className="mt-6 text-sm font-semibold">Items in this order</h3>
                <ul className="mt-3 space-y-3">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">🐾</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{item.nameSnapshot}</span>
                        <span className="block text-xs text-muted-foreground">
                          {item.variantSnapshot ? `${item.variantSnapshot} · ` : ""}Qty {item.qty}
                        </span>
                      </span>
                      <span className="text-sm font-semibold">{formatMoney(item.priceCents * item.qty)}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 flex justify-between border-t border-border pt-4 text-sm">
                  <span className="font-semibold">Order total</span>
                  <span className="font-medium">{formatMoney(order.totalCents)}</span>
                </p>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    to={`/order/${order.orderNumber}`}
                    className="btn btn-primary btn-sm"
                  >
                    <PackageSearch className="h-4 w-4" aria-hidden="true" />
                    Full order details
                  </Link>
                  <CtaLink to="/contact" variant="outline" size="sm" className="h-10">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Something wrong?
                  </CtaLink>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
