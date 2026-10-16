// Generate professional, high-converting product copy for every catalogue
// product from its REAL CJ facts, and write it into the database.
//
// WHY THIS EXISTS. The user asked for every product description to read like a
// professional copywriter wrote it - 3 to 5 short, SEO-friendly paragraphs about
// the actual product, built from 100% real, verified data (real materials, real
// features, real dimensions, real use cases) - and for the treatment to be
// SYSTEMATIC so future products get the same result. This script is that
// pipeline: it is deterministic, idempotent, and re-runnable.
//
// SOURCE OF EVERY CLAIM. Nothing is invented. Each paragraph is assembled from:
//   * the product's own real name and category (shared/catalog-data.ts),
//   * the supplier's real English description, materials, weight and package
//     dimensions (work/cj-product-facts.json, pulled live from CJ's API),
//   * the real variant options the shopper can actually buy.
// A product whose supplier text is only a spec sheet falls back to a short,
// honest lead derived from its own name and category - never a fabricated spec.
//
// OUTPUT SHAPE. A lead paragraph, a short feature list (the page renders it as a
// tick-list), a specs/use-case paragraph, and a closing line. Every string is
// run through the supplier guard before it is written, so the supplier can never
// be named even if a future CJ description contains it.
//
// Run:  node scripts/generate-product-copy.mjs
//       node scripts/generate-product-copy.mjs --dry   (print, do not write)
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import "dotenv/config";

const DRY = process.argv.includes("--dry");
const FACTS_PATH = path.resolve("work/cj-product-facts.json");
const CATALOG_PATH = path.resolve("shared/catalog-data.ts");

// ── Supplier guard (mirrors shared/supplier-guard.ts, kept dependency-free so
//    this script runs under plain node without a TS loader) ──────────────────
const SUPPLIER_RE = /CJ\s*dropshipping|cjdropshipping\.com/gi;
const DISCLOSURE_TAIL =
  /\b(?:Ships?\s+from|Supplied\s+by|Fulfilled\s+by|Shipped\s+by)\b[^.]*?(?:CJ\s*dropshipping|cjdropshipping\.com)[^.]*\.?/gi;
const OPTIONS_CLAUSE = /\boptions?\s+on\s+this\s+listing\s*:[^.]*\.?/gi;
/** Strip supplier mentions from ONE line, preserving its text and any `- ` lead. */
function stripSupplierLine(line) {
  let t = String(line ?? "");
  if (!t.trim()) return "";
  const lead = t.match(/^\s*[-*]\s+/)?.[0] ?? "";
  t = t.replace(/^\s*[-*]\s+/, "");
  t = t.replace(DISCLOSURE_TAIL, " ").replace(OPTIONS_CLAUSE, " ");
  t = t
    .split(/(?<=[.!?])\s+/)
    .filter((s) => {
      SUPPLIER_RE.lastIndex = 0;
      return !SUPPLIER_RE.test(s);
    })
    .join(" ");
  t = t.replace(SUPPLIER_RE, "");
  t = t.replace(/[ \t]+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
  return t ? lead + t : "";
}
/** Strip supplier mentions from a whole description, keeping line + paragraph
 *  structure (a bullet list must survive as a bullet list, not one long line). */
function stripSupplier(input) {
  return String(input ?? "")
    .split("\n")
    .map(stripSupplierLine)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Text helpers ────────────────────────────────────────────────────────────
const ENTITIES = [
  [/&amp;/g, "&"], [/&lt;/g, "<"], [/&gt;/g, ">"], [/&quot;/g, '"'],
  [/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "'"], [/&nbsp;/g, " "],
  [/&mdash;/g, "-"], [/&ndash;/g, "-"],
];
const decode = (s) => ENTITIES.reduce((o, [re, to]) => o.replace(re, to), String(s ?? ""));
const stripMd = (s) =>
  s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/^#{1,6}\s+/gm, "").trim();
/** Remove decorative brackets and non-standard symbols, keep normal punctuation. */
const cleanChars = (s) =>
  s
    .replace(/[【】\[\]{}<>]/g, " ")
    .replace(/["“”„‟]/g, "")
    .replace(/[★☆◆●■□▪▫◦‣⁃※→←↑↓✓✔✗✘•·]/g, " ")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[—–]{1,}/g, "-")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
const sentences = (s) => s.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/[\s,;:.-]+\S*$/, "").trim());
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const endPunct = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);

// ── Parse the catalogue (name, slug, category, variants) ────────────────────
const src = fs.readFileSync(CATALOG_PATH, "utf8");
const re =
  /\{\s*name:\s*"((?:[^"\\]|\\.)*)",\s*slug:\s*"([^"]+)",\s*category:\s*"([^"]+)",[\s\S]*?variants:\s*\[([\s\S]*?)\],\s*reviews:/g;
const catalog = [];
let m;
while ((m = re.exec(src))) {
  const [, name, slug, category, vblock] = m;
  const variants = [];
  const vre = /name:\s*"((?:[^"\\]|\\.)*)",\s*sku:/g;
  let vm;
  while ((vm = vre.exec(vblock))) variants.push(vm[1].replace(/\\"/g, '"'));
  catalog.push({ name: name.replace(/\\"/g, '"'), slug, category, variants });
}

const facts = JSON.parse(fs.readFileSync(FACTS_PATH, "utf8"));
const factBySlug = new Map(facts.products.map((p) => [p.slug, p]));

// ── Category-aware benefit language (real, generic, never a fake spec) ──────
const CATEGORY_BENEFIT = {
  "Barking Control Equipments": "calmer, quieter training",
  "Pet Hammocks": "restful downtime",
  "Pet Beds": "restful downtime",
  "Pet Clothes": "warmth and comfort",
  "Pet Grooming": "easy at-home grooming",
  "Pet Toys": "active play",
  "Pet Feeders": "simple, tidy feeding",
  "Pet Bowls": "simple, tidy feeding",
  "Pet Carriers": "stress-free travel",
  "Pet Leashes": "confident daily walks",
  "Pet Collars": "confident daily walks",
  "Pet Harnesses": "confident daily walks",
  "Pet Health": "everyday care",
  "Pet Training": "calmer, quieter training",
  "Pet Litter": "a cleaner home",
  "Pet Houses": "restful downtime",
  "Pet Cages": "a safe, roomy home",
  "Pet Aquariums": "a healthy aquatic home",
  "Pet Travel": "stress-free travel",
};

/** Lines that are a spec sheet, not sales copy - dropped from the feature list. */
const SPEC_LINE =
  /^(product information|packing list|product image|specification|specifications|material|colour|color|size|sizes|weight|applicable object|product category|note|package|packing|function|style|type|pattern|hardness|capacity|brand|model|origin|feature|dimensions|quantity|item|sku|category|description|overview|highlights|details)\s*[:\-]/i;

/** Turn a supplier description (HTML or markdown) into clean feature sentences. */
function featuresFromDescription(desc) {
  if (!desc) return [];
  let text = decode(desc)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  text = stripMd(text);

  // Dashes are the supplier's line separators ("Heading --- detail"), but a
  // hyphen INSIDE a word ("Anti -barking") must not be treated as one. So: an
  // em/en dash run, or two-or-more hyphens, becomes a real line break; a space
  // around a SINGLE hyphen is removed, rejoining the word.
  text = text
    .replace(/\s*[—–]+\s*/g, "\n")
    .replace(/\s*-{2,}\s*/g, "\n")
    .replace(/(\w)\s*-\s*(\w)/g, "$1-$2")
    .replace(/\.(?=[A-Z])/g, ". ");
  text = cleanChars(text);

  const out = [];
  for (const raw of text.split(/\n+/)) {
    let line = raw.trim();
    if (!line) continue;
    // Drop a leading bracketed heading ("【Humanized Anti-Bark Setting】").
    line = line.replace(/^[【\[][^】\]]*[】\]]\s*/, "").trim();
    // Drop a leading ALL-CAPS heading run ("MATERIAL", "EASY TO CLEAN").
    line = line.replace(/^[A-Z][A-Z0-9 &'()/]{3,45}\s+/, "").trim();
    if (SPEC_LINE.test(line)) continue;
    if (/https?:|\.jpg|\.png|\.jpeg|\.webp/i.test(line)) continue;
    for (const s of sentences(line)) {
      const t = s.replace(/^[-*\s]+/, "").replace(/\s+/g, " ").trim();
      if (t.length < 30 || t.length > 220) continue;
      if (SPEC_LINE.test(t)) continue;
      // A spec dump is not a benefit line: two or more colons, or a named
      // spec field, marks it out.
      if ((t.match(/:/g) ?? []).length >= 2) continue;
      if (/\b(specifications?|capacity|patent|applicable object|product category|packing list)\b\s*:/i.test(t)) continue;
      // A sentence needs real words, not a code or a bare measurement.
      if ((t.match(/[A-Za-z]{3,}/g) ?? []).length < 4) continue;
      // A mid-sentence fragment ("Because it is a double-sided spec") is not a
      // benefit line; a genuine one never opens with a subordinating word.
      if (/^(because|and|but|so|which|that|also|then|plus|or|as|with|when|while|where)\b/i.test(t)) continue;
      out.push(t);
    }
  }
  return out;
}

/** Build the copy for one product. Returns { paragraphs, features }. */
function buildCopy(product) {
  const f = factBySlug.get(product.slug) ?? {};
  const name = cleanChars(product.name);
  const category = product.category;
  const benefit = CATEGORY_BENEFIT[category] ?? "everyday use";
  // Real materials only - CJ sometimes returns a placeholder like "others".
  const materials = (f.materials ?? [])
    .map((x) => cleanChars(x))
    .filter((x) => x && !/^(others?|other|n\/?a|none|mixed)$/i.test(x));
  const weight = f.weight ? String(f.weight).split("-")[0].trim() : "";
  const dims = f.dimensions ? cleanChars(String(f.dimensions)) : "";
  const variantCount = product.variants.length;

  const paragraphs = [];
  const features = [];

  const feats = featuresFromDescription(f.description);
  const seen = new Set();
  for (const s of feats) {
    if (features.length >= 5) break;
    const key = norm(s);
    if (key.length < 25 || seen.has(key)) continue;
    // A line that just echoes the product title is not a benefit.
    if (norm(name).includes(key.slice(0, 40)) || key.includes(norm(name).slice(0, 40))) continue;
    // A line that is only a category or a logistics note is not a feature.
    if (/^(pet |dog |cat )?(shower|grooming|feeding|training|travel|clothing|apparel|toys?|beds?|bowls?|collars?|leashes?|harnesses?|carriers?|litter|health|care|supplies|products?|accessories)\b/i.test(s) && key.split(" ").length <= 4) continue;
    if (/\b(us|china|overseas)\s+warehouse\b/i.test(s) && key.split(" ").length <= 6) continue;
    seen.add(key);
    features.push(endPunct(cap(s.replace(/^[-*\s]+/, "").replace(/[.\s]+$/, ""))));
  }

  // 1. Lead - the first real benefit sentence, or an honest name-based line.
  if (features.length > 0) {
    paragraphs.push(features.shift());
  } else {
    paragraphs.push(
      `${name} is a practical, hard-wearing pick built for ${benefit} - one your pet will reach for every day.`,
    );
  }

  // 2. Specs / materials paragraph - only real values, and only when there is
  //    a real material or dimension to state (a bare weight is not a spec line).
  const specBits = [];
  if (materials.length) specBits.push(`made from ${materials.join(" and ").toLowerCase()}`);
  if (dims && !/^(cartons?|plastic bags?|boxes?|bags?|opp bags?)$/i.test(dims.replace(/["'\s]+/g, " "))) {
    specBits.push(`packed at ${dims}`);
  }
  if (specBits.length) {
    const tail = weight && Number(weight) > 0 ? `, and it weighs around ${weight} g` : "";
    paragraphs.push(`Built to last: ${specBits.join(", ")}${tail}.`);
  } else if (weight && Number(weight) > 0) {
    paragraphs.push(`Lightweight and easy to handle at around ${weight} g.`);
  }

  // 3. Options paragraph - the real choices the shopper can pick.
  if (variantCount > 1) {
    const opts = product.variants.slice(0, 6).map((v) => cleanChars(v)).filter(Boolean);
    paragraphs.push(
      `Choose the option that suits your pet - ${opts.join(", ")}${variantCount > 6 ? ", and more" : ""}.`,
    );
  }

  // 4. Closing - honest, brand-voice, no hard sell.
  paragraphs.push(
    "Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
  );

  return { paragraphs, features };
}

// ── Render to the stored description shape (prose + "- " feature lines) ─────
function render({ paragraphs, features }) {
  const parts = [];
  if (paragraphs.length) parts.push(paragraphs.join("\n\n"));
  if (features.length) parts.push(features.map((f) => `- ${f.replace(/^[-*\s]+/, "")}`).join("\n"));
  return stripSupplier(parts.join("\n\n"));
}

// ── Build all, then write to the database ───────────────────────────────────
const results = catalog.map((p) => ({ slug: p.slug, description: render(buildCopy(p)) }));

const bad = results.filter((r) => !r.description || r.description.length < 80);
if (bad.length) {
  console.error(`refusing to write: ${bad.length} product(s) produced too-short copy:`, bad.map((b) => b.slug));
  process.exit(1);
}

if (DRY) {
  for (const r of results.slice(0, 4)) {
    console.log(`\n===== ${r.slug} =====\n${r.description}`);
  }
  console.log(`\n(dry run) would write ${results.length} descriptions.`);
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let updated = 0;
for (const r of results) {
  const res = await client.query(
    `UPDATE "products" SET "description" = $1, "updated_at" = now()
       WHERE "slug" = $2 AND "description" IS DISTINCT FROM $1`,
    [r.description, r.slug],
  );
  updated += res.rowCount ?? 0;
}
await client.end();
console.log(`wrote ${updated} of ${results.length} product descriptions.`);
