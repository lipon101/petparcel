// Node-only DB path: the node-postgres TCP pool.
//
// Split out of db.ts on purpose. `pg` reaches for node:net / node:tls / node:util
// and cannot run on the Vercel Edge runtime, so db.ts must NOT import it
// statically: an edge-target bundle fails outright (esbuild: "Could not resolve
// 'events' / 'util'" — pg's transitive requires resolve to unbuilt node core
// modules) and Vercel's Edge validation rejects any bundle that references
// node:stream / node:net ("referencing unsupported modules").
//
// db.ts therefore loads THIS module through a NON-LITERAL dynamic import (see
// `tcpModule` there), which a bundler leaves unresolved — so no pg code is ever
// linked into an Edge build.
//
// Consequence for the Node build: because the specifier is non-literal, esbuild
// cannot statically resolve or rewrite it, so `dist/index.js` resolves the
// sibling `./db-tcp.js` at RUNTIME. scripts/build-server.mjs therefore emits BOTH
// entries (index.ts + db-tcp.ts) into dist/ — see that script.
import { drizzle as drizzleTcp } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../../drizzle/schema";
import { env } from "./env";
import type { AppDB } from "./db"; // type-only: erased at runtime, no import cycle

export function makeTcp(): AppDB {
  // `max` is bounded deliberately (see env.dbPoolMax): on the platform this pool
  // is one of many against a single shared Postgres cluster. node-postgres closes
  // idle clients on its own, so the cap only binds under concurrent load - which
  // is exactly when an unbounded pool would take slots away from other apps.
  const pool = new pg.Pool({ connectionString: env.databaseUrl, max: env.dbPoolMax });
  // A pool with no error handler is a process that exits. Postgres (and Neon)
  // closes idle connections, and on a scale-to-zero runtime the container is
  // frozen between requests, so this is the normal case, not the exotic one:
  // node treats an idle client's 'error' as unhandled and kills the process,
  // while the pool itself would just discard the client and carry on.
  pool.on("error", (err) => console.error("[db] idle client error", err));
  return drizzleTcp(pool, { schema }) as unknown as AppDB;
}
