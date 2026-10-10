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
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { atomic, db, isUniqueViolation } from "./_core/db";
import {
  addresses,
  newsletterSubscribers,
  orderEvents,
  orderItems,
  orders,
  productVariants,
  products,
  reviews,
  userProfiles,
  users,
} from "../drizzle/schema";
import type { Order, OrderEvent, OrderItem, Product, ProductVariant, Review } from "../drizzle/schema";
import { newOrderNumber, type AddressSnapshot } from "../shared/store";
import { getSettings } from "./store-settings";

export class OutOfStockError extends Error {
  constructor(public readonly productName: string) {
    super(`Sorry — ${productName} just sold out. Please adjust your cart and try again.`);
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
export type ProductWithVariants = Product & { variants: ProductVariant[] };

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

export type ProductSort = "featured" | "price-asc" | "price-desc" | "newest" | "name";

export async function listProducts(opts: {
  category?: string;
  search?: string;
  sort?: ProductSort;
  includeInactive?: boolean;
  limit?: number;
}): Promise<ProductWithVariants[]> {
  const where: SQL[] = [];
  if (!opts.includeInactive) where.push(eq(products.active, true));
  if (opts.category && opts.category !== "All") where.push(eq(products.category, opts.category));
  if (opts.search && opts.search.trim()) {
    const term = `%${opts.search.trim()}%`;
    const clauses = or(
      ilike(products.name, term),
      ilike(products.description, term),
      ilike(products.category, term),
    );
    if (clauses) where.push(clauses);
  }

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

  const rows = await db
    .select()
    .from(products)
    .where(where.length ? and(...where) : undefined)
    .orderBy(...orderBy)
    .limit(opts.limit ?? 200);

  return attachVariants(rows, await listVariantsForProducts(rows.map((r) => r.id)));
}

export async function listFeaturedProducts(limit = 8): Promise<ProductWithVariants[]> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.active, true), eq(products.featured, true)))
    .orderBy(asc(products.sortOrder), asc(products.name))
    .limit(limit);
  if (rows.length > 0) return attachVariants(rows, await listVariantsForProducts(rows.map((r) => r.id)));
  // Fall back to the newest active products so the home page is never empty.
  return listProducts({ sort: "newest", limit });
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
    .where(and(eq(products.slug, slug), eq(products.active, true)))
    .limit(1);
  if (!row) return null;
  return { ...row, variants: await variantsFor(row.id) };
}

export async function getProductById(id: string): Promise<ProductWithVariants | null> {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) return null;
  return { ...row, variants: await variantsFor(row.id) };
}

export async function listCategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(eq(products.active, true));
  return rows.map((r) => r.category);
}

export async function listRelatedProducts(
  excludeId: string,
  category: string,
  limit = 4,
): Promise<ProductWithVariants[]> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.active, true), eq(products.category, category), ne(products.id, excludeId)))
    .limit(limit);
  if (rows.length === 0) return [];
  return attachVariants(rows, await listVariantsForProducts(rows.map((r) => r.id)));
}

// ── admin writes ─────────────────────────────────────────────────────────────
export type ProductInput = {
  name: string;
  slug: string;
  description: string;
  category: string;
  priceCents: number;
  compareAtCents?: number | null;
  images: string[];
  tags: string[];
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
      images: input.images,
      tags: input.tags,
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
      images: input.images,
      tags: input.tags,
      active: input.active,
      featured: input.featured,
      sortOrder: input.sortOrder ?? 0,
      updatedAt: sql`now()`,
    })
    .where(eq(products.id, id))
    .returning();
  return row ?? null;
}

export async function deleteProduct(id: string) {
  await db.delete(products).where(eq(products.id, id));
  return { ok: true };
}

export type VariantInput = {
  productId: string;
  name: string;
  sku: string;
  priceCents: number;
  inventoryQty: number;
  sortOrder?: number;
  active: boolean;
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
 *  else — it never leaks another customer's order. */
export async function getUserOrderDetail(orderId: string, userId: string): Promise<OrderDetail | null> {
  const [row] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  if (!row) return null;
  return getOrderDetail(row.id);
}

/** Accept either an order UUID or the human order number — both owner-scoped. */
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
  if (opts.search?.trim()) {
    const term = `%${opts.search.trim()}%`;
    const clauses = or(
      ilike(orders.orderNumber, term),
      ilike(orders.email, term),
      ilike(orders.trackingNumber, term),
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
    .where(and(inArray(products.slug, slugs), eq(products.active, true)));
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

  const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
  const shippingCents =
    subtotalCents >= settings.free_shipping_threshold_cents ? 0 : settings.shipping_flat_cents;
  const taxCents = Math.round((subtotalCents * settings.tax_rate_bps) / 10000);
  const totalCents = subtotalCents + shippingCents + taxCents;

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
            note: "Order placed — awaiting payment confirmation.",
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

export async function updateOrderTracking(input: {
  orderId: string;
  trackingNumber: string | null;
  carrier: string | null;
  note?: string | null;
}) {
  // Adding a tracking number means the parcel has left the warehouse, so the
  // order status must move to "shipped" in the SAME write as the "shipped"
  // event we log — otherwise the history says shipped while the order still
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

// ── admin aggregates ─────────────────────────────────────────────────────────
export async function adminStats() {
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
  const [customerRow] = await db.select({ value: count() }).from(users);
  const [reviewRow] = await db.select({ value: count() }).from(reviews);

  const lowStock = await db
    .select({
      id: productVariants.id,
      name: productVariants.name,
      sku: productVariants.sku,
      inventoryQty: productVariants.inventoryQty,
      productName: products.name,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(productVariants.active, true), lte(productVariants.inventoryQty, 5)))
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

  return {
    revenueCents: revenueRow?.value ?? 0,
    orderCount: orderCountRow?.value ?? 0,
    openOrders: openRow?.value ?? 0,
    customerCount: customerRow?.value ?? 0,
    reviewCount: reviewRow?.value ?? 0,
    lowStock,
    recentOrders,
    topProducts,
  };
}

export async function listCustomers() {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      fullName: userProfiles.fullName,
      phone: userProfiles.phone,
      orderCount: sql<number>`count(${orders.id})::int`,
      spendCents: sql<number>`coalesce(sum(case when ${orders.paymentStatus} = 'paid' then ${orders.totalCents} else 0 end), 0)::int`,
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
    .orderBy(desc(users.createdAt))
    .limit(300);
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

// ─────────────────────────────────────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────────────────────────────────────
export async function listProductReviews(productId: string): Promise<Review[]> {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.productId, productId))
    .orderBy(desc(reviews.createdAt))
    .limit(50);
}

/** Store-wide testimonials (product_id IS NULL) for the home page. */
export async function listStoreReviews(limit = 6): Promise<Review[]> {
  return db
    .select()
    .from(reviews)
    .where(isNull(reviews.productId))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}

export async function listAllReviews() {
  return db
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productName: products.name,
      authorName: reviews.authorName,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      verified: reviews.verified,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(products, eq(reviews.productId, products.id))
    .orderBy(desc(reviews.createdAt))
    .limit(300);
}

export async function createReview(input: {
  productId: string | null;
  authorName: string;
  rating: number;
  title?: string | null;
  body: string;
  verified: boolean;
}): Promise<Review> {
  const [row] = await db
    .insert(reviews)
    .values({
      productId: input.productId,
      authorName: input.authorName,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
      verified: input.verified,
    })
    .returning();
  return row;
}

export async function deleteReview(id: string) {
  await db.delete(reviews).where(eq(reviews.id, id));
  return { ok: true };
}

/** True when this customer has a paid order containing the product — used to
 *  mark a review "verified purchase" instead of letting anyone claim one. */
export async function hasPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productId, productId),
        inArray(orders.paymentStatus, ["paid", "refunded"]),
      ),
    );
  return (row?.value ?? 0) > 0;
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
    .where(eq(products.active, true))
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

export async function listNewsletterSubscribers() {
  return db
    .select()
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.createdAt));
}
