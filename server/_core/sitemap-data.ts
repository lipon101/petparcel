// GENERATED - do not hand-edit. Re-run `pnpm sitemap` to refresh.
//
// WHY THIS IS A MODULE AND NOT client/public/sitemap.xml. The sitemap is served
// per request from the request HOST (see server/_core/sitemap.ts), exactly the
// way robots.txt is: the production storefront advertises its real URL list,
// and a `*.vercel.app` preview - or a local run - advertises an EMPTY urlset, so
// a preview deployment can never point a crawler at the live store. A static
// file is one file for every hostname a Vercel project serves, and on Vercel the
// filesystem is checked before rewrites, so a static sitemap.xml would be served
// for every host and shadow the host-aware route entirely. The URL list
// therefore ships as this bundled module, which server/_core/sitemap.ts imports
// and the esbuild server bundle inlines.
//
// Source: the live catalog (active, unarchived products) plus the static page
// list in scripts/generate-sitemap.ts. Regenerate with `pnpm sitemap`, which
// runs as a build step so the list stays fresh. On a catalog failure the
// committed module is left UNTOUCHED rather than replaced by a product-less file
// - the same "a stale sitemap beats an empty one" rule the earlier static
// generator kept.

/** One <url> entry in the sitemap. */
export interface SitemapUrl {
  /** The absolute URL, built from the store origin. */
  loc: string;
  /** ISO date (YYYY-MM-DD) of the last meaningful change, when known. */
  lastmod?: string;
  /** How often the page changes, in the sitemap.org vocabulary. */
  changefreq?: string;
  /** Crawl priority, 0.0-1.0. */
  priority?: string;
}

export const SITEMAP_URLS: SitemapUrl[] = [
  { loc: "https://www.petparcel.store/", changefreq: "daily", priority: "1.0" },
  { loc: "https://www.petparcel.store/shop", changefreq: "daily", priority: "0.9" },
  { loc: "https://www.petparcel.store/about", changefreq: "monthly", priority: "0.5" },
  { loc: "https://www.petparcel.store/faq", changefreq: "monthly", priority: "0.6" },
  { loc: "https://www.petparcel.store/shipping-returns", changefreq: "monthly", priority: "0.6" },
  { loc: "https://www.petparcel.store/contact", changefreq: "monthly", priority: "0.5" },
  { loc: "https://www.petparcel.store/privacy", changefreq: "yearly", priority: "0.3" },
  { loc: "https://www.petparcel.store/terms", changefreq: "yearly", priority: "0.3" },
  { loc: "https://www.petparcel.store/product/intelligent-litter-box-automatic-self-cleaning-deodorant", lastmod: "2026-10-12", changefreq: "weekly", priority: "0.8" },
];
