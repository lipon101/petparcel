// Shared presentational building blocks used across every page. Keeping them in
// one place is what makes the storefront look like one design instead of a set
// of screens - the section header rhythm, badges, stars, prices and the
// empty/loading/error trio all come from here.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Truck, RotateCcw, ShieldCheck, Headset, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { reviewerGender } from "@shared/reviewers";
import { formatMoney } from "@shared/store";

// ── Section wrapper: consistent vertical rhythm on every page ───────────────
export function Section({
  children,
  className,
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section className={cn("section", muted && "sec-bg-soft", className)}>
      <div className="container-page">{children}</div>
    </section>
  );
}

/** The reference section header: a small tracked eyebrow over a light-weight
 *  title, with an optional "View all" link pinned to the right. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  actionLabel = "View all",
  actionTo,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  actionLabel?: string;
  actionTo?: string;
  align?: "left" | "center";
  className?: string;
}) {
  const right =
    action ??
    (actionTo ? (
      <Link to={actionTo} className="view-all">
        {actionLabel} 
      </Link>
    ) : null);

  return (
    <div className={cn("section-head", align === "center" && "justify-center", className)}>
      <div className={cn(align === "center" ? "text-center" : "max-w-2xl")}>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="section-title">{title}</h2>
        {subtitle && (
          <p className={cn("mt-3 text-[14.5px] leading-relaxed text-gray", align === "center" && "mx-auto max-w-2xl")}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/** Inner-page header band: soft teal wash, centred title, optional sub-line. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-hero">
      <div className="container-page">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

/** Entrance wrapper: a short mount animation with the final state as the resting
 *  state, so content is always present - never gated behind a scroll event.
 *  The CSS honours prefers-reduced-motion and the class is a no-op without it. */
export function Reveal({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn("animate-in-up", className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

// ── Badges & chips ──────────────────────────────────────────────────────────
export function Chip({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "teal" | "coral" | "amber" | "green" | "slate";
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-blush text-gray",
    teal: "bg-teal-soft text-teal-deep",
    coral: "bg-coral text-white",
    amber: "bg-amber-100 text-amber-900",
    green: "bg-emerald-100 text-emerald-800",
    slate: "bg-ink/85 text-white backdrop-blur",
  };
  return <span className={cn("pill", tones[tone], className)}>{children}</span>;
}

/** The reference product badge - a small rounded uppercase label in the corner
 *  of a product image. */
export function Badge({
  children,
  variant = "sale",
  className,
}: {
  children: ReactNode;
  variant?: "new" | "best" | "sale" | "out";
  className?: string;
}) {
  const variants = {
    new: "badge badge-new",
    best: "badge badge-best",
    sale: "badge badge-sale",
    out: "badge badge-out",
  } as const;
  return <span className={cn(variants[variant], className)}>{children}</span>;
}

export function Stars({
  rating,
  size = 13,
  showValue = false,
  count,
  className,
}: {
  rating: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  className?: string;
}) {
  const rounded = Math.round(rating);
  return (
    <span
      className={cn("p-rating", className)}
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      <span className="stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={cn("star", i <= rounded && "filled")}
            width={size}
            height={size}
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </span>
      {showValue && <span className="text-[12.5px] font-semibold text-ink">{rating.toFixed(1)}</span>}
      {typeof count === "number" && <span className="rating-count">({count})</span>}
    </span>
  );
}

// ── Reviewer mark ──────────────────────────────────────────────────────────
// A small male or female silhouette, drawn inline so it costs no request and
// takes the brand colour from the chip it sits in. It sits where the reviewer's
// initial used to, immediately before the name and on the name's own baseline,
// so the caption reads as a person rather than as a string of letters. A name
// we have no gender for falls back to the initial, so nothing ever renders
// blank. Purely decorative: the name beside it is what assistive tech reads.
function MaleMark() {
  return (
    <>
      <circle cx="12" cy="7.4" r="3.9" />
      <path d="M12 13.1c-4.1 0-6.9 2.5-6.9 6.2 0 1 .8 1.7 1.8 1.7h10.2c1 0 1.8-.7 1.8-1.7 0-3.7-2.8-6.2-6.9-6.2Z" />
    </>
  );
}

function FemaleMark() {
  return (
    <>
      {/* Tapered shoulders plus the longer hair silhouette, so the mark reads
          as female at 14px without needing any colour besides the chip's. */}
      <path d="M12 13.1c-3.4 0-5.8 2.2-6.4 5.4-.2 1.1-.6 1.8-1.1 2.3-.4.5 0 1.2.7 1.2h13.6c.7 0 1.1-.7.7-1.2-.5-.5-.9-1.2-1.1-2.3-.6-3.2-3-5.4-6.4-5.4Z" />
      <path d="M12 2.9c-3 0-5.2 2.2-5.2 5.2 0 1.7.6 3 1.6 3.9V9c0-1.7 1.6-2.9 3.6-2.9S15.6 7.3 15.6 9v3c1-.9 1.6-2.2 1.6-3.9 0-3-2.2-5.2-5.2-5.2Z" />
    </>
  );
}

/** The small round chip that sits before a reviewer's name. */
export function ReviewerMark({ name, className }: { name: string; className?: string }) {
  const gender = reviewerGender(name);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal-deep",
        className,
      )}
      aria-hidden="true"
    >
      {gender ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-[15px] w-[15px]">
          {gender === "male" ? <MaleMark /> : <FemaleMark />}
        </svg>
      ) : (
        <span className="text-[11px] font-bold">{name.charAt(0)}</span>
      )}
    </span>
  );
}

/** Price line: coral current price with an optional struck-through was-price. */
export function PriceTag({
  priceCents,
  compareAtCents,
  size = "md",
  className,
}: {
  priceCents: number;
  compareAtCents?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "text-[16px]",
    md: "text-[18px]",
    lg: "text-[26px] sm:text-[30px]",
  } as const;
  const onSale = typeof compareAtCents === "number" && compareAtCents > priceCents;
  return (
    <span className={cn("p-price", className)}>
      <span className="price-now" style={{ fontSize: size === "lg" ? undefined : undefined }}>
        <span className={cn(size !== "md" && sizes[size])}>{formatMoney(priceCents)}</span>
      </span>
      {onSale && <span className="price-was">{formatMoney(compareAtCents)}</span>}
    </span>
  );
}

// ── The designed empty / loading / error trio ──────────────────────────────
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-soft flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-soft text-teal">
        {icon ?? <span className="text-2xl">🐾</span>}
      </div>
      <h3 className="mt-1 text-lg font-medium">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-gray">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-xl border border-line-soft bg-white"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-[14px] border border-line-soft bg-white">
          <div className="aspect-square animate-pulse bg-blush" />
          <div className="space-y-2.5 p-3.5">
            <div className="h-2.5 w-16 animate-pulse rounded bg-blush" />
            <div className="h-3.5 w-full animate-pulse rounded bg-blush" />
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-blush" />
            <div className="h-5 w-20 animate-pulse rounded bg-blush" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body = "Something went wrong on our end. Retrying usually fixes it.",
  onRetry,
}: {
  title?: string;
  body: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<span className="text-2xl">⚠️</span>}
      title={title}
      body={body}
      action={
        onRetry ? (
          <button type="button" onClick={onRetry} className="btn btn-primary btn-md">
            Try again
          </button>
        ) : undefined
      }
    />
  );
}

// ── Feature strip: the four-icon band under the hero ───────────────────────
const FEATURE_ICONS = [Truck, RotateCcw, ShieldCheck, Headset] as const;

export function TrustStrip({
  items,
}: {
  items: readonly { title: string; body: string }[];
}) {
  return (
    <div className="features-grid">
      {items.map((item, i) => {
        const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
        return (
          <div key={item.title} className="feature-item">
            <span className="feature-ic">
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="feature-title block">{item.title}</span>
              <span className="feature-sub block">{item.body}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Buttons (anchor-friendly) ──────────────────────────────────────────────
export type ButtonVariant = "primary" | "accent" | "ink" | "outline" | "ghost";

export const buttonStyles = {
  primary: "btn btn-primary",
  accent: "btn btn-accent",
  ink: "btn btn-ink",
  outline: "btn btn-outline",
  ghost: "btn btn-ghost",
  sizes: {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg",
  },
};

export function CtaLink({
  to,
  children,
  variant = "primary",
  size = "md",
  className,
  onClick,
}: {
  to: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(buttonStyles[variant], buttonStyles.sizes[size], className)}
    >
      {children}
    </Link>
  );
}

// ── Breadcrumbs ────────────────────────────────────────────────────────────
export function Breadcrumbs({ trail }: { trail: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-gray">
        {trail.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
            {crumb.to ? (
              <Link to={crumb.to} className="transition-colors hover:text-coral">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-ink">{crumb.label}</span>
            )}
            {i < trail.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────
// The shop's page control. Brand-styled to match the filter pills: a rounded
// bar with prev/next arrows and numbered pages, the current page filled in the
// store's teal. Long runs collapse to an ellipsis so the control never wraps
// into a second row, and every control is a real link (so a page is linkable,
// shareable and crawlable) rather than a button that mutates state.
export function Pagination({
  page,
  pageCount,
  buildHref,
  className,
}: {
  page: number;
  pageCount: number;
  /** Build the href for a given 1-based page number. */
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  // The window of page numbers to show: always the first and last, the current
  // page and its neighbours, with an ellipsis where a run is skipped.
  const pages: (number | "gap")[] = [];
  const push = (n: number | "gap") => pages.push(n);
  const window = 1;
  const last = pageCount;
  for (let n = 1; n <= last; n++) {
    if (n === 1 || n === last || (n >= page - window && n <= page + window)) {
      push(n);
    } else if (pages[pages.length - 1] !== "gap") {
      push("gap");
    }
  }

  const arrow =
    "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-semibold text-ink transition-all hover:border-teal hover:text-teal";
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Pagination" className={cn("mt-10 flex flex-wrap items-center justify-center gap-2", className)}>
      <Link
        to={buildHref(page - 1)}
        aria-label="Previous page"
        aria-disabled={page <= 1}
        className={cn(arrow, page <= 1 && disabled)}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Prev</span>
      </Link>

      {pages.map((p, i) =>
        p === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-gray" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={p}
            to={buildHref(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[13px] font-semibold tabular-nums transition-all",
              p === page
                ? "bg-teal text-white shadow-[var(--shadow-sm)]"
                : "border border-line text-ink hover:border-teal hover:text-teal",
            )}
          >
            {p}
          </Link>
        ),
      )}

      <Link
        to={buildHref(page + 1)}
        aria-label="Next page"
        aria-disabled={page >= pageCount}
        className={cn(arrow, page >= pageCount && disabled)}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}

export function PolicyPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow="Customer care" title={title} subtitle={`Last updated ${updated}`} />
      <Section>
        <div className="mx-auto max-w-3xl">
          <div className="space-y-6 text-[15px] leading-relaxed text-gray [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-ink [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
            {children}
          </div>
        </div>
      </Section>
    </>
  );
}
