// Shop — catalog with category filter, search, sort and a responsive grid.
// Filters live in the URL so a filtered view is linkable and shareable.
import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { PackageSearch, SlidersHorizontal, X } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useSeo } from "@/lib/petparcel";
import { STORE_URL, sortCategories } from "@shared/store";
import {
  Breadcrumbs,
  CtaLink,
  EmptyState,
  ErrorState,
  ProductGridSkeleton,
  Section,
  SectionHeading,
} from "@/components/site/Bits";
import { ProductGrid, type StoreProduct } from "@/components/site/ProductCard";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "A–Z" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

export default function Shop() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const category = params.get("category") ?? "All";
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") ?? "featured") as SortValue;

  const { data, isLoading, isError, refetch } = trpc.catalog.list.useQuery({
    category: category === "All" ? undefined : category,
    search: q || undefined,
    sort,
  });
  const { data: categories } = trpc.catalog.categories.useQuery(undefined, { staleTime: 60_000 });

  const cats = useMemo(() => ["All", ...sortCategories(categories ?? [])], [categories]);
  const products = (data ?? []) as StoreProduct[];

  const heading =
    category !== "All" ? `${category} supplies` : q ? `Results for “${q}”` : "Every product we stock";

  useSeo(
    useMemo(
      () => ({
        title: category !== "All" ? `${category} Supplies — Shop` : "Shop All Pet Supplies",
        description: `Browse PetParcel's range of ${
          category === "All" ? "pet supplies" : category.toLowerCase() + " supplies"
        }. Free US shipping over $49, 30-day returns, ships from the USA.`,
        path: `/shop${category !== "All" ? `?category=${encodeURIComponent(category)}` : ""}`,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: heading,
          url: `${STORE_URL}/shop`,
          about: { "@type": "Thing", name: "Pet supplies" },
        },
      }),
      [category, heading],
    ),
  );

  const buildHref = (next: { category?: string; sort?: string; q?: string }) => {
    const p = new URLSearchParams(search);
    Object.entries(next).forEach(([k, v]) => {
      if (!v || v === "All" || (k === "sort" && v === "featured") || (k === "category" && v === "All")) {
        p.delete(k);
      } else {
        p.set(k, v);
      }
    });
    const s = p.toString();
    return `/shop${s ? `?${s}` : ""}`;
  };

  return (
    <Section className="!pt-8">
      <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Shop" }]} />

      <SectionHeading
        eyebrow="Catalog"
        title={heading}
        subtitle={`${products.length} product${products.length === 1 ? "" : "s"} · free US shipping over $49 · ${
          "30-day returns"
        }`}
      />

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 pr-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Category
          </span>
          {cats.map((c) => (
            <Link
              key={c}
              to={buildHref({ category: c })}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground ring-1 ring-inset ring-border hover:bg-secondary",
              )}
            >
              {c}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {q && (
            <Link
              to={buildHref({ q: "" })}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold"
            >
              “{q}” <X className="h-3.5 w-3.5" />
            </Link>
          )}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort</span>
            <select
              value={sort}
              onChange={(e) => {
                window.location.href = buildHref({ sort: e.target.value });
              }}
              className="h-10 rounded-full border border-input bg-card px-3 text-sm font-semibold"
            >
              {SORTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : isError ? (
        <ErrorState
          title="We couldn't load the catalog"
          body="The store is having a moment. Retrying usually fixes it."
          onRetry={() => refetch()}
        />
      ) : products.length === 0 ? (
        <EmptyState
          icon={<PackageSearch className="h-6 w-6" />}
          title={q ? `No matches for “${q}”` : "Nothing here yet"}
          body={
            q
              ? "Try a broader search, or browse a category — we stock a deliberately small range so everything is worth a look."
              : "This category is empty right now. Check back soon, or browse the full catalog."
          }
          action={
            <CtaLink to="/shop" variant="outline">
              Browse all products
            </CtaLink>
          }
        />
      ) : (
        <ProductGrid products={products} />
      )}

      {/* ── SEO copy block ───────────────────────────────────────────────── */}
      <div className="mt-14 max-w-3xl">
        <h2 className="text-xl font-bold">Pet supplies shipped free across the USA</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          PetParcel stocks a curated range of dog and cat essentials — orthopedic beds, no-pull harnesses,
          enrichment puzzles, grooming tools and cat furniture. Everything is held in US warehouses, so your
          order leaves within one business day and arrives in 3–6 business days. Orders over $49 ship free
          anywhere in the United States; below that shipping is a flat $5.99. Every product comes with a
          30-day return window, and our support team is reachable by email or phone during business hours.
        </p>
      </div>
    </Section>
  );
}
