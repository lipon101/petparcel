// Idempotent demo-data seeder. Safe to run repeatedly: it only inserts what is
// missing, so a re-run never duplicates the catalog.
//
//   pnpm seed
//
// Run it once after `pnpm db:migrate` so a fresh clone looks like a real store
// (products, variants, inventory, store settings). Reviews are NOT seeded - they
// are earned by real customers and approved by an admin.
//
// The catalog below is a representative US pet-supplies range spanning the whole
// pet niche - dogs, cats, birds, fish and small pets, across food, beds, crates,
// harnesses, apparel, grooming, health, feeders, litter, toys, training and
// travel - with realistic US retail pricing. The owner replaces images and copy
// from the admin panel; nothing here is hardcoded into the storefront.
import { eq, sql } from "drizzle-orm";
import { db } from "./_core/db";
import {
  categories,
  orderEvents,
  orderItems,
  orders,
  productVariants,
  products,
  storeSettings,
} from "../drizzle/schema";
import { SETTINGS_DEFAULTS } from "../shared/store";
import { shippingCentsFor } from "../shared/money";
import { sanitizeProductCopy } from "../shared/supplier-guard";
import { uniqueFlatCategories } from "../shared/category-tree";
import { CATALOG_DATA, type SeedProduct } from "../shared/catalog-data";
import { OPTION_SCHEMA_BY_SLUG, type OptionSchemaEntry } from "../shared/cj-option-schema-data";
import { VARIANT_IMAGE_BY_SKU } from "../shared/variant-images-data";
import { isNonCompliantImage } from "../shared/merchant-image-policy";

/**
 * The variant's own photograph, from the shipped map - or null when that
 * photograph may NOT be advertised.
 *
 * WHY THE CHECK. The shipped map is generated from the live database, so it can
 * only ever contain photographs that were already stored there. Some of those
 * are un-advertisable: a supplier photo with burned-in promotional text is
 * rejected by Google Merchant Center ("Promotional overlay on image") and takes
 * the whole item out of the feed. Seeding one would hand a fresh database an
 * image that can never be advertised, so it is refused here and the variant
 * keeps no shot of its own - which is the documented fallback: the gallery
 * falls back to the product's own images. See shared/merchant-image-policy.ts.
 */
function shippedVariantImage(sku: string): string | null {
  const image = VARIANT_IMAGE_BY_SKU[sku];
  if (!image) return null;
  return isNonCompliantImage(image) ? null : image;
}

// The catalog comes straight from shared/catalog-data.ts - the SAME module the
// client bundles and the server serves as its fallback. Keeping one copy means
// `pnpm seed` writes exactly the catalog a visitor sees with the API switched
// off, and there is no second set of product copy to keep in step by hand.
//
// REVIEWS ARE NEVER SEEDED. A review is earned by a real customer and approved
// by an admin, so seeding invented ones would put fake ratings on real product
// pages. The catalog carries no reviews, and this function writes none.
const CATALOG: SeedProduct[] = CATALOG_DATA;
export async function seedCatalog(): Promise<{
  products: number;
  variants: number;
  reviews: number;
  categoriesReconciled: number;
}> {
  let productCount = 0;
  let variantCount = 0;
  let categoryCount = 0;
  const productIdBySlug = new Map<string, string>();

  for (const item of CATALOG) {
    const [existing] = await db.select().from(products).where(eq(products.slug, item.slug)).limit(1);
    // The SUPPLIER'S OWN option dimensions for this product, from the shipped
    // schema data file (written by `scripts/fetch-cj-option-schema.mjs` from the
    // live supplier API). Catalog-managed like the category: re-seeding brings a
    // stale or missing schema back in step, so the buy box can never head a
    // dimension with a word the supplier does not use.
    const schema: OptionSchemaEntry | undefined = OPTION_SCHEMA_BY_SLUG[item.slug];
    const dimensions = schema?.dimensions ?? [];
    let productId = existing?.id;
    if (!productId) {
      const [row] = await db
        .insert(products)
        .values({
          name: item.name,
          slug: item.slug,
          description: sanitizeProductCopy(item.description),
          category: item.category,
          priceCents: item.priceCents,
          compareAtCents: item.compareAtCents ?? null,
          images: item.images,
          tags: item.tags,
          specs: item.specs,
          optionDimensions: dimensions,
          cjOptionSchema: schema?.productKeyEn ?? null,
          active: true,
          featured: item.featured,
          sortOrder: item.sortOrder,
        })
        .returning();
      productId = row.id;
      productCount += 1;
    } else {
      // Both the category and the specs are catalog-managed: catalog-data.ts is
      // their source of truth, so a row left carrying a renamed aisle, or no
      // attributes at all, is brought back in step here. Only those fields
      // are reconciled - name, price, description, images and stock are left to
      // the admin, so a re-seed never clobbers a real edit.
      const patch: {
        category?: string;
        specs?: typeof item.specs;
        optionDimensions?: { token: string; kind: string; label: string }[];
        cjOptionSchema?: string | null;
      } = {};
      if (existing.category !== item.category) patch.category = item.category;
      const storedSpecs = existing.specs ?? {};
      if (Object.keys(item.specs).length > 0 && JSON.stringify(storedSpecs) !== JSON.stringify(item.specs)) {
        patch.specs = item.specs;
      }
      // The supplier's option schema is reconciled only when we actually HAVE
      // one for this product - a product whose supplier listing we have not
      // fetched yet must not have an admin's hand-entered dimensions cleared.
      if (schema && JSON.stringify(existing.optionDimensions ?? []) !== JSON.stringify(dimensions)) {
        patch.optionDimensions = dimensions;
        patch.cjOptionSchema = schema.productKeyEn ?? null;
      }
      if (Object.keys(patch).length > 0) {
        await db.update(products).set(patch).where(eq(products.id, productId));
        if (patch.category) categoryCount += 1;
      }
    }
    productIdBySlug.set(item.slug, productId);

    for (const [variantIndex, v] of item.variants.entries()) {
      const [existingVariant] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, v.sku))
        .limit(1);
      if (existingVariant) {
        // A variant's NAME is catalog-managed - it is the size/colour the shopper
        // picks, taken straight from the supplier's variant list - so a row left
        // carrying a stale name is brought back in step here. Price and stock stay
        // with the admin, exactly like the parent product's.
        //
        // The CJ VID/SKU mapping is also catalog-managed, but only FILLED when
        // the row has none: an admin who corrected a VID by hand must not have it
        // overwritten on the next deploy. A row that already carries a mapping is
        // left exactly as it is.
        const patch: { name?: string; cjVid?: string; cjSku?: string; imageUrl?: string } = {};
        if (existingVariant.name !== v.name) patch.name = v.name;
        if (v.cjVid && !existingVariant.cjVid) {
          patch.cjVid = v.cjVid;
          patch.cjSku = v.sku;
        }
        // The variant's OWN photograph is catalog-managed, but only FILLED when
        // the row has none - an admin who set a custom shot keeps it. The URL
        // comes from the shipped map (real R2 objects the live CJ `variantImage`
        // was re-encoded into), so a FRESH database - CI's throwaway Postgres, a
        // brand-new deploy - carries the same per-variant photos production has,
        // with no CJ call and no R2 access at seed time.
        const shippedImage = shippedVariantImage(v.sku);
        if (shippedImage && !existingVariant.imageUrl) patch.imageUrl = shippedImage;
        if (Object.keys(patch).length > 0) {
          await db.update(productVariants).set(patch).where(eq(productVariants.id, existingVariant.id));
        }
        continue;
      }
      await db.insert(productVariants).values({
        productId,
        name: v.name,
        sku: v.sku,
        priceCents: v.priceCents,
        inventoryQty: v.inventoryQty,
        active: true,
        cjVid: v.cjVid ?? null,
        cjSku: v.cjVid ? v.sku : null,
        // The order the options are offered in. The catalogue's own order is the
        // order the shopper sees (the option axes are drawn from it), so it is
        // stored rather than left to the insertion order - two rows written in
        // the same transaction can share a timestamp, and the option order must
        // never depend on that.
        sortOrder: variantIndex,
        // The variant's own real photograph, shipped in the repo so a fresh
        // database gets it without the CJ API or R2 credentials.
        imageUrl: shippedVariantImage(v.sku) ?? null,
      });
      variantCount += 1;
    }
  }

  // No reviews are written: they are earned and approved, never seeded.
  return { products: productCount, variants: variantCount, reviews: 0, categoriesReconciled: categoryCount };
}

/** Materialise the browse taxonomy (aisles + subcategories) from
 *  shared/category-tree.ts.
 *
 *  WHY THIS IS NEEDED. A product stores its category as a plain NAME, so the
 *  storefront can list and filter products without any category rows at all -
 *  which is why the earlier migrations only added the `parent_id` column and
 *  never inserted the tree. But the shop page's BROWSE view and the category
 *  tiles are built from rows in `categories`, so on a fresh database the aisle
 *  a product is filed under has no row to render and the tree comes out empty.
 *  This writes the tree so a fresh clone browses exactly like production.
 *
 *  Idempotent and order-aware: parents are written first (they have no
 *  parent_id), then their children are attached to the parent's real id, so a
 *  re-run only fills in what is missing. Existing rows are never renamed or
 *  reordered - an admin's own curation stays untouched. */
export async function seedCategories(): Promise<number> {
  let written = 0;
  const flat = uniqueFlatCategories();
  const idByName = new Map<string, string>();

  const slugify = (name: string) =>
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  for (const pass of ["parent", "child"] as const) {
    for (const c of flat) {
      const isRoot = c.parent === null;
      if ((pass === "parent") !== isRoot) continue;
      const [existing] = await db
        .select()
        .from(categories)
        .where(eq(categories.name, c.name))
        .limit(1);
      if (existing) {
        idByName.set(c.name, existing.id);
        continue;
      }
      const [row] = await db
        .insert(categories)
        .values({
          name: c.name,
          slug: slugify(c.name),
          parentId: isRoot ? null : (idByName.get(c.parent!) ?? null),
          sortOrder: c.sortOrder,
        })
        .returning();
      idByName.set(c.name, row.id);
      written += 1;
    }
  }
  return written;
}

/** Store settings: only write defaults for keys that have no row yet, so an
 *  admin's edits are never clobbered by a re-seed. */
export async function seedSettings(): Promise<number> {
  let written = 0;
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    const [existing] = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
    if (existing) continue;
    await db.insert(storeSettings).values({ key, value });
    written += 1;
  }
  return written;
}

/**
 * Demo orders so the admin dashboard has something to show. Creates one paid,
 * shipped order and one pending order, using real products from the catalog.
 * Skipped entirely when any order already exists.
 */
export async function seedDemoOrders(customerUserId: string | null): Promise<number> {
  const [existing] = await db.select({ value: sql<number>`count(*)::int` }).from(orders);
  if ((existing?.value ?? 0) > 0) return 0;

  const rows = await db.select().from(products).where(eq(products.active, true)).limit(8);
  const variantRows = await db.select().from(productVariants);
  if (rows.length < 2) return 0;

  const images = (id: string) => rows.find((p) => p.id === id)?.images[0] ?? null;
  const variantOf = (productId: string) => variantRows.find((v) => v.productId === productId) ?? null;

  const addr = {
    fullName: "Jordan Avery",
    line1: "418 Maple Street",
    line2: "Apt 3B",
    city: "Portland",
    state: "OR",
    postalCode: "97205",
    country: "US",
    phone: "+1 503 555 0188",
  };

  const demos: {
    number: string;
    email: string;
    status: string;
    paymentStatus: string;
    picks: number[];
    daysAgo: number;
    tracking?: { number: string; carrier: string };
  }[] = [
    {
      number: "PP-DEMO0001",
      email: "jordan.avery@example.com",
      status: "shipped",
      paymentStatus: "paid",
      picks: [0, 2],
      daysAgo: 6,
      tracking: { number: "9400111899562745772639", carrier: "USPS" },
    },
    {
      number: "PP-DEMO0002",
      email: "casey.nguyen@example.com",
      status: "pending",
      paymentStatus: "unpaid",
      picks: [3],
      daysAgo: 1,
    },
  ];

  let created = 0;
  for (const demo of demos) {
    const lines = demo.picks
      .map((i) => rows[i])
      .filter(Boolean)
      .map((p) => {
        const variant = variantOf(p.id);
        return {
          product: p,
          variant,
          qty: 1,
          unit: variant?.priceCents ?? p.priceCents,
        };
      });

    const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
    // Mirror the store's own shipping policy so a seeded demo order is priced
    // exactly the way checkout would price it - never a second, stale copy of
    // the rate that could drift from SETTINGS_DEFAULTS. `shippingCentsFor` is
    // the SAME helper checkout uses, so the `0 = no free tier` rule applies here
    // too: a bare `subtotal >= threshold` would read `>= 0` as "always free" and
    // price every demo order with no shipping at all.
    const shipping = shippingCentsFor(subtotal, SETTINGS_DEFAULTS);
    const total = subtotal + shipping;
    const createdAt = new Date(Date.now() - demo.daysAgo * 86_400_000);

    const [order] = await db
      .insert(orders)
      .values({
        orderNumber: demo.number,
        userId: customerUserId,
        email: demo.email,
        status: demo.status,
        paymentStatus: demo.paymentStatus,
        paymentProvider: "bachs",
        subtotalCents: subtotal,
        shippingCents: shipping,
        taxCents: 0,
        totalCents: total,
        currency: "USD",
        shippingAddress: { ...addr, fullName: demo.email.split("@")[0] },
        billingAddress: { ...addr, fullName: demo.email.split("@")[0] },
        trackingNumber: demo.tracking?.number ?? null,
        carrier: demo.tracking?.carrier ?? null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    await db.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.product.id,
        variantId: l.variant?.id ?? null,
        slug: l.product.slug,
        nameSnapshot: l.product.name,
        variantSnapshot: l.variant?.name ?? null,
        priceCents: l.unit,
        qty: l.qty,
        imageUrl: images(l.product.id),
      })),
    );

    await db.insert(orderEvents).values([
      { orderId: order.id, status: "pending", note: "Order placed - awaiting payment confirmation.", createdAt },
      ...(demo.paymentStatus === "paid"
        ? [{ orderId: order.id, status: "paid", note: "Payment received.", createdAt }]
        : []),
      ...(demo.status === "shipped"
        ? [
            { orderId: order.id, status: "processing", note: "Packing your parcel.", createdAt },
            {
              orderId: order.id,
              status: "shipped",
              note: `Shipped via ${demo.tracking?.carrier} - ${demo.tracking?.number}`,
              createdAt,
            },
          ]
        : []),
    ]);

    created += 1;
  }

  return created;
}

export async function seedAll(customerUserId: string | null = null) {
  const settings = await seedSettings();
  const catalog = await seedCatalog();
  const categoryRows = await seedCategories();
  const demos = await seedDemoOrders(customerUserId);
  return { settings, ...catalog, categories: categoryRows, demoOrders: demos };
}
