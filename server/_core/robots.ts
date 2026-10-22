// ── robots.txt, decided by the HOST ──────────────────────────────────────────
//
// WHY THIS IS A ROUTE AND NOT A STATIC FILE. A Vercel project serves the SAME
// build on many hostnames: the production domain, and a fresh `*.vercel.app` URL
// for every preview and deployment. A static `robots.txt` is one file for all of
// them, so it cannot say "crawl the store" on production and "crawl nothing"
// on a preview - and the preview URLs were exactly what Google Search Console
// and Bing were picking up.
//
// So the file is generated per request from the request host, using the single
// host decision in `shared/production-host.ts`:
//
//   * production (www.petparcel.store / petparcel.store) -> the real policy:
//     crawl the store, keep the per-visitor surfaces out, refuse the AI-training
//     crawlers, and point at the sitemap.
//   * anything else (a `*.vercel.app` preview, localhost, an IP) -> disallow
//     everything, so a preview can never be indexed.
//
// The static `client/public/robots.txt` was REMOVED for this reason: on Vercel
// the filesystem is checked before rewrites, so a static file would be served
// for every host and would bypass this gate entirely. The production body below
// is the same policy that file carried.
import { isProductionHost } from "@shared/production-host";

/** The production policy. Mirrors the former `client/public/robots.txt`. */
const PRODUCTION_ROBOTS = `# PetParcel - robots.txt
# US-market storefront. Everything public is crawlable; account, cart, checkout
# and admin surfaces are excluded because they show per-visitor state.

User-agent: *
Allow: /

# Per-visitor / transactional surfaces.
#
# NOTE: the store's management area is deliberately NOT listed here. A robots.txt
# entry is a PUBLIC file - writing that path down would publish the very URL the
# hidden path exists to conceal. It is protected instead by (a) being unlinked
# from every public page, (b) a runtime-derived path no bundle literal reveals,
# and (c) a server-side role check on every management procedure.
Disallow: /account
Disallow: /account/
Disallow: /cart
Disallow: /checkout
Disallow: /login
Disallow: /register

# Individual order receipts are private to the buyer
Disallow: /order/

# Common junk crawlers add no value here
User-agent: AhrefsBot
Crawl-delay: 10

# ── AI crawlers ──────────────────────────────────────────────────────────────
# The catalogue is our own product data and imagery, and we do not license it
# for model training, so the well-known AI training crawlers are refused. This
# is the robots.txt half of the control; Cloudflare's "Block AI bots" toggle and
# AI Labyrinth (Security → Settings) enforce the same policy at the edge, where
# a crawler that ignores robots.txt is actually stopped. Search engines
# (Googlebot, Bingbot) are deliberately NOT listed - only their AI-training
# opt-outs (Google-Extended, Applebot-Extended) are.
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: OAI-SearchBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: cohere-ai
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: ImagesiftBot
Disallow: /

User-agent: Omgilibot
Disallow: /

User-agent: Timpibot
Disallow: /

User-agent: YouBot
Disallow: /

Sitemap: https://www.petparcel.store/sitemap.xml
Host: https://www.petparcel.store
`;

/** The non-production policy: crawl nothing. */
const NON_PRODUCTION_ROBOTS = `# Non-production host (a preview deployment or a local run).
# This host must never be indexed. The production policy is served only on
# www.petparcel.store / petparcel.store - see shared/production-host.ts.
User-agent: *
Disallow: /
`;

/**
 * The robots.txt body for a request host. Production gets the real policy;
 * every other host (a preview, localhost, an unknown value) gets disallow-all,
 * which is the safe default.
 */
export function robotsTxt(host: string | null | undefined): string {
  return isProductionHost(host) ? PRODUCTION_ROBOTS : NON_PRODUCTION_ROBOTS;
}

/**
 * The response headers for robots.txt.
 *
 * `text/plain` is what crawlers expect (a JSON or HTML content-type can make a
 * crawler ignore the file). `no-store` keeps the host-specific body out of any
 * shared cache: the SAME URL answers differently per host, so a cached copy
 * could hand a preview's disallow-all to the production store - or, worse, the
 * production policy to a preview.
 */
export function robotsHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
