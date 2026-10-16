// Search-term normalisation and LIKE-safety, shared by the storefront and the
// server.
//
// WHY THIS IS SHARED. The shop page ECHOES a term back (a heading, a chip, the
// empty state) and the server FILTERS on it. If those two disagree - or if
// either one is a different shape than the other - a term can be reflected where
// it was never sanitised, or matched by rules the page never applied. One
// definition, used by both, is the only way they cannot drift.
//
// THREE JOBS, in order of how much they matter:
//
//   1. LIKE SAFETY. `%` and `_` are the SQL LIKE wildcards. A shopper's "%" must
//      be a literal per-cent sign, not "match everything" - otherwise typing
//      "50%" matches the entire catalogue, and a term of "%%%%" (or "_" repeated)
//      turns a bounded index lookup into a scan of every row, which is a cheap
//      denial of service against a page anyone can call. `escapeLike` is what
//      makes a term inert.
//
//   2. DISPLAY SAFETY. Control characters are never legitimate in a product
//      query and are what smuggling a payload looks like; `<>` is stripped as
//      well, because a term is put inside a heading and a meta tag and removing
//      the two characters that open a tag in HTML is a cheap second lock
//      (React escapes the text, so this is belt-and-braces, not the control).
//
//   3. MATCHING QUALITY. A query is not one string: it is up to `SEARCH_MAX_
//      TOKENS` words, matched case-insensitively and punctuation-insensitively
//      so "126.8" and "126 8" behave alike and "canvas," behaves like "canvas".

/** Longest term we will look at. Far longer than any real query (the longest
 *  product name in the catalogue is under 250 characters) and short enough that
 *  a term cannot be used as a payload. */
export const SEARCH_TERM_MAX = 120;

/** Most words taken from one query. Beyond this the extra words add no
 *  discriminating power, and each one costs another comparison per row. */
export const SEARCH_MAX_TOKENS = 8;

/**
 * Normalise a raw query for BOTH matching and echoing: strip control
 * characters, drop `<>`, split on non-word characters, collapse runs of
 * whitespace, and cap the length.
 *
 * Deterministic - the same input always produces the same output - so the term
 * the page prints and the term the database matched are provably the same.
 */
export function sanitizeSearchTerm(raw: string | null | undefined, max = SEARCH_TERM_MAX): string {
  if (!raw) return "";
  const cleaned = String(raw)
    // C0/C1 control characters: a typed query never contains one.
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    // The two characters that open an HTML tag.
    .replace(/[<>]/g, "")
    // Unicode SPACES - including the NO-BREAK SPACE - are invisible and are NOT
    // matched by `\s`, so a query of one used to survive sanitising as a
    // one-character term. `searchTokens` then dropped it for being too short,
    // and the term read as falsy below, so the query answered with the WHOLE
    // catalogue - the same unfiltered-catalogue defect as `%%%%`, reachable by a
    // character nobody can see. Folded to an ordinary space here so it collapses
    // with its neighbours and the term reduces to nothing.
    .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
}

/**
 * The term to ECHO back on the page - the empty string when the raw query is
 * something we should not repeat at all.
 *
 * Deliberately separate from `sanitizeSearchTerm`: a query that had to be
 * cleaned still FILTERS (we want a shopper who pasted a messy string to get
 * results), but a query that contained markup is not repeated as page copy even
 * in its cleaned form. Filtering and echoing are different decisions and this
 * keeps them from being accidentally coupled.
 */
export function searchEcho(raw: string | null | undefined): string {
  const cleaned = sanitizeSearchTerm(raw);
  if (!cleaned) return "";
  if (/[<>]/.test(String(raw ?? ""))) return "";
  return cleaned;
}

/**
 * Split a normalised term into the tokens it is matched by.
 *
 * Punctuation is a SEPARATOR, not a character to match: "126.8 Gal" becomes
 * ["126", "gal"] and "dog-friendly" becomes ["dog", "friendly"], so a query
 * written with punctuation still matches a name stored without it (and the other
 * way round).
 *
 * TWO RULES, both there to stop an unfiltered catalogue being shown as a result:
 *
 *   - A token must be at least TWO characters. A single character appears in
 *     almost every row, so it selects everything: the old behaviour answered a
 *     search of "S" (or of "a%b", whose real tokens were "a" and "b") with
 *     97 of 98 products, which a shopper reads as matches. A one-character query
 *     is not discriminating enough to be a search.
 *   - Tokens that are nothing but LIKE metacharacters are dropped, because
 *     `%%%` is not a query - after `escapeLike` it could only ever match a
 *     literal "%%%", which no product contains.
 *
 * What is left can genuinely narrow the catalogue. The list is capped so no
 * query costs an unbounded number of comparisons per row.
 */
export const SEARCH_MIN_TOKEN = 2;

export function searchTokens(term: string): string[] {
  return sanitizeSearchTerm(term)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= SEARCH_MIN_TOKEN)
    .slice(0, SEARCH_MAX_TOKENS);
}

/** A term that was PROVIDED but cannot match anything.
 *
 *  It is deliberately NON-EMPTY: the data layer reads a non-empty term with no
 *  usable token as "match nothing", and an empty one as "no filter" (browse).
 *  Sending this keeps a requested-but-unusable search from silently turning into
 *  a dump of the entire catalogue - see `searchFilterQuery`. */
export const SEARCH_UNMATCHABLE = " ";

/**
 * The value to hand the data layer for a caller's raw `search`, or `undefined`
 * when the caller genuinely supplied no term (i.e. browse the shop).
 *
 * THE DISTINCTION IS THE WHOLE POINT, and getting it wrong was a real defect.
 * The shape this replaces was `sanitizeSearchTerm(raw) || undefined`: it
 * collapsed a PROVIDED-but-unusable term into `undefined`, which the data layer
 * reads as "no filter". So EVERY single-character query, every `%`-only query
 * and a lone no-break space answered with the whole catalogue, presented as
 * matches. The data layer's own "empty token list means match nothing" rule was
 * correct; the callers upstream of it kept deleting the evidence that a search
 * had been requested at all. A provided term now stays provided.
 */
export function searchFilterQuery(raw: string | null | undefined): string | undefined {
  if (raw == null || raw === "") return undefined;
  const cleaned = sanitizeSearchTerm(raw);
  return cleaned || SEARCH_UNMATCHABLE;
}

/**
 * Make a user's text literal for a SQL LIKE pattern.
 *
 * Backslash is Postgres's default LIKE escape character, so escaping it FIRST
 * (or a user's own `\` would escape our escape) and then `%` and `_` leaves a
 * pattern in which every character the shopper typed matches itself and nothing
 * else. This is a correctness fix as much as a hardening one: "50% off" used to
 * match every product in the store.
 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** The `%term%` pattern for one token, with the token's metacharacters inert. */
export function likeContains(token: string): string {
  return `%${escapeLike(token)}%`;
}
