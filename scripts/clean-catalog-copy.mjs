// Clean every product's sales copy in the shipped catalogue.
//
// WHY THIS EXISTS. The catalogue's descriptions were assembled from raw supplier
// text, and three things leaked into what a shopper reads:
//
//   1. a dropshipping disclosure paragraph appended to almost every product
//      ("Ships from CJdropshipping's US warehouse. Supplied by CJdropshipping
//      under SKU CJxxxx; ..."). The storefront must never name its supplier or
//      expose a supplier SKU, and the phrase reads as a tell that the shop is a
//      reseller. It is DROPPED here.
//   2. inline markdown (`**Feature**: detail` runs) that rendered as raw
//      asterisks on the page.
//   3. walls of run-on supplier copy with no structure.
//
// WHAT IT PRODUCES. A short, premium sales page: a one- or two-sentence benefit
// lead, then up to six short feature lines the page renders as a tick-list.
//
// SOURCE OF THE COPY.
//   * A slug listed in shared/curated-copy.mjs gets that hand-written lead +
//     features (written from the product's own real name, category and the real
//     attributes in its supplier text - nothing invented).
//   * Everything else is de-marked and trimmed: the lead is the first sentence
//     or two, the features are the supplier's own `**Title**` runs or sentences,
//     kept in full (never truncated mid-word).
//
// IDEMPOTENT. A description that is already clean (no `**`, no supplier wording,
// no disclosure tail, no spec dump) is left byte-for-byte untouched.
//
// Run:  node scripts/clean-catalog-copy.mjs
import fs from "node:fs";
import path from "node:path";
import { CURATED_COPY } from "../shared/curated-copy.mjs";

const SRC = path.resolve("shared/catalog-data.ts");
const DISCLOSURE =
  /CJdropshipping|Supplied by|Ships from our (US|China) warehouse|Tracked delivery and a 30-day returns window/i;
const NEEDS_WORK = /CJdropshipping|\*\*|(^|\n)\s*[-*]\s+|^\s*(Product information|Specifications?|Overview|Highlights|Dimensions|Description)\s*:/i;

const ENTITIES = [
  [/&amp;/g, "&"], [/&lt;/g, "<"], [/&gt;/g, ">"], [/&quot;/g, '"'],
  [/&#0?39;|&apos;|&rsquo;|&lsquo;/g, "\u2019"], [/&nbsp;/g, " "],
];
const decode = (s) => ENTITIES.reduce((o, [re, to]) => o.replace(re, to), String(s)).replace(/\r\n/g, "\n");
const stripMd = (s) =>
  s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(?!\s)(.+?)(?<!\s)\*(?=\s|$)/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .trim();
const sentences = (s) => s.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/[\s,;:.-]+\S*$/, "").trim());

/** Pull real attribute lines out of a "Product information: Color: ... Size: ..." dump. */
function fromLabelDump(text) {
  const grab = (re) => {
    const m = text.match(re);
    return m ? clip((m[1] ?? "").trim(), 120).replace(/[,\s]+$/, "") : "";
  };
  const colour = grab(/Colou?rs?\s*:\s*([^:]+?)(?=\s+(?:Size|Material|Weight|Capacity|Dimensions|Pattern|Fabric|Packing|Category|Type|Style|Specification|Function|Note|$))/i);
  const size = grab(/Sizes?\s*:\s*([^:]+?)(?=\s+(?:Colou?r|Material|Weight|Capacity|Dimensions|Pattern|Fabric|Packing|Category|Type|Style|Specification|Function|Note|$))/i);
  const material = grab(/Material\s*:\s*([^:]+?)(?=\s+(?:Colou?r|Size|Weight|Capacity|Dimensions|Pattern|Fabric|Packing|Category|Type|Style|Specification|Function|Note|$))/i);
  const out = [];
  if (colour) out.push(`Colour: ${colour}`);
  if (size) out.push(`Sizes: ${size}`);
  if (material) out.push(`Material: ${material}`);
  return out;
}

/** Derive a clean lead + features for a product that has no curated entry. */
function derive(raw, name) {
  const blocks = decode(raw)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .filter((b) => !DISCLOSURE.test(b));
  const body = blocks.join("\n\n").replace(/[\u2014\u2013]/g, "-").trim();
  if (!body) return "";

  let lead = "";
  let feats = [];

  if (/\*\*/.test(body)) {
    // Legacy supplier form: the opening sentence becomes the lead, and each
    // `**Feature**: detail` run becomes one feature line. The bold heading is
    // dropped - the detail sentence is the selling point a shopper reads.
    const flat = stripMd(body);
    lead = sentences(flat)[0] ?? "";
    for (const block of body.split(/\n\s*\n/)) {
      const parts = block.split(/\*\*(.+?)\*\*/g);
      // parts = [lead, title1, detail1, title2, detail2, ...]
      for (let i = 2; i < parts.length; i += 2) feats.push(stripMd(parts[i] ?? ""));
    }
  } else {
    const list = sentences(stripMd(body));
    const dump = fromLabelDump(body);
    if (dump.length >= 2 && list.length <= 2) {
      feats = dump;
    } else if (list.length) {
      lead = list[0];
      feats = list.slice(1);
    }
  }

  lead = clip(lead, 240);
  if (lead && lead.length > 20 && norm(name).startsWith(norm(lead).slice(0, 45))) lead = "";

  const seen = new Set();
  const bullets = [];
  const add = (t) => {
    const clean = stripMd(t).replace(/^[-\s]+/, "").replace(/[.:;,\s]+$/, "").trim();
    const key = norm(clean);
    if (clean.length < 10 || seen.has(key)) return;
    if (norm(lead).includes(key) || (key.length > 20 && key.includes(norm(lead)))) return;
    seen.add(key);
    bullets.push(clean + ".");
  };
  for (const f of feats) {
    if (bullets.length >= 6) break;
    add(f);
  }

  if (!lead && bullets.length === 0) return "";
  const parts = [];
  if (lead) parts.push(lead);
  if (bullets.length) parts.push(bullets.map((b) => `- ${b}`).join("\n"));
  return parts.join("\n\n");
}

// ── Rewrite the descriptions in place ────────────────────────────────────────
const src = fs.readFileSync(SRC, "utf8");
const RE = /slug:\s*"([^"]+)"[\s\S]{0,400}?description:\s*"((?:[^"\\]|\\.)*)"/g;

const unescapeTs = (s) => s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
const escapeTs = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

let scanned = 0;
let changed = 0;
let curated = 0;
let derived = 0;
const review = [];

const out = src.replace(RE, (full, slug, descLit) => {
  scanned += 1;
  const raw = unescapeTs(descLit);
  const nameMatch = full.match(/name:\s*"((?:[^"\\]|\\.)*)"/);
  const name = nameMatch ? unescapeTs(nameMatch[1]) : "";

  let next = "";
  if (CURATED_COPY[slug]) {
    curated += 1;
    const [lead, ...bullets] = CURATED_COPY[slug];
    next = lead + (bullets.length ? "\n\n" + bullets.map((b) => `- ${b}`).join("\n") : "");
  } else if (NEEDS_WORK.test(raw) || DISCLOSURE.test(raw)) {
    derived += 1;
    next = derive(raw, name);
  } else {
    return full; // already clean and admin-tailored
  }

  if (!next) return full; // never blank a real description
  changed += 1;
  review.push({ slug, after: next });
  return full.replace(`description: "${descLit}"`, `description: "${escapeTs(next)}"`);
});

fs.writeFileSync(SRC, out);
fs.mkdirSync(path.resolve("work"), { recursive: true });
fs.writeFileSync(path.resolve("work/copy-review.json"), JSON.stringify(review, null, 2));
console.log(
  `scanned ${scanned} product block(s); rewrote ${changed} (${curated} curated, ${derived} derived)`,
);
const blanks = review.filter((r) => !r.after);
console.log(`blank results: ${blanks.length}`);
