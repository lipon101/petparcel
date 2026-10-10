import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveAppStorage } from "./storage";
import { getJob } from "./jobs";

// The Hono application, WITHOUT any runtime binding.
//
// This is the single source of truth for the app's routes, shared by BOTH
// entry points so they can never drift:
//   - server/_core/index.ts  → the Node entry (`@hono/node-server`), used by
//     `pnpm dev:api`, `pnpm start` and the Dockerfile / Cloud Run image. It
//     additionally mounts the built SPA (see serve.ts) and calls serve().
//   - api/index.ts           → the Vercel serverless entry (`hono/vercel`).
//     Vercel serves the built SPA from its CDN (outputDirectory: dist/public),
//     so this entry does NOT mount the client — it only answers the API.
//
// Keeping the route table here (not in index.ts) is what lets the same API run
// on a long-lived Node host AND on Vercel without duplicating the wiring.
export function createApp(): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true }));

  // tRPC — all app business endpoints live under /trpc (agent writes routers.ts).
  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      createContext: (_opts, c) => createContext(c),
    }),
  );

  // Scoped per-app file storage (DESIGN §5.6): 307 → short-lived signed S3 URL.
  app.all("/app-storage/*", (c) => serveAppStorage(c));

  // Platform-signed scheduled-job callback (DESIGN §8.4). The body runs in THIS
  // app's runtime; the platform only triggers on schedule. Until the platform
  // signature scheme exists we REQUIRE (and, later, verify) a signature header,
  // so a registered job can never be triggered by an anonymous caller.
  // TODO(§8.4): replace the presence check with real HMAC verification.
  app.post("/api/_jobs/:name", async (c) => {
    const signature = c.req.header("x-platform-signature");
    if (!signature /* || !verifyPlatformSignature(c, signature) */) {
      return c.text("unauthorized (job callback signature required — DESIGN §8.4)", 401);
    }
    const handler = getJob(c.req.param("name"));
    if (!handler) return c.text("no such job", 404);
    try {
      await handler();
      return c.json({ ok: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[jobs] "${c.req.param("name")}" failed`, err);
      return c.text("job failed", 500);
    }
  });

  return app;
}
