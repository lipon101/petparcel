// Catalog hooks - the storefront's ONLY source of product data is the API, which
// reads the real database. There is deliberately NO bundled/static fallback: a
// product grid must show the REAL catalogue or an honest loading/error/empty
// state, never fabricated demo rows. (The bundled catalog used to be seeded as
// `initialData` and served whenever a query errored or returned nothing, which
// meant a broken deployment silently rendered demo products as if they were
// real stock.)
//
// Each hook therefore reports `isLoading` / `isError` truthfully and returns an
// empty list until the API answers, so the pages can render their own skeleton,
// error and empty states (see components/site/Bits.tsx).
import { useMemo } from "react";
import { trpc } from "@/_core/trpc";
import type { StoreProduct, StoreReview } from "./types";
import { productImageUrls } from "@shared/product-media";
import {
  FEATURED_CATEGORY_COUNT,
  FOOTER_CATEGORY_COUNT,
  sortCategories,
  topCategories,
  type StoreCategoryNode,
} from "@shared/store";
import {
  HEADER_AISLE_LIMIT,
  curateFooterNav,
  curateHeaderNav,
  hiddenAisleCount,
} from "@shared/nav-curation";

export type CatalogSort = "featured" | "price-asc" | "price-desc" | "newest" | "name";

/** Rewrite a product's catalogue image paths onto the configured media base
 *  (R2 / a CDN) in ONE place, so every card, grid and gallery renders the same
 *  hosted URL. With no media base set this is the identity, so the very same
 *  code serves the repo-hosted default and an R2 deployment - which is what lets
 *  the repo carry no product bytes while nothing on the storefront changes. */
function withResolvedMedia<T extends { images: string[] }>(p: T): T {
  return { ...p, images: productImageUrls(p.images) };
}

export function useCatalogList(input: { category?: string; search?: string; sort?: CatalogSort }) {
  const q = trpc.catalog.list.useQuery(input);
  const products = (q.data ?? []).map(withResolvedMedia) as StoreProduct[];
  return {
    products,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
  };
}

export function useCatalogFeatured(limit = 4) {
  const q = trpc.catalog.featured.useQuery({ limit });
  const products = (q.data ?? []).map(withResolvedMedia) as StoreProduct[];
  return { products, isLoading: q.isLoading, isError: q.isError };
}

/** The home page "Just landed" rail: a DAILY-ROTATING pick of the catalogue,
 *  resolved server-side (a hash of the product id salted with the UTC date), so
 *  every visitor sees the same eight on a given day and the set rotates daily. */
export function useCatalogDailyRotation(limit = 8) {
  const q = trpc.catalog.dailyRotation.useQuery({ limit });
  const products = (q.data ?? []).map(withResolvedMedia) as StoreProduct[];
  return { products, isLoading: q.isLoading, isError: q.isError };
}

/** The home page "Our featured picks" rail: the owner's ordered picks when set,
 *  else the products flagged `featured`, else the newest - resolved server-side
 *  from the database, so an admin change shows up on the next load. */
export function useCatalogFeaturedPicks(limit = 4) {
  const q = trpc.catalog.featuredPicks.useQuery({ limit });
  const products = (q.data ?? []).map(withResolvedMedia) as StoreProduct[];
  return { products, isLoading: q.isLoading, isError: q.isError };
}

/** One resolved home page promo card: the real product plus the conversion copy
 *  derived from it. `source` says whether the product is the owner's explicit
 *  admin pick or a server-side fallback (the pick was missing/deleted). */
export interface PromoSlot {
  kind: "new_arrivals" | "best_sellers";
  product: StoreProduct;
  copy: { eyebrow: string; title: string; body: string; cta: string };
  source: "selected" | "fallback";
}

/** The home page's two promo cards, resolved from the database at request time.
 *  The owner's admin-selected product for each card wins; a deleted or
 *  unpublished pick falls back server-side, so the returned list is never a
 *  broken card - it is simply shorter (or empty) when there is nothing to show. */
export function useCatalogPromo() {
  const q = trpc.catalog.promo.useQuery();
  const slots = ((q.data ?? []) as PromoSlot[]).map((s) => ({
    ...s,
    product: withResolvedMedia(s.product),
  }));
  return { slots, isLoading: q.isLoading, isError: q.isError };
}

/** The browse tree: top-level aisles with their subcategories and live counts.
 *
 *  `categories` is the flat list of AISLE names (the same strings the header
 *  menus and the footer have always consumed), while `nodes` carries the full
 *  two-level shape the shop page's browse panel renders. Both come from the one
 *  query, so the row and the panel can never disagree. */
export function useCatalogCategories() {
  const q = trpc.catalog.categories.useQuery();
  const nodes = (q.data ?? []) as StoreCategoryNode[];
  const categories = useMemo(() => nodes.map((n) => n.name), [nodes]);
  return { nodes, categories, isLoading: q.isLoading, isError: q.isError };
}

/** The condensed category surfaces: `top` is the best handful (ranked by live
 *  stock), `all` is the complete list every "view all" link lands on.
 *
 *  `nav` / `footerNav` are the CURATED navigation lists (see
 *  shared/nav-curation.ts): aisles ranked by stock, capped, each with the few
 *  subcategories worth naming beside it. The header and the footer read these,
 *  so neither ever renders the whole taxonomy - `hiddenAisles` is what the cap
 *  is holding back, which the "shop all" link says out loud. */
export function useTopCategories(limit = FEATURED_CATEGORY_COUNT) {
  const countsQuery = trpc.catalog.categoryCounts.useQuery();
  const { nodes, categories } = useCatalogCategories();
  const counts = countsQuery.data ?? {};
  const all = sortCategories(categories);
  const nav = useMemo(() => curateHeaderNav(nodes), [nodes]);
  const footerNav = useMemo(() => curateFooterNav(nodes), [nodes]);
  return {
    top: topCategories(categories, limit, counts),
    // The footer's own, shorter cap: the same ranking at a different number, so
    // the two never disagree about which aisles rank highest.
    footerTop: topCategories(categories, FOOTER_CATEGORY_COUNT, counts),
    all,
    counts,
    nav,
    footerNav,
    hiddenAisles: hiddenAisleCount(nodes, HEADER_AISLE_LIMIT),
  };
}

export function useCatalogBySlug(slug: string) {
  const q = trpc.catalog.bySlug.useQuery({ slug }, { retry: false });
  const api = q.data as
    | { product: StoreProduct | null; reviews: StoreReview[]; related: StoreProduct[] }
    | undefined;
  return {
    product: api?.product ? withResolvedMedia(api.product) : null,
    reviews: api?.reviews ?? [],
    related: (api?.related ?? []).map(withResolvedMedia),
    isLoading: q.isLoading,
    isError: q.isError,
  };
}

export function useStoreReviews(limit = 6) {
  const q = trpc.reviews.store.useQuery({ limit });
  const reviews = (q.data ?? []) as StoreReview[];
  return { reviews, isLoading: q.isLoading, isError: q.isError };
}
