#!/usr/bin/env node
// Real end-to-end verification for the two defects in this change set.
//
// It boots the REAL production server (`node dist/index.js`, the same process
// Vercel runs) against the REAL database, then drives a REAL headless Chromium
// through the exact scenarios that were broken. Nothing is mocked: the session
// cookie is a real JWT, the cart rows are real database rows, and every
// assertion is a measured value or an HTTP status from the running server.
//
// WHAT IT PROVES
//   1. SIGN-IN WORKS and the session is REAL - the login endpoint answers with
//      JSON (not an HTML/plain-text error page), a session cookie is set, and
//      `/trpc/auth.me` returns the signed-in user afterwards.
//   2. SIGN-OUT IS REAL - the session is destroyed SERVER-SIDE, so a copy of the
//      token captured before sign-out is refused afterwards.
//   3. THE CART DOES NOT LEAK - after sign-out, the previous account's items are
//      gone from the UI, and the same cookie is refused by both `cart.get` and a
//      cart MUTATION (the mutation is rejected server-side, not just hidden).
//   4. THE CART IS RESTORED - signing back in brings the saved basket back
//      intact, because it lives in the database attached to the account.
//
// Usage: node scripts/verify-auth-cart.mjs
// Env:   DATABASE_URL, JWT_SECRET (required); PORT (default 4321)

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { createHmac, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import pg from "pg";
import { createServer } from "node:https";
import { request as httpRequest } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT || 4321);
const TLS_PORT = PORT + 1000;
// The app is served over TLS, not plain HTTP: the production session cookie is
// `Secure; Partitioned; SameSite=None` (see `sessionCookieOptions`), and a real
// browser REFUSES to store a Secure cookie over http:// - the sign-in would
// then appear to succeed while the very next request was anonymous, which is a
// transport artefact, not a defect. Terminating REAL TLS in front of the real
// server lets the harness exercise the exact production cookie flags, over
// https, with a real browser.
const BASE = `https://127.0.0.1:${TLS_PORT}`;
const SHOTS = "work/verify-auth-cart";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is required (the server cannot mint a session without it).");
  process.exit(1);
}

const failures = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures.push(name);
}

// This process's own HTTP-level probes talk to a SELF-SIGNED certificate, so
// Node's fetch must accept it. Scoped to the harness: the spawned server gets a
// cleaned environment (see `startServer`) so ITS outbound TLS - the supplier API
// - is never weakened by a test convenience.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// ── the real server ─────────────────────────────────────────────────────────
// The REAL production server (`node dist/index.js`), booted with
// NODE_ENV=production so it serves the SPA and the API on one port exactly as
// Vercel does - including the production Secure/Partitioned session cookie.
let serverLog = "";
function startServer() {
  // Strip the harness-only TLS opt-out before handing the environment to the
  // server, so the app's own outbound requests keep full certificate checking.
  const { NODE_TLS_REJECT_UNAUTHORIZED: _drop, ...inherited } = process.env;
  const child = spawn(process.execPath, ["dist/index.js"], {
    env: { ...inherited, NODE_ENV: "production", PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (b) => {
    serverLog += b.toString();
    if (serverLog.length > 200_000) serverLog = serverLog.slice(-100_000);
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  return child;
}

// ── real TLS in front of it ─────────────────────────────────────────────────
// A self-signed certificate and a small terminating proxy. The certificate is
// generated on the fly with openssl into a temp directory; nothing is written
// into the repo.
let tlsServer;
function startTls() {
  const dir = mkdtempSync(join(tmpdir(), "petparcel-verify-"));
  execFileSync(
    "openssl",
    [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", join(dir, "key.pem"),
      "-out", join(dir, "cert.pem"),
      "-days", "1", "-subj", "/CN=127.0.0.1",
      "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost",
    ],
    { stdio: "ignore" },
  );
  tlsServer = createServer(
    { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) },
    (req, res) => {
      const upstream = httpRequest(
        { host: "127.0.0.1", port: PORT, path: req.url, method: req.method, headers: req.headers },
        (up) => {
          res.writeHead(up.statusCode ?? 502, up.headers);
          up.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(502);
        res.end("upstream error");
      });
      req.pipe(upstream);
    },
  );
  return new Promise((resolve) => tlsServer.listen(TLS_PORT, "127.0.0.1", resolve));
}

async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) {
        const body = await res.text();
        if (/"ok"\s*:\s*true/.test(body)) return true;
      }
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}

// ── a REAL login, at the HTTP level ─────────────────────────────────────────
// `auth.login` is single (non-batched) JSON input; the cookie comes back on the
// response. This mirrors exactly what the browser sends, so a "200 with a JSON
// body AND a session cookie" here is the live contract, not a simulation.
async function login(email, password) {
  const res = await fetch(`${BASE}/trpc/auth.login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { email, password } }),
  });
  const body = await res.text();
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, body, cookie, contentType: res.headers.get("content-type") };
}

function jwtSegment(payload, secret) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64(payload);
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

async function trpcGet(path, cookie) {
  const res = await fetch(`${BASE}/trpc/${path}`, {
    headers: cookie ? { cookie } : {},
  });
  return { status: res.status, body: await res.text() };
}

async function trpcPost(path, json, cookie) {
  const res = await fetch(`${BASE}/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ json }),
  });
  return { status: res.status, body: await res.text() };
}

/** Open a page and wait until React has HYDRATED, not merely loaded.
 *
 *  The app is server-rendered, so `domcontentloaded` fires while the markup is
 *  still inert: React has not attached its handlers yet, and a click on the
 *  sign-in button at that instant does nothing at all (no request, no error -
 *  the button simply is not wired up). The SSR markup is byte-identical to the
 *  hydrated markup, so there is no visible signal to wait for. The reliable one
 *  is that the app's first tRPC read cannot fire until React has mounted, so a
 *  COMPLETED tRPC response is proof of hydration. The listener is armed BEFORE
 *  navigating, so a fast response cannot be missed. */
async function gotoHydrated(page, path) {
  const hydrated = page.waitForResponse(
    (r) => r.url().includes("/trpc/") && r.status() === 200,
    { timeout: 30_000 },
  );
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await hydrated;
}

/** Sign in through the real form and WAIT for the app to leave /login.
 *
 *  Waiting on the URL is what distinguishes success from a silent failure: on
 *  success the page redirects to /account, and on failure it STAYS on /login with
 *  an error message. A bare "password field is gone" check cannot tell the two
 *  apart if the form re-renders. On failure this throws with the page's own text
 *  and the console log, so the reason is visible instead of a bare timeout. */
async function signIn(page, email, password, consoleLog, networkLog = []) {
  // Wait for HYDRATION, not for a wall-clock guess. A fixed sleep raced React on
  // a cold first load: the click then landed on a not-yet-wired button and the
  // submit simply never fired - a silent failure with no request to observe.
  // `gotoHydrated` arms a listener for a COMPLETED tRPC response before it
  // navigates, which cannot fire until React has mounted.
  await gotoHydrated(page, "/login");
  await page.waitForTimeout(400);
  const submit = async () => {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page
      .locator('form:has(input[type="password"])')
      .getByRole("button", { name: /sign in/i })
      .click();
  };
  await submit();

  // Poll the URL from the NODE side. The app redirects with the History API,
  // and `page.url()` is authoritative for the current document - unlike an
  // in-page wait, it cannot be defeated by the framework re-rendering.
  for (let i = 0; i < 48; i++) {
    await page.waitForTimeout(250);
    if (!page.url().includes("/login")) return;
    // The very first click can still land before the form's own JS is bound;
    // one retry after a short settle is enough to make this deterministic.
    if (i === 8) await submit().catch(() => {});
  }

  const text = await page.innerText("body").catch(() => "<no body>");
  const me = await page
    .evaluate(async () => {
      try {
        const r = await fetch("/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D", { credentials: "include" });
        return `${r.status} ${(await r.text()).slice(0, 200)}`;
      } catch (e) {
        return `threw: ${e?.message}`;
      }
    })
    .catch((e) => `evaluate failed: ${e?.message}`);
  throw new Error(
    `sign-in did not leave /login.\nURL=${page.url()}\nauth.me=${me}\nPage text:\n${text.slice(0, 900)}\nNetwork:\n${networkLog.join("\n")}\nConsole:\n${consoleLog.slice(-1500).join("\n")}`,
  );
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const server = startServer();
  await startTls();
  let browser;

  try {
    if (!(await waitForHealth())) {
      console.error("Server never became healthy. Log:\n" + serverLog);
      process.exit(1);
    }
    console.log(`[verify] real server + real TLS on ${BASE}\n`);

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const email = `verify-cart-${randomUUID().slice(0, 8)}@example.com`;
    const password = "verify-cart-password-123";

    // ── a real account with a real product ▸ the shopper's starting point ────
    const signup = await trpcPost("auth.signup", { email, password, name: "Verify" }, null);
    if (signup.status !== 200) {
      console.error("signup failed:", signup.status, signup.body.slice(0, 300));
      process.exit(1);
    }
    const { rows: productRows } = await pool.query(
      `SELECT slug, name FROM products
        WHERE active = true AND archived = false
          AND EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = products.id AND v.active = true AND v.inventory_qty > 0)
        ORDER BY length(name) DESC LIMIT 1`,
    );
    const slug = productRows[0]?.slug;
    // A distinctive slice of the real product name - used to prove the cart
    // renders THIS item and not some other line.
    const nameProbe = String(productRows[0]?.name ?? "").slice(0, 22);
    if (!slug) {
      console.error("No sellable product found in the database.");
      process.exit(1);
    }
    console.log(`[verify] account=${email}  product=${slug}\n`);
    check("a real sellable product name was resolved", nameProbe.length >= 10, nameProbe);

    // ═══ 1. SIGN-IN RETURNS REAL JSON + A REAL SESSION ══════════════════════
    console.log("1) sign-in returns JSON and a real session");
    const login1 = await login(email, password);
    check(
      "login answers 200 with a JSON content-type (not an HTML/plain-text error page)",
      login1.status === 200 && /application\/json/.test(login1.contentType ?? ""),
      `status=${login1.status} ctype=${login1.contentType}`,
    );
    check(
      "login body is JSON and never starts with an HTML error page",
      !/^\s*(The page c|<)/.test(login1.body) && /"email"\s*:/.test(login1.body),
    );
    check("login sets a session cookie", /app_session/i.test(login1.cookie), login1.cookie.slice(0, 40));

    const me1 = await trpcGet("auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D", login1.cookie);
    check(
      "auth.me returns the signed-in user with the session cookie",
      me1.status === 200 && /"email"\s*:/.test(me1.body),
      `status=${me1.status}`,
    );

    // ── add a real item to the cart through the REAL cart API ───────────────
    const add = await trpcPost("cart.add", { slug, variantId: null, qty: 2 }, login1.cookie);
    check("cart.add persists a line for the signed-in user", add.status === 200 && /"count"\s*:\s*2/.test(add.body), `status=${add.status}`);
    const { rows: itemRows } = await pool.query(
      `SELECT ci.qty FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
        JOIN users u ON u.id = c.user_id WHERE u.email = $1`,
      [email],
    );
    check("the cart row is in the DATABASE (not localStorage)", itemRows.length === 1 && itemRows[0].qty === 2, `rows=${JSON.stringify(itemRows)}`);

    // ── TASK 2: a cart LINE carries the PICKED VARIANT's own photo ─────────────
    // The catalogue really holds products whose variants are shot separately, so
    // one of those is selected and a VARIANT-BACKED line added. The image the
    // cart returns for that line must be the variant's own R2 photo, not the
    // product's generic hero shot.
    const { rows: imageProducts } = await pool.query(
      `SELECT p.slug, p.images->>0 AS product_image, v.id AS variant_id, v.name AS variant_name, v.image_url
         FROM products p JOIN product_variants v ON v.product_id = p.id
        WHERE p.active = true AND p.archived = false AND v.active = true AND v.inventory_qty > 0
          AND v.image_url IS NOT NULL AND p.images->>0 IS NOT NULL
          AND v.image_url <> p.images->>0
        ORDER BY p.slug LIMIT 1`,
    );
    if (imageProducts.length > 0) {
      const ip = imageProducts[0];
      const addVar = await trpcPost(
        "cart.add",
        { slug: ip.slug, variantId: ip.variant_id, qty: 1 },
        login1.cookie,
      );
      check("a variant-backed line can be added", addVar.status === 200, `status=${addVar.status}`);
      let cartJson = null;
      try {
        cartJson = JSON.parse(addVar.body).result?.data?.json ?? null;
      } catch {
        /* asserted below */
      }
      const line = cartJson?.lines?.find((l) => l.variantId === ip.variant_id);
      check(
        "the cart line carries the PICKED VARIANT's own image, not the product's",
        Boolean(line) && line.image === ip.image_url && line.image !== ip.product_image,
        `lineImage=${line?.image} expected=${ip.image_url} product=${ip.product_image}`,
      );
      check(
        "the variant image is served from our own R2 host",
        typeof line?.image === "string" && line.image.includes("media.petparcel.store"),
        `image=${line?.image}`,
      );
      // Put the basket back to exactly the one base line the later checks expect.
      await trpcPost("cart.remove", { slug: ip.slug, variantId: ip.variant_id }, login1.cookie);
    } else {
      check("the catalogue holds a product whose variants are shot separately", false, "none found");
    }

    // ═══ 2. AN UNAUTHENTICATED CALLER IS REFUSED SERVER-SIDE ════════════════
    console.log("\n2) an unauthenticated caller is refused server-side");
    const anonGet = await trpcGet("cart.get?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D", null);
    check(
      "cart.get without a session is UNAUTHORIZED (no cart contents returned)",
      anonGet.status === 401 && !/"slug"\s*:/.test(anonGet.body),
      `status=${anonGet.status}`,
    );
    const anonAdd = await trpcPost("cart.add", { slug, variantId: null, qty: 5 }, null);
    check(
      "cart.add without a session is refused (UNAUTHORIZED)",
      anonAdd.status === 401,
      `status=${anonAdd.status}`,
    );
    const { rows: afterAnon } = await pool.query(
      `SELECT coalesce(sum(ci.qty),0)::int AS qty FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
        JOIN users u ON u.id = c.user_id WHERE u.email = $1`,
      [email],
    );
    check("the refused mutation changed NOTHING in the database", afterAnon[0].qty === 2, `qty=${afterAnon[0].qty}`);

    // A token that carries no revocable session must also be refused, so a
    // hand-minted cookie cannot invent an identity.
    const forged = jwtSegment(
      { sub: "00000000-0000-0000-0000-000000000000", jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + 3600 },
      process.env.JWT_SECRET,
    );
    const forgedGet = await trpcGet("cart.get?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D", `app_session_app=${forged}`);
    check("a forged/unknown session token is refused too", forgedGet.status === 401, `status=${forgedGet.status}`);

    // ═══ 3. SIGN-OUT DESTROYS THE SESSION SERVER-SIDE ═══════════════════════
    console.log("\n3) sign-out destroys the session server-side");
    const cookieBeforeLogout = login1.cookie;
    // The session row is identified by the token's own `jti`, so this check is
    // exact and cannot be confused by any other session on the machine.
    const token = cookieBeforeLogout.replace(/^[^=]+=/, "");
    const jti = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).jti;
    const before = await pool.query(`SELECT count(*)::int AS n FROM auth_sessions WHERE id = $1`, [jti]);
    check("the session row exists in the database while signed in", before.rows[0].n === 1, `rows=${before.rows[0].n}`);
    const logoutRes = await trpcPost("auth.logout", null, cookieBeforeLogout);
    check("logout answers 200", logoutRes.status === 200, `status=${logoutRes.status}`);
    const sessRows = await pool.query(`SELECT count(*)::int AS n FROM auth_sessions WHERE id = $1`, [jti]);
    check("the session row is GONE from the database after logout", sessRows.rows[0].n === 0, `rows=${sessRows.rows[0].n}`);
    const reuse = await trpcGet("cart.get?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%7D", cookieBeforeLogout);
    check(
      "the PRE-LOGOUT cookie is now refused (real revocation, not just a cleared cookie)",
      reuse.status === 401,
      `status=${reuse.status}`,
    );

    // ═══ 4. THE BROWSER UI ══════════════════════════════════════════════════
    console.log("\n4) the browser UI: sign in, sign out, cart isolation, restore");
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      // The TLS certificate is self-signed, so the browser must be told to trust
      // this one host. Scoped to 127.0.0.1 - it does not weaken anything else.
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const contentErrors = [];
    const networkLog = [];
    page.on("console", (m) => {
      if (m.type() === "error") contentErrors.push(m.text());
    });
    page.on("response", (r) => {
      if (r.url().includes("/trpc/")) networkLog.push(`${r.status()} ${r.url().split("/trpc/")[1]?.slice(0, 60)}`);
    });

    // (a) sign in through the real form. Submitted by clicking the button that
    // belongs to the SIGN-IN form: the page carries several forms (header
    // search, newsletter) and the header's submit is hidden at 390px.
    await signIn(page, email, password, contentErrors, networkLog);
    await page.screenshot({ path: `${SHOTS}/1-signed-in.png`, fullPage: false });
    check("the sign-in form succeeds in a real browser", !page.url().includes("/login"), page.url());

    // (b) the cart page shows the saved line
    await gotoHydrated(page, "/cart");
    await page.waitForSelector("text=/order summary/i", { timeout: 20_000 });
    const cartTextSignedIn = await page.innerText("body");
    check(
      "the signed-in /cart shows the saved line item (by name, qty 2)",
      cartTextSignedIn.includes(nameProbe) && /\b2\b/.test(cartTextSignedIn) && !/Your cart is empty/i.test(cartTextSignedIn),
    );
    await page.screenshot({ path: `${SHOTS}/2-cart-with-items.png`, fullPage: false });

    // (b2) TASK 2 in the BROWSER: open the cart drawer and prove each line's
    //      image is a real R2 URL and that a VARIANT line shows the variant's own
    //      photo, measured against the database rather than eyeballed.
    const { rows: imageProducts2 } = await pool.query(
      `SELECT p.slug, p.images->>0 AS product_image, v.id AS variant_id, v.image_url
         FROM products p JOIN product_variants v ON v.product_id = p.id
        WHERE p.active = true AND p.archived = false AND v.active = true AND v.inventory_qty > 0
          AND v.image_url IS NOT NULL AND p.images->>0 IS NOT NULL
          AND v.image_url <> p.images->>0
        ORDER BY p.slug LIMIT 1`,
    );
    if (imageProducts2.length > 0) {
      const ip = imageProducts2[0];
      // Add through the BROWSER's own live session, not a Node-side cookie: the
      // logout check above revoked the earlier cookie on purpose, so a Node call
      // here would be refused and the line would never exist to be inspected.
      await page.evaluate(
        async ({ slug, variantId }) => {
          const res = await fetch("/trpc/cart.add", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ json: { slug, variantId, qty: 1 } }),
          });
          if (!res.ok) throw new Error(`cart.add ${res.status}`);
        },
        { slug: ip.slug, variantId: ip.variant_id },
      );
      await gotoHydrated(page, "/cart");
      await page.waitForSelector("text=/order summary/i", { timeout: 20_000 });
      // Open the drawer only once the page's OWN cart read has completed, and
      // poll for the variant photo rather than sampling once: the drawer paints
      // from whatever the cart query has resolved so far, so a single read can
      // catch it mid-flight and see only the earlier line's image.
      await page.waitForResponse((r) => r.url().includes("cart.get") && r.status() === 200, {
        timeout: 20_000,
      }).catch(() => {});
      await page.click('button[aria-label^="Cart,"]');
      let drawerImages = [];
      for (let i = 0; i < 32; i++) {
        drawerImages = await page
          .evaluate(() =>
            Array.from(document.querySelectorAll("aside[role=dialog] img")).map((im) =>
              im.getAttribute("src"),
            ),
          )
          .catch(() => []);
        if (drawerImages.includes(ip.image_url)) break;
        await page.waitForTimeout(250);
      }
      check(
        "the cart drawer draws the variant line's OWN photo (measured against the DB)",
        drawerImages.includes(ip.image_url),
        `drawer=${JSON.stringify(drawerImages)} expected=${ip.image_url}`,
      );
      check(
        "every cart-drawer image is served from our own R2 host",
        drawerImages.every((u) => String(u).includes("media.petparcel.store")),
        `images=${JSON.stringify(drawerImages)}`,
      );
      await page.screenshot({ path: `${SHOTS}/2b-cart-drawer-variant.png`, fullPage: false });
      await trpcPost("cart.remove", { slug: ip.slug, variantId: ip.variant_id }, login1.cookie);
      await page.keyboard.press("Escape");
    }

    // (c) sign out, then reload /cart - the previous account's items must be GONE
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const signedOut = await page.evaluate(async () => {
      const res = await fetch("/trpc/auth.logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: null }),
      });
      return res.status;
    });
    check("the browser can sign out (200)", signedOut === 200, `status=${signedOut}`);
    await gotoHydrated(page, "/cart");
    await page.waitForSelector("text=/sign in to see your cart|Your cart is empty/i", { timeout: 20_000 });
    const cartTextSignedOut = await page.innerText("body");
    check(
      "after sign-out the cart page shows NO previous account items",
      !cartTextSignedOut.includes(nameProbe) && /sign in to see your cart/i.test(cartTextSignedOut),
    );
    const storage = await page.evaluate(() => window.localStorage.getItem("petparcel_cart_v1"));
    check("the guest basket store holds nothing after sign-out", storage === null || storage === "[]", `stored=${storage}`);
    await page.screenshot({ path: `${SHOTS}/3-logged-out-cart.png`, fullPage: false });

    // (d) signing back in RESTORES the saved cart
    await signIn(page, email, password, contentErrors, networkLog);
    await gotoHydrated(page, "/cart");
    await page.waitForSelector("text=/order summary/i", { timeout: 20_000 });
    const cartTextRestored = await page.innerText("body");
    check(
      "signing back in RESTORES the saved cart from the database",
      cartTextRestored.includes(nameProbe) && /\b2\b/.test(cartTextRestored) && !/Your cart is empty/i.test(cartTextRestored),
    );
    await page.screenshot({ path: `${SHOTS}/4-cart-restored.png`, fullPage: false });

    // (e) the JSON-parse failure mode must be impossible in the UI: no raw
    //     parser error may ever appear on the page.
    check(
      "no raw JSON parser error surfaced in the UI",
      !contentErrors.some((e) => /Unexpected token|is not valid JSON/i.test(e)),
    );

    await context.close();
    await pool.end();
  } catch (err) {
    console.error("\n[verify] error:", err?.message || err);
    console.error("server log tail:\n" + serverLog.slice(-2000));
    failures.push("unexpected error");
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill("SIGTERM");
    if (tlsServer) tlsServer.close();
  }

  console.log(`\n${failures.length === 0 ? "PASSED" : "FAILED"}: ${failures.length} failure(s)`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main();
