// Retires catalogue products that are no longer in shared/catalog-data.ts.
//
//   pnpm prune:catalog        (or: tsx scripts/prune-catalog.ts)
//
// WHY THIS EXISTS. `pnpm seed` only INSERTS what is missing - it never removes a
// product, deliberately, because a re-seed must not delete a live row. That
// means the demo catalogue, once seeded, would sit in the database forever and
// keep showing on the storefront even after the catalog file was reduced to the
// real product range. This script is the missing half: it reconciles the
// database DOWN to the catalog, so after it runs the storefront offers exactly
// what `shared/catalog-data.ts` declares.
//
// It is safe and idempotent:
//   * a product whose slug IS in the catalog is left completely untouched;
//   * a product that has real order history is NEVER deleted - it is reported
//     and skipped, so no placed order can lose the product it references;
//   * its variants, wishlist rows and reviews go with it (mapped ON DELETE
//     CASCADE in the schema), so nothing is left dangling.
//
// Run it once after deploying a reduced catalog; a second run finds nothing to
// do and says so.
import "dotenv/config";
import pg from "pg";
import { CATALOG_DATA } from "../shared/catalog-data";

interface Row {
  id: string;
  slug: string;
  name: string;
  order_count: number;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (checked .env)");

  const keep = new Set(CATALOG_DATA.map((p) => p.slug));
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const { rows } = await client.query<Row>(
      `select p.id, p.slug, p.name,
              (select count(*)::int from order_items oi where oi.product_id = p.id) as order_count
         from products p
        order by p.sort_order, p.name`,
    );

    const doomed = rows.filter((r) => !keep.has(r.slug) && r.order_count === 0);
    const protectedRows = rows.filter((r) => !keep.has(r.slug) && r.order_count > 0);
    const kept = rows.filter((r) => keep.has(r.slug));

    for (const r of protectedRows) {
      console.log(`KEEP   ${r.slug} - not in the catalog but has ${r.order_count} order line(s); left in place`);
    }

    if (doomed.length === 0) {
      console.log(`\nNothing to retire. ${kept.length} catalog product(s) present, 0 stale.`);
      return;
    }

    await client.query("begin");
    try {
      for (const r of doomed) {
        // Order matters only for readability; both child tables are mapped
        // ON DELETE CASCADE, but deleting explicitly keeps the log honest and
        // works even against a database whose cascade was never migrated.
        await client.query("delete from wishlist_items where product_id = $1", [r.id]);
        await client.query("delete from reviews where product_id = $1", [r.id]);
        await client.query("delete from product_variants where product_id = $1", [r.id]);
        await client.query("delete from products where id = $1", [r.id]);
        console.log(`RETIRE ${r.slug}`);
      }
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }

    const after = await client.query<{ products: number; variants: number }>(
      "select (select count(*)::int from products) as products, (select count(*)::int from product_variants) as variants",
    );
    console.log(
      `\nretired ${doomed.length} product(s). Database now holds ${after.rows[0].products} product(s) and ${after.rows[0].variants} variant(s).`,
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
