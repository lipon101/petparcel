// Shared presentational building blocks used across every page. Keeping them in
// one place is what makes the storefront look like one design instead of a set
// of screens — spacing, badges, stars and the empty/loading/error trio all come
// from here.
import type { ReactNode } from "react";
import { Link } from "wouter";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@shared/store";

// ── Section wrapper: consistent vertical rhythm on every page ────────────────
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
    <section className={cn("section", muted && "bg-secondary/40", className)}>
      <div className="container-page">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-3 sm:mb-10",
        align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{title}</h2>
        {subtitle && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Badges & chips ───────────────────────────────────────────────────────────
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
    muted: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    teal: "bg-secondary text-secondary-foreground ring-1 ring-inset ring-primary/15",
    coral: "bg-accent text-accent-foreground",
    amber: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
    green: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
    slate: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  };
  return <span className={cn("pill", tones[tone], className)}>{children}</span>;
}

export function Stars({
  rating,
  size = 14,
  showValue = false,
  count,
}: {
  rating: number;
  size?: number;
  showValue?: boolean;
  count?: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={cn(
              i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted",
            )}
          />
        ))}
      </span>
      {showValue && <span className="text-xs font-semibold text-muted-foreground">{rating.toFixed(1)}</span>}
      {typeof count === "number" && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </span>
  );
}

export function PriceTag({
  priceCents,
  compareAtCents,
  size = "md",
}: {
  priceCents: number;
  compareAtCents?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl sm:text-3xl",
  } as const;
  const onSale = typeof compareAtCents === "number" && compareAtCents > priceCents;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2">
      <span className={cn("font-extrabold tracking-tight", sizes[size])}>
        {formatMoney(priceCents)}
      </span>
      {onSale && (
        <span className="text-sm text-muted-foreground line-through">{formatMoney(compareAtCents)}</span>
      )}
    </span>
  );
}

// ── The designed empty / loading / error trio ────────────────────────────────
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
    <div className="card-soft flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
        {icon ?? <span className="text-2xl">🐾</span>}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading…", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body = "We couldn't load this just now. Try again in a moment.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<span className="text-2xl">⚠️</span>}
      title={title}
      body={body}
      action={
        onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Try again
          </button>
        ) : undefined
      }
    />
  );
}

// ── Trust strip: the social-proof band that appears under the hero ───────────
export function TrustStrip({
  items,
}: {
  items: readonly { title: string; body: string }[];
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.title} className="card-soft flex items-start gap-3 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            ✓
          </span>
          <span>
            <span className="block text-sm font-bold">{item.title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Buttons (anchor-friendly) ────────────────────────────────────────────────
const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition disabled:pointer-events-none disabled:opacity-60";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost";

export const buttonStyles = {
  primary: cn(buttonBase, "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"),
  accent: cn(buttonBase, "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"),
  outline: cn(buttonBase, "border border-input bg-card hover:bg-secondary"),
  ghost: cn(buttonBase, "hover:bg-secondary"),
  sizes: {
    sm: "h-9 px-4 text-sm",
    md: "h-11 px-6 text-sm",
    lg: "h-12 px-7 text-base",
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

// ── Breadcrumbs ─────────────────────────────────────────────────────────────
export function Breadcrumbs({ trail }: { trail: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5">
      <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {trail.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
            {crumb.to ? (
              <Link to={crumb.to} className="hover:text-foreground hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">{crumb.label}</span>
            )}
            {i < trail.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
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
    <Section>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </div>
    </Section>
  );
}
