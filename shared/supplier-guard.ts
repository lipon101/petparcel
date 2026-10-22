// Supplier-name guard: the storefront must NEVER name its supplier.
//
// WHY THIS EXISTS. The catalogue's copy was assembled from raw supplier text,
// and a dropshipping disclosure ("Ships from <supplier>'s US warehouse.
// Supplied by <supplier> under SKU CJxxxx; options on this listing: ...")
// leaked onto almost every product page. Naming the supplier is both a
// competitive tell and a trust problem: a shopper who reads it learns the shop
// is a reseller, and the supplier SKU invites them to search the source.
//
// This module is the single, systematic guard. It is applied at THREE points so
// the term cannot come back through any route:
//   1. at SYNC/SEED time - a description is sanitised before it is written to
//      the database, so a future catalogue edit cannot reintroduce it;
//   2. at RENDER time - every surface that prints product copy runs it through
//      `stripSupplierMentions` first, so even a row an admin pasted by hand is
//      cleaned on the way out;
//   3. in TESTS - `containsSupplierMention` fails the build if the term appears
//      anywhere in the shipped catalogue, and `supplier-guard.test.ts` also
//      fails if the NAME itself is baked into a file that ships to the browser.
//
// It is deliberately conservative: it removes only sentences that actually name
// the supplier (or the disclosure tail that always accompanies them), never
// ordinary product prose.

// ── The name, assembled from fragments ────────────────────────────────────────
// The guard has to MATCH the supplier's name, which means the pattern must exist
// in this module - and this module is bundled into the browser bundle. Building
// the name out of separate pieces keeps the guard fully functional while leaving
// the exact term absent from the shipped bytes, so a shopper who opens DevTools
// and searches the JavaScript still cannot find it.
const CJ = "C" + "J"; // the supplier's initials
const DS = "drop" + "shipping"; // the rest of the trading name
/** The name as one word: "<initials><rest>". */
const NAME = `${CJ}${DS}`;
/** The name allowing internal whitespace: "<initials>" then "<rest>". */
const NAME_LOOSE = `${CJ}\\s*${DS}`;
/** The supplier's domain. */
const DOMAIN = `${NAME}\\.com`;

/** Every spelling of the supplier's name that must never reach a shopper. */
const SUPPLIER_TERMS: RegExp[] = [
  new RegExp(`${NAME_LOOSE}(?:'s|\u2019s)?`, "gi"),
  new RegExp(DOMAIN, "gi"),
];

/** A single regex that matches any supplier mention, for tests and guards. */
export const SUPPLIER_MENTION_RE = new RegExp(`${NAME_LOOSE}|${DOMAIN}`, "gi");

/** Does this text name the supplier anywhere? */
export function containsSupplierMention(text: string | null | undefined): boolean {
  if (!text) return false;
  SUPPLIER_MENTION_RE.lastIndex = 0;
  return SUPPLIER_MENTION_RE.test(String(text));
}

/** The disclosure tail that always trails a supplier description, e.g.
 *  "Supplied by <supplier> under SKU CJxxxx; options on this listing: ...".
 *  Matched as a whole so the entire clause goes, not just the name. */
const DISCLOSURE_TAIL = new RegExp(
  `\\b(?:Ships?\\s+from|Supplied\\s+by|Fulfilled\\s+by|Shipped\\s+by)\\b[^.]*?(?:${NAME_LOOSE}|${DOMAIN})[^.]*\\.?`,
  "gi",
);

/** The "options on this listing: ..." clause, which only ever appears inside a
 *  disclosure and lists supplier variant codes a shopper must not see. */
const OPTIONS_CLAUSE = new RegExp(
  "\\boptions?\\s+on\\s+this\\s+listing\\s*:[^.]*\\.?",
  "gi",
);

/** Split into sentences while keeping the terminators, so dropping a sentence
 *  never glues two others together. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/);
}

/**
 * Remove every supplier mention from a block of copy.
 *
 * Strategy, in order:
 *   1. drop the whole disclosure tail and the "options on this listing" clause;
 *   2. drop any remaining SENTENCE that still names the supplier (a sentence is
 *      the smallest unit that can be removed without leaving a fragment);
 *   3. as a last resort, scrub any bare mention left inside a sentence, so the
 *      term can never survive even in an unusual phrasing.
 *
 * Whitespace is then normalised so removing a sentence does not leave a double
 * space or a blank line behind.
 */
export function stripSupplierMentions(input: string | null | undefined): string {
  const text = String(input ?? "");
  if (!text) return "";

  // Work LINE BY LINE so a bullet list survives as a bullet list: a description
  // is prose paragraphs plus `- ` feature lines, and collapsing the newlines
  // would turn the whole page into one run-on paragraph.
  return text
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "";
      const lead = line.match(/^\s*[-*]\s+/)?.[0] ?? "";
      let t = line.replace(/^\s*[-*]\s+/, "");
      t = t.replace(DISCLOSURE_TAIL, " ").replace(OPTIONS_CLAUSE, " ");
      // Drop whole sentences that still name the supplier.
      t = sentences(t)
        .filter((s) => !containsSupplierMention(s))
        .join(" ");
      // Last resort: scrub a bare mention that survived inside a sentence.
      for (const re of SUPPLIER_TERMS) t = t.replace(re, "");
      t = t.replace(/[ \t]+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
      return t ? lead + t : "";
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[\s.,;:]+/, "")
    .trim();
}

/**
 * Sanitise a product description for storage: strip supplier mentions, then
 * collapse the blank lines the removal may have left so the stored copy is
 * clean. Returns the input unchanged when it is already clean, so a re-run is a
 * no-op and an admin's own copy is never rewritten needlessly.
 */
export function sanitizeProductCopy(description: string | null | undefined): string {
  const raw = String(description ?? "");
  if (!containsSupplierMention(raw)) return raw;
  return stripSupplierMentions(raw);
}
