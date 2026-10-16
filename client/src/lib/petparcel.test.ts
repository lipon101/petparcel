import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm, searchEcho, serializeJsonLd } from "./petparcel";

// Reflected-input regression coverage.
//
// The storefront is a SPA, so React escapes text children and the SEO writer
// assigns `textContent` / uses `setAttribute` - all safe. The ONE non-React sink
// is the JSON-LD <script>, whose body is written as text: the HTML parser ends a
// script element at the first `</script>` in its TEXT, so reflected content that
// contains one can break out of the element. These tests pin the escaping that
// makes that impossible and the query normaliser that keeps a search term inert
// everywhere else it is echoed.

const PAYLOAD = "<script>alert(1)</script>";
const BREAKOUT = "</script><script>alert(1)</script>";

describe("serializeJsonLd", () => {
  it("escapes every `<` so a reflected script tag cannot close the element", () => {
    const out = serializeJsonLd({ name: PAYLOAD });
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c");
    // No literal `</script`, and no `<script`, survives.
    expect(out.toLowerCase()).not.toContain("</script");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("keeps an early-close breakout inert", () => {
    const out = serializeJsonLd({ q: BREAKOUT });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("\\u003c/script\\u003e");
  });

  it("still round-trips through JSON.parse to the original value", () => {
    const value = { name: PAYLOAD, nested: { q: BREAKOUT, n: 3, ok: true } };
    expect(JSON.parse(serializeJsonLd(value))).toEqual(value);
  });

  it("escapes the line/paragraph separators JSON allows but a script body cannot carry", () => {
    const out = serializeJsonLd({ s: "a\u2028b\u2029c" });
    expect(out).not.toContain("\u2028");
    expect(out).not.toContain("\u2029");
    expect(out).toContain("\\u2028");
    expect(out).toContain("\\u2029");
    expect(JSON.parse(out)).toEqual({ s: "a\u2028b\u2029c" });
  });

  it("serialises nullish values as null rather than failing", () => {
    expect(serializeJsonLd(undefined)).toBe("null");
    expect(serializeJsonLd(null)).toBe("null");
  });
});

describe("sanitizeSearchTerm", () => {
  it("strips the markup delimiters a search box never needs", () => {
    expect(sanitizeSearchTerm(PAYLOAD)).toBe("scriptalert(1)/script");
    expect(sanitizeSearchTerm(BREAKOUT)).toBe("/scriptscriptalert(1)/script");
    expect(sanitizeSearchTerm(PAYLOAD)).not.toContain("<");
    expect(sanitizeSearchTerm(PAYLOAD)).not.toContain(">");
  });

  it("leaves ordinary queries intact", () => {
    expect(sanitizeSearchTerm("no-pull harness")).toBe("no-pull harness");
    expect(sanitizeSearchTerm("cat   bed")).toBe("cat bed");
    expect(sanitizeSearchTerm("  dog toy  ")).toBe("dog toy");
  });

  it("drops control characters and collapses whitespace", () => {
    expect(sanitizeSearchTerm("a\u0000b\u001fc")).toBe("a b c");
    expect(sanitizeSearchTerm("a\n\t b")).toBe("a b");
  });

  it("caps the length so a giant query cannot bloat the heading or the JSON-LD", () => {
    const out = sanitizeSearchTerm("x".repeat(500));
    expect(out.length).toBe(120);
    expect(sanitizeSearchTerm("y".repeat(50), 10).length).toBe(10);
  });

  it("treats an absent query as empty", () => {
    expect(sanitizeSearchTerm(null)).toBe("");
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm("")).toBe("");
    expect(sanitizeSearchTerm("   ")).toBe("");
  });
});

describe("searchEcho", () => {
  it("shows an ordinary query back", () => {
    expect(searchEcho("no-pull harness")).toBe("no-pull harness");
    expect(searchEcho("  cat bed ")).toBe("cat bed");
  });

  it("never echoes a query that carried markup", () => {
    expect(searchEcho(PAYLOAD)).toBe("");
    expect(searchEcho(BREAKOUT)).toBe("");
    expect(searchEcho("cat > dog")).toBe("");
    expect(searchEcho("<img onerror=x>")).toBe("");
  });

  it("is empty for an absent query", () => {
    expect(searchEcho(null)).toBe("");
    expect(searchEcho(undefined)).toBe("");
    expect(searchEcho("   ")).toBe("");
  });
});
