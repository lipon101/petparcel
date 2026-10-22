// Verify the store's Bachs configuration - end to end, against the REAL
// provider and (optionally) a real deployment.
//
// This exists because "the env var is set" is NOT the same as "payments work".
// The failure modes it catches, none of which a boolean presence check sees:
//
//   * a key that is present but WRONG (a typo, a key from another account, a
//     key that was rotated) - caught by actually authenticating against the
//     provider's own API;
//   * a SANDBOX key used in production, or a live key in a sandbox deployment;
//   * a key without the `payments:write` / `refunds:write` scopes, which the
//     API answers with 403;
//   * a webhook secret that is set on one side only, so webhooks are refused;
//   * a webhook URL that is malformed, points at the wrong host, or is not
//     actually routed (the single most common cause of an order that stays
//     "awaiting payment" forever);
//   * env vars that are set LOCALLY but never reached the deployment - caught
//     by reading the deployment's own /api/health.
//
// Run:
//   pnpm verify:bachs                            # local env only
//   pnpm verify:bachs --url https://www.petparcel.store
//   LIVE_API_URL=https://... pnpm verify:bachs
//
// Exit code: 0 when every check passes, 1 otherwise - so CI can gate on it.
//
// The API key and the webhook secret are never printed. Only the first few
// characters of the key appear, so an operator can tell WHICH key is deployed
// without the value leaking into a log.

import { createHmac } from "node:crypto";
import {
  bachsConfig,
  listPaymentMethods,
  listPayments,
  listRefunds,
  BACHS_LIVE_BASE,
  BACHS_SANDBOX_BASE,
} from "../server/services/bachs";
import { siteOrigin } from "../server/_core/site-url";

/**
 * The scopes the store's key needs, named the way the Bachs key-creation
 * form names them.
 *
 * WHAT THE STORE CALLS, and the scope each call needs:
 *
 *   POST /v1/checkout-sessions          Payments -> Create & charge
 *   GET  /v1/checkout-sessions/{id}     Payments -> View payments
 *   GET  /v1/payments                   Payments -> View payments
 *   GET  /v1/payments/{charge_id}       Payments -> View payments
 *   POST /v1/refunds                    Refunds  -> Issue refund
 *
 * `payments:write` and `refunds:write` each INCLUDE the matching read
 * permission, so selecting the two WRITE toggles is enough on its own. The
 * READ toggles are listed here only because the form shows them separately and
 * ticking them costs no extra privilege - they are the same two resources.
 *
 * WHAT THE STORE DOES NOT NEED, and why it matters that they are not granted:
 *
 *   Payouts          moves money OUT of the account. A leaked key with this
 *                    could pay money out. The store never withdraws.
 *   Products         the store prices a raw amount at order time, so it has no
 *                    Bachs catalog and creates no products.
 *   Customers        the store keeps its own customers.
 *   Subscriptions    the store sells one-off orders, not subscriptions.
 *   Disputes         read-only would be fine, but the store does not automate
 *                    evidence, and a human handles it in the dashboard.
 *   Transfers, Virtual Accounts, Connected Accounts, Balance, Quotes,
 *   Invoices, Payment Health, Payment Methods
 *                    none of them are part of taking a payment.
 *
 * SO: NOT "Full Access". A full-access key can do everything the account can
 * do, including sending payouts. Least privilege is the whole point of the
 * scopes, and it is what keeps a leaked key from being a liability.
 */
const REQUIRED_SCOPES =
  'Payments -> "Create & charge" (payments:write) and Refunds -> "Issue refund" (refunds:write). ' +
  'Write includes read, so those two toggles are enough on their own; tick the matching ' +
  '"View payments" / "View refund" toggles too if the form shows them separately - it is the ' +
  'same two resources either way. Do NOT use Full Access: it would also grant Payouts, which ' +
  'can move money OUT of the account, plus products, customers, subscriptions and transfers, ' +
  'none of which this store needs.';

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

/** A masked secret: enough to identify it, never enough to use it. */
function maskSecret(value: string): string {
  const v = String(value ?? "").trim();
  if (!v) return "(empty)";
  if (v.length <= 8) return `${v.slice(0, 2)}…(${v.length} chars)`;
  return `${v.slice(0, 6)}…(${v.length} chars)`;
}

function parseArgs(argv: string[]): { url: string | null; webhookUrl: string | null; help: boolean } {
  let url: string | null = process.env.LIVE_API_URL ? process.env.LIVE_API_URL : null;
  let webhookUrl: string | null = process.env.BACHS_WEBHOOK_URL
    ? process.env.BACHS_WEBHOOK_URL
    : null;
  let help = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--url" || arg === "-u") url = argv[++i] ?? null;
    else if (arg.startsWith("--url=")) url = arg.slice("--url=".length);
    else if (arg === "--webhook-url") webhookUrl = argv[++i] ?? null;
    else if (arg.startsWith("--webhook-url=")) webhookUrl = arg.slice("--webhook-url=".length);
  }
  return {
    url: url ? url.replace(/\/+$/, "") : null,
    webhookUrl: webhookUrl ? webhookUrl.trim() : null,
    help,
  };
}

const HELP = `
Bachs configuration verifier

Usage:
  pnpm verify:bachs [--url <origin>] [--webhook-url <full-url>]

Options:
  --url <origin>        Also verify a DEPLOYED origin: reads its /api/health to
                        confirm the keys reached the deployment, and proves its
                        webhook route is live and rejecting unsigned calls.
                        Defaults to $LIVE_API_URL when set.
  --webhook-url <url>   Probe an EXACT webhook URL (overrides the one derived
                        from --url). Its path must be exactly
                        /api/payments/bachs/webhook. Defaults to
                        $BACHS_WEBHOOK_URL when set.
  -h, --help            Show this message.

Reads BACHS_API_KEY and BACHS_WEBHOOK_SECRET from the environment.
Exits 1 when any check fails.
`.trim();

// ── 1. environment presence ──────────────────────────────────────────────────

function checkEnv(): { apiKey: string; webhookSecret: string } {
  const { apiKey, webhookSecret, baseUrl, isRealHost } = bachsConfig();

  record(
    apiKey
      ? {
          label: "BACHS_API_KEY is set",
          status: "pass",
          detail: maskSecret(apiKey),
        }
      : {
          label: "BACHS_API_KEY is set",
          status: "fail",
          detail: "not set - the store cannot create checkout sessions",
          fix: `Add BACHS_API_KEY in Vercel (Settings → Environment Variables) and redeploy. Create it at app.bachs.io → Developer Portal → API Keys. ${REQUIRED_SCOPES}`,
        },
  );

  record(
    webhookSecret
      ? {
          label: "BACHS_WEBHOOK_SECRET is set",
          status: "pass",
          detail: maskSecret(webhookSecret),
        }
      : {
          label: "BACHS_WEBHOOK_SECRET is set",
          status: "fail",
          detail: "not set - every webhook is refused, so orders only settle via the pull path",
          fix: "Open Developer Portal → Webhooks → your endpoint → copy the signing secret, add it as BACHS_WEBHOOK_SECRET in Vercel, and redeploy.",
        },
  );

  // The environment is chosen by the KEY, so the key's own prefix is the thing
  // to check - a sandbox key in production is the classic way to take real
  // orders and never see the money.
  const isLiveKey = apiKey.startsWith("sk_live_");
  const isSandboxKey = apiKey.startsWith("sk_sandbox_");
  record(
    !apiKey
      ? { label: "API key is a production key", status: "skip", detail: "skipped - no key to inspect" }
      : isLiveKey
        ? {
            label: "API key is a production key",
            status: "pass",
            detail: `sk_live_… → ${baseUrl}`,
          }
        : isSandboxKey
          ? {
              label: "API key is a production key",
              status: "fail",
              detail: `sk_sandbox_… → ${baseUrl} - this is the SANDBOX. Real orders would never be collected.`,
              fix: "Create a production API key (app.bachs.io → Developer Portal → API Keys) and replace BACHS_API_KEY in Vercel. Bachs requires the account to be verified before production keys are issued.",
            }
          : {
              label: "API key is a production key",
              status: "fail",
              detail: `the key does not start with sk_live_ or sk_sandbox_ - the API will reject it`,
              fix: "Copy the key exactly as Bachs issued it (sk_live_… or sk_sandbox_…) and redeploy.",
            },
  );

  // A non-default base is legitimate ONLY for a test stub. On a real deployment
  // it silently sends production traffic somewhere that is not Bachs, so it is
  // a warning worth shouting about.
  record(
    isRealHost
      ? {
          label: "API base is a real Bachs host",
          status: "pass",
          detail: baseUrl,
        }
      : {
          label: "API base is a real Bachs host",
          status: "warn",
          detail: `BACHS_API_BASE overrides the real host → ${baseUrl}`,
          fix: `Unset BACHS_API_BASE unless you are pointing at a local test stub. A live store must use ${BACHS_LIVE_BASE}.`,
        },
  );

  record({
    label: "Checkout corridor",
    status: "pass",
    detail: "USD_CARD only, billed in USD - the shopper pays the order total in dollars",
  });

  return { apiKey, webhookSecret };
}

// ── 2. does the key actually authenticate? ───────────────────────────────────

async function checkApiKey(apiKey: string): Promise<void> {
  if (!apiKey) {
    record({
      label: "API key authenticates with Bachs",
      status: "skip",
      detail: "skipped - no API key to test",
    });
    return;
  }

  // GET /v1/payments is AUTHENTICATED: it is refused with 401/403 for a
  // missing, wrong or under-scoped key, so a 200 here is proof the key is real.
  // (GET /v1/payment-methods is NOT used for this - it is an OPEN endpoint that
  // answers 200 with no key at all, so it would pass a garbage key. That is
  // exactly the false positive this check exists to avoid.)
  try {
    const res = await listPayments(1);
    record({
      label: "API key authenticates with Bachs",
      status: "pass",
      detail: `accepted by the authenticated /v1/payments endpoint - the key is valid and can read payments`,
    });
    record({
      label: "Key has the Payments scope",
      status: "pass",
      detail:
        'Payments -> "Create & charge" is granted - reading payments works, and write includes read',
    });
    record({
      label: "Bachs API is reachable",
      status: "pass",
      detail: `${res.items.length} recent payment(s) on the account`,
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const status = Number(err.status ?? 0);
    const isAuth = status === 401 || status === 403;
    record({
      label: "API key authenticates with Bachs",
      status: "fail",
      detail: isAuth
        ? `Bachs REJECTED the key (HTTP ${status}): ${err.message ?? "unauthorized"}`
        : `could not verify the key: ${err.message ?? String(e)}`,
      fix: isAuth
        ? status === 403
          ? `The key is valid but is not allowed to do this. Edit its scopes in the Bachs Developer Portal → API Keys. ${REQUIRED_SCOPES}`
          : "The key is present but not valid. Create a new key at app.bachs.io → Developer Portal → API Keys, replace BACHS_API_KEY in Vercel, and redeploy. A 401 means the key itself is wrong (or was revoked). Remember the plain key is shown only once, at creation."
        : "This may be a transient provider problem. Re-run; if it persists, verify the key in the Bachs dashboard.",
    });
    return;
  }

  // The Refunds resource, proved by reading it. The WRITE half cannot be
  // proved without actually issuing a refund - which moves money - so it is
  // reported as unverifiable rather than faked.
  try {
    const refunds = await listRefunds(1);
    record({
      label: "Key has the Refunds scope",
      status: "pass",
      detail:
        'Refunds -> "Issue refund" is granted - reading refunds works, and write includes read. ' +
        "(The write half itself cannot be checked without issuing a real refund.)",
    });
    record({
      label: "Refunds recorded on the account",
      status: "pass",
      detail: `${refunds.items.length} refund(s) on the account`,
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    const status = Number(err.status ?? 0);
    record({
      label: "Key has the Refunds scope",
      status: status === 403 ? "fail" : "warn",
      detail:
        status === 403
          ? `Bachs refused to list refunds (HTTP 403): ${err.message ?? "forbidden"} - the Refunds resource is not granted, so the admin's Refund button would fail.`
          : `could not list refunds: ${err.message ?? String(e)}`,
      fix: status === 403 ? `Edit the key's scopes in the Bachs Developer Portal → API Keys. ${REQUIRED_SCOPES}` : undefined,
    });
  }

  // Informational: what the account can actually accept. Public data, so it is
  // reported for context only and never gates the result.
  try {
    const methods = await listPaymentMethods();
    const ids = methods.map((m) => String(m.id ?? "")).filter(Boolean);
    const usdCard = methods.find((m) => String(m.id ?? "").toUpperCase() === "USD_CARD");
    record({
      label: "USD card corridor is enabled on this account",
      status: usdCard ? "pass" : "warn",
      detail: usdCard
        ? `USD_CARD is offered (${usdCard.enabled_by_default ? "enabled by default" : "not enabled by default"})`
        : `the account reports no USD_CARD corridor. It offers: ${ids.join(", ") || "(none reported)"}.`,
      fix: usdCard
        ? undefined
        : "Without the USD card corridor the hosted checkout has no way to pay. Enable USD_CARD for the account in the Bachs dashboard.",
    });
  } catch {
    // Public and non-essential - its failure must never fail the run.
  }
}

// ── 3. the webhook URL ───────────────────────────────────────────────────────

interface WebhookProbe {
  ok: boolean;
  status: number;
  detail: string;
}

/** A well-formed but WRONG signature: the HMAC-SHA256 of the body under a
 *  secret that is not the store's. It has the exact 64-hex shape the route
 *  expects, so a route that only checked the SHAPE would accept it. A 401 here
 *  is therefore proof the HMAC comparison is actually running against the real
 *  secret - which an unsigned probe alone cannot show, because a route that
 *  refuses everything also answers 401 to an empty body. */
function forgedSignature(body: string, timestamp: string): string {
  return createHmac("sha256", "not-the-store-webhook-secret")
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
}

/** POST a body at the webhook route and classify the answer. A correctly wired
 *  route answers 401 (signature refused) - NEVER 404/405, which would mean
 *  nothing is routed there, and never a 5xx, which would mean it crashed.
 *
 *  A 200 is classified as NOT ok. Both callers probe with a body the route must
 *  refuse (unsigned, or signed under a different secret), so accepting it proves
 *  the signature is not enforced - the very failure this script exists to catch. */
async function postWebhook(
  webhookUrl: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<WebhookProbe> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
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
    if (res.status === 401) {
      return { ok: true, status: res.status, detail: "route is live and refused the callback" };
    }
    if (res.status === 400) {
      return { ok: true, status: res.status, detail: "route is live (rejected the body as expected)" };
    }
    if (res.status === 200) {
      // A 2xx means the route ACCEPTED the callback. For BOTH probes below that
      // is a FAILURE - the body sent is unsigned, or signed with a secret that is
      // not the store's, so a correctly configured route must never accept it.
      return {
        ok: false,
        status: res.status,
        detail: "route is live, but it ACCEPTED the callback - the webhook secret is NOT being enforced",
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

/** The one path the app registers for the payment webhook. */
const WEBHOOK_PATH = "/api/payments/bachs/webhook";

async function checkWebhookUrl(
  origin: string | null,
  explicitWebhookUrl: string | null,
  webhookSecret: string,
): Promise<void> {
  // Resolve the URL to check: an explicit --webhook-url wins, else derive it
  // from the origin, else report the canonical path only (nothing to probe).
  const target = explicitWebhookUrl ?? (origin ? `${origin}${WEBHOOK_PATH}` : null);

  if (!target) {
    record({
      label: "Webhook URL is well-formed",
      status: "pass",
      detail: `path is ${WEBHOOK_PATH} - register it as https://<your-domain>${WEBHOOK_PATH}`,
    });
    record({
      label: "Webhook URL is reachable",
      status: "skip",
      detail:
        "skipped - pass --url https://<your-domain> (or --webhook-url <full-url>) to probe a real deployment",
    });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    record({
      label: "Webhook URL is well-formed",
      status: "fail",
      detail: `"${target}" is not a valid absolute URL`,
      fix: `Pass a full URL, e.g. --webhook-url https://www.petparcel.store${WEBHOOK_PATH}`,
    });
    return;
  }

  // The PATH must be exactly the route the app registers. A URL that is
  // well-formed but points somewhere else (a typo, a trailing slash, the wrong
  // host) is the single most common cause of an order stuck on "awaiting
  // payment", so it is a hard failure rather than a note.
  const pathOk = parsed.pathname.replace(/\/+$/, "") === WEBHOOK_PATH;
  if (!pathOk) {
    record({
      label: "Webhook URL is well-formed",
      status: "fail",
      detail: `path is "${parsed.pathname}" but the app registers "${WEBHOOK_PATH}"`,
      fix: `Set the endpoint URL to ${parsed.origin}${WEBHOOK_PATH} in the Bachs Developer Portal → Webhooks.`,
    });
  } else if (parsed.protocol !== "https:") {
    record({
      label: "Webhook URL is well-formed",
      status: "warn",
      detail: `${parsed.protocol}// is not HTTPS`,
      fix: "Bachs must POST to an HTTPS endpoint. Use the production https origin.",
    });
  } else {
    record({
      label: "Webhook URL is well-formed",
      status: "pass",
      detail: `${parsed.origin}${WEBHOOK_PATH}`,
    });
  }

  // ── The host must be the one that actually SERVES the store ────────────────
  // This deployment answers at the apex `petparcel.store` with a 308 redirect to
  // `www.petparcel.store`. Registering the apex is a plausible mistake and it
  // silently breaks webhook delivery, because a redirect on a POST is not
  // transparent. So the host is compared against the app's OWN configured
  // canonical origin rather than merely checked for shape.
  const canonical = new URL(siteOrigin());
  if (parsed.host !== canonical.host) {
    const sameSite =
      parsed.host.replace(/^www\./, "") === canonical.host.replace(/^www\./, "");
    record({
      label: "Webhook URL uses the canonical host",
      status: sameSite ? "fail" : "warn",
      detail: sameSite
        ? `"${parsed.host}" is the same site as the canonical "${canonical.host}" but NOT the host that serves it - the apex 308-redirects to www, and a redirect on POST can drop the body`
        : `"${parsed.host}" differs from the app's canonical origin "${canonical.host}"`,
      fix: `Register https://${canonical.host}${WEBHOOK_PATH} in the Bachs Developer Portal (or set SITE_URL to the host you actually serve).`,
    });
  } else {
    record({
      label: "Webhook URL uses the canonical host",
      status: "pass",
      detail: parsed.host,
    });
  }

  if (!webhookSecret) {
    record({
      label: "Webhook URL is reachable",
      status: "fail",
      detail: "cannot be probed meaningfully without the webhook secret (every callback would be refused)",
      fix: "Set BACHS_WEBHOOK_SECRET first, then re-run.",
    });
    return;
  }

  const webhookUrl = `${parsed.origin}${WEBHOOK_PATH}`;

  // Probe 1: an unsigned callback must be refused.
  const unsigned = await postWebhook(webhookUrl, JSON.stringify({}));
  record({
    label: "Webhook URL is reachable",
    status: unsigned.ok ? "pass" : "fail",
    detail: `${webhookUrl} → ${unsigned.detail}`,
    fix: unsigned.ok
      ? undefined
      : "Confirm the deployment is live, that /api/payments/bachs/webhook is routed (it is registered in server/_core/app.ts), and that the endpoint URL in the Bachs Developer Portal matches exactly.",
  });

  // Probe 2: a well-formed but WRONG signature must ALSO be refused. This is
  // what proves the HMAC comparison runs against the real secret, rather than
  // the route simply refusing everything.
  const body = JSON.stringify({ id: "evt_verify_probe", type: "collection.succeeded", data: {} });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const forged = await postWebhook(webhookUrl, body, {
    "x-bachs-timestamp": timestamp,
    "x-bachs-signature": forgedSignature(body, timestamp),
    "x-bachs-signature-v2": `t=${timestamp},v1=${forgedSignature(body, timestamp)}`,
  });
  const forgedRefused = forged.status === 401 || forged.status === 400;
  record({
    label: "Webhook secret is enforced (a forged signature is refused)",
    status: forgedRefused ? "pass" : "fail",
    detail: forgedRefused
      ? `${webhookUrl} refused a well-formed but wrong signature (HTTP ${forged.status})`
      : `${webhookUrl} did NOT refuse a forged signature (HTTP ${forged.status}) - the secret may not be enforced`,
    fix: forgedRefused
      ? undefined
      : "The route accepted a signature that does not match the webhook secret. Confirm BACHS_WEBHOOK_SECRET on the deployment matches the endpoint's signing secret in the Bachs Developer Portal, and that the route verifies before trusting.",
  });
}

// ── 4. did the env vars reach the DEPLOYMENT? ────────────────────────────────

async function checkDeployment(
  origin: string | null,
  apiKey: string,
  webhookSecret: string,
): Promise<void> {
  if (!origin) return;

  const url = `${origin}/api/health`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
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
    const key = config.BACHS_API_KEY === true;
    const secret = config.BACHS_WEBHOOK_SECRET === true;
    record({
      label: "Deployment has BACHS_API_KEY",
      status: key ? "pass" : "fail",
      detail: key
        ? `${url} reports the key is present`
        : `${url} reports the key is MISSING on this deployment`,
      fix: key
        ? undefined
        : "The key is set locally but not on the deployment. Add it to the correct Vercel environment (Production vs Preview) and redeploy - env changes need a new deployment to take effect.",
    });
    record({
      label: "Deployment has BACHS_WEBHOOK_SECRET",
      status: secret ? "pass" : "fail",
      detail: secret
        ? `${url} reports the webhook secret is present`
        : `${url} reports the webhook secret is MISSING on this deployment`,
      fix: secret ? undefined : "Add BACHS_WEBHOOK_SECRET to the deployment's environment and redeploy.",
    });

    // The health endpoint reports PRESENCE, never the value. If it ever
    // started reporting the key itself, that would put the secret in a public
    // response - so the shape is asserted here rather than assumed.
    const body = text ?? "";
    const leaked = [apiKey.trim(), webhookSecret.trim()].filter(
      (v) => v.length > 0 && body.includes(v),
    );
    record({
      label: "The health endpoint reports presence, not the secret",
      status: leaked.length ? "fail" : "pass",
      detail: leaked.length
        ? `${url} contains the VALUE of a secret - it must report presence only`
        : `${url} reports which keys are set without revealing any of them`,
      fix: leaked.length
        ? "Remove the value from the health payload. Rotate the key afterwards: it has been in a public response."
        : undefined,
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

// ── 5. does the key leak to the browser? ─────────────────────────────────────
//
// WHY THIS EXISTS. The API key can move money, so the ONE thing that must
// never happen is a browser being able to read it. The key is read from the
// environment on the server and used in `server/services/bachs.ts` only; this
// check proves it on the LIVE deployment rather than trusting that.
//
// It looks for the key's own VALUE, and for the shapes a key takes
// (`sk_live_...`, `sk_sandbox_...`), in every script the storefront serves.
//
// It also checks the health endpoint, which reports whether the key is
// PRESENT - a boolean, never the value. If that ever changed to report the
// key, this check would catch it.
async function checkNoKeyLeak(origin: string | null, apiKey: string): Promise<void> {
  if (!origin) return;

  const needles = [apiKey.trim(), "sk_live_", "sk_sandbox_"].filter(Boolean);
  const hits: string[] = [];

  try {
    const home = await fetch(origin, {
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(30_000),
    });
    const html = await home.text();

    // The key must not be in the HTML either.
    for (const needle of needles) {
      if (needle && html.includes(needle)) hits.push(`the page HTML contains "${needle.slice(0, 8)}..."`);
    }

    // Every script the page loads.
    const sources = new Set<string>();
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
      sources.add(new URL(m[1], origin).toString());
    }
    for (const m of html.matchAll(/<link[^>]+href=["']([^"']+\.js)["']/gi)) {
      sources.add(new URL(m[1], origin).toString());
    }

    for (const src of sources) {
      const res = await fetch(src, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) continue;
      const text = await res.text();
      for (const needle of needles) {
        if (needle && text.includes(needle)) {
          hits.push(`${new URL(src).pathname} contains "${needle.slice(0, 8)}..."`);
        }
      }
    }

    record({
      label: "The API key never reaches the browser",
      status: hits.length ? "fail" : "pass",
      detail: hits.length
        ? hits.join("; ")
        : `checked the page and ${sources.size} script(s) - no key value and no key prefix`,
      fix: hits.length
        ? "The key is being served to the browser. It must be read on the server only (server/services/bachs.ts) and never returned to the client. Rotate the key after fixing this."
        : undefined,
    });
  } catch (e) {
    record({
      label: "The API key never reaches the browser",
      status: "warn",
      detail: `could not complete the check: ${(e as Error).message}`,
    });
  }
}

/**
 * Sign a probe with the LOCAL secret and post it to the LIVE route.
 *
 * WHY THIS EXISTS. "The secret is set" is not the same as "the secret is
 * right". A signing secret can be right on one side and stale on the other,
 * and the failure looks like nothing happening: every delivery is refused and
 * no order ever settles. This check settles it in one request, because the
 * ONLY thing standing between a signed probe and a 200 is the verification
 * itself.
 *
 * A 200 proves three things at once:
 *   * the deployment's secret is the same value as the local one;
 *   * the route reads the header names Bachs actually sends (`X-Bachs-
 *     Signature`, `X-Bachs-Signature-V2`, `X-Bachs-Timestamp`);
 *   * the digest and the timestamp window agree with the provider's.
 *
 * A 401 means one of those is false - and the server log says which.
 *
 * IT CANNOT DO ANYTHING TO AN ORDER. The probe carries a reference that
 * cannot be an order number, so the route finds no order, writes nothing to
 * any order, and settles nothing. Its event id is FIXED, so every run lands
 * on the same ledger row: the route records it once and answers "duplicate
 * event" from then on. One row, ever.
 */
async function checkSecretMatches(origin: string | null, webhookSecret: string): Promise<void> {
  if (!origin) return;
  if (!webhookSecret) {
    record({
      label: "The signing secret matches the deployment",
      status: "skip",
      detail: "skipped - no local secret to sign the probe with",
    });
    return;
  }

  const url = `${origin}/api/payments/bachs/webhook`;
  const body = JSON.stringify({
    id: "evt_petparcel_config_probe",
    type: "collection.succeeded",
    created_at: new Date().toISOString(),
    organization_id: "petparcel-config-probe",
    // Cannot be an order number: PetParcel's are `PP-XXXXXXXX`.
    data: { charge_id: "ch_config_probe", reference: "PROBE-NOT-A-REAL-ORDER" },
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.`, "utf8")
    .update(body, "utf8")
    .digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bachs-timestamp": timestamp,
        "x-bachs-signature": signature,
        "x-bachs-signature-v2": `t=${timestamp},v1=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(20_000),
      redirect: "manual",
    });
    const text = (await res.text()).slice(0, 200);
    if (res.status === 200) {
      record({
        label: "The signing secret matches the deployment",
        status: "pass",
        detail: `the route ACCEPTED a body signed with the local secret - the secret, the header names and the digest all agree`,
      });
    } else if (res.status === 401) {
      record({
        label: "The signing secret matches the deployment",
        status: "fail",
        detail: "the route REFUSED a body signed with the local secret (401)",
        fix: "The local BACHS_WEBHOOK_SECRET and the deployment's differ. Copy the endpoint's signing secret from the Bachs Developer Portal → Webhooks, set it in Vercel (Production), redeploy, and re-run.",
      });
    } else {
      record({
        label: "The signing secret matches the deployment",
        status: "fail",
        detail: `the route answered HTTP ${res.status} - ${text}`,
      });
    }
  } catch (e) {
    record({
      label: "The signing secret matches the deployment",
      status: "warn",
      detail: `could not complete the check: ${(e as Error).message}`,
    });
  }
}

// ── report ───────────────────────────────────────────────────────────────────

const ICON: Record<Status, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };

function report(origin: string | null): number {
  const failures = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warn").length;

  console.log("\nBachs configuration check");
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
  console.log("\n  RESULT: PASS - the store is configured to take card payments.\n");
  return 0;
}

async function main(): Promise<void> {
  const { url, webhookUrl, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(HELP);
    return;
  }

  const { apiKey, webhookSecret } = checkEnv();
  await checkApiKey(apiKey);
  await checkWebhookUrl(url, webhookUrl, webhookSecret);
  await checkDeployment(url, apiKey, webhookSecret);
  await checkNoKeyLeak(url, apiKey);
  await checkSecretMatches(url, webhookSecret);

  process.exitCode = report(url ?? webhookUrl);
}

main().catch((e) => {
  console.error(`[verify-bachs] unexpected failure: ${e instanceof Error ? e.stack : String(e)}`);
  process.exitCode = 1;
});
