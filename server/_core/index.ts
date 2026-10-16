import "dotenv/config"; // load .env into process.env before env.ts reads it.
// No-op when .env is absent (platform injects real env) and never overrides
// already-set vars - so it's safe in prod. MUST stay the first import.
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { mountClient } from "./serve";
import { env } from "./env";
import { ensureSchemaChecked, ensureUnlinkedUsersChecked } from "./schema-check";

// Node entry point: the single long-lived process used by `pnpm dev:api`,
// `pnpm start`. It builds the shared Hono
// app (server/_core/app.ts - the same route table the Vercel function uses),
// mounts the built SPA in prod, and binds a TCP port.
//
// On Vercel this file is NOT the entry point: `serve()` needs a resident
// process, which serverless functions don't have. Vercel uses api/index.ts
// (hono/vercel) instead, and serves the SPA from its CDN.
const app = createApp();

// Client: prod serves built SPA here; dev is served by Vite (which proxies API).
mountClient(app);

// Non-fatal, fire-and-forget startup check. If the database is behind the code
// (a migration committed but never applied) this logs ONE actionable warning
// naming the missing column/relation and the migration that adds it - the exact
// failure that otherwise surfaces only as an opaque 500 on the first query. It
// never blocks the listener and never throws; a database that is unreachable at
// boot is logged as "skipped" and the app starts anyway.
void ensureSchemaChecked();
// Non-fatal companion check: warn (count only, no PII) when a local user row has
// no Neon Auth link, so an account that cannot sign in is visible at boot.
void ensureUnlinkedUsersChecked();

const port = env.isProd ? env.port : env.apiPort;
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`[server] listening on :${port} (${env.isProd ? "prod" : "dev-api"})`);
