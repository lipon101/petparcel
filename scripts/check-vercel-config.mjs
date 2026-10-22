// Pre-flight guard for the Vercel deploy config.
//
// WHY THIS EXISTS. The deployment failed with "Vercel - Deployment failed"
// while BOTH CI jobs stayed green, because the one thing CI never checked was
// vercel.json itself. The cause was a Vercel Hobby restriction that is enforced
// only at DEPLOY time, on Vercel's side:
//
//   Hobby accounts are limited to daily cron jobs. This cron expression would
//   run more than once per day.
//
// The two supplier-sync crons were registered at `0 */6 * * *` and
// `30 */6 * * *` - every 6 hours, i.e. FOUR runs a day - so every deploy died
// during configuration, after a perfectly good build. Nothing in the repo could
// have caught it: the schedule is valid cron, valid JSON, and the build is
// green. It needed a rule about the PLAN.
//
// This script encodes that rule so the same failure can never reach Vercel
// again: it fails the CI run when vercel.json declares a cron the free Hobby
// plan will reject, or when the deploy config is otherwise malformed.
//
// It deliberately does NOT try to infer a paid plan. The repo is deployed on
// Hobby; if that ever changes, relax this check at the same time, on purpose.
//
// Run:  node scripts/check-vercel-config.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FILE = "vercel.json";
const failures = [];
const notes = [];

function fail(msg) {
  failures.push(msg);
}

/** Parse a 5-field cron expression into its parts, or null if it is not one. */
function parseCron(expr) {
  if (typeof expr !== "string") return null;
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  const [minute, hour, dom, month, dow] = fields;
  return { minute, hour, dom, month, dow, raw: expr };
}

/**
 * Hobby allows AT MOST ONE run per day. The only way to guarantee that from the
 * time fields alone is a fixed minute AND a fixed hour - `M H * * *` (any
 * day-of-month/month/day-of-week restriction may still be layered on top, which
 * can only reduce the frequency, never raise it).
 *
 * Anything with `*`, a list (`,`), a range (`-`) or a step (`/`) in the hour or
 * minute field can fire more than once a day, which is exactly what Vercel
 * rejects. `*` in the HOUR field is the trap: it reads as "hourly", not daily.
 */
function runsAtMostOncePerDay(parts) {
  if (parts === null) return false;
  const fixed = (f) => /^\d+$/.test(f);
  if (!fixed(parts.minute) || !fixed(parts.hour)) return false;
  const minute = Number(parts.minute);
  const hour = Number(parts.hour);
  if (minute < 0 || minute > 59) return false;
  if (hour < 0 || hour > 23) return false;
  return true;
}

const abs = path.resolve(FILE);
if (!fs.existsSync(abs)) {
  console.log(`[vercel-config] no ${FILE} - nothing to check.`);
  process.exit(0);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(abs, "utf8"));
} catch (e) {
  console.error(`[vercel-config] ${FILE} is not valid JSON: ${e.message}`);
  process.exit(1);
}

// --- crons (the deploy-killer) -------------------------------------------
const crons = config.crons;
if (crons !== undefined) {
  if (!Array.isArray(crons)) {
    fail(`"crons" must be an array, got ${typeof crons}.`);
  } else {
    const seen = new Set();
    for (const cron of crons) {
      if (!cron || typeof cron !== "object") {
        fail(`cron entry must be an object, got ${JSON.stringify(cron)}.`);
        continue;
      }
      if (typeof cron.path !== "string" || !cron.path.startsWith("/")) {
        fail(`cron path must be an absolute path, got ${JSON.stringify(cron.path)}.`);
      }
      if (seen.has(cron.path)) {
        fail(`duplicate cron path ${cron.path} - Vercel rejects duplicates.`);
      }
      seen.add(cron.path);

      const parts = parseCron(cron.schedule);
      if (parts === null) {
        fail(
          `cron ${cron.path} has a malformed schedule ${JSON.stringify(cron.schedule)} ` +
            `- Vercel requires a 5-field cron expression.`,
        );
        continue;
      }
      if (!runsAtMostOncePerDay(parts)) {
        fail(
          `cron ${cron.path} schedule "${parts.raw}" can run MORE THAN ONCE PER DAY. ` +
            `The Vercel Hobby plan rejects this and FAILS THE DEPLOYMENT with ` +
            `"Hobby accounts are limited to daily cron jobs." ` +
            `Use a fixed minute and hour, e.g. "0 3 * * *" (daily at 03:00 UTC).`,
        );
      } else {
        notes.push(`cron ${cron.path} -> "${parts.raw}" (daily, Hobby-safe)`);
      }
    }
  }
}

// --- deploy plumbing that must not regress --------------------------------
for (const key of ["buildCommand", "installCommand", "outputDirectory"]) {
  if (typeof config[key] !== "string" || config[key].length === 0) {
    fail(`"${key}" must be a non-empty string - a missing value breaks the deploy.`);
  }
}

// --- the serverless function must be TRACKED in git ------------------------
// The second deploy-time failure this file guards, and a nastier one because it
// shipped silently. `vercel.json` rewrites /trpc, /api and /app-storage to
// `/api/index` - but `api/index.js` had been added to `.gitignore` (and removed
// from git) in commit a562f5d. The function therefore did not exist in the
// repository, so Vercel deployed a site with no API at all: every /api and
// /trpc request fell through to the SPA rewrite and returned `/index.html`
// with HTTP 200. The client then parsed that HTML as JSON and reported
// `Unexpected token 'T', "The page c"...` on sign-in.
//
// A rewrite whose destination is missing is invisible at build time, so this
// asserts the destination exists AND is committed. `git ls-files` is used
// because a file that exists locally but is ignored would pass a plain
// existence check while still being absent from every deploy.
if (typeof config.rewrites !== "undefined") {
  const seenFunctionFiles = new Set();
  if (!Array.isArray(config.rewrites)) {
    fail(`"rewrites" must be an array, got ${typeof config.rewrites}.`);
  } else {
    for (const rw of config.rewrites) {
      const dest = String(rw?.destination ?? "");
      // Only the function destinations matter; the SPA fallback (/index.html)
      // is a build output that genuinely is not in git.
      if (!dest.startsWith("/api/")) continue;
      // Several rewrites point at the same function, so work per unique FILE
      // and report each problem once.
      const file = dest.replace(/^\//, "") + ".js";
      if (seenFunctionFiles.has(file)) continue;
      seenFunctionFiles.add(file);
      if (!fs.existsSync(file)) {
        fail(
          `rewrite destination "${dest}" has no source file at ${file} - the deploy would return HTTP 200 with index.html for every API call.`,
        );
        continue;
      }
      let tracked = "";
      try {
        tracked = execFileSync("git", ["ls-files", "--", file], { encoding: "utf8" }).trim();
      } catch {
        notes.push(`could not run git ls-files; skipped the tracked check for ${file}`);
        continue;
      }
      if (tracked === "") {
        fail(
          `${file} EXISTS but is NOT TRACKED by git (it is ignored, or never added). Vercel deploys the repository, so the function would be missing in production and every ${dest} call would silently return index.html. Remove ${file} from .gitignore and commit it.`,
        );
      }
    }
  }
}

// --- never ship a secret in the public config -----------------------------
// vercel.json is committed, so anything embedded here is public. Env vars are
// referenced by NAME in the Vercel dashboard, never inline.
const SECRETISH = [
  /postgres(ql)?:\/\/[^\s"']*:[^\s"'@]+@/i, // a connection string with a password
  /ghp_[A-Za-z0-9]{20,}/, // a GitHub token
  /@api@[A-Za-z0-9]{16,}/, // the supplier API key shape
  /sk-[A-Za-z0-9]{20,}/, // a generic API secret
];
const raw = fs.readFileSync(abs, "utf8");
for (const re of SECRETISH) {
  if (re.test(raw)) {
    fail(`${FILE} appears to contain a committed secret (matched ${re}). Config is public - never inline one.`);
  }
}

for (const n of notes) console.log(`[vercel-config] ${n}`);

if (failures.length > 0) {
  console.error(`\n[vercel-config] FAILED: ${failures.length} problem(s) in ${FILE}:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`[vercel-config] OK: ${FILE} is valid and every cron is Hobby-compatible (<= 1 run/day).`);
