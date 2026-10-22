// Products list: search, category filter, sortable + paginated table, inline
// active/featured toggles, and create/delete. Editing opens the product editor.
//
// LAYOUT. The table is a FIXED layout with explicit column widths, so a long
// product name or slug truncates inside its cell instead of stretching the table
// past the panel and forcing a sideways scroll. Below `md` the table is replaced
// by a card list (`mobileCard`), so a phone shows every field stacked and
// readable with no horizontal scroll at all.
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { adminPath } from "@/_core/admin-path";
import { formatMoney } from "@shared/store";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import { useCatalogCategories } from "@/lib/useCatalog";
import { filterRows } from "../table";
import { StockEditor } from "../StockEditor";
import type { AdminProduct } from "../types";
import {
  AdminPageHeader,
  Btn,
  Column,
  ConfirmDialog,
  DataTable,
  ErrorPanel,
  Pill,
  SearchInput,
  Select,
  TableSkeleton,
  useToast,
} from "../ui";

export function ProductsPage() {
  const data = useAdminData();
  const toast = useToast();
  const [, navigate] = useLocation();
  const { data: products, isLoading, error, refetch } = useAsync(() => data.listProducts(), [data]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [pendingDelete, setPendingDelete] = useState<AdminProduct | null>(null);
  const [busy, setBusy] = useState(false);

  // The browse tree, so the "New product" default and the filter chips offer
  // exactly the aisles this store has rather than a hardcoded guess.
  const { nodes: treeAisles } = useCatalogCategories();

  const categories = useMemo(
    () => [...new Set((products ?? []).map((p) => p.category))].sort(),
    [products],
  );

  const rows = useMemo(() => {
    let list = products ?? [];
    if (category) list = list.filter((p) => p.category === category);
    return filterRows(list, query, ["name", "category", "slug"]);
  }, [products, query, category]);

  const toggle = async (p: AdminProduct, field: "active" | "featured") => {
    try {
      await data.updateProduct(p.id, {
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        priceCents: p.priceCents,
        compareAtCents: p.compareAtCents,
        images: p.images,
        tags: p.tags,
        active: field === "active" ? !p.active : p.active,
        featured: field === "featured" ? !p.featured : p.featured,
        sortOrder: p.sortOrder,
      });
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Update failed.", "error");
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const created = await data.createProduct({
        name: "New product",
        description: "Describe this product for customers.",
        // Default to a real aisle from the live browse tree rather than a
        // hardcoded name that may not exist in this store's catalogue.
        category: categories[0] ?? treeAisles[0] ?? "Dogs",
        priceCents: 2999,
        compareAtCents: null,
        images: [],
        tags: [],
        active: false,
        featured: false,
        sortOrder: 0,
      });
      toast.push("Product created - add details and stock.");
      navigate(adminPath(`products/${created.id}`));
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Could not create product.", "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      const result = await data.deleteProduct(pendingDelete.id);
      toast.push(
        result.archived
          ? `Archived “${pendingDelete.name}” - it has order history, so it is hidden rather than erased.`
          : `Deleted “${pendingDelete.name}”.`,
      );
      setPendingDelete(null);
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Delete failed.", "error");
    }
  };

  // The row actions, shared by the table and the mobile card so the two can
  // never drift apart.
  const rowActions = (p: AdminProduct) => (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        to={adminPath(`products/${p.id}`)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label={`Edit ${p.name}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Link>
      <button
        type="button"
        onClick={() => setPendingDelete(p)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${p.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const statusPills = (p: AdminProduct) => (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => toggle(p, "active")} aria-label={`Toggle live for ${p.name}`}>
        <Pill tone={p.active ? "green" : "slate"}>{p.active ? "Live" : "Hidden"}</Pill>
      </button>
      <button type="button" onClick={() => toggle(p, "featured")} aria-label={`Toggle featured for ${p.name}`}>
        <Pill tone={p.featured ? "teal" : "slate"}>{p.featured ? "Featured" : "\u2014"}</Pill>
      </button>
    </div>
  );

  const columns: Column<AdminProduct>[] = [
    {
      key: "name",
      header: "Product",
      sortable: true,
      render: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-muted">
            {p.images[0] ? (
              <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg">🐾</span>
            )}
          </span>
          <span className="min-w-0">
            <Link
              to={adminPath(`products/${p.id}`)}
              title={p.name}
              className="block truncate font-semibold text-ink hover:text-primary hover:underline"
            >
              {p.name}
            </Link>
            <span className="block truncate text-xs text-muted-foreground" title={p.slug}>
              {p.slug}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: true,
      className: "hidden w-32 lg:table-cell",
      render: (p) => (
        <span className="block truncate text-muted-foreground" title={p.category}>
          {p.category}
        </span>
      ),
    },
    {
      key: "priceCents",
      header: "Price",
      sortable: true,
      align: "right",
      className: "w-24",
      render: (p) => <span className="font-bold text-ink">{formatMoney(p.priceCents)}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      className: "w-32",
      sortValue: (p) => p.variants.reduce((s, v) => s + v.inventoryQty, 0),
      render: (p) => <StockEditor product={p} onSaved={refetch} />,
    },
    {
      key: "active",
      header: "Status",
      align: "center",
      className: "w-32",
      sortValue: (p) => p.active,
      render: (p) => <div className="flex justify-center">{statusPills(p)}</div>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-24",
      render: (p) => rowActions(p),
    },
  ];

  // The narrow-screen card: every field the table shows, stacked, so nothing is
  // clipped and no sideways scroll is needed on a phone.
  const mobileCard = (p: AdminProduct) => (
    <div className="card-soft p-4">
      <div className="flex items-start gap-3">
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
          {p.images[0] ? (
            <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg">🐾</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={adminPath(`products/${p.id}`)}
            className="block truncate font-semibold text-ink hover:text-primary hover:underline"
          >
            {p.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{p.slug}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.category}</p>
        </div>
        <span className="shrink-0 font-bold text-ink">{formatMoney(p.priceCents)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <StockEditor product={p} onSaved={refetch} />
        {statusPills(p)}
      </div>
      <div className="mt-3 flex justify-end border-t border-line-soft pt-3">{rowActions(p)}</div>
    </div>
  );

  return (
    <>
      <AdminPageHeader
        title="Products"
        subtitle="Everything the storefront shows comes from here."
        actions={
          <Btn onClick={create} disabled={busy}>
            <Plus className="h-4 w-4" /> {busy ? "Creating…" : "New product"}
          </Btn>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search products…" />
        <Select
          ariaLabel="Filter by category"
          value={category}
          onChange={setCategory}
          className="!mt-0 sm:w-56"
          options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
        />
        <span className="text-xs text-muted-foreground">{rows.length} shown</span>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          pageSize={10}
          fixed
          mobileCard={mobileCard}
          initialSort={{ key: "name", dir: "asc" }}
          emptyTitle="No products match"
          emptyBody="Try a different search or category, or create a new product."
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete product?"
        body={`\u201c${pendingDelete?.name ?? ""}\u201d and its variants will be removed from the storefront. A product with order history is archived (hidden, kept for its orders) rather than erased.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
