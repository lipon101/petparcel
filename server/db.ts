// ── AGENT-OWNED: business data-access ────────────────────────────────────────
// All SQL lives here so tRPC procedures stay thin. Every user-scoped read/write
// filters by the owner id passed in from `ctx.user.id`.
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { atomic, db, isUniqueViolation } from "./_core/db";
import { CATALOG_DATA } from "../shared/catalog-data";
import { decideProductDeletion } from "../shared/product-lifecycle";
import type { ProductSpecs } from "../shared/product-specs";
import {
  canonicalCategory as canonicaliseCategory,
  categoryEquivalents,
} from "../shared/category-taxonomy";
import {
  categoryWithDescendants,
  treeParentNames,
} from "../shared/category-tree";
import { escapeLike, likeContains, sanitizeSearchTerm, searchTokens } from "../shared/search-term";
import {
  lastPageOffset,
  pageCountFor,
  pageForOffset,
  type Paginated,
  type ResolvedPaging,
} from "../shared/admin-paging";
import { orderTotalCents, shippingCentsFor, taxCentsFor } from "../shared/money";
import {
  addresses,
  cartItems,
  carts,
  categories,
  contactMessages,
  emailLog,
  jobRunClaims,
  newsletterSubscribers,
  orderEvents,
  orderItems,
  orders,
  productVariants,
  products,
  reviews,
  telegramOutbox,
  userProfiles,
  users,
  wishlistItems,
} from "../drizzle/schema";
import type { EmailLog, NewsletterSubscriber, Order, OrderEvent, OrderItem, Product, ProductVariant, Review, TelegramOutboxRow } from "../drizzle/schema";
import { newOrderNumber, LOW_STOCK_THRESHOLD, type AddressSnapshot } from "../shared/store";
import { ADMIN_ACCOUNT_UNDELETABLE_MESSAGE, isAdminRole } from "./_core/admin-access";
import { getSettings } from "./store-settings";

/** Normalise a raw driver result to an array of rows. `db.execute` returns
 *  `{ rows }` on the `pg` driver but a bare array on Neon's http driver. */
function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  const rows = (result as { rows?: unknown })?.rows;
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

/**
 * The most units of a single line the store will accept.
 *
 * Mirrors `cartLineSchema`'s `.max(99)` in server/routers.ts. The schema is the
 * first line of defence and this is the authoritative one: an unbounded quantity
 * turns a legitimate unit price into an arbitrary total, so a caller that
 * somehow reached `createOrder` without passing the schema (a future internal
 * caller, a script) is refused here rather than trusted.
 */
export const MAX_LINE_QTY = 99;

export class OutOfStockError extends Error {
  constructor(public readonly productName: string) {
    super(`Sorry - ${productName} just sold out. Please adjust your cart and try again.`);
    this.name = "OutOfStockError";
  }
}

/** `atomic` needs a non-empty tuple; every helper below builds one entry, so this
 *  cast is safe at each call site. */
function batch(stmts: BatchItem<"pg">[]): [BatchItem<"pg">, ...BatchItem<"pg">[]] {
  return stmts as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]];
}

// ─────────────────────────────────────────────────────────────────────────────
// Profiles
// ─────────────────────────────────────────────────────────────────────────────
export async function getProfile(userId: string) {
  const [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return row ?? null;
}

export async function upsertProfile(userId: string, data: { fullName?: string | null; phone?: string | null }) {
  const [row] = await db
    .insert(userProfiles)
    .values({ userId, fullName: data.fullName ?? null, phone: data.phone ?? null })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        fullName: data.fullName ?? null,
        phone: data.phone ?? null,
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// Addresses (owner-scoped)
// ─────────────────────────────────────────────────────────────────────────────
export type AddressInput = {
  label?: string | null;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  phone?: string | null;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

export async function listAddresses(userId: string) {
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefaultShipping), desc(addresses.createdAt));
}

export async function createAddress(userId: string, input: AddressInput) {
  const id = crypto.randomUUID();
  const makeShipping = input.isDefaultShipping ?? false;
  const makeBilling = input.isDefaultBilling ?? false;

  const existing = await db.select({ id: addresses.id }).from(addresses).where(eq(addresses.userId, userId));
  const isFirst = existing.length === 0;

  const stmts: BatchItem<"pg">[] = [];
  if (existing.length > 0 && makeShipping) {
    stmts.push(db.update(addresses).set({ isDefaultShipping: false }).where(eq(addresses.userId, userId)));
  }
  if (existing.length > 0 && makeBilling) {
    stmts.push(db.update(addresses).set({ isDefaultBilling: false }).where(eq(addresses.userId, userId)));
  }
  stmts.push(
    db.insert(addresses).values({
      id,
      userId,
      label: input.label ?? null,
      fullName: input.fullName,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country ?? "US",
      phone: input.phone ?? null,
      isDefaultShipping: makeShipping || isFirst,
      isDefaultBilling: makeBilling,
    }),
  );

  await atomic(() => batch(stmts));
  const [row] = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
  return row;
}

export async function updateAddress(id: string, userId: string, input: AddressInput) {
  const stmts: BatchItem<"pg">[] = [];
  if (input.isDefaultShipping) {
    stmts.push(
      db
        .update(addresses)
        .set({ isDefaultShipping: false })
        .where(and(eq(addresses.userId, userId), ne(addresses.id, id))),
    );
  }
  if (input.isDefaultBilling) {
    stmts.push(
      db
        .update(addresses)
        .set({ isDefaultBilling: false })
        .where(and(eq(addresses.userId, userId), ne(addresses.id, id))),
    );
  }
  stmts.push(
    db
      .update(addresses)
      .set({
        label: input.label ?? null,
        fullName: input.fullName,
        line1: input.line1,
        line2: input.line2 ?? null,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country ?? "US",
        phone: input.phone ?? null,
        isDefaultShipping: input.isDefaultShipping ?? false,
        isDefaultBilling: input.isDefaultBilling ?? false,
      })
      .where(and(eq(addresses.id, id), eq(addresses.userId, userId))),
  );
  await atomic(() => batch(stmts));
  const [row] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function deleteAddress(id: string, userId: string) {
  // Owner-scoped: the WHERE guarantees a user can only delete their own row.
  await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, userId)));
  return { ok: true };
}

/** The address checkout should pre-fill: default shipping, else the newest. */
export async function getDefaultAddress(userId: string) {
  const [row] = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefaultShipping), desc(addresses.createdAt))
    .limit(1);
  return row ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Products & variants
// ─────────────────────────────────────────────────────────────────────────────
export type ProductWithVariants = Product & {
  variants: ProductVariant[];
  /** Real aggregate from the reviews table - null when a product has none yet. */
  rating?: number | null;
  reviewCount?: number;
};

export async function listVariantsForProducts(productIds: string[]): Promise<ProductVariant[]> {
  if (productIds.length === 0) return [];
  return db
    .select()
    .from(productVariants)
    .where(inArray(productVariants.productId, productIds))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt));
}

function attachVariants(list: Product[], variants: ProductVariant[]): ProductWithVariants[] {
  const byProduct = new Map<string, ProductVariant[]>();
  for (const v of variants) {
    const arr = byProduct.get(v.productId) ?? [];
    arr.push(v);
    byProduct.set(v.productId, arr);
  }
  return list.map((p) => ({ ...p, variants: byProduct.get(p.id) ?? [] }));
}

/** Real per-product rating aggregates, so a card never shows an invented count. */
async function ratingsForProducts(
  productIds: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const map = new Map<string, { avg: number; count: number }>();
  if (productIds.length === 0) return map;
  const rows = await db
    .select({
      productId: reviews.productId,
      avg: sql<number>`avg(${reviews.rating})`,
      count: count(),
    })
    .from(reviews)
    .where(
      and(
        inArray(reviews.productId, productIds),
        eq(reviews.status, "approved"),
        eq(reviews.isPublic, true),
      ),
    )
    .groupBy(reviews.productId);
  for (const r of rows) {
    if (r.productId) map.set(r.productId, { avg: Number(r.avg), count: Number(r.count) });
  }
  return map;
}

function attachRatings(
  list: ProductWithVariants[],
  ratings: Map<string, { avg: number; count: number }>,
): ProductWithVariants[] {
  return list.map((p) => {
    const r = ratings.get(p.id);
    return { ...p, rating: r ? Math.round(r.avg * 10) / 10 : null, reviewCount: r?.count ?? 0 };
  });
}

export type ProductSort = "featured" | "price-asc" | "price-desc" | "newest" | "name";

// ── Category-name tolerance ──────────────────────────────────────────────────
// The rules live in shared/category-taxonomy.ts so they carry no database import
// and can be unit tested directly. `canonicalCategory` needs the catalog's
// current taxonomy, which is the only thing this file adds.
const CATALOG_CATEGORIES: ReadonlySet<string> = new Set(CATALOG_DATA.map((p) => p.category));

const optCategoryEquivalents = categoryEquivalents;
const canonicalCategory = (stored: string) => canonicaliseCategory(stored, CATALOG_CATEGORIES);

/** Every stored category string a filter for `name` should match.
 *
 *  Three ideas combine here, and all three are needed for the browse tree to
 *  work:
 *   1. the name itself;
 *   2. the SUBCATEGORIES filed under it, so selecting an aisle shows the gear
 *      stored on its children rather than an empty grid (see
 *      `categoryWithDescendants` in shared/category-tree.ts);
 *   3. any LEGACY name the row was written under before a rename, so a product
 *      saved as "Feeding" still appears under "Feeders & Fountains".
 *
 *  An empty array means "no predicate at all" - no filter, or the "All"
 *  sentinel the shop page passes. */
/** The `term%` pattern that matches a name STARTING with the term - the
 *  highest-relevance case in the product ranking above. */
function escapeLikeHead(token: string): string {
  return `${escapeLike(token)}%`;
}

function categoryFilterValues(name?: string): string[] {
  if (!name || name === "All") return [];
  const values = new Set<string>();
  for (const n of categoryWithDescendants(name)) {
    for (const v of optCategoryEquivalents(n)) values.add(v);
  }
  return [...values];
}

export async function listProducts(opts: {
  category?: string;
  search?: string;
  sort?: ProductSort;
  includeInactive?: boolean;
  /** Include products DELETED while they had order history. Off by default, so
   *  an archived product is absent from the storefront AND the admin list. */
  includeArchived?: boolean;
  limit?: number;
}): Promise<ProductWithVariants[]> {
  const where: SQL[] = [];
  if (!opts.includeInactive) where.push(eq(products.active, true));
  // An ARCHIVED product (deleted while it had order history) is excluded from
  // every read, exactly like an unpublished one - it is gone from the owner's
  // point of view while the row survives for the orders that reference it.
  if (!opts.includeArchived) where.push(eq(products.archived, false));
  // The category filter is matched against the shared catalog's taxonomy AND the
  // browse tree's subcategories, not the stored string alone, so a row written
  // under an older name still appears under the aisle it belongs to now, and an
  // aisle with subcategories shows their products too (see `categoryFilterValues`).
  const storedCategories = categoryFilterValues(opts.category);
  if (storedCategories.length === 1) {
    where.push(eq(products.category, storedCategories[0]));
  } else if (storedCategories.length > 1) {
    where.push(inArray(products.category, storedCategories));
  }
  // SEARCH: every token must match, each one as a literal substring.
  //
  // Three things changed here and all three were real defects.
  //
  // 1. The term used to be interpolated into a LIKE pattern UNESCAPED, so a
  //    shopper's `%` or `_` was a wildcard: "50%" matched the entire catalogue
  //    and "%%%%" turned a bounded ILIKE into a scan of every product row.
  //    `likeContains` escapes the metacharacters, so what the shopper typed is
  //    what is matched.
  // 2. A multi-word query used to be one contiguous `%a b c%` substring, which
  //    only matched when the words appeared in that exact order and adjacency.
  //    "dog bed large" found nothing while the product name is "Large Dog Bed".
  //    Each token is now matched on its own and the clauses are ANDed, so word
  //    order stops mattering while a query with more words still narrows.
  // 3. A non-empty query that yielded no usable token ("%%%", "!@#$", "S") fell
  //    through to NO filter at all and answered with the whole catalogue - 98
  //    products presented as though they matched. A query that cannot match
  //    anything now honestly returns nothing, which is the clean empty state.
  const term = (opts.search ?? "").trim();
  const tokens = searchTokens(term);
  // A term that was REQUESTED but yields no usable token must answer with
  // NOTHING, never with the whole catalogue. "Requested" is judged on the RAW
  // value, before trimming: a caller signalling "filter on this" hands us a
  // non-empty string even when it reduces to whitespace (a lone no-break space,
  // a run of `%`). Testing the TRIMMED term instead let exactly those through to
  // an unfiltered list, because the sentinel trimmed down to "".
  if ((opts.search ?? "").length > 0 && tokens.length === 0) return [];
  for (const token of tokens) {
    const like = likeContains(token);
    const forToken = or(
      ilike(products.name, like),
      ilike(products.description, like),
      ilike(products.category, like),
    );
    if (forToken) where.push(forToken);
  }

  // RELEVANCE. When a search narrowed the list, the default ordering used to be
  // `featured, sortOrder, name` - which says nothing about the query. Rank the
  // rows a shopper is actually looking at: a name that STARTS with the query
  // first, then one that CONTAINS it, then a match found only in the description
  // or category. Ties keep the catalogue order so the result is stable.
  const ranked = tokens.length > 0;
  const relevance = ranked
    ? [
        desc(sql`case when ${products.name} ilike ${escapeLikeHead(tokens[0])} then 2
                      when ${products.name} ilike ${likeContains(tokens[0])} then 1
                      else 0 end`),
      ]
    : [];

  const orderBy =
    opts.sort === "price-asc"
      ? [asc(products.priceCents)]
      : opts.sort === "price-desc"
        ? [desc(products.priceCents)]
        : opts.sort === "newest"
          ? [desc(products.createdAt)]
          : opts.sort === "name"
            ? [asc(products.name)]
            : [desc(products.featured), asc(products.sortOrder), asc(products.name)];

  // Sorted so the full list always reads in catalog order, regardless of the
  // order the database happened to return the rows in. A search adds the
  // relevance key FIRST, so the best matches lead and the storefront's chosen
  // ordering breaks ties rather than overriding the ranking.
  const rows = await db
    .select()
    .from(products)
    .where(where.length ? and(...where) : undefined)
    .orderBy(...relevance, ...orderBy)
    .limit(opts.limit ?? 200);

  // Reported under the name used now, so an aisle the taxonomy has since
  // renamed does not surface as a category the storefront cannot filter.
  const withVariants = rows.map((r) => ({ ...r, category: canonicalCategory(r.category) }));
  const attached = attachVariants(withVariants, await listVariantsForProducts(rows.map((r) => r.id)));
  return attachRatings(attached, await ratingsForProducts(rows.map((r) => r.id)));
}

export async function listFeaturedProducts(limit = 8): Promise<ProductWithVariants[]> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.active, true), eq(products.archived, false), eq(products.featured, true)))
    .orderBy(asc(products.sortOrder), asc(products.name))
    .limit(limit);
  if (rows.length > 0) {
    const withVariants = attachVariants(rows, await listVariantsForProducts(rows.map((r) => r.id)));
    return attachRatings(withVariants, await ratingsForProducts(rows.map((r) => r.id)));
  }
  // Fall back to the newest active products so the home page is never empty.
  return listProducts({ sort: "newest", limit });
}

/** The home page "Our featured picks" rail, in the OWNER'S chosen order.
 *
 *  `ids` is the ordered list the admin saved. Only ACTIVE, non-archived products
 *  are returned, and the result keeps the owner's order (a deleted or
 *  unpublished pick is simply absent, so the rail shortens rather than breaking).
 *  When the owner has chosen nothing, this falls back to the products flagged
 *  `featured`, then the newest - so the rail is never empty. */
export async function listFeaturedPicks(ids: string[], limit = 4): Promise<ProductWithVariants[]> {
  const wanted = ids.map((s) => s.trim()).filter(Boolean).slice(0, limit);
  if (wanted.length > 0) {
    const rows = await getActiveProductsByIds(wanted);
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = wanted.map((id) => byId.get(id)).filter((r): r is ProductWithVariants => Boolean(r));
    if (ordered.length > 0) return ordered;
  }
  // Automatic mode: the products flagged `featured`, then the newest, topped up
  // to `limit` so the rail always shows a full row (four by default) even when
  // fewer products carry the flag. Nothing is invented - the top-up is real
  // active products, and a product already in the set is never repeated.
  const flagged = await listFeaturedProducts(limit);
  if (flagged.length >= limit) return flagged.slice(0, limit);
  const seen = new Set(flagged.map((p) => p.id));
  const newest = await listProducts({ sort: "newest", limit: limit + flagged.length });
  const out = [...flagged];
  for (const p of newest) {
    if (out.length >= limit) break;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

/** The home page "Just landed" rail: a DAILY-ROTATING pick of the catalogue.
 *
 *  WHY NOT "the newest 8". The catalogue is a fixed set of products, so ordering
 *  by `createdAt` showed the SAME eight items every day - the section read as
 *  static and the rest of the range was never surfaced. This picks a fresh eight
 *  each day instead.
 *
 *  DETERMINISTIC AND STABLE WITHIN A DAY. The order is a hash of the product id
 *  salted with the UTC date, computed IN SQL, so every visitor sees the same
 *  eight on a given day and the set rotates at midnight UTC. No app-level
 *  randomness and no stored state: the same query returns the same rows for the
 *  whole day, and a different set tomorrow. Nothing is hardcoded - the pool is
 *  every active, non-archived product.
 *
 *  `md5(id || date)` is used rather than `random()` precisely because it is a
 *  pure function of (row, day): a random() would reshuffle on every request, so
 *  two shoppers would see different "new arrivals" and a refresh would move the
 *  products under the cursor. */
export async function listDailyRotation(limit = 8, day = new Date()): Promise<ProductWithVariants[]> {
  // The UTC calendar day, as YYYY-MM-DD - the salt that makes the pick rotate
  // once a day and stay put in between.
  const dayKey = day.toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.active, true), eq(products.archived, false)))
    .orderBy(sql`md5(${products.id}::text || ${dayKey})`)
    .limit(limit);
  const withVariants = rows.map((r) => ({ ...r, category: canonicalCategory(r.category) }));
  const attached = attachVariants(withVariants, await listVariantsForProducts(rows.map((r) => r.id)));
  return attachRatings(attached, await ratingsForProducts(rows.map((r) => r.id)));
}

/** ACTIVE products for a set of ids, with variants and ratings attached.
 *
 *  Used by the home page promo cards to resolve the owner's admin-selected
 *  product. Filtering on `active` here is what makes a DELETED or UNPUBLISHED
 *  pick simply absent from the result, so the caller falls back to the next best
 *  product instead of rendering a broken card. Order is not preserved - the
 *  caller re-orders by its own rule. */
export async function getActiveProductsByIds(ids: string[]): Promise<ProductWithVariants[]> {
  const clean = ids.map((s) => s.trim()).filter(Boolean);
  if (clean.length === 0) return [];
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.active, true), eq(products.archived, false), inArray(products.id, clean)));
  if (rows.length === 0) return [];
  const withVariants = attachVariants(rows, await listVariantsForProducts(rows.map((r) => r.id)));
  return attachRatings(withVariants, await ratingsForProducts(rows.map((r) => r.id)));
}

/** The best-selling ACTIVE products, ranked by real units sold across all order
 *  lines, then topped up with the newest active products so the list is never
 *  short. This is the "most reordered" fallback for the promo card: it reflects
 *  genuine demand when there is any, and degrades to "newest" on a store that
 *  has not sold anything yet - never an empty slot. */
export async function mostOrderedProducts(limit = 8): Promise<ProductWithVariants[]> {
  const sold = await db
    .select({ productId: orderItems.productId, units: sql<number>`sum(${orderItems.qty})` })
    .from(orderItems)
    .where(isNotNull(orderItems.productId))
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`sum(${orderItems.qty})`))
    .limit(limit);

  const ids = sold.map((r) => r.productId).filter((v): v is string => Boolean(v));
  const ranked = await getActiveProductsByIds(ids);
  const byId = new Map(ranked.map((p) => [p.id, p]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((p): p is ProductWithVariants => Boolean(p));

  if (ordered.length >= limit) return ordered.slice(0, limit);

  // Top up with the newest active products not already ranked, so a store with
  // few or no sales still fills the slot with real stock.
  const newest = await listProducts({ sort: "newest", limit: limit + ordered.length });
  const seen = new Set(ordered.map((p) => p.id));
  for (const p of newest) {
    if (ordered.length >= limit) break;
    if (!seen.has(p.id)) {
      ordered.push(p);
      seen.add(p.id);
    }
  }
  return ordered.slice(0, limit);
}

async function variantsFor(productId: string): Promise<ProductVariant[]> {
  return db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.createdAt));
}

export async function getProductBySlug(slug: string): Promise<ProductWithVariants | null> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.active, true), eq(products.archived, false)))
    .limit(1);
  if (!row) return null;
  const withVariants = { ...row, variants: await variantsFor(row.id) };
  const [rated] = attachRatings([withVariants], await ratingsForProducts([row.id]));
  return rated;
}

export async function getProductById(id: string): Promise<ProductWithVariants | null> {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) return null;
  return { ...row, variants: await variantsFor(row.id) };
}

export async function listRelatedProducts(
  excludeId: string,
  category: string,
  limit = 4,
): Promise<ProductWithVariants[]> {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.active, true),
        eq(products.archived, false),
        eq(products.category, category),
        ne(products.id, excludeId),
      ),
    )
    .limit(limit);
  if (rows.length === 0) return [];
  return attachVariants(rows, await listVariantsForProducts(rows.map((r) => r.id)));
}

// ── admin writes ─────────────────────────────────────────────────────────────
/** `products.images` must stay the image-only projection of `products.media` -
 *  the cart thumbnail, the JSON-LD and the OG image all read it. When a media
 *  list is supplied it is the source of truth; otherwise the caller's images
 *  are trusted as-is (so a caller that only knows images still works). */
function mediaToImages(
  media: { url: string; kind: "image" | "video" }[] | undefined,
  images: string[],
): string[] {
  if (!media) return images;
  return media.filter((m) => m.kind !== "video").map((m) => m.url);
}

export type ProductInput = {
  name: string;
  slug: string;
  description: string;
  category: string;
  priceCents: number;
  compareAtCents?: number | null;
  images: string[];
  /** The gallery as images AND videos. `images` is kept in sync (its
   *  image-only projection) so older consumers stay correct. */
  media?: { url: string; kind: "image" | "video" }[];
  tags: string[];
  /** Optional: an admin creating a product without attributes yet is fine - the
   *  Product Details tab simply has fewer rows until they fill them in. */
  specs?: ProductSpecs;
  active: boolean;
  featured: boolean;
  sortOrder?: number;
};

export async function createProduct(input: ProductInput): Promise<Product> {
  const [row] = await db
    .insert(products)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description,
      category: input.category,
      priceCents: input.priceCents,
      compareAtCents: input.compareAtCents ?? null,
      images: mediaToImages(input.media, input.images),
      media: input.media ?? [],
      tags: input.tags,
      specs: input.specs ?? {},
      active: input.active,
      featured: input.featured,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product | null> {
  const [row] = await db
    .update(products)
    .set({
      name: input.name,
      slug: input.slug,
      description: input.description,
      category: input.category,
      priceCents: input.priceCents,
      compareAtCents: input.compareAtCents ?? null,
      images: mediaToImages(input.media, input.images),
      // Only rewritten when the caller sent a media list, so a partial update
      // cannot silently clear a product's gallery.
      ...(input.media === undefined ? {} : { media: input.media }),
      tags: input.tags,
      // Left untouched when the caller did not send one, so an admin editing a
      // price does not silently wipe the attributes they never saw.
      ...(input.specs === undefined ? {} : { specs: input.specs }),
      active: input.active,
      featured: input.featured,
      sortOrder: input.sortOrder ?? 0,
      updatedAt: sql`now()`,
    })
    .where(eq(products.id, id))
    .returning();
  return row ?? null;
}

/** Delete a product, choosing the SAFE behaviour for its order history.
 *
 *  A product a customer has actually ordered is ARCHIVED, not destroyed:
 *  `order_items.product_id` is ON DELETE SET NULL, so a hard delete would blank
 *  the link from a placed order back to the product it was for. Archiving keeps
 *  the row (and that link) while removing the product from every storefront and
 *  admin surface, so it is recoverable and no order is ever orphaned. This is
 *  the same rule the deploy-time catalog sync already applies.
 *
 *  A product with NO order history is hard-deleted: its variants, reviews and
 *  wishlist entries cascade away with it, and there is nothing to preserve.
 *
 *  Returns which path was taken so the caller can report it honestly. */
export async function deleteProduct(id: string): Promise<{ ok: true; archived: boolean }> {
  const [row] = await db
    .select({ value: count() })
    .from(orderItems)
    .where(eq(orderItems.productId, id));
  const orderCount = row?.value ?? 0;
  if (decideProductDeletion(orderCount) === "archive") {
    await db
      .update(products)
      .set({ archived: true, active: false, updatedAt: sql`now()` })
      .where(eq(products.id, id));
    return { ok: true, archived: true };
  }
  await db.delete(products).where(eq(products.id, id));
  return { ok: true, archived: false };
}

export type VariantInput = {
  productId: string;
  name: string;
  sku: string;
  priceCents: number;
  inventoryQty: number;
  sortOrder?: number;
  active: boolean;
  /** Upstream supplier variant id (VID). Null/absent = not mapped. */
  cjVid?: string | null;
};

export async function createVariant(input: VariantInput): Promise<ProductVariant> {
  const [row] = await db
    .insert(productVariants)
    .values({
      productId: input.productId,
      name: input.name,
      sku: input.sku,
      priceCents: input.priceCents,
      inventoryQty: input.inventoryQty,
      sortOrder: input.sortOrder ?? 0,
      active: input.active,
      cjVid: input.cjVid ?? null,
      cjSku: input.cjVid ? input.sku : null,
    })
    .returning();
  return row;
}

export async function updateVariant(id: string, input: Omit<VariantInput, "productId">) {
  const [row] = await db
    .update(productVariants)
    .set({
      name: input.name,
      sku: input.sku,
      priceCents: input.priceCents,
      inventoryQty: input.inventoryQty,
      sortOrder: input.sortOrder ?? 0,
      active: input.active,
      cjVid: input.cjVid ?? null,
      cjSku: input.cjVid ? input.sku : null,
    })
    .where(eq(productVariants.id, id))
    .returning();
  return row ?? null;
}

export async function deleteVariant(id: string) {
  await db.delete(productVariants).where(eq(productVariants.id, id));
  return { ok: true };
}

/** Inventory view: every variant with its product name, lowest stock first. */
export async function listInventory() {
  return db
    .select({
      id: productVariants.id,
      name: productVariants.name,
      sku: productVariants.sku,
      inventoryQty: productVariants.inventoryQty,
      priceCents: productVariants.priceCents,
      active: productVariants.active,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .orderBy(asc(productVariants.inventoryQty), asc(products.name));
}

export async function setVariantInventory(id: string, qty: number) {
  const [row] = await db
    .update(productVariants)
    .set({ inventoryQty: Math.max(0, Math.floor(qty)) })
    .where(eq(productVariants.id, id))
    .returning();
  return row ?? null;
}

export async function countLowStock(threshold = 5): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(productVariants)
    .where(and(eq(productVariants.active, true), lte(productVariants.inventoryQty, threshold)));
  return row?.value ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────────
export type CartLineInput = { slug: string; variantId: string | null; qty: number };

export type CreateOrderInput = {
  userId: string | null;
  email: string;
  items: CartLineInput[];
  shippingAddress: AddressSnapshot;
  billingAddress: AddressSnapshot;
  paymentProvider: string;
  notes?: string | null;
};

export type OrderDetail = { order: Order; items: OrderItem[]; events: OrderEvent[] };

export async function getOrderItems(orderId: string) {
  return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
}

export async function getOrderEvents(orderId: string) {
  return db
    .select()
    .from(orderEvents)
    .where(eq(orderEvents.orderId, orderId))
    .orderBy(asc(orderEvents.createdAt));
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return null;
  return { order, items: await getOrderItems(orderId), events: await getOrderEvents(orderId) };
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber.trim().toUpperCase()))
    .limit(1);
  return row ?? null;
}

/** Guest lookup: order number AND the email it was placed with must both match. */
export async function lookupOrderForGuest(
  orderNumber: string,
  email: string,
): Promise<OrderDetail | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.orderNumber, orderNumber.trim().toUpperCase()),
        eq(sql`lower(${orders.email})`, email.trim().toLowerCase()),
      ),
    )
    .limit(1);
  if (!row) return null;
  return getOrderDetail(row.id);
}

/** Owner-scoped order detail. Returns null when the order belongs to someone
 *  else - it never leaks another customer's order. */
export async function getUserOrderDetail(orderId: string, userId: string): Promise<OrderDetail | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!row) return null;
  return getOrderDetail(row.id);
}

/** Accept either an order UUID or the human order number - both owner-scoped. */
export async function getUserOrderDetailByRef(ref: string, userId: string): Promise<OrderDetail | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
  const [row] = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        isUuid ? eq(orders.id, ref) : eq(orders.orderNumber, ref.trim().toUpperCase()),
      ),
    )
    .limit(1);
  if (!row) return null;
  return getOrderDetail(row.id);
}

export async function listUserOrders(userId: string) {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function adminListOrders(opts: { status?: string; search?: string } = {}) {
  const where: SQL[] = [];
  if (opts.status && opts.status !== "all") where.push(eq(orders.status, opts.status));
  // Same LIKE-escaping fix as the storefront search: an admin typing `%` into
  // the orders box used to match every order, and `_` matched any character.
  if (opts.search?.trim()) {
    const like = likeContains(opts.search.trim().toLowerCase());
    const clauses = or(
      ilike(orders.orderNumber, like),
      ilike(orders.email, like),
      ilike(orders.trackingNumber, like),
    );
    if (clauses) where.push(clauses);
  }
  return db
    .select()
    .from(orders)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(300);
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (input.items.length === 0) throw new Error("Your cart is empty.");
  if (!input.shippingAddress?.line1 || !input.email) throw new Error("Missing order details.");

  // Resolve every line against the CATALOG, never against client-supplied prices.
  const slugs = [...new Set(input.items.map((i) => i.slug))];
  const productRows = await db
    .select()
    .from(products)
    .where(and(inArray(products.slug, slugs), eq(products.active, true), eq(products.archived, false)));
  const productBySlug = new Map(productRows.map((p) => [p.slug, p]));
  if (productRows.length === 0) throw new Error("None of these products are available.");

  const variantRows = await listVariantsForProducts(productRows.map((p) => p.id));
  const variantById = new Map(variantRows.map((v) => [v.id, v]));

  const settings = await getSettings();

  const lines = input.items.map((line) => {
    const product = productBySlug.get(line.slug);
    if (!product) throw new Error("A product in your cart is no longer available.");
    const variant = line.variantId ? variantById.get(line.variantId) : null;
    if (line.variantId && (!variant || variant.productId !== product.id)) {
      throw new Error("A selected option is no longer available.");
    }
    const qty = Math.max(1, Math.floor(line.qty));
    if (qty > MAX_LINE_QTY) {
      // Hard ceiling, mirroring `cartLineSchema`'s `.max(99)`. The schema is the
      // first line of defence; this is the authoritative one. An unbounded
      // quantity turns a legitimate unit price into an arbitrary total, so a
      // caller that somehow bypassed the schema is refused rather than trusted.
      throw new Error(`Quantity ${qty} for ${product.slug} exceeds the per-item limit of ${MAX_LINE_QTY}.`);
    }
    return {
      productId: product.id,
      variantId: variant?.id ?? null,
      slug: product.slug,
      nameSnapshot: product.name,
      variantSnapshot: variant?.name ?? null,
      priceCents: variant ? variant.priceCents : product.priceCents,
      qty,
      imageUrl: product.images[0] ?? null,
      variantQty: variant?.inventoryQty ?? null,
      label: variant ? `${product.name} (${variant.name})` : product.name,
    };
  });

  // Pre-check stock so a clearly-invalid order never reaches the insert.
  for (const l of lines) {
    if (l.variantQty !== null && l.variantQty < l.qty) throw new OutOfStockError(l.label);
  }

  // ── The customer's total, from SERVER data only ────────────────────────────
  // Every term below is derived from the catalog rows resolved above (unit
  // prices), the requested quantities, and store settings. No client-supplied
  // price, subtotal or total is read anywhere in this function - the cart's
  // input schema (`cartLineSchema`) has no price field for one to arrive in.
  // The arithmetic is integer-cents throughout (shared/money.ts), and the tax is
  // rounded on the integer product rather than on a float percentage, so the
  // stored total cannot drift by a cent from what the invoice is created for.
  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
  const shippingCents = shippingCentsFor(subtotalCents, settings);
  const taxCents = taxCentsFor(subtotalCents, settings.tax_rate_bps);
  const totalCents = orderTotalCents({ subtotalCents, shippingCents, taxCents });
  if (!Number.isInteger(subtotalCents) || !Number.isInteger(totalCents)) {
    // A fractional cent is a bug in the pricing data, not something to round
    // away - the invoice the provider issues must match the order exactly.
    throw new Error("Order totals must be whole cents.");
  }

  const orderId = crypto.randomUUID();
  const items = lines.map((l) => ({
    id: crypto.randomUUID(),
    orderId,
    productId: l.productId,
    variantId: l.variantId,
    slug: l.slug,
    nameSnapshot: l.nameSnapshot,
    variantSnapshot: l.variantSnapshot,
    priceCents: l.priceCents,
    qty: l.qty,
    imageUrl: l.imageUrl,
  }));

  // Retry only on the (vanishingly unlikely) order-number collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.insert(orders).values({
        id: orderId,
        orderNumber: newOrderNumber(),
        userId: input.userId,
        email: input.email.trim().toLowerCase(),
        status: "pending",
        paymentStatus: "unpaid",
        paymentProvider: input.paymentProvider,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        currency: settings.currency,
        shippingAddress: input.shippingAddress,
        billingAddress: input.billingAddress,
        notes: input.notes ?? null,
      });
      await atomic((d) =>
        batch([
          d.insert(orderItems).values(items),
          d.insert(orderEvents).values({
            id: crypto.randomUUID(),
            orderId,
            status: "pending",
            note: "Order placed - awaiting payment confirmation.",
          }),
        ]),
      );
      break;
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue;
      throw e;
    }
  }

  // Best-effort stock reservation, guarded in SQL. A zero-row result means a
  // concurrent buyer won the race; we log it rather than oversell silently.
  const stocked = lines.filter((l) => l.variantId !== null);
  if (stocked.length > 0) {
    const results = await atomic((d) =>
      batch(
        stocked.map((l) =>
          d
            .update(productVariants)
            .set({ inventoryQty: sql`${productVariants.inventoryQty} - ${l.qty}` })
            .where(
              and(
                eq(productVariants.id, l.variantId as string),
                gte(productVariants.inventoryQty, l.qty),
              ),
            )
            .returning({ id: productVariants.id }),
        ),
      ),
    );
    const short = results.findIndex((r) => (r as unknown[]).length === 0);
    if (short >= 0) {
      // eslint-disable-next-line no-console
      console.warn(`[orders] stock race on ${stocked[short].variantId} for order ${orderId}`);
    }
  }

  const [created] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return created;
}

export async function updateOrderStatus(orderId: string, status: string, note?: string | null) {
  await atomic((d) =>
    batch([
      d.update(orders).set({ status, updatedAt: sql`now()` }).where(eq(orders.id, orderId)),
      d.insert(orderEvents).values({
        id: crypto.randomUUID(),
        orderId,
        status,
        note: note ?? null,
      }),
    ]),
  );
  return getOrderDetail(orderId);
}

export async function updateOrderPayment(input: {
  orderId: string;
  paymentStatus: string;
  paymentProvider?: string | null;
  paymentRef?: string | null;
}) {
  await db
    .update(orders)
    .set({
      paymentStatus: input.paymentStatus,
      paymentProvider: input.paymentProvider ?? undefined,
      paymentRef: input.paymentRef ?? undefined,
      updatedAt: sql`now()`,
    })
    .where(eq(orders.id, input.orderId));
  return getOrderDetail(input.orderId);
}

// ── Confirmation email: the one-shot claim ──────────────────────────────────
//
// WHY A CLAIM AND NOT A FLAG CHECK. The paid receipt must go out EXACTLY ONCE
// per order, and it has three possible triggers that can all fire for the same
// payment (the payment webhook, the pull reconciliation, the admin resend).
// The provider also retries a webhook until it gets a 2xx, and two serverless
// instances can run the same handler concurrently. A plain "if not sent, send"
// check is a race: both readers see "not sent" before either writes, and the
// customer gets two receipts.
//
// `claimOrderConfirmationEmail` is therefore an ATOMIC mutual-exclusion point,
// in the same style as the CJ forward claim: one conditional UPDATE moves
// `confirmation_email_sent_at` from NULL to now() for exactly one caller. Only
// that caller proceeds to send; every other caller's UPDATE matches no row and
// returns false, so it never sends.
//
// The claim is RELEASED when the provider did not accept the message (no API key
// yet, or a send failure), so the order is not left looking as though the
// customer was told. A send the provider ACCEPTED is never released: the receipt
// exists, and sending again would duplicate it.

/** Atomically claim the right to send this order's confirmation email.
 *  Returns true ONLY for the caller that won - everyone else must not send. */
export async function claimOrderConfirmationEmail(orderId: string): Promise<boolean> {
  const rows = await db
    .update(orders)
    .set({ confirmationEmailSentAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(orders.id, orderId), isNull(orders.confirmationEmailSentAt)))
    .returning({ id: orders.id });
  return rows.length > 0;
}

/** Give a claim back after a send the provider never accepted. Guarded on a
 *  non-null value, so it can only ever clear a claim - never create one. */
export async function releaseOrderConfirmationEmail(orderId: string): Promise<void> {
  await db
    .update(orders)
    .set({ confirmationEmailSentAt: null, updatedAt: sql`now()` })
    .where(and(eq(orders.id, orderId), isNotNull(orders.confirmationEmailSentAt)));
}

/** When the confirmation email was sent for an order, or null if never. */
export async function getOrderConfirmationEmailSentAt(orderId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: orders.confirmationEmailSentAt })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return row?.at ?? null;
}

// ── Unpaid-order alert: the one-shot claim ────────────────────────────────────
//
// WHY A CLAIM AND NOT A FLAG CHECK. The "this order is still unpaid" alert is
// driven by a scheduled job that can run concurrently (two serverless instances,
// or a manual run overlapping the cron), and it must fire EXACTLY ONCE per order
// - an owner who gets the same nudge every hour will start ignoring it. A plain
// "if not sent, send" check is a race: both runs read NULL before either writes.
// `claimUnpaidOrderAlert` is therefore an ATOMIC mutual-exclusion point, in the
// same style as `claimOrderConfirmationEmail`: one conditional UPDATE moves
// `unpaid_alert_sent_at` from NULL to now() for exactly one caller.
//
// The WHERE clause also re-asserts the business rule at the moment of the write,
// so a run that raced a payment cannot alert on an order that has since been
// paid, refunded or cancelled - the claim simply matches no row.

/** Atomically claim the right to send this order's unpaid alert. Returns true
 *  ONLY for the caller that won - everyone else must not send. */
export async function claimUnpaidOrderAlert(orderId: string): Promise<boolean> {
  const rows = await db
    .update(orders)
    .set({ unpaidAlertSentAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      and(
        eq(orders.id, orderId),
        isNull(orders.unpaidAlertSentAt),
        // Genuinely unpaid: not paid, not refunded, not cancelled.
        ne(orders.paymentStatus, "paid"),
        ne(orders.paymentStatus, "refunded"),
        ne(orders.status, "cancelled"),
        // And old enough to be worth chasing.
        sql`${orders.createdAt} < now() - make_interval(hours => ${UNPAID_ALERT_AFTER_HOURS})`,
      ),
    )
    .returning({ id: orders.id });
  return rows.length > 0;
}

/** Give a claim back after a send the provider never accepted. Guarded on a
 *  non-null value, so it can only ever clear a claim - never create one. */
export async function releaseUnpaidOrderAlert(orderId: string): Promise<void> {
  await db
    .update(orders)
    .set({ unpaidAlertSentAt: null, updatedAt: sql`now()` })
    .where(and(eq(orders.id, orderId), isNotNull(orders.unpaidAlertSentAt)));
}

/** When the unpaid alert was sent for an order, or null if never. */
export async function getUnpaidAlertSentAt(orderId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: orders.unpaidAlertSentAt })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return row?.at ?? null;
}

/** How long an order may stay unpaid before the owner is alerted. */
export const UNPAID_ALERT_AFTER_HOURS = 24;

/** A sweep attempt may not retry a Telegram reminder sooner than this. */
export const TELEGRAM_OUTBOX_MIN_BACKOFF_MINUTES = 5;

// ── Telegram outbox: the durable retry queue ────────────────────────────────
//
// WHY A QUEUE AND NOT A LONGER IN-REQUEST RETRY. `services/order-notify.ts`
// retries a failed send inside the serverless invocation that observed the
// payment, because the shopper is waiting on that request. A Telegram outage
// that outlives it would drop the notification. So a send Telegram did NOT
// accept records a reminder here, and the sweep retries it later.
//
// THE EXACTLY-ONCE GUARD IS NOT HERE. It is `orders.telegram_notified_at` (see
// `claimTelegramNotification` above). A row in this table is only a "try again"
// marker, so a duplicate or lost row is harmless - which is what makes the
// enqueue safe to call from every path that might notice a failure.

/**
 * Raise (or refresh) a retry reminder for an order whose notification did not
 * land. IDEMPOTENT by construction: the unique index on `order_id` means a
 * retried webhook, an admin re-send and the daily reconciliation job all
 * converge on ONE row instead of stacking attempts.
 *
 * A row already marked `failed` (the attempt budget ran out) is REOPENED with a
 * fresh budget by a later explicit call - a human asking again, or the daily
 * reconciliation - because a permanent Telegram misconfiguration that has since
 * been fixed must not leave the order permanently un-notifiable. The automatic
 * sweep never reopens: it only revisits `pending` rows.
 *
 * NEVER THROWS. The guarantee is enforced HERE rather than at each call site,
 * because two very different callers share it: `order-notify.ts` sits on the
 * payment path (where a queue-write failure must not be able to break a sale),
 * and the daily reconciliation has no caller to catch anything at all. A failed
 * enqueue is therefore a log line and nothing more.
 */
export async function enqueueTelegramOutbox(input: {
  orderId: string;
  orderNumber: string;
  reason?: string | null;
}): Promise<void> {
  try {
    await db
      .insert(telegramOutbox)
      .values({
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        status: "pending",
        lastError: input.reason ?? null,
        nextAttemptAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: telegramOutbox.orderId,
        set: {
          status: "pending",
          attempts: 0,
          lastError: input.reason ?? null,
          nextAttemptAt: sql`now()`,
          updatedAt: sql`now()`,
        },
      });
  } catch (e) {
    // Best-effort by design. The in-request notification has already reported
    // its own outcome, and the daily reconciliation will find the order again
    // from `orders` even if this write never lands.
    // eslint-disable-next-line no-console
    console.warn(
      `[telegram-outbox] could not queue a retry for ${input.orderNumber}: ${(e as Error).message}`,
    );
  }
}

/**
 * Orders the daily reconciliation must re-queue: PAID, yet never notified.
 *
 * `telegram_notified_at IS NULL` is the whole test, and it is deliberately
 * checked in ADDITION to any outbox row: the failure this job exists for is the
 * one nothing else noticed, so it derives the list from `orders` (the source of
 * truth) rather than trusting the queue to be complete.
 *
 * A refunded or cancelled order is excluded - a sale the owner already knows
 * about is not a missed alert.
 */
export async function listPaidOrdersMissingTelegramNotification(
  limit = 200,
): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.paymentStatus, "paid"),
        isNull(orders.telegramNotifiedAt),
        ne(orders.status, "cancelled"),
      ),
    )
    .orderBy(asc(orders.createdAt))
    .limit(limit);
}

/**
 * Claim up to `limit` due reminders for ONE sweep run.
 *
 * The claim is a single conditional UPDATE ... RETURNING, so two concurrent
 * sweeps cannot work the same rows: the UPDATE flips `next_attempt_at` forward
 * past the run, and only the rows it actually matched come back. That lease is
 * why this needs no separate "in progress" status - a claimed row is simply not
 * due again until the lease expires.
 */
export async function claimDueTelegramOutbox(
  limit = 25,
  backoffMinutes: number = TELEGRAM_OUTBOX_MIN_BACKOFF_MINUTES,
): Promise<TelegramOutboxRow[]> {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)));
  const safeBackoff = Math.max(1, Math.floor(backoffMinutes));
  return db
    .update(telegramOutbox)
    .set({
      attempts: sql`${telegramOutbox.attempts} + 1`,
      lastAttemptAt: sql`now()`,
      nextAttemptAt: sql`now() + make_interval(mins => ${safeBackoff})`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(telegramOutbox.status, "pending"),
        lte(telegramOutbox.nextAttemptAt, sql`now()`),
      ),
    )
    .returning()
    .then((rows) => rows.slice(0, safeLimit));
}

/** Mark a reminder delivered. Kept (not deleted) so the audit trail survives. */
export async function markTelegramOutboxSent(id: string): Promise<void> {
  await db
    .update(telegramOutbox)
    .set({ status: "sent", lastError: null, updatedAt: sql`now()` })
    .where(eq(telegramOutbox.id, id));
}

/**
 * Record a failed sweep attempt, and decide whether to give up.
 *
 * `attempts` is already incremented by the claim, so this reads it back and
 * compares to `maxAttempts`: at or past the budget the row becomes PERMANENTLY
 * `failed` with the error recorded, so a hopeless reminder stops consuming the
 * sweep forever. Below it, the row stays `pending` and is retried on the next
 * run.
 */
export async function recordTelegramOutboxFailure(
  id: string,
  error: string,
  maxAttempts: number,
): Promise<{ status: "pending" | "failed"; attempts: number }> {
  const [row] = await db
    .select({ attempts: telegramOutbox.attempts })
    .from(telegramOutbox)
    .where(eq(telegramOutbox.id, id))
    .limit(1);
  const attempts = row?.attempts ?? maxAttempts;
  const giveUp = attempts >= maxAttempts;
  await db
    .update(telegramOutbox)
    .set({
      status: giveUp ? "failed" : "pending",
      lastError: error,
      updatedAt: sql`now()`,
    })
    .where(eq(telegramOutbox.id, id));
  return { status: giveUp ? "failed" : "pending", attempts };
}

/** Every reminder for one order, for the admin view. Newest first. */
export async function getTelegramOutboxForOrder(
  orderId: string,
): Promise<TelegramOutboxRow[]> {
  return db
    .select()
    .from(telegramOutbox)
    .where(eq(telegramOutbox.orderId, orderId))
    .orderBy(desc(telegramOutbox.updatedAt));
}

/** Counts by status, for the reconciliation log line and the admin view. */
export async function countTelegramOutboxByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: telegramOutbox.status, n: count() })
    .from(telegramOutbox)
    .groupBy(telegramOutbox.status);
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.status)] = Number(r.n ?? 0);
  return out;
}

/** The Telegram notification picture for ONE order, as the admin panel shows it.
 *
 *  Reads the ONE-SHOT CLAIM and the last error off `orders` (the authority), and
 *  the retry queue alongside: a row here that is still `pending` means the owner
 *  has NOT been told yet but a sweep will try again, which is a materially
 *  different state from "delivered" and must not be shown as one. */
export interface OrderTelegramStatus {
  notifiedAt: Date | null;
  notifyError: string | null;
  outbox: TelegramOutboxRow[];
}

export async function getOrderTelegramStatus(orderId: string): Promise<OrderTelegramStatus> {
  const [row] = await db
    .select({
      notifiedAt: orders.telegramNotifiedAt,
      notifyError: orders.telegramNotifyError,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return {
    notifiedAt: row?.notifiedAt ?? null,
    notifyError: row?.notifyError ?? null,
    outbox: await getTelegramOutboxForOrder(orderId),
  };
}

// ── Job-run claims: "already ran for this period" ───────────────────────────
//
// A unique (job, period) row, claimed by INSERT ... ON CONFLICT DO NOTHING. The
// run whose insert lands is the one allowed to do the non-idempotent half (a
// summary message to the owner); every loser gets a clean `false`.

/** True ONLY for the run that wins the claim for (job, period). */
export async function claimJobRun(
  job: string,
  period: string,
  detail?: Record<string, unknown> | null,
): Promise<boolean> {
  const rows = await db
    .insert(jobRunClaims)
    .values({ job, period, detail: detail ?? null })
    .onConflictDoNothing({ target: [jobRunClaims.job, jobRunClaims.period] })
    .returning({ job: jobRunClaims.job });
  return rows.length > 0;
}

/** Release a claim so the job may legitimately run again for that period (used
 *  when the claimed run then FAILED to do its work, e.g. the summary send). */
export async function releaseJobRun(job: string, period: string): Promise<void> {
  await db
    .delete(jobRunClaims)
    .where(and(eq(jobRunClaims.job, job), eq(jobRunClaims.period, period)));
}


// ── Telegram order notification: the one-shot claim ─────────────────────────
//
// WHY A CLAIM AND NOT A FLAG CHECK. Same reasoning as the paid receipt above,
// and the same three-ways-to-fire problem: the owner's Telegram alert goes out
// from the payment webhook, the pull reconciliation AND the post-return
// confirmation, the provider retries a webhook until it gets a 2xx, and two
// serverless instances can handle one payment concurrently. A plain "if not
// notified, notify" check is a race - both readers see NULL before either
// writes, and the owner gets the same order twice, which is how a useful alert
// turns into noise they learn to ignore.
//
// `claimTelegramNotification` is therefore an ATOMIC mutual-exclusion point: one
// conditional UPDATE moves `telegram_notified_at` from NULL to now() for exactly
// one caller. Only that caller proceeds to send.
//
// The claim is RELEASED when Telegram did not accept the message, so the order
// is not left looking as though the owner was told and a later attempt (a
// retried webhook, an admin re-send) can still deliver it. A send Telegram
// ACCEPTED is never released: the notification exists, and sending again would
// duplicate it.

/** Atomically claim the right to send this order's Telegram notification.
 *  Returns true ONLY for the caller that won - everyone else must not send. */
export async function claimTelegramNotification(orderId: string): Promise<boolean> {
  const rows = await db
    .update(orders)
    .set({ telegramNotifiedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(orders.id, orderId), isNull(orders.telegramNotifiedAt)))
    .returning({ id: orders.id });
  return rows.length > 0;
}

/** Give a claim back after a send Telegram never accepted. Guarded on a
 *  non-null value, so it can only ever clear a claim - never create one. */
export async function releaseTelegramNotification(orderId: string): Promise<void> {
  await db
    .update(orders)
    .set({ telegramNotifiedAt: null, updatedAt: sql`now()` })
    .where(and(eq(orders.id, orderId), isNotNull(orders.telegramNotifiedAt)));
}

/** Record why the last Telegram attempt did not land. The message is already
 *  redacted by services/telegram.ts, so it can never carry the bot token. */
export async function setTelegramNotifyError(orderId: string, error: string | null): Promise<void> {
  await db
    .update(orders)
    .set({ telegramNotifyError: error, updatedAt: sql`now()` })
    .where(eq(orders.id, orderId));
}

/** When the Telegram notification was delivered for an order, or null if never. */
export async function getTelegramNotifiedAt(orderId: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: orders.telegramNotifiedAt })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  return row?.at ?? null;
}

/**
 * Orders that are genuinely unpaid, older than the threshold, and not yet
 * alerted. This is the CANDIDATE list - the claim is what actually decides, so a
 * concurrent run cannot double-send even if both read the same candidates.
 */
export async function listUnpaidOrdersForAlert(
  olderThanHours: number = UNPAID_ALERT_AFTER_HOURS,
): Promise<Order[]> {
  return db
    .select()
    .from(orders)
    .where(
      and(
        isNull(orders.unpaidAlertSentAt),
        ne(orders.paymentStatus, "paid"),
        ne(orders.paymentStatus, "refunded"),
        ne(orders.status, "cancelled"),
        sql`${orders.createdAt} < now() - make_interval(hours => ${olderThanHours})`,
      ),
    )
    .orderBy(asc(orders.createdAt));
}

// ── Email history (admin) ─────────────────────────────────────────────────────
//
// Everything the admin email-history panel needs for ONE order: every send
// attempt from `email_log` (with its status, recipient and trigger), plus the
// two persisted one-shot claims (the paid receipt and the unpaid alert) so the
// panel can state whether each has gone even before any log row exists.

export interface OrderEmailHistory {
  /** When the paid receipt was sent (the persisted claim), or null. */
  confirmationEmailSentAt: Date | null;
  /** When the unpaid-order alert was sent (the persisted claim), or null. */
  unpaidAlertSentAt: Date | null;
  /** Every send attempt for this order, newest first. */
  emails: EmailLog[];
}

export async function getOrderEmailHistory(orderId: string): Promise<OrderEmailHistory> {
  const [order] = await db
    .select({
      confirmationEmailSentAt: orders.confirmationEmailSentAt,
      unpaidAlertSentAt: orders.unpaidAlertSentAt,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  const emails = await db
    .select()
    .from(emailLog)
    .where(eq(emailLog.orderId, orderId))
    .orderBy(desc(emailLog.createdAt));
  return {
    confirmationEmailSentAt: order?.confirmationEmailSentAt ?? null,
    unpaidAlertSentAt: order?.unpaidAlertSentAt ?? null,
    emails,
  };
}

/** Persist the hosted invoice handles for an order. Used when a payment is
 *  resumed after the order was placed without an invoice. */
export async function setOrderPaymentInvoice(input: {
  orderId: string;
  invoiceId: string;
  paymentUrl: string;
}): Promise<void> {
  await db
    .update(orders)
    .set({
      paymentProvider: "bachs",
      paymentInvoiceId: input.invoiceId,
      paymentUrl: input.paymentUrl,
      updatedAt: sql`now()`,
    })
    .where(eq(orders.id, input.orderId));
}

export async function updateOrderTracking(input: {
  orderId: string;
  trackingNumber: string | null;
  carrier: string | null;
  note?: string | null;
}) {
  // Adding a tracking number means the parcel has left the warehouse, so the
  // order status must move to "shipped" in the SAME write as the "shipped"
  // event we log - otherwise the history says shipped while the order still
  // reads pending, and the customer's tracking page shows the wrong step.
  const hasTracking = Boolean(input.trackingNumber);
  await atomic((d) =>
    batch([
      d
        .update(orders)
        .set({
          trackingNumber: input.trackingNumber,
          carrier: input.carrier,
          ...(hasTracking ? { status: "shipped" } : {}),
          updatedAt: sql`now()`,
        })
        .where(eq(orders.id, input.orderId)),
      d.insert(orderEvents).values({
        id: crypto.randomUUID(),
        orderId: input.orderId,
        status: "shipped",
        note:
          input.note ??
          (input.trackingNumber
            ? `Tracking added: ${input.carrier ?? "carrier"} ${input.trackingNumber}`
            : "Tracking cleared"),
      }),
    ]),
  );
  return getOrderDetail(input.orderId);
}

export async function updateOrderNotes(orderId: string, notes: string | null) {
  await db.update(orders).set({ notes, updatedAt: sql`now()` }).where(eq(orders.id, orderId));
  return getOrderDetail(orderId);
}

/** Permanently remove an order and everything that hangs off it.
 *
 *  The child tables cascade on the foreign key - `order_items`, `order_events`
 *  and `email_log` all declare `onDelete: "cascade"` - so a single DELETE here
 *  removes the order and its dependents in one statement without leaving an
 *  orphan behind. A review that referenced the order keeps its own row with
 *  `order_id` set to NULL (`onDelete: "set null"`), so a customer's review is
 *  never destroyed by cleaning up an order. Returns true when a row was
 *  actually removed, so the caller can answer NOT_FOUND for a stale id. */
export async function deleteOrder(orderId: string): Promise<boolean> {
  const removed = await db
    .delete(orders)
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id });
  return removed.length > 0;
}

// ── admin aggregates ─────────────────────────────────────────────────────────
export async function adminStats(lowStockThreshold: number = LOW_STOCK_THRESHOLD) {
  const paid = and(eq(orders.paymentStatus, "paid"), ne(orders.status, "cancelled"));
  const [revenueRow] = await db
    .select({ value: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
    .from(orders)
    .where(paid);
  const [orderCountRow] = await db.select({ value: count() }).from(orders);
  const [openRow] = await db
    .select({ value: count() })
    .from(orders)
    .where(inArray(orders.status, ["pending", "paid", "processing"]));
  const [userRow] = await db.select({ value: count() }).from(users);
  // A CUSTOMER has actually PAID for an order; a USER has merely registered.
  // They are counted separately so the panel can never conflate "signed up"
  // with "bought something" - the old bug counted every registered account as a
  // customer, which is why the Customers figure looked stuck at the number of
  // accounts rather than the number of buyers.
  const [customerRow] = await db
    .select({ value: sql<number>`count(distinct ${orders.userId})::int` })
    .from(orders)
    .where(paid);
  const [reviewRow] = await db.select({ value: count() }).from(reviews);

  // The dashboard's remaining KPIs. Each is a live count of the thing the panel
  // manages, so a figure is never a placeholder or a stale total.
  const [productRow] = await db
    .select({ value: count() })
    .from(products)
    .where(and(eq(products.active, true), eq(products.archived, false)));
  const [pendingReviewRow] = await db
    .select({ value: count() })
    .from(reviews)
    .where(eq(reviews.status, "pending"));
  const [newMessageRow] = await db
    .select({ value: count() })
    .from(contactMessages)
    .where(eq(contactMessages.status, "new"));
  const [subscriberRow] = await db
    .select({ value: count() })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "subscribed"));
  const [paidOrderRow] = await db.select({ value: count() }).from(orders).where(paid);

  // Revenue per day over the last 14 days, grouped server-side so the chart is a
  // real read of paid orders rather than anything computed on the client.
  //
  // The day series is generated with `generate_series` and LEFT JOINed to the
  // paid orders, so EVERY day in the window is present - a day with no sales is
  // a real 0, not a missing point. Without this the chart collapses to an empty
  // frame whenever the store has had no paid orders in the window, which reads
  // as "broken" rather than "no sales yet".
  const revenueByDay = await db.execute(sql`
    with days as (
      select generate_series(
        date_trunc('day', now()) - interval '13 days',
        date_trunc('day', now()),
        interval '1 day'
      ) as day
    )
    select
      to_char(days.day, 'YYYY-MM-DD') as date,
      coalesce(sum(${orders.totalCents}), 0)::int as cents
    from days
    left join ${orders}
      on date_trunc('day', ${orders.createdAt}) = days.day
      and ${orders.paymentStatus} = 'paid'
      and ${orders.status} <> 'cancelled'
    group by days.day
    order by days.day
  `);
  const revenueSeries = rowsOf(revenueByDay).map((r) => ({
    date: String(r.date),
    cents: Number(r.cents ?? 0),
  }));
  // The COUNT of low-stock variants, separate from the (limited) display list
  // below. The list is capped at 8 rows for the card, so deriving the KPI from
  // `lowStock.length` would silently report "8 low on stock" no matter how many
  // there really are. This is the real total, on the same shared threshold.
  const [lowStockCountRow] = await db
    .select({ value: count() })
    .from(productVariants)
    .where(and(eq(productVariants.active, true), lte(productVariants.inventoryQty, lowStockThreshold)));
  const lowStock = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      name: productVariants.name,
      sku: productVariants.sku,
      inventoryQty: productVariants.inventoryQty,
      productName: products.name,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(productVariants.active, true), lte(productVariants.inventoryQty, lowStockThreshold)))
    .orderBy(asc(productVariants.inventoryQty))
    .limit(8);

  const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);

  const topProducts = await db
    .select({
      name: orderItems.nameSnapshot,
      slug: orderItems.slug,
      units: sql<number>`sum(${orderItems.qty})::int`,
      revenue: sql<number>`sum(${orderItems.qty} * ${orderItems.priceCents})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(paid)
    .groupBy(orderItems.nameSnapshot, orderItems.slug)
    .orderBy(desc(sql`sum(${orderItems.qty} * ${orderItems.priceCents})`))
    .limit(5);

  // 30-day revenue comparison: the last 30 days against the 30 before it, both
  // read live from paid orders. The delta and direction are derived on the
  // client from these two real totals, so the hero never shows a placeholder.
  const [rev30Row] = await db
    .select({ value: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
    .from(orders)
    .where(and(paid, gte(orders.createdAt, sql`now() - interval '30 days'`)));
  const [revPrev30Row] = await db
    .select({ value: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
    .from(orders)
    .where(
      and(
        paid,
        gte(orders.createdAt, sql`now() - interval '60 days'`),
        sql`${orders.createdAt} < now() - interval '30 days'`,
      ),
    );

  const paidOrders = paidOrderRow?.value ?? 0;
  return {
    revenueCents: revenueRow?.value ?? 0,
    revenue30dCents: rev30Row?.value ?? 0,
    revenuePrev30dCents: revPrev30Row?.value ?? 0,
    orderCount: orderCountRow?.value ?? 0,
    openOrders: openRow?.value ?? 0,
    customerCount: customerRow?.value ?? 0,
    userCount: userRow?.value ?? 0,
    reviewCount: reviewRow?.value ?? 0,
    productCount: productRow?.value ?? 0,
    pendingReviews: pendingReviewRow?.value ?? 0,
    newMessages: newMessageRow?.value ?? 0,
    subscriberCount: subscriberRow?.value ?? 0,
    averageOrderCents:
      paidOrders > 0 ? Math.round((revenueRow?.value ?? 0) / paidOrders) : 0,
    revenueByDay: revenueSeries,
    lowStock,
    lowStockCount: lowStockCountRow?.value ?? 0,
    recentOrders,
    topProducts,
  };
}

export async function listCustomers() {
  // A CUSTOMER is a registered account that has actually PAID for an order -
  // not merely someone who signed up. Derived from paid orders grouped by
  // account; the HAVING clause drops every account with no settled order, so an
  // account that never bought never appears here. Accounts that only signed up
  // are counted separately as USERS (`listUsers` / `adminStats.userCount`).
  const settled = sql`(${orders.paymentStatus} = 'paid' and ${orders.status} <> 'cancelled')`;
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      fullName: userProfiles.fullName,
      phone: userProfiles.phone,
      orderCount: sql<number>`(count(${orders.id}) filter (where ${orders.paymentStatus} = 'paid' and ${orders.status} <> 'cancelled'))::int`,
      spendCents: sql<number>`coalesce(sum(case when ${orders.paymentStatus} = 'paid' and ${orders.status} <> 'cancelled' then ${orders.totalCents} else 0 end), 0)::int`,
      lastOrderAt: sql<string | null>`max(${orders.createdAt}) filter (where ${orders.paymentStatus} = 'paid' and ${orders.status} <> 'cancelled')`,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(orders, eq(orders.userId, users.id))
    .groupBy(
      users.id,
      users.email,
      users.name,
      users.createdAt,
      userProfiles.fullName,
      userProfiles.phone,
    )
    .having(sql`count(${orders.id}) filter (where ${settled}) > 0`)
    .orderBy(desc(users.createdAt))
    .limit(300);
}

/**
 * ALL registered accounts - the "Users" figure - whether or not they have
 * bought anything. Deliberately separate from `listCustomers`, which is paid
 * buyers only: a signup is not a customer, and the panel should never imply one.
 */
export async function listUsers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      fullName: userProfiles.fullName,
      phone: userProfiles.phone,
      emailVerifiedAt: users.emailVerifiedAt,
      orderCount: sql<number>`count(${orders.id})::int`,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(orders, eq(orders.userId, users.id))
    .groupBy(
      users.id,
      users.email,
      users.name,
      users.role,
      users.createdAt,
      users.emailVerifiedAt,
      userProfiles.fullName,
      userProfiles.phone,
    )
    .orderBy(desc(users.createdAt))
    .limit(500);
}

export async function getCustomerDetail(userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return null;
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  const userOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  const userAddresses = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.createdAt));
  return {
    user: { id: row.id, email: row.email, name: row.name, createdAt: row.createdAt, role: row.role },
    profile: profile ?? null,
    orders: userOrders,
    addresses: userAddresses,
  };
}

/** Just the role - the narrow lookup the delete guard needs before it does
 *  anything. Returns null when there is no such account. */
export async function getUserRole(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role ?? null;
}

/** Raised when a caller asks to delete an admin/owner account. Thrown from the
 *  DATA layer as well as the router so the guard cannot be bypassed by a future
 *  caller that forgets to check. */
export class AdminDeleteRefusedError extends Error {
  constructor(message: string = ADMIN_ACCOUNT_UNDELETABLE_MESSAGE) {
    super(message);
    this.name = "AdminDeleteRefusedError";
  }
}

/** Exact column names in the provider's OWN schema, which uses camelCase
 *  identifiers (Neon Auth / Better Auth). They are quoted because Postgres
 *  folds unquoted identifiers to lower case, so `"userId"` and `userId` are
 *  different names. */
const NEON_AUTH_IDENTITY_TABLES = [
  { table: "session", column: "userId" },
  { table: "account", column: "userId" },
  { table: "member", column: "userId" },
  { table: "invitation", column: "inviterId" },
] as const;

/** What a completed deletion removed. Reported back so the panel - and the
 *  human reading the log - can see exactly what happened to every dependent. */
export interface UserDeleteSummary {
  id: string;
  email: string;
  role: string;
  /** Rows removed from the provider's own auth schema (its tables have no FK to
   *  `public.users`, so they must be cleaned explicitly). */
  neonAuth: {
    users: number;
    sessions: number;
    accounts: number;
    members: number;
    invitations: number;
    verifications: number;
  };
}

/** Count rows matching one provider-schema delete, tolerating the two driver
 *  result shapes (a bare rows array on neon-http, `{ rows }`/`{ rowCount }` on
 *  node-postgres). */
async function countProviderRows(sqlText: SQL): Promise<number> {
  const res = await db.execute(sqlText);
  const rows = rowsOf(res);
  const first = rows[0] as Record<string, unknown> | undefined;
  return first ? Number(first.n ?? 0) : 0;
}

/**
 * Permanently delete a user account and every credential that belongs to it.
 *
 * Two halves, in this order:
 *
 *  1. The PROVIDER's own identity rows (`neon_auth.*`). Neon Auth stores users
 *     in a SEPARATE schema with its own ids and NO foreign keys to
 *     `public.users`, so nothing cascades these - without an explicit cleanup the
 *     person could still sign in through the provider and we would silently
 *     re-create a local row for them. Sessions are removed too, so a live cookie
 *     stops working immediately rather than at its natural expiry.
 *  2. The LOCAL `public.users` row, which cascades to `addresses`,
 *     `user_profiles`, `wishlist_items` and `email_verifications` (all declared
 *     `on delete cascade`) and nulls the link on `orders`, `reviews`,
 *     `contact_messages` and `files` (declared `on delete set null`). Historical
 *     records keep their row for the store's books; they simply stop pointing at
 *     an account that no longer exists.
 *
 * Refuses an admin/owner account (defence in depth), and returns null when the
 * account does not exist. On a provider-cleanup failure NOTHING is deleted
 * locally, so the operation is retryable and never leaves a de-linked identity
 * behind.
 */
export async function deleteUserAccount(userId: string): Promise<UserDeleteSummary | null> {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      neonAuthUserId: users.neonAuthUserId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  if (isAdminRole(row.role)) throw new AdminDeleteRefusedError();

  const neonAuth = { users: 0, sessions: 0, accounts: 0, members: 0, invitations: 0, verifications: 0 };
  const neonId = row.neonAuthUserId;
  // The provider's id columns are `uuid`, so a NON-uuid value (an older or
  // malformed link) would make the cleanup query itself ERROR. Guard on the
  // shape first, and treat the whole provider cleanup as best-effort: the local
  // account must still be deletable when the link is junk - a cleanup that
  // cannot run must never stop the owner clearing an account.
  const isUuid = (v: string | null): v is string =>
    typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  if (isUuid(neonId)) {
    try {
      // Count first, delete, then report - so the summary states what really
      // happened rather than what we assumed would happen.
      for (const { table, column } of NEON_AUTH_IDENTITY_TABLES) {
        const before = await countProviderRows(
          sql`select count(*)::int as n from ${sql.raw(`neon_auth."${table}"`)} where ${sql.raw(`"${column}"`)} = ${neonId}`,
        );
        if (before > 0) {
          await db.execute(
            sql`delete from ${sql.raw(`neon_auth."${table}"`)} where ${sql.raw(`"${column}"`)} = ${neonId}`,
          );
        }
        const bucket =
          table === "session" ? "sessions" : table === "account" ? "accounts" : table === "member" ? "members" : "invitations";
        neonAuth[bucket] = before;
      }
      // Pending verification / password-reset tokens are keyed by IDENTIFIER (the
      // address), not by user id - clearing them stops an emailed link from being
      // used after the account is gone.
      const identifier = (row.email ?? "").trim().toLowerCase();
      if (identifier) {
        neonAuth.verifications = await countProviderRows(
          sql`select count(*)::int as n from neon_auth."verification" where "identifier" = ${identifier}`,
        );
        if (neonAuth.verifications > 0) {
          await db.execute(sql`delete from neon_auth."verification" where "identifier" = ${identifier}`);
        }
      }
      // The provider's IDENTITY row itself, last: without removing it the person
      // could sign in through the provider again and we would silently re-create
      // a local row for them - the delete would not really stick.
      neonAuth.users = await countProviderRows(
        sql`select count(*)::int as n from neon_auth."user" where "id" = ${neonId}`,
      );
      if (neonAuth.users > 0) {
        await db.execute(sql`delete from neon_auth."user" where "id" = ${neonId}`);
      }
    } catch (e) {
      console.error("[delete-user] provider cleanup failed; local account removal proceeds", e);
    }
  }

  const removed = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
  if (removed.length === 0) return null;
  return { id: row.id, email: row.email, role: row.role, neonAuth };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────
export async function listProductReviews(productId: string): Promise<Review[]> {
  return db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.productId, productId),
        eq(reviews.status, "approved"),
        eq(reviews.isPublic, true),
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(50);
}

/** Store-wide testimonials (product_id IS NULL) for the home page. Only
 *  approved, public rows - a pending testimonial is never shown. */
export async function listStoreReviews(limit = 6): Promise<Review[]> {
  return db
    .select()
    .from(reviews)
    .where(
      and(
        isNull(reviews.productId),
        eq(reviews.status, "approved"),
        eq(reviews.isPublic, true),
      ),
    )
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function listAllReviews() {
  return db
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productName: products.name,
      userId: reviews.userId,
      orderId: reviews.orderId,
      authorName: reviews.authorName,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      verified: reviews.verified,
      status: reviews.status,
      isPublic: reviews.isPublic,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(products, eq(reviews.productId, products.id))
    .orderBy(desc(reviews.createdAt))
    .limit(300);
}

export async function createReview(input: {
  productId: string | null;
  userId: string | null;
  orderId: string | null;
  authorName: string;
  rating: number;
  title?: string | null;
  body: string;
  verified: boolean;
  /** Public `/app-storage/<key>` paths for the buyer's photos, already validated
   *  and capped by the router. Omitted means the review carries no photos. */
  images?: string[];
}): Promise<Review> {
  const [row] = await db
    .insert(reviews)
    .values({
      productId: input.productId,
      userId: input.userId,
      orderId: input.orderId,
      authorName: input.authorName,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      verified: input.verified,
      images: input.images ?? [],
      // Nothing is public on arrival. An admin approves it first.
      status: "pending",
      isPublic: true,
    })
    .returning();
  return row;
}

/** Admin decision: 'approved' | 'rejected' | 'pending'. */
export async function setReviewStatus(id: string, status: string) {
  const [row] = await db
    .update(reviews)
    .set({ status, updatedAt: new Date() })
    .where(eq(reviews.id, id))
    .returning();
  return row ?? null;
}

/** Admin toggle: show or hide an approved review without rejecting it. */
export async function setReviewVisibility(id: string, isPublic: boolean) {
  const [row] = await db
    .update(reviews)
    .set({ isPublic, updatedAt: new Date() })
    .where(eq(reviews.id, id))
    .returning();
  return row ?? null;
}

export async function deleteReview(id: string) {
  await db.delete(reviews).where(eq(reviews.id, id));
  return { ok: true };
}

/** The completed order that lets this customer review this product, or null.
 *  "Completed" means the payment settled (paid or refunded) - a pending or
 *  failed order does not earn a review. Returns the order id so the review can
 *  be tied back to the purchase it came from. */
export async function findPurchasedOrderForProduct(
  userId: string,
  productId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ orderId: orders.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, productId),
        inArray(orders.paymentStatus, ["paid", "refunded"]),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return row?.orderId ?? null;
}

/** True when this customer has a paid order containing the product - used to
 *  mark a review "verified purchase" instead of letting anyone claim one. */
export async function hasPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  return (await findPurchasedOrderForProduct(userId, productId)) !== null;
}

/** True when this customer has at least one settled (paid) order. This is the
 *  gate for the review-photo upload: a photo may only be attached by someone the
 *  store has actually sold to, so the endpoint cannot double as anonymous file
 *  storage. */
export async function hasAnyPurchasedOrder(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.paymentStatus, "paid")));
  return (row?.value ?? 0) > 0;
}

/** True when this customer already has a review (any status) for the product,
 *  so the form can say "you have already reviewed this" instead of letting them
 *  stack duplicates. */
export async function hasReviewedProduct(userId: string, productId: string): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(reviews)
    .where(and(eq(reviews.userId, userId), eq(reviews.productId, productId)));
  return (row?.value ?? 0) > 0;
}

/** The most recent REAL purchases of a product, for the product page's social
 *  proof toast.
 *
 *  Read straight from the orders that actually contain the product, so the toast
 *  can never invent a buyer, a city or a time. Only a first name and the
 *  destination city are exposed - never a surname, an email or a precise
 *  address - so the store never publishes a customer's identity.
 *
 *  Two honest limits: a purchase only counts once its payment SETTLED, and only
 *  one placed within `withinHours` is returned. A weeks-old order announced as
 *  "just purchased" would be its own kind of lie, so a stale set returns an
 *  empty list and the page shows no toast at all. */
export async function listRecentProductPurchases(
  productId: string,
  limit = 3,
  withinHours = 72,
): Promise<{ orderId: string; firstName: string; city: string; purchasedAt: Date }[]> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const rows = await db
    .select({
      orderId: orders.id,
      createdAt: orders.createdAt,
      shippingAddress: orders.shippingAddress,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orderItems.productId, productId),
        eq(orders.paymentStatus, "paid"),
        gte(orders.createdAt, since),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  return rows.flatMap((r) => {
    const full = (r.shippingAddress?.fullName ?? "").trim();
    const city = (r.shippingAddress?.city ?? "").trim();
    if (!full || !city) return [];
    return [{ orderId: r.orderId, firstName: firstWord(full), city, purchasedAt: r.createdAt }];
  });
}

/** The first name only - the most we ever publish about a real customer. */
function firstWord(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEO
// ─────────────────────────────────────────────────────────────────────────────
export async function listSeoProducts() {
  return db
    .select({
      slug: products.slug,
      name: products.name,
      category: products.category,
      priceCents: products.priceCents,
      image: sql<string | null>`${products.images}->>0`,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(and(eq(products.active, true), eq(products.archived, false)))
    .orderBy(asc(products.sortOrder), asc(products.name));
}

// ─────────────────────────────────────────────────────────────────────────────
// Newsletter
// ─────────────────────────────────────────────────────────────────────────────
/** Subscribe an email. Idempotent: a repeat signup returns the existing row
 *  rather than erroring, so the storefront can always show a success state. */
export async function subscribeNewsletter(email: string, source = "footer") {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, normalized))
    .limit(1);
  if (existing) return { subscriber: existing, alreadySubscribed: true };
  const [row] = await db
    .insert(newsletterSubscribers)
    .values({ email: normalized, source })
    .returning();
  return { subscriber: row, alreadySubscribed: false };
}

/** The WHERE clause for a subscriber search, or `undefined` for "no filter".
 *
 *  Matches the panel's search box exactly as it behaved when the list was
 *  filtered in the browser - case-insensitive substring across the three visible
 *  columns - but applied in SQL so it searches the WHOLE list rather than the
 *  page that happened to be loaded. The term is made literal first
 *  (`likeContains` escapes `%` and `_`), so a search for "%" matches a per-cent
 *  sign and not every row. */
function newsletterSearchFilter(term: string): SQL | undefined {
  if (!term) return undefined;
  const pattern = likeContains(term);
  return or(
    ilike(newsletterSubscribers.email, pattern),
    ilike(newsletterSubscribers.source, pattern),
    ilike(newsletterSubscribers.status, pattern),
  );
}

/** How many subscribers match, in total. The panel's count and its page count
 *  both come from this, so neither can drift from the list it describes. */
export async function countNewsletterSubscribers(search = ""): Promise<number> {
  const where = newsletterSearchFilter(sanitizeSearchTerm(search));
  const [row] = await db.select({ value: count() }).from(newsletterSubscribers).where(where);
  // `count()` comes back as a number or a bigint string depending on the driver.
  return Number(row?.value ?? 0);
}

/**
 * One page of newsletter subscribers, newest first.
 *
 * SERVER-SIDE PAGING. The list is unbounded - every footer signup appends a row
 * - so the panel never loads it whole. It asks for a page and gets exactly that,
 * with `total` alongside so the caller can print "N of M" from the same
 * response instead of a second guess.
 *
 * STABLE ORDER. The sort is `createdAt` DESC with `id` as a tiebreaker. A
 * tiebreaker is not decoration: without it two subscribers who signed up in the
 * same millisecond could swap places between requests, and the same row could
 * then appear on two consecutive pages while another was skipped entirely.
 *
 * PAST-THE-END RECOVERY. A page number can name a slice that no longer exists -
 * the admin deleted the last rows on the final page, or a search shrank the list
 * between the render and the click. Rather than answer an empty page, the LAST
 * REAL PAGE is served and the page it resolved to is returned, so the caller's
 * controls land somewhere that exists.
 */
export async function listNewsletterSubscribersPage(
  paging: ResolvedPaging,
  search = "",
): Promise<Paginated<NewsletterSubscriber>> {
  const where = newsletterSearchFilter(sanitizeSearchTerm(search));
  const total = await countNewsletterSubscribers(search);

  // Clamp the requested offset onto the last page that has rows.
  const offset = Math.min(Math.max(0, paging.offset), lastPageOffset(total, paging.pageSize));

  const rows = await db
    .select()
    .from(newsletterSubscribers)
    .where(where)
    .orderBy(desc(newsletterSubscribers.createdAt), desc(newsletterSubscribers.id))
    .limit(paging.limit)
    .offset(offset);

  return {
    rows,
    total,
    page: pageForOffset(offset, paging.pageSize),
    pageSize: paging.pageSize,
    pageCount: pageCountFor(total, paging.pageSize),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact messages
// ─────────────────────────────────────────────────────────────────────────────
/** Persist a contact-form message. The caller (the router) has already
 *  validated and sanitised every field, so what lands here is clean and capped. */
export async function submitContactMessage(input: {
  userId?: string | null;
  name: string;
  email: string;
  topic: string;
  message: string;
  source?: string;
}) {
  const [row] = await db
    .insert(contactMessages)
    .values({
      userId: input.userId ?? null,
      name: input.name,
      email: input.email,
      topic: input.topic,
      message: input.message,
      source: input.source ?? "contact",
    })
    .returning();
  return row;
}

/** Admin read: the most recent messages first. */
export async function listContactMessages(limit = 100) {
  return db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt))
    .limit(limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist (per account)
// ─────────────────────────────────────────────────────────────────────────────
/** The product ids this account has saved, newest first. The router turns these
 *  into full products from the same catalog read the grid uses, so the wishlist
 *  page can never show a product the shop no longer stocks. */
export async function listWishlistProductIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt));
  return rows.map((r) => r.productId);
}

/** Add or remove one product for this account and return its NEW saved state.
 *  Idempotent on add (the unique index backs the onConflictDoNothing), so a
 *  double tap can never create two rows. */
export async function toggleWishlistItem(
  userId: string,
  productId: string,
): Promise<{ saved: boolean }> {
  const existing = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .delete(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)));
    return { saved: false };
  }
  await db
    .insert(wishlistItems)
    .values({ userId, productId })
    .onConflictDoNothing();
  return { saved: true };
}

// ────────────────────────────────────────────────────────────────────────────
// Categories (admin-managed)
// ────────────────────────────────────────────────────────────────────────────
/** A URL-safe slug for a category name. One definition so create and rename
 *  can never disagree on the slug a name maps to. */
function categorySlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "category";
}

/** Every category as a TREE: top-level aisles first, each with the subcategories
 *  filed under it.
 *
 *  WHY A TREE RATHER THAN A FLAT LIST. The storefront browses by aisle, and an
 *  aisle is only useful if it can show its children - "Pet Toys" has to offer
 *  "Pet Chew Toys" as a filter. Returning the two levels together also lets the
 *  admin product editor bind a subcategory select to its parent, and lets the
 *  browse surface render a parent that has NO products of its own but whose
 *  children do (its count is the roll-up, so it never reads as empty).
 *
 *  The rows are read once and folded in memory - the table is small (tens) and a
 *  single query is simpler and more predictable than a recursive CTE. The
 *  product count is a LEFT JOIN + GROUP BY (not a correlated subquery, which
 *  silently correlates wrong under Drizzle). */
export async function listCategories() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      parentId: categories.parentId,
      featured: categories.featured,
      sortOrder: categories.sortOrder,
      orderPinned: categories.orderPinned,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, eq(products.category, categories.name))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  type Row = (typeof rows)[number];

  // ── Fold legacy aisle names onto their current name ───────────────────────
  // A row can be stored under a name the storefront has since renamed (rows
  // written by the seeder before a taxonomy change, e.g. "Feeding"). The
  // storefront REPORTS products under the current name ("Feeders & Fountains"),
  // so rendering the legacy row as its own aisle would show the same stock
  // twice - two tiles, one shelf. The stored string is left exactly as it is
  // (products reference it, and `categoryFilterValues` still matches it); only
  // the name this tree is LABELLED with is canonicalised, and rows that collapse
  // onto the same name are merged.
  const displayName = (name: string) => canonicaliseCategory(name, CATALOG_CATEGORIES);
  const merged = new Map<string, Row>();
  for (const row of rows) {
    const key = displayName(row.name);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, row);
      continue;
    }
    // Same shelf under two names: keep the first row (its id is what the admin
    // edits) and add the other's products, so the tile is not undercounted.
    merged.set(key, { ...existing, productCount: existing.productCount + row.productCount });
  }
  const nodes: Row[] = [...merged.entries()].map(([name, row]) => ({ ...row, name }));

  const byId = new Map<string, Row>(nodes.map((r) => [r.id, r]));
  // Any row whose parent is missing (or which is its own parent) is treated as
  // top-level, so a broken link can never make a category disappear entirely.
  const isRoot = (r: Row) => r.parentId == null || r.parentId === r.id || !byId.has(r.parentId);

  const rank = (a: Row, b: Row) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  // The stored order is authoritative the moment an admin has chosen one - see
  // `orderPinned` in drizzle/schema.ts, and migration 0015 which pins every
  // existing row so the live store's stored order is exactly what it already
  // rendered. Until a list has been pinned, the browse taxonomy's designed
  // sequence leads the aisles (an aisle the taxonomy does not know, i.e. an
  // admin-invented one, follows in stored order) so a fresh database shows the
  // curated shelf order rather than insertion order.
  const somePinned = nodes.some((r) => r.orderPinned);
  const rankRoots = (a: Row, b: Row) => {
    if (somePinned) return rank(a, b);
    const ao = TREE_PARENT_ORDER.get(a.name);
    const bo = TREE_PARENT_ORDER.get(b.name);
    if (ao !== undefined || bo !== undefined) {
      return (ao ?? Number.MAX_SAFE_INTEGER) - (bo ?? Number.MAX_SAFE_INTEGER) || rank(a, b);
    }
    return rank(a, b);
  };
  const roots = nodes.filter(isRoot).sort(rankRoots);
  const childrenOf = (id: string) => nodes.filter((r) => !isRoot(r) && r.parentId === id).sort(rank);

  return roots.map((root, index) => {
    const children = childrenOf(root.id).map((child) => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      description: child.description,
      productCount: child.productCount,
      featured: child.featured,
      sortOrder: child.sortOrder,
    }));
    // Roll-up: the aisle's own products PLUS its subcategories', so a parent
    // button that has nothing filed on it directly still shows the stock beneath
    // it rather than a misleading zero.
    const productCount = root.productCount + children.reduce((n, c) => n + c.productCount, 0);
    return {
      id: root.id,
      name: root.name,
      slug: root.slug,
      description: root.description,
      parentId: null as string | null,
      // The render position, reported so the admin list, the shop page and the
      // numeric "Sort order" field all agree. A pinned list's stored value IS
      // its position (the reorder renumbers 0..n-1); an unpinned one is placed
      // by the taxonomy, with anything it does not know falling to the end.
      sortOrder: somePinned
        ? root.sortOrder
        : (TREE_PARENT_ORDER.get(root.name) ?? treeParentNames().length + index),
      productCount,
      featured: root.featured,
      children,
    };
  });
}

/** Aisle name -> its position in the browse taxonomy, so the tree renders in the
 *  designed order rather than insertion order. */
const TREE_PARENT_ORDER: ReadonlyMap<string, number> = new Map(
  treeParentNames().map((name, i) => [name, i]),
);

export async function getCategoryById(id: string) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

/** How many products currently sit under a category name. */
export async function countProductsInCategory(name: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(products)
    .where(eq(products.category, name));
  return row?.value ?? 0;
}

/** Materialise a category row for a name products reference, so saving a product
 *  under a brand-new aisle keeps the categories list in step. Idempotent and
 *  best-effort - the caller's product write must never fail because of it. */
export async function ensureCategoryRow(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .insert(categories)
    .values({ name: trimmed, slug: categorySlug(trimmed) })
    .onConflictDoNothing();
}

export async function createCategory(input: {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  featured?: boolean;
  sortOrder?: number;
}) {
  const name = input.name.trim();
  const [row] = await db
    .insert(categories)
    .values({
      name,
      slug: input.slug?.trim() || categorySlug(name),
      description: input.description?.trim() ?? "",
      // A subcategory is created by passing its parent's id; a top-level aisle
      // leaves this null. The caller validates that the parent exists, so a
      // dangling id never reaches the FK.
      parentId: input.parentId ?? null,
      featured: input.featured ?? false,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

/** Rename / re-describe a category. Products store the category NAME (not an
 *  FK), so a rename also re-points every product filed under the old name. The
 *  caller checks for a name clash first, so the category update cannot fail on
 *  uniqueness after the products have already moved. */
export async function updateCategory(
  id: string,
  input: {
    name: string;
    slug?: string;
    description?: string;
    parentId?: string | null;
    featured?: boolean;
    sortOrder?: number;
  },
) {
  const current = await getCategoryById(id);
  if (!current) return null;
  const name = input.name.trim();
  if (name !== current.name) {
    await db
      .update(products)
      .set({ category: name, updatedAt: sql`now()` })
      .where(eq(products.category, current.name));
  }
  const [row] = await db
    .update(categories)
    .set({
      name,
      slug: input.slug?.trim() || categorySlug(name),
      description: input.description?.trim() ?? current.description,
      // `undefined` keeps the current parent (so a partial update never
      // silently promotes a subcategory); an explicit null promotes it.
      parentId: input.parentId === undefined ? current.parentId : input.parentId,
      featured: input.featured ?? current.featured,
      sortOrder: input.sortOrder ?? current.sortOrder,
      updatedAt: sql`now()`,
    })
    .where(eq(categories.id, id))
    .returning();
  return row ?? null;
}

/** The names of the subcategories filed under a category, so the caller can
 *  refuse a delete that would strand them. */
export async function listChildCategoryNames(id: string): Promise<string[]> {
  const rows = await db
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.parentId, id));
  return rows.map((r) => r.name);
}

/** Remove a category. The caller refuses this while products are still filed
 *  under the name, so deleting can never orphan a product into nowhere. */
export async function deleteCategory(id: string) {
  await db.delete(categories).where(eq(categories.id, id));
}

/** The ids of one sibling list, in its current render order: the top-level
 *  aisles when `parentId` is null, or one aisle's subcategories otherwise. The
 *  caller compares an incoming reorder against this, which is what keeps a drag
 *  from silently dropping a row out of the order. */
export async function listCategoryIds(parentId: string | null): Promise<string[]> {
  const tree = await listCategories();
  if (parentId === null) return tree.map((c) => c.id);
  const parent = tree.find((c) => c.id === parentId);
  return parent ? parent.children.map((c) => c.id) : [];
}

/** Persist a new order for ONE sibling list - the top-level aisles when
 *  `parentId` is null, or the subcategories of one aisle otherwise.
 *
 *  `ids` must be the complete list (the caller has already checked it is a
 *  permutation of `listCategoryIds`), and it is written as positions 0..n-1 in
 *  the given sequence. Setting `orderPinned` on every row is what makes the
 *  choice stick: from then on `listCategories` orders by `sort_order` alone
 *  instead of falling back to the taxonomy, so the drag survives a reload and
 *  shows on the storefront. */
export async function reorderCategories(input: {
  ids: string[];
  parentId: string | null;
}): Promise<number> {
  const ids = input.ids.filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) return 0;
  const inList =
    input.parentId === null
      ? isNull(categories.parentId)
      : eq(categories.parentId, input.parentId);
  await atomic((d) =>
    batch(
      ids.map((id, index) =>
        d
          .update(categories)
          .set({ sortOrder: index, orderPinned: true, updatedAt: sql`now()` })
          .where(and(eq(categories.id, id), inList)),
      ),
    ),
  );
  return ids.length;
}

// ────────────────────────────────────────────────────────────────────────────
// Contact-message + newsletter triage (admin)
// ────────────────────────────────────────────────────────────────────────────
export async function setContactMessageStatus(id: string, status: string) {
  const [row] = await db
    .update(contactMessages)
    .set({ status })
    .where(eq(contactMessages.id, id))
    .returning();
  return row ?? null;
}

/** Admin update: change any editable field of a message (full CRUD). */
export async function updateContactMessage(
  id: string,
  patch: { name?: string; email?: string; topic?: string; message?: string; status?: string },
) {
  const [row] = await db
    .update(contactMessages)
    .set(patch)
    .where(eq(contactMessages.id, id))
    .returning();
  return row ?? null;
}

/** Admin delete: remove a message permanently. */
export async function deleteContactMessage(id: string): Promise<boolean> {
  const rows = await db
    .delete(contactMessages)
    .where(eq(contactMessages.id, id))
    .returning({ id: contactMessages.id });
  return rows.length > 0;
}

/** Record the reply an admin sent. Kept separate from `setContactMessageStatus`
 *  because sending a reply and flipping the status flag are different acts, and
 *  the reply must store its body and time, not only a state. */
export async function recordContactMessageReply(id: string, replyBody: string) {
  const [row] = await db
    .update(contactMessages)
    .set({ replyBody, repliedAt: new Date(), status: "replied" })
    .where(eq(contactMessages.id, id))
    .returning();
  return row ?? null;
}

/** Admin create: a message the admin records (e.g. a phone enquiry), so the
 *  inbox is a full CRUD surface rather than a read-only feed. */
export async function createContactMessage(input: {
  name: string;
  email: string;
  topic: string;
  message: string;
  source?: string;
}) {
  const [row] = await db
    .insert(contactMessages)
    .values({
      name: input.name,
      email: input.email,
      topic: input.topic,
      message: input.message,
      source: input.source ?? "admin",
    })
    .returning();
  return row;
}

export async function setNewsletterSubscriberStatus(id: string, status: string) {
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ status })
    .where(eq(newsletterSubscribers.id, id))
    .returning();
  return row ?? null;
}

/**
 * Permanently remove a subscriber - the way to clear a random, spam or fake
 * address that got into the list.
 *
 * DELETES THE ROW, unlike `setNewsletterSubscriberStatus`, which suppresses an
 * address but deliberately keeps its history. A bogus address should leave no
 * trace: once removed it cannot be exported, mailed or shown again.
 *
 * Reports whether a row was actually removed, so the caller can answer NOT_FOUND
 * for an id that matched nothing instead of reporting a delete that never
 * happened. `returning` is what makes that distinction available - a DELETE that
 * matched no row simply returns no rows.
 */
export async function deleteNewsletterSubscriber(id: string): Promise<boolean> {
  const rows = await db
    .delete(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .returning({ id: newsletterSubscribers.id });
  return rows.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Saved cart - the server-owned basket, scoped to one account
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS EXISTS. The basket used to live ONLY in the browser's localStorage.
// The server had no cart, so nothing could authorise a read or a write: after a
// sign-out the previous account's items were still in localStorage and still
// rendered in the cart panel, and no mutation could be refused for want of a
// session. Persisting it against `users.id` makes the cart an OWNED resource -
// every function here takes the OWNER id and filters on it, so a caller can
// never reach another account's basket, and a request without a verified
// session cannot reach these functions at all (see the `cart` router, which is
// built on protectedProcedure).
//
// PRICING IS ALWAYS SERVER-SIDE. Every field the UI renders is resolved here
// from the product and variant rows, never from the client's payload, so a
// stale or hand-edited localStorage basket can change what is DISPLAYED but
// never what an order is charged.

/** The most units of a single line the store will hold in a basket. Mirrors
 *  MAX_ORDER_QTY in client/src/lib/quantity.ts; duplicated here (rather than
 *  imported from the client tree) because the server must clamp on its own. */
const MAX_CART_QTY = 99;

export interface CartViewLine {
  slug: string;
  variantId: string | null;
  /** The catalog product's own row id. See the note where the line is built: the
   *  storefront's analytics needs one stable product identifier across every
   *  funnel step, and the slug is the cart's key, not the catalog's. */
  productId: string;
  name: string;
  variantName: string | null;
  priceCents: number;
  /** The picture for THIS line. For a variant-backed line it is the variant's
   *  OWN photograph (R2), so the basket shows the colour/option the shopper
   *  actually picked rather than the product's generic hero shot; it falls back
   *  to the product's first image only when the variant has none. */
  image: string | null;
  qty: number;
  maxQty: number;
}

export interface CartView {
  lines: CartViewLine[];
  count: number;
  subtotalCents: number;
}

/** Resolve (creating on first use) the signed-in user's cart row.
 *
 *  `carts.user_id` is UNIQUE, so the insert is idempotent: two concurrent first
 *  calls converge on ONE row rather than racing to create two baskets. */
export async function ensureCart(userId: string): Promise<string> {
  const [existing] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(carts)
    .values({ userId })
    .onConflictDoNothing({ target: carts.userId })
    .returning({ id: carts.id });
  if (created) return created.id;

  // Another request won the race - read the row it created.
  const [row] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.userId, userId))
    .limit(1);
  if (!row) throw new Error("Could not open a saved cart for this account.");
  return row.id;
}

/** Match one line, tolerating a NULL variant (the base product).
 *  A plain `eq` never matches NULL, so the base-product line needs `is null`. */
function cartLineMatch(cartId: string, productId: string, variantId: string | null) {
  return and(
    eq(cartItems.cartId, cartId),
    eq(cartItems.productId, productId),
    variantId === null ? isNull(cartItems.variantId) : eq(cartItems.variantId, variantId),
  );
}

/** The shopper's saved cart, named and priced from the CURRENT catalog.
 *
 *  Retired content is dropped on read rather than failing later: an inactive or
 *  archived product, and a variant that is gone or deactivated, simply does not
 *  appear in the basket. A variant-backed line never silently falls back to the
 *  base product's price - if its variant is retired the line is dropped, so the
 *  shopper is never quoted a price for something that is not for sale. */
export async function getCart(userId: string): Promise<CartView> {
  const cartId = await ensureCart(userId);

  const rows = await db
    .select({
      qty: cartItems.qty,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      priceCents: products.priceCents,
      images: products.images,
      variantId: cartItems.variantId,
      variantName: productVariants.name,
      variantImage: productVariants.imageUrl,
      variantPriceCents: productVariants.priceCents,
      variantStock: productVariants.inventoryQty,
      variantActive: productVariants.active,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(
      and(
        eq(cartItems.cartId, cartId),
        eq(products.active, true),
        eq(products.archived, false),
      ),
    )
    .orderBy(asc(cartItems.createdAt));

  const lines: CartViewLine[] = [];

  for (const r of rows) {
    // A line whose variant was retired (or deactivated) is dropped, never
    // repriced to the base product.
    if (r.variantId && (!r.variantActive || r.variantPriceCents === null)) continue;

    const unit = r.variantId ? r.variantPriceCents! : r.priceCents;
    const stock = r.variantId
      ? (r.variantStock ?? 0)
      : await productCeiling(r.productId);
    const maxQty = Math.max(1, Math.min(MAX_CART_QTY, stock));
    const qty = Math.max(1, Math.min(maxQty, r.qty));

    lines.push({
      slug: r.slug,
      variantId: r.variantId ?? null,
      // The PRODUCT id, carried alongside the slug. The slug identifies the line
      // for the cart API, but analytics needs the same stable product identifier
      // `view_item` and `add_to_cart` send, or GA4 reports one product under two
      // ids and its funnel never joins up. Sent as an opaque string - it is the
      // catalog's own row id, not a secret.
      productId: r.productId,
      name: r.name,
      variantName: r.variantName ?? null,
      priceCents: unit,
      // The picked variant's OWN photo when it has one, so the basket line
      // matches the option chosen on the product page; the product's first
      // image only as the fallback for a line with no variant picture.
      image: r.variantImage ?? r.images?.[0] ?? null,
      qty,
      maxQty,
    });
  }

  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
  return { lines, count, subtotalCents };
}

/** Resolve and validate the product/variant pair a mutation names.
 *
 *  Throws a plain Error with shopper-facing wording when the pair cannot be
 *  sold. The variant must BELONG to the product - otherwise a crafted payload
 *  could attach any variant to any product and be quoted that variant's price. */
async function resolveCartTarget(productId: string, variantId: string | null) {
  const [product] = await db
    .select({ id: products.id, active: products.active, archived: products.archived })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product || !product.active || product.archived) {
    throw new Error("That product is no longer available.");
  }
  if (!variantId) return;

  const [variant] = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      active: productVariants.active,
      inventoryQty: productVariants.inventoryQty,
    })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);
  if (!variant || variant.productId !== productId || !variant.active) {
    throw new Error("That option is no longer available.");
  }
}

/** Add units to a line, merging into the existing line for the same
 *  product+variant. `ON CONFLICT` does the merge in ONE statement, and the
 *  ceiling is applied in SQL - so a "tapped + twice quickly" double submit
 *  cannot exceed stock, and two concurrent adds cannot interleave. */
export async function addCartItem(
  userId: string,
  productId: string,
  variantId: string | null,
  qty: number,
): Promise<void> {
  await resolveCartTarget(productId, variantId);
  const cartId = await ensureCart(userId);
  const added = Math.max(1, Math.min(MAX_CART_QTY, Math.trunc(qty) || 1));

  const ceiling = variantId ? await variantCeiling(productId, variantId) : await productCeiling(productId);

  await db
    .insert(cartItems)
    .values({ cartId, productId, variantId, qty: added })
    .onConflictDoUpdate({
      // `cart_items_line_idx` is UNIQUE ... NULLS NOT DISTINCT, so the base
      // product and each variant is exactly one line and this target infers it.
      target: [cartItems.cartId, cartItems.productId, cartItems.variantId],
      set: {
        qty: sql`least(${ceiling}, ${cartItems.qty} + excluded.qty)`,
        updatedAt: sql`now()`,
      },
    });
}

async function variantCeiling(_productId: string, variantId: string): Promise<number> {
  const [row] = await db
    .select({ stock: productVariants.inventoryQty })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);
  return Math.max(1, Math.min(MAX_CART_QTY, row?.stock ?? 0));
}

async function productCeiling(productId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${productVariants.inventoryQty}), 0)` })
    .from(productVariants)
    .where(and(eq(productVariants.productId, productId), eq(productVariants.active, true)));
  return Math.max(1, Math.min(MAX_CART_QTY, Number(row?.total ?? 0)));
}

/** Set one line to an exact quantity. Zero (or below) REMOVES the line, which
 *  is how the stepper's "-" at 1 drops an item rather than sitting at one. */
export async function setCartItemQty(
  userId: string,
  productId: string,
  variantId: string | null,
  qty: number,
): Promise<void> {
  const cartId = await ensureCart(userId);
  if (!(qty > 0)) {
    await db.delete(cartItems).where(cartLineMatch(cartId, productId, variantId));
    return;
  }
  await resolveCartTarget(productId, variantId);
  const ceiling = variantId ? await variantCeiling(productId, variantId) : await productCeiling(productId);
  const wanted = Math.max(1, Math.min(ceiling, Math.trunc(qty)));

  await db
    .insert(cartItems)
    .values({ cartId, productId, variantId, qty: wanted })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId, cartItems.variantId],
      set: { qty: wanted, updatedAt: sql`now()` },
    });
}

/** Remove one line. Owner-scoped by construction: the cart id is resolved from
 *  the caller's own user id, so this can only ever touch their own basket. */
export async function removeCartItem(
  userId: string,
  productId: string,
  variantId: string | null,
): Promise<void> {
  const cartId = await ensureCart(userId);
  await db.delete(cartItems).where(cartLineMatch(cartId, productId, variantId));
}

/** Empty the signed-in user's cart. Used by "clear" and after a successful
 *  order - a placed order consumes the basket. */
export async function clearCart(userId: string): Promise<void> {
  const cartId = await ensureCart(userId);
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}
