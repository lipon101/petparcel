// Guards the host-aware robots.txt.
//
// WHY THIS SUITE EXISTS. robots.txt is now generated per request from the
// request HOST, so the SAME URL must answer two different ways: the real policy
// on the production storefront, and disallow-all on a `*.vercel.app` preview or
// a local run. A regression here is silent - a preview that serves the
// production policy looks perfectly healthy while Google and Bing index it -
// so both directions are pinned, plus the headers that keep the host-specific
// body out of a shared cache.
import { describe, expect, it } from "vitest";
import { robotsHeaders, robotsTxt } from "./robots";

describe("robotsTxt", () => {
  it("serves the real policy on the production hosts", () => {
    for (const host of ["www.petparcel.store", "petparcel.store"]) {
      const body = robotsTxt(host);
      expect(body).toContain("User-agent: *");
      expect(body).toContain("Allow: /");
      expect(body).toContain("Sitemap: https://www.petparcel.store/sitemap.xml");
      expect(body).toContain("Host: https://www.petparcel.store");
      // The production policy is the one that ALLOWS crawling; the
      // non-production marker must not be present.
      expect(body).not.toContain("Non-production host");
    }
  });

  it("keeps the per-visitor surfaces disallowed on production", () => {
    const body = robotsTxt("www.petparcel.store");
    for (const p of ["/account", "/cart", "/checkout", "/login", "/register", "/order/"]) {
      expect(body).toContain(`Disallow: ${p}`);
    }
  });

  it("refuses the well-known AI training crawlers on production", () => {
    const body = robotsTxt("www.petparcel.store");
    for (const bot of [
      "GPTBot",
      "Google-Extended",
      "Applebot-Extended",
      "CCBot",
      "ClaudeBot",
      "PerplexityBot",
      "Bytespider",
    ]) {
      expect(body).toContain(`User-agent: ${bot}`);
    }
  });

  it("does NOT block the search engines themselves on production", () => {
    // Only the AI-training opt-outs are listed; Googlebot/Bingbot must stay free
    // to crawl or the store disappears from search.
    const body = robotsTxt("www.petparcel.store");
    expect(body).not.toMatch(/^User-agent: Googlebot$/m);
    expect(body).not.toMatch(/^User-agent: Bingbot$/m);
  });

  it("serves disallow-all on a Vercel preview host", () => {
    const body = robotsTxt("petparcel-bpwf726dl-lipon.vercel.app");
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /");
    // No sitemap and no allow rule: a preview must not advertise the store.
    expect(body).not.toContain("Sitemap:");
    expect(body).not.toContain("Allow: /");
  });

  it("serves disallow-all on localhost, an IP, and an unknown/empty host", () => {
    for (const host of ["localhost", "localhost:3000", "127.0.0.1", "", null, undefined]) {
      const body = robotsTxt(host);
      expect(body).toContain("Disallow: /");
      expect(body).not.toContain("Sitemap:");
    }
  });
});

describe("robotsHeaders", () => {
  it("is text/plain, which is what a crawler expects", () => {
    expect(robotsHeaders()["Content-Type"]).toContain("text/plain");
  });

  it("is not cached, because the body differs per host", () => {
    // A shared cache could otherwise hand a preview's disallow-all to the
    // production store, or the production policy to a preview.
    expect(robotsHeaders()["Cache-Control"]).toBe("no-store");
  });
});
