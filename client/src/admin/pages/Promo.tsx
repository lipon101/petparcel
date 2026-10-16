// Home page promo cards - the admin control for the two featured products.
//
// The owner picks ONE product for each of the home page's two promo cards
// ("Just landed" / "Most reordered"). The pick is saved to the database and the
// storefront reads it at request time, so a change here shows up on the next
// home page load with no redeploy.
//
// The page shows a searchable product picker per card and a LIVE PREVIEW that
// renders the exact card markup the storefront uses, so the owner sees what a
// shopper will see before saving. Leaving a card on "Automatic" clears the pick,
// which makes the storefront fall back to the best available product (newest /
// most-ordered) - so a card is never empty even before the owner chooses.
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, RotateCcw, Save, Sparkles, TrendingUp } from "lucide-react";
import { formatMoney } from "@shared/store";
import { promoCardCopy, type PromoKind } from "@shared/promo";
import { cn } from "@/lib/utils";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminProduct, AdminPromoSlot } from "../types";
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

const SLOTS: { kind: PromoKind; label: string; help: string; icon: React.ElementType }[] = [
  {
    kind: "new_arrivals",
    label: "New arrivals card",
    help: "The first card on the home page. Falls back to the newest product.",
    icon: Sparkles,
  },
  {
    kind: "best_sellers",
    label: "Best sellers card",
    help: "The second card on the home page. Falls back to the most-ordered product.",
    icon: TrendingUp,
  },
];

/** The resolved preview for one slot: the owner's pick when it is a live
 *  product, otherwise the server-resolved fallback. Copy is derived from the
 *  product's own data with the SAME function the storefront uses. */
function previewSlot(
  kind: PromoKind,
  selectedId: string,
  byId: Map<string, AdminProduct>,
  resolved: AdminPromoSlot | null,
) {
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const product = selected ?? resolved?.product ?? null;
  if (!product) return null;
  return {
    product,
    copy: promoCardCopy(kind, product),
    source: selected ? ("selected" as const) : ("fallback" as const),
  };
}

/** The card preview - the SAME markup, classes and hover as the storefront's
 *  home page promo card, so the preview is faithful. */
function CardPreview({
  preview,
}: {
  preview: ReturnType<typeof previewSlot>;
}) {
  if (!preview) {
    return (
      <div className="flex h-full min-h-[132px] items-center justify-center rounded-[18px] border border-dashed border-line bg-blush/40 p-6 text-center text-xs text-muted-foreground">
        No product to feature yet - add a product and it will appear here.
      </div>
    );
  }
  const { product: p, copy, source } = preview;
  const onSale = typeof p.compareAtCents === "number" && p.compareAtCents > p.priceCents;
  return (
    <div className="group flex h-full items-center gap-5 overflow-hidden rounded-[18px] border border-line bg-blush p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] sm:p-7">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="eyebrow">{copy.eyebrow}</div>
          <Pill tone={source === "selected" ? "green" : "slate"}>
            {source === "selected" ? "Your pick" : "Automatic"}
          </Pill>
        </div>
        <h3 className="text-[19px] font-normal leading-[1.25]">{copy.title}</h3>
        <p className="mt-2 text-[12px] leading-relaxed text-gray sm:text-[13.5px]">{copy.body}</p>
        <span className="mt-2 flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-coral">{formatMoney(p.priceCents)}</span>
          {onSale && (
            <span className="text-[12.5px] text-gray line-through">
              {formatMoney(p.compareAtCents)}
            </span>
          )}
        </span>
        <span className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-teal transition-colors group-hover:text-coral">
          {copy.cta} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
      <span className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl bg-white sm:h-[120px] sm:w-[120px]">
        {p.images[0] ? (
          <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl">🐾</span>
        )}
      </span>
    </div>
  );
}

export function PromoPage() {
  const data = useAdminData();
  const toast = useToast();
  const { data: products, isLoading: productsLoading } = useAsync(() => data.listProducts(), [data]);
  const { data: promo, isLoading: promoLoading, error, refetch } = useAsync(
    () => data.getPromo(),
    [data],
  );
  const [newArrivalsId, setNewArrivalsId] = useState("");
  const [bestSellersId, setBestSellersId] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!promo) return;
    setNewArrivalsId(promo.newArrivalsProductId);
    setBestSellersId(promo.bestSellersProductId);
  }, [promo]);

  // Only ACTIVE products can be featured - an unpublished product would fall
  // back on the storefront anyway, so it is not offered here.
  const active = useMemo(() => (products ?? []).filter((p) => p.active), [products]);
  const byId = useMemo(() => new Map(active.map((p) => [p.id, p])), [active]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter((p) => `${p.name} ${p.category} ${p.slug}`.toLowerCase().includes(q));
  }, [active, query]);

  const selectedIdFor = (kind: PromoKind) =>
    kind === "new_arrivals" ? newArrivalsId : bestSellersId;
  const setSelectedFor = (kind: PromoKind, id: string) =>
    kind === "new_arrivals" ? setNewArrivalsId(id) : setBestSellersId(id);

  const dirty =
    !!promo &&
    (newArrivalsId !== promo.newArrivalsProductId || bestSellersId !== promo.bestSellersProductId);

  const save = async () => {
    setSaving(true);
    try {
      await data.setPromo({
        newArrivalsProductId: newArrivalsId,
        bestSellersProductId: bestSellersId,
      });
      toast.push("Home page promo cards updated - live on the next page load.");
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const loading = productsLoading || promoLoading;

  return (
    <>
      <AdminPageHeader
        title="Home page promo cards"
        subtitle="Choose the product featured in each of the two home page cards. Saved to the database - no redeploy needed."
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
          {/* Live preview of both cards, exactly as the storefront renders them. */}
          <Card className="p-6">
            <h2 className="font-serif text-lg font-bold text-ink">Live preview</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              This is exactly how the two cards will look on the home page.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {SLOTS.map(({ kind }) => (
                <CardPreview
                  key={kind}
                  preview={previewSlot(
                    kind,
                    selectedIdFor(kind),
                    byId,
                    kind === "new_arrivals" ? (promo?.newArrivals ?? null) : (promo?.bestSellers ?? null),
                  )}
                />
              ))}
            </div>
          </Card>

          {/* The picker: one searchable list, applied to whichever card is
              currently being edited. */}
          <Card className="p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-lg font-bold text-ink">Choose a product</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pick a product for a card, or leave it on Automatic to feature the best available
                  product.
                </p>
              </div>
              <SearchInput value={query} onChange={setQuery} placeholder="Search products…" />
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              {SLOTS.map(({ kind, label, help, icon: Icon }) => {
                const selectedId = selectedIdFor(kind);
                const selected = selectedId ? byId.get(selectedId) : undefined;
                return (
                  <div key={kind} className="rounded-2xl border border-line p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-soft text-teal">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-ink">{label}</p>
                        <p className="text-xs text-muted-foreground">{help}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2">
                      <span className="min-w-0 truncate text-xs font-semibold text-ink">
                        {selected ? selected.name : "Automatic (best available)"}
                      </span>
                      {selectedId && (
                        <button
                          type="button"
                          onClick={() => setSelectedFor(kind, "")}
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Automatic
                        </button>
                      )}
                    </div>

                    <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
                      {filtered.length === 0 ? (
                        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                          No active products match.
                        </p>
                      ) : (
                        filtered.map((p) => {
                          const isSel = p.id === selectedId;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedFor(kind, p.id)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition",
                                isSel ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-secondary",
                              )}
                            >
                              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                                {p.images[0] ? (
                                  <img
                                    src={p.images[0]}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center text-lg">
                                    🐾
                                  </span>
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-ink">
                                  {p.name}
                                </span>
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
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
