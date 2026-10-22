// Bundle the server via esbuild's JS API (not the CLI). The CLI's bin shim can
// break under some pnpm/Node combos (native binary invoked via node); the JS
// API is the portable, recommended path for build scripts.
//
// TWO bundles are produced:
//
//   1. dist/index.js  - the long-lived Node server (server/_core/index.ts),
//      used by `pnpm start` and local dev. node_modules stay external.
//
//   2. api/index.js   - the Vercel serverless function, built from
//      server/vercel-entry.ts. This one is SELF-CONTAINED: Vercel builds a Node
//      function by transpiling the `api/` entry and handing it to @vercel/nft to
//      trace its dependencies, and that trace silently finds NOTHING for this
//      app (nft cannot parse the TS entry, and the app is imported by an
//      EXTENSIONLESS specifier it cannot resolve). The deployed function then
//      contained neither the server code nor its deps, so the first import threw
//      MODULE_NOT_FOUND at module load - surfacing as Vercel's opaque 96-byte
//      FUNCTION_INVOCATION_FAILED (HTTP 500) on every /api, /trpc and
//      /app-storage call, with an EMPTY product list. Shipping a pre-bundled
//      artifact removes the trace from the picture entirely: there is nothing
//      left for nft to miss, because everything is inlined.
//
//      `packages: "external"` keeps node_modules imports as bare specifiers
//      (Vercel installs them from package.json); only the app's OWN source is
//      inlined, which is exactly the part nft was failing to find.
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["server/_core/index.ts"],
  bundle: true,
  platform: "node",
  packages: "external", // keep node_modules external; installed at runtime
  format: "esm",
  outfile: "dist/index.js",
  logLevel: "info",
});

await esbuild.build({
  entryPoints: ["server/vercel-entry.ts"],
  bundle: true,
  platform: "node",
  packages: "external", // node_modules stay external; the app's own source is inlined
  format: "esm",
  outfile: "api/index.js",
  logLevel: "info",
});
