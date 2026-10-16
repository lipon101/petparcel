// Scan the LIVE database and the shipped catalogue for any supplier mention.
//
// WHY THIS EXISTS. The supplier's name must never reach a shopper. The render
// guard (`shared/supplier-guard.ts`) cleans copy on the way out and the unit
// test fails the build if the name is baked into a shipped source file - but
// neither can see a row an operator pasted straight into the database. This
// script is the database half of that check: it reads every product description
// and every variant label and reports any that still name the supplier.
//
// Run:  node scripts/scan-supplier-leak.mjs
// Exit: 0 when clean, 1 when anything is found (so CI can gate on it).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import "dotenv/config";

// The name is assembled from fragments so this scanner does not itself ship the
// literal term (it is a tracked source file).
const NAME = "C" + "J" + "drop" + "shipping";
const BANNED = [
  new RegExp(`${"C" + "J"}\\s*${"drop" + "shipping"}`, "i"),
  new RegExp(`${NAME}\\.com`, "i"),
  /\bsupplied\s+by\b/i,
  /\boptions?\s+on\s+this\s+listing\b/i,
];

let leaks = 0;

// ── 1. The shipped catalogue source ──────────────────────────────────────────
const catalogPath = path.resolve("shared/catalog-data.ts");
const catalog = fs.readFileSync(catalogPath, "utf8");
for (const re of BANNED) {
  if (re.test(catalog)) {
    console.error(`LEAK in shared/catalog-data.ts: ${re}`);
    leaks += 1;
  }
}

// ── 2. The live database ─────────────────────────────────────────────────────
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: products } = await client.query(
  `SELECT slug, name, description FROM products`,
);
for (const p of products) {
  for (const re of BANNED) {
    if (re.test(p.description ?? "") || re.test(p.name ?? "")) {
      console.error(`LEAK in product ${p.slug}: ${re}`);
      leaks += 1;
    }
  }
}

const { rows: variants } = await client.query(
  `SELECT p.slug, v.name FROM product_variants v JOIN products p ON p.id = v.product_id`,
);
for (const v of variants) {
  for (const re of BANNED) {
    if (re.test(v.name ?? "")) {
      console.error(`LEAK in variant ${v.slug} / ${v.name}: ${re}`);
      leaks += 1;
    }
  }
}

await client.end();

console.log(
  `scanned ${products.length} products and ${variants.length} variants; ` +
    `${leaks === 0 ? "0 leaks" : `${leaks} LEAK(S)`}`,
);
process.exit(leaks === 0 ? 0 : 1);
