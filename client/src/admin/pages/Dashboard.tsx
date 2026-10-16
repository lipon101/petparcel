// Admin dashboard: the KPIs a store owner checks first - revenue, orders,
// products, customers, low stock - plus a 14-day revenue area chart, best
// sellers and the most recent orders. All figures come from the data source's
// `getKpis()`, which computes them from the same rows the other pages show.
import { useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  ArrowUpRight,
  Inbox,
  Mail,
  MessageSquare,
  Package,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { adminPath } from "@/_core/admin-path";
import { formatDate, formatMoney } from "@shared/store";
import { useAdminData } from "../data-source";
import { useAsync } from "../use-async";
import { axisLabel, axisTickIndices, niceCeil } from "../chart-axis";
import { AdminPageHeader, Card, ErrorPanel, StatCard, StatusPill, TableSkeleton } from "../ui";

// niceCeil / axisLabel / axisTickIndices live in ../chart-axis so the chart's
// axis arithmetic is unit-testable without a DOM.

// A smooth revenue AREA chart, hand-rolled as inline SVG so it adds no
// dependency (the repo ships no chart library) and stays fully responsive: the
// SVG uses a fixed viewBox and `w-full`, so it scales to any width - including
// 375px - with no overflow and no horizontal scroll. The curve is a Catmull-Rom
// spline converted to cubic beziers (smooth interpolation), filled with a
// vertical gradient under the line. A hover tooltip reads the nearest point.
function RevenueChart({ points }: { points: { date: string; cents: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);

  // Geometry in viewBox units. The SVG scales to the container, so these are
  // ratios, not pixels - nothing here can force the card wider than the viewport.
  const W = 700;
  const H = 220;
  const PAD_X = 8;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 30;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;

  const n = points.length;
  const max = Math.max(0, ...points.map((p) => p.cents));
  // A "nice" axis maximum with a $1 floor when there is no revenue at all: a
  // zero-length axis made two ticks round to the SAME label ("$0.01" twice).
  const axisMax = niceCeil(max) || 100;
  const xAt = (i: number) => (n <= 1 ? PAD_X + innerW / 2 : PAD_X + (i / (n - 1)) * innerW);
  const yAt = (cents: number) => PAD_TOP + innerH - (cents / axisMax) * innerH;

  const coords = points.map((p, i) => ({ x: xAt(i), y: yAt(p.cents), ...p }));

  // Catmull-Rom -> cubic bezier. `tension` 0.5 is the standard smoothing.
  const linePath = (() => {
    if (coords.length === 0) return "";
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
    const t = 0.5;
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i - 1] ?? coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[i + 2] ?? p2;
      const c1x = p1.x + ((p2.x - p0.x) / 6) * t * 2;
      const c1y = p1.y + ((p2.y - p0.y) / 6) * t * 2;
      const c2x = p2.x - ((p3.x - p1.x) / 6) * t * 2;
      const c2y = p2.y - ((p3.y - p1.y) / 6) * t * 2;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  })();

  const areaPath =
    coords.length === 0
      ? ""
      : `${linePath} L ${coords[coords.length - 1].x} ${PAD_TOP + innerH} L ${coords[0].x} ${PAD_TOP + innerH} Z`;

  // Top-to-bottom gridlines with their value labels. A repeated label (possible
  // on a very small axis) is blanked, so the axis never shows one amount twice.
  const gridLines = [1, 0.5, 0].map((f) => ({ y: yAt(axisMax * f), value: Math.round(axisMax * f) }));
  const gridLabels = gridLines.map((g) => formatMoney(g.value));
  const shownLabels = gridLabels.map((l, i) => (i > 0 && l === gridLabels[i - 1] ? "" : l));

  const active = hover != null ? coords[hover] : null;

  // Four evenly spaced X-axis ticks, so the labels never crowd each other at any
  // width. The window is the real last-14-days series the server generated, so
  // the last tick is always today.
  const tickIdx = axisTickIndices(n);
  const ticks = tickIdx.map((i) => ({ i, label: axisLabel(points[i]?.date ?? "") }));
  const allZero = points.every((p) => p.cents === 0);

  return (
    <div className="relative w-full">
      {/* Y-axis value labels, kept OUTSIDE the SVG so `preserveAspectRatio="none"`
          cannot stretch the text. They sit in a fixed-width gutter. */}
      <div className="flex gap-2">
        <div className="flex h-44 w-10 shrink-0 flex-col justify-between py-1 text-right text-[10px] font-medium tabular-nums text-muted-foreground sm:h-52">
          {shownLabels.map((l, i) => (
            <span key={gridLines[i].y}>{l}</span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-44 w-full sm:h-52"
            preserveAspectRatio="none"
            role="img"
            aria-label="Revenue over the last 14 days"
            onMouseLeave={() => setHover(null)}
          >
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pink, #eb3594)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--pink, #eb3594)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {gridLines.map((g) => (
          <line
            key={g.y}
            x1={PAD_X}
            x2={W - PAD_X}
            y1={g.y}
            y2={g.y}
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {areaPath && <path d={areaPath} fill="url(#revFill)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--pink, #eb3594)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {coords.map((c, i) => (
          <g key={c.date}>
            {/* Invisible full-height hit area so hovering anywhere in the column works. */}
            <rect
              x={xAt(i) - innerW / Math.max(1, n) / 2}
              y={PAD_TOP}
              width={innerW / Math.max(1, n)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            {hover === i && (
              <>
                <line
                  x1={c.x}
                  x2={c.x}
                  y1={PAD_TOP}
                  y2={PAD_TOP + innerH}
                  stroke="var(--pink, #eb3594)"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                <circle cx={c.x} cy={c.y} r="4" fill="var(--pink, #eb3594)" stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </g>
        ))}
          </svg>

          {/* Axis labels: four evenly spaced dates, kept OUTSIDE the SVG so they
              never scale with the viewBox and stay legible at every width. */}
          <div className="mt-1.5 flex justify-between gap-2 px-1 text-[10px] font-medium tabular-nums text-muted-foreground">
            {ticks.map((t) => (
              <span key={t.i} className="whitespace-nowrap">
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {active && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
          {axisLabel(active.date)} · {formatMoney(active.cents)}
        </div>
      )}

      {/* An all-zero window is a real "no paid orders yet", not a broken chart -
          say so plainly rather than leaving an empty frame. */}
      {allZero && (
        <p className="mt-3 text-center text-xs font-medium text-muted-foreground">
          No paid orders in this window yet - the line sits at $0.
        </p>
      )}
    </div>
  );
}

export function DashboardPage() {
  const data = useAdminData();
  const { data: kpis, isLoading, error, refetch } = useAsync(() => data.getKpis(), [data]);

  // 30-day revenue comparison, computed from the two real totals the server
  // returns. A previous window of zero has no meaningful percentage, so it is
  // shown as "New" rather than a divide-by-zero.
  const rev30 = kpis?.revenue30dCents ?? 0;
  const revPrev = kpis?.revenuePrev30dCents ?? 0;
  const deltaCents = rev30 - revPrev;
  const deltaUp = deltaCents >= 0;
  const deltaPct = revPrev > 0 ? Math.round((deltaCents / revPrev) * 100) : null;

  return (
    <>
      <AdminPageHeader title="Dashboard" subtitle="Revenue, orders and fulfilment at a glance." />
      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : error || !kpis ? (
        <ErrorPanel message={error ?? "No data."} onRetry={refetch} />
      ) : (
        <div className="dash-canvas">
        <div className="space-y-6">
          {/* Hero: the two numbers an owner opens the panel for, given the
              weight they deserve, with the secondary figures as a quiet strip
              beneath. Every value is live from the database. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="dash-hero">
              <div className="dash-hero-top">
                <span className="dash-hero-label">Revenue (paid)</span>
                <span className="dash-hero-badge" aria-label={`${kpis.orderCount} ${kpis.orderCount === 1 ? "order" : "orders"}`}>
                  <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="dash-hero-badge-num">{kpis.orderCount}</span>
                  <span>{kpis.orderCount === 1 ? "order" : "orders"}</span>
                </span>
              </div>
              <p className="dash-hero-value">{formatMoney(kpis.revenueCents)}</p>
              {/* 30-day comparison: the last 30 days against the 30 before it,
                  both real totals from paid orders. The delta is derived here so
                  the hero never shows a placeholder figure. */}
              <p className="dash-hero-delta">
                <span className={deltaUp ? "dash-delta dash-delta--up" : "dash-delta dash-delta--down"}>
                  {deltaUp ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
                  {deltaPct === null ? "New" : `${deltaUp ? "+" : ""}${deltaPct}%`}
                </span>
                <span className="dash-hero-delta-note">
                  {formatMoney(kpis.revenue30dCents)} last 30 days vs {formatMoney(kpis.revenuePrev30dCents)} the 30 before
                </span>
              </p>
              <div className="dash-hero-foot">
                <span>
                  <strong>{formatMoney(kpis.averageOrderCents)}</strong> average order
                </span>
                <span className="dash-hero-dot" aria-hidden="true" />
                <span>
                  <strong>{kpis.customerCount}</strong> paying {kpis.customerCount === 1 ? "customer" : "customers"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Products" value={String(kpis.productCount)} icon={Package} hint={`${kpis.lowStockCount} low on stock`} tone="amber" />
              <StatCard label="Customers" value={String(kpis.customerCount)} icon={Users} hint="With a paid order" />
              <StatCard label="Users" value={String(kpis.userCount)} icon={UserRound} hint="Registered accounts" tone="green" />
              <StatCard label="Subscribers" value={String(kpis.subscriberCount)} icon={Mail} hint="Newsletter" tone="green" />
            </div>
          </div>

          {/* The inbox strip: things that need a human, each a link to its page. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-3">
            <Link to={adminPath("reviews")} className="dash-attn">
              <span className="dash-attn-icon dash-attn-icon--amber">
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="dash-attn-value">{kpis.pendingReviews}</span>
                <span className="dash-attn-label">Pending reviews</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
            <Link to={adminPath("messages")} className="dash-attn">
              <span className="dash-attn-icon dash-attn-icon--rose">
                <Inbox className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="dash-attn-value">{kpis.newMessages}</span>
                <span className="dash-attn-label">New messages</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
            <Link to={adminPath("inventory")} className="dash-attn">
              <span className="dash-attn-icon dash-attn-icon--amber">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="dash-attn-value">{kpis.lowStockCount}</span>
                <span className="dash-attn-label">Low on stock</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-bold text-ink">Revenue - last 14 days</h2>
              <span className="text-xs font-semibold text-muted-foreground">Paid orders only</span>
            </div>
            <div className="mt-5">
              <RevenueChart points={kpis.revenueByDay} />
            </div>
          </Card>

          {/* Below xl the content column must be a `minmax(0,1fr)` track, not an
              implicit auto one: an auto track floors at the WIDEST card's
              max-content, which stretched the dashboard past the viewport on a
              phone. minmax(0,...) lets it shrink so the cards wrap inside. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="h-fit p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
                  <TrendingUp className="h-5 w-5 text-primary" /> Best sellers
                </h2>
                <Link to={adminPath("products")} className="text-xs font-semibold text-primary hover:underline">
                  Manage
                </Link>
              </div>
              {kpis.topProducts.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No sales recorded yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {kpis.topProducts.map((p, i) => (
                    <li key={p.name} className="flex items-center gap-3 text-sm">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-bold tabular-nums text-primary">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">{p.units} sold</span>
                      </span>
                      <span className="font-bold tabular-nums text-ink">{formatMoney(p.revenueCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="h-fit p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-ink">
                  <AlertTriangle className="h-5 w-5 text-amber-600" /> Low stock
                </h2>
                <Link to={adminPath("inventory")} className="text-xs font-semibold text-primary hover:underline">
                  Manage
                </Link>
              </div>
              {kpis.lowStock.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Every variant is comfortably stocked.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {kpis.lowStock.slice(0, 6).map((row) => (
                    <li key={row.id} className="flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{row.productName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {row.variantName} · SKU {row.sku}
                        </span>
                      </span>
                      <span
                        className={
                          row.inventoryQty <= 0
                            ? "rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200"
                            : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-200"
                        }
                      >
                        {row.inventoryQty} left
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold text-ink">Recent orders</h2>
              <Link to={adminPath("orders")} className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>
            {kpis.recentOrders.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {kpis.recentOrders.map((o) => (
                  <li key={o.id}>
                    <Link
                      to={adminPath(`orders/${o.id}`)}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 transition hover:bg-secondary/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-sm font-bold text-ink">{o.orderNumber}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {o.email} · {formatDate(o.createdAt)}
                        </span>
                      </span>
                      <span className="text-sm font-extrabold tabular-nums text-ink">{formatMoney(o.totalCents)}</span>
                      <StatusPill status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        </div>
      )}
    </>
  );
}
