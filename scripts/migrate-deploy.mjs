// Apply pending Drizzle migrations as part of the Vercel build.
//
// WHY THIS EXISTS: the deployed app talks to a production Postgres that is NOT
// reachable from a developer sandbox, so a migration that is generated and
// committed but never applied leaves the live schema BEHIND the code. The
// symptom is a storefront that 500s on every catalog read with an opaque
// "Something went wrong" - the real cause is a missing column (e.g.
// `products.specs`, added by 0004) that the query selects. Running the
// migrations here, at build time, keeps the schema in step with the code on
// every deploy.
//
// SAFETY: this is a NO-OP when DATABASE_URL is absent (a local `pnpm build`, a
// CI typecheck job, a preview build with no DB) - it prints a notice and exits
// 0, so it can never break a build that has no database. When DATABASE_URL IS
// present it runs `drizzle-kit migrate`, which is idempotent: already-applied
// migrations are skipped, so re-running on every deploy is safe.
//
// It NEVER prints the connection string or any secret - only the migration
// outcome.
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log(
    "[migrate] DATABASE_URL is not set - skipping migrations (this is expected for a local build or CI).",
  );
  process.exit(0);
}

console.log("[migrate] DATABASE_URL is set - applying pending migrations...");
const result = spawnSync(
  process.execPath,
  ["node_modules/drizzle-kit/bin.cjs", "migrate"],
  { stdio: "inherit", env: process.env },
);

if (result.error) {
  console.error("[migrate] failed to launch drizzle-kit:", result.error.message);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(
    `[migrate] drizzle-kit migrate exited with code ${result.status}. ` +
      "The build is stopped so a schema-behind deployment is never published.",
  );
  process.exit(result.status ?? 1);
}
console.log("[migrate] migrations applied successfully.");
