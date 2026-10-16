// Inventory - the low-stock workspace.
//
// WHY THIS PAGE EXISTS. The low-stock signal used to live only as a small card
// on the dashboard, capped at eight rows and with no way to act on it - so the
// owner could see that something was low but not fix it without hunting through
// the product list. This page is the single, findable place for it: every variant
// at or below the store's low-stock threshold, with an inline quantity editor, so
// restocking is one click from the dashboard's "Low on stock" card.
//
// Everything is live: the threshold comes from the store settings, the rows come
// from the real catalogue, and a save writes the variant's stock through the same
// server procedure the product editor uses.
import { useMemo, useState } from "react";
import { AlertTriangle, Check, PackageCheck, Save } from "lucide-react";
import { formatMoney, isLowStock } from "@shared/store";
import { cn } from "@/lib/utils";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminProduct, AdminVariant } from "../types";
import { AdminPageHeader, Btn, Card, ErrorPanel, Pill, TableSkeleton, useToast } from "../ui";

interface LowRow {
  product: AdminProduct;
  variant: AdminVariant;
}

export function InventoryPage() {
  const data = useAdminData();
  const toast = useToast();
  const { data: settings } = useAsync(() => data.getSettings(), [data]);
  const { data: products, isLoading, error, refetch } = useAsync(() => data.listProducts(), [data]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const threshold = settings?.lowStockThreshold ?? 10;

  // Every variant at or below the threshold, lowest first - the same rule the
  // dashboard and the storefront use, so the three can never disagree.
  const rows = useMemo<LowRow[]>(() => {
    const out: LowRow[] = [];
    for (const p of products ?? []) {
      if (!p.active) continue;
      for (const v of p.variants) {
        if (v.active && isLowStock(v.inventoryQty, threshold)) out.push({ product: p, variant: v });
      }
    }
    return out.sort((a, b) => a.variant.inventoryQty - b.variant.inventoryQty);
  }, [products, threshold]);

  const outOfStock = rows.filter((r) => r.variant.inventoryQty <= 0).length;

  const draftOf = (v: AdminVariant) => drafts[v.id] ?? String(v.inventoryQty);

  const save = async (v: AdminVariant) => {
    const raw = draftOf(v);
    const qty = Math.max(0, Math.min(1_000_000, Math.round(Number(raw) || 0)));
    setSavingId(v.id);
    try {
      await data.setVariantStock(v.id, qty);
      setSavedId(v.id);
      setDrafts((d) => {
        const next = { ...d };
        delete next[v.id];
        return next;
      });
      toast.push(`Stock for ${v.sku} set to ${qty}.`);
      refetch();
      window.setTimeout(() => setSavedId((s) => (s === v.id ? null : s)), 2000);
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        subtitle={`Variants at or below your low-stock threshold of ${threshold} units. Restock inline - changes save straight to the database.`}
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Low on stock
              </p>
              <p className="mt-1 font-serif text-3xl font-bold text-amber-600">{rows.length}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Out of stock
              </p>
              <p className="mt-1 font-serif text-3xl font-bold text-rose-600">{outOfStock}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Threshold
              </p>
              <p className="mt-1 font-serif text-3xl font-bold text-ink">{threshold}</p>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h2 className="font-serif text-lg font-bold text-ink">Restock</h2>
            </div>
            {rows.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <PackageCheck className="h-4 w-4 text-emerald-600" /> Every variant is comfortably
                stocked.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4 font-semibold">Product</th>
                      <th className="py-2 pr-4 font-semibold">Variant</th>
                      <th className="py-2 pr-4 font-semibold">SKU</th>
                      <th className="py-2 pr-4 font-semibold">Price</th>
                      <th className="py-2 pr-4 font-semibold">In stock</th>
                      <th className="py-2 font-semibold">Set to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ product, variant }) => {
                      const draft = draftOf(variant);
                      const changed = draft !== String(variant.inventoryQty);
                      return (
                        <tr key={variant.id} className="border-b border-line/60">
                          <td className="py-3 pr-4">
                            <span className="block max-w-[220px] truncate font-semibold text-ink">
                              {product.name}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{variant.name}</td>
                          <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                            {variant.sku}
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-ink">
                            {formatMoney(variant.priceCents)}
                          </td>
                          <td className="py-3 pr-4">
                            <Pill tone={variant.inventoryQty <= 0 ? "rose" : "amber"}>
                              {variant.inventoryQty} left
                            </Pill>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                value={draft}
                                onChange={(e) =>
                                  setDrafts((d) => ({ ...d, [variant.id]: e.target.value }))
                                }
                                aria-label={`Stock quantity for ${variant.sku}`}
                                className="w-24 rounded-lg border border-line px-2 py-1.5 text-sm tabular-nums focus:border-teal focus:outline-none"
                              />
                              <Btn
                                onClick={() => save(variant)}
                                disabled={!changed || savingId === variant.id}
                                className={cn("!px-3 !py-1.5")}
                              >
                                {savedId === variant.id ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                                {savingId === variant.id ? "Saving…" : "Save"}
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
