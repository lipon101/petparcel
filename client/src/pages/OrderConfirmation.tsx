// Order confirmation / receipt. Reachable by the buyer straight after checkout
// (order number + remembered email) and by anyone holding the order number plus
// the email it was placed with. Also polls the gateway when a hosted-checkout
// payment is still unconfirmed.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowRight, Bitcoin, CheckCircle2, Clock, Copy, Mail, Package, PackageSearch, Truck } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { googleAdsSendTo, trackOrderConversion, useConsentState } from "@/lib/analytics";
import { readLastOrder } from "@/lib/last-order";
import {
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  ORDER_TIMELINE,
  formatMoney,
  formatDateTime,
} from "@shared/store";
import type { StoreOrderDetail } from "@/lib/types";
import { Breadcrumbs, CtaLink, EmptyState, ErrorState, LoadingState, Section } from "@/components/site/Bits";
import { cn } from "@/lib/utils";

function readRememberedEmail(): string {
  // The email the order was placed with, remembered at checkout so a returning
  // shopper is not asked to retype it. Shared with the checkout page's
  // order-recovery pointer (see lib/last-order.ts).
  return readLastOrder()?.email ?? "";
}

export default function OrderConfirmation() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = (params.orderNumber ?? "").toUpperCase();
  const { user, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [confirmTried, setConfirmTried] = useState(false);
  const [copied, setCopied] = useState(false);

  // Guests who just checked out have their email remembered locally.
  useEffect(() => {
    if (user?.email) setSubmittedEmail(user.email);
    else setSubmittedEmail(readRememberedEmail());
  }, [user?.email]);

  const lookup = trpc.orders.lookup.useQuery(
    { orderNumber, email: submittedEmail || undefined },
    {
      enabled: Boolean(orderNumber) && (Boolean(submittedEmail) || Boolean(user)),
      retry: false,
    },
  );

  const confirmPayment = trpc.checkout.confirmPayment.useMutation({
    onSuccess: () => lookup.refetch(),
  });

  // Resume an unpaid order at the gateway: creates the invoice if the order never
  // got one (placed before the keys were set, or creation failed), or hands back
  // the SAME invoice if one already exists. Without this an unpaid order with no
  // invoice is stranded on a page with no way to pay.
  const resumePayment = trpc.checkout.resumePayment.useMutation({
    onSuccess: (r) => {
      if (r.redirectUrl) window.location.href = r.redirectUrl;
    },
  });

  // Live crypto payment status, straight from NOWPayments. Polls while the
  // payment is still in flight so the shopper watches it move from "waiting" to
  // "confirming" to "finished" without refreshing, and stops once it settles.
  const [settled, setSettled] = useState(false);
  const liveStatus = trpc.checkout.paymentStatus.useQuery(
    { orderNumber },
    {
      enabled: Boolean(orderNumber) && Boolean(lookup.data?.order) && !settled,
      refetchInterval: 15000,
      retry: false,
    },
  );
  useEffect(() => {
    if (liveStatus.data?.terminal) setSettled(true);
  }, [liveStatus.data?.terminal]);

  // If a crypto order is still unpaid after the shopper returned from the
  // gateway, ask the provider once, server-side.
  useEffect(() => {
    if (confirmTried || authLoading) return;
    const order = lookup.data?.order;
    if (!order) return;
    if (order.paymentStatus !== "unpaid") return;
    if (order.paymentProvider !== "nowpayments") return;
    setConfirmTried(true);
    confirmPayment.mutate({ orderNumber: order.orderNumber });
  }, [lookup.data?.order, confirmTried, authLoading]);

  useSeo({
    title: `Order ${orderNumber}`,
    description: `Your PetParcel order ${orderNumber} - status, items and tracking.`,
    path: `/order/${orderNumber}`,
    noindex: true,
  });

  const order = (lookup.data as StoreOrderDetail | undefined)?.order;
  const items = (lookup.data as StoreOrderDetail | undefined)?.items ?? [];
  const events = (lookup.data as StoreOrderDetail | undefined)?.events ?? [];

  // GA4 `purchase` + the Google Ads conversion, exactly ONCE per order. The
  // helper dedupes on the order number, so a re-render, a refresh or a return
  // from the payment gateway cannot double-count. It also only reports when
  // consent allows - and does NOT mark the order as reported in that case - so
  // the dependency on the consent state re-runs this the moment the banner is
  // answered and the event still lands.
  const consent = useConsentState();
  useEffect(() => {
    if (!order) return;
    trackOrderConversion(order, items, googleAdsSendTo());
  }, [order?.orderNumber, items.length, consent]);

  const needsEmail = !submittedEmail && !user;

  const timeline = useMemo(() => {
    if (!order) return [];
    const currentIdx = ORDER_TIMELINE.indexOf(order.status as (typeof ORDER_TIMELINE)[number]);
    return ORDER_TIMELINE.map((status, i) => ({
      status,
      done: order.status === "cancelled" ? false : currentIdx >= i,
    }));
  }, [order]);

  if (authLoading || (lookup.isLoading && !needsEmail)) {
    return (
      <Section className="!pt-8">
        <LoadingState label="Loading your order…" rows={4} />
      </Section>
    );
  }

  // Ask for the email when we can't identify the requester.
  if (needsEmail) {
    return (
      <Section className="!pt-8">
        <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Order" }]} />
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="Confirm it's you"
            body="Enter the email address you used for this order so we can show you the details."
          />
          <form
            className="card-soft mt-4 p-6"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedEmail(email.trim());
            }}
          >
            <label className="block text-sm font-semibold" htmlFor="order-email">
              Email address
            </label>
            <input
              id="order-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              className="btn btn-primary btn-md mt-4 w-full"
            >
              <PackageSearch className="h-4 w-4" aria-hidden="true" />
              View my order
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Tracking an order without the number?{" "}
              <Link to="/track" className="font-semibold text-primary hover:underline">
                Use the tracking page
              </Link>
            </p>
          </form>
        </div>
      </Section>
    );
  }

  if (lookup.isError || !order) {
    return (
      <Section className="!pt-8">
        <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Order" }]} />
        <div className="mx-auto max-w-lg">
          <ErrorState
            title="We couldn't find that order"
            body="Double-check the order number and the email you used. If it still won't load, contact support and we'll track it down."
            onRetry={() => lookup.refetch()}
          />
          <div className="mt-4 flex justify-center gap-3">
            <CtaLink to="/track" variant="outline">
              <PackageSearch className="h-4 w-4" aria-hidden="true" />
              Go to tracking
            </CtaLink>
            <CtaLink to="/contact" variant="outline">
              <Mail className="h-4 w-4" aria-hidden="true" />
              Contact support
            </CtaLink>
          </div>
        </div>
      </Section>
    );
  }

  const paid = order.paymentStatus === "paid";

  return (
    <Section className="!pt-8">
      <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Order", to: "/track" }, { label: order.orderNumber }]} />

      <div className="card-soft overflow-hidden">
        <div className="border-b border-border bg-secondary/50 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                {paid ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5 text-amber-600" />}
                {paid ? "Payment received" : "Order placed - payment pending"}
              </span>
              <h1 className="mt-2 text-2xl font-medium sm:text-3xl">Thanks - your order is in.</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {paid
                  ? "We're preparing your parcel - you'll get a tracking number as soon as it ships."
                  : "We've reserved your items. Your order ships as soon as the payment clears."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Order number</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(order.orderNumber);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                }}
                className="mt-1 inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-border"
              >
                {order.orderNumber} <Copy className="h-3.5 w-3.5" />
              </button>
              {copied && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Copied</p>}
            </div>
          </div>
        </div>

        {/* Email notice - stated from the PERSISTED send record, so it is always
            true. The confirmation email is sent ONLY once the payment itself is
            confirmed, so for an unpaid order this says what WILL happen rather
            than claiming something already went. */}
        <div className="border-b border-border px-6 py-4 sm:px-8">
          <p
            className={cn(
              "rounded-xl p-3 text-xs font-semibold",
              order.confirmationEmailSentAt
                ? "bg-emerald-50 text-emerald-800"
                : paid
                  ? "bg-amber-50 text-amber-800"
                  : "bg-secondary/60 text-muted-foreground",
            )}
          >
            {order.confirmationEmailSentAt ? (
              <>&#128231; Confirmation email sent to {order.email}.</>
            ) : paid ? (
              <>
                Payment confirmed. Your confirmation email will be sent to {order.email} - it can take a
                few minutes. If it doesn't arrive, check your spam folder or{" "}
                <Link to="/contact" className="underline">
                  contact us
                </Link>
                .
              </>
            ) : (
              <>
                Your confirmation email will be sent automatically to {order.email} once your payment is
                confirmed. Keep your order number handy, or track this order any time at{" "}
                <Link to="/track" className="underline">
                  /track
                </Link>
                .
              </>
            )}
          </p>
        </div>

        {/* Live crypto payment status - the REAL provider state, not a smoothed
            "unpaid". Polls while in flight and stops once it settles. */}
        {order.paymentProvider === "nowpayments" && liveStatus.data && (
          <div className="border-b border-border px-6 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bitcoin className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="text-sm font-bold">
                  {liveStatus.data.configured ? liveStatus.data.label : "Crypto payment"}
                </span>
                {liveStatus.data.configured && !liveStatus.data.terminal && (
                  <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
                )}
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  liveStatus.data.paymentStatus === "paid"
                    ? "bg-emerald-50 text-emerald-800"
                    : liveStatus.data.stage === "failed" || liveStatus.data.stage === "expired"
                      ? "bg-destructive/5 text-destructive"
                      : "bg-amber-50 text-amber-800",
                )}
              >
                {liveStatus.data.configured
                  ? (liveStatus.data.status ?? "awaiting payment")
                  : (order.paymentStatus === "paid" ? "paid" : "settled by store")}
              </span>
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              {liveStatus.data.payCurrency && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Coin</dt>
                  <dd className="font-semibold uppercase">{liveStatus.data.payCurrency}</dd>
                </div>
              )}
              {liveStatus.data.payAmount != null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Amount due</dt>
                  <dd className="font-semibold">{liveStatus.data.payAmount}</dd>
                </div>
              )}
              {liveStatus.data.actuallyPaid != null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Received</dt>
                  <dd className="font-semibold">{liveStatus.data.actuallyPaid}</dd>
                </div>
              )}
              {liveStatus.data.paymentId && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Payment ID</dt>
                  <dd className="font-mono text-[11px] font-semibold">{liveStatus.data.paymentId}</dd>
                </div>
              )}
            </dl>

            {liveStatus.data.payAddress && !liveStatus.data.terminal && (
              <div className="mt-3 rounded-lg bg-secondary/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Send to
                </p>
                <p className="mt-1 break-all font-mono text-[11px]">{liveStatus.data.payAddress}</p>
              </div>
            )}

            {liveStatus.data.error && (
              <p className="mt-3 rounded-lg bg-secondary/60 p-2.5 text-[11px] text-muted-foreground">
                {liveStatus.data.error}
              </p>
            )}
            {liveStatus.data.configured && !liveStatus.data.terminal && !liveStatus.data.error && (
              <p className="mt-3 text-[11px] text-muted-foreground">
                This page updates automatically as your payment confirms on the blockchain.
              </p>
            )}
          </div>
        )}

        {/* Progress */}
        {order.status !== "cancelled" && order.status !== "refunded" && (
          <div className="border-b border-border p-6 sm:p-8">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
              {timeline.map((step, i) => (
                <li key={step.status} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      step.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                    {ORDER_STATUS_LABEL[step.status]}
                  </span>
                  {i < timeline.length - 1 && <span className="text-muted-foreground">→</span>}
                </li>
              ))}
            </ol>

            {order.trackingNumber && (
              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-secondary/60 p-4">
                <Truck className="h-5 w-5 text-primary" />
                <p className="text-sm">
                  <strong>{order.carrier ?? "Carrier"}</strong> tracking:{" "}
                  <span className="font-mono">{order.trackingNumber}</span>
                </p>
                <StatusPill status={order.status} />
              </div>
            )}
          </div>
        )}

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr]">
          {/* Items */}
          <div>
            <h2 className="text-lg font-medium">Items</h2>
            <ul className="mt-4 space-y-4">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <span className="h-16 w-16 shrink-0 overflow-hidden rounded-sm bg-muted">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">🐾</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {item.slug ? (
                        <Link to={`/product/${item.slug}`} className="hover:text-primary hover:underline">
                          {item.nameSnapshot}
                        </Link>
                      ) : (
                        item.nameSnapshot
                      )}
                    </span>
                    {item.variantSnapshot && (
                      <span className="block text-xs text-muted-foreground">{item.variantSnapshot}</span>
                    )}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Qty {item.qty} · {formatMoney(item.priceCents)} each
                    </span>
                  </span>
                  <span className="text-sm font-medium">{formatMoney(item.priceCents * item.qty)}</span>
                </li>
              ))}
            </ul>

            <OrderTotals order={order} />

            {/* Timeline of events */}
            {events.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-semibold">Order activity</h3>
                <ol className="mt-3 space-y-3">
                  {events.map((e) => (
                    <li key={e.id} className="flex gap-3 text-xs">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span>
                        <span className="font-semibold">{ORDER_STATUS_LABEL[e.status] ?? e.status}</span>
                        {e.note && <span className="text-muted-foreground"> - {e.note}</span>}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {formatDateTime(e.createdAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Addresses */}
          <aside className="space-y-6">
            <div className="card-soft p-5">
              <h3 className="text-sm font-semibold">Shipping to</h3>
              <address className="mt-2 space-y-0.5 text-sm not-italic text-muted-foreground">
                <span className="block font-semibold text-foreground">{order.shippingAddress.fullName}</span>
                <span className="block">{order.shippingAddress.line1}</span>
                {order.shippingAddress.line2 && <span className="block">{order.shippingAddress.line2}</span>}
                <span className="block">
                  {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                  {order.shippingAddress.postalCode}
                </span>
                <span className="block">United States</span>
                {order.shippingAddress.phone && <span className="block">{order.shippingAddress.phone}</span>}
              </address>
            </div>

            <div className="card-soft p-5">
              <h3 className="text-sm font-semibold">Payment</h3>
              <dl className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <dt>Status</dt>
                  <dd className="font-semibold text-foreground">{order.paymentStatus}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Method</dt>
                  <dd className="font-semibold text-foreground">{order.paymentProvider ?? "-"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Placed</dt>
                  <dd className="font-semibold text-foreground">{formatDateTime(order.createdAt)}</dd>
                </div>
              </dl>
              {!paid && (
                <div className="mt-3 space-y-3">
                  <p className="rounded-sm bg-secondary/60 p-3 text-xs leading-relaxed text-muted-foreground">
                    Just paid? Crypto settles on the blockchain, which can take a few minutes. This page
                    updates itself. On-chain records are public, so your payment can be verified
                    independently of us - no card network or processor in between.
                  </p>
                  <button
                    type="button"
                    onClick={() => resumePayment.mutate({ orderNumber: order.orderNumber })}
                    disabled={resumePayment.isPending}
                    className="btn btn-primary btn-md w-full"
                  >
                    <Bitcoin className="h-4 w-4" aria-hidden="true" />
                    {resumePayment.isPending ? "Opening checkout…" : "Complete your payment"}
                  </button>
                  {resumePayment.error && (
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      {(resumePayment.error as { message?: string }).message ??
                        "Could not open the payment page. Please try again or contact support."}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <CtaLink to="/shop" variant="outline">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                Continue shopping
              </CtaLink>
              <CtaLink to="/contact" variant="ghost">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Need help with this order?
              </CtaLink>
            </div>
          </aside>
        </div>
      </div>
    </Section>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`ml-auto inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        ORDER_STATUS_CLASS[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"
      }`}
    >
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function OrderTotals({ order }: { order: { subtotalCents: number; shippingCents: number; taxCents: number; totalCents: number } }) {
  return (
    <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="font-semibold">{formatMoney(order.subtotalCents)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Shipping</dt>
        <dd className="font-semibold">
          {order.shippingCents === 0 ? <span className="text-emerald-700">Free</span> : formatMoney(order.shippingCents)}
        </dd>
      </div>
      {order.taxCents > 0 && (
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="font-semibold">{formatMoney(order.taxCents)}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-border pt-3 text-base">
        <dt className="font-semibold">Total</dt>
        <dd className="font-medium">{formatMoney(order.totalCents)}</dd>
      </div>
    </dl>
  );
}
