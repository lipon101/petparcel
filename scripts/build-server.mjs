// Bundle the server via esbuild's JS API (not the CLI). The CLI's bin shim can
// break under some pnpm/Node combos (native binary invoked via node); the JS
// API is the portable, recommended path for build scripts.
import * as esbuild from "esbuild";

await esbuild.build({
  // TWO entries: the server, and the Node-only tcp DB path it loads at runtime
  // via a NON-LITERAL dynamic import (`./db-tcp`). Because that specifier is not
  // a literal, esbuild cannot inline or rewrite it, so dist/index.js resolves the
  // sibling ./db-tcp.js at runtime — which is why db-tcp.ts must be emitted too.
  // (Keeping the specifier non-literal is what keeps `pg` out of the Vercel Edge
  // bundle; see server/_core/db.ts and server/_core/db-tcp.ts.)
  entryPoints: ["server/_core/index.ts", "server/_core/db-tcp.ts"],
  bundle: true,
  platform: "node",
  packages: "external", // keep node_modules external; installed at runtime
  format: "esm",
  outdir: "dist",
  logLevel: "info",
});
