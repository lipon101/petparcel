// ── sitemap.xml, decided by the HOST ──────────────────────────────────────────
//
// WHY THIS IS A ROUTE AND NOT A STATIC FILE. A Vercel project serves the SAME
// build on many hostnames: the production domain, and a fresh `*.vercel.app` URL
// for every preview and deployment. A static `sitemap.xml` is one file for all
// of them, so it cannot advertise the store's real URL list on production and
// NOTHING on a preview - and a preview that advertises the production sitemap
// hands crawlers the live store's URLs, which is exactly the leak robots.txt was
// already hardened against (see server/_core/robots.ts). On Vercel the
// filesystem is also checked before rewrites, so a static file would be served
// for every host and shadow this route entirely.
//
// So the file is generated per request from the request host, using the single
// host decision in `shared/production-host.ts`:
//
//   * production (www.petparcel.store / petparcel.store) -> the real sitemap,
//     built from the bundled URL list in `./sitemap-data.ts`.
//   * anything else (a `*.vercel.app` preview, localhost, an IP) -> an EMPTY
//     but well-formed <urlset>, so a preview advertises no store URL at all.
//
// The static `client/public/sitemap.xml` was REMOVED for the same reason the
// static `client/public/robots.txt` was: the filesystem cannot be allowed to
// answer a per-host path. The URL list now ships as the generated module
// `server/_core/sitemap-data.ts`, refreshed by `pnpm sitemap`.
import { isProductionHost } from "@shared/production-host";
import { SITEMAP_URLS, type SitemapUrl } from "./sitemap-data";

/**
 * A valid, EMPTY <urlset> - what a non-production host advertises. It is a
 * real, parseable sitemap that simply lists no URLs, so a crawler that ignores
 * the host gate still learns nothing about the store.
 */
const EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
`;

/** Escape a value for use in XML character data. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Render one <url> entry, omitting the optional children that are absent. */
function renderUrl(u: SitemapUrl): string {
  const lines = [`  <url>`, `    <loc>${escapeXml(u.loc)}</loc>`];
  if (u.lastmod) lines.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
  if (u.changefreq) lines.push(`    <changefreq>${escapeXml(u.changefreq)}</changefreq>`);
  if (u.priority) lines.push(`    <priority>${escapeXml(u.priority)}</priority>`);
  lines.push(`  </url>`);
  return lines.join("\n");
}

/**
 * The sitemap body for a request host. Production gets the real sitemap; every
 * other host (a preview, localhost, an unknown value) gets an empty urlset,
 * which is the safe default - an unrecognised host must never advertise the
 * live store's URLs.
 */
export function sitemapXml(host: string | null | undefined): string {
  if (!isProductionHost(host)) return EMPTY_SITEMAP;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_URLS.map(renderUrl).join("\n")}
</urlset>
`;
}

/**
 * The response headers for sitemap.xml.
 *
 * `application/xml` is what crawlers expect (an HTML or text content-type can
 * make a crawler ignore the file). `no-store` keeps the host-specific body out
 * of any shared cache: the SAME URL answers differently per host, so a cached
 * copy could hand a preview's empty sitemap to the production store - or, worse,
 * the production sitemap to a preview.
 */
export function sitemapHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
