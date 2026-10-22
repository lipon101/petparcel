// Categories: the browse tree - top-level aisles, each with the subcategories
// filed under it - plus create/edit/delete and the drag-to-reorder control.
//
// The list is a TREE rather than a flat table because that is how the store is
// organised and how the storefront browses it: an aisle like "Pet Toys" is only
// meaningful next to the subcategories filed under it ("Pet Chew Toys"). A
// subcategory's parent is chosen from a select, so the two levels can never
// disagree with what the storefront renders.
//
// ORDER. Aisle order and each aisle's subcategory order are both editable, and
// the order saved here is the order the storefront renders - this list and the
// shop page read the same values. Two ways to move a row, deliberately:
//   * DRAG, for a mouse or a finger, from the grip handle on each row; and
//   * UP / DOWN buttons, the accessible path - a keyboard or screen-reader user
//     cannot drag, and a button that moves one place needs no explanation.
// Both call the same `reorderCategories` mutation with the COMPLETE sibling
// list, so a reorder can never disturb another aisle's children.
//
// Renaming a category re-points its products in the database, so the catalog and
// the browse tree stay consistent (see `updateCategory` in server/db.ts).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import type { AdminCategory, AdminCategoryChild, AdminCategoryInput } from "../types";
import { dropTarget, isBelowMidpoint, moveId, moveItem } from "../category-reorder";
import {
  AdminPageHeader,
  Btn,
  ConfirmDialog,
  ErrorPanel,
  Field,
  Modal,
  Pill,
  Select,
  TableSkeleton,
  TextArea,
  TextInput,
  Toggle,
  useToast,
} from "../ui";

/** The value the parent select uses for "no parent" - a subcategory's parent is
 *  required, so this is only ever chosen for a new top-level aisle. */
const NO_PARENT = "";

type Draft = AdminCategoryInput;

const EMPTY: Draft = {
  name: "",
  description: "",
  parentId: null,
  featured: false,
  sortOrder: 0,
};

/** A drag in progress. `parentId` is null for the aisle list itself. */
interface DragState {
  parentId: string | null;
  id: string;
  from: number;
  over: number;
  below: boolean;
}

/** The row a pointer at `y` is over, from the live rects of one list. Rows are
 *  top-to-bottom; the first box still containing `y` wins, and a pointer below
 *  the last row targets the very end. */
function resolveDrop(
  rects: { top: number; height: number }[],
  y: number,
): { over: number; below: boolean } {
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (y <= r.top + r.height) return { over: i, below: isBelowMidpoint(r, y) };
  }
  return { over: Math.max(0, rects.length - 1), below: true };
}

/** Re-order `rows` to match `ids`, appending anything the ids do not mention so
 *  a brand-new row can never be silently hidden. */
function ordered<T extends { id: string }>(ids: readonly string[], rows: readonly T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const out: T[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row && !seen.has(id)) {
      seen.add(id);
      out.push(row);
    }
  }
  for (const row of rows) if (!seen.has(row.id)) out.push(row);
  return out;
}

export function CategoriesPage() {
  const data = useAdminData();
  const toast = useToast();
  const { data: tree, isLoading, error, refetch } = useAsync(() => data.listCategories(), [data]);
  const [editing, setEditing] = useState<AdminCategoryChild | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Which aisles are expanded. Default open: the tree is the point of the page. */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Memoised so the reset effect below has a stable dependency - `tree ?? []`
  // would hand it a fresh array every render and re-run it forever.
  const parents = useMemo(() => tree ?? [], [tree]);

  // The order on screen. Seeded from the real data and re-seeded whenever the
  // tree changes for any other reason (a create, a delete, a save) - but NOT
  // mid-drag, where a reset would yank the row out from under the pointer.
  const [order, setOrder] = useState<string[]>([]);
  const [childOrder, setChildOrder] = useState<Record<string, string[]>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rowEls = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (drag) return;
    setOrder(parents.map((p) => p.id));
    setChildOrder(Object.fromEntries(parents.map((p) => [p.id, p.children.map((c) => c.id)])));
  }, [parents, drag]);

  const aisles = ordered(order, parents);
  const childrenOf = (parent: AdminCategory) =>
    ordered(childOrder[parent.id] ?? parent.children.map((c) => c.id), parent.children);

  const totalChildren = parents.reduce((n, p) => n + p.children.length, 0);
  const idsFor = (parentId: string | null) =>
    parentId === null
      ? order
      : (childOrder[parentId] ?? parents.find((p) => p.id === parentId)?.children.map((c) => c.id) ?? []);
  const showOrder = (parentId: string | null, ids: string[]) => {
    if (parentId === null) setOrder(ids);
    else setChildOrder((prev) => ({ ...prev, [parentId]: ids }));
  };

  /** Persist a new sibling order and report honestly. On failure the view is put
   *  back the way it was and re-read from the database, so a rejected reorder can
   *  never leave the panel showing an order the store does not have. */
  const persistOrder = useCallback(
    async (parentId: string | null, ids: string[], rollback: () => void) => {
      setBusy(true);
      try {
        await data.reorderCategories(parentId, ids);
        toast.push("Order saved.");
      } catch (e) {
        rollback();
        toast.push(e instanceof Error ? e.message : "Could not save the new order.", "error");
      } finally {
        setBusy(false);
        refetch();
      }
    },
    [data, toast, refetch],
  );

  /** Move a row and save. Shared by a drop and by the arrow buttons. */
  const applyMove = (parentId: string | null, next: string[]) => {
    const current = idsFor(parentId);
    if (next.join() === current.join()) return;
    const snapshot = [...current];
    showOrder(parentId, next);
    void persistOrder(parentId, next, () => showOrder(parentId, snapshot));
  };

  const commitDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const current = idsFor(d.parentId);
    applyMove(d.parentId, moveItem(current, d.from, dropTarget(d.from, d.over, d.below)));
  };

  // A drag is driven by window listeners, not per-row pointer handlers: the
  // pointer regularly leaves the row it started on, and (unlike pointer capture)
  // this way the row under the finger can be read at every move.
  useEffect(() => {
    if (!drag) return;
    const key = (parentId: string | null) => (parentId === null ? "root" : parentId);
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const rects = idsFor(d.parentId)
        .map((id) => rowEls.current.get(`${key(d.parentId)}:${id}`))
        .filter((el): el is HTMLElement => Boolean(el))
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { top: r.top, height: r.height };
        });
      if (rects.length === 0) return;
      const next = { ...d, ...resolveDrop(rects, e.clientY) };
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = () => commitDrag();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, order, childOrder, parents]);

  const startDrag =
    (parentId: string | null, id: string, from: number) =>
    (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      const next: DragState = { parentId, id, from, over: from, below: false };
      dragRef.current = next;
      setDrag(next);
    };

  /** Move one row a single place - the accessible twin of a drag. */
  const nudge = (parentId: string | null, id: string, delta: number) =>
    applyMove(parentId, moveId(idsFor(parentId), id, delta));

  const openCreate = () => {
    setDraft({ ...EMPTY, sortOrder: parents.length });
    setCreating(true);
  };
  const openCreateChild = (parent: AdminCategory) => {
    setDraft({ ...EMPTY, parentId: parent.id, sortOrder: parent.children.length });
    setCreating(true);
  };
  const openEdit = (c: AdminCategory | AdminCategoryChild, parentId: string | null) => {
    setDraft({
      name: c.name,
      slug: c.slug,
      description: c.description,
      parentId,
      featured: c.featured,
      sortOrder: c.sortOrder,
    });
    setEditing(c);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.push("A category needs a name.", "error");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await data.updateCategory(editing.id, draft);
        toast.push("Category updated.");
      } else {
        await data.createCategory(draft);
        toast.push("Category created.");
      }
      close();
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Save failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await data.deleteCategory(pendingDelete.id);
      toast.push(`Deleted \u201c${pendingDelete.name}\u201d.`);
      setPendingDelete(null);
      refetch();
    } catch (e) {
      toast.push(e instanceof Error ? e.message : "Delete failed.", "error");
      setPendingDelete(null);
    }
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** The grip plus the two move buttons, shared by an aisle and a subcategory. */
  const reorderControls = (
    parentId: string | null,
    id: string,
    index: number,
    count: number,
    label: string,
  ) => (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onPointerDown={startDrag(parentId, id, index)}
        className={[
          "inline-flex h-9 w-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground/70",
          "hover:bg-secondary hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          drag?.id === id ? "bg-secondary text-foreground" : "",
        ].join(" ")}
        aria-label={`Drag to reorder ${label}`}
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => nudge(parentId, id, -1)}
          disabled={busy || index === 0}
          className="inline-flex h-4 w-7 items-center justify-center rounded-t-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={`Move ${label} up`}
          title="Move up"
        >
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => nudge(parentId, id, 1)}
          disabled={busy || index === count - 1}
          className="inline-flex h-4 w-7 items-center justify-center rounded-b-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={`Move ${label} down`}
          title="Move down"
        >
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  const rowActions = (id: string, name: string, onEdit: () => void) => (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label={`Edit ${name}`}
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setPendingDelete({ id, name })}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  /** The 2px line showing where a dragged row will land, drawn on the row being
   *  hovered - above or below its middle, so the drop is never ambiguous. */
  const dropLine = (parentId: string | null, index: number) => {
    if (!drag || drag.parentId !== parentId || drag.over !== index) return null;
    return (
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-primary",
          drag.below ? "-bottom-px" : "-top-px",
        ].join(" ")}
      />
    );
  };

  const registerRow = (key: string) => (el: HTMLElement | null) => {
    if (el) rowEls.current.set(key, el);
    else rowEls.current.delete(key);
  };

  return (
    <>
      <AdminPageHeader
        title="Categories"
        subtitle={`${parents.length} categories \u00b7 ${totalChildren} subcategories. Drag a row \u2014 or use the arrows \u2014 to set the order shoppers see.`}
        actions={
          <Btn onClick={openCreate}>
            <Plus className="h-4 w-4" /> New category
          </Btn>
        }
      />

      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : error ? (
        <ErrorPanel message={error} onRetry={refetch} />
      ) : parents.length === 0 ? (
        <div className="card-soft flex flex-col items-center gap-2 px-6 py-14 text-center">
          <span className="text-2xl">🐾</span>
          <h3 className="text-lg font-medium text-ink">No categories</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Create a category to organise your products.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {aisles.map((parent, parentIndex) => {
            const open = !collapsed.has(parent.id);
            const children = childrenOf(parent);
            return (
              <section
                key={parent.id}
                className={[
                  "card-soft overflow-hidden transition-shadow",
                  drag?.id === parent.id ? "ring-2 ring-primary/40" : "",
                ].join(" ")}
              >
                {/* ── The aisle ─────────────────────────────────────────── */}
                <div
                  ref={registerRow(`root:${parent.id}`)}
                  className="relative flex flex-wrap items-center gap-x-2 gap-y-2 p-3 sm:gap-x-3 sm:p-3.5"
                >
                  {dropLine(null, parentIndex)}
                  {reorderControls(null, parent.id, parentIndex, parents.length, parent.name)}

                  <button
                    type="button"
                    onClick={() => toggle(parent.id)}
                    aria-expanded={open}
                    aria-label={`${open ? "Collapse" : "Expand"} ${parent.name}`}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-input text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
                    disabled={parent.children.length === 0}
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${open && parent.children.length ? "rotate-90" : ""}`}
                    />
                  </button>

                  <div className="min-w-[8rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-sm font-bold text-ink">{parent.name}</h3>
                      {parent.featured && <Pill tone="teal">Featured</Pill>}
                    </div>
                    {/* The slug is secondary detail. In a narrow phone column it
                        was broken mid-word ("harnesse / s-accessories"), which
                        reads as a rendering bug; show it once the row has room. */}
                    <p className="mt-0.5 hidden break-words font-mono text-[11px] text-muted-foreground sm:block">
                      {parent.slug}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold tabular-nums text-ink">
                    {parent.productCount} product{parent.productCount === 1 ? "" : "s"}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {parent.children.length} sub{parent.children.length === 1 ? "" : "s"}
                  </span>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openCreateChild(parent)}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-input px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
                      aria-label={`Add a subcategory to ${parent.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" /> Sub
                    </button>
                    {rowActions(parent.id, parent.name, () => openEdit(parent, null))}
                  </div>
                </div>

                {/* ── Its subcategories ─────────────────────────────────── */}
                {open && children.length > 0 && (
                  <ul className="border-t border-line bg-muted/40">
                    {children.map((child, childIndex) => (
                      <li
                        key={child.id}
                        ref={registerRow(`${parent.id}:${child.id}`)}
                        className={[
                          "relative flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line/60 px-3 py-2 last:border-b-0 sm:gap-x-3 sm:px-4",
                          drag?.id === child.id ? "bg-secondary/60" : "",
                        ].join(" ")}
                      >
                        {dropLine(parent.id, childIndex)}
                        {reorderControls(parent.id, child.id, childIndex, children.length, child.name)}
                        <span className="min-w-[6rem] flex-1 break-words text-[13px] text-ink">
                          {child.name}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {child.productCount} product{child.productCount === 1 ? "" : "s"}
                        </span>
                        {child.featured && <Pill tone="teal">Featured</Pill>}
                        {rowActions(child.id, child.name, () => openEdit(child, parent.id))}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Modal
        open={creating || Boolean(editing)}
        onClose={close}
        title={editing ? `Edit ${editing.name}` : draft.parentId ? "New subcategory" : "New category"}
        footer={
          <>
            <Btn variant="outline" onClick={close}>
              Cancel
            </Btn>
            <Btn onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Btn>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Parent category"
            htmlFor="c-parent"
            hint="Leave as top level for an aisle, or pick the aisle this subcategory belongs to."
          >
            <Select
              id="c-parent"
              value={draft.parentId ?? NO_PARENT}
              onChange={(v) => setDraft({ ...draft, parentId: v || null })}
              options={[
                { value: NO_PARENT, label: "Top level (a main category)" },
                ...parents.map((p) => ({ value: p.id, label: `Subcategory of ${p.name}` })),
              ]}
            />
          </Field>
          <Field label="Name" htmlFor="c-name">
            <TextInput id="c-name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          </Field>
          <Field label="Description" htmlFor="c-desc">
            <TextArea
              id="c-desc"
              rows={3}
              value={draft.description}
              onChange={(v) => setDraft({ ...draft, description: v })}
            />
          </Field>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
            <Field label="Sort order" htmlFor="c-sort">
              <TextInput
                id="c-sort"
                inputMode="numeric"
                value={String(draft.sortOrder)}
                onChange={(v) => setDraft({ ...draft, sortOrder: Number(v) || 0 })}
              />
            </Field>
            <div className="flex items-end pb-2">
              <Toggle
                checked={draft.featured}
                onChange={(v) => setDraft({ ...draft, featured: v })}
                label="Featured"
              />
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete category?"
        body={`\u201c${pendingDelete?.name ?? ""}\u201d will be removed. Products keep their category label.`}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
