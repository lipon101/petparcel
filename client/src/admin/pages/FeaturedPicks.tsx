// Home page "Our featured picks" - the admin control for the featured rail.
//
// The owner chooses WHICH products appear in the home page's "Our featured
// picks" rail and in WHAT ORDER. The pick is saved to the database (the
// `featured_pick_ids` setting) and the storefront reads it at request time, so a
// change here shows up on the next home page load with no redeploy.
//
// Leaving the list empty clears the picks, which makes the storefront fall back
// to the products flagged `featured`, then the newest - so the rail is never
// empty even before the owner chooses. Only ACTIVE products can be picked; an
// unpublished pick is dropped server-side rather than shown broken.
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { formatMoney } from "@shared/store";
import { cn } from "@/lib/utils";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminProduct } from "../types";
import {
  AdminPageHeader,
  Btn,
  Card,
  ErrorPanel,
  Pill,
  SearchInput,
  TableSkeleton,
  useToast,
} from "../ui";

/** The rail shows four picks by default - the same count the storefront renders. */
const RAIL_SIZE = 4;

export function FeaturedPicksPage() {
  const data = useAdminData();
  const toast = useToast();
  const { data: products, isLoading: productsLoading } = useAsync(() => data.listProducts(), [data]);
  const { data: picks, isLoading: picksLoading, error, refetch } = useAsync(
    () => data.getFeaturedPicks(),
    [data],
  );
  const [ids, setIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!picks) return;
    setIds(picks.productIds);
  }, [picks]);

  // Only ACTIVE products can be featured - an unpublished product would be
  // dropped server-side anyway, so it is not offered here.
  const active = useMemo(() => (products ?? []).filter((p) => p.active), [products]);
  const byId = useMemo(() => new Map(active.map((p) => [p.id, p])), [active]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter((p) => `${p.name} ${p.category} ${p.slug}`.toLowerCase().includes(q));
  }, [active, query]);

  const chosen = ids.map((id) => byId.get(id)).filter((p): p is AdminProduct => Boolean(p));

  const add = (id: string) => {
    if (ids.includes(id)) return;
    setIds((prev) => [...prev, id]);
  };
  const remove = (id: string) => setIds((prev) => prev.filter((x) => x !== id));
  const move = (id: string, dir: -1 | 1) => {
    setIds((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const dirty = !!picks && ids.join(",") !== picks.productIds.join(",");

  const save = async () => {
    setSaving(true);
    try {
      await data.setFeaturedPicks(ids);
      toast.push("Featured picks updated - live on the next home page load.");
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const loading = productsLoading || picksLoading;

  return (
    <>
      <AdminPageHeader
        title="Featured picks"
        subtitle="Choose which products appear in the home page's “Our featured picks” rail, and in what order. Saved to the database - no redeploy needed."
        actions={
          <Btn onClick={save} disabled={saving || loading || !dirty}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
          </Btn>
        }
      />

      {loading ? (
        <TableSkeleton rows={5} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          {/* Live preview of the rail, exactly as the storefront renders it. */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">Live preview</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  This is exactly how the rail will look on the home page.
                </p>
              </div>
              <Pill tone={ids.length > 0 ? "green" : "slate"}>
                {ids.length > 0 ? `${ids.length} picked` : "Automatic"}
              </Pill>
            </div>
            {chosen.length === 0 ? (
              <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-[18px] border border-dashed border-line bg-blush/40 p-6 text-center text-xs text-muted-foreground">
                No picks yet - the rail shows the products flagged “Featured”, then the newest.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {chosen.slice(0, RAIL_SIZE).map((p) => (
                  <div key={p.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                    <span className="block aspect-square overflow-hidden bg-muted">
                      {p.images[0] ? (
                        <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-3xl">🐾</span>
                      )}
                    </span>
                    <span className="block p-3">
                      <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                      <span className="mt-1 block text-xs font-semibold text-coral">
                        {formatMoney(p.priceCents)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* The ordered picks, with reorder + remove. */}
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg font-bold text-ink">Your picks</h2>
                {ids.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIds([])}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Clear all
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The first {RAIL_SIZE} appear in the rail, in this order.
              </p>
              {ids.length === 0 ? (
                <p className="mt-4 rounded-xl bg-secondary px-3 py-6 text-center text-xs text-muted-foreground">
                  Automatic (products flagged “Featured”, then the newest).
                </p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {ids.map((id, i) => {
                    const p = byId.get(id);
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-3 rounded-xl border border-line px-2 py-2"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-primary">
                          {i + 1}
                        </span>
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {p?.images[0] ? (
                            <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-lg">🐾</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {p?.name ?? "Unavailable product"}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p ? `${p.category} · ${formatMoney(p.priceCents)}` : "No longer active"}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => move(id, -1)}
                            disabled={i === 0}
                            aria-label="Move up"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => move(id, 1)}
                            disabled={i === ids.length - 1}
                            aria-label="Move down"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(id)}
                            aria-label="Remove"
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* The picker: a searchable list of active products. */}
            <Card className="p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-serif text-lg font-bold text-ink">Add a product</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click a product to add it to the rail.
                  </p>
                </div>
                <SearchInput value={query} onChange={setQuery} placeholder="Search products…" />
              </div>
              <div className="mt-4 max-h-[420px] space-y-1 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No active products match.
                  </p>
                ) : (
                  filtered.map((p) => {
                    const isSel = ids.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => (isSel ? remove(p.id) : add(p.id))}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition",
                          isSel ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-secondary",
                        )}
                      >
                        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {p.images[0] ? (
                            <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-lg">🐾</span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {p.category} · {formatMoney(p.priceCents)}
                          </span>
                        </span>
                        {isSel && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> The rail promotes your whole catalogue - it is a
            curated highlight, not a hard sell.
          </p>
        </div>
      )}
    </>
  );
}
