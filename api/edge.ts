// Vercel EDGE runtime entry — the opt-in alternative to api/index.ts.
//
// Same Hono app as the Node entry (server/_core/app.ts), but running on Vercel's
// Edge runtime instead of a Node serverless function. Edge has no node:net /
// node:tls, so this file (and everything it pulls in) must stay free of Node
// builtins. What that required — each item verified against a real edge-target
// esbuild build, see the report:
//
//   1. NO `dotenv` import. On Edge there is no .env file to read; Vercel injects
//      env vars into the isolate and _core/env.ts reads them from process.env.
//      api/index.ts keeps `import "dotenv/config"` for local `vercel dev`; the
//      Edge entry does not, because dotenv touches node:fs.
//   2. NO server/_core/serve.ts. That module mounts the built SPA with
//      @hono/node-server/serve-static + node:fs/promises, which the Edge runtime
//      does not have. On Vercel the SPA is served from the CDN anyway
//      (outputDirectory: dist/public), so the Edge function only answers the API.
//   3. DB_DRIVER MUST be "http". The Edge runtime has no TCP socket API, so
//      node-postgres (`pg`) cannot connect. @neondatabase/serverless talks to
//      Postgres over HTTPS (fetch) and is the only supported driver here.
//      _core/db.ts loads `pg` only through a non-literal dynamic import, so it is
//      never linked into this bundle; with DB_DRIVER=http the tcp branch is never
//      taken at runtime either. If DB_DRIVER is left unset on Edge it defaults to
//      "tcp" and the first request fails — set DB_DRIVER=http in the project env.
//   4. bcryptjs / jose are fine: bcryptjs ships a browser mapping that drops its
//      node:crypto fallback (it uses Web Crypto), and jose is Web Crypto based.
//   5. crypto.randomUUID() is a global on Edge (it is on Node 19+ too), so the
//      id generation in server/db.ts needs no change.
//
// TRADE-OFFS vs the Node runtime (api/index.ts) — see EDGE_RUNTIME report:
//   + lower latency (edge placement, no cold-start container spin-up), global
//   - HTTP-driver-only DB access: NO interactive transactions. `atomic()` still
//     works — it maps to db.batch (a single HTTPS round-trip Neon wraps in a
//     server-side BEGIN/COMMIT) — but the tcp transaction path and anything else
//     needing a held session is unavailable.
//   - no filesystem, no long-lived process, no Node native modules
//   - a smaller, more constrained runtime; Vercel itself now recommends Node.js
//     for most workloads, so choose Edge deliberately.
import { handle } from "hono/vercel";
import { createApp } from "../server/_core/app";

// Vercel reads this to select the Edge runtime for this function. (Equivalent to
// the vercel.json `functions` entry; the in-file export is authoritative.)
export const config = { runtime: "edge" };

const app = createApp();

// Vercel rewrites /trpc/*, /api/* and /app-storage/* here while PRESERVING the
// original pathname, so Hono routes on the real path (e.g. /trpc/health).
export default handle(app);
