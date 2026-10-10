// Admin panel: dashboard, products + variant editor, orders + fulfilment,
// customers, inventory and store settings. Every query and mutation goes through
// the admin-gated routers (adminProcedure), so the guard below only decides what
// to render — the server is the real authority on who may read or write.
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Boxes,
  DollarSign,
  Mail,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  ShoppingCart,
  Trash2,
  Truck,
  Users,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { currentOrigin, useSeo } from "@/lib/petparcel";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  formatDate,
  formatDateTime,
  formatMoney,
  parseDollarsToCents,
  slugify,
  type OrderStatus,
} from "@shared/store";
import type { StoreEmailLog, StoreOrder, StoreOrderDetail, StoreProduct } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState, Section, SectionHeading } from "@/components/site/Bits";
import { ImageUploader } from "@/components/site/ImageUploader";
import { StatusBadge } from "@/pages/Account";
import { cn } from "@/lib/utils";

/** Client-side low-stock marker. The dashboard's own low-stock list is the
 *  authoritative one; this keeps the inventory table readable at a glance. */
const LOW_STOCK_AT = 5;

function skuFor(name: string, existing: string): string {
  const trimmed = existing.trim();
  if (trimmed) return trimmed;
  const base = (slugify(name) || "variant").toUpperCase().slice(0, 12);
  return `${base}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ── Shell ────────────────────────────────────────────────────────────────────
function AdminShell({
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
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Section className="!pt-8">
        <LoadingState rows={4} />
      </Section>
    );
  }

  if (!user) {
    return (
      <Section className="!pt-8">
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Sign in required"
          body="The admin panel is only available to store staff. Sign in with an admin account to continue."
        />
        <div className="mt-4 flex justify-center">
          <Link
            to="/login?next=/admin"
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Sign in
          </Link>
        </div>
      </Section>
    );
  }

  const isAdmin = user.role === "admin";
  if (!isAdmin) {
    return (
      <Section className="!pt-8">
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Admin access required"
          body="This account doesn't have admin permissions. If that's unexpected, ask the store owner to promote it."
        />
        <div className="mt-4 flex justify-center">
          <Link
            to="/"
            className="inline-flex h-11 items-center rounded-full border border-input px-6 text-sm font-semibold"
          >
            Back to store
          </Link>
        </div>
      </Section>
    );
  }

  const nav = [
    { to: "/admin", label: "Dashboard", icon: BarChart3 },
    { to: "/admin/products", label: "Products", icon: Package },
    { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { to: "/admin/customers", label: "Customers", icon: Users },
    { to: "/admin/inventory", label: "Inventory", icon: Boxes },
    { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <Section className="!pt-8">
      <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
        <aside>
          <div className="mb-4 rounded-2xl bg-primary p-4 text-primary-foreground">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">Admin</p>
            <p className="mt-0.5 truncate text-sm font-extrabold">PetParcel</p>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col" aria-label="Admin">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                  active === to
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </nav>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to storefront
          </Link>
        </aside>

        <div className="min-w-0">
          <SectionHeading title={title} subtitle={subtitle} />
          {children}
        </div>
      </div>
    </Section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  hint?: string;
}) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export function AdminDashboard() {
  const { data, isLoading, isError, refetch } = trpc.admin.stats.useQuery();

  useSeo({ title: "Admin Dashboard", description: "Store overview.", path: "/admin", noindex: true });

  return (
    <AdminShell title="Dashboard" subtitle="Revenue, orders and fulfilment at a glance." active="/admin">
      {isLoading ? (
        <LoadingState rows={3} />
      ) : isError || !data ? (
        <ErrorState
          title="We couldn't load the dashboard"
          body="A quick retry usually sorts this out."
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Revenue (paid)"
              value={formatMoney(data.revenueCents)}
              icon={DollarSign}
              hint={`${data.orderCount} order${data.orderCount === 1 ? "" : "s"} placed`}
            />
            <Metric
              label="Open orders"
              value={String(data.openOrders)}
              icon={ShoppingCart}
              hint="Not yet delivered or cancelled"
            />
            <Metric label="Customers" value={String(data.customerCount)} icon={Users} />
            <Metric
              label="Product reviews"
              value={String(data.reviewCount)}
              icon={MessageSquare}
              hint={`${data.lowStock.length} variant${data.lowStock.length === 1 ? "" : "s"} low on stock`}
            />
          </div>

          {data.lowStock.length > 0 && (
            <div className="mt-8">
              <h2 className="flex items-center gap-2 text-lg font-extrabold">
                <AlertTriangle className="h-5 w-5 text-amber-600" /> Low stock
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Variants at or below the store's low-stock threshold — restock before they sell out.
              </p>
              <div className="mt-4 space-y-2">
                {data.lowStock.map((row) => (
                  <div key={row.id} className="card-soft flex flex-wrap items-center gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{row.productName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.name} · SKU {row.sku}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset",
                        row.inventoryQty <= 0
                          ? "bg-rose-100 text-rose-700 ring-rose-200"
                          : "bg-amber-100 text-amber-800 ring-amber-200",
                      )}
                    >
                      {row.inventoryQty} left
                    </span>
                    <Link
                      to="/admin/inventory"
                      className="inline-flex h-9 items-center rounded-full border border-input px-4 text-xs font-semibold hover:bg-secondary"
                    >
                      Restock
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-extrabold">Recent orders</h2>
            {data.recentOrders.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<ShoppingCart className="h-6 w-6" />}
                  title="No orders yet"
                  body="As soon as a customer checks out, the order appears here for fulfilment."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {data.recentOrders.map((o) => (
                  <Link
                    key={o.id}
                    to={`/admin/orders/${o.id}`}
                    className="card-soft flex flex-wrap items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-bold">{o.orderNumber}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.email} · {formatDate(o.createdAt)}
                      </span>
                    </span>
                    <span className="text-sm font-extrabold">{formatMoney(o.totalCents)}</span>
                    <StatusBadge status={o.status} />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {data.topProducts.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-extrabold">Best sellers</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.topProducts.map((p) => (
                  <Link
                    key={p.name}
                    to={p.slug ? `/product/${p.slug}` : "/shop"}
                    className="card-soft flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg">
                      🐾
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{p.name}</span>
                      <span className="block text-xs text-muted-foreground">{p.units} sold</span>
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">{formatMoney(p.revenue)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}

// ── Products list ────────────────────────────────────────────────────────────
/** Full-product payload for a partial update — the update endpoint replaces the
 *  whole record, so toggles must resend every field or they'd wipe the rest. */
function productPayload(p: StoreProduct, overrides: Partial<StoreProduct> = {}) {
  const next = { ...p, ...overrides };
  return {
    id: next.id,
    name: next.name,
    slug: next.slug,
    description: next.description,
    category: next.category,
    priceCents: next.priceCents,
    compareAtCents: next.compareAtCents ?? null,
    images: next.images,
    tags: next.tags,
    active: next.active,
    featured: next.featured,
    sortOrder: next.sortOrder,
  };
}

export function AdminProducts() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.products.useQuery();
  const [busyId, setBusyId] = useState<string | null>(null);

  const invalidate = () => {
    utils.admin.products.invalidate();
    utils.admin.stats.invalidate();
    utils.catalog.list.invalidate();
    utils.catalog.featured.invalidate();
    utils.catalog.categories.invalidate();
  };

  const create = trpc.admin.createProduct.useMutation({
    onSuccess: (created) => {
      invalidate();
      window.location.href = `/admin/products/${created.id}`;
    },
  });
  const remove = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => {
      invalidate();
      setBusyId(null);
    },
  });
  const save = trpc.admin.updateProduct.useMutation({ onSuccess: invalidate });

  useSeo({ title: "Admin — Products", description: "Manage the catalog.", path: "/admin/products", noindex: true });

  const list = (data ?? []) as unknown as StoreProduct[];

  return (
    <AdminShell
      title="Products"
      subtitle="Everything the storefront shows comes from here — nothing is hardcoded."
      active="/admin/products"
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={create.isPending}
          onClick={() =>
            create.mutate({
              name: "New product",
              category: "Dogs",
              description: "Describe this product for customers.",
              priceCents: 2999,
              images: [],
              active: false,
              featured: false,
            })
          }
          className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {create.isPending ? "Creating…" : "New product"}
        </button>
        <p className="text-xs text-muted-foreground">
          New products start hidden until you add a price, image and stock.
        </p>
      </div>
      {create.isError && (
        <p className="mb-4 text-sm font-semibold text-destructive">{create.error.message}</p>
      )}

      {isLoading ? (
        <LoadingState rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No products yet"
          body="Create your first product to start selling. You can add variants (sizes, colors) and stock on the product page."
        />
      ) : (
        <div className="space-y-2">
          {list.map((p) => {
            const stock = p.variants.reduce((sum, v) => sum + v.inventoryQty, 0);
            return (
              <div key={p.id} className="card-soft flex flex-wrap items-center gap-4 p-4">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xl">🐾</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    to={`/admin/products/${p.id}`}
                    className="block truncate text-sm font-bold hover:text-primary hover:underline"
                  >
                    {p.name}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {p.category} · {p.variants.length} variant{p.variants.length === 1 ? "" : "s"} · {stock} in
                    stock
                  </span>
                </span>
                <span className="text-sm font-extrabold">{formatMoney(p.priceCents)}</span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => save.mutate(productPayload(p, { active: !p.active }))}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset",
                      p.active
                        ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200",
                    )}
                  >
                    {p.active ? "Live" : "Hidden"}
                  </button>
                  <button
                    type="button"
                    onClick={() => save.mutate(productPayload(p, { featured: !p.featured }))}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset",
                      p.featured
                        ? "bg-accent/15 text-accent ring-accent/30"
                        : "bg-slate-100 text-slate-600 ring-slate-200",
                    )}
                  >
                    {p.featured ? "Featured" : "Not featured"}
                  </button>
                  <Link
                    to={`/admin/products/${p.id}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input px-3.5 text-xs font-semibold hover:bg-secondary"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => {
                      if (window.confirm(`Delete “${p.name}”? This cannot be undone.`)) {
                        setBusyId(p.id);
                        remove.mutate({ id: p.id });
                      }
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${p.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}

// ── Product editor ───────────────────────────────────────────────────────────
interface VariantRow {
  id?: string;
  name: string;
  sku: string;
  price: string;
  inventoryQty: string;
  active: boolean;
}

export function AdminProductEditor() {
  const utils = trpc.useUtils();
  // The id comes from the URL segment (this path mixes static and dynamic parts).
  const id = useMemo(() => window.location.pathname.match(/\/admin\/products\/([^/]+)/)?.[1] ?? "", []);

  const { data: product, isLoading } = trpc.admin.product.useQuery({ id }, { enabled: Boolean(id) });

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [imagesText, setImagesText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [active, setActive] = useState(false);
  const [featured, setFeatured] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saved, setSaved] = useState(false);

  // The gallery IS the product's image list. Deriving it from the same text
  // field the URL box writes to keeps uploads and pasted URLs one array, with
  // no second source of truth to drift out of sync.
  const images = useMemo(
    () =>
      imagesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    [imagesText],
  );
  const setImages = (next: string[]) => setImagesText(next.join("\n"));

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setCategory(product.category);
    setDescription(product.description);
    setPrice((product.priceCents / 100).toFixed(2));
    setCompareAt(product.compareAtCents ? (product.compareAtCents / 100).toFixed(2) : "");
    setImagesText(product.images.join("\n"));
    setTagsText(product.tags.join(", "));
    setActive(product.active);
    setFeatured(product.featured);
    setVariants(
      product.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: (v.priceCents / 100).toFixed(2),
        inventoryQty: String(v.inventoryQty),
        active: v.active,
      })),
    );
  }, [product?.id, product?.updatedAt]);

  const invalidate = () => {
    utils.admin.product.invalidate({ id });
    utils.admin.products.invalidate();
    utils.admin.inventory.invalidate();
    utils.admin.stats.invalidate();
    utils.catalog.list.invalidate();
    utils.catalog.featured.invalidate();
  };

  const updateProduct = trpc.admin.updateProduct.useMutation({
    onSuccess: () => {
      invalidate();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    },
  });
  const createVariant = trpc.admin.createVariant.useMutation({ onSuccess: invalidate });
  const updateVariant = trpc.admin.updateVariant.useMutation({ onSuccess: invalidate });
  const deleteVariant = trpc.admin.deleteVariant.useMutation({ onSuccess: invalidate });

  useSeo({
    title: product ? `Admin — ${product.name}` : "Admin — Product",
    description: "Edit a product.",
    path: `/admin/products/${id}`,
    noindex: true,
  });

  if (isLoading) {
    return (
      <AdminShell title="Product" active="/admin/products">
        <LoadingState rows={4} />
      </AdminShell>
    );
  }

  if (!product) {
    return (
      <AdminShell title="Product" active="/admin/products">
        <EmptyState
          title="Product not found"
          body="It may have been deleted. Head back to the products list."
          action={
            <Link
              to="/admin/products"
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
            >
              Back to products
            </Link>
          }
        />
      </AdminShell>
    );
  }

  const fieldCls =
    "mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  const areaCls =
    "mt-1.5 w-full rounded-xl border border-input bg-card p-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

  const saveDetails = () => {
    updateProduct.mutate({
      id,
      name,
      slug: product.slug,
      description,
      category,
      priceCents: parseDollarsToCents(price) ?? 0,
      compareAtCents: compareAt ? parseDollarsToCents(compareAt) : null,
      images: imagesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      tags: tagsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      active,
      featured,
      sortOrder: product.sortOrder,
    });
  };

  const saveVariant = (row: VariantRow) => {
    const base = {
      name: row.name,
      sku: skuFor(row.name, row.sku),
      priceCents: parseDollarsToCents(row.price) ?? 0,
      inventoryQty: Math.max(0, Number(row.inventoryQty) || 0),
      active: row.active,
      sortOrder: 0,
    };
    if (row.id) updateVariant.mutate({ id: row.id, ...base });
    else createVariant.mutate({ productId: id, ...base });
  };

  const variantError = createVariant.error?.message ?? updateVariant.error?.message;

  return (
    <AdminShell title={product.name} subtitle="Product details, images and variants." active="/admin/products">
      <div className="mb-5">
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All products
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Details */}
        <div className="card-soft p-6">
          <h2 className="text-lg font-extrabold">Details</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold" htmlFor="p-name">
                Name
              </label>
              <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold" htmlFor="p-cat">
                  Category
                </label>
                <input id="p-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={fieldCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold" htmlFor="p-price">
                  Price (USD)
                </label>
                <input
                  id="p-price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold" htmlFor="p-compare">
                  Compare-at (USD)
                </label>
                <input
                  id="p-compare"
                  inputMode="decimal"
                  value={compareAt}
                  onChange={(e) => setCompareAt(e.target.value)}
                  placeholder="Optional"
                  className={fieldCls}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="p-desc">
                Description
              </label>
              <textarea
                id="p-desc"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={areaCls}
              />
            </div>
            <div>
              <span className="block text-sm font-semibold">Product images</span>
              <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
                Upload your own photos, or paste image URLs. The first image is the main catalogue photo.
              </p>
              <ImageUploader images={images} onChange={setImages} />
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="p-tags">
                Tags <span className="font-normal text-muted-foreground">(comma separated)</span>
              </label>
              <input id="p-tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={fieldCls} />
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Live on storefront
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Feature on home page
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <button
                type="button"
                onClick={saveDetails}
                disabled={updateProduct.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" /> {updateProduct.isPending ? "Saving…" : "Save product"}
              </button>
              {saved && <span className="text-sm font-semibold text-emerald-700">Saved ✓</span>}
              {updateProduct.isError && (
                <span className="text-sm font-semibold text-destructive">{updateProduct.error.message}</span>
              )}
            </div>
          </div>
        </div>

        {/* Variants + preview */}
        <div className="space-y-6">
          <div className="card-soft p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold">Variants &amp; stock</h2>
              <button
                type="button"
                onClick={() =>
                  setVariants((rows) => [
                    ...rows,
                    { name: "New variant", sku: "", price, inventoryQty: "0", active: true },
                  ])
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input px-3.5 text-xs font-semibold hover:bg-secondary"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Each variant has its own price and stock. Customers pick one at checkout. A blank SKU is generated
              for you.
            </p>

            {variantError && (
              <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                {variantError}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {variants.length === 0 && (
                <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                  No variants — the product sells at its base price with no options.
                </p>
              )}
              {variants.map((row, i) => (
                <div key={row.id ?? `new-${i}`} className="rounded-xl border border-border p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      aria-label="Variant name"
                      value={row.name}
                      onChange={(e) =>
                        setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                      }
                      className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
                      placeholder="Name (e.g. Large)"
                    />
                    <input
                      aria-label="SKU"
                      value={row.sku}
                      onChange={(e) =>
                        setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, sku: e.target.value } : r)))
                      }
                      className="h-10 rounded-lg border border-input bg-card px-3 font-mono text-sm"
                      placeholder="SKU (auto if blank)"
                    />
                    <input
                      aria-label="Price"
                      inputMode="decimal"
                      value={row.price}
                      onChange={(e) =>
                        setVariants((rows) => rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))
                      }
                      className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
                      placeholder="Price"
                    />
                    <input
                      aria-label="Inventory quantity"
                      inputMode="numeric"
                      value={row.inventoryQty}
                      onChange={(e) =>
                        setVariants((rows) =>
                          rows.map((r, j) => (j === i ? { ...r, inventoryQty: e.target.value } : r)),
                        )
                      }
                      className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
                      placeholder="Stock"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="checkbox"
                        checked={row.active}
                        onChange={(e) =>
                          setVariants((rows) =>
                            rows.map((r, j) => (j === i ? { ...r, active: e.target.checked } : r)),
                          )
                        }
                        className="h-4 w-4 rounded border-input"
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      onClick={() => saveVariant(row)}
                      disabled={createVariant.isPending || updateVariant.isPending}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      <Save className="h-3.5 w-3.5" /> Save
                    </button>
                    {row.id && (
                      <button
                        type="button"
                        onClick={() => deleteVariant.mutate({ id: row.id as string })}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input px-3.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-soft p-6">
            <h2 className="text-lg font-extrabold">Preview</h2>
            <p className="mt-1 text-xs text-muted-foreground">How this product appears in the catalog.</p>
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="aspect-square bg-muted">
                {imagesText
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)[0] ? (
                  <img
                    src={imagesText.split("\n").map((s) => s.trim()).filter(Boolean)[0]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl">🐾</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{category}</p>
                <p className="mt-0.5 text-sm font-bold">{name}</p>
                <p className="mt-1 text-sm font-extrabold">{formatMoney(parseDollarsToCents(price) ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// ── Orders list ──────────────────────────────────────────────────────────────
export function AdminOrders() {
  const [status, setStatus] = useState<string>("");
  const { data, isLoading } = trpc.admin.orders.useQuery(status ? { status } : undefined);

  useSeo({ title: "Admin — Orders", description: "Fulfil orders.", path: "/admin/orders", noindex: true });

  const list = (data ?? []) as unknown as StoreOrder[];

  return (
    <AdminShell title="Orders" subtitle="Update payment, fulfilment and tracking." active="/admin/orders">
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatus("")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm font-semibold",
            status === ""
              ? "bg-primary text-primary-foreground"
              : "bg-card ring-1 ring-inset ring-border hover:bg-secondary",
          )}
        >
          All
        </button>
        {ORDER_STATUSES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatus(st)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold",
              status === st
                ? "bg-primary text-primary-foreground"
                : "bg-card ring-1 ring-inset ring-border hover:bg-secondary",
            )}
          >
            {ORDER_STATUS_LABEL[st]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title={status ? `No ${ORDER_STATUS_LABEL[status]?.toLowerCase()} orders` : "No orders yet"}
          body="Orders land here the moment a customer completes checkout."
        />
      ) : (
        <div className="space-y-2">
          {list.map((o) => (
            <Link
              key={o.id}
              to={`/admin/orders/${o.id}`}
              className="card-soft flex flex-wrap items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-sm font-bold">{o.orderNumber}</span>
                <span className="block text-xs text-muted-foreground">
                  {o.email} · {formatDateTime(o.createdAt)}
                </span>
              </span>
              <span className="text-sm font-extrabold">{formatMoney(o.totalCents)}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset",
                  o.paymentStatus === "paid"
                    ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-slate-200",
                )}
              >
                {o.paymentStatus}
              </span>
              <StatusBadge status={o.status} />
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}

// ── Order detail ─────────────────────────────────────────────────────────────
export function AdminOrderDetail() {
  const utils = trpc.useUtils();
  const id = useMemo(() => window.location.pathname.match(/\/admin\/orders\/([^/]+)/)?.[1] ?? "", []);

  const { data, isLoading, isError, refetch } = trpc.admin.order.useQuery({ id }, { enabled: Boolean(id) });

  const [status, setStatus] = useState<OrderStatus>("pending");
  const [note, setNote] = useState("");
  const [trackingNumberInput, setTrackingNumberInput] = useState("");
  const [carrierInput, setCarrierInput] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");

  const detail = data as unknown as StoreOrderDetail | undefined;
  const order = detail?.order;

  useEffect(() => {
    if (!order) return;
    setStatus(order.status as OrderStatus);
    setPaymentStatus(order.paymentStatus);
    setTrackingNumberInput(order.trackingNumber ?? "");
    setCarrierInput(order.carrier ?? "");
  }, [order?.id, order?.updatedAt]);

  const invalidate = () => {
    utils.admin.order.invalidate({ id });
    utils.admin.orders.invalidate();
    utils.admin.stats.invalidate();
  };

  const statusMutation = trpc.admin.setOrderStatus.useMutation({
    onSuccess: () => {
      invalidate();
      setNote("");
    },
  });
  const paymentMutation = trpc.admin.setPaymentStatus.useMutation({ onSuccess: invalidate });
  const trackingMutation = trpc.admin.setTracking.useMutation({ onSuccess: invalidate });
  const resendEmail = trpc.admin.resendOrderEmail.useMutation({ onSuccess: invalidate });

  useSeo({ title: "Admin — Order", description: "Order detail.", path: `/admin/orders/${id}`, noindex: true });

  if (isLoading) {
    return (
      <AdminShell title="Order" active="/admin/orders">
        <LoadingState rows={4} />
      </AdminShell>
    );
  }

  if (isError || !order) {
    return (
      <AdminShell title="Order" active="/admin/orders">
        <ErrorState
          title="We couldn't load that order"
          body="A quick retry usually sorts this out."
          onRetry={() => refetch()}
        />
        <div className="mt-4">
          <Link to="/admin/orders" className="text-sm font-semibold text-primary hover:underline">
            Back to orders
          </Link>
        </div>
      </AdminShell>
    );
  }

  const items = detail?.items ?? [];
  const events = detail?.events ?? [];
  const emails: StoreEmailLog[] = detail?.emails ?? [];

  const fieldCls =
    "mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <AdminShell title={`Order ${order.orderNumber}`} active="/admin/orders">
      <div className="mb-5">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All orders
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="card-soft p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Placed</p>
                <p className="text-sm font-semibold">{formatDateTime(order.createdAt)}</p>
              </div>
              <StatusBadge status={order.status} />
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset",
                  order.paymentStatus === "paid"
                    ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                    : "bg-slate-100 text-slate-600 ring-slate-200",
                )}
              >
                {order.paymentStatus}
              </span>
            </div>

            <ul className="mt-5 space-y-3 border-t border-border pt-5">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.nameSnapshot}</span>
                    {item.variantSnapshot && (
                      <span className="block text-xs text-muted-foreground">{item.variantSnapshot}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">×{item.qty}</span>
                  <span className="font-bold">{formatMoney(item.priceCents * item.qty)}</span>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-semibold">{formatMoney(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-semibold">{formatMoney(order.shippingCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd className="font-semibold">{formatMoney(order.taxCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-extrabold">{formatMoney(order.totalCents)}</dd>
              </div>
            </dl>
          </div>

          <div className="card-soft p-6">
            <h2 className="text-lg font-extrabold">Activity</h2>
            {events.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No status changes recorded yet.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span>
                      <span className="font-semibold">{ORDER_STATUS_LABEL[e.status] ?? e.status}</span>
                      {e.note && <span className="text-muted-foreground"> — {e.note}</span>}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatDateTime(e.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card-soft p-6">
            <h2 className="text-lg font-extrabold">Customer &amp; addresses</h2>
            <p className="mt-2 text-sm">
              <strong>{order.email}</strong>
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Shipping</p>
                <address className="mt-1.5 text-sm not-italic text-muted-foreground">
                  <span className="block font-semibold text-foreground">{order.shippingAddress.fullName}</span>
                  <span className="block">{order.shippingAddress.line1}</span>
                  {order.shippingAddress.line2 && <span className="block">{order.shippingAddress.line2}</span>}
                  <span className="block">
                    {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                    {order.shippingAddress.postalCode}
                  </span>
                  {order.shippingAddress.phone && <span className="block">{order.shippingAddress.phone}</span>}
                </address>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Billing</p>
                <address className="mt-1.5 text-sm not-italic text-muted-foreground">
                  <span className="block font-semibold text-foreground">{order.billingAddress.fullName}</span>
                  <span className="block">{order.billingAddress.line1}</span>
                  {order.billingAddress.line2 && <span className="block">{order.billingAddress.line2}</span>}
                  <span className="block">
                    {order.billingAddress.city}, {order.billingAddress.state}{" "}
                    {order.billingAddress.postalCode}
                  </span>
                </address>
              </div>
            </div>
            {order.notes && (
              <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm">
                <strong>Customer note:</strong> {order.notes}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="card-soft h-fit p-6">
          <h2 className="text-lg font-extrabold">Fulfilment</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-semibold" htmlFor="o-status">
                Order status
              </label>
              <select
                id="o-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className={fieldCls}
              >
                {ORDER_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {ORDER_STATUS_LABEL[st]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold" htmlFor="o-note">
                Note <span className="font-normal text-muted-foreground">(optional, shown in activity)</span>
              </label>
              <input id="o-note" value={note} onChange={(e) => setNote(e.target.value)} className={fieldCls} />
            </div>
            <button
              type="button"
              disabled={statusMutation.isPending || status === order.status}
              onClick={() => statusMutation.mutate({ id, status, note: note || undefined })}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {statusMutation.isPending ? "Updating…" : "Update status"}
            </button>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-bold">Payment</h3>
            <select
              aria-label="Payment status"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className={fieldCls}
            >
              {["unpaid", "paid", "failed", "refunded"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={paymentMutation.isPending || paymentStatus === order.paymentStatus}
              onClick={() =>
                paymentMutation.mutate({
                  id,
                  paymentStatus: paymentStatus as "unpaid" | "paid" | "failed" | "refunded",
                })
              }
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-full border border-input px-5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
            >
              Save payment status
            </button>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-bold">Tracking</h3>
            <input
              aria-label="Carrier"
              value={carrierInput}
              onChange={(e) => setCarrierInput(e.target.value)}
              placeholder="Carrier (e.g. USPS)"
              className={fieldCls}
            />
            <input
              aria-label="Tracking number"
              value={trackingNumberInput}
              onChange={(e) => setTrackingNumberInput(e.target.value)}
              placeholder="Tracking number"
              className={`${fieldCls} font-mono`}
            />
            <button
              type="button"
              disabled={trackingMutation.isPending}
              onClick={() =>
                trackingMutation.mutate({
                  id,
                  trackingNumber: trackingNumberInput || null,
                  carrier: carrierInput || null,
                  // Saving tracking on an unshipped order IS the "shipped" event,
                  // so the shipping notification fires from here.
                  markShipped: true,
                  origin: currentOrigin(),
                })
              }
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-input px-5 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
            >
              <Truck className="h-4 w-4" /> Save tracking
            </button>
            {trackingMutation.data?.emailStatus && (
              <p
                role="status"
                className={cn(
                  "mt-3 rounded-xl p-3 text-xs font-semibold",
                  trackingMutation.data.emailStatus === "sent"
                    ? "bg-emerald-50 text-emerald-800"
                    : trackingMutation.data.emailStatus === "skipped"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-destructive/5 text-destructive",
                )}
              >
                {trackingMutation.data.emailStatus === "sent"
                  ? "Shipping notification sent to the customer ✓"
                  : trackingMutation.data.emailStatus === "skipped"
                    ? `Shipping email skipped — ${trackingMutation.data.emailReason ?? "no email key configured."}`
                    : `Shipping email failed — ${trackingMutation.data.emailReason ?? "unknown error."}`}
              </p>
            )}
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <Mail className="h-4 w-4 text-primary" /> Customer emails
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              The order confirmation sends automatically when an order is placed. The shipping
              notification sends when you save a tracking number on an order that hasn't shipped yet.
            </p>

            {resendEmail.data && (
              <p
                role="status"
                className={cn(
                  "mt-3 rounded-xl p-3 text-xs font-semibold",
                  resendEmail.data.status === "sent"
                    ? "bg-emerald-50 text-emerald-800"
                    : resendEmail.data.status === "skipped"
                      ? "bg-amber-50 text-amber-800"
                      : "bg-destructive/5 text-destructive",
                )}
              >
                {resendEmail.data.status === "sent"
                  ? `${resendEmail.data.kindLabel} sent ✓`
                  : `Not sent — ${resendEmail.data.reason ?? "unknown reason."}`}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={resendEmail.isPending}
                onClick={() =>
                  resendEmail.mutate({
                    orderId: id,
                    kind: "order_confirmation",
                    origin: currentOrigin(),
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input px-3.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", resendEmail.isPending && "animate-spin")} />
                Resend confirmation
              </button>
              <button
                type="button"
                disabled={resendEmail.isPending}
                onClick={() =>
                  resendEmail.mutate({
                    orderId: id,
                    kind: "shipping_notification",
                    origin: currentOrigin(),
                  })
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-input px-3.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Resend shipping
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {emails.length === 0 ? (
                <li className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                  No emails recorded for this order yet.
                </li>
              ) : (
                emails.map((e) => (
                  <li key={e.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold">{e.subject}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
                          e.status === "sent"
                            ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                            : e.status === "skipped"
                              ? "bg-amber-100 text-amber-800 ring-amber-200"
                              : "bg-rose-100 text-rose-700 ring-rose-200",
                        )}
                      >
                        {e.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      To {e.toEmail} · {formatDateTime(e.createdAt)}
                    </p>
                    {e.error && <p className="mt-1 text-[11px] text-destructive">{e.error}</p>}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// ── Customers ────────────────────────────────────────────────────────────────
export function AdminCustomers() {
  const { data, isLoading } = trpc.admin.customers.useQuery();

  useSeo({ title: "Admin — Customers", description: "Customer list.", path: "/admin/customers", noindex: true });

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    email: string;
    name: string | null;
    fullName: string | null;
    phone: string | null;
    orderCount: number;
    spendCents: number;
    createdAt: Date | string;
  }>;

  return (
    <AdminShell
      title="Customers"
      subtitle="Everyone who has placed an order, with lifetime value."
      active="/admin/customers"
    >
      {isLoading ? (
        <LoadingState rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No customers yet"
          body="Customers appear here after their first order — guest checkouts included."
        />
      ) : (
        <div className="card-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left">
                <tr>
                  <th className="px-4 py-3 font-bold">Customer</th>
                  <th className="px-4 py-3 font-bold">Email</th>
                  <th className="px-4 py-3 text-right font-bold">Orders</th>
                  <th className="px-4 py-3 text-right font-bold">Spend</th>
                  <th className="px-4 py-3 text-right font-bold">First seen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={`${c.id}-${c.email}`} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">
                      {c.fullName ?? c.name ?? "—"}
                      {!c.id && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                          guest
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email}</td>
                    <td className="px-4 py-3 text-right">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatMoney(c.spendCents)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

// ── Inventory ────────────────────────────────────────────────────────────────
export function AdminInventory() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.inventory.useQuery();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const setStock = trpc.admin.setInventory.useMutation({
    onSuccess: () => {
      utils.admin.inventory.invalidate();
      utils.admin.stats.invalidate();
      utils.admin.products.invalidate();
    },
  });

  useSeo({ title: "Admin — Inventory", description: "Stock levels.", path: "/admin/inventory", noindex: true });

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    productId: string;
    productName: string;
    productSlug: string;
    name: string;
    sku: string;
    inventoryQty: number;
    priceCents: number;
    active: boolean;
  }>;

  const lowCount = rows.filter((r) => r.inventoryQty <= LOW_STOCK_AT).length;

  return (
    <AdminShell title="Inventory" subtitle="Edit stock inline. Changes save per row." active="/admin/inventory">
      {isLoading ? (
        <LoadingState rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-6 w-6" />}
          title="No variants to track"
          body="Add products with variants first — each variant carries its own stock count."
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {rows.length} variant{rows.length === 1 ? "" : "s"} ·{" "}
            <span className={lowCount > 0 ? "font-bold text-amber-700" : ""}>
              {lowCount} at or below {LOW_STOCK_AT}
            </span>
          </p>
          <div className="space-y-2">
            {rows.map((r) => {
              const value = edits[r.id] ?? String(r.inventoryQty);
              const dirty = value !== String(r.inventoryQty);
              return (
                <div key={r.id} className="card-soft flex flex-wrap items-center gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                    <Boxes className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      to={`/admin/products/${r.productId}`}
                      className="block truncate text-sm font-bold hover:text-primary hover:underline"
                    >
                      {r.productName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {r.name} · SKU {r.sku} {r.active ? "" : "· hidden"}
                    </span>
                  </span>
                  {r.inventoryQty <= LOW_STOCK_AT && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
                      Low
                    </span>
                  )}
                  <input
                    aria-label={`Stock for ${r.productName} ${r.name}`}
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="h-10 w-24 rounded-lg border border-input bg-card px-3 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!dirty || setStock.isPending}
                    onClick={() =>
                      setStock.mutate(
                        { id: r.id, qty: Math.max(0, Number(value) || 0) },
                        {
                          onSuccess: () =>
                            setEdits((prev) => {
                              const next = { ...prev };
                              delete next[r.id];
                              return next;
                            }),
                        },
                      )
                    }
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                  >
                    <Save className="h-3.5 w-3.5" /> Save
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AdminShell>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────
const NUMERIC_SETTING_KEYS = [
  "shipping_flat_cents",
  "free_shipping_threshold_cents",
  "tax_rate_bps",
  "return_window_days",
] as const;

const SETTING_GROUPS: Array<{
  title: string;
  help: string;
  keys: Array<{ key: string; label: string; type?: "text" | "textarea" | "number" }>;
}> = [
  {
    title: "Brand",
    help: "Shown in the header, footer, page titles and structured data.",
    keys: [
      { key: "brand_name", label: "Store name" },
      { key: "tagline", label: "Tagline" },
      { key: "hero_headline", label: "Hero headline" },
      { key: "hero_subhead", label: "Hero subheadline", type: "textarea" },
      { key: "announcement", label: "Announcement bar (empty hides it)" },
    ],
  },
  {
    title: "Shipping, tax & returns",
    help: "Drives every price calculation on the storefront.",
    keys: [
      { key: "free_shipping_threshold_cents", label: "Free shipping over (cents, 0 = off)", type: "number" },
      { key: "shipping_flat_cents", label: "Flat shipping rate (cents)", type: "number" },
      { key: "tax_rate_bps", label: "Tax rate (basis points, e.g. 600 = 6%)", type: "number" },
      { key: "return_window_days", label: "Return window (days)", type: "number" },
      { key: "shipping_estimate", label: "Delivery estimate copy" },
      { key: "currency", label: "Currency code" },
    ],
  },
  {
    title: "Contact & legal",
    help: "Appears in the footer, policy pages and contact card.",
    keys: [
      { key: "contact_email", label: "Support email" },
      { key: "contact_phone", label: "Support phone" },
      { key: "support_hours", label: "Support hours" },
      { key: "business_address", label: "Business address", type: "textarea" },
    ],
  },
  {
    title: "Payments",
    help: "2Checkout is the only payment method. Keys live in environment variables, never here — add TWOCHECKOUT_SELLER_ID and TWOCHECKOUT_SECRET_KEY to go live.",
    keys: [{ key: "payment_provider", label: "Payment method (2checkout)" }],
  },
  {
    title: "Email (Resend)",
    help: "Order confirmation and shipping notification emails. Sending turns on as soon as RESEND_API_KEY is set — until then every attempt is logged as 'skipped' on the order.",
    keys: [
      { key: "email_from_name", label: "Sender name" },
      { key: "email_from_address", label: "From address — must be on a domain verified in Resend" },
      { key: "email_reply_to", label: "Reply-to address" },
    ],
  },
];

export function AdminSettings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.settings.useQuery();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const save = trpc.admin.updateSettings.useMutation({
    onSuccess: () => {
      utils.admin.settings.invalidate();
      utils.settings.public.invalidate();
      utils.settings.providers.invalidate();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    },
  });

  useSeo({ title: "Admin — Settings", description: "Store settings.", path: "/admin/settings", noindex: true });

  // Settings arrive as a typed map; the form holds everything as strings.
  useEffect(() => {
    if (!data) return;
    const asStrings: Record<string, string> = {};
    Object.entries(data).forEach(([k, v]) => {
      if (v !== null && v !== undefined) asStrings[k] = String(v);
    });
    setDraft(asStrings);
  }, [data]);

  const submit = () => {
    const d = draft;
    save.mutate({
      brand_name: d.brand_name,
      tagline: d.tagline,
      announcement: d.announcement,
      hero_headline: d.hero_headline,
      hero_subhead: d.hero_subhead,
      contact_email: d.contact_email,
      contact_phone: d.contact_phone,
      support_hours: d.support_hours,
      business_address: d.business_address,
      shipping_flat_cents: Number(d.shipping_flat_cents) || 0,
      free_shipping_threshold_cents: Number(d.free_shipping_threshold_cents) || 0,
      shipping_estimate: d.shipping_estimate,
      tax_rate_bps: Number(d.tax_rate_bps) || 0,
      return_window_days: Number(d.return_window_days) || 0,
      payment_provider: d.payment_provider,
      currency: d.currency,
      email_from_name: d.email_from_name,
      email_from_address: d.email_from_address,
      email_reply_to: d.email_reply_to,
    });
  };

  return (
    <AdminShell
      title="Store settings"
      subtitle="Everything the storefront reads at runtime. No redeploy needed."
      active="/admin/settings"
    >
      {isLoading ? (
        <LoadingState rows={4} />
      ) : (
        <div className="space-y-6">
          {SETTING_GROUPS.map((group) => (
            <div key={group.title} className="card-soft p-6">
              <h2 className="text-lg font-extrabold">{group.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{group.help}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {group.keys.map((k) => (
                  <div key={k.key} className={k.type === "textarea" ? "sm:col-span-2" : ""}>
                    <label className="block font-mono text-xs font-semibold" htmlFor={`set-${k.key}`}>
                      {k.key}
                    </label>
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    {k.type === "textarea" ? (
                      <textarea
                        id={`set-${k.key}`}
                        rows={2}
                        value={draft[k.key] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [k.key]: e.target.value })}
                        className="mt-1.5 w-full rounded-xl border border-input bg-card p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    ) : (
                      <input
                        id={`set-${k.key}`}
                        type={k.type === "number" ? "number" : "text"}
                        value={draft[k.key] ?? ""}
                        onChange={(e) => setDraft({ ...draft, [k.key]: e.target.value })}
                        className="mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={save.isPending}
              onClick={submit}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save settings"}
            </button>
            {saved && <span className="text-sm font-semibold text-emerald-700">Saved ✓</span>}
            {save.isError && <span className="text-sm font-semibold text-destructive">{save.error.message}</span>}
            <span className="text-xs text-muted-foreground">
              {NUMERIC_SETTING_KEYS.length} numeric keys are stored as integers; the rest as text.
            </span>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
