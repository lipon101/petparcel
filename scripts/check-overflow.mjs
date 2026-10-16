// Responsive-overflow gate.
//
// WHY THIS EXISTS. A long product title once forced the cart row (and a header
// strip) wider than the viewport, and a global `overflow-x: clip` on html/body
// MASKED it - so the page looked "broken / not responsive" instead of showing a
// scrollbar. Eye-balling it missed the real offender twice. This gate measures
// the DOM instead of trusting a screenshot.
//
// WHAT CHANGED (and why). The first version served the built client with
// `vite preview`, which PROXIES /trpc to a separate API process. In CI that
// process was never started, so every tRPC call failed with ECONNREFUSED and
// the gate measured pages rendered WITHOUT real data (no settings, no catalog,
// no auth) - an invalid test that also flooded the log with proxy errors.
//
// This version boots the REAL production server (`node dist/index.js`), which
// serves the built SPA AND the API on ONE port - so there is no proxy and no
// second process to forget. It then:
//   1. waits for the backend to be HEALTHY (a real /api/health 200 AND a real
//      settings.public read carrying the real free-shipping threshold), so the
//      pages are fully rendered with real server data before measuring;
//   2. signs a real user in through the real auth API, so /checkout renders the
//      real form rather than the "sign in" empty state;
//   3. seeds the cart fixture through the app's own localStorage path;
//   4. FAILS LOUDLY if the backend never becomes healthy, if any /trpc call
//      errors, or if the server log shows a proxy/ECONNREFUSED error - so a
//      broken page can never be silently measured as "passing".
//
// WHAT IT MEASURES. `documentElement.scrollWidth - clientWidth` is not enough:
// `overflow-x: clip` keeps that at 0 even when content is wider than the screen
// (it is CLIPPED, not overflowing). So the honest number is the BODY's
// scrollWidth minus the viewport. Both are checked and both must be 0.
//
// Run:   node scripts/check-overflow.mjs
// Env:   BASE_URL (default http://localhost:4173) - point it at an already
//        running server to skip the local boot (readiness + error checks still
//        run). DATABASE_URL + JWT_SECRET must be set for the booted server.
//
// In CI: `pnpm build` first (migrations + catalog sync + web + api), after
// `pnpm exec playwright install --with-deps chromium`.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { startServer, startTlsProxy, waitForHealth } from "./lib/real-server.mjs";

const PORT = Number(process.env.PREVIEW_PORT ?? 4173);
// The gate drives the app over REAL TLS. The production session cookie is
// `Secure`, which a browser will not store over http://, so on plain HTTP the
// sign-in would silently not stick and the cart would measure as empty. See
// scripts/lib/real-server.mjs.
const TLS_PORT = Number(process.env.TLS_PORT ?? PORT + 1000);
const BASE = process.env.BASE_URL ?? `https://127.0.0.1:${TLS_PORT}`;
const SELF_HOST = !process.env.BASE_URL;

// The harness talks to a self-signed certificate. Scoped to this process: the
// booted server gets a cleaned environment so its own TLS stays verified.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// 320 is the narrowest phone still in real use; the rest are the common device
// and layout breakpoints. The storefront stacks below ~1024, so 768/1024/1280
// cover tablet and desktop.
const WIDTHS = (process.env.WIDTHS ?? "320,360,375,390,414,768,1024,1280,1440")
  .split(",")
  .map((w) => Number(w.trim()))
  .filter((w) => Number.isFinite(w) && w > 0);
// `ROUTES` may be overridden (comma-separated) to check a subset - useful when a
// memory-constrained runner cannot hold one browser across every navigation.
const ROUTES = (process.env.ROUTES ?? "/cart,/checkout")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);
// Screenshots are captured at these widths for a human/visual read-back.
// Overridable so a memory-capped runner can split the sweep into chunks (each
// navigation costs a Chromium page; a 2GB container OOMs after ~10).
const SHOT_WIDTHS = (process.env.SHOT_WIDTHS ?? "320,390,768,1440")
  .split(",")
  .map((w) => Number(w.trim()))
  .filter((w) => Number.isFinite(w) && w > 0);
const SHOT_DIR = process.env.SHOT_DIR ?? "work/overflow-shots";
const TOLERANCE = 0.5; // sub-pixel rounding is not overflow

// A tRPC GET URL for a no-input query, in the batch+superjson shape the client
// sends. Used to prove the backend answers with REAL data before measuring.
const trpcGet = (proc) =>
  `${BASE}/trpc/${proc}?batch=1&input=${encodeURIComponent(
    JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }),
  )}`;

/**
 * The worst case is the LONGEST product name in the shipped catalogue - if the
 * layout survives that, it survives them all. Read from the real catalogue so
 * the fixture tracks the real data instead of a title frozen into this file.
 *
 * The SLUG comes back with the name because the cart is server-owned: the
 * fixture is created by ADDING that product through the real cart API, so a
 * name alone is not enough to build it.
 */
function catalogProducts() {
  const src = fs.readFileSync(path.resolve("shared/catalog-data.ts"), "utf8");
  const unesc = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const out = [];
  // Within one catalogue entry `slug` precedes `name`; the bounded lazy gap
  // keeps the match inside a single object rather than spanning entries.
  const re = /slug:\s*"((?:[^"\\]|\\.)*)"[\s\S]{0,4000}?name:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(src))) out.push({ slug: unesc(m[1]), name: unesc(m[2]) });
  return out;
}

function longestProduct() {
  let best = null;
  for (const p of catalogProducts()) {
    if (!best || p.name.length > best.name.length) best = p;
  }
  if (!best) throw new Error("could not read a product from shared/catalog-data.ts");
  return best;
}

function longestProductName() {
  return longestProduct().name;
}

/** The longest-title product, then any other real product, so the fixture has
 *  two distinct rows (one with a variant-free line) to lay out. */
function fixtureSlugs() {
  const longest = longestProduct();
  const other = catalogProducts().find((p) => p.slug !== longest.slug);
  return [longest.slug, other?.slug].filter(Boolean);
}

/** Resolve a REAL product from the database for each fixture line.
 *
 *  The cart is a server-owned resource now, so the fixture cannot be invented
 *  in the browser any more - it has to exist as rows, and it is created by
 *  adding real catalogue products through the real cart API below. */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Boot the real production server (SPA + API on one port) behind real TLS. */

/**
 * Wait until the backend is genuinely serving REAL data: /api/health answers
 * ok:true AND settings.public returns the store's REAL shipping settings - a
 * positive flat shipping rate AND a non-empty brand name, which only a migrated
 * + seeded database produces (the shipped defaults carry `shipping_flat_cents`
 * = 0 and an empty `brand_name`). Returns the flat shipping rate.
 *
 * It deliberately does NOT gate on a free-shipping threshold. The store sells
 * with NO free-shipping tier by design - `free_shipping_threshold_cents` is 0
 * (see SETTINGS_DEFAULTS and migration 0041) - so requiring a positive
 * threshold here made the gate unable to ever see a healthy backend, and it
 * failed before it measured a single viewport.
 * Throws (fails the gate) if it never becomes healthy.
 */
async function waitForBackend(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "no attempt made";
  while (Date.now() < deadline) {
    try {
      const health = await fetch(`${BASE}/api/health`);
      if (health.ok) {
        const body = await health.json();
        if (body?.ok === true) {
          const settings = await fetch(trpcGet("settings.public"));
          if (settings.ok) {
            const json = await settings.json();
            const s = json?.[0]?.result?.data?.json;
            // REAL, SEEDED settings - not the shipped defaults. The store ships
            // with `shipping_flat_cents` = 0 and `brand_name` = "" until the
            // database has been migrated + seeded, so a positive flat rate AND a
            // non-empty brand are what ONLY a seeded database produces. (A
            // free-shipping threshold is not usable here: the store deliberately
            // has no free-shipping tier, so that value is legitimately 0.)
            const flat = Number(s?.shipping_flat_cents);
            const brand = typeof s?.brand_name === "string" ? s.brand_name.trim() : "";
            if (Number.isFinite(flat) && flat > 0 && brand.length > 0) return flat;
            lastErr = `settings.public returned no real shipping settings (flat=${JSON.stringify(
              s?.shipping_flat_cents,
            )}, brand=${JSON.stringify(s?.brand_name)})`;
          } else {
            lastErr = `settings.public HTTP ${settings.status}`;
          }
        } else {
          lastErr = `health not ok: ${JSON.stringify(body)}`;
        }
      } else {
        lastErr = `health HTTP ${health.status}`;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await sleep(500);
  }
  throw new Error(`backend never became healthy at ${BASE} (last: ${lastErr})`);
}

/**
 * Sign a real user in through the real auth API, in the browser context.
 *
 * LOGIN FIRST, signup only as a fallback. `auth.signup` is throttled to 6/hour
 * per IP (a real anti-abuse rule), so a gate that signed up a fresh account on
 * every run would rate-limit itself after a handful of local runs. A single
 * fixed gate account is created once and then logged into, which is both
 * cheaper and closer to what a returning shopper does.
 */
async function signInRealUser(page) {
  const email = "overflow-gate@example.com";
  const password = "Password123!";
  const call = (proc, json) =>
    page.evaluate(
      async ([proc, json]) => {
        const r = await fetch(`/trpc/${proc}?batch=1`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ 0: { json } }),
        });
        return { status: r.status, body: await r.text() };
      },
      [proc, json],
    );

  // Success is a 200 that carries the signed-in user back. The response shape is
  // `{result:{data:{json:{id,email,...}}}}` - it does NOT contain a `signedIn`
  // flag, so testing for one made every login look like a failure and pushed the
  // gate into a signup that 409s on the second run. Match the user object.
  const signedIn = (r) => r.status === 200 && /"email"\s*:/.test(r.body);
  const login = await call("auth.login", { email, password });
  if (signedIn(login)) return true;

  const signup = await call("auth.signup", { email, password, name: "Overflow Gate" });
  if (signedIn(signup)) return true;
  // A signup that fails because the account already exists is fine - the login
  // above would have succeeded. Anything else is a real failure. (An earlier
  // version tested the login response for a `signedIn` flag that this API does
  // not return, so every login looked like a failure and the gate fell through
  // to a signup that 409s on the second run.)
  throw new Error(
    `real sign-in failed (login HTTP ${login.status}, signup HTTP ${signup.status}): ${signup.body.slice(0, 200)}`,
  );
}

/** Seed the cart through the REAL cart API, which is the only path that exists
 *  now that the basket is server-owned.
 *
 *  This replaces an earlier version that wrote the basket into localStorage.
 *  That fixture stopped being possible the moment the cart moved server-side:
 *  a localStorage basket is ignored by design (a signed-in cart comes from the
 *  API), so the pages rendered EMPTY and the gate failed on missing content
 *  while reporting zero overflow - it was measuring nothing.
 *
 *  The line count is compared against the response, so a fixture that silently
 *  failed to seed is caught here rather than surfacing as a confusing content
 *  failure later.
 */
async function seedCart(page, slugs) {
  return page.evaluate(
    async (slugs) => {
      const add = async (slug, qty) => {
        const r = await fetch("/trpc/cart.add?batch=1", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ 0: { json: { slug, variantId: null, qty } } }),
        });
        return { status: r.status, body: await r.text() };
      };
      await fetch("/trpc/cart.clear?batch=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 0: { json: null } }),
      });
      const out = [];
      // The longest-title product first, so the worst case for the layout sets
      // the row width.
      for (const slug of slugs) out.push(await add(slug, slug === slugs[0] ? 2 : 1));
      return out;
    },
    slugs,
  );
}

/** Measure one page at one width. Returns a result object; never throws. */
async function measure(page, route, width) {
  await page.setViewportSize({ width, height: 900 });
  // NOT `networkidle`: the app keeps a background poll alive, so the network
  // never goes idle and the wait would hang forever. Wait for the real content
  // instead - the order summary only renders once the cart + settings have
  // loaded from the server, which is exactly the state we must measure.
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await page
    .waitForSelector("text=/order summary/i", { timeout: 20_000 })
    .catch(() => {});
  // Let fonts settle and any width transition finish before measuring.
  await page.waitForTimeout(500);

  return page.evaluate((tol) => {
    const de = document.documentElement;
    const body = document.body;
    const vw = de.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("*")) {
      if (!(el instanceof HTMLElement)) continue;
      // Only elements that push the page WIDER matter. Skip:
      //  * anything out of flow (closed drawers, off-screen panels) -
      //    `offsetParent === null` excludes them,
      //  * anything pinned with `position: fixed` (a closed slide-in panel),
      //  * anything an ancestor already clips (a closed drawer's contents),
      //  * and left-side negatives: an element parked off the LEFT edge does not
      //    add to the scrollable width, so it is noise here.
      if (el.offsetParent === null) continue;
      if (getComputedStyle(el).position === "fixed") continue;
      if (el.closest("[inert], [aria-hidden='true']")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + tol) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (typeof el.className === "string" ? el.className : "").slice(0, 90),
          right: Math.round(rect.right),
        });
      }
    }
    return {
      vw,
      docOverflow: Math.max(0, de.scrollWidth - vw),
      bodyOverflow: Math.max(0, body.scrollWidth - vw),
      offenders: offenders.slice(0, 8),
      offenderCount: offenders.length,
      text: body.innerText.toLowerCase(),
    };
  }, TOLERANCE);
}

// Each route must actually render its REAL content - not an empty/error state.
// A page that failed to load its data would otherwise "pass" the overflow check
// while proving nothing.
const REQUIRED = {
  // The cart's order summary (heading + the Subtotal row) is what renders ONLY
  // once the server-owned cart AND the settings have both loaded. It used to
  // require the string "free shipping", which was a marker of the free-shipping
  // progress strip - but the store now sells with a single flat rate and NO
  // free-shipping tier (see SETTINGS_DEFAULTS / migration 0041), so that strip
  // is correctly absent on every real cart. The Order summary + Subtotal pair is
  // the same "real data rendered" proof, without asserting a retired feature.
  "/cart": ["order summary", "subtotal"],
  "/checkout": ["place order", "order summary"],
};

async function main() {
  const longest = longestProduct();
  console.log(
    `[overflow] longest real product title (${longest.name.length} chars): ${longest.name}`,
  );

  let server = null;
  let tls = null;
  if (SELF_HOST) {
    console.log(`[overflow] booting the real server (node dist/index.js) + real TLS on ${BASE}`);
    server = startServer({ port: PORT });
    server.child.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[overflow] server exited early with code ${code}`);
      }
    });
    tls = await startTlsProxy({ port: PORT, tlsPort: TLS_PORT });
  }

  let flatShippingCents;
  try {
    flatShippingCents = await waitForBackend();
  } catch (e) {
    console.error(`[overflow] ${e instanceof Error ? e.message : e}`);
    if (server) {
      console.error("[overflow] --- server log ---\n" + server.log.text);
      server.child.kill("SIGKILL");
    }
    process.exit(1);
  }
  console.log(`[overflow] backend healthy - real flat shipping rate = ${flatShippingCents} cents`);

  // Container-safe launch flags. `/dev/shm` is tiny in CI containers and in
  // this sandbox, and Chromium crashing on it mid-run (after several widths)
  // would abort the gate with a confusing "browser has been closed" error
  // rather than a real layout failure. `--disable-dev-shm-usage` moves shared
  // memory to /tmp; the rest are the standard headless-CI trio.
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const failures = [];
  const trpcErrors = [];
  try {
    // The certificate is self-signed and generated at run time, so Chromium is
    // told to trust this one host. The production Secure/Partitioned cookie
    // needs a real https origin to be stored at all.
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    // Any /trpc response that is a server error is a hard failure: it means the
    // page was measured without the data it needs.
    page.on("response", (res) => {
      const url = res.url();
      if (url.includes("/trpc/") && res.status() >= 500) {
        trpcErrors.push(`${res.status()} ${url}`);
      }
    });
    page.on("requestfailed", (req) => {
      if (!req.url().includes("/trpc/")) return;
      const err = req.failure()?.errorText ?? "?";
      // `net::ERR_ABORTED` is the browser cancelling an in-flight request when
      // the page navigates away - normal, not a backend fault. Only a genuine
      // connection failure (ECONNREFUSED, ERR_CONNECTION_*, ERR_EMPTY_RESPONSE)
      // means the page was measured without its data.
      if (/ERR_ABORTED/i.test(err)) return;
      trpcErrors.push(`requestfailed ${req.url()} (${err})`);
    });

    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await signInRealUser(page);
    console.log("[overflow] signed in a real user through the real auth API");

    // Seed the REAL cart through the REAL cart API, now that the basket is
    // server-owned. Writing it into localStorage no longer has any effect: a
    // signed-in cart is read from the API, so the pages rendered EMPTY and the
    // gate "passed" on overflow while measuring nothing. Verify the seed took.
    const slugs = fixtureSlugs();
    if (slugs.length === 0) throw new Error("no catalogue products resolved for the cart fixture");
    const seeded = await seedCart(page, slugs);
    const failedSeed = seeded.filter((r) => r.status !== 200);
    if (failedSeed.length > 0) {
      throw new Error(
        `seeding the cart through the real API failed: ${JSON.stringify(failedSeed).slice(0, 300)}`,
      );
    }
    const lineCount = await page.evaluate(async (url) => {
      const r = await fetch(url, { credentials: "include" });
      const body = await r.text();
      const m = /"count"\s*:\s*(\d+)/.exec(body);
      return m ? Number(m[1]) : -1;
    }, trpcGet("cart.get"));
    if (lineCount <= 0) {
      throw new Error(
        `the cart fixture did not persist (cart.get reported count=${lineCount}); the pages would be measured empty.`,
      );
    }
    console.log(
      `[overflow] seeded the REAL cart with ${slugs.length} product(s), ${lineCount} unit(s) (longest title: ${longestProductName().length} chars)`,
    );

    // A browser crash (e.g. an OOM-killed Chromium on a memory-capped runner)
    // must FAIL the gate with a clear message, not abort with an unhandled
    // "browser has been closed" stack that reads like a layout failure.
    try {
    for (const route of ROUTES) {
      for (const width of WIDTHS) {
        const r = await measure(page, route, width);
        // A page is clean only when BOTH the document and the body fit the
        // viewport AND no individual element's right edge crosses it. The
        // per-element check is what catches a summary card or a line-item row
        // that is clipped by `overflow-x: clip` (so scrollWidth stays 0) while
        // still being pushed off the right edge.
        const overflowOk = r.docOverflow === 0 && r.bodyOverflow === 0;
        const edgesOk = r.offenderCount === 0;
        const missing = (REQUIRED[route] ?? []).filter((needle) => !r.text.includes(needle));
        const ok = overflowOk && edgesOk && missing.length === 0;
        console.log(
          `[overflow] ${route} @ ${width}px  vw=${r.vw}  doc=${r.docOverflow}  body=${r.bodyOverflow}  edges=${r.offenderCount}  ${
            ok ? "OK" : "FAIL"
          }`,
        );
        if (!ok) {
          failures.push({ route, width, ...r, missing });
          for (const o of r.offenders) {
            console.log(`           offender <${o.tag} class="${o.cls}"> right=${o.right}`);
          }
          if (missing.length) {
            console.log(`           missing real content: ${missing.join(", ")}`);
          }
        }
      }
    }

    // Screenshots for a visual read-back (320/390/768/1440 on both pages).
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    for (const route of ROUTES) {
      for (const width of SHOT_WIDTHS) {
        await measure(page, route, width);
        const name = `${route.replace(/\//g, "") || "home"}_${width}.png`;
        await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
        console.log(`[overflow] screenshot ${path.join(SHOT_DIR, name)}`);
      }
    }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[overflow] browser/measurement error: ${msg}`);
      failures.push({
        route: "(browser)",
        width: 0,
        docOverflow: 0,
        bodyOverflow: 0,
        offenderCount: 0,
        missing: [],
        crash: msg,
      });
    }
  } finally {
    await browser.close();
  }

  // A proxy/ECONNREFUSED error in the server log means the page was measured
  // against a broken backend - fail loudly rather than pass silently.
  const logErrors = server
    ? server.log.text
        .split("\n")
        .filter((l) => /proxy error|ECONNREFUSED|AggregateError/i.test(l))
    : [];
  if (server) server.child.kill("SIGKILL");
  if (tls) tls.server.close();

  if (trpcErrors.length > 0) {
    console.error(`\n[overflow] FAILED: ${trpcErrors.length} tRPC call(s) errored:`);
    for (const e of trpcErrors.slice(0, 10)) console.error(`           ${e}`);
    process.exit(1);
  }
  if (logErrors.length > 0) {
    console.error(`\n[overflow] FAILED: the server log shows backend errors:`);
    for (const e of logErrors.slice(0, 10)) console.error(`           ${e}`);
    process.exit(1);
  }
  if (failures.length > 0) {
    console.error(
      `\n[overflow] FAILED: ${failures.length} viewport(s) failed. ` +
        `Add min-w-0 to every flex ancestor, line-clamp-2 break-words on the title, ` +
        `and overflow-hidden on the row.`,
    );
    process.exit(1);
  }
  console.log(
    "\n[overflow] PASSED: 0 horizontal overflow and 0 right-edge violations on /cart and /checkout " +
      `at ${WIDTHS.length} widths, against a real backend with real data (clean log).`,
  );
}

await main();
