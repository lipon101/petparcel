import type { Context, Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "./env";
import { injectSeo, resolveSeo } from "./ssr-meta";
import { isProductionHost } from "@shared/production-host";

// The ONE place the runtime touches the filesystem (DESIGN §5.1). In prod the
// single Hono process serves the built SPA from dist/public + an index.html
// SPA fallback. In dev this is a no-op: Vite owns the client on PORT and proxies
// API calls here. Swapping this shim (e.g. edge Static Assets) is all it takes
// to move off Node - business code never reads fs.
const PUBLIC_DIR = "dist/public";

/**
 * Read the built SPA shell, with a deployment-safe fallback.
 *
 * WHY THE FALLBACK EXISTS. On Vercel the storefront is served from the CDN, and
 * until now the SPA fallback rewrite pointed at the STATIC `/index.html`. Vercel
 * checks the filesystem before rewrites, so every HTML route - including every
 * `/product/:slug` landing page - was answered with that one static file and this
 * function never saw it. The per-product metadata below therefore never reached
 * production: every product page shipped the byte-identical homepage shell, with
 * a canonical pointing at `/` and no product title, price or availability in the
 * HTML. That is a landing-page defect: Google Merchant Center crawls each feed
 * `link` and rejects an item whose page does not show the advertised product.
 *
 * The rewrite now sends those unfiled HTML routes to THIS function (see
 * `vercel.json`), which is what makes `injectSeo` run in production. Two sources
 * are tried, cheapest first:
 *
 *   1. `dist/public/index.html` on disk - the long-lived Node server
 *      (`pnpm start`) and any function that carries the build output.
 *   2. This deployment's OWN static shell, fetched from the request origin. On
 *      Vercel the function's filesystem does not necessarily include
 *      `dist/public`, but `/index.html` is always a deployed static asset - and it
 *      is excluded from the fallback rewrite, so this fetch cannot recurse.
 *
 * Returns `null` when neither is available, so the caller can answer an honest
 * 503 instead of an empty 200 that a crawler would record as a broken page.
 */
async function readShell(c: Context): Promise<string | null> {
  try {
    return await readFile(path.resolve(PUBLIC_DIR, "index.html"), "utf-8");
  } catch {
    // Not on this filesystem - fall through to the deployment's static copy.
  }
  try {
    const origin = new URL(c.req.url).origin;
    const res = await fetch(`${origin}/index.html`, {
      headers: { "user-agent": "petparcel-ssr-shell" },
    });
    if (res.ok) return await res.text();
  } catch {
    // Network or parse failure - treat as no shell.
  }
  return null;
}

// CACHE POLICY. Bundled output is content-addressed: Vite puts a hash of the
// file's contents in every filename under /assets/, so those bytes can never
// change under a given URL. That makes them safe to cache for a year AND to
// serve without any revalidation round trip, which is what removes a per-visit
// request for each of the storefront's chunks. index.html is the exact
// opposite: it is the entry point that NAMES the current hashed bundles, so it
// must be re-checked on every visit or a returning shopper keeps booting a
// previous deploy. The remaining un-hashed public files (hero.png, favicon.svg)
// get a short, revalidating window so a swap still propagates the same day.
function cacheControlFor(filePath: string): string {
  // HTML is the entry point that names the current hashed bundles, so it must be
  // revalidated on every visit - a cached shell would pin a previous deploy.
  if (/\.html?$/.test(filePath)) return "no-cache";
  if (/\/assets\/.+\.(?:js|css|map|woff2?|ttf|svg|png|jpe?g|webp|avif)$/.test(filePath)) {
    return "public, max-age=31536000, immutable";
  }
  // Other un-hashed public files (hero.png, favicon.svg): changeable, so keep the
  // window short and revalidating rather than pinning them for a year.
  return "public, max-age=3600, must-revalidate";
}

export function mountClient(app: Hono): void {
  if (!env.isProd) return;

  // ── The document shell, with per-route SEO ────────────────────────────────
  // Serves index.html with the per-page Open Graph tags and JSON-LD injected.
  // The per-page tags are written at runtime by the client `useSeo()` hook,
  // which a social crawler or any non-JS crawler never runs - so it only ever
  // saw the static, site-wide tags. Resolve the SAME metadata here and inject
  // it into the shell before it is sent, so the raw HTML already carries the
  // correct tags for the requested route.
  //
  // Best-effort: a resolution failure (e.g. the catalog is unreachable for a
  // product page) must never take the storefront down, so the untouched shell
  // is served instead and the client hook still fills the tags in the browser.
  const serveShell = async (c: Context) => {
    const html = await readShell(c);
    // No shell from disk AND none from the deployment's static copy: answer an
    // honest 503 rather than a 200 with an empty body, which Google's crawler
    // would store as a broken landing page.
    if (html === null) return c.text("Service temporarily unavailable.", 503);
    // Revalidate the shell on every navigation: it references the hashed
    // bundles above, so a stale copy would pin an old deploy.
    c.header("Cache-Control", "no-cache");
    try {
      const url = new URL(c.req.url);
      const seo = await resolveSeo(url.pathname, url.search);
      // A non-production host (a preview deployment, a local run) must never be
      // indexed, whatever the route's own directive says. The host decision is
      // shared with the client tag gate and the X-Robots-Tag header.
      if (!isProductionHost(url.hostname)) seo.noindex = true;
      return c.html(injectSeo(html, seo));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[serve] SSR meta injection skipped", err);
      return c.html(html);
    }
  };

  // The ROOT must be handled before `serveStatic`: its directory-index
  // behaviour would otherwise answer `/` with the bare shell and bypass the
  // SSR injection entirely.
  app.get("/", serveShell);

  app.use(
    "/*",
    serveStatic({
      root: `./${PUBLIC_DIR}`,
      // Runs once the file is known to exist, before its bytes are streamed.
      onFound: (filePath, c) => {
        c.header("Cache-Control", cacheControlFor(filePath));
      },
    }),
  );
  app.get("*", serveShell);
}
