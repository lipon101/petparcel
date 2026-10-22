// Daily health check: does the LIVE deployment still answer JSON?
//
// WHY THIS EXISTS. Sign-in broke in production with
//   Unexpected token 'T', "The page c"... is not valid JSON
// because the live API was serving an HTML/plain-text error page where the
// client expected JSON. Every automated signal the repo had was green at the
// time - the build passed, the unit suite passed, the responsive gate passed -
// because all of them ran against a LOCAL server. Nothing looked at the
// deployed origin, so a completely dead API shipped undetected and the failure
// only surfaced when a customer pressed "Sign in".
//
// This closes that hole. It hits the REAL live origin and asserts the three
// properties whose absence caused that outage:
//
//   1. the status is a success (not a 404/500 error page);
//   2. the content-type is JSON (not text/html - the exact regression);
//   3. the body actually PARSES as JSON, and carries the shape the storefront
//      needs (a settings.public payload), so a 200 that returns `{}` or an
//      unrelated JSON document is not mistaken for healthy.
//
// A failure THROWS, deliberately and loudly, naming the status and content-type
// actually received - the numbers an operator needs to tell "the API is down"
// apart from "the API is up but rewrote to the SPA".
import { outboundFetch } from "../_core/fetch";
import { registerJob } from "../_core/jobs";
import { STORE_URL } from "../../shared/store";

/** The endpoint the storefront reads first on every page load. It is public and
 *  dependency-light, which makes it the right canary: if THIS cannot answer
 *  JSON, nothing behind the API can. */
export const LIVE_API_PATH = "/trpc/settings.public";

/** The origin to probe. Overridable so the check can be pointed at a preview
 *  deployment, or at a deliberately broken host, in order to prove it FAILS -
 *  a check that has only ever been seen to pass proves nothing. */
export function liveApiOrigin(): string {
  return (process.env.LIVE_API_URL ?? STORE_URL).replace(/\/+$/, "");
}

/** The exact canary URL: origin + endpoint. Callers that want the health probe
 *  use this; callers proving the check REJECTS a non-JSON page pass their own
 *  URL straight to {@link checkLiveApiJson}. */
export function liveApiUrl(origin = liveApiOrigin()): string {
  return `${String(origin).replace(/\/+$/, "")}${LIVE_API_PATH}`;
}

export interface LiveApiVerdict {
  ok: boolean;
  status: number;
  contentType: string;
  /** A one-line explanation naming the status/content-type actually received. */
  detail: string;
}

/**
 * Probe ONE EXACT URL and report a verdict. Never throws: the caller decides
 * whether a `false` verdict should fail a job, a CI run or a shell command.
 *
 * The URL is probed as given - it is NOT rewritten to the API endpoint. That is
 * a deliberate contract, not laziness. An earlier revision appended the endpoint
 * whenever the target looked like an origin, which meant the "this must FAIL"
 * cases (the site root, a 404) were silently redirected onto the healthy
 * endpoint and reported PASS - so the check stopped testing the one thing it
 * exists for while still printing green. Probing exactly what you ask for makes
 * that class of self-deception impossible; composing the canary is
 * {@link liveApiUrl}'s job.
 */
export async function checkLiveApiJson(url: string): Promise<LiveApiVerdict> {
  let status = 0;
  let contentType = "";
  let body = "";

  try {
    const res = await outboundFetch(url, {
      headers: { accept: "application/json" },
      timeoutMs: 20_000,
    });
    status = res.status;
    contentType = res.headers.get("content-type") ?? "";
    body = await res.text();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status: 0,
      contentType: "",
      detail: `request to ${url} failed: ${reason}`,
    };
  }

  if (status < 200 || status > 299) {
    return {
      ok: false,
      status,
      contentType,
      detail:
        `${url} returned HTTP ${status} with content-type "${contentType || "(none)"}" ` +
        `- expected 2xx JSON. First bytes: ${JSON.stringify(body.slice(0, 120))}`,
    };
  }

  // The exact regression: Vercel's own "The page could not be found" page is
  // text/plain, and the SPA fallback is text/html. Either means the function is
  // missing or the request was rewritten away from the API.
  if (!/application\/json/i.test(contentType)) {
    return {
      ok: false,
      status,
      contentType,
      detail:
        `${url} returned HTTP ${status} but content-type "${contentType || "(none)"}" ` +
        `- expected application/json. This is the failure mode that broke sign-in. ` +
        `First bytes: ${JSON.stringify(body.slice(0, 120))}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      status,
      contentType,
      detail:
        `${url} claimed application/json but the body did not parse: ${reason}. ` +
        `First bytes: ${JSON.stringify(body.slice(0, 120))}`,
    };
  }

  // A 200 carrying unrelated JSON is not health. Require the shape the
  // storefront actually reads, so the check cannot pass on a stub or a rewrite
  // that happens to emit JSON.
  const settings = extractJsonPayload(parsed);
  if (!settings || typeof settings !== "object" || !("brand_name" in settings)) {
    return {
      ok: false,
      status,
      contentType,
      detail:
        `${url} returned valid JSON but not a settings.public payload ` +
        `(no brand_name). First bytes: ${JSON.stringify(body.slice(0, 120))}`,
    };
  }

  return {
    ok: true,
    status,
    contentType,
    detail: `${url} returned HTTP ${status} application/json with a real settings payload`,
  };
}

/** tRPC wraps a single query as `{ result: { data: { json: ... } } }`. Unwrap
 *  that, or accept a bare object so a future non-tRPC shape still works. */
function extractJsonPayload(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const data = (root.result as Record<string, unknown> | undefined)?.data as
    | Record<string, unknown>
    | undefined;
  const wrapped = data?.json;
  const candidate =
    wrapped && typeof wrapped === "object" && !Array.isArray(wrapped) ? wrapped : root;
  return candidate as Record<string, unknown>;
}

/**
 * The scheduled job body. Throws on anything but a healthy JSON response, so the
 * cron route reports a 500 and the run is visibly failed rather than silently
 * "succeeding" - which is how the original outage went unnoticed.
 */
export async function runLiveApiHealthCheck(): Promise<void> {
  const verdict = await checkLiveApiJson(liveApiUrl());
  if (!verdict.ok) throw new Error(`[live-api-health] ${verdict.detail}`);
  // eslint-disable-next-line no-console
  console.log(`[live-api-health] OK: ${verdict.detail}`);
}

// Registered so Vercel Cron can drive it through /api/cron/live-api-health-check
// on the daily schedule in vercel.json.
registerJob("live-api-health-check", runLiveApiHealthCheck);
