import "dotenv/config"; // load .env into process.env before env.ts reads it.
// No-op when .env is absent (platform injects real env) and never overrides
// already-set vars — so it's safe in prod. MUST stay the first import.
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { mountClient } from "./serve";
import { env } from "./env";

// Node entry point: the single long-lived process used by `pnpm dev:api`,
// `pnpm start` and the Dockerfile / Cloud Run image. It builds the shared Hono
// app (server/_core/app.ts — the same route table the Vercel function uses),
// mounts the built SPA in prod, and binds a TCP port.
//
// On Vercel this file is NOT the entry point: `serve()` needs a resident
// process, which serverless functions don't have. Vercel uses api/index.ts
// (hono/vercel) instead, and serves the SPA from its CDN.
const app = createApp();

// Client: prod serves built SPA here; dev is served by Vite (which proxies API).
mountClient(app);

const port = env.isProd ? env.port : env.apiPort;
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`[server] listening on :${port} (${env.isProd ? "prod" : "dev-api"})`);
