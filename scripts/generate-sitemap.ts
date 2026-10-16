// Generates server/_core/sitemap-data.ts from the live catalog.
//
//   pnpm sitemap
//
// Run it whenever products change (or as a Vercel build step) so the sitemap
// always reflects what is actually live and `active`.
//
// WHY IT WRITES A TS MODULE, NOT client/public/sitemap.xml. The sitemap is
// served per request from the request HOST (server/_core/sitemap.ts), so a
// static file cannot work: on Vercel the filesystem is checked before rewrites,
// so a static `client/public/sitemap.xml` would be served for every host and
// would shadow the host-aware route - the same reason the static robots.txt was
// removed. The URL list therefore ships as the generated, type-checked module
// `server/_core/sitemap-data.ts`, which the server imports and the esbuild
// bundle inlines.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { listSeoProducts } from "../server/db";
import { STORE_URL } from "../shared/store";

const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/shop", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/faq", changefreq: "monthly", priority: "0.6" },
  { path: "/shipping-returns", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

/** A JSON string literal, safe to embed in a TS module. */
const js = (s: string) => JSON.stringify(s);

/** Re-render the UI, verbatim, from the committed generated module. */
function renderSitemapModule(urls: SitemapUrl[]): string {
  return `// GENERATED - do not hand-edit. Re-run \`pnpm sitemap\` to refresh.
//
// WHY THIS IS A MODULE AND NOT client/public/sitemap.xml. The sitemap is served
// per request from the request HOST (see server/_core/sitemap.ts), exactly the
// way robots.txt is: the production storefront advertises its real URL list,
// and a \`*.vercel.app\` preview - or a local run - advertises an EMPTY urlset, so
// a preview deployment can never point a crawler at the live store. A static
// file is one file for every hostname a Vercel project serves, and on Vercel the
// filesystem is checked before rewrites, so a static sitemap.xml would be served
// for every host and shadow the host-aware route entirely. The URL list
// therefore ships as this bundled module, which server/_core/sitemap.ts imports
// and the esbuild server bundle inlines.
//
// Source: the live catalog (active, unarchived products) plus the static page
// list in scripts/generate-sitemap.ts. Regenerate with \`pnpm sitemap\`, which
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
${urls.map((u) => `  ${entry(u)},`).join("\n")}
];
`;
}

type SitemapUrl = { loc: string; lastmod?: string; changefreq?: string; priority?: string };

/** One data-module entry literal, in a stable key order. */
function entry(u: SitemapUrl): string {
  const parts = [`loc: ${js(u.loc)}`];
  if (u.lastmod) parts.push(`lastmod: ${js(u.lastmod)}`);
  if (u.changefreq) parts.push(`changefreq: ${js(u.changefreq)}`);
  if (u.priority) parts.push(`priority: ${js(u.priority)}`);
  return `{ ${parts.join(", ")} }`;
}

async function main() {
  // The static pages never need the database, so build them first and always.
  const urls: SitemapUrl[] = STATIC_PAGES.map((p) => ({
    loc: `${STORE_URL}${p.path}`,
    changefreq: p.changefreq,
    priority: p.priority,
  }));

  // Product URLs come from the live catalog, which means a database round trip.
  //
  // This runs inside `pnpm build`, so how it behaves when the database is
  // unreachable is a DEPLOYMENT decision, not a detail. Failing the build would
  // let a transient database hiccup block shipping the storefront entirely; and
  // writing the static-pages-only module would REPLACE a good committed list with
  // one that silently drops every product - worse for SEO than a stale file.
  //
  // So: on failure, keep the committed module exactly as it is, say so loudly,
  // and let the deploy continue. A stale sitemap is recoverable on the next
  // deploy; a failed one is a store nobody can buy from.
  let products: Awaited<ReturnType<typeof listSeoProducts>> = [];
  try {
    products = await listSeoProducts();
  } catch (err) {
    console.warn(
      `[sitemap] SKIPPED product URLs - catalog unavailable (${
        err instanceof Error ? err.message : String(err)
      }).`,
    );
    console.warn(
      "[sitemap] The committed server/_core/sitemap-data.ts is left UNTOUCHED so it " +
        "keeps serving. Set DATABASE_URL (or re-run `pnpm sitemap` with the " +
        "database reachable) to refresh product URLs.",
    );
    return;
  }

  for (const p of products) {
    urls.push({
      loc: `${STORE_URL}/product/${p.slug}`,
      ...(p.updatedAt ? { lastmod: new Date(p.updatedAt).toISOString().slice(0, 10) } : {}),
      changefreq: "weekly",
      priority: "0.8",
    });
  }

  const out = resolve(process.cwd(), "server/_core/sitemap-data.ts");
  writeFileSync(out, renderSitemapModule(urls), "utf8");
  console.log(
    `Wrote ${urls.length} URLs to ${out} (${STATIC_PAGES.length} pages + ${products.length} products)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
