import { describe, expect, it } from "vitest";
import {
  escapeLike,
  likeContains,
  sanitizeSearchTerm,
  searchEcho,
  searchFilterQuery,
  searchTokens,
  SEARCH_MAX_TOKENS,
  SEARCH_TERM_MAX,
  SEARCH_UNMATCHABLE,
} from "./search-term";

// These pin the two things the search page depends on: that a term is INERT
// (nothing a shopper types can change the shape of the query) and that a term is
// MATCHABLE (a real query still finds real products).
describe("sanitizeSearchTerm", () => {
  it("collapses whitespace and trims", () => {
    expect(sanitizeSearchTerm("  canvas   fish  ")).toBe("canvas fish");
  });

  it("strips control characters that are never part of a query", () => {
    expect(sanitizeSearchTerm("dog\u0000bed\u001f")).toBe("dog bed");
    expect(sanitizeSearchTerm("cat\u007f")).toBe("cat");
  });

  it("removes the characters that open an HTML tag", () => {
    // React escapes text, so this is a second lock rather than the control -
    // but a term is also emitted into a meta description and a JSON-LD string.
    // The characters are REMOVED, not replaced with a space: the sanitizer's
    // job is to make the string inert, and a query containing them is hostile
    // or nonsense rather than a query whose wording should be preserved.
    expect(sanitizeSearchTerm("<script>alert(1)</script>")).toBe("scriptalert(1)/script");
    expect(sanitizeSearchTerm("a<b>c")).toBe("abc");
  });

  it("folds the invisible Unicode spaces `\\s` does not match", () => {
    // A lone NO-BREAK SPACE survived sanitising as a one-character term, so the
    // router's `|| undefined` read it as no search at all and the page answered
    // with the WHOLE catalogue. Folding these to an ordinary space collapses them
    // with their neighbours, so the term reduces to nothing.
    expect(sanitizeSearchTerm("\u00a0")).toBe("");
    expect(sanitizeSearchTerm("\u00a0\u00a0")).toBe("");
    expect(sanitizeSearchTerm("\u3000")).toBe("");
    expect(sanitizeSearchTerm("Koi\u00a0Tank")).toBe("Koi Tank");
  });

  it("caps length at the shared ceiling", () => {
    const huge = "x".repeat(5000);
    expect(sanitizeSearchTerm(huge).length).toBe(SEARCH_TERM_MAX);
  });

  it("keeps a legitimate long product name intact", () => {
    // The longest real catalogue name is well under the cap: the ceiling must
    // never truncate a genuine query.
    const real =
      "Canvas Fish Pond Above Ground Koi Tank 126.8 Gal With Clear Viewing Panel";
    expect(sanitizeSearchTerm(real)).toBe(real);
  });

  it("is idempotent - sanitising a sanitised term changes nothing", () => {
    const raw = "  <b>Koi</b>\u0000   Tank  ";
    const once = sanitizeSearchTerm(raw);
    expect(sanitizeSearchTerm(once)).toBe(once);
  });

  it("handles null, undefined and empty", () => {
    expect(sanitizeSearchTerm(null)).toBe("");
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm("")).toBe("");
  });
});

describe("searchEcho", () => {
  it("echoes a normal query", () => {
    expect(searchEcho("canvas fish pond")).toBe("canvas fish pond");
  });

  it("refuses to echo a query that contained markup, in any form", () => {
    // Even the CLEANED form is withheld: the point is that a markup-bearing
    // query is not repeated as page copy at all.
    expect(searchEcho("<script>alert(1)</script>")).toBe("");
    expect(searchEcho("dog <img src=x>")).toBe("");
    expect(searchEcho("a>b")).toBe("");
  });

  it("still lets a merely messy query through", () => {
    // Cleaning is not the same as refusing: a shopper who pasted a term with a
    // control character gets a search, and a clean heading.
    expect(searchEcho("  dog\u0000bed ")).toBe("dog bed");
  });
});

describe("searchTokens", () => {
  it("lowercases and splits on punctuation", () => {
    expect(searchTokens("Canvas Fish Pond")).toEqual(["canvas", "fish", "pond"]);
    // "126.8" must not require the shopper to guess whether the dot is stored -
    // the dot is a separator. "8" alone is dropped by the two-character rule.
    expect(searchTokens("126.8 Gal")).toEqual(["126", "gal"]);
    expect(searchTokens("dog-friendly bed")).toEqual(["dog", "friendly", "bed"]);
  });

  it("DROPS single-character tokens, which would otherwise select everything", () => {
    // This is the fix for a real bug: a query whose only tokens were one
    // character long produced NO filter clause, so the catalogue was returned
    // unfiltered - "S" and "a%b" both answered with 97 of 98 products as though
    // they had matched. A one-character term is not discriminating enough to be
    // a search, and the data layer turns an empty token list into an honest
    // empty result rather than an unfiltered list.
    expect(searchTokens("S")).toEqual([]);
    expect(searchTokens("a%b")).toEqual([]);
    expect(searchTokens("a b c")).toEqual([]);
    // ...but a two-character token still matches normally.
    expect(searchTokens("XL")).toEqual(["xl"]);
  });

  it("caps the number of tokens", () => {
    const many = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    expect(searchTokens(many).length).toBe(SEARCH_MAX_TOKENS);
  });

  it("returns nothing for an empty or punctuation-only term", () => {
    expect(searchTokens("")).toEqual([]);
    expect(searchTokens("   ")).toEqual([]);
    expect(searchTokens("%%%")).toEqual([]);
    expect(searchTokens("!@#$%^&*()")).toEqual([]);
  });
});

describe("searchFilterQuery - the no-term vs unmatchable-term distinction", () => {
  // THIS is the defect the edge-case gate exists for. The storefront used to
  // hand the data layer `sanitizeSearchTerm(raw) || undefined`, which erased the
  // difference between "browse" and "a search that cannot match": every
  // one-character query and every `%`-only query came back as all 98 products,
  // presented as though they matched. The data layer's "no usable token means
  // match nothing" rule was right all along; its callers kept deleting the
  // evidence that a search had been requested.
  it("passes a genuine search through unchanged", () => {
    expect(searchFilterQuery("Canvas Fish Pond")).toBe("Canvas Fish Pond");
    expect(searchFilterQuery("  Pink  ")).toBe("Pink");
  });

  it("returns undefined ONLY when no term was supplied at all (browse)", () => {
    expect(searchFilterQuery(undefined)).toBeUndefined();
    expect(searchFilterQuery(null)).toBeUndefined();
    expect(searchFilterQuery("")).toBeUndefined();
  });

  it("keeps a supplied-but-unmatchable term NON-EMPTY so it filters to nothing", () => {
    // A single character, a metacharacter-only run, a markup-only query and a
    // lone invisible space are all "a search was requested that cannot match" -
    // never "browse everything".
    for (const q of ["S", "a", "%", "%%%%", "!@#$", "<" + ">", "\u00a0", "\u200b", "'", "\\"]) {
      const out = searchFilterQuery(q);
      expect(out, `query ${JSON.stringify(q)} must stay a filter`).toBeDefined();
      expect(out).not.toBe("");
      // ...and the data layer turns it into an empty result, not the catalogue.
      expect(searchTokens(out ?? "")).toEqual([]);
    }
  });

  it("still lets a two-character token match", () => {
    expect(searchTokens(searchFilterQuery("XL") ?? "")).toEqual(["xl"]);
  });

  it("uses a sentinel the data layer treats as non-empty", () => {
    expect(SEARCH_UNMATCHABLE.length).toBeGreaterThan(0);
    expect(SEARCH_UNMATCHABLE.trim()).toBe("");
  });
});

describe("escapeLike / likeContains", () => {
  it("makes a LIKE metacharacter literal", () => {
    // Without this, "50%" matched the ENTIRE catalogue and "%%%%" turned a
    // bounded ILIKE into a scan of every product row.
    expect(likeContains("50%")).toBe("%50\\%%");
    expect(likeContains("a_b")).toBe("%a\\_b%");
  });

  it("escapes the backslash FIRST, so a user's own escape cannot escape ours", () => {
    // The failure this prevents: escaping % before \ turns a user's "\%" into
    // "\\%" where the "\\" is then read as a literal backslash and the "%" is a
    // wildcard again.
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("\\%")).toBe("\\\\\\%");
  });

  it("leaves ordinary text untouched", () => {
    expect(likeContains("canvas fish pond")).toBe("%canvas fish pond%");
  });

  it("cannot produce a bare wildcard pattern from a wildcard-only term", () => {
    // A term of "%%%" must match a literal "%%%" and therefore nothing in the
    // catalogue - not everything.
    expect(likeContains("%%%")).toBe("%\\%\\%\\%%");
  });
});
