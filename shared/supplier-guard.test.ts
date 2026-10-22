// The supplier-name guard: the storefront must never name its supplier.
//
// WHY THIS EXISTS. A dropshipping disclosure ("Ships from CJdropshipping's US
// warehouse. Supplied by CJdropshipping under SKU CJxxxx; options on this
// listing: ...") leaked onto almost every product page. Naming the supplier is a
// competitive tell and a trust problem. These tests are the guard that makes the
// term impossible to reintroduce: they fail the build if it appears in the
// shipped catalogue, in the sanitizer's own output, or in any rendered surface.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  containsSupplierMention,
  stripSupplierMentions,
  sanitizeProductCopy,
} from "./supplier-guard";
import { CATALOG_DATA } from "./catalog-data";
import { stripMarkdown, parseProductCopy, oneLineSummary } from "./store";

describe("supplier guard", () => {
  it("detects every spelling of the supplier name", () => {
    for (const s of [
      "CJdropshipping",
      "CJ Dropshipping",
      "cjdropshipping.com",
      "Ships from CJdropshipping's US warehouse.",
      "Supplied by CJ Dropshipping under SKU CJ123.",
    ]) {
      expect(containsSupplierMention(s), s).toBe(true);
    }
    expect(containsSupplierMention("A soft silicone grooming brush.")).toBe(false);
  });

  it("drops the whole disclosure tail, not just the name", () => {
    const input =
      "A soft silicone grooming brush for bath time. Ships from CJdropshipping's US warehouse. Supplied by CJdropshipping under SKU CJNP3015338; options on this listing: BLACK. Tracked delivery and a 30-day returns window.";
    const out = stripSupplierMentions(input);
    expect(containsSupplierMention(out)).toBe(false);
    expect(out).not.toMatch(/Supplied by|options on this listing|SKU CJNP/i);
    expect(out).toContain("A soft silicone grooming brush for bath time.");
  });

  it("keeps ordinary prose intact", () => {
    const input = "A cosy hideaway your cat can call their own.\n\n- Machine washable.\n- Folds flat.";
    expect(stripSupplierMentions(input)).toBe(input);
  });

  it("is a no-op on already-clean copy", () => {
    const clean = "A rechargeable collar that calms excessive barking.";
    expect(sanitizeProductCopy(clean)).toBe(clean);
  });

  it("scrubs a bare mention that survives inside a sentence", () => {
    const out = stripSupplierMentions("This CJdropshipping item is great.");
    expect(containsSupplierMention(out)).toBe(false);
  });
});

describe("catalogue copy is supplier-free", () => {
  it("names the supplier nowhere in the shipped catalogue", () => {
    const leaks = CATALOG_DATA.filter(
      (p) => containsSupplierMention(p.description) || containsSupplierMention(p.name),
    ).map((p) => p.slug);
    expect(leaks, `supplier named on: ${leaks.join(", ")}`).toEqual([]);
  });

  it("carries no markdown or decorative brackets in any description", () => {
    const bad = CATALOG_DATA.filter(
      (p) => /\*\*/.test(p.description) || /[【】]/.test(p.description),
    ).map((p) => p.slug);
    expect(bad, `markup on: ${bad.join(", ")}`).toEqual([]);
  });
});

describe("render surfaces are supplier-free", () => {
  it("stripMarkdown removes the supplier even from a hand-pasted row", () => {
    const out = stripMarkdown("Great brush. Supplied by CJdropshipping under SKU CJ1.");
    expect(containsSupplierMention(out)).toBe(false);
  });

  it("parseProductCopy never emits the supplier", () => {
    const copy = parseProductCopy(
      "A grooming brush. **Soft bristles** - gentle on skin. Supplied by CJdropshipping under SKU CJ1.",
    );
    const all = [...copy.paragraphs, ...copy.features].join(" ");
    expect(containsSupplierMention(all)).toBe(false);
  });

  it("oneLineSummary never emits the supplier", () => {
    const out = oneLineSummary("A grooming brush. Supplied by CJdropshipping under SKU CJ1.");
    expect(containsSupplierMention(out)).toBe(false);
  });
});

describe("the shipped source names the supplier nowhere", () => {
  // The copy guard above stops the supplier reaching a RENDERED surface. This
  // one closes the other direction: the supplier's NAME and its CDN HOSTNAMES
  // must not be baked into any source file that ships to the browser, because
  // both the client bundle and the served HTML are public - a shopper can open
  // DevTools and read them.
  //
  // `catalog-data.ts` is bundled into the client and the server; `product-media`
  // ships in the client bundle. If the supplier's host ever returns, this fails.
  const SHIPPED_SOURCES = ["catalog-data.ts", "product-media.ts"];

  it("carries no supplier name, disclosure tail or CDN hostname", () => {
    const BANNED = [
      /cj\s*dropshipping/i,
      /cjdropshipping\.com/i,
      /\bsupplied\s+by\b/i,
      /\boptions?\s+on\s+this\s+listing\b/i,
      /\bships?\s+from\s+cj\b/i,
    ];
    for (const file of SHIPPED_SOURCES) {
      const src = readFileSync(join(__dirname, file), "utf8");
      for (const re of BANNED) {
        expect(re.test(src), `${file} matches ${re}`).toBe(false);
      }
    }
  });
});
