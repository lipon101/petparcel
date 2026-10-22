// Shared admin UI primitives. Everything the panel's pages are built from:
// cards, stat tiles, a sortable + paginated data table, form fields, a modal,
// status pills, toasts and the loading/empty/error trio. Styling reuses the
// storefront's own design tokens (card-soft, btn, pill, the rose palette) so the
// panel reads as the same product, not a bolted-on tool.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { compareValues, pageItems, paginate, type SortDir, type SortState } from "./table";

// ── Layout ──────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card-soft", className)}>{children}</div>;
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "accent";

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled,
  type = "button",
  className,
  title,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const variants: Record<BtnVariant, string> = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    accent: "bg-accent text-accent-foreground hover:bg-accent/90",
    outline: "border border-input bg-card text-foreground hover:bg-secondary",
    ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
    danger: "border border-input text-destructive hover:bg-destructive/10",
  };
  const sizes = { sm: "h-9 px-3.5 text-xs", md: "h-11 px-5 text-sm" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

// ── Status pills ────────────────────────────────────────────────────────────
type Tone = "neutral" | "green" | "amber" | "rose" | "teal" | "slate" | "blue";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-secondary text-muted-foreground ring-border",
  green: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  rose: "bg-rose-100 text-rose-700 ring-rose-200",
  teal: "bg-teal-soft text-teal-deep ring-teal-soft",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-sky-100 text-sky-800 ring-sky-200",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ring-inset",
        TONE_CLASS[tone],
      )}
    >
      {children}
    </span>
  );
}

const ORDER_TONE: Record<string, Tone> = {
  pending: "amber",
  paid: "blue",
  processing: "blue",
  shipped: "teal",
  delivered: "green",
  cancelled: "rose",
};
const PAYMENT_TONE: Record<string, Tone> = {
  paid: "green",
  unpaid: "slate",
  failed: "rose",
  refunded: "amber",
};
const REVIEW_TONE: Record<string, Tone> = { pending: "amber", approved: "green", rejected: "rose" };
const MESSAGE_TONE: Record<string, Tone> = { new: "amber", read: "slate", replied: "green" };

export function StatusPill({ status, kind = "order" }: { status: string; kind?: "order" | "payment" | "review" | "message" }) {
  const map =
    kind === "payment" ? PAYMENT_TONE : kind === "review" ? REVIEW_TONE : kind === "message" ? MESSAGE_TONE : ORDER_TONE;
  return <Pill tone={map[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Pill>;
}

// ── Stat tile ───────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  hint?: string;
  tone?: "primary" | "amber" | "green" | "rose";
}) {
  const tones = {
    primary: "text-primary",
    amber: "text-amber-600",
    green: "text-emerald-600",
    rose: "text-rose-600",
  };
  return (
    <div className="card-soft p-5 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={cn("h-4 w-4", tones[tone])} />
      </div>
      <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Form fields ─────────────────────────────────────────────────────────────
const FIELD_CLS =
  "mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-ink" htmlFor={htmlFor}>
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  className,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email";
  className?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      inputMode={inputMode}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FIELD_CLS, className)}
    />
  );
}

export function TextArea({
  id,
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 w-full rounded-xl border border-input bg-card p-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
    />
  );
}

export function Select({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FIELD_CLS, className)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-full border border-input bg-card pl-9 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-72"
      />
    </div>
  );
}

// ── Modal ───────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={cn("card-soft my-8 w-full p-6", wide ? "max-w-3xl" : "max-w-lg")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-serif text-xl font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Btn variant="outline" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn variant="danger" onClick={onConfirm}>
            {confirmLabel}
          </Btn>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Modal>
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────
interface Toast {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
}
interface ToastCtx {
  push: (message: string, tone?: Toast["tone"]) => void;
}
const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ring-1 ring-inset",
              t.tone === "success" && "bg-emerald-600 text-white ring-emerald-700",
              t.tone === "error" && "bg-rose-600 text-white ring-rose-700",
              t.tone === "info" && "bg-ink text-white ring-ink",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  return ctx ?? { push: () => undefined };
}

// ── Pagination ──────────────────────────────────────────────────────────────
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPage,
  pageSize,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPage: (p: number) => void;
  pageSize?: number;
  onPageSize?: (n: number) => void;
}) {
  if (total === 0) return null;
  const items = pageItems(page, pageCount);
  const navBtn =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-input bg-card px-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        Showing <span className="font-semibold text-ink">{from}</span>–
        <span className="font-semibold text-ink">{to}</span> of{" "}
        <span className="font-semibold text-ink">{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {pageSize != null && onPageSize && (
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="h-9 rounded-full border border-input bg-card px-3 text-xs font-semibold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            className={navBtn}
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          {items.map((it, i) =>
            it === "ellipsis" ? (
              <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={it}
                type="button"
                onClick={() => onPage(it)}
                aria-label={`Page ${it}`}
                aria-current={it === page ? "page" : undefined}
                className={cn(
                  navBtn,
                  it === page && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {it}
              </button>
            ),
          )}

          <button
            type="button"
            className={navBtn}
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}

// ── Data table ──────────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  /** Value used for sorting; defaults to `row[key]`. */
  sortValue?: (row: T) => unknown;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  pageSize = 10,
  initialSort = null,
  emptyTitle = "Nothing here yet",
  emptyBody = "There is nothing to show.",
  onRowClick,
  selection,
  mobileCard,
  fixed = false,
  pagination = true,
}: {
  rows: readonly T[];
  columns: Column<T>[];
  pageSize?: number;
  initialSort?: SortState | null;
  emptyTitle?: string;
  emptyBody?: string;
  onRowClick?: (row: T) => void;
  /** Optional multi-select. `isSelectable` guards individual rows (e.g. the
   *  owner account can never be ticked); the header checkbox acts on the rows
   *  currently on this page only. */
  selection?: {
    selected: ReadonlySet<string>;
    onChange: (next: Set<string>) => void;
    isSelectable?: (row: T) => boolean;
  };
  /** Optional narrow-screen renderer. When supplied, the table is shown from
   *  `md` up and this card list below it, so a wide table never forces a
   *  sideways scroll on a phone. */
  mobileCard?: (row: T) => ReactNode;
  /** Use a fixed table layout so the column widths are honoured and long cells
   *  truncate instead of stretching the table past its container. */
  fixed?: boolean;
  /** Whether to render the table's OWN pager. Leave it on (the default) when
   *  the table holds the WHOLE list and sorts/filters/pages it in the browser.
   *  Turn it OFF when the caller pages on the SERVER and renders its own
   *  `Pagination` from the server's total - otherwise both controls render and
   *  the user sees two stacked pagers. */
  pagination?: boolean;
}) {
  const [sort, setSort] = useState<SortState | null>(initialSort);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);

  // Reset to page 1 whenever the underlying rows change shape (a filter or a
  // delete), so the user is never stranded on an empty page.
  useEffect(() => {
    setPage(1);
  }, [rows.length]);

  const sorted = useMemo(() => {
    if (!sort) return [...rows];
    const col = columns.find((c) => c.key === sort.key);
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col?.sortValue ? col.sortValue(a) : (a as unknown as Record<string, unknown>)[sort.key];
      const bv = col?.sortValue ? col.sortValue(b) : (b as unknown as Record<string, unknown>)[sort.key];
      return factor * compareValues(av, bv);
    });
  }, [rows, sort, columns]);

  const paged = useMemo(() => paginate(sorted, page, size), [sorted, page, size]);

  // Multi-select: only rows on the CURRENT page are affected by the header
  // checkbox, and a row for which `isSelectable` returns false (the owner
  // account) can never be ticked.
  const selectableOnPage = useMemo(
    () => (selection ? paged.rows.filter((r) => selection.isSelectable?.(r) ?? true) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paged.rows, selection],
  );
  const allOnPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((r) => selection?.selected.has(r.id));
  const toggleAllOnPage = () => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allOnPageSelected) selectableOnPage.forEach((r) => next.delete(r.id));
    else selectableOnPage.forEach((r) => next.add(r.id));
    selection.onChange(next);
  };
  const toggleOne = (id: string) => {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onChange(next);
  };

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      const dir: SortDir = prev.dir === "asc" ? "desc" : "asc";
      return { key, dir };
    });
  };

  if (rows.length === 0) {
    return (
      <div className="card-soft flex flex-col items-center gap-2 px-6 py-14 text-center">
        <span className="text-2xl">🐾</span>
        <h3 className="text-lg font-medium text-ink">{emptyTitle}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div>
      {mobileCard ? (
        <ul className="space-y-3 md:hidden">
          {paged.rows.map((row) => (
            <li key={row.id}>{mobileCard(row)}</li>
          ))}
        </ul>
      ) : null}
      <div className={cn("card-soft overflow-hidden", mobileCard && "hidden md:block")}>
        {/* Mobile-only cue: a wide table scrolls sideways rather than crushing
            its columns. The scroll container is keyboard-focusable and labelled
            so it is reachable and understandable without a pointer. Shown only
            when there is no card fallback - a table with one never scrolls. */}
        {!mobileCard && (
          <p className="px-4 pt-3 text-xs text-muted-foreground sm:hidden">
            Swipe the table sideways to see every column.
          </p>
        )}
        <div
          className={cn(
            "overscroll-x-contain",
            mobileCard || fixed ? "overflow-x-hidden" : "overflow-x-auto",
          )}
          role="region"
          aria-label="Data table"
          tabIndex={0}
        >
          <table className={cn("w-full text-sm tabular-nums", fixed && "table-fixed")}>
            <thead className="sticky top-0 z-10 bg-secondary/95 text-left backdrop-blur">
              <tr>
                {selection && (
                  <th scope="col" className="w-11 px-3 py-3 sm:px-4">
                    <input
                      type="checkbox"
                      aria-label="Select every row on this page"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                      className="h-4 w-4 cursor-pointer rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </th>
                )}
                {columns.map((col) => {
                  const active = sort?.key === col.key;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap px-3 py-3 font-bold text-ink sm:px-4",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.className,
                      )}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-label={`Sort by ${col.header}`}
                        >
                          {col.header}
                          {active ? (
                            sort?.dir === "asc" ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 opacity-30" />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paged.rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn("border-t border-border transition-colors", onRowClick && "cursor-pointer hover:bg-secondary/40")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {selection && (
                    <td className="px-3 py-3 align-middle sm:px-4" onClick={(e) => e.stopPropagation()}>
                      {selection.isSelectable?.(row) ?? true ? (
                        <input
                          type="checkbox"
                          aria-label={`Select row ${row.id}`}
                          checked={selection.selected.has(row.id)}
                          onChange={() => toggleOne(row.id)}
                          className="h-4 w-4 cursor-pointer rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      ) : (
                        <span className="block h-4 w-4" aria-hidden="true" />
                      )}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-3 align-middle sm:px-4",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.className,
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pagination && (
        <Pagination
          page={paged.page}
          pageCount={paged.pageCount}
          from={paged.from}
          to={paged.to}
          total={paged.total}
          onPage={setPage}
          pageSize={size}
          onPageSize={(n) => {
            setSize(n);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}

// ── Loading / error ─────────────────────────────────────────────────────────
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl border border-line-soft bg-white" />
      ))}
    </div>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card-soft flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="text-2xl">⚠️</span>
      <h3 className="text-lg font-medium text-ink">We couldn't load this</h3>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Btn variant="primary" onClick={onRetry}>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Btn>
      )}
    </div>
  );
}