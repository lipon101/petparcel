// Reconcile the PRODUCTION database to the shipped catalog, as part of the
// deploy.  `pnpm sync:catalog`  (also runs automatically inside `pnpm build`).
//
// WHY THIS EXISTS. `pnpm build` used to run migrations only. Migrations keep the
// SCHEMA in step with the code, but nothing ever reconciled the DATA - so a
// database that had been seeded with the old demo catalogue kept serving those
// demo products forever, and a product added to `shared/catalog-data.ts` was
// never inserted into production at all. The live storefront therefore showed
// the retired demo range and none of the real product. This script is the
// missing data half of the deploy: it makes the database match the catalog on
// every deploy, so a fresh deploy can never resurrect a demo product.
//
// WHAT IT DOES, in order:
//   1. Seeds the catalog, the browse taxonomy and the store settings. All three
//      are idempotent - they only insert what is missing, so an admin's own
//      edits (name, price, images, stock) are never clobbered.
//   2. Retires the seeded DEMO ORDERS (`PP-DEMO%`). They are sample rows, not
//      real sales, and they are what kept the demo products alive: a product
//      with order history is deliberately protected from pruning, so the demo
//      orders had to go before the demo products could.
//   3. Prunes every product that is no longer in the catalog AND has no real
//      order history. A product a customer actually bought is NEVER deleted -
//      it is reported and skipped, so no placed order can lose its product.
//
// SAFETY. It is a NO-OP when DATABASE_URL is absent (a local `pnpm build`, a CI
// typecheck job, a preview build with no DB) - it prints a notice and exits 0,
// exactly like `migrate-deploy.mjs`, so it can never break a build that has no
// database. It is idempotent: a second run finds nothing to do and says so. It
// never prints the connection string or any secret.
import "dotenv/config";
import pg from "pg";
import { CATALOG_DATA } from "../shared/catalog-data";
import {
  partitionCatalog,
  partitionCategories,
  partitionSettings,
  type CatalogProductRow,
} from "../shared/catalog-sync";
import { plannedCategoryNames } from "../shared/category-tree";
import { plannedSettingKeys } from "../shared/store";
import { seedCatalog, seedCategories, seedSettings } from "../server/seed";

interface Row {
  id: string;
  slug: string;
  name: string;
  order_count: number;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log(
      "[sync] DATABASE_URL is not set - skipping catalog sync (this is expected for a local build or CI).",
    );
    return;
  }

  console.log("[sync] DATABASE_URL is set - reconciling the catalog...");

  // ── 1. Seed what the catalog declares (idempotent) ────────────────────────
  // The individual seeders are called directly rather than `seedAll`, because
  // `seedAll` also writes the DEMO ORDERS - which is the opposite of what a
  // production deploy wants. Settings, catalog and taxonomy only.
  const settings = await seedSettings();
  const catalog = await seedCatalog();
  const categories = await seedCategories();
  console.log(
    `[sync] seeded: ${catalog.products} product(s), ${catalog.variants} variant(s), ` +
      `${categories} category row(s), ${settings} setting(s).`,
  );

  const keep = new Set(CATALOG_DATA.map((p) => p.slug));
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    // ── 2. Retire the seeded demo orders ────────────────────────────────────
    // `order_items` and `order_events` are mapped ON DELETE CASCADE, so deleting
    // the order removes its lines and timeline with it. Only the seeder's own
    // `PP-DEMO…` numbers are touched - a real order is never matched.
    const demoOrders = await client.query<{ order_number: string }>(
      "delete from orders where order_number like 'PP-DEMO%' returning order_number",
    );
    if (demoOrders.rowCount) {
      console.log(
        `[sync] retired ${demoOrders.rowCount} demo order(s): ${demoOrders.rows
          .map((r) => r.order_number)
          .join(", ")}`,
      );
    }

    // ── 3. Prune products the catalog no longer declares ────────────────────
    const { rows } = await client.query<Row>(
      `select p.id, p.slug, p.name,
              (select count(*)::int from order_items oi where oi.product_id = p.id) as order_count
         from products p
        order by p.sort_order, p.name`,
    );

    const { keep: kept, retire: doomed, protect: protectedRows } = partitionCatalog(
      rows.map((r): CatalogProductRow => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        orderCount: r.order_count,
      })),
      keep,
    );

    for (const r of protectedRows) {
      console.log(
        `[sync] KEEP   ${r.slug} - not in the catalog but has ${r.orderCount} order line(s); left in place`,
      );
    }

    if (doomed.length === 0) {
      console.log(
        `[sync] nothing to retire. ${kept.length} catalog product(s) present, 0 stale.`,
      );
    } else {
      await client.query("begin");
      try {
        for (const r of doomed) {
          // Order matters only for readability; both child tables cascade, but
          // deleting explicitly keeps the log honest and works even against a
          // database whose cascade was never migrated.
          await client.query("delete from wishlist_items where product_id = $1", [r.id]);
          await client.query("delete from reviews where product_id = $1", [r.id]);
          await client.query("delete from product_variants where product_id = $1", [r.id]);
          await client.query("delete from products where id = $1", [r.id]);
          console.log(`[sync] RETIRE ${r.slug}`);
        }
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw e;
      }
    }

    // ── 4. Reconcile each catalog product's VARIANTS ────────────────────────
    // `seedCatalog` only ever INSERTS a variant; it never removes one. So a
    // variant dropped from `shared/catalog-data.ts` - the EU and UK plug options
    // of a US-only store, say - would otherwise live on forever and keep
    // rendering in the buy box. This retires them.
    //
    // A variant a customer actually ordered is PROTECTED: `order_items
    // .variant_id` is ON DELETE SET NULL, so deleting one would erase which
    // option a real order was placed for. Only variants of a product the catalog
    // still declares are considered - a protected (admin) product's own options
    // are never touched.
    const wantedVariants = new Map<string, Set<string>>(
      CATALOG_DATA.map((p) => [p.slug, new Set(p.variants.map((v) => v.sku))]),
    );
    const variantRows = await client.query<{
      id: string;
      sku: string;
      slug: string;
      order_count: number;
    }>(
      `select pv.id, pv.sku, p.slug,
              (select count(*)::int from order_items oi where oi.variant_id = pv.id) as order_count
         from product_variants pv
         join products p on p.id = pv.product_id`,
    );

    const staleVariants = variantRows.rows.filter(
      (r) => wantedVariants.has(r.slug) && !wantedVariants.get(r.slug)!.has(r.sku),
    );
    for (const r of staleVariants) {
      if (r.order_count > 0) {
        console.log(
          `[sync] KEEP   variant ${r.sku} (${r.slug}) - has ${r.order_count} order line(s); left in place`,
        );
        continue;
      }
      await client.query("delete from product_variants where id = $1", [r.id]);
      console.log(`[sync] RETIRE variant ${r.sku} (${r.slug})`);
    }
    if (staleVariants.length === 0) {
      console.log("[sync] no stale variants - every product carries exactly its catalog options.");
    }

    // ── 5. Prune the browse taxonomy ────────────────────────────────────────
    // `seedCategories` only INSERTS the declared tree, so a category left over
    // from an earlier taxonomy - a retired aisle, a duplicate - would keep
    // rendering as a browse tile forever. This retires every row whose NAME the
    // shipped tree does not declare.
    //
    // A category with products filed under it is PROTECTED: a product stores its
    // category as a plain NAME, so deleting a populated row would leave its
    // products filed nowhere and drop them out of every filter. Only empty,
    // undeclared rows go - which is also what keeps an admin's own added aisle
    // alive. `ON DELETE SET NULL` on `parent_id` means removing an aisle promotes
    // its children rather than cascading into them.
    const categoryRows = await client.query<{
      id: string;
      name: string;
      slug: string;
      parent_id: string | null;
      product_count: number;
    }>(
      `select c.id, c.name, c.slug, c.parent_id,
              (select count(*)::int from products p where p.category = c.name) as product_count
         from categories c`,
    );
    const catParts = partitionCategories(
      categoryRows.rows.map((r) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        parentId: r.parent_id,
        productCount: r.product_count,
      })),
      plannedCategoryNames(),
    );
    for (const r of catParts.protect) {
      console.log(
        `[sync] KEEP   category "${r.name}" - not in the taxonomy but ${r.productCount} product(s) use it; left in place`,
      );
    }
    for (const r of catParts.retire) {
      await client.query("delete from categories where id = $1", [r.id]);
      console.log(`[sync] RETIRE category "${r.name}" (${r.slug})`);
    }
    if (catParts.retire.length === 0) {
      console.log(
        `[sync] no stale categories - all ${catParts.keep.length} row(s) are declared by the taxonomy.`,
      );
    }

    // ── 6. Prune dead store settings ────────────────────────────────────────
    // A settings row is only ever read by key, so a key no code names is dead: it
    // cannot render anywhere and the admin panel cannot edit it. Retire exactly
    // those, so the table holds only keys the application actually uses.
    const settingRows = await client.query<{ key: string }>(
      "select key from store_settings",
    );
    const setParts = partitionSettings(
      settingRows.rows.map((r) => r.key),
      plannedSettingKeys(),
    );
    for (const key of setParts.retire) {
      await client.query("delete from store_settings where key = $1", [key]);
      console.log(`[sync] RETIRE setting "${key}" - no code reads it`);
    }
    if (setParts.retire.length === 0) {
      console.log(
        `[sync] no dead settings - all ${setParts.keep.length} key(s) are read by the app.`,
      );
    }

    const after = await client.query<{ products: number; variants: number }>(
      "select (select count(*)::int from products) as products, (select count(*)::int from product_variants) as variants",
    );
    const totals = await client.query<{
      categories: number;
      settings: number;
    }>(
      "select (select count(*)::int from categories) as categories, (select count(*)::int from store_settings) as settings",
    );
    console.log(
      `[sync] done. Database now holds ${after.rows[0].products} product(s), ` +
        `${after.rows[0].variants} variant(s), ${totals.rows[0].categories} categor(y/ies) ` +
        `and ${totals.rows[0].settings} setting(s).`,
    );
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[sync] failed:", err);
    process.exit(1);
  });
