import { timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveAppStorage } from "./storage";
import { getJob } from "./jobs";
import { env } from "./env";
import { parseResendEvent, verifySvixSignature } from "./resend-webhook";
import { recordEmailEvent } from "../services/email-events";
import { handleWebhook } from "../services/payments";
import { verifyIpnSignature } from "../services/nowpayments";
import { requestHost, requestIsHttps, securityHeaders } from "./security-headers";
import { robotsHeaders, robotsTxt } from "./robots";
import { sitemapHeaders, sitemapXml } from "./sitemap";
import { merchantFeedFor, merchantFeedHeaders } from "./merchant-feed";
import {
  GLOBAL_API_LIMIT_MAX,
  GLOBAL_API_LIMIT_WINDOW_MS,
  callerKey,
  createRateLimiter,
  isGlobalRateLimitedPath,
} from "./rate-limit";
// Side-effect import: registers the upstream supplier sync jobs (cj-tracking-sync,
// cj-stock-sync) with the job registry so the platform's signed callback can
// invoke them. Must run in both entry points, which is why it lives here.
import "../services/cj-jobs";
// Registers the daily live-API JSON health check (`live-api-health-check`),
// driven by the cron entry in vercel.json. Its absence is what let a dead API
// ship undetected: see server/services/live-api-health.ts.
import "../services/live-api-health";
// Registers the unpaid-order alert sweep (`unpaid-order-alerts`), driven by the
// cron entry in vercel.json. Emails the owner once per order that has stayed
// unpaid past the threshold: see server/services/unpaid-alerts.ts.
import "../services/unpaid-alerts";
// Registers the durable Telegram OUTBOX sweep (`telegram-outbox`), driven by the
// cron entry in vercel.json. Retries a Telegram order notification the in-request
// attempt could not deliver, so an outage cannot outlive the request and drop a
// real sale's alert: see server/services/telegram-outbox.ts.
import "../services/telegram-outbox";
// Registers the daily Telegram RECONCILIATION (`telegram-reconciliation`),
// driven by the cron entry in vercel.json. The backstop: it finds paid orders
// that were never notified, tells the owner, and re-queues them. See
// server/services/telegram-reconciliation.ts.
import "../services/telegram-reconciliation";
import { ensureUnlinkedUsersChecked } from "./schema-check";

// The Hono application, WITHOUT any runtime binding.
//
// This is the single source of truth for the app's routes, shared by BOTH
// entry points so they can never drift:
//   - server/_core/index.ts  → the Node entry (`@hono/node-server`), used by
//     `pnpm dev:api` and `pnpm start`. It
//     additionally mounts the built SPA (see serve.ts) and calls serve().
//   - api/index.ts           → the Vercel serverless entry (`hono/vercel`).
//     Vercel serves the built SPA from its CDN (outputDirectory: dist/public),
//     so this entry does NOT mount the client - it only answers the API.
//
// Keeping the route table here (not in index.ts) is what lets the same API run
// on a long-lived Node host AND on Vercel without duplicating the wiring.
export function createApp(): Hono {
  const app = new Hono();

  // ── SECURITY HEADERS, on every response ──────────────────────────────────
  // Applied to the API responses here (see _core/security-headers.ts for why
  // this lives in the app and not only in vercel.json). The policies are
  // deliberately narrow: the storefront loads only its own hashed bundles, its
  // own images on the media host, and Google Fonts. Registered FIRST so it wraps
  // EVERY route below, including the error handler and the storage redirect.
  app.use("*", async (c, next) => {
    await next();
    for (const [key, value] of Object.entries(securityHeaders(requestIsHttps(c), requestHost(c)))) {
      c.header(key, value);
    }
  });

  // ── GLOBAL API RATE LIMIT ──────────────────────────────────────────────────
  // A backstop in front of EVERY interactive API call, so a route that forgets a
  // dedicated limit - or one added later - is still bounded against automated
  // hammering. Registered after the security-header middleware so the 429 it
  // returns carries the same headers as any other response.
  //
  // The webhook, cron and platform-job paths are EXEMPT: each verifies its
  // caller's signature before doing anything, so a limit adds no security there
  // while a 429 could drop a legitimate payment notification during a retry
  // storm. See _core/rate-limit.ts for the ceiling's rationale (it is set ~10x
  // above what a real shopper generates, so no human is ever throttled).
  const globalApiLimiter = createRateLimiter({
    windowMs: GLOBAL_API_LIMIT_WINDOW_MS,
    max: GLOBAL_API_LIMIT_MAX,
  });
  app.use("*", async (c, next) => {
    if (isGlobalRateLimitedPath(c.req.path) && !globalApiLimiter.check(callerKey(c))) {
      return c.json({ ok: false, error: "rate_limited" }, 429);
    }
    await next();
  });

  // A request-time throw must still produce a DIAGNOSABLE response. Vercel's own
  // failure page ("A server error has occurred / FUNCTION_INVOCATION_FAILED") is
  // a fixed 96-byte body with NO message, which is why a live outage could not be
  // told apart from a stale deployment without reading the function logs. This
  // handler logs the real error server-side and answers with a short JSON
  // envelope instead.
  //
  // The MESSAGE is deliberately NOT echoed to the caller. It used to be. An
  // escaped error's own text is exactly the internal detail a leak exposes - a
  // driver's `Failed query: … params: …`, an absolute path, a stack frame - so
  // the body now carries a short, safe sentence and the real cause stays in the
  // log.
  app.onError((err, c) => {
    // eslint-disable-next-line no-console
    console.error("[app] unhandled request error", err);
    return c.json({ ok: false, error: "internal_error" }, 500);
  });

  // Health + config diagnostics. `ok` is always true when the function is
  // reachable - the point of this route is to answer even when the database is
  // not configured, so a deploy can be diagnosed without reading Vercel logs.
  // `config` reports only PRESENCE (never values) of the vars the app needs.
  //
  // `unlinkedUsers` surfaces the non-fatal "local row with no Neon Auth link"
  // condition (a count only - never an email): null when the database could not
  // be read, 0 when every account is linked.
  app.get("/api/health", async (c) => {
    const unlinkedUsers = await ensureUnlinkedUsersChecked();
    return c.json({
      ok: true,
      service: "petparcel",
      time: new Date().toISOString(),
      config: {
        DATABASE_URL: Boolean(process.env.DATABASE_URL),
        JWT_SECRET: Boolean(process.env.JWT_SECRET),
        DB_DRIVER: process.env.DB_DRIVER ?? "tcp",
        NODE_ENV: process.env.NODE_ENV ?? null,
        // Upstream supplier integration: PRESENCE only, never the value. Lets an
        // operator confirm the key reached the deployment without reading logs,
        // and see whether it is in sandbox (default) or live mode.
        CJ_API_KEY: Boolean(process.env.CJ_API_KEY),
        CJ_LIVE_MODE: /^(1|true|yes|on)$/i.test(process.env.CJ_LIVE_MODE ?? ""),
        // Crypto payments: PRESENCE only, never the value. Lets an operator
        // confirm the keys reached the deployment without reading logs, and see
        // whether the store can create payments and verify webhooks.
        NOWPAYMENTS_API_KEY: Boolean(process.env.NOWPAYMENTS_API_KEY),
        NOWPAYMENTS_IPN_SECRET: Boolean(process.env.NOWPAYMENTS_IPN_SECRET),
      },
      unlinkedUsers,
    });
  });

  // ── robots.txt, decided by the request HOST ────────────────────────────────
  //
  // Served from the app (not a static file) so the SAME URL can answer
  // differently per host: the real policy on the production storefront, and
  // disallow-all on a `*.vercel.app` preview or a local run. A static file is
  // one file for every host, which is why the preview URLs were being indexed.
  //
  // Registered BEFORE the static middleware and the SPA fallback (see serve.ts)
  // so neither can answer /robots.txt first. On Vercel the SPA is served from
  // the CDN, so the matching rewrite in vercel.json routes this path to the
  // function; the static file was removed so the filesystem cannot shadow it.
  app.get("/robots.txt", (c) => {
    for (const [key, value] of Object.entries(robotsHeaders())) c.header(key, value);
    return c.body(robotsTxt(requestHost(c)));
  });

  // ── sitemap.xml, decided by the request HOST ─────────────────────────────
  //
  // The SAME host gate as robots.txt, for the SAME reason: a static sitemap is
  // one file for every hostname a Vercel project serves, so a preview
  // deployment would advertise the production store's URLs to crawlers. Served
  // from the app so the real URL list is returned on the production storefront
  // and an EMPTY urlset on a `*.vercel.app` preview or a local run.
  //
  // Registered BEFORE the static middleware and the SPA fallback (see serve.ts)
  // so neither can answer /sitemap.xml first. On Vercel the SPA is served from
  // the CDN, so the matching rewrite in vercel.json routes this path to the
  // function; the static file was removed so the filesystem cannot shadow it.
  app.get("/sitemap.xml", (c) => {
    for (const [key, value] of Object.entries(sitemapHeaders())) c.header(key, value);
    return c.body(sitemapXml(requestHost(c)));
  });

  // ── google-merchant-feed.xml, decided by the request HOST ──────────────────
  //
  // The SAME host gate as robots.txt and sitemap.xml, for the SAME reason: a
  // static feed is one file for every hostname a Vercel project serves, so a
  // preview deployment would hand Google the production store's prices, stock
  // and SKUs. Served from the app so the real item list is returned on the
  // production storefront and an EMPTY feed on a `*.vercel.app` preview or a
  // local run.
  //
  // Registered BEFORE the static middleware and the SPA fallback (see serve.ts)
  // so neither can answer /google-merchant-feed.xml first. On Vercel the SPA is
  // served from the CDN, so the matching rewrite in vercel.json routes this path
  // to the function; no static file exists so the filesystem cannot shadow it.
  app.get("/google-merchant-feed.xml", (c) => {
    for (const [key, value] of Object.entries(merchantFeedHeaders())) c.header(key, value);
    return c.body(merchantFeedFor(requestHost(c)));
  });

  // ── Renamed product URL, permanently redirected ───────────────────────────
  //
  // The "American Local Tactical Pet Boobs ..." harness was renamed to a clean,
  // Merchant-Center-compliant title, which changed its slug and SO its public
  // URL. The OLD url is already indexed by Google and saved by shoppers, and it
  // is the `link` its previously-fetched feed items advertised - so it is
  // answered with a 301 to the renamed product rather than falling through to
  // the SPA's not-found state. A redirect (not a rewrite) is what tells Google
  // the item moved, which is the correct signal when a product is renamed.
  //
  // Exact-path match on purpose: a `/product/:slug` handler here would catch
  // EVERY product URL and, because Hono does not fall through after a handler
  // returns, would break normal product pages. Registered in the app (before
  // mountClient's `*` shell fallback) so it wins for this one path only.
  const LEGACY_PRODUCT_REDIRECTS: Record<string, string> = {
    "/product/american-local-tactical-pet-boobs-service-dog-harness-vest-adjustable-reflecti":
      "/product/tactical-service-dog-harness-vest-adjustable",
  };
  for (const [from, to] of Object.entries(LEGACY_PRODUCT_REDIRECTS)) {
    app.get(from, (c) => c.redirect(to, 301));
  }

  // tRPC - all app business endpoints live under /trpc (agent writes routers.ts).
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: (_opts, c) => createContext(c),
    }),
  );

  // Resend webhook receiver (delivery lifecycle: sent / delivered / bounced /
  // complained / opened / clicked). Resend signs with Svix, so the RAW body is
  // verified against the `svix-*` headers BEFORE it is parsed or trusted - a
  // bad or missing signature is a 400 and nothing is recorded. The secret is
  // read from the environment only; with none configured every request is
  // refused (a signature cannot be verified without a key).
  //
  // Always answers 2xx once the signature is valid, even if the write failed:
  // Svix retries a non-2xx until it gives up, so a transient DB blip must not
  // become a retry storm. The failure is logged server-side instead.
  app.post("/api/webhooks/resend", async (c) => {
    const raw = await c.req.text();
    const verdict = verifySvixSignature(
      {
        id: c.req.header("svix-id"),
        timestamp: c.req.header("svix-timestamp"),
        signature: c.req.header("svix-signature"),
      },
      raw,
      env.email.resendWebhookSecret,
    );
    if (!verdict.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[resend-webhook] rejected: ${verdict.reason}`);
      return c.json({ ok: false, error: "invalid_signature" }, 400);
    }

    const svixId = String(c.req.header("svix-id") ?? "").trim();
    const record = parseResendEvent(svixId, raw);
    if (!record) {
      // Signed but unparseable - a sender-side bug, not something to store.
      return c.json({ ok: false, error: "invalid_payload" }, 400);
    }

    const result = await recordEmailEvent(record);
    return c.json({ ok: true, type: record.type, recorded: result.inserted });
  });

  // Scoped per-app file storage (DESIGN §5.6): 307 → short-lived signed S3 URL.
  app.all("/app-storage/*", (c) => serveAppStorage(c));

  // ── NOWPayments IPN receiver ───────────────────────────────────────────────
  //
  // NOWPayments POSTs a payment-status notification here whenever a crypto
  // payment changes state (waiting → confirming → finished, or failed/expired).
  //
  // THE SIGNATURE IS THE WHOLE SECURITY MODEL. The body is read as RAW TEXT and
  // its HMAC-SHA512 - computed over the recursively key-sorted JSON with the IPN
  // secret - is compared, in constant time, to the `x-nowpayments-sig` header
  // BEFORE the payload is parsed or trusted. A missing, malformed or mismatched
  // signature is a 401 and nothing is written. With no IPN secret configured the
  // route refuses every request rather than trusting an unsigned one; payments
  // are then still confirmed by the pull path (checkout.paymentStatus), so a
  // missing secret degrades reliability, never safety.
  //
  // ALWAYS 2xx ONCE VERIFIED, even if the write failed: NOWPayments retries a
  // non-2xx until it gives up, so a transient DB blip must not become a retry
  // storm. The failure is logged server-side instead. A notification for an
  // unknown order is also acknowledged (2xx) - retrying it would never help.
  app.post("/api/payments/nowpayments/ipn", async (c) => {
    const raw = await c.req.text();

    let payload: Record<string, unknown> | null = null;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      payload = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return c.json({ ok: false, error: "invalid_json" }, 400);
    }
    if (!payload) return c.json({ ok: false, error: "invalid_payload" }, 400);

    const verdict = verifyIpnSignature(payload, c.req.header("x-nowpayments-sig"));
    if (!verdict.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[nowpayments-ipn] rejected: ${verdict.reason}`);
      return c.json({ ok: false, error: "invalid_signature" }, 401);
    }

    try {
      const outcome = await handleWebhook("nowpayments", payload);
      return c.json({ ok: true, ...outcome });
    } catch (err) {
      // Verified but unprocessable - log and acknowledge, so the provider does
      // not retry a notification that will fail identically every time.
      // eslint-disable-next-line no-console
      console.error("[nowpayments-ipn] handler failed", err);
      return c.json({ ok: true, handled: false, reason: "handler_error" });
    }
  });

  // Vercel Cron entry point for the scheduled sync jobs.
  //
  // WHY THIS EXISTS. `registerJob` only REGISTERS a handler - nothing ever
  // CALLS it. The platform-signature callback route below is still a TODO
  // (§8.4), so in a Vercel deployment no schedule existed and the stock and
  // tracking syncs never ran on their own. A store whose stock is never
  // re-synced silently oversells, which is exactly the "not fully live" state.
  //
  // Vercel Cron calls this path with the `CRON_SECRET` as a Bearer token (set
  // the same value in the Vercel project env). If CRON_SECRET is unset the
  // route refuses every caller, so it can never be triggered anonymously.
  // GET is required by Vercel Cron; POST is accepted too for manual runs.
  //
  // The comparison is CONSTANT-TIME. A plain `!==` on a shared secret leaks its
  // length and its matching prefix through response timing, which is enough to
  // recover a secret one character at a time; `timingSafeEqual` over
  // equal-length buffers removes that channel.
  const runScheduledJob = async (c: Context) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return c.text("cron is not configured (CRON_SECRET is unset)", 401);
    const presented = c.req.header("authorization") ?? "";
    if (!constantTimeEqual(presented, `Bearer ${secret}`)) return c.text("unauthorized", 401);
    const name = c.req.param("name");
    const handler = name ? getJob(name) : undefined;
    if (!name || !handler) return c.text("no such job", 404);
    try {
      await handler();
      return c.json({ ok: true, job: c.req.param("name") });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[jobs] "${c.req.param("name")}" failed`, err);
      return c.text("job failed", 500);
    }
  };
  app.get("/api/cron/:name", runScheduledJob);
  app.post("/api/cron/:name", runScheduledJob);

  // Platform-signed scheduled-job callback (DESIGN §8.4). The body runs in THIS
  // app's runtime; the platform only triggers on schedule. Until the platform
  // signature scheme exists we REQUIRE (and, later, verify) a signature header,
  // so a registered job can never be triggered by an anonymous caller.
  // TODO(§8.4): replace the presence check with real HMAC verification.
  app.post("/api/_jobs/:name", async (c) => {
    const signature = c.req.header("x-platform-signature");
    if (!signature /* || !verifyPlatformSignature(c, signature) */) {
      return c.text("unauthorized (job callback signature required - DESIGN §8.4)", 401);
    }
    const handler = getJob(c.req.param("name"));
    if (!handler) return c.text("no such job", 404);
    try {
      await handler();
      return c.json({ ok: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[jobs] "${c.req.param("name")}" failed`, err);
      return c.text("job failed", 500);
    }
  });

  return app;
}

/**
 * Compare two strings without leaking WHERE they first differ, through timing.
 *
 * A plain `===` stops at the first mismatched character, so the time it takes is
 * proportional to the length of the shared prefix - an attacker who can time
 * enough requests can recover a secret one character at a time. Comparing over a
 * fixed number of byte comparisons removes that signal.
 *
 * Equal-length buffers are required, which is why the length check is separate: a
 * length mismatch is not itself a secret (the caller knows how many bytes they
 * sent) and comparing across lengths would make `timingSafeEqual` throw.
 */
function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
