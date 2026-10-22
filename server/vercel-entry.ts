// Vercel serverless entry (SOURCE). `pnpm build` bundles THIS file into a
// self-contained `api/index.js` that Vercel deploys as the function (see
// scripts/build-server.mjs). Nothing imports it at runtime - only esbuild reads it.
//
// THREE runtime problems are fixed here; all produced a dead API with an empty
// product grid, and none is visible from the source alone:
//
// 1. DEPENDENCY TRACING. Vercel builds a Node function by transpiling the `api/`
//    entry and tracing its imports with @vercel/nft. That trace found NOTHING:
//    nft cannot parse a TypeScript entry, and the app was imported with an
//    EXTENSIONLESS specifier it cannot resolve. The deployed function shipped
//    without the server code or its dependencies and threw MODULE_NOT_FOUND at
//    module load (Vercel's 96-byte FUNCTION_INVOCATION_FAILED / HTTP 500).
//    -> Solved by pre-bundling: build-server.mjs inlines the app into
//       api/index.js, leaving only real npm specifiers for the trace to follow.
//
// 2. HANDLER SIGNATURE. This function declares `runtime: "nodejs"`, where Vercel
//    invokes a default-exported function as a Node request listener
//    `(req: IncomingMessage, res: ServerResponse)`. `hono/vercel`'s `handle()`
//    is Hono's EDGE adapter and expects a Web `Request`; hiding it behind a
//    `(req)`-only function did not error - it HUNG, because the Node request is
//    not a valid `Request`, so the adapter's promise never settled and every
//    call timed out with zero bytes.
//    -> Solved with `@hono/node-server/vercel`'s `handle()`, the adapter built
//       for exactly this Node signature. It is pinned to @hono/node-server v1
//       (v2 dropped the `/vercel` export).
//
// 3. BOOT FAILURES. The app is built INSIDE the first request, not at module
//    scope, so a boot throw is caught and answered as diagnosable JSON instead
//    of taking the whole module down (which Vercel renders as the message-less
//    FUNCTION_INVOCATION_FAILED page).
//
// No `dotenv`: Vercel injects the environment, and esbuild cannot inline
// dotenv's dynamic `require("fs")` into an ESM bundle (the Node entry,
// server/_core/index.ts, still loads it).
import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "@hono/node-server/vercel";
import { createApp } from "./_core/app";
import { mountClient } from "./_core/serve";
import { ensureSchemaChecked, ensureUnlinkedUsersChecked } from "./_core/schema-check";

export const config = { runtime: "nodejs" };

// Built ONCE per warm instance, lazily, so a boot throw is catchable.
let handler: ReturnType<typeof handle> | undefined;

export default function vercelHandler(req: IncomingMessage, res: ServerResponse): void {
  try {
    if (!handler) {
      // First request on this warm instance: run the non-fatal schema check once
      // (memoised inside ensureSchemaChecked) so a database behind the code is
      // logged as one actionable warning instead of only failing queries. It
      // does not delay the request - the check is not awaited.
      void ensureSchemaChecked();
      void ensureUnlinkedUsersChecked();
      const app = createApp();
      // ── Serve the SPA shell from the FUNCTION, not only from the CDN ─────────
      // `vercel.json` used to send every unfiled HTML route to the STATIC
      // `/index.html`. Vercel matches the filesystem before rewrites, so this
      // function never saw an HTML request in production and `injectSeo` - the
      // per-product title, description, canonical and JSON-LD - never ran. Every
      // product landing page (the feed's `link` target) was therefore the
      // byte-identical homepage shell, which is a landing-page mismatch: Google
      // Merchant Center crawls that URL and will not approve an item whose page
      // does not present the advertised product. The fallback rewrite now points
      // here (`/api/index`) and this mount is what answers it.
      mountClient(app);
      handler = handle(app);
    }
    handler(req, res);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[api] boot failed", err);
    const message = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "boot_failed", message }));
  }
}
