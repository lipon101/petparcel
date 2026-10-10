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
    <section className={cn("section", muted && "surface-mesh", className)}>
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
        "mb-8 flex flex-col gap-4 sm:mb-12",
        align === "center" ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && (
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-accent">
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <h2 className="text-[1.7rem] font-extrabold leading-[1.12] sm:text-4xl lg:text-[2.6rem]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground sm:text-base">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Entrance wrapper: a short mount animation with the final state as the resting
 *  state, so content is always present — never gated behind a scroll event.
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

// ── Badges & chips ────────────────────────────────────────────────────────────
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
    muted: "bg-card/95 text-muted-foreground ring-1 ring-inset ring-border backdrop-blur",
    teal: "bg-secondary text-secondary-foreground ring-1 ring-inset ring-primary/15",
    coral: "bg-accent text-accent-foreground shadow-sm",
    amber: "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-200",
    green: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200",
    slate: "bg-slate-900/85 text-white backdrop-blur",
  };
  return (
    <span className={cn("pill shadow-xs", tones[tone], className)}>{children}</span>
  );
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
    <span
      className="inline-flex items-center gap-1.5"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
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
      {showValue && (
        <span className="text-xs font-bold tracking-tight text-foreground">{rating.toFixed(1)}</span>
      )}
      {typeof count === "number" && <span className="text-xs text-muted-foreground">({count})</span>}
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
        <span className="text-sm font-medium text-muted-foreground line-through">
          {formatMoney(compareAtCents)}
        </span>
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
    <div className="card-premium flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary">
        {icon ?? <span className="text-2xl">🐾</span>}
      </div>
      <h3 className="mt-1 text-lg font-bold">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-3">{action}</div>}
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
            className={cn(buttonStyles.primary, buttonStyles.sizes.md, "btn-sheen")}
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
        <li
          key={item.title}
          className="card-premium flex items-start gap-3.5 p-5"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary ring-1 ring-inset ring-primary/12">
            ✓
          </span>
          <span>
            <span className="block text-sm font-bold">{item.title}</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
              {item.body}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Buttons (anchor-friendly) ────────────────────────────────────────────────
const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost";

export const buttonStyles = {
  primary: cn(
    buttonBase,
    "btn-sheen bg-primary text-primary-foreground shadow-[var(--shadow-md)] hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-[var(--shadow-lg)] active:translate-y-0",
  ),
  accent: cn(
    buttonBase,
    "btn-sheen bg-accent text-accent-foreground shadow-[var(--shadow-md)] hover:-translate-y-0.5 hover:bg-accent/92 hover:shadow-[var(--shadow-lg)] active:translate-y-0",
  ),
  outline: cn(
    buttonBase,
    "border border-border bg-card text-foreground shadow-xs hover:-translate-y-0.5 hover:border-primary/40 hover:bg-secondary/60 hover:shadow-[var(--shadow-sm)] active:translate-y-0",
  ),
  ghost: cn(buttonBase, "text-foreground hover:bg-secondary/70"),
  sizes: {
    sm: "h-9.5 px-4 text-[13px]",
    md: "h-11 px-6 text-sm",
    lg: "h-13 px-8 text-[15px]",
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

// ── Breadcrumbs ──────────────────────────────────────────────────────────────
export function Breadcrumbs({ trail }: { trail: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {trail.map((crumb, i) => (
          <li key={`${crumb.label}-${i}`} className="flex items-center gap-2">
            {crumb.to ? (
              <Link to={crumb.to} className="transition hover:text-foreground hover:underline">
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
        <h1 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className="divider-glow my-8" />
        <div className="space-y-6 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </div>
      </div>
    </Section>
  );
}
