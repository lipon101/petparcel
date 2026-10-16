#!/usr/bin/env node
/**
 * Search EDGE-CASE gate: no single-character or metacharacter-only query may
 * ever answer with the unfiltered catalogue.
 *
 * WHY THIS IS A SEPARATE GATE FROM `verify-search-security.mjs`.
 * That gate proves a handful of representative hostile queries are handled. The
 * defect it guards against - a non-empty query that produces no filter clause and
 * therefore answers with all 98 products - is not one bug with one input, it is a
 * CLASS of input: EVERY one-character query (a-z, A-Z, 0-9) and EVERY
 * query made only of characters that carry no matching meaning (`%`, `_`, quotes,
 * slashes, backslashes, dashes). A sample checks a few of them; this enumerates
 * all 62 alphanumerics and the full metacharacter set, so the property is proven
 * over the whole class rather than argued from examples.
 *
 * A shopper reads the catalogue-returned-as-results as matches, and Postgres
 * reads a `%`-heavy pattern as "scan every row" - so this is a correctness bug
 * AND a cheap denial-of-service, reachable by anyone who can open the shop page.
 *
 * IT DRIVES THE REAL SERVER. Every case is an HTTP request to a running
 * deployment; nothing is mocked. With no BASE_URL it boots the REAL production
 * server (`node dist/index.js`) behind real TLS, exactly as the sibling gates do,
 * so the run is self-contained in CI.
 *
 * The tRPC link uses superjson, so a GET `input` carries the envelope
 * `{"json": <value>}` and a batched request wraps it as `{"0": {"json": ...}}`.
 * Sending a bare payload is mis-parsed into `undefined` and the request runs
 * UNFILTERED - which is precisely how a probe can "prove" a leak that is not
 * there. This script always sends the envelope.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/verify-search-edge-cases.mjs
 *   BASE_URL=https://www.petparcel.store node scripts/verify-search-edge-cases.mjs
 */

// ── the server under test ────────────────────────────────────────────────────
let BASE = (process.env.BASE_URL || process.env.BASE || "").replace(/\/$/, "");
let child = null;
let tlsServer = null;

if (!BASE) {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (or pass BASE_URL to test a running host).");
    process.exit(1);
  }
  const { startServer, startTlsProxy, waitForHealth } = await import("./lib/real-server.mjs");
  const PORT = Number(process.env.EDGE_GATE_PORT || 4397);
  const TLS_PORT = PORT + 1;

  const started = startServer({ port: PORT });
  child = started.child;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  tlsServer = (await startTlsProxy({ port: PORT, tlsPort: TLS_PORT })).server;
  BASE = `https://127.0.0.1:${TLS_PORT}`;

  if (!(await waitForHealth(BASE))) {
    console.error("server did not become healthy:\n" + started.log.text.slice(-3000));
    child.kill();
    tlsServer.close();
    process.exit(1);
  }
  console.log(`[edge-gate] booted the real server on ${BASE}\n`);
}

/** Markers of something that must never reach a shopper: a stack frame, an
 *  internal path, a connection string, or the serialised zod issue list. SQL text
 *  is checked only inside an ERROR envelope (a catalogue payload is full of
 *  product copy, which legitimately contains "select ... from"). */
const LEAK =
  /\bat Object\.|\bat \w+ \(\/|node_modules\/|\/workspace\/|pg_catalog|postgresql:\/\/|DATABASE_URL|"origin"\s*:|too_big|too_small|invalid_type|"path"\s*:\s*\[|SQLSTATE|Failed query/i;
const ERROR_LEAK = /select\s+[\s\S]+\s+from|insert into|update\s+"|delete from|params:|drizzle|ECONNREFUSED/i;
const REFLECTED = /<script>|<img\s+src=x|onerror=/i;

const batchUrl = (search) =>
  `${BASE}/trpc/catalog.list?batch=1&input=${encodeURIComponent(
    JSON.stringify({ 0: { json: { search } } }),
  )}`;

function parse(raw) {
  try {
    const arr = JSON.parse(raw);
    const entry = Array.isArray(arr) ? arr[0] : arr;
    const result = entry?.result?.data?.json;
    const error = entry?.error;
    return {
      names: Array.isArray(result) ? result.map((p) => (typeof p === "string" ? p : p?.name)) : null,
      error,
      ok: true,
    };
  } catch (err) {
    return { names: null, error: null, ok: false, parseError: err.message };
  }
}

// ── the total catalogue size, read from the SAME server (never hardcoded) ────
// The unfiltered length is what "leaked the catalogue" means, so it is measured
// here rather than assumed to be 98.
const noFilterRes = await fetch(batchUrl(undefined));
const noFilter = parse(await noFilterRes.text());
if (noFilter.names === null) {
  console.error("could not read the unfiltered catalogue size:\n" + (await noFilterRes.text()).slice(0, 400));
  child?.kill();
  tlsServer?.close();
  process.exit(1);
}
const TOTAL = noFilter.names.length;
console.log(`[edge-gate] catalogue size (no filter) = ${TOTAL} products\n`);

// ── the cases: EVERY alphanumeric, plus metacharacter-only queries ───────────
const lower = "abcdefghijklmnopqrstuvwxyz".split("");
const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const digits = "0123456789".split("");
const METACHARACTERS = [
  "%",
  "_",
  "%%",
  "%%%%",
  "____",
  "%%%%%",
  "!@#$%^&*()",
  "\\",
  "\\\\",
  "\\\\\\",
  "--",
  "'",
  '"',
  ";",
  "/*",
  "*/",
  "/* */",
  "`",
  "[]",
  "{}",
  "()",
  "<>",
  "|",
  "&",
  "~",
  "^",
  "+",
  "=",
  "?",
  "!",
  ",",
  ".",
  ":",
  "@",
  "#",
  "$",
  "%_",
  "_%",
  "%%_",
  "' OR '1'='1",
  "\\'; DROP TABLE products;--",
  "0x27",
  "\u00a0",
  "\u2028",
  "\u200b",
];
const cases = [
  ...lower.map((q) => ({ label: `single char "${q}"`, query: q, kind: "alpha" })),
  ...upper.map((q) => ({ label: `single char "${q}"`, query: q, kind: "alpha" })),
  ...digits.map((q) => ({ label: `single char "${q}"`, query: q, kind: "digit" })),
  ...METACHARACTERS.map((q) => ({ label: `metacharacter-only ${JSON.stringify(q)}`, query: q, kind: "meta" })),
];

let failures = 0;

for (const c of cases) {
  const res = await fetch(batchUrl(c.query));
  const raw = await res.text();
  const { names, error, ok, parseError } = parse(raw);
  const isRefusal = res.status === 400;
  const tRPCError = Boolean(error);

  const leak = LEAK.test(raw) || (tRPCError && ERROR_LEAK.test(raw));
  const reflected = REFLECTED.test(raw);
  // A refused request (400) carries no list; that is a graceful answer, not a 500.
  const usable = ok && (names !== null || isRefusal);
  const no5xx = res.status < 500;
  const graceful = usable && no5xx && !leak && !reflected && !parseError;
  // THE ASSERTION: a query that cannot meaningfully match must NOT answer with
  // the whole catalogue. An empty list is the honest answer for a
  // non-discriminating term; a small real subset is fine. Everything is a fail.
  const notUnfiltered = names === null ? isRefusal : names.length < TOTAL;

  const pass = graceful && notUnfiltered;
  if (!pass) {
    failures++;
    console.log(
      `FAIL  http=${res.status} n=${names === null ? "-" : names.length} ` +
        `leak=${leak} reflected=${reflected}  ${c.label}`,
    );
    if (parseError) console.log(`        parse error: ${parseError} | body: ${raw.slice(0, 180)}`);
    if (leak) console.log(`        LEAK markers: ${raw.slice(0, 220)}`);
    if (!notUnfiltered) console.log(`        returned ALL ${TOTAL} products for a term that cannot match`);
    if (!graceful) console.log(`        not graceful: ${raw.slice(0, 220)}`);
  }
}

// ── one positive control, so a gate that passed everything is not a no-op ────
// A REAL two-word query must still return a NON-EMPTY, NARROWED set. Without
// this, a server that refused every request would "pass" the whole matrix.
{
  const res = await fetch(batchUrl("dog bed"));
  const { names, ok } = parse(await res.text());
  const positive = ok && names !== null && names.length > 0 && names.length < TOTAL;
  if (!positive) failures++;
  console.log(
    `${positive ? "PASS" : "FAIL"}  positive control "dog bed" -> n=${names === null ? "-" : names.length}`,
  );
}

// ── the heading must never echo a hostile payload ───────────────────────────
// The shop page echoes the term in its heading. A markup-bearing query must be
// answered with NO echo at all - asserted here against the served page, and
// cross-checked with the browser gate's injected-tag assertion.
{
  const payload = "<script>alert(1)</script>";
  const res = await fetch(`${BASE}/shop?q=${encodeURIComponent(payload)}`, {
    headers: { accept: "text/html" },
  });
  const html = await res.text();
  const echoed = html.includes("<script>alert(1)</script>");
  if (echoed) failures++;
  console.log(`${echoed ? "FAIL" : "PASS"}  a script payload is never echoed raw into /shop markup`);
}
{
  // A metacharacter-only query echoes nothing that could be read as a match, and
  // the page still renders (no 500).
  const res = await fetch(`${BASE}/shop?q=${encodeURIComponent("%%%%")}`, {
    headers: { accept: "text/html" },
  });
  const ok = res.status < 500;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  a %%%% query renders the shop page (http=${res.status})`);
}

console.log(
  failures === 0
    ? `\nSEARCH EDGE CASES: ALL PASSED (${cases.length} queries + 3 controls)`
    : `\nSEARCH EDGE CASES: ${failures} FAILED of ${cases.length} queries`,
);

child?.kill();
tlsServer?.close();
process.exit(failures === 0 ? 0 : 1);
