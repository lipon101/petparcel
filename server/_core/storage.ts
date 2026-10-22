import type { Context } from "hono";
import { and, count, desc, eq, isNull, type SQL } from "drizzle-orm";
import { env } from "./env";
import { db } from "./db";
import { files } from "../../drizzle/schema";
import {
  describeR2,
  isR2Configured,
  r2Delete,
  r2Head,
  r2PresignGet,
  r2PresignPut,
  r2PublicUrl,
  r2Put,
  R2Error,
} from "./r2";

// Scoped file storage client (DESIGN §5.6). The app NEVER holds raw S3 creds -
// it holds one durable scoped credential (APP_STORAGE_TOKEN) and asks the
// platform presign endpoint for a short-lived signed URL per operation. The
// platform clamps every key to this app's prefix (the hard isolation boundary).
type Op = "put" | "get" | "head" | "delete";

export type StorageErrorCode = "not_found" | "forbidden" | "not_configured" | "failed";

/** Storage failures carry a code so routers can map them to tRPC errors.
 *  Same pattern as AuthError in _core/auth.ts. */
export class StorageError extends Error {
  constructor(message: string, readonly code: StorageErrorCode) {
    super(message);
    this.name = "StorageError";
  }
}

// ── driver selection ────────────────────────────────────────────────────────
//
// Two backends can serve this app, and the choice is explicit and logged ONCE
// per process (variable NAMES only, never values):
//   • "r2"       — Cloudflare R2 (the S3 API). Chosen when all five R2_*
//                  variables are present. This is the store's OWN bucket: 10 GB
//                  free, $0 egress, and a public URL the store controls.
//   • "platform" — the platform's scoped object store (APP_STORAGE_PRESIGN_URL /
//                  APP_STORAGE_TOKEN). Kept as the fallback so a deployment that
//                  already has it keeps working with no change.
// With NEITHER, every operation refuses with a clear, actionable sentence
// instead of a vague one.
export type StorageDriver = "r2" | "platform";

export function activeStorageDriver(): StorageDriver | null {
  if (isR2Configured()) return "r2";
  if (env.storage.presignUrl && env.storage.token) return "platform";
  return null;
}

let driverLogged = false;
/** Log which driver is in use, exactly once. Names only — never a value. */
export function logStorageDriver(): void {
  if (driverLogged) return;
  driverLogged = true;
  const d = activeStorageDriver();
  if (d === "r2") {
    console.log(`[storage] driver=r2 (R2 vars present: ${describeR2().join(", ") || "none"})`);
  } else if (d === "platform") {
    console.log("[storage] driver=platform (app-storage presign endpoint)");
  } else {
    console.warn("[storage] driver=none — set the R2_* variables to enable media uploads (see .env.example)");
  }
}

/** The error every driver-aware helper throws when NO backend is configured:
 *  a next step the admin can act on, not "something went wrong". */
function notConfigured(): StorageError {
  return new StorageError(
    "Media storage isn't set up on this deployment yet. Add the R2 storage variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL).",
    "not_configured",
  );
}

/** Translate a driver failure into a StorageError so the routers keep their one
 *  mapping. Anything already a StorageError passes through untouched. */
async function withStorageError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof StorageError) throw e;
    if (e instanceof R2Error) {
      throw new StorageError(e.message, e.code === "not_found" ? "not_found" : e.code === "not_configured" ? "not_configured" : "failed");
    }
    throw e;
  }
}

/** The URL a caller should STORE for a key. With R2 that is the bucket's own
 *  public URL — fast, cacheable from the edge, the store's own domain, and no
 *  redirect hop. With the platform store it is the same-origin read path, which
 *  resolves to a signed URL on demand. */
export function publicPathFor(key: string): string {
  return isR2Configured() ? r2PublicUrl(key) : `/app-storage/${key}`;
}

/** Object metadata, from whichever backend is active. */
async function driverHead(key: string): Promise<{ size: number; contentType: string | null }> {
  const d = activeStorageDriver();
  if (d === "r2") {
    const meta = await withStorageError(() => r2Head(key));
    if (!meta) throw new StorageError(`no such object: ${key}`, "not_found");
    return meta;
  }
  if (d === "platform") return callStorage<{ size: number; contentType: string | null }>("head", key);
  throw notConfigured();
}

/** A presigned PUT URL for the browser upload path (the browser PUTs directly to
 *  the bucket, so the bytes never pass through the serverless function). */
async function driverPutUrl(key: string, contentType?: string): Promise<string> {
  const d = activeStorageDriver();
  if (d === "r2") return withStorageError(() => r2PresignPut(key, contentType));
  if (d === "platform") return (await callStorage<{ url: string }>("put", key, contentType)).url;
  throw notConfigured();
}

/** A short-lived GET URL for the `/app-storage/*` read path. */
async function driverGetUrl(key: string): Promise<string> {
  const d = activeStorageDriver();
  if (d === "r2") return withStorageError(() => r2PresignGet(key));
  if (d === "platform") return (await callStorage<{ url: string }>("get", key)).url;
  throw notConfigured();
}

/** Upload bytes the server already holds — the ingest/optimize path. */
async function driverPutBytes(key: string, bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<void> {
  const d = activeStorageDriver();
  if (d === "r2") {
    await withStorageError(() => r2Put(key, bytes, contentType));
    return;
  }
  if (d === "platform") {
    const { url } = await callStorage<{ url: string }>("put", key, contentType);
    const res = await fetch(url, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: new Blob([bytes], { type: contentType }),
    });
    if (!res.ok) throw new StorageError(`storage upload failed: ${res.status}`, "failed");
    return;
  }
  throw notConfigured();
}

/** Delete the OBJECT for a key (the `files` row is removed separately). */
async function driverDeleteObject(key: string): Promise<void> {
  const d = activeStorageDriver();
  if (d === "r2") {
    await withStorageError(() => r2Delete(key));
    return;
  }
  if (d === "platform") {
    await callStorage<{ deleted: boolean }>("delete", key);
    return;
  }
  throw notConfigured();
}

/** One row of the `files` index. */
export type FileRecord = typeof files.$inferSelect;

/** Strip leading slashes, then REJECT anything that could make this app's
 *  notion of the key diverge from the platform's.
 *
 *  The platform runs `posixpath.normpath` on the key before it ever touches
 *  storage, but this function does NOT normalize - it CANONICALIZES-OR-REJECTS.
 *  Silently normalizing (e.g. collapsing "a/b/../report.pdf" to "a/report.pdf")
 *  would still leave `files.key` holding the un-collapsed string while the
 *  platform head/put/delete/get all clamp to the collapsed one - two different
 *  strings pointing at the same object, which is exactly the aliasing that lets
 *  one user's `assertNotOwnedByOther` lookup miss another user's row (see the
 *  final-review writeup: a committed "./report.pdf" and an existing
 *  "report.pdf" alias the SAME object, but the `unique` index on `key` never
 *  fires because the strings differ).
 *
 *  So: split on "/" and throw StorageError("forbidden") if the key is empty,
 *  or if ANY segment is "" (catches "a//b"), "." or ".." (catch the traversal
 *  aliases). What survives is guaranteed byte-identical to what the platform
 *  computes, because normpath is a no-op on a string with no such segments.
 *
 *  Named to signal it can throw - every call site must let that throw
 *  propagate (StorageError, code "forbidden"), not swallow it. */
function canonicalKey(relKey: string): string {
  const stripped = relKey.replace(/^\/+/, "");
  if (!stripped) throw new StorageError("empty storage key", "forbidden");
  for (const segment of stripped.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new StorageError(`unsafe storage key (diverges from platform normalization): ${relKey}`, "forbidden");
    }
  }
  return stripped;
}

/** Single call into the platform storage endpoint. The app holds one durable
 *  scoped token and never any object-store credential (DESIGN §5.6); the
 *  platform clamps every key to this app's prefix. */
async function callStorage<T>(op: Op, path: string, contentType?: string): Promise<T> {
  if (!env.storage.presignUrl || !env.storage.token) {
    throw new StorageError(
      "App storage not configured (APP_STORAGE_PRESIGN_URL / APP_STORAGE_TOKEN).",
      "not_configured",
    );
  }
  const res = await fetch(env.storage.presignUrl, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.storage.token}` },
    body: JSON.stringify({ op, path, contentType }),
  });
  if (res.status === 404) throw new StorageError(`no such object: ${path}`, "not_found");
  if (!res.ok) throw new StorageError(`storage ${op} failed: ${res.status}`, "failed");
  const body = (await res.json()) as T & { path?: string };

  // Cross-boundary invariant: the platform echoes the key it ACTUALLY acted on,
  // after its own clamping. `canonicalKey` above is written to produce exactly
  // that string, so the two must agree - and if they ever stop agreeing, this is
  // the only place that can notice. When they silently disagreed, an app could
  // index `./x.pdf` while the platform touched `x.pdf`, which let one end user
  // delete another's object through an ownership check that matched the wrong
  // row. Neither repo's tests can catch that (each mocks the other), so assert
  // it at runtime on every call and fail loudly rather than aliasing.
  if (typeof body.path === "string" && body.path !== path) {
    throw new StorageError(
      `storage key normalization disagrees with the platform: sent ${path}, platform used ${body.path}`,
      "forbidden",
    );
  }
  return body;
}

/** Look up one indexed file by its relative key. `null` means "no such row" -
 *  a normal result, which is why this returns null instead of throwing. */
export async function storageGet(relKey: string): Promise<FileRecord | null> {
  const [row] = await db.select().from(files).where(eq(files.key, canonicalKey(relKey))).limit(1);
  return row ?? null;
}

/** Reject a write when the key is already indexed under a DIFFERENT owner.
 *  Opt-in: anonymous/public uploads pass no ownerId and skip the check. */
async function assertNotOwnedByOther(relKey: string, ownerId?: string | null): Promise<void> {
  if (!ownerId) return;
  const existing = await storageGet(relKey);
  if (existing?.ownerId && existing.ownerId !== ownerId) {
    throw new StorageError(`key already owned by another user: ${canonicalKey(relKey)}`, "forbidden");
  }
}

/** Record an upload that has ALREADY landed in object storage.
 *
 *  The browser PUTs straight to the signed URL, so this server never sees the
 *  upload complete - hence the explicit commit. It HEADs the object first, so
 *  (a) a row can only exist if the object does, and (b) size/contentType come
 *  from storage rather than from the client, which could lie about both.
 *
 *  Re-committing the same key (e.g. after a deliberate overwrite) updates the
 *  row in place. Throws StorageError("not_found") if the object isn't there -
 *  and writes nothing.
 *
 *  The owner is set only on the FIRST commit of a key; a re-commit updates
 *  name/size/contentType but never the owner, even if a different `ownerId` is
 *  passed. Visible consequence: an anonymous upload (ownerId null) can never
 *  later be claimed by a logged-in user via re-commit.
 */
export async function storageCommit(
  relKey: string,
  opts: { ownerId?: string | null; name?: string } = {},
): Promise<FileRecord> {
  const key = canonicalKey(relKey);
  await assertNotOwnedByOther(key, opts.ownerId);
  const meta = await driverHead(key);
  const values = {
    key,
    ownerId: opts.ownerId ?? null,
    name: opts.name ?? key.split("/").pop() ?? key,
    size: meta.size,
    contentType: meta.contentType,
  };
  const [row] = await db
    .insert(files)
    .values(values)
    .onConflictDoUpdate({
      target: files.key,
      set: { name: values.name, size: values.size, contentType: values.contentType },
    })
    .returning();
  return row;
}

const MAX_LIMIT = 200;

/** Clamp limit to [1, MAX_LIMIT] and offset to >= 0. Without the lower clamp,
 *  a caller-supplied negative limit (e.g. `limit: -1`) reaches Postgres as
 *  `LIMIT -1`, which Postgres rejects with an error instead of an empty page. */
function page(opts: { limit?: number; offset?: number }) {
  return {
    limit: Math.max(1, Math.min(opts.limit ?? 50, MAX_LIMIT)),
    offset: Math.max(0, opts.offset ?? 0),
  };
}

/** Files owned by ONE user, newest first.
 *
 *  `ownerId` is a required positional argument on purpose: the unsafe call
 *  (listing every user's files) must be spelled out as storageListAll, so it
 *  cannot happen by forgetting an optional field. */
export async function storageListByOwner(
  ownerId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<FileRecord[]> {
  const { limit, offset } = page(opts);
  return db.select().from(files).where(eq(files.ownerId, ownerId))
    .orderBy(desc(files.createdAt)).limit(limit).offset(offset);
}

/** EVERY file in the app, newest first. Not user-scoped - pair it with
 *  adminProcedure, never with protectedProcedure. */
export async function storageListAll(
  opts: { limit?: number; offset?: number } = {},
): Promise<FileRecord[]> {
  const { limit, offset } = page(opts);
  return db.select().from(files).orderBy(desc(files.createdAt)).limit(limit).offset(offset);
}

/** Total number of files owned by ONE user. Pairs with storageListByOwner -
 *  exists so a pager can be built without changing that function's return
 *  shape (a bare array) in already-frozen apps. Same positional-ownerId
 *  reasoning as storageListByOwner. */
export async function storageCountByOwner(ownerId: string): Promise<number> {
  const [row] = await db.select({ value: count() }).from(files).where(eq(files.ownerId, ownerId));
  return row?.value ?? 0;
}

/** Total number of files in the app. Not user-scoped - pair it with
 *  adminProcedure, never with protectedProcedure. Pairs with storageListAll. */
export async function storageCountAll(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(files);
  return row?.value ?? 0;
}

/** Shared body for storageDeleteOwned/storageDeleteAny: delete the row, then
 *  the object, and report whether a row actually matched.
 *
 *  Row-then-object is deliberate. If the object delete fails we leak an
 *  invisible orphan, which the platform's own File storage panel can still see
 *  and remove; the reverse order would leave a row whose download 404s in the
 *  app's UI.
 *
 *  Returns false when no row matched (never existed, or excluded by `where` -
 *  e.g. owned by someone else). Those are NOT distinguished, so this cannot be
 *  used to probe which keys exist. Nothing is deleted from storage in that
 *  case. */
async function deleteRowThenObject(key: string, where: SQL | undefined): Promise<boolean> {
  const removed = await db.delete(files).where(where).returning();
  if (removed.length === 0) return false;
  // The row is already gone, so a storage problem here must NOT fail the
  // request: an unconfigured driver is tolerated (the object is left for the
  // platform's own file panel to clear) rather than turning a delete into a 500.
  try {
    await driverDeleteObject(key);
  } catch (e) {
    if (!(e instanceof StorageError && e.code === "not_configured")) throw e;
  }
  return true;
}

/** Delete one indexed file OWNED BY `ownerId`.
 *
 *  `ownerId` is a required positional argument on purpose - same reasoning as
 *  storageListByOwner: the unsafe, unscoped delete must be spelled out as
 *  storageDeleteAny, so it cannot happen by forgetting an optional field. Keys
 *  are visible in /app-storage/<key> URLs, so an unscoped delete reachable by
 *  a caller-supplied key would let one user delete another user's file. */
export async function storageDeleteOwned(ownerId: string, relKey: string): Promise<boolean> {
  const key = canonicalKey(relKey);
  return deleteRowThenObject(key, and(eq(files.key, key), eq(files.ownerId, ownerId)));
}

/** Delete one indexed file REGARDLESS OF OWNER. Not user-scoped - pair it
 *  with adminProcedure, never with protectedProcedure. This is the
 *  explicitly-named unsafe escape hatch (mirrors storageListAll): a business
 *  router should almost never call this with a caller-supplied key. */
export async function storageDeleteAny(relKey: string): Promise<boolean> {
  const key = canonicalKey(relKey);
  return deleteRowThenObject(key, eq(files.key, key));
}

/** Delete one indexed file that has NO OWNER (a public/anonymous upload, e.g.
 *  a contact-form attachment). Scoped with `isNull(files.ownerId)`, so a row
 *  that DOES have an owner is excluded - same false-return semantics as
 *  storageDeleteOwned: "no row matched" and "matched but excluded" are not
 *  distinguished, and nothing is deleted from storage in that case.
 *
 *  Exists so "let the visitor remove the attachment they just added" has a
 *  compliant primitive: without it, that recipe has no scoped delete to reach
 *  for and an LLM is liable to call storageDeleteAny from a publicProcedure,
 *  which lets any visitor delete any file by key. */
export async function storageDeleteAnonymous(relKey: string): Promise<boolean> {
  const key = canonicalKey(relKey);
  return deleteRowThenObject(key, and(eq(files.key, key), isNull(files.ownerId)));
}

/** Signed PUT URL; the caller uploads the bytes to it directly, then calls
 *  storageCommit(relKey) to index the result.
 *
 *  Pass `ownerId` on any authenticated path. Keys are visible in
 *  /app-storage/<key> URLs, so without it one logged-in user could request a
 *  PUT URL for another user's file and overwrite it. The check is opt-in
 *  because public/anonymous uploads have no owner to compare against, and it
 *  only covers files already committed - hence the random key prefix in the
 *  filesRouter example. */
export async function storagePutUrl(
  relKey: string,
  contentType?: string,
  opts: { ownerId?: string | null } = {},
): Promise<{ uploadUrl: string; publicPath: string }> {
  const key = canonicalKey(relKey);
  await assertNotOwnedByOther(key, opts.ownerId);
  const uploadUrl = await driverPutUrl(key, contentType);
  return { uploadUrl, publicPath: publicPathFor(key) };
}

/** Upload bytes to a key we own, then record the `files` row - the server-side
 *  twin of the presigned-put flow the browser uses.
 *
 *  This is what makes ingest possible: the platform presign endpoint hands out
 *  a short-lived PUT URL, we send the fetched bytes to it, and then commit the
 *  row exactly as the browser path does. The returned `/app-storage/<key>` URL
 *  is OURS - the third-party source is never stored or emitted. */
export async function storagePutBytes(
  relKey: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  opts: { ownerId?: string | null; name?: string } = {},
): Promise<{ key: string; url: string }> {
  const key = canonicalKey(relKey);
  await assertNotOwnedByOther(key, opts.ownerId);
  await driverPutBytes(key, bytes, contentType);
  await storageCommit(key, { ownerId: opts.ownerId, name: opts.name });
  return { key, url: publicPathFor(key) };
}

/** Hono handler for GET /app-storage/* - 307-redirects to a short-lived signed
 *  GET URL. Mounted by _core/index.ts; app code just links to /app-storage/...
 *  Routed through canonicalKey like every other entry point: without it,
 *  "/app-storage//x.png" would reach the wire with a leading slash the
 *  platform's own normpath would collapse, the same key-aliasing this file's
 *  canonicalKey exists to close off. A rejected key falls through to the
 *  existing catch and renders as a 404, never a 500. */
export async function serveAppStorage(c: Context): Promise<Response> {
  const raw = c.req.path.replace(/^\/app-storage\//, "");
  try {
    const key = canonicalKey(raw);
    const url = await driverGetUrl(key);
    c.header("Cache-Control", "no-store");
    return c.redirect(url, 307);
  } catch {
    return c.text("Not found", 404);
  }
}
