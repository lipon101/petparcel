// Guards the host-aware sitemap.xml.
//
// WHY THIS SUITE EXISTS. sitemap.xml is now generated per request from the
// request HOST, so the SAME URL must answer two different ways: the real URL
// list on the production storefront, and an EMPTY urlset on a `*.vercel.app`
// preview or a local run. A regression here is silent - a preview that serves
// the production sitemap looks perfectly healthy while it hands crawlers the
// live store's URLs - so both directions are pinned, plus the headers that keep
// the host-specific body out of a shared cache.
import { describe, expect, it } from "vitest";
import { SITEMAP_URLS } from "./sitemap-data";
import { sitemapHeaders, sitemapXml } from "./sitemap";

describe("sitemapXml", () => {
  it("serves the real sitemap on the production hosts", () => {
    for (const host of ["www.petparcel.store", "petparcel.store"]) {
      const body = sitemapXml(host);
      expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      // Every committed URL is advertised, verbatim.
      for (const u of SITEMAP_URLS) {
        expect(body).toContain(`<loc>${u.loc}</loc>`);
      }
      // The data module must never be empty on production - an empty production
      // sitemap would silently de-list the store.
      expect(SITEMAP_URLS.length).toBeGreaterThan(0);
    }
  });

  it("advertises the storefront's main pages on production", () => {
    const body = sitemapXml("www.petparcel.store");
    for (const path of ["/", "/shop", "/shipping-returns", "/faq", "/contact", "/privacy", "/terms"]) {
      expect(body).toContain(`<loc>https://www.petparcel.store${path}</loc>`);
    }
  });

  it("keeps every advertised URL on the production origin", () => {
    // A data module built from the wrong origin (a preview URL, a relative
    // path) would advertise the store at an address it does not own.
    for (const u of SITEMAP_URLS) {
      expect(u.loc.startsWith("https://www.petparcel.store")).toBe(true);
    }
  });

  it("advertises NO URLs on a Vercel preview host", () => {
    const body = sitemapXml("petparcel-bpwf726dl-lipon.vercel.app");
    // Still a well-formed sitemap, but listing nothing.
    expect(body).toContain("<urlset");
    expect(body).not.toContain("<loc>");
  });

  it("advertises NO URLs on localhost, an IP, and an unknown/empty host", () => {
    for (const host of ["localhost", "localhost:3000", "127.0.0.1", "", null, undefined]) {
      const body = sitemapXml(host);
      expect(body).toContain("<urlset");
      expect(body).not.toContain("<loc>");
    }
  });
});

describe("sitemapHeaders", () => {
  it("is XML, which is what a crawler expects", () => {
    expect(sitemapHeaders()["Content-Type"]).toContain("xml");
  });

  it("is not cached, because the body differs per host", () => {
    // A shared cache could otherwise hand a preview's empty sitemap to the
    // production store, or the production sitemap to a preview.
    expect(sitemapHeaders()["Cache-Control"]).toBe("no-store");
  });
});
