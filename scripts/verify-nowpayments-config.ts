// Verify the store's NOWPayments configuration - end to end, against the REAL
// provider and (optionally) a real deployment.
//
// This exists because "the env var is set" is NOT the same as "payments work".
// The failure modes it catches, none of which a boolean presence check sees:
//
//   * a key that is present but WRONG (a typo, a key from another account, a
//     key that was rotated) - caught by actually authenticating against the
//     provider's own API;
//   * a key from the SANDBOX environment used in production, or vice versa;
//   * an IPN secret that is set on one side only, so webhooks are refused;
//   * an IPN callback URL that is malformed, points at the wrong host, or is
//     not actually routed (the single most common cause of an order that stays
//     "awaiting payment" forever);
//   * env vars that are set LOCALLY but never reached the deployment - caught
//     by reading the deployment's own /api/health.
//
// Run:
//   pnpm verify:nowpayments                       # local env only
//   pnpm verify:nowpayments --url https://www.petparcel.store
//   LIVE_API_URL=https://... pnpm verify:nowpayments
//
// Exit code: 0 when every check passes, 1 otherwise - so CI can gate on it.
//
// The API key is never printed. Only its first four characters appear, so an
// operator can tell WHICH key is deployed without the value leaking into a log.

import { createHmac } from "node:crypto";
import {
  getApiStatus,
  getBalance,
  getCurrencies,
  nowPaymentsConfig,
  NOWPAYMENTS_DEFAULT_BASE,
} from "../server/services/nowpayments";
import { siteOrigin } from "../server/_core/site-url";

type Status = "pass" | "fail" | "warn" | "skip";

interface Check {
  label: string;
  status: Status;
  detail: string;
  /** What to do about it, printed only when the check did not pass. */
  fix?: string;
}

const results: Check[] = [];
function record(check: Check): void {
  results.push(check);
}

/** A masked key: enough to identify it, never enough to use it. */
function maskKey(key: string): string {
  const k = String(key ?? "").trim();
  if (!k) return "(empty)";
  if (k.length <= 6) return `${k.slice(0, 2)}…(${k.length} chars)`;
  return `${k.slice(0, 4)}…(${k.length} chars)`;
}

function parseArgs(argv: string[]): { url: string | null; ipnUrl: string | null; help: boolean } {
  let url: string | null = process.env.LIVE_API_URL ? process.env.LIVE_API_URL : null;
  let ipnUrl: string | null = process.env.NOWPAYMENTS_IPN_URL ? process.env.NOWPAYMENTS_IPN_URL : null;
  let help = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--url" || arg === "-u") url = argv[++i] ?? null;
    else if (arg.startsWith("--url=")) url = arg.slice("--url=".length);
    else if (arg === "--ipn-url") ipnUrl = argv[++i] ?? null;
    else if (arg.startsWith("--ipn-url=")) ipnUrl = arg.slice("--ipn-url=".length);
  }
  return {
    url: url ? url.replace(/\/+$/, "") : null,
    ipnUrl: ipnUrl ? ipnUrl.trim() : null,
    help,
  };
}

const HELP = `
NOWPayments configuration verifier

Usage:
  pnpm verify:nowpayments [--url <origin>] [--ipn-url <full-url>]

Options:
  --url <origin>     Also verify a DEPLOYED origin: reads its /api/health to
                     confirm the keys reached the deployment, and proves its
                     IPN callback route is live and rejecting unsigned calls.
                     Defaults to $LIVE_API_URL when set.
  --ipn-url <url>    Probe an EXACT IPN callback URL (overrides the one derived
                     from --url). Its path must be exactly
                     /api/payments/nowpayments/ipn. Defaults to
                     $NOWPAYMENTS_IPN_URL when set.
  -h, --help         Show this message.

Reads NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET from the environment.
Exits 1 when any check fails.
`.trim();

// ── 1. environment presence ──────────────────────────────────────────────────

function checkEnv(): { apiKey: string; ipnSecret: string } {
  const { apiKey, ipnSecret, baseUrl, payCurrency } = nowPaymentsConfig();

  record(
    apiKey
      ? {
          label: "NOWPAYMENTS_API_KEY is set",
          status: "pass",
          detail: maskKey(apiKey),
        }
      : {
          label: "NOWPAYMENTS_API_KEY is set",
          status: "fail",
          detail: "not set - the store cannot create invoices",
          fix: "Add NOWPAYMENTS_API_KEY in Vercel (Settings → Environment Variables) and redeploy. Generate it at account.nowpayments.io → Account → API keys.",
        },
  );

  record(
    ipnSecret
      ? {
          label: "NOWPAYMENTS_IPN_SECRET is set",
          status: "pass",
          detail: maskKey(ipnSecret),
        }
      : {
          label: "NOWPAYMENTS_IPN_SECRET is set",
          status: "fail",
          detail: "not set - every webhook is refused, so orders only settle via the pull path",
          fix: "Generate the IPN secret at Store settings → Payments → IPN, add it as NOWPAYMENTS_IPN_SECRET in Vercel, and redeploy.",
        },
  );

  // A non-default base is legitimate ONLY for a test stub. On a real deployment
  // it silently sends production traffic to a fake gateway, so it is a warning
  // worth shouting about.
  const usingDefault = baseUrl === NOWPAYMENTS_DEFAULT_BASE;
  record(
    usingDefault
      ? { label: "API base is production", status: "pass", detail: NOWPAYMENTS_DEFAULT_BASE }
      : {
          label: "API base is production",
          status: "warn",
          detail: `NOWPAYMENTS_API_BASE overrides the real host → ${baseUrl}`,
          fix: "Unset NOWPAYMENTS_API_BASE unless you are pointing at a test stub. A live store must use https://api.nowpayments.io/v1.",
        },
  );

  record({
    label: "Pay currency",
    status: "pass",
    detail: payCurrency
      ? `pinned to "${payCurrency}" - only that coin will be offered`
      : "not pinned - the shopper chooses any supported coin on the hosted invoice",
  });

  return { apiKey, ipnSecret };
}

// ── 2. does the key actually authenticate? ───────────────────────────────────

async function checkApiKey(apiKey: string): Promise<void> {
  if (!apiKey) {
    record({
      label: "API key authenticates with NOWPayments",
      status: "skip",
      detail: "skipped - no API key to test",
    });
    return;
  }

  // /status is the documented availability probe.
  try {
    const status = await getApiStatus();
    record({
      label: "NOWPayments API is reachable",
      status: "pass",
      detail: status.message ? `provider says: ${status.message}` : "provider answered",
    });
  } catch (e) {
    record({
      label: "NOWPayments API is reachable",
      status: "fail",
      detail: `could not reach the provider: ${(e as Error).message}`,
      fix: "Check outbound network access / DNS from this environment. If the deployment has the same problem, its egress may be blocked.",
    });
    return;
  }

  // /balance is AUTHENTICATED: it is refused with 403 INVALID_API_KEY for a
  // missing or wrong key, so a 200 here is proof the key is real. (Do NOT use
  // /currencies for this - it is a PUBLIC endpoint that answers 200 with no key
  // at all, so it would pass a garbage key. That is exactly the false positive
  // this check exists to avoid.)
  try {
    await getBalance();
    record({
      label: "API key authenticates with NOWPayments",
      status: "pass",
      detail: "accepted by the authenticated /balance endpoint - the key is valid",
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const status = Number(err.status ?? 0);
    const isAuth = status === 401 || status === 403;
    record({
      label: "API key authenticates with NOWPayments",
      status: "fail",
      detail: isAuth
        ? `the provider REJECTED the key (HTTP ${status}): ${err.message ?? "unauthorized"}`
        : `could not verify the key: ${err.message ?? String(e)}`,
      fix: isAuth
        ? "The key is present but not valid. Regenerate it at account.nowpayments.io → Account → API keys, replace NOWPAYMENTS_API_KEY in Vercel, and redeploy. Also check you are not using a key from a different account or environment."
        : "This may be a transient provider problem. Re-run; if it persists, verify the key in the NOWPayments dashboard.",
    });
    return;
  }

  // Informational: what the account can accept. Public data, so it is reported
  // for context only and never gates the result.
  try {
    const currencies = await getCurrencies();
    const list = Array.isArray(currencies.currencies) ? currencies.currencies : [];
    record({
      label: "Coins available on this account",
      status: "pass",
      detail: list.length ? `${list.length} coin(s) offered` : "the provider reported no coins",
    });
  } catch {
    // Public and non-essential - its failure must never fail the run.
  }
}

// ── 3. the IPN callback URL ──────────────────────────────────────────────────

interface IpnProbe {
  ok: boolean;
  status: number;
  detail: string;
}

/** A well-formed but WRONG signature: HMAC-SHA512 of the body under a secret
 *  that is not the store's. It has the exact 128-hex shape the route expects, so
 *  a route that only checked the SHAPE would accept it. A 401 here is therefore
 *  proof the HMAC comparison is actually running against the real secret - which
 *  an unsigned probe alone cannot show, because a route that refuses everything
 *  also answers 401 to an empty body. */
function forgedSignature(body: string): string {
  return createHmac("sha512", "not-the-store-ipn-secret").update(body).digest("hex");
}

/** POST a body at the IPN route and classify the answer. A correctly wired route
 *  answers 400 (unparseable) or 401 (signature refused) - NEVER 404/405, which
 *  would mean nothing is routed there, and never a 5xx, which would mean it
 *  crashed.
 *
 *  A 200 is classified as NOT ok. Both callers probe with a body the route must
 *  refuse (unsigned, or signed under a different secret), so accepting it proves
 *  the signature is not enforced - the very failure this script exists to catch. */
async function postIpn(ipnUrl: string, body: string, signature?: string): Promise<IpnProbe> {
  try {
    const res = await fetch(ipnUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature ? { "x-nowpayments-sig": signature } : {}),
      },
      body,
      signal: AbortSignal.timeout(20_000),
      // NEVER follow a redirect here. This is the whole point of the check: the
      // apex host 308-redirects to www, and a redirect on a POST is not
      // transparent - the body may be dropped or the method rewritten to GET, so
      // the callback never reaches the route and a REAL payment never settles.
      // With the default `follow`, fetch would silently chase the redirect, the
      // probe would see the destination's 401, and the check would report PASS
      // for a URL that cannot actually deliver a webhook.
      redirect: "manual",
    });
    const text = (await res.text()).slice(0, 160);
    if (res.status >= 300 && res.status < 400) {
      const to = res.headers.get("location") ?? "(no location)";
      return {
        ok: false,
        status: res.status,
        detail:
          `HTTP ${res.status} REDIRECT to ${to} - a redirect on POST can drop the body or ` +
          `rewrite it to GET, so the callback never reaches the route`,
      };
    }
    if (res.status === 401 && /invalid_signature/i.test(text)) {
      return { ok: true, status: res.status, detail: "route is live and refused the callback" };
    }
    if (res.status === 400) {
      return { ok: true, status: res.status, detail: "route is live (rejected the body as expected)" };
    }
    if (res.status === 200) {
      // A 2xx means the route ACCEPTED the callback. For BOTH probes below that
      // is a FAILURE - the body sent is unsigned, or signed with a secret that is
      // not the store's, so a correctly configured route must never accept it.
      // Classifying it as ok would have reported PASS while the store happily
      // accepted forged webhooks, which is the exact opposite of the point.
      return {
        ok: false,
        status: res.status,
        detail: "route is live, but it ACCEPTED the callback - the IPN secret is NOT being enforced",
      };
    }
    if (res.status === 404 || res.status === 405) {
      return {
        ok: false,
        status: res.status,
        detail: `HTTP ${res.status} - nothing is routed at this path`,
      };
    }
    if (res.status >= 500) {
      return { ok: false, status: res.status, detail: `HTTP ${res.status} - the route crashed` };
    }
    return { ok: true, status: res.status, detail: `HTTP ${res.status} (unexpected but the route exists)` };
  } catch (e) {
    return { ok: false, status: 0, detail: `request failed: ${(e as Error).message}` };
  }
}

/** The one path the app registers for the IPN callback. */
const IPN_PATH = "/api/payments/nowpayments/ipn";

async function checkIpnUrl(
  origin: string | null,
  explicitIpnUrl: string | null,
  ipnSecret: string,
): Promise<void> {
  // Resolve the URL to check: an explicit --ipn-url wins, else derive it from
  // the origin, else report the canonical path only (nothing to probe).
  const target = explicitIpnUrl ?? (origin ? `${origin}${IPN_PATH}` : null);

  if (!target) {
    record({
      label: "IPN callback URL is well-formed",
      status: "pass",
      detail: `path is ${IPN_PATH} - register it as https://<your-domain>${IPN_PATH}`,
    });
    record({
      label: "IPN callback URL is reachable",
      status: "skip",
      detail: "skipped - pass --url https://<your-domain> (or --ipn-url <full-url>) to probe a real deployment",
    });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    record({
      label: "IPN callback URL is well-formed",
      status: "fail",
      detail: `"${target}" is not a valid absolute URL`,
      fix: `Pass a full URL, e.g. --ipn-url https://www.petparcel.store${IPN_PATH}`,
    });
    return;
  }

  // The PATH must be exactly the route the app registers. A URL that is
  // well-formed but points somewhere else (a typo, a trailing slash, the wrong
  // host) is the single most common cause of an order stuck on "awaiting
  // payment", so it is a hard failure rather than a note.
  const pathOk = parsed.pathname.replace(/\/+$/, "") === IPN_PATH;
  if (!pathOk) {
    record({
      label: "IPN callback URL is well-formed",
      status: "fail",
      detail: `path is "${parsed.pathname}" but the app registers "${IPN_PATH}"`,
      fix: `Set the IPN callback URL to ${parsed.origin}${IPN_PATH} in the NOWPayments dashboard.`,
    });
  } else if (parsed.protocol !== "https:") {
    record({
      label: "IPN callback URL is well-formed",
      status: "warn",
      detail: `${parsed.protocol}// is not HTTPS`,
      fix: "NOWPayments must POST to an HTTPS endpoint. Use the production https origin.",
    });
  } else {
    record({
      label: "IPN callback URL is well-formed",
      status: "pass",
      detail: `${parsed.origin}${IPN_PATH}`,
    });
  }

  // ── The host must be the one that actually SERVES the store ────────────────
  // This deployment answers at the apex `petparcel.store` with a 308 redirect to
  // `www.petparcel.store`. Registering the apex is a plausible mistake - it is
  // the shorter, more "canonical-looking" host, and the NOWPayments dashboard's
  // payment-link screen actually shows it - and it silently breaks IPN delivery,
  // because a redirect on a POST is not transparent. So the host is compared
  // against the app's OWN configured canonical origin rather than merely checked
  // for shape.
  const canonical = new URL(siteOrigin());
  if (parsed.host !== canonical.host) {
    const sameSite =
      parsed.host.replace(/^www\./, "") === canonical.host.replace(/^www\./, "");
    record({
      label: "IPN callback URL uses the canonical host",
      status: sameSite ? "fail" : "warn",
      detail: sameSite
        ? `"${parsed.host}" is the same site as the canonical "${canonical.host}" but NOT the host that serves it - the apex 308-redirects to www, and a redirect on POST can drop the body`
        : `"${parsed.host}" differs from the app's canonical origin "${canonical.host}"`,
      fix: `Register https://${canonical.host}${IPN_PATH} in the NOWPayments dashboard (or set SITE_URL to the host you actually serve).`,
    });
  } else {
    record({
      label: "IPN callback URL uses the canonical host",
      status: "pass",
      detail: parsed.host,
    });
  }

  if (!ipnSecret) {
    record({
      label: "IPN callback URL is reachable",
      status: "fail",
      detail: "cannot be probed meaningfully without the IPN secret (every callback would be refused)",
      fix: "Set NOWPAYMENTS_IPN_SECRET first, then re-run.",
    });
    return;
  }

  const ipnUrl = `${parsed.origin}${IPN_PATH}`;

  // Probe 1: an unsigned callback must be refused.
  const unsigned = await postIpn(ipnUrl, JSON.stringify({}));
  record({
    label: "IPN callback URL is reachable",
    status: unsigned.ok ? "pass" : "fail",
    detail: `${ipnUrl} → ${unsigned.detail}`,
    fix: unsigned.ok
      ? undefined
      : "Confirm the deployment is live, that /api/payments/nowpayments/ipn is routed (it is registered in server/_core/app.ts), and that the path in the NOWPayments dashboard matches exactly.",
  });

  // Probe 2: a well-formed but WRONG signature must ALSO be refused. This is
  // what proves the HMAC comparison runs against the real secret, rather than
  // the route simply refusing everything.
  const body = JSON.stringify({ payment_status: "finished", order_id: "verify-probe" });
  const forged = await postIpn(ipnUrl, body, forgedSignature(body));
  const forgedRefused = forged.status === 401 || forged.status === 400;
  record({
    label: "IPN secret is enforced (a forged signature is refused)",
    status: forgedRefused ? "pass" : "fail",
    detail: forgedRefused
      ? `${ipnUrl} refused a well-formed but wrong signature (HTTP ${forged.status})`
      : `${ipnUrl} did NOT refuse a forged signature (HTTP ${forged.status}) - the secret may not be enforced`,
    fix: forgedRefused
      ? undefined
      : "The route accepted a signature that does not match the IPN secret. Confirm NOWPAYMENTS_IPN_SECRET on the deployment matches the dashboard, and that the route verifies before trusting.",
  });
}

// ── 4. did the env vars reach the DEPLOYMENT? ────────────────────────────────

async function checkDeployment(origin: string | null): Promise<void> {
  if (!origin) return;

  const url = `${origin}/api/health`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    let payload: Record<string, unknown> | null = null;
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      payload = null;
    }
    if (!res.ok || !payload) {
      record({
        label: "Deployment reports its payment config",
        status: "fail",
        detail: `${url} returned HTTP ${res.status} and no readable JSON`,
        fix: "The deployment may be down or the origin wrong. Check the URL and that the app is deployed.",
      });
      return;
    }
    const config = (payload.config ?? {}) as Record<string, unknown>;
    const key = config.NOWPAYMENTS_API_KEY === true;
    const secret = config.NOWPAYMENTS_IPN_SECRET === true;
    record({
      label: "Deployment has NOWPAYMENTS_API_KEY",
      status: key ? "pass" : "fail",
      detail: key
        ? `${url} reports the key is present`
        : `${url} reports the key is MISSING on this deployment`,
      fix: key
        ? undefined
        : "The key is set locally but not on the deployment. Add it to the correct Vercel environment (Production vs Preview) and redeploy - env changes need a new deployment to take effect.",
    });
    record({
      label: "Deployment has NOWPAYMENTS_IPN_SECRET",
      status: secret ? "pass" : "fail",
      detail: secret
        ? `${url} reports the IPN secret is present`
        : `${url} reports the IPN secret is MISSING on this deployment`,
      fix: secret ? undefined : "Add NOWPAYMENTS_IPN_SECRET to the deployment's environment and redeploy.",
    });
  } catch (e) {
    record({
      label: "Deployment reports its payment config",
      status: "fail",
      detail: `could not reach ${url}: ${(e as Error).message}`,
      fix: "Confirm the origin is correct and publicly reachable.",
    });
  }
}

// ── report ───────────────────────────────────────────────────────────────────

const ICON: Record<Status, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };

function report(origin: string | null): number {
  const failures = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warn").length;

  console.log("\nNOWPayments configuration check");
  console.log(`  target: ${origin ?? "local environment only"}`);
  console.log("");

  for (const r of results) {
    console.log(`  [${ICON[r.status]}] ${r.label}`);
    console.log(`         ${r.detail}`);
    if (r.fix && r.status !== "pass" && r.status !== "skip") {
      console.log(`         → FIX: ${r.fix}`);
    }
  }

  const passed = results.filter((r) => r.status === "pass").length;
  console.log("");
  console.log(`  ${passed} passed, ${failures} failed, ${warnings} warning(s).`);

  if (failures > 0) {
    console.log("\n  RESULT: FAIL - fix the items above before taking live payments.\n");
    return 1;
  }
  console.log("\n  RESULT: PASS - the store is configured to take crypto payments.\n");
  return 0;
}

async function main(): Promise<void> {
  const { url, ipnUrl, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(HELP);
    return;
  }

  const { apiKey, ipnSecret } = checkEnv();
  await checkApiKey(apiKey);
  await checkIpnUrl(url, ipnUrl, ipnSecret);
  await checkDeployment(url);

  process.exitCode = report(url ?? ipnUrl);
}

main().catch((e) => {
  console.error(`[verify-nowpayments] unexpected failure: ${e instanceof Error ? e.stack : String(e)}`);
  process.exitCode = 1;
});
