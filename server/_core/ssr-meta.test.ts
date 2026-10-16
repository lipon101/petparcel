// Guards the server-side SEO injection: the per-route Open Graph tags and
// JSON-LD must be present in the RAW HTML the server returns, because a social
// crawler or any non-JS crawler never runs the client `useSeo()` hook.
//
// `injectSeo` is pure, so it is exercised directly against a minimal shell that
// mirrors the real `client/index.html` head. `resolveSeo` is checked for the
// routes that need no database (home, shop, cart, content, 404).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { injectSeo, resolveSeo, serializeJsonLd } from "./ssr-meta";

// The product branch reads the catalog. Mock the data layer so the test needs no
// database, and so the Product JSON-LD shape can be asserted directly.
vi.mock("../db", () => ({
  getProductBySlug: vi.fn(async (slug: string) =>
    slug === "known-product"
      ? {
          id: "p1",
          name: "Cozy Dog Bed",
          slug: "known-product",
          description: "A **soft** bed for dogs.",
          category: "Dogs",
          priceCents: 4999,
          images: ["/products/bed.jpg"],
          variants: [{ sku: "BED-1" }],
          rating: 4.5,
          reviewCount: 12,
        }
      : null,
  ),
}));

const INDEX_HTML = path.resolve(import.meta.dirname, "..", "..", "client", "index.html");
const shell = readFileSync(INDEX_HTML, "utf-8");

describe("injectSeo", () => {
  it("replaces the static tags in place (no duplicates) and adds JSON-LD", async () => {
    const seo = await resolveSeo("/about");
    const out = injectSeo(shell, seo);

    // The per-route title/description/canonical are now in the raw HTML.
    expect(out).toContain("<title>About Us | PetParcel</title>");
    expect(out).toContain('property="og:title" content="About Us | PetParcel"');
    expect(out).toContain('property="og:url" content="https://www.petparcel.store/about"');
    expect(out).toContain('rel="canonical" href="https://www.petparcel.store/about"');

    // Exactly one of each tag - the static one was replaced, not appended to.
    expect((out.match(/property="og:title"/g) ?? []).length).toBe(1);
    expect((out.match(/rel="canonical"/g) ?? []).length).toBe(1);
    expect((out.match(/<title>/g) ?? []).length).toBe(1);

    // The per-page JSON-LD is present and parses.
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    const blocks = [...out.matchAll(ld)].map((m) => JSON.parse(m[1]));
    expect(blocks.some((b) => b["@type"] === "WebPage")).toBe(true);
  });

  it("marks a noindex route as noindex in the raw HTML", async () => {
    // /cart, /wishlist and /track are all per-visitor surfaces, so each must be
    // noindex in the served HTML - not only after the client hook runs.
    for (const route of ["/cart", "/wishlist", "/track"]) {
      const out = injectSeo(shell, await resolveSeo(route));
      expect(out).toContain('name="robots" content="noindex,nofollow"');
    }
  });

  it("escapes reflected content so it cannot break out of the script element", () => {
    const out = serializeJsonLd({ q: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual({ q: "</script><script>alert(1)</script>" });
  });
});

describe("resolveSeo", () => {
  it("resolves the home page with an OnlineStore JSON-LD", async () => {
    const seo = await resolveSeo("/");
    expect(seo.canonical).toBe("https://www.petparcel.store/");
    expect(seo.noindex).toBe(false);
    expect(seo.jsonLd?.["@type"]).toBe("OnlineStore");
  });

  it("resolves the shop page, including a category filter", async () => {
    const seo = await resolveSeo("/shop", "?category=Dogs");
    expect(seo.title).toBe("Dogs - Shop");
    expect(seo.canonical).toBe("https://www.petparcel.store/shop?category=Dogs");
    expect(seo.jsonLd?.["@type"]).toBe("CollectionPage");
  });

  it("falls back to the 404 head for an unknown route", async () => {
    const seo = await resolveSeo("/definitely-not-a-page");
    expect(seo.noindex).toBe(true);
    expect(seo.title).toBe("Page not found");
  });

  it("resolves a product page with Product JSON-LD and an absolute OG image", async () => {
    const seo = await resolveSeo("/product/known-product");
    expect(seo.title).toBe("Cozy Dog Bed");
    expect(seo.type).toBe("product");
    expect(seo.canonical).toBe("https://www.petparcel.store/product/known-product");
    expect(seo.image).toBe("https://www.petparcel.store/products/bed.jpg");
    expect(seo.jsonLd?.["@type"]).toBe("Product");
    const offers = seo.jsonLd?.offers as Record<string, unknown>;
    expect(offers.price).toBe("49.99");
    expect(seo.jsonLd?.aggregateRating).toMatchObject({ ratingValue: "4.5", reviewCount: 12 });
  });

  it("returns the 404 head for a product slug that does not exist", async () => {
    const seo = await resolveSeo("/product/missing");
    expect(seo.noindex).toBe(true);
    expect(seo.title).toBe("Page not found");
  });

  it("resolves the wishlist as noindex with a WebPage JSON-LD", async () => {
    const seo = await resolveSeo("/wishlist");
    expect(seo.title).toBe("My Wishlist");
    expect(seo.noindex).toBe(true);
    expect(seo.canonical).toBe("https://www.petparcel.store/wishlist");
    expect(seo.jsonLd?.["@type"]).toBe("WebPage");
  });

  it("resolves the track page as noindex with a WebPage JSON-LD", async () => {
    const seo = await resolveSeo("/track");
    expect(seo.title).toBe("Track Your Order");
    expect(seo.noindex).toBe(true);
    expect(seo.canonical).toBe("https://www.petparcel.store/track");
    expect(seo.jsonLd?.["@type"]).toBe("WebPage");
  });
});

// ── Google Merchant Center landing-page regression ──────────────────────────
// WHY THIS BLOCK EXISTS. The feed was always valid, so the products NOT showing
// in Merchant Center was never a feed problem: every feed `link` is a
// `/product/:slug` page, and Google crawls that URL and will not approve an item
// whose landing page does not present the advertised product. In production the
// SPA fallback rewrite answered every HTML route from the STATIC `/index.html`
// (Vercel matches the filesystem before rewrites), so the serverless function
// never ran `injectSeo` and each product page shipped the byte-identical
// homepage shell - a `<link rel="canonical">` pointing at `/`. These assertions
// pin the two facts that defect violated, so the vercel.json + serve.ts fix
// cannot silently regress.
describe("Merchant Center landing page", () => {
  it("resolves a product route to its OWN canonical, never the homepage", async () => {
    const seo = await resolveSeo("/product/known-product");
    expect(seo.canonical).toBe("https://www.petparcel.store/product/known-product");
    expect(seo.canonical).not.toBe("https://www.petparcel.store/");
  });

  it("injectSeo replaces the shell's homepage canonical with the product's", async () => {
    const out = injectSeo(shell, await resolveSeo("/product/known-product"));
    expect(out).toContain('rel="canonical" href="https://www.petparcel.store/product/known-product"');
    // The homepage canonical shipped by the static shell must be GONE, and no
    // second one may be appended.
    expect(out).not.toContain('<link rel="canonical" href="https://www.petparcel.store/" />');
    expect((out.match(/rel="canonical"/g) ?? []).length).toBe(1);
    // The advertised product must be named in the raw HTML a crawler receives.
    expect(out).toContain("<title>Cozy Dog Bed | PetParcel</title>");
    expect(out).toContain('"@type":"Product"');
  });
});
