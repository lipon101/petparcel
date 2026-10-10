// Customer account area: dashboard, order history, and saved address book.
// Every query here is owner-scoped server-side (ctx.user.id); the client never
// passes a user id, so one account cannot read another's rows.
import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Home,
  MapPin,
  Package,
  Plus,
  Star,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import {
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
  US_STATES,
  formatDate,
  formatMoney,
} from "@shared/store";
import type { StoreAddress, StoreOrder } from "@/lib/types";
import {
  Breadcrumbs,
  CtaLink,
  EmptyState,
  ErrorState,
  LoadingState,
  Section,
  SectionHeading,
} from "@/components/site/Bits";
import { cn } from "@/lib/utils";

// ── Shared bits ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        ORDER_STATUS_CLASS[status] ?? "bg-slate-100 text-slate-700 ring-slate-200",
      )}
    >
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function AccountNav() {
  const items = [
    { to: "/account", label: "Overview", icon: Home },
    { to: "/account/orders", label: "Orders", icon: Package },
    { to: "/account/addresses", label: "Addresses", icon: MapPin },
  ];
  return (
    <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label="Account">
      {items.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="inline-flex shrink-0 items-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </nav>
  );
}

function OrderRow({ order }: { order: StoreOrder }) {
  return (
    <Link
      to={`/order/${order.orderNumber}`}
      className="card-soft flex flex-wrap items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary">
        <Package className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-sm font-semibold">{order.orderNumber}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatDate(order.createdAt)} · {formatMoney(order.totalCents)}
        </span>
      </span>
      <StatusBadge status={order.status} />
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────
export function Account() {
  const { user } = useAuth();
  const { data: orders, isLoading } = trpc.orders.list.useQuery();
  const { data: profile } = trpc.account.profile.useQuery();

  useSeo({
    title: "Your Account",
    description: "Your PetParcel account — orders, tracking and saved addresses.",
    path: "/account",
    noindex: true,
  });

  const list = (orders ?? []) as StoreOrder[];
  const totalSpent = list.reduce((sum, o) => sum + o.totalCents, 0);
  const displayName = profile?.profile?.fullName || user?.email?.split("@")[0] || "there";

  return (
    <AccountShell title="Your account" subtitle={`Signed in as ${user?.email ?? ""}`} active="/account">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Orders placed", value: String(list.length) },
          { label: "Lifetime spend", value: formatMoney(totalSpent) },
          { label: "Saved addresses", value: "—" },
        ].map((s) => (
          <div key={s.label} className="card-soft p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="mt-1.5 text-2xl font-medium">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-medium">Recent orders</h2>
          <Link to="/account/orders" className="text-sm font-semibold text-primary hover:underline">
            View all
          </Link>
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <LoadingState rows={2} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No orders yet"
              body={`Welcome, ${displayName}. Once you place an order it'll appear here with live tracking.`}
              action={<CtaLink to="/shop">Start shopping</CtaLink>}
            />
          ) : (
            list.slice(0, 3).map((o) => <OrderRow key={o.id} order={o} />)
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/account/addresses" className="card-soft flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-secondary text-primary">
            <MapPin className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Manage addresses</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Save addresses to speed up checkout
            </span>
          </span>
        </Link>
        <Link to="/track" className="card-soft flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:shadow-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-secondary text-primary">
            <Package className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">Track a guest order</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Look up an order by number and email
            </span>
          </span>
        </Link>
      </div>
    </AccountShell>
  );
}

// ── Order history ────────────────────────────────────────────────────────────
export function AccountOrders() {
  const { data, isLoading, isError, refetch } = trpc.orders.list.useQuery();

  useSeo({
    title: "Your Orders",
    description: "All your PetParcel orders and their delivery status.",
    path: "/account/orders",
    noindex: true,
  });

  const list = (data ?? []) as StoreOrder[];

  return (
    <AccountShell title="Your orders" subtitle="Every order on this account, newest first." active="/account/orders">
      {isLoading ? (
        <LoadingState rows={4} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load your orders"
          body="A quick retry usually sorts this out. If it keeps happening, contact support and we'll look it up for you."
          onRetry={() => refetch()}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No orders yet"
          body="When you place your first order it'll show up here with its live delivery status."
          action={<CtaLink to="/shop">Browse the catalog</CtaLink>}
        />
      ) : (
        <div className="space-y-3">
          {list.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </div>
      )}
    </AccountShell>
  );
}

// ── Address book ─────────────────────────────────────────────────────────────
interface AddressDraft {
  label: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  isDefaultShipping: boolean;
}

const emptyDraft: AddressDraft = {
  label: "",
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  phone: "",
  isDefaultShipping: true,
};

const field =
  "mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AccountAddresses() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.account.addresses.useQuery();
  const [draft, setDraft] = useState<AddressDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => {
    utils.account.addresses.invalidate();
    utils.account.defaultAddress.invalidate();
  };

  const create = trpc.account.addAddress.useMutation({
    onSuccess: () => {
      invalidate();
      setDraft(null);
    },
  });
  const update = trpc.account.updateAddress.useMutation({
    onSuccess: () => {
      invalidate();
      setDraft(null);
      setEditingId(null);
    },
  });
  const remove = trpc.account.deleteAddress.useMutation({ onSuccess: invalidate });
  const makeDefault = trpc.account.updateAddress.useMutation({ onSuccess: invalidate });

  useSeo({
    title: "Your Addresses",
    description: "Manage your saved shipping and billing addresses.",
    path: "/account/addresses",
    noindex: true,
  });

  const list = (data ?? []) as StoreAddress[];

  const startEdit = (a: StoreAddress) => {
    setEditingId(a.id);
    setDraft({
      label: a.label ?? "",
      fullName: a.fullName,
      line1: a.line1,
      line2: a.line2 ?? "",
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      phone: a.phone ?? "",
      isDefaultShipping: a.isDefaultShipping,
    });
  };

  const save = () => {
    if (!draft) return;
    const payload = {
      label: draft.label || undefined,
      fullName: draft.fullName,
      line1: draft.line1,
      line2: draft.line2 || undefined,
      city: draft.city,
      state: draft.state,
      postalCode: draft.postalCode,
      country: "US",
      phone: draft.phone || undefined,
      isDefaultShipping: draft.isDefaultShipping,
      isDefaultBilling: draft.isDefaultShipping,
    };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
  };

  const busy = create.isPending || update.isPending;

  return (
    <AccountShell
      title="Your addresses"
      subtitle="Saved addresses fill in automatically at checkout."
      active="/account/addresses"
    >
      {isLoading ? (
        <LoadingState rows={3} />
      ) : (
        <div className="space-y-4">
          {list.length === 0 && !draft && (
            <EmptyState
              icon={<MapPin className="h-6 w-6" />}
              title="No saved addresses"
              body="Add a shipping address once and checkout becomes a two-click job."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(emptyDraft);
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> Add an address
                </button>
              }
            />
          )}

          {list.map((a) => (
            <div key={a.id} className="card-soft flex flex-wrap items-start gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-secondary text-primary">
                <MapPin className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {a.label || "Address"}
                  {a.isDefaultShipping && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  )}
                </p>
                <address className="mt-1 text-sm not-italic text-muted-foreground">
                  <span className="block font-semibold text-foreground">{a.fullName}</span>
                  <span className="block">{a.line1}</span>
                  {a.line2 && <span className="block">{a.line2}</span>}
                  <span className="block">
                    {a.city}, {a.state} {a.postalCode}
                  </span>
                  {a.phone && <span className="block">{a.phone}</span>}
                </address>
              </div>
              <div className="flex flex-wrap gap-2">
                {!a.isDefaultShipping && (
                  <button
                    type="button"
                    onClick={() =>
                      makeDefault.mutate({
                        id: a.id,
                        label: a.label ?? undefined,
                        fullName: a.fullName,
                        line1: a.line1,
                        line2: a.line2,
                        city: a.city,
                        state: a.state,
                        postalCode: a.postalCode,
                        country: a.country,
                        phone: a.phone,
                        isDefaultShipping: true,
                        isDefaultBilling: true,
                      })
                    }
                    className="inline-flex h-9 items-center rounded-full border border-input px-4 text-xs font-semibold hover:bg-secondary"
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startEdit(a)}
                  className="inline-flex h-9 items-center rounded-full border border-input px-4 text-xs font-semibold hover:bg-secondary"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate({ id: a.id })}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label={`Delete ${a.label || "address"}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {draft ? (
            <div className="card-soft p-6">
              <h2 className="text-lg font-medium">{editingId ? "Edit address" : "Add an address"}</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold" htmlFor="addr-label">
                    Label <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="addr-label"
                    value={draft.label}
                    onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    placeholder="Home, Office…"
                    className={field}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold" htmlFor="addr-name">
                    Full name
                  </label>
                  <input
                    id="addr-name"
                    required
                    value={draft.fullName}
                    onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                    className={field}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold" htmlFor="addr-line1">
                    Street address
                  </label>
                  <input
                    id="addr-line1"
                    required
                    value={draft.line1}
                    onChange={(e) => setDraft({ ...draft, line1: e.target.value })}
                    className={field}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold" htmlFor="addr-line2">
                    Apartment, suite, etc. <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="addr-line2"
                    value={draft.line2}
                    onChange={(e) => setDraft({ ...draft, line2: e.target.value })}
                    className={field}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="addr-city">
                    City
                  </label>
                  <input
                    id="addr-city"
                    required
                    value={draft.city}
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                    className={field}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="addr-state">
                    State
                  </label>
                  <select
                    id="addr-state"
                    required
                    value={draft.state}
                    onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                    className={field}
                  >
                    <option value="">Select…</option>
                    {US_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="addr-zip">
                    ZIP code
                  </label>
                  <input
                    id="addr-zip"
                    required
                    inputMode="numeric"
                    value={draft.postalCode}
                    onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })}
                    className={field}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold" htmlFor="addr-phone">
                    Phone <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    id="addr-phone"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    className={field}
                  />
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isDefaultShipping}
                  onChange={(e) => setDraft({ ...draft, isDefaultShipping: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                Use as my default shipping address
              </label>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={save}
                  disabled={busy || !draft.fullName || !draft.line1 || !draft.city || !draft.state || !draft.postalCode}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {busy ? "Saving…" : editingId ? "Save changes" : "Add address"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null);
                    setEditingId(null);
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-input px-6 text-sm font-semibold hover:bg-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            list.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft);
                }}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> Add another address
              </button>
            )
          )}
        </div>
      )}
    </AccountShell>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
export function AccountShell({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle?: string;
  active: string;
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  return (
    <Section className="!pt-8">
      <Breadcrumbs
        trail={[
          { label: "Home", to: "/" },
          { label: "Account", to: "/account" },
          ...(active === "/account" ? [] : [{ label: title.replace("Your ", "") }]),
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <div className="card-soft mb-4 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
                <UserIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {user?.email?.split("@")[0] ?? "Account"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
              </span>
            </div>
          </div>
          <AccountNav />
        </aside>

        <div className="min-w-0">
          <SectionHeading title={title} subtitle={subtitle} />
          {children}
        </div>
      </div>
    </Section>
  );
}
