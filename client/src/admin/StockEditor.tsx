// Inline stock editor for the admin Products list.
//
// The Stock column used to be a read-only summary ("100 · 2 var"). This turns it
// into a real editor: expand a product to see every variant, adjust each
// quantity with a stepper or a direct number, and save - each write goes to the
// production database through `admin.setInventory`. A "set total" control splits
// a desired total across the variants, which is how an owner actually restocks.
//
// Every rule (clamping, stepping, splitting) lives in the pure `./stock` module
// so it is unit-tested without a DOM; this file is only the wiring and the look.
import { useState } from "react";
import { AlertCircle, Check, ChevronDown, Loader2, Minus, Plus, Split } from "lucide-react";
import { isLowStock } from "@shared/store";
import { useSite } from "@/components/site/Layout";
import { cn } from "@/lib/utils";
import type { AdminProduct, AdminVariant } from "./types";
import { useAdminData } from "./data-source";
import { Btn, useToast } from "./ui";
import { clampQty, distributeTotal, stepQty, totalStock } from "./stock";

type RowState = { saving: boolean; saved: boolean; error: string | null };

export function StockEditor({ product, onSaved }: { product: AdminProduct; onSaved: () => void }) {
  const data = useAdminData();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // Draft quantities keyed by variant id, seeded from the live product. A draft
  // is a STRING so a half-typed field is representable; it is clamped on save.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [totalDraft, setTotalDraft] = useState("");

  const variants = product.variants;
  const liveTotal = totalStock(variants.map((v) => v.inventoryQty));
  // Read the owner-editable threshold from the live store settings so the
  // editor's low-stock state matches the dashboard and the storefront exactly.
  const threshold = useSite().low_stock_threshold;
  const low = isLowStock(liveTotal, threshold);

  const draftOf = (v: AdminVariant) => drafts[v.id] ?? String(v.inventoryQty);
  const rowOf = (id: string): RowState => rows[id] ?? { saving: false, saved: false, error: null };

  const setDraft = (id: string, value: string) =>
    setDrafts((d) => ({ ...d, [id]: value }));
  const setRow = (id: string, patch: Partial<RowState>) =>
    setRows((r) => ({ ...r, [id]: { ...rowOf(id), ...patch } }));

  const save = async (v: AdminVariant, qty: number) => {
    const next = clampQty(qty);
    setDraft(v.id, String(next));
    setRow(v.id, { saving: true, saved: false, error: null });
    try {
      await data.setVariantStock(v.id, next);
      setRow(v.id, { saving: false, saved: true, error: null });
      onSaved();
      window.setTimeout(() => setRow(v.id, { saved: false }), 1800);
    } catch (e) {
      setRow(v.id, {
        saving: false,
        saved: false,
        error: e instanceof Error ? e.message : "Could not save.",
      });
    }
  };

  const applyTotal = async () => {
    const parts = distributeTotal(clampQty(totalDraft), variants.length);
    if (parts.length === 0) return;
    setTotalDraft("");
    for (let i = 0; i < variants.length; i++) {
      // Sequential so the last write wins cleanly and each row shows its own state.
      // eslint-disable-next-line no-await-in-loop
      await save(variants[i], parts[i]);
    }
    toast.push(`Stock set to ${clampQty(totalDraft)} across ${variants.length} variants.`);
  };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Edit stock for ${product.name}`}
        className="inline-flex items-center gap-1.5 rounded-full border border-input px-2.5 py-1 text-xs font-bold tabular-nums transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className={low ? "text-amber-700" : "text-ink"}>{liveTotal}</span>
        <span className="font-medium text-muted-foreground">
          · {variants.length} var
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[min(22rem,80vw)] rounded-xl border border-border bg-card p-3 text-left shadow-sm">
          {variants.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No variants - this product sells at its base price with no stock to track.
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={totalDraft}
                  onChange={(e) => setTotalDraft(e.target.value)}
                  placeholder="Set total"
                  aria-label={`Set total stock across variants for ${product.name}`}
                  className="h-8 w-24 rounded-lg border border-input bg-card px-2 text-xs tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <Btn size="sm" variant="outline" onClick={applyTotal} disabled={totalDraft.trim() === ""}>
                  <Split className="h-3.5 w-3.5" aria-hidden="true" />
                  Split across {variants.length}
                </Btn>
              </div>

              <ul className="space-y-1.5">
                {variants.map((v) => {
                  const st = rowOf(v.id);
                  const draft = draftOf(v);
                  const changed = clampQty(draft) !== v.inventoryQty;
                  return (
                    <li key={v.id} className="rounded-lg border border-line-soft p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-ink">{v.name}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">SKU {v.sku}</span>
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setDraft(v.id, String(stepQty(clampQty(draft), -1)))}
                            aria-label={`Decrease stock for ${v.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-secondary"
                          >
                            <Minus className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={draft}
                            onChange={(e) => setDraft(v.id, e.target.value)}
                            aria-label={`Stock quantity for ${v.name}`}
                            className="h-7 w-14 rounded-lg border border-input bg-card px-1.5 text-center text-xs tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                          <button
                            type="button"
                            onClick={() => setDraft(v.id, String(stepQty(clampQty(draft), 1)))}
                            aria-label={`Increase stock for ${v.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-secondary"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <Btn
                            size="sm"
                            variant={changed ? "primary" : "ghost"}
                            disabled={!changed || st.saving}
                            onClick={() => save(v, clampQty(draft))}
                            ariaLabel={`Save stock for ${v.name}`}
                            className="!h-7 !px-2.5 !text-[11px]"
                          >
                            {st.saving ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : st.saved ? (
                              <Check className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              "Save"
                            )}
                          </Btn>
                        </div>
                      </div>
                      {st.error && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-destructive">
                          <AlertCircle className="h-3 w-3" aria-hidden="true" /> {st.error}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
