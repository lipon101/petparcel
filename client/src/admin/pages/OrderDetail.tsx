// Order detail: line items, totals, activity timeline, and the fulfilment
// actions - change status (with a note), set payment status, and save tracking.
// It also carries the payment panel: the raw Bachs data for the order, a
// manual "refresh status" that re-queries the provider live, and the refund
// action (the panel's only money-moving button, behind a confirmation).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, CreditCard, Mail, RefreshCw, Save, Send, Truck, CheckCircle2, Undo2, Wallet } from "lucide-react";
import { adminPath } from "@/_core/admin-path";
import {
  CARRIERS,
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUSES,
  formatDateTime,
  formatMoney,
  type OrderStatus,
} from "@shared/store";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminOrderEmailHistory, AdminOrderTelegramStatus, AdminRawPaymentData } from "../types";
import {
  AdminPageHeader,
  Btn,
  Card,
  ConfirmDialog,
  ErrorPanel,
  Field,
  Select,
  StatusPill,
  TableSkeleton,
  TextInput,
  useToast,
} from "../ui";

function orderIdFromPath(): string {
  const prefix = adminPath("orders/");
  return window.location.pathname.slice(prefix.length).split("/")[0] ?? "";
}

/** One read-only row in the payment panel. */
function PayRow({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1.5 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`text-right font-semibold text-ink ${mono ? "break-all font-mono text-[11px]" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

const dash = <span className="text-muted-foreground">—</span>;

/** Human labels for the email kinds and triggers the history panel shows. Kept
 *  local (not imported from the server) so no server code ships to the client;
 *  an unknown value falls back to the raw string. */
const EMAIL_KIND_LABELS: Record<string, string> = {
  order_confirmation: "Order confirmation",
  payment_confirmation: "Payment confirmation",
  shipping_notification: "Shipping notification",
  contact_message: "Contact message",
  welcome: "Welcome",
  admin_new_order: "New-order alert (admin)",
  unpaid_alert: "Unpaid-order alert (admin)",
  auth_verification: "Email verification",
  auth_password_reset: "Password reset",
  auth_magic_link: "Magic-link sign-in",
};

const EMAIL_TRIGGER_LABELS: Record<string, string> = {
  ipn: "Payment webhook",
  reconciliation: "Live status reconciliation",
  post_return: "Post-return confirmation",
  admin_resend: "Admin resend",
  unpaid_alert: "Unpaid-order alert",
};

export function OrderDetailPage() {
  const data = useAdminData();
  const toast = useToast();
  const id = useMemo(orderIdFromPath, []);
  const { data: order, isLoading, error, refetch } = useAsync(() => data.getOrder(id), [data, id]);
  // The raw payment picture rides alongside the order: stored handles, the live
  // status, and the last webhook we received.
  const {
    data: raw,
    isLoading: rawLoading,
    error: rawError,
    refetch: refetchRaw,
  } = useAsync<AdminRawPaymentData>(() => data.getRawPayment(id), [data, id]);
  // The email history rides alongside: every send attempt plus the two persisted
  // one-shot claims (the paid receipt and the unpaid alert).
  const {
    data: emailHistory,
    isLoading: emailLoading,
    error: emailError,
    refetch: refetchEmails,
  } = useAsync<AdminOrderEmailHistory>(() => data.getEmailHistory(id), [data, id]);
  // The Telegram notification picture: the one-shot claim, the last error, and
  // the durable retry queue. Answers "was the owner told, and if not, is it
  // still going to be?" without reading the logs.
  const {
    data: telegramStatus,
    isLoading: telegramLoading,
    error: telegramError,
    refetch: refetchTelegram,
  } = useAsync<AdminOrderTelegramStatus>(() => data.getTelegramStatus(id), [data, id]);

  const [status, setStatus] = useState<OrderStatus>("pending");
  const [note, setNote] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmRefund, setConfirmRefund] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);

  useEffect(() => {
    if (!order) return;
    setStatus(order.status as OrderStatus);
    setPaymentStatus(order.paymentStatus);
    setTracking(order.trackingNumber ?? "");
    setCarrier(order.carrier ?? "");
  }, [order?.id, order?.updatedAt]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await fn();
      toast.push(message);
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Update failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  /** Re-query Bachs live and reconcile. Settles an order whose webhook was
   *  missed, and is safe to press repeatedly (a paid order is never undone). */
  const refreshStatus = async () => {
    setRefreshing(true);
    try {
      await data.refreshPaymentStatus(id);
      toast.push("Payment status refreshed from Bachs.");
      refetchRaw();
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not refresh the payment status.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const doRefund = async () => {
    setRefundBusy(true);
    try {
      const res = await data.refundPayment(id, { confirm: true });
      toast.push(res.reason ?? `Refund: ${res.label}`);
      setConfirmRefund(false);
      refetchRaw();
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "The refund could not be created.", "error");
    } finally {
      setRefundBusy(false);
    }
  };

  /** Resend the paid receipt. The server refuses an unpaid order and the send
   *  goes through the same one-shot claim, so this can deliver a receipt that
   *  has not gone yet but can never duplicate one that has. */
  const doResend = async () => {
    setResendBusy(true);
    try {
      const res = await data.resendConfirmationEmail(id);
      const s = res.outcome.status;
      if (s === "sent") toast.push("Confirmation email sent.");
      else if (s === "already_sent") toast.push("A confirmation email has already been sent for this order.");
      else toast.push(res.outcome.reason ?? "The confirmation email was not sent.", "error");
      refetchEmails();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "The confirmation email could not be sent.", "error");
    } finally {
      setResendBusy(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <AdminPageHeader title="Order" />
        <TableSkeleton rows={5} />
      </>
    );
  }
  if (error || !order) {
    return (
      <>
        <AdminPageHeader title="Order" />
        <ErrorPanel message={error ?? "That order could not be found."} onRetry={refetch} />
        <div className="mt-4">
          <Link to={adminPath("orders")} className="text-sm font-semibold text-primary hover:underline">
            Back to orders
          </Link>
        </div>
      </>
    );
  }

  // The refund button is only live for a paid order that has a CHARGE id to
  // refund against, and never while a refund is already in flight or done.
  const refundInFlight = raw?.refund.status === "created" || raw?.refund.status === "refunded";
  const canRefund = Boolean(raw?.configured && raw?.chargeId && order.paymentStatus === "paid" && !refundInFlight);

  return (
    <>
      <div className="mb-4">
        <Link
          to={adminPath("orders")}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All orders
        </Link>
      </div>
      <AdminPageHeader
        title={`Order ${order.orderNumber}`}
        subtitle={`${order.customerName} · ${order.email}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={order.status} />
            <StatusPill status={order.paymentStatus} kind="payment" />
          </div>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-serif text-lg font-bold text-ink">Items</h2>
            <ul className="mt-4 space-y-3 border-t border-border pt-4">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{item.name}</span>
                    {item.variant && <span className="block text-xs text-muted-foreground">{item.variant}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">×{item.qty}</span>
                  <span className="font-bold text-ink">{formatMoney(item.priceCents * item.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-semibold text-ink">{formatMoney(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-semibold text-ink">{formatMoney(order.shippingCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="font-semibold text-ink">{formatMoney(order.taxCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <dt className="font-bold text-ink">Total</dt>
                <dd className="font-extrabold text-ink">{formatMoney(order.totalCents)}</dd>
              </div>
            </dl>
            {order.notes && (
              <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-ink">
                <strong>Customer note:</strong> {order.notes}
              </p>
            )}
          </Card>

          {/* ── Card payment (Bachs) ────────────────────────────────────────────
              Everything the provider knows about this order: the stored
              handles, the live status, and the last webhook we received
              verbatim. Refresh re-queries Bachs; Refund returns the
              funds (behind a confirmation). */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
                <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
                Card payment
                <span className="text-xs font-normal text-muted-foreground">Bachs</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {raw?.liveStatus && (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      raw.paymentStatus === "paid"
                        ? "bg-emerald-50 text-emerald-800"
                        : raw.liveStatus === "failed" || raw.liveStatus === "expired"
                          ? "bg-destructive/5 text-destructive"
                          : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {raw.liveStatus}
                  </span>
                )}
                <Btn variant="outline" disabled={refreshing} onClick={refreshStatus}>
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                  {refreshing ? "Refreshing…" : "Refresh status"}
                </Btn>
              </div>
            </div>

            {rawError && <ErrorPanel message={rawError} onRetry={refetchRaw} />}

            {rawLoading && !raw ? (
              <TableSkeleton rows={4} />
            ) : raw ? (
              <>
                {!raw.configured && (
                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                    The store's Bachs API key isn't set on this deployment, so live card
                    status and refunds aren't available. Add <code>BACHS_API_KEY</code> and
                    redeploy.
                  </p>
                )}
                {raw.error && raw.configured && (
                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                    {raw.error} The values below are the last ones stored on the order.
                  </p>
                )}

                <dl className="mt-4 text-xs">
                  <PayRow label="Store status" value={raw.paymentStatus} />
                  <PayRow label="Live status" value={raw.liveLabel ?? dash} />
                  <PayRow label="Status detail" value={raw.storedStatusDetail ?? dash} />
                  <PayRow label="Charge ID" value={raw.chargeId ?? dash} mono />
                  <PayRow label="Checkout ID" value={raw.checkoutId ?? dash} mono />
                  <PayRow label="Refund ID" value={raw.refund.ref ?? dash} mono />
                  <PayRow label="Method" value={raw.paymentMethod ?? dash} />
                  <PayRow
                    label="Amount due"
                    value={
                      raw.amountCents == null
                        ? dash
                        : `${formatMoney(raw.amountCents)}${raw.currency ? ` ${raw.currency}` : ""}`
                    }
                  />
                  <PayRow
                    label="Received"
                    value={
                      raw.amountPaidCents == null
                        ? dash
                        : `${formatMoney(raw.amountPaidCents)}${raw.currency ? ` ${raw.currency}` : ""}`
                    }
                  />
                </dl>

                {raw.checkoutUrl && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Hosted checkout:{" "}
                    <a
                      href={raw.checkoutUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-primary hover:underline"
                    >
                      open on Bachs
                    </a>
                  </p>
                )}

                {/* Last webhook - the single most useful fact when a payment looks
                    stuck: what the provider last told us, and when. */}
                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="text-sm font-bold text-ink">Last webhook received</h3>
                  {raw.lastIpnAt ? (
                    <>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(raw.lastIpnAt)}
                        {raw.lastIpnStatus && (
                          <>
                            {" · "}
                            <span className="font-mono font-semibold text-ink">{raw.lastIpnStatus}</span>
                          </>
                        )}
                      </p>
                      <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-secondary/60 p-3 font-mono text-[10px] leading-relaxed text-ink">
                        {JSON.stringify(raw.lastIpn, null, 2)}
                      </pre>
                    </>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No webhook has been received for this order yet. Refresh the status to pull the
                      live figure from the provider.
                    </p>
                  )}
                </div>

                {/* Refund */}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div>
                    <h3 className="text-sm font-bold text-ink">Refund</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {raw.refund.status
                        ? `${raw.refund.label ?? raw.refund.status}${
                            raw.refund.amount ? ` · ${raw.refund.amount} ${(raw.refund.currency ?? "").toUpperCase()}` : ""
                          }`
                        : "Returns the full amount to the customer through Bachs."}
                    </p>
                  </div>
                  <Btn
                    variant="danger"
                    disabled={!canRefund || refundBusy}
                    onClick={() => setConfirmRefund(true)}
                  >
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    {refundInFlight ? "Refund in progress" : "Refund order"}
                  </Btn>
                </div>
                {!canRefund && !refundInFlight && raw.configured && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {order.paymentStatus !== "paid"
                      ? "Only a paid order can be refunded."
                      : !raw.chargeId
                        ? "No Bachs charge id on this order — refresh the status first. (An order paid through the store's previous provider has no charge here and cannot be refunded from this panel.)"
                        : ""}
                  </p>
                )}
              </>
            ) : null}
          </Card>

          {/* ── Email history ───────────────────────────────────────────────
              Was the customer told, when, by which path, and to what address?
              Every send attempt from `email_log` plus the two persisted one-shot
              claims (the paid receipt and the unpaid alert). The resend action is
              PAID ORDERS ONLY and goes through the same one-shot claim, so it can
              never duplicate a receipt that has already gone. */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
                <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
                Email history
              </h2>
              <Btn
                variant="outline"
                disabled={order.paymentStatus !== "paid" || resendBusy}
                onClick={doResend}
                title={
                  order.paymentStatus !== "paid"
                    ? "Only a paid order can receive a confirmation email."
                    : undefined
                }
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {resendBusy ? "Sending…" : "Resend confirmation"}
              </Btn>
            </div>

            {emailError && <ErrorPanel message={emailError} onRetry={refetchEmails} />}

            {emailLoading && !emailHistory ? (
              <TableSkeleton rows={3} />
            ) : emailHistory ? (
              <>
                <dl className="mt-4 text-xs">
                  <PayRow
                    label="Confirmation email"
                    value={
                      emailHistory.confirmationEmailSentAt
                        ? `Sent ${formatDateTime(emailHistory.confirmationEmailSentAt)}`
                        : order.paymentStatus === "paid"
                          ? "Not sent yet"
                          : "Will be sent once payment is confirmed"
                    }
                  />
                  <PayRow
                    label="Unpaid alert"
                    value={
                      emailHistory.unpaidAlertSentAt
                        ? `Sent ${formatDateTime(emailHistory.unpaidAlertSentAt)}`
                        : "Not sent"
                    }
                  />
                </dl>

                {order.paymentStatus !== "paid" && (
                  <p className="mt-3 rounded-xl bg-secondary/60 p-3 text-[11px] text-muted-foreground">
                    This order is not paid, so no confirmation email can be sent. The receipt is
                    delivered automatically once the payment is confirmed.
                  </p>
                )}

                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="text-sm font-bold text-ink">Send attempts</h3>
                  {emailHistory.emails.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No emails have been sent for this order yet.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {emailHistory.emails.map((e) => (
                        <li
                          key={e.id}
                          className="rounded-xl border border-border/60 p-3 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-ink">
                              {EMAIL_KIND_LABELS[e.kind] ?? e.kind}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                e.status === "sent"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : e.status === "failed"
                                    ? "bg-destructive/5 text-destructive"
                                    : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {e.status}
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            {formatDateTime(e.createdAt)} · to{" "}
                            <span className="font-mono text-ink">{e.to}</span>
                            {e.trigger && (
                              <>
                                {" "}
                                · via{" "}
                                <span className="font-semibold text-ink">
                                  {EMAIL_TRIGGER_LABELS[e.trigger] ?? e.trigger}
                                </span>
                              </>
                            )}
                          </p>
                          {e.error && (
                            <p className="mt-1 text-destructive">{e.error}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : null}
          </Card>

          {/* ── Telegram notification ─────────────────────────────────────────────
              Whether the owner's private Telegram channel was told about this
              settled order, and - when it was not - why, and whether a retry is
              still queued. The claim on `orders` is the authority; the queue
              rows below it explain what happens next, so a `pending` retry is
              never misread as delivered. */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
                <Send className="h-5 w-5 text-primary" aria-hidden="true" />
                Telegram notification
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  telegramStatus?.notifiedAt
                    ? "bg-emerald-50 text-emerald-800"
                    : telegramStatus?.outbox.some((o) => o.status === "failed")
                      ? "bg-destructive/5 text-destructive"
                      : telegramStatus?.outbox.some((o) => o.status === "pending")
                        ? "bg-amber-50 text-amber-800"
                        : "bg-secondary/60 text-muted-foreground"
                }`}
              >
                {telegramStatus?.notifiedAt
                  ? "Delivered"
                  : telegramStatus?.outbox.some((o) => o.status === "failed")
                    ? "Failed"
                    : telegramStatus?.outbox.some((o) => o.status === "pending")
                      ? "Pending retry"
                      : order.paymentStatus === "paid"
                        ? "Not sent"
                        : "Not applicable"}
              </span>
            </div>

            {telegramError && <ErrorPanel message={telegramError} onRetry={refetchTelegram} />}

            {telegramLoading && !telegramStatus ? (
              <TableSkeleton rows={2} />
            ) : telegramStatus ? (
              <>
                <dl className="mt-4 text-xs">
                  <PayRow
                    label="Notified"
                    value={
                      telegramStatus.notifiedAt
                        ? formatDateTime(telegramStatus.notifiedAt)
                        : order.paymentStatus === "paid"
                          ? "Not yet"
                          : "Once payment is confirmed"
                    }
                  />
                  <PayRow label="Last error" value={telegramStatus.notifyError ?? dash} />
                </dl>

                {!telegramStatus.notifiedAt &&
                  telegramStatus.outbox.some((o) => o.status === "pending") && (
                    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900">
                      A retry is queued - the sweep will try again on the next run.
                    </p>
                  )}
                {telegramStatus.outbox.some((o) => o.status === "failed") && (
                  <p className="mt-3 rounded-xl bg-destructive/5 p-3 text-[11px] text-destructive">
                    The retry budget is exhausted and the owner was NOT notified. Fix the
                    Telegram configuration (bot token, and that the bot is an admin of the
                    channel), then re-send from the panel - the reminder reopens with a fresh
                    budget.
                  </p>
                )}

                {telegramStatus.outbox.length > 0 && (
                  <div className="mt-5 border-t border-border pt-4">
                    <h3 className="text-sm font-bold text-ink">Retry queue</h3>
                    <ul className="mt-3 space-y-2">
                      {telegramStatus.outbox.map((o) => (
                        <li key={o.id} className="rounded-xl border border-border/60 p-3 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-ink">
                              {o.attempts} attempt{o.attempts === 1 ? "" : "s"}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                o.status === "sent"
                                  ? "bg-emerald-50 text-emerald-800"
                                  : o.status === "failed"
                                    ? "bg-destructive/5 text-destructive"
                                    : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {o.status}
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            queued {formatDateTime(o.createdAt)}
                            {o.lastAttemptAt && ` · last try ${formatDateTime(o.lastAttemptAt)}`}
                          </p>
                          {o.lastError && <p className="mt-1 text-destructive">{o.lastError}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : null}
          </Card>

          <Card className="p-6">
            <h2 className="font-serif text-lg font-bold text-ink">Activity</h2>
            {order.events.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No status changes recorded yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {order.events.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span>
                      <span className="font-semibold text-ink">{ORDER_STATUS_LABEL[e.status] ?? e.status}</span>
                      {e.note && <span className="text-muted-foreground"> — {e.note}</span>}
                      <span className="mt-0.5 block text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <Card className="h-fit p-6">
          <h2 className="font-serif text-lg font-bold text-ink">Fulfilment</h2>

          <div className="mt-4 space-y-4">
            <Field label="Order status" htmlFor="o-status">
              <Select
                id="o-status"
                value={status}
                onChange={(v) => setStatus(v as OrderStatus)}
                options={ORDER_STATUSES.map((st) => ({ value: st, label: ORDER_STATUS_LABEL[st] }))}
              />
            </Field>
            <Field label="Note" htmlFor="o-note" hint="Optional, shown in activity">
              <TextInput id="o-note" value={note} onChange={setNote} />
            </Field>
            <Btn
              className="w-full"
              disabled={busy || status === order.status}
              onClick={() => run(() => data.setOrderStatus(id, status, note || undefined), "Status updated.")}
            >
              {busy ? "Updating…" : <><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Update status</>}
            </Btn>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-bold text-ink">Payment</h3>
            <Select
              ariaLabel="Payment status"
              value={paymentStatus}
              onChange={setPaymentStatus}
              options={PAYMENT_STATUSES.map((p) => ({ value: p, label: p }))}
            />
            <Btn
              variant="outline"
              className="mt-3 w-full"
              disabled={busy || paymentStatus === order.paymentStatus}
              onClick={() => run(() => data.setOrderPayment(id, paymentStatus), "Payment status saved.")}
            >
              Save payment status
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </Btn>
            <p className="mt-2 text-[11px] text-muted-foreground">
              This is the store's own record. For the live provider figure, use{" "}
              <strong>Refresh status</strong> in the payment panel.
            </p>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-bold text-ink">Tracking</h3>
            <Select
              ariaLabel="Carrier"
              value={carrier}
              onChange={setCarrier}
              options={[{ value: "", label: "Select carrier" }, ...CARRIERS.map((c) => ({ value: c, label: c }))]}
            />
            <TextInput
              aria-label="Tracking number"
              value={tracking}
              onChange={setTracking}
              placeholder="Tracking number"
              className="font-mono"
            />
            <Btn
              variant="outline"
              className="mt-3 w-full"
              disabled={busy}
              onClick={() => run(() => data.setOrderTracking(id, tracking || null, carrier || null), "Tracking saved.")}
            >
              <Truck className="h-4 w-4" /> Save tracking
            </Btn>
          </div>

          <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Save className="h-3.5 w-3.5" /> Changes are recorded in the activity timeline.
          </p>
        </Card>
      </div>

      {/* The panel's only money-moving action, so it is explicitly confirmed. */}
      <ConfirmDialog
        open={confirmRefund}
        title="Refund this order?"
        body={`This returns ${
          raw?.amountCents != null ? `${formatMoney(raw.amountCents)}` : "the full amount"
        } for order ${order.orderNumber} through Bachs, back to the customer's card. A card refund cannot be recalled once it has been sent.`}
        confirmLabel={refundBusy ? "Refunding…" : "Refund now"}
        onConfirm={doRefund}
        onCancel={() => setConfirmRefund(false)}
      />
    </>
  );
}
