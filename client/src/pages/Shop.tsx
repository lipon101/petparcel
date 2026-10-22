// Shop - the full catalogue with category filter, search and sort. Filters live
// in the URL, so a filtered view is linkable, shareable and indexable.
import { useMemo } from "react";
import { Link, useSearch } from "wouter";
import { ChevronRight, PackageSearch, SlidersHorizontal, ShoppingBag, X } from "lucide-react";
import { useSeo, sanitizeSearchTerm, searchEcho } from "@/lib/petparcel";
import { useCatalogCategories, useCatalogList } from "@/lib/useCatalog";
import { STORE_URL, sortCategories } from "@shared/store";
import {
  Breadcrumbs,
  CtaLink,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  ProductGridSkeleton,
  Section,
} from "@/components/site/Bits";
import { ProductGrid, type StoreProduct } from "@/components/site/ProductCard";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "A-Z" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

/** Products per page. 20 fills a 4 x 5 grid exactly, so the last row of a full
 *  page is never a lonely single card. */
export const SHOP_PAGE_SIZE = 20;

export default function Shop() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const category = params.get("category") ?? "All";
  // The query is normalised once, then every echo (heading, JSON-LD, empty
  // state, chip) and the API filter use the same value - so a malicious string
  // can never reach a heading, a meta tag or the JSON-LD unescaped.
  const rawQ = params.get("q") ?? "";
  // The cleaned term is filtered on; the ECHO is gated separately so a query
  // that had to be sanitised still filters but is never repeated as page copy.
  const q = sanitizeSearchTerm(rawQ);
  const qDisplay = searchEcho(rawQ);
  const sort = (params.get("sort") ?? "featured") as SortValue;
  // 1-based page from the URL, clamped to a sane positive integer. The page is
  // part of the URL so a page is linkable and shareable, and the browser's back
  // button walks the pages the way a shopper expects.
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);

  const { products: apiProducts, isLoading, isError, refetch } = useCatalogList({
    category: category === "All" ? undefined : category,
    search: q || undefined,
    sort,
  });
  const { nodes, categories } = useCatalogCategories();

  const cats = useMemo(() => ["All", ...sortCategories(categories)], [categories]);
  const allProducts = apiProducts as StoreProduct[];
  // Paginate the already-filtered list on the client: the API returns the whole
  // filtered set in one read (the catalogue is small enough that this is one
  // round trip, not a waterfall), and slicing here keeps page changes instant
  // with no extra request. A page past the end clamps to the last real page, so
  // a stale link never shows an empty grid.
  const pageCount = Math.max(1, Math.ceil(allProducts.length / SHOP_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const products = useMemo(
    () => allProducts.slice((currentPage - 1) * SHOP_PAGE_SIZE, currentPage * SHOP_PAGE_SIZE),
    [allProducts, currentPage],
  );
  const rangeStart = allProducts.length === 0 ? 0 : (currentPage - 1) * SHOP_PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * SHOP_PAGE_SIZE, allProducts.length);

  // The browse tree: selecting an aisle reveals its subcategories as a second
  // row, so a shopper can narrow "Pet Toys" down to "Pet Chew Toys" without
  // leaving the page. The PARENT stays marked active while one of its children
  // is selected, so the two rows read as one "where am I" answer. A category
  // the tree does not know (an admin-invented aisle) simply has no children and
  // behaves exactly as before.
  const activeParent = useMemo(
    () =>
      nodes.find((n) => n.name === category) ??
      nodes.find((n) => n.children.some((c) => c.name === category)) ??
      null,
    [nodes, category],
  );
  const subcats = activeParent?.children ?? [];

  // The heading is the category name, once. It used to append "supplies",
  // which read as a second label next to the category chip and made every
  // aisle look like it had a duplicated title.
  const heading =
    category !== "All" ? category : qDisplay ? `Results for “${qDisplay}”` : "Every product we stock";

  useSeo(
    useMemo(
      () => ({
        title: category !== "All" ? `${category} - Shop` : "Shop All Pet Supplies",
        description: `Shop ${
          category === "All" ? "pet supplies" : category.toLowerCase()
        } at PetParcel. Fast, tracked shipping across the USA and 30-day returns.`,
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

  const buildHref = (next: { category?: string; sort?: string; q?: string; page?: number }) => {
    const p = new URLSearchParams(search);
    Object.entries(next).forEach(([k, v]) => {
      if (k === "page") {
        // Page 1 is the default, so it is dropped from the URL.
        if (!v || v === 1) p.delete(k);
        else p.set(k, String(v));
        return;
      }
      if (!v || v === "All" || (k === "sort" && v === "featured") || (k === "category" && v === "All")) {
        p.delete(k);
      } else {
        p.set(k, String(v));
      }
    });
    // Any change to the FILTERS (category / sort / search) resets to page 1 -
    // staying on page 4 of a different result set would show an empty grid.
    if (next.category !== undefined || next.sort !== undefined || next.q !== undefined) {
      p.delete("page");
    }
    const s = p.toString();
    return `/shop${s ? `?${s}` : ""}`;
  };

  // A page link keeps the current filters and only moves the page.
  const pageHref = (n: number) => buildHref({ page: n });

  return (
    <>
      <PageHeader
        eyebrow="Shop"
        title={heading}
        subtitle={
          allProducts.length === 0
            ? "fast, tracked US shipping · 30-day returns"
            : `${allProducts.length} product${allProducts.length === 1 ? "" : "s"} · showing ${rangeStart}–${rangeEnd} · fast, tracked US shipping · 30-day returns`
        }
      />

      <Section className="!pt-9">
        <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Shop" }]} />

        {/* ── Filter bar ─────────────────────────────────────────────────────── */}
        <div className="mb-8 rounded-[14px] border border-line bg-white p-4">
          {/* Aisle row: every top-level category, then the sort control. */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Category
              </span>
              {cats.map((c) => (
                <Link
                  key={c}
                  to={buildHref({ category: c })}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] transition-all",
                    (c === "All" ? category === "All" : activeParent?.name === c)
                      ? "bg-teal text-white"
                      : "border border-line text-ink hover:border-teal hover:text-teal",
                  )}
                >
                  {c}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {qDisplay && (
                <Link
                  to={buildHref({ q: "" })}
                  className="inline-flex items-center gap-1.5 rounded-full bg-coral-soft px-3.5 py-1.5 text-[12.5px] font-semibold text-coral-deep"
                >
                  “{qDisplay}” <X className="h-3.5 w-3.5" />
                </Link>
              )}
              <label className="flex items-center gap-2 text-[13px]">
                <span className="text-gray">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => {
                    window.location.href = buildHref({ sort: e.target.value });
                  }}
                  className="field h-10 w-auto py-0 pr-8 pl-3 text-[13px] font-medium"
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

          {/* Subcategory row: shown only once an aisle with children is picked.
              “All <Aisle>” clears the narrowing without leaving the aisle. */}
          {subcats.length > 0 && activeParent && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
              <span className="inline-flex items-center gap-1 pr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray">
                <ChevronRight className="h-3.5 w-3.5" /> {activeParent.name}
              </span>
              <Link
                to={buildHref({ category: activeParent.name })}
                className={cn(
                  "rounded-full px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] transition-all",
                  category === activeParent.name
                    ? "bg-teal-soft text-teal-deep ring-1 ring-inset ring-teal-soft"
                    : "border border-line text-ink hover:border-teal hover:text-teal",
                )}
              >
                All
              </Link>
              {subcats.map((c) => (
                <Link
                  key={c.id}
                  to={buildHref({ category: c.name })}
                  className={cn(
                    "rounded-full px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] transition-all",
                    category === c.name
                      ? "bg-teal-soft text-teal-deep ring-1 ring-inset ring-teal-soft"
                      : "border border-line text-ink hover:border-teal hover:text-teal",
                  )}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Results ────────────────────────────────────────────────────────── */}
        {isLoading && products.length === 0 ? (
          <ProductGridSkeleton count={8} />
        ) : isError && products.length === 0 ? (
          <ErrorState
            title="We couldn't load the catalogue"
            body="The store is having a moment. Retrying usually fixes it."
            onRetry={() => refetch()}
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="h-6 w-6" />}
            title={qDisplay ? `No matches for “${qDisplay}”` : "Nothing here yet"}
            body={
              qDisplay
                ? "Try a broader search, or browse a category - we carry everything from food and beds to toys and grooming."
                : "This category is empty right now. Check back soon, or browse the full catalogue."
            }
            action={
              <CtaLink to="/shop" variant="outline">
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Browse all products
              </CtaLink>
            }
          />
        ) : (
          <>
            <ProductGrid products={products} />
            <Pagination page={currentPage} pageCount={pageCount} buildHref={pageHref} />
          </>
        )}

        {/* ── SEO copy block ─────────────────────────────────────────────────── */}
        <div className="mt-14 max-w-3xl border-t border-line pt-8">
          <h2 className="text-xl font-medium">Pet supplies shipped fast across the USA</h2>
          <p className="mt-3 text-sm leading-relaxed text-gray">
            Shop the full range of pet supplies for dogs, cats, birds, fish and small pets - food and
            treats, beds and furniture, crates and carriers, harnesses, collars and leashes, apparel,
            grooming, health and supplements, feeders and fountains, litter boxes, toys, training gear
            and travel accessories. Every order is dispatched fast and tracked the whole way. Shipping is a
            flat, clearly-shown rate at checkout. Every
            product carries a 30-day return window, and our support team answers by email or phone
            during business hours.
          </p>
        </div>
      </Section>
    </>
  );
}
