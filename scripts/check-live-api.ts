// Daily live-API JSON health check, runnable from CI or a shell.
//
// The check itself lives in `server/services/live-api-health.ts` so the scheduled
// Vercel Cron job and this command share ONE implementation - a job that passes
// while the command fails (or vice versa) would be worse than either alone.
//
// It proves BOTH directions on every run, because a health check that has only
// ever been observed to pass is not evidence of anything:
//
//   * PASS expected  the real live origin's /trpc/settings.public
//   * FAIL expected  the same origin's `/` (the SPA, served as text/html) -
//                    this is precisely the shape of the outage that broke
//                    sign-in, where a non-JSON document was returned in place of
//                    the API response.
//   * FAIL expected  a path that 404s.
//
// Run:  pnpm check:live-api
// Env:  LIVE_API_URL  origin to probe (default: the production storefront).
//                     Point it at a preview deployment, or at anything broken,
//                     to exercise the failure path against a real server.
import { checkLiveApiJson, liveApiOrigin, liveApiUrl } from "../server/services/live-api-health";

interface Expectation {
  label: string;
  url: string;
  want: "pass" | "fail";
}

async function main(): Promise<void> {
  const origin = liveApiOrigin();
  // The site root is what the SPA's HTML fallback is served from, so it is the
  // real-world stand-in for the outage: a 200 whose content-type is text/html.
  const htmlUrl = `${origin}/`;
  const missingUrl = `${origin}/trpc/definitely-not-a-procedure-xyz`;

  const cases: Expectation[] = [
    { label: "live settings.public is JSON", url: liveApiUrl(origin), want: "pass" },
    { label: "the SPA's HTML page is NOT JSON", url: htmlUrl, want: "fail" },
    { label: "a missing procedure is NOT healthy JSON", url: missingUrl, want: "fail" },
  ];

  console.log(`[live-api] probing origin ${origin}`);

  let failures = 0;
  for (const c of cases) {
    const verdict = await checkLiveApiJson(c.url);
    const actual = verdict.ok ? "pass" : "fail";
    const verdictLine = verdict.ok
      ? `PASS  status=${verdict.status} content-type="${verdict.contentType}"`
      : `FAIL  status=${verdict.status || "(none)"} content-type="${verdict.contentType || "(none)"}"`;
    const good = actual === c.want;

    console.log(`\n[live-api] ${good ? "OK  " : "BAD "} ${c.label}`);
    console.log(`[live-api]     ${verdictLine}`);
    console.log(`[live-api]     ${verdict.detail}`);
    console.log(`[live-api]     expected=${c.want} actual=${actual}`);

    if (!good) {
      failures += 1;
      console.error(
        `[live-api]     the check did not behave as expected: it should have ${c.want}ed for ${c.url}.`,
      );
    }
  }

  if (failures > 0) {
    console.error(
      `\n[live-api] FAILED: ${failures} case(s) did not behave as expected. ` +
        `A health check that cannot tell a JSON API apart from an HTML page is not a health check.`,
    );
    process.exit(1);
  }
  console.log(
    `\n[live-api] PASSED: the live endpoint answers JSON, and the check correctly REJECTS ` +
      `an HTML page and a 404 at the same origin.`,
  );
}

main().catch((err) => {
  console.error(`[live-api] FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
