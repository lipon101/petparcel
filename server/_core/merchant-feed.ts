// ── google-merchant-feed.xml, decided by the HOST ───────────────────────────
//
// WHY THIS IS A ROUTE AND NOT A STATIC FILE. A Vercel project serves the SAME
// build on many hostnames: the production domain, and a fresh `*.vercel.app` URL
// for every preview and deployment. A static feed is one file for all of them, so
// it cannot advertise the store's real items on production and NOTHING on a
// preview - and a preview that advertises the production feed hands Google the
// live store's prices, stock and SKUs, which is exactly the leak robots.txt and
// sitemap.xml were already hardened against (see server/_core/robots.ts and
// server/_core/sitemap.ts). On Vercel the filesystem is also checked before
// rewrites, so a static file would be served for every host and shadow this route
// entirely.
//
// So the document is generated per request from the request host, using the
// single host decision in `shared/production-host.ts`:
//
//   * production (www.petparcel.store / petparcel.store) -> the real feed, built
//     from the bundled item list in `./merchant-feed-data.ts`.
//   * anything else (a `*.vercel.app` preview, localhost, an IP) -> an EMPTY but
//     well-formed RSS feed, so a preview advertises no item at all.
//
// The mapping itself lives in `shared/merchant-feed.ts`, so the generator, this
// route and the parity test all read ONE definition and cannot drift.
import { isProductionHost } from "@shared/production-host";
import { merchantFeedHeaders, merchantFeedXml } from "@shared/merchant-feed";
import { MERCHANT_FEED_ITEMS } from "./merchant-feed-data";

/**
 * The feed body for a request host. Production gets the real item list; every
 * other host (a preview, localhost, an unknown value) gets an empty feed, which
 * is the safe default - an unrecognised host must never advertise the live
 * store's prices or stock.
 */
export function merchantFeedFor(host: string | null | undefined): string {
  return merchantFeedXml(host, MERCHANT_FEED_ITEMS, isProductionHost);
}

export { merchantFeedHeaders };
