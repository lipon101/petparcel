// Assign the real catalogue to the browse taxonomy.
//
// The store launched with five pet-type aisles (Cats, Dogs, Feeding, Grooming,
// Travel & Outdoors) and the products carry those names in `products.category`.
// The CJdropshipping tree added afterwards is organised by what a product IS
// (Pet Toys, Pet Bedding, Pet Groomings ...), so while the products kept the old
// labels every new subcategory sat empty - a shopper could open "Pet Chew Toys"
// and find nothing.
//
// This maps each product to the subcategory it actually belongs to. The child
// name is what is written, because that is what the browse tree filters on: the
// aisle filter expands to its children (`normalizeCategory` in server/db.ts), so
// writing the child makes the product reachable from BOTH - the aisle page shows
// everything under it, and the subcategory page shows just its own.
//
// Idempotent: it matches on the exact product name and rewrites one column, so
// re-running is a no-op. It never inserts, never deletes, and never touches a
// product it does not recognise.
//
// Usage (the DSN is passed inline as an env var, never written to a file):
//   DATABASE_URL='...' node scripts/assign-category-taxonomy.mjs [--dry-run]
import { Client } from "pg";

/** product name -> the subcategory it belongs to. Every value is an EXACT child
 *  name from shared/category-tree.ts; a typo would silently file a product
 *  nowhere, so the script refuses to run unless every target exists in the tree
 *  and every name matches a real product. */
const MAPPING = {
  // ── Pet Toys ────────────────────────────────────────────────────────────
  "FlapJoy Interactive Cat Toy": "Pet Chase Toys",
  "TuffRope Braided Chew Toy": "Pet Chew Toys",
  // ── Pet Drinking & Feeding ──────────────────────────────────────────────
  "AquaPurr Cat Water Fountain": "Pet Drinking Tools",
  "TrailSip 2-in-1 Travel Bottle": "Pet Drinking Tools",
  "AutoServe Programmable Feeder": "Pet Feeding Tools",
  "LickJoy Silicone Lick Mat": "Pet Feeding Tools",
  "SlantSip Ceramic Bowl": "Pet Bowls",
  "SlowFeast Maze Bowl": "Pet Bowls",
  // ── Pet Furnitures ──────────────────────────────────────────────────────
  "TowerScratch Sisal Cat Post": "Cat Scratching Posts",
  "CleanPaws Covered Litter Box": "Pet Houses & Cages",
  // ── Pet Bedding ─────────────────────────────────────────────────────────
  "CloudNine Orthopedic Dog Bed": "Pet Beds",
  "DreamNest Donut Cat Bed": "Pet Beds",
  "FrostPaw Cooling Mat": "Pet Mats",
  "SnuggleSoft Pet Blanket": "Pet Blankets & Quilts",
  // ── Pet Groomings ───────────────────────────────────────────────────────
  "FurAway Grooming Glove": "Pet Hair Removers & Combs",
  "GlowTrim LED Nail Clipper": "Pet Nail Polishers",
  "MudBuster Paw Cleaner": "Pet Shower Products",
  // ── Pet Collars, Harnesses & Accessories ────────────────────────────────
  "TrekMate No-Pull Dog Harness": "Pet Harnesses",
  "NightWalk LED Retractable Leash": "Pet Leashes",
  // ── Pet Outdoor Supplies ────────────────────────────────────────────────
  "VoyagerPet Carrier Backpack": "Pet Bags",
};

const dryRun = process.argv.includes("--dry-run");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[assign] DATABASE_URL is not set - nothing to do.");
  process.exit(1);
}

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const products = (await client.query("select name, category from products")).rows;
  const children = new Set(
    (await client.query("select name from categories where parent_id is not null")).rows.map(
      (r) => r.name,
    ),
  );
  const byName = new Map(products.map((p) => [p.name, p]));

  // Fail loudly BEFORE writing anything: an unknown child name would file a
  // product into a category the storefront cannot browse to, and an unknown
  // product name means the catalogue has moved on since this mapping was written.
  const missingChild = Object.values(MAPPING).filter((c) => !children.has(c));
  const missingProduct = Object.keys(MAPPING).filter((n) => !byName.has(n));
  if (missingChild.length) {
    console.error("[assign] not a subcategory in the tree:", missingChild);
    process.exit(1);
  }
  if (missingProduct.length) {
    console.error("[assign] no such product:", missingProduct);
    process.exit(1);
  }

  const stale = products.filter(
    (p) => MAPPING[p.name] === undefined && p.category !== "New product",
  );

  let changed = 0;
  for (const [name, child] of Object.entries(MAPPING)) {
    const from = byName.get(name).category;
    if (from === child) continue;
    if (!dryRun) {
      await client.query("update products set category = $1 where name = $2", [child, name]);
    }
    changed += 1;
    console.log(`  ${dryRun ? "would " : ""}${name}: ${from} -> ${child}`);
  }
  console.log(`[assign] ${dryRun ? "would change" : "changed"} ${changed} of ${products.length} products`);

  if (stale.length) {
    console.log("[assign] not in the mapping (left untouched):", stale.map((p) => p.name));
  }

  // Per-subcategory counts, read back from the database - the evidence, not a
  // calculation from the mapping above.
  const counts = (
    await client.query(
      `select c.name as child, p.name as parent, count(pr.id)::int as n
         from categories c
         join categories p on p.id = c.parent_id
         left join products pr on pr.category = c.name
        group by c.name, p.name, p.sort_order, c.sort_order
       having count(pr.id) > 0
        order by p.sort_order, c.sort_order`,
    )
  ).rows;
  console.log("\n[assign] per-subcategory counts (from the database):");
  for (const r of counts) console.log(`  ${r.parent} >> ${r.child}: ${r.n}`);
  console.log(`[assign] subcategories carrying stock: ${counts.length}`);
} finally {
  await client.end();
}
