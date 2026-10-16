// REAL-DATABASE integration test for the admin product CRUD and the storefront
// visibility it drives. Unlike server/routers.test.ts (which mocks the data
// layer), this exercises the actual SQL: create -> visible, hide -> absent,
// show -> back, edit -> reflected, delete -> gone, and the order-history rule
// (a product a customer ordered is ARCHIVED, not erased, so the order keeps its
// link to it).
//
// It SELF-SKIPS when no database is reachable (CI runs with a placeholder
// DATABASE_URL and no Postgres service) or when the `archived` migration has not
// been applied, so it never turns a hermetic CI run red.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Pick up a local .env (DATABASE_URL) when the runner did not already have one.
// vitest.setup.ts runs first and installs a PLACEHOLDER DATABASE_URL, so this
// must OVERRIDE it (not `??=`) for the local run to reach the real database; in
// CI there is no .env, the placeholder stands, and the suite self-skips.
try {
  const text = readFileSync(path.resolve(import.meta.dirname, "../.env"), "utf8");
  for (const line of text.split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) process.env[m[1]] = m[2];
  }
} catch {
  // No .env - rely on the ambient environment (CI sets placeholders).
}

const { db } = await import("./_core/db");
const { products, orderItems, orders } = await import("../drizzle/schema");
const { eq, inArray } = await import("drizzle-orm");
const { createProduct, updateProduct, deleteProduct, listProducts, getProductBySlug } = await import(
  "./db"
);

async function probe(): Promise<{ reachable: boolean; hasArchived: boolean }> {
  try {
    await db.select({ id: products.id }).from(products).limit(1);
  } catch {
    return { reachable: false, hasArchived: false };
  }
  try {
    await db.select({ archived: products.archived }).from(products).limit(1);
    return { reachable: true, hasArchived: true };
  } catch {
    return { reachable: true, hasArchived: false };
  }
}

const { reachable, hasArchived } = await probe();
const suite = reachable && hasArchived ? describe : describe.skip;

const createdProductIds: string[] = [];
const createdOrderIds: string[] = [];

type ProductRow = Awaited<ReturnType<typeof createProduct>>;

async function makeProduct(overrides: Partial<Parameters<typeof createProduct>[0]> = {}) {
  const slug = `itest-product-${randomUUID().slice(0, 8)}`;
  const row = await createProduct({
    name: `Integration Test ${slug}`,
    slug,
    description: "created by the integration test",
    category: "Pet Bedding",
    priceCents: 1999,
    compareAtCents: null,
    images: [],
    tags: [],
    active: true,
    featured: false,
    sortOrder: 0,
    ...overrides,
  });
  createdProductIds.push(row.id);
  return row;
}

/** The full input an update needs, derived from a stored row. */
function inputFor(p: ProductRow, overrides: Partial<Parameters<typeof updateProduct>[1]> = {}) {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    priceCents: p.priceCents,
    compareAtCents: p.compareAtCents,
    images: p.images,
    media: p.media,
    tags: p.tags,
    specs: p.specs,
    active: p.active,
    featured: p.featured,
    sortOrder: p.sortOrder,
    ...overrides,
  };
}

async function storefrontHas(id: string) {
  const rows = await listProducts({ limit: 500 });
  return rows.some((r) => r.id === id);
}

afterAll(async () => {
  if (!reachable) return;
  if (createdOrderIds.length) {
    await db.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds));
    await db.delete(orders).where(inArray(orders.id, createdOrderIds));
  }
  if (createdProductIds.length) {
    await db.delete(products).where(inArray(products.id, createdProductIds));
  }
});

suite("admin product CRUD against the real database", () => {
  it("create -> appears on the storefront; hide -> absent; show -> back", async () => {
    const p = await makeProduct();
    expect(await storefrontHas(p.id)).toBe(true);
    expect(await getProductBySlug(p.slug)).not.toBeNull();

    await updateProduct(p.id, inputFor(p, { active: false }));
    expect(await storefrontHas(p.id)).toBe(false);
    expect(await getProductBySlug(p.slug)).toBeNull();

    await updateProduct(p.id, inputFor(p, { active: true }));
    expect(await storefrontHas(p.id)).toBe(true);
  });

  it("edit -> the new price is reflected on the storefront read", async () => {
    const p = await makeProduct();
    await updateProduct(p.id, inputFor(p, { priceCents: 4321 }));
    const rows = await listProducts({ limit: 500 });
    expect(rows.find((r) => r.id === p.id)?.priceCents).toBe(4321);
  });

  it("delete with no order history -> hard-deleted and gone", async () => {
    const p = await makeProduct();
    const res = await deleteProduct(p.id);
    expect(res.archived).toBe(false);
    expect(await storefrontHas(p.id)).toBe(false);
    const [row] = await db.select({ id: products.id }).from(products).where(eq(products.id, p.id));
    expect(row).toBeUndefined();
  });

  it("delete WITH order history -> archived, row survives, order keeps its link", async () => {
    const p = await makeProduct();
    const address = {
      name: "Test",
      line1: "1 Test St",
      city: "Dallas",
      state: "TX",
      postalCode: "75001",
      country: "US",
    };
    const [order] = await db
      .insert(orders)
      .values({
        orderNumber: `ITEST-${randomUUID().slice(0, 8)}`,
        email: "itest@example.com",
        status: "paid",
        paymentStatus: "paid",
        subtotalCents: 1999,
        totalCents: 1999,
        shippingAddress: address as never,
        billingAddress: address as never,
      })
      .returning();
    createdOrderIds.push(order.id);
    const [item] = await db
      .insert(orderItems)
      .values({
        orderId: order.id,
        productId: p.id,
        nameSnapshot: p.name,
        priceCents: 1999,
        qty: 1,
      })
      .returning();

    const res = await deleteProduct(p.id);
    expect(res.archived).toBe(true);
    // Gone from the storefront...
    expect(await storefrontHas(p.id)).toBe(false);
    // ...but the row survives and the order still points at it.
    const [survivor] = await db
      .select({ id: products.id, archived: products.archived })
      .from(products)
      .where(eq(products.id, p.id));
    expect(survivor?.archived).toBe(true);
    const [link] = await db
      .select({ productId: orderItems.productId })
      .from(orderItems)
      .where(eq(orderItems.id, item.id));
    expect(link?.productId).toBe(p.id);
  });
});
