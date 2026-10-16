#!/usr/bin/env node
/**
 * Search hardening + smart-matching gate.
 *
 * WHY THIS IS A GATE AND NOT A UNIT TEST. The unit tests pin the sanitizer as a
 * pure function. What a customer actually touches is the HTTP surface: a query
 * string arrives, is parsed by tRPC, validated, normalised, turned into SQL and
 * answered. That chain is where the real defects were - a non-empty query that
 * produced no filter clause answered with the WHOLE catalogue, and an over-long
 * field answered with a raw zod schema dump. Neither is visible from a unit test
 * of `sanitizeSearchTerm`, and both are trivially visible from here.
 *
 * IT DRIVES THE REAL SERVER. Every case is an HTTP request to a running
 * deployment; nothing is mocked and no expectation is derived from the code
 * under test.
 *
 * The tRPC link uses superjson, so a GET `input` must carry the superjson
 * envelope `{"json": <value>}`. Sending a bare `{search: "..."}` is mis-parsed
 * into `undefined` and the request runs UNFILTERED - which is exactly how a
 * probe can "prove" a vulnerability that is not there. This script always sends
 * the envelope, and one of its cases asserts that the unfiltered-catalogue
 * symptom is absent.
 *
 * Usage:
 *   node scripts/verify-search-security.mjs                     # boots the real server behind TLS
 *   BASE_URL=https://www.petparcel.store node scripts/verify-search-security.mjs   # against a live host
 */

// ── the server under test ──────────────────────────────────────────────────
// With no BASE_URL this boots the REAL production server (`node dist/index.js`)
// behind real TLS, using the same harness the other gates use, so the run is
// self-contained in CI. Given a BASE_URL it measures that host instead - which
// is how the same assertions are pointed at production. TLS is required because
// the production session cookie is `Secure`, and HSTS is only sent over HTTPS, so
// a plain-HTTP origin would silently test a different header set.
let BASE = (process.env.BASE_URL || process.env.BASE || "").replace(/\/$/, "");
let child = null;
let tlsServer = null;

if (!BASE) {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required (or pass BASE_URL to test a running host).");
    process.exit(1);
  }
  const { startServer, startTlsProxy, waitForHealth } = await import("./lib/real-server.mjs");
  const PORT = Number(process.env.SEARCH_GATE_PORT || 4399);
  const TLS_PORT = PORT + 1;

  const started = startServer({ port: PORT });
  child = started.child;
  // The self-signed certificate this harness generates is trusted for THIS
  // process only. `startServer` strips the opt-out from the child's environment,
  // so the app's own outbound TLS is never weakened by a test convenience.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  tlsServer = (await startTlsProxy({ port: PORT, tlsPort: TLS_PORT })).server;
  BASE = `https://127.0.0.1:${TLS_PORT}`;

  if (!(await waitForHealth(BASE))) {
    console.error("server did not become healthy:\n" + started.log.text.slice(-3000));
    child.kill();
    tlsServer.close();
    process.exit(1);
  }
  console.log(`[search-gate] booted the real server on ${BASE}\n`);
}

/**
 * Markers of something that must never reach a shopper's browser: a stack frame,
 * an internal path, a connection string, or the serialised zod issue list (which
 * describes our own schema - field names, limits, validator).
 *
 * DELIBERATELY NOT "SELECT ... FROM". A catalogue response is full of product
 * DESCRIPTION text, and real copy contains that phrase ("select high-quality
 * plastic ... from ..."). Treating it as a leak here made this gate fail on a
 * perfectly healthy payload. SQL text is therefore checked only inside an ERROR
 * envelope, where it would genuinely be a leak - see `ERROR_LEAK` below.
 */
const LEAK =
  /\bat Object\.|\bat \w+ \(\/|node_modules\/|\/workspace\/|pg_catalog|postgresql:\/\/|DATABASE_URL|"origin"\s*:|too_big|too_small|invalid_type|"path"\s*:\s*\[|SQLSTATE|Failed query/i;

/** SQL text and driver detail are a leak only when they appear in an ERROR. */
const ERROR_LEAK = /select\s+[\s\S]+\s+from|insert into|update\s+"|delete from|params:|drizzle|ECONNREFUSED/i;

/** Reflected markup - a query echoed into the response as live HTML. */
const REFLECTED = /<script>|<img\s+src=x|onerror=/i;

const catalogueUrl = (search, extra = {}) =>
  `${BASE}/trpc/catalog.list?input=${encodeURIComponent(
    JSON.stringify({ json: { search, ...extra } }),
  )}`;

/** The product names a response returned, or null when the shape was unexpected. */
function productNames(payload) {
  const json = payload?.result?.data?.json;
  if (!Array.isArray(json)) return null;
  return json.map((p) => (typeof p === "string" ? p : p?.name)).filter(Boolean);
}

/**
 * Each case: a label, the raw query, and a predicate over the number of products
 * returned. The predicates encode the BEHAVIOUR we promise a shopper:
 *
 *   - a real query narrows (it does not return the catalogue);
 *   - a query that cannot match anything returns NOTHING, never everything;
 *   - a hostile query is answered safely and never reflected.
 */
const CASES = [
  {
    label: "real multi-word query narrows and leads with the match",
    query: "Canvas Fish Pond",
    expect: (names) => names.length > 0 && names.length < 10 && /canvas fish pond/i.test(names[0]),
  },
  {
    label: "word order does not matter (smart multi-word matching)",
    query: "bed dog large",
    expect: (names) => names.length > 0 && names.length < 40,
  },
  {
    label: "punctuation is a separator, not a literal",
    query: "126.8 Gal",
    expect: (names, ctx) => names.length > 0 && ctx.matchedSome,
  },
  {
    label: "two-character size query still matches",
    query: "XL",
    expect: (names) => names.length > 0,
  },

  // ── injection / wildcard ─────────────────────────────────────────────────
  {
    label: "SQL metacharacters are inert",
    query: "'; DROP TABLE products;--",
    expect: (names) => names.length === 0,
  },
  {
    label: "SQL boolean injection cannot widen the result set",
    // Real tokens here are ["dog", "or"] - "or" is an ordinary two-character word
    // that legitimately appears in many names, so a few results are correct. What
    // matters is that the result is NARROWED (not the whole catalogue) and that
    // no SQL ran: the `'` and `--` were escaped as literals, not executed.
    query: "dog' OR 1=1--",
    expect: (names) => names.length > 0 && names.length < 98,
  },
  {
    label: "LIKE wildcard %%%% matches nothing (not everything)",
    query: "%%%%",
    expect: (names) => names.length === 0,
  },
  {
    label: "inline % is a LITERAL: 50% narrows instead of matching all 98",
    // Before the escaping fix this matched the ENTIRE catalogue. The `%` is now a
    // literal, so the query reduces to the digits "50", which some real names
    // contain (650nm, 9900). The property that was broken is that it matched
    // everything; the assertion is that it NARROWED.
    query: "50%",
    expect: (names) => names.length > 0 && names.length < 98,
  },
  {
    label: "LIKE underscore _____ matches nothing (not everything)",
    query: "_____",
    expect: (names) => names.length === 0,
  },
  {
    label: "mixed one-character wildcard tokens select nothing",
    query: "a%b",
    expect: (names) => names.length === 0,
  },
  {
    label: "a one-character query is not treated as 'match everything'",
    query: "S",
    expect: (names) => names.length === 0,
  },
  {
    label: "punctuation-only query returns the clean empty state",
    query: "!@#$%^&*()",
    expect: (names) => names.length === 0,
  },

  // ── reflected markup ─────────────────────────────────────────────────────
  {
    label: "script tag is not reflected and matches nothing",
    query: "<script>alert(1)</script>",
    expect: (names) => names.length === 0,
  },
  {
    label: "img/onerror payload is not reflected",
    query: "<img src=x onerror=alert(1)>",
    expect: (names) => names.length === 0,
  },
  {
    label: "CRLF in the query cannot inject a header or match",
    query: "dog\r\nX-Injected: yes",
    expect: (names) => names.length === 0,
  },

  // ── awkward but legitimate input ─────────────────────────────────────────
  { label: "over-long query is refused gracefully", query: "A".repeat(5000), expect: () => true, allow400: true },
  { label: "unicode and emoji are handled", query: "犬 ☕ ✨ éèê", expect: () => true },
  { label: "null byte in the query is handled", query: "dog\u0000bed", expect: () => true },
];

let failures = 0;
let checked = 0;

for (const testCase of CASES) {
  const res = await fetch(catalogueUrl(testCase.query));
  const raw = await res.text();
  checked++;

  let payload = null;
  let parseError = null;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    parseError = err.message;
  }

  const names = productNames(payload);
  const tRPCError = Boolean(payload?.error);
  const isRefusal = res.status === 400;

  // A leak is a structural marker anywhere, OR SQL/stack text inside an error
  // envelope. Product descriptions are DATA and are never scanned for SQL.
  const leak = LEAK.test(raw) || (tRPCError && ERROR_LEAK.test(raw));
  const reflected = REFLECTED.test(raw);
  // A refusal carries no result list; that is correct, not "unusable".
  const unusable = res.status >= 500 || parseError !== null || (!isRefusal && names === null);

  // A 400 is legitimate ONLY when the refusal is graceful: a short human sentence
  // with no schema dump, no stack and no SQL.
  const graceful400 =
    !isRefusal || (/check the details|try again|went wrong|too long/i.test(raw) && !LEAK.test(raw));

  // "This cannot match" must be an EMPTY list, never the unfiltered catalogue.
  // Asserted on every case that returns results: a term that cannot discriminate
  // must not answer with all 98 products.
  const notUnfiltered = names === null || names.length < 98 || names.length === 0;

  const semantic = names === null ? isRefusal : testCase.expect(names, { matchedSome: names.length > 0 });

  const pass =
    !unusable && !leak && !reflected && graceful400 && notUnfiltered && semantic &&
    // A refusal is expected only where the case permits one.
    (testCase.allow400 || !isRefusal);
  if (!pass) failures++;

  console.log(
    `${pass ? "PASS" : "FAIL"}  http=${String(res.status).padEnd(4)} results=${String(names?.length ?? "-").padEnd(4)} ` +
      `leak=${leak} reflected=${reflected}  ${testCase.label}`,
  );
  if (parseError) console.log(`        parse error: ${parseError} | body: ${raw.slice(0, 180)}`);
  if (leak) console.log(`        LEAK markers present: ${raw.slice(0, 220)}`);
  if (names !== null && !semantic) console.log(`        returned ${names.length} names; first = ${names[0] ?? "(none)"}`);
  if (!graceful400) console.log(`        refusal was not graceful: ${raw.slice(0, 220)}`);
  if (!notUnfiltered) console.log("        returned the UNFILTERED catalogue for a term that cannot match");
}

// ── headers ────────────────────────────────────────────────────────────────
const headerRes = await fetch(`${BASE}/api/health`);
const required = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
];
for (const name of required) {
  const value = headerRes.headers.get(name);
  checked++;
  const ok = Boolean(value);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  header ${name} = ${value ? value.slice(0, 72) : "(MISSING)"}`);
}
{
  // HSTS is only sent over HTTPS, so on a plain-HTTP local server its ABSENCE is
  // correct and is asserted as such rather than counted as a failure.
  const hsts = headerRes.headers.get("strict-transport-security");
  const isHttps = BASE.startsWith("https://");
  checked++;
  const ok = isHttps ? Boolean(hsts) : hsts === null;
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  header strict-transport-security = ${hsts ?? "(absent - correct on http)"}`,
  );
}

console.log(
  failures === 0
    ? `\nSEARCH SECURITY + HEADERS: ALL PASSED (${checked} checks)`
    : `\nSEARCH SECURITY + HEADERS: ${failures} of ${checked} FAILED`,
);

// Never leave a spawned server or listener behind: a leaked child would hold the
// port and make the NEXT run fail to bind.
child?.kill();
tlsServer?.close();

process.exit(failures === 0 ? 0 : 1);
