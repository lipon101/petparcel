import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Dev model (DESIGN §5.1 / M1): Vite serves the SPA on PORT (default 3000) with
// native HMR; API calls to /trpc and /app-storage are proxied to the Hono API
// process (dev:api on API_PORT, default 3001). In prod there is NO Vite - the
// single Hono process (dist/index.js) serves the built client from dist/public
// AND the API. Keeping runtime fs to that one prod shim (server/_core/serve.ts)
// is what keeps the template edge-portable (§5.7.3).
//
// base: '/' - the template ASSUMES a per-app origin at the root path. It does
// NOT support being mounted under a shared-host path prefix (DESIGN §5.1 / #13).
const WEB_PORT = Number(process.env.PORT ?? 3000);
const API_PORT = Number(process.env.API_PORT ?? 3001);
const apiProxy = { target: `http://localhost:${API_PORT}`, changeOrigin: true };

export default defineConfig({
  base: "/",
  // Tailwind v4 runs as a Vite plugin (no tailwind.config / postcss / autoprefixer);
  // it auto-detects content, theme tokens live in client/src/index.css (@theme).
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client/src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  server: {
    port: WEB_PORT,
    host: true,
    // This dev server is reachable from the public internet: a preview share
    // link (platform-side `create_preview_share_link`) proxies straight to this
    // port, and the holder is by definition someone outside the project. Both
    // options below are load-bearing because of that, not general hardening.
    //
    // allowedHosts - Vite's default is `[]`, which 403s every Host header that
    // is not an IP or localhost. Previews work today only because the upstream
    // proxy happens to rewrite Host before the request reaches this process:
    // somebody else's implementation detail standing in for configuration. If
    // that ever changes, every preview turns into "Blocked request" at once,
    // and the failure is invisible from this repo. Naming the domains makes the
    // dependency explicit and survives the day the upstream stops rewriting.
    // Leading dot = that host and any subdomain (Vite's `isHostAllowed`).
    allowedHosts: [
      ".preview.teamily.run",
      ".preview.chainopera.run",
      ".proxy.daytona.works",
    ],
    // fs.allow - the default is the workspace root, i.e. the WHOLE app tree, so
    // `/@fs/<app>/server/routers.ts` hands the server source (auth wiring, tRPC
    // procedure definitions, schema) to anyone holding a preview link. `.env`
    // is denied either way by `fs.deny`, so no credential leaks; what leaks is
    // the map of which procedures are unauthenticated - which is exactly the
    // thing a share-link visitor would need it for.
    //
    // The client only ever needs its own tree plus `shared/` (the `@shared/*`
    // alias). `server/` reaches the client through `import type` alone, which
    // esbuild erases, so it never enters the module graph. Narrowing the list
    // does not break real imports: import analysis marks each resolved module
    // path safe as it is served, which is how node_modules deps stay reachable.
    fs: {
      allow: [
        path.resolve(import.meta.dirname, "client"),
        path.resolve(import.meta.dirname, "shared"),
      ],
    },
    proxy: {
      "/trpc": apiProxy,
      "/app-storage": apiProxy,
      "/api": apiProxy,
    },
  },
  build: {
    // Client build lands in dist/public; the prod server serves it statically.
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // The app chunk is split into per-route chunks and shared vendor chunks (see
    // manualChunks below), so no single file should approach this. It is set so a
    // genuinely oversized chunk is still reported rather than hidden by a raised
    // default.
    chunkSizeWarningLimit: 400,
    // Split the vendor libraries out of the single app chunk. Without this the
    // whole SPA ships as one ~616 kB bundle and Vite warns that it exceeds the
    // 500 kB threshold. React and the tRPC/React-Query data layer change far
    // less often than app code, so separating them also lets the browser keep
    // them cached across deploys. Purely a chunking change - no behaviour.
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requires the function form of manualChunks.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/react-dom/") ||
            id.includes("/react/") ||
            id.includes("/scheduler/")
          ) {
            return "react";
          }
          if (
            id.includes("@tanstack") ||
            id.includes("@trpc") ||
            id.includes("/superjson/")
          ) {
            return "data";
          }
          // Icons and the Radix primitives are a large, rarely-changing tree of
          // individual modules. Left in the app chunk, lucide alone is its single
          // biggest contributor; grouped here it stays cacheable across deploys
          // and keeps the per-page chunks small.
          if (id.includes("/lucide-react/") || id.includes("/@radix-ui/")) {
            return "ui";
          }
          return undefined;
        },
      },
    },
  },
  // The routers import _core/db (for isUniqueViolation), which binds the env at
  // import time - so the test runner needs well-formed values even though every
  // data call is mocked. The platform injects the real ones at runtime.
  test: {
    setupFiles: [path.resolve(import.meta.dirname, "vitest.setup.ts")],
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/petparcel_test",
      JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-not-for-production",
    },
  },
});
