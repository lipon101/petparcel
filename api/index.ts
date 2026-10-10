// Vercel serverless entry point (DESIGN §5.7.3 — the "swap the shim" path).
//
// Vercel auto-detects every file under `api/` as a serverless function. This
// one wraps the SAME Hono app the Node entry uses (server/_core/app.ts) with
// Hono's official Vercel adapter, so /trpc, /api and /app-storage are answered
// by a function while the built SPA is served statically from `dist/public`
// (see vercel.json → outputDirectory + rewrites).
//
// Why this file exists: the app's own entry (server/_core/index.ts) calls
// `serve()` from @hono/node-server, which binds a TCP port — that is a
// long-lived-process API and does NOT exist on Vercel's serverless runtime.
// `hono/vercel`'s `handle()` adapts the same app to Vercel's
// (Request) => Response function signature instead.
//
// `runtime: "nodejs"` is required: the app uses node-postgres (`pg`), bcryptjs
// and node:crypto, none of which run on the Edge runtime.
import "dotenv/config"; // no-op on Vercel (env is injected); keeps local `vercel dev` working
import { handle } from "hono/vercel";
import { createApp } from "../server/_core/app";

export const config = { runtime: "nodejs" };

const app = createApp();

// Vercel rewrites /trpc/*, /api/* and /app-storage/* here while PRESERVING the
// original pathname, so Hono routes on the real path (e.g. /trpc/health).
export default handle(app);
