// Guards the deploy config against the failure that broke production twice.
//
// WHY THIS EXISTS. `vercel.json` declared the unpaid-order-alert sweep at
// `0 */6 * * *` — every 6 hours, i.e. FOUR runs a day. The Vercel **Hobby** plan
// rejects any cron that fires more than once a day, and it does so at DEPLOY
// time, on Vercel's side, with:
//
//   Hobby accounts are limited to daily cron jobs. This cron expression would
//   run more than once per day.
//
// The build itself is green, so the failure is invisible in the build log and
// only shows up as "Vercel - Deployment failed". `scripts/check-vercel-config.mjs`
// encodes the rule and runs in CI, but a guard that only lives in a shell script
// is easy to bypass locally and easy to forget. This test pins the same rule
// where the suite already runs, so a sub-daily schedule fails `pnpm test` too.
//
// It reads the REAL `vercel.json` — not a fixture — so it cannot drift from what
// actually ships.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const CONFIG_PATH = path.resolve(import.meta.dirname, "..", "vercel.json");

type Cron = { path?: unknown; schedule?: unknown };

function readConfig(): { crons?: unknown } {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

/**
 * Hobby allows AT MOST ONE run per day. From the time fields alone the only way
 * to guarantee that is a fixed minute AND a fixed hour — `M H * * *`. Anything
 * with `*`, a list, a range or a step in the minute/hour field can fire more
 * than once a day. `*` in the HOUR field is the trap: it reads as "hourly".
 */
function runsAtMostOncePerDay(schedule: string): boolean {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour] = fields;
  const fixed = (f: string) => /^\d+$/.test(f);
  if (!fixed(minute) || !fixed(hour)) return false;
  const m = Number(minute);
  const h = Number(hour);
  return m >= 0 && m <= 59 && h >= 0 && h <= 23;
}

describe("vercel.json cron schedules", () => {
  it("is valid JSON with a crons array", () => {
    const config = readConfig();
    expect(Array.isArray(config.crons)).toBe(true);
  });

  it("declares every cron at most once per day (Vercel Hobby limit)", () => {
    const crons = (readConfig().crons ?? []) as Cron[];
    const offenders: string[] = [];
    for (const cron of crons) {
      const schedule = String(cron.schedule ?? "");
      if (!runsAtMostOncePerDay(schedule)) {
        offenders.push(`${String(cron.path)} -> "${schedule}"`);
      }
    }
    expect(
      offenders,
      `these crons can run more than once per day and will FAIL the Vercel ` +
        `deployment on the Hobby plan: ${offenders.join(", ")}`,
    ).toEqual([]);
  });

  it("gives every cron an absolute path and no duplicates", () => {
    const crons = (readConfig().crons ?? []) as Cron[];
    const paths = crons.map((c) => String(c.path ?? ""));
    for (const p of paths) expect(p.startsWith("/")).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("keeps the unpaid-order-alert sweep registered and daily", () => {
    const crons = (readConfig().crons ?? []) as Cron[];
    const alert = crons.find((c) => c.path === "/api/cron/unpaid-order-alerts");
    expect(alert, "the unpaid-order-alerts cron must stay registered").toBeTruthy();
    expect(runsAtMostOncePerDay(String(alert?.schedule))).toBe(true);
  });
});
