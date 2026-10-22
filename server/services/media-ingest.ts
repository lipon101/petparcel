// Server-side media ingest: fetch a third-party asset (an upstream supplier image or
// video), VALIDATE it, OPTIMIZE it, store OUR OWN copy, and hand back a URL we
// serve ourselves.
//
// Why this exists: pasting a supplier URL straight into a product hotlinks it,
// which (a) reveals the source to anyone who inspects the page, (b) makes the
// store depend on the supplier's uptime and hotlink policy, and (c) cannot
// support video at all. Ingesting once fixes all three: after the copy lands,
// the store serves the bytes itself and the source URL never reaches a browser.
//
// The rules that decide what we will fetch are pure and live in shared/media.ts
// (isIngestableSourceUrl, kindForContentType, sniffContentType, size caps), so
// they are unit-tested without a network. The shrink step lives in
// ./media-optimize (sharp for images, ffmpeg for video, both optional). This
// module is the I/O.
import {
  kindForContentType,
  extensionForContentType,
  isIngestableSourceUrl,
  sniffContentType,
  MAX_VIDEO_BYTES,
  type MediaKind,
} from "../../shared/media";
import { publicPathFor, StorageError, storagePutBytes } from "../_core/storage";
import { optimizeForKind, formatRatio } from "./media-optimize";

export type IngestResult =
  | { ok: true; url: string; kind: MediaKind; note: string | null; savedBytes: number }
  | { ok: false; reason: string };

const FETCH_TIMEOUT_MS = 15_000;
/** Never buffer more than the largest thing we would accept; a bigger body is
 *  refused mid-stream rather than after it has been read into memory. */
const HARD_READ_CAP = MAX_VIDEO_BYTES;
/** Ceiling for a file posted to `admin.optimizeMedia`. Set ABOVE the stored
 *  caps on purpose: a 20 MB phone photo SHOULD be accepted here and shrunk,
 *  rather than refused for the crime of being larger than what we store. */
export const UPLOAD_HARD_CAP = 52 * 1024 * 1024;

/** Read a response body, refusing to buffer past `cap` bytes. */
async function readCapped(res: Response, cap: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > cap) return null;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > cap ? null : buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Decode a base64 payload from the admin form (a leading `data:` prefix is
 *  tolerated and stripped). Returns null when there is nothing decodable. */
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> | null {
  try {
    const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
    const buf = Buffer.from(clean, "base64");
    if (buf.byteLength === 0) return null;
    return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) as Uint8Array<ArrayBuffer>;
  } catch {
    return null;
  }
}

/** The one place a copy is saved. Maps storage failures to SHORT, actionable
 *  sentences - and never to the old dead-end "storage isn't available". */
async function saveCopy(
  kind: MediaKind,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  opts: { ownerId?: string | null; name?: string },
): Promise<IngestResult> {
  const ext = extensionForContentType(contentType);
  const key = `products/${crypto.randomUUID()}.${ext}`;
  try {
    const { url } = await storagePutBytes(key, bytes, contentType, {
      ownerId: opts.ownerId ?? null,
      name: opts.name ?? `media-${kind}.${ext}`,
    });
    return { ok: true, url, kind, note: null, savedBytes: 0 };
  } catch (e) {
    if (e instanceof StorageError && e.code === "not_configured") {
      // The storage layer already writes the actionable sentence (which
      // variables to set). Surface it verbatim rather than replacing it with a
      // vague apology - the admin needs to know what to fix.
      return { ok: false, reason: e.message };
    }
    return { ok: false, reason: "We couldn't save your copy just now. Please try again." };
  }
}

/**
 * Fetch `sourceUrl`, optimize, and store our own copy. Never throws: every
 * failure is a `{ ok: false, reason }` with a short sentence the admin form can
 * show, so a bad link is a clear message rather than a 500.
 */
export async function ingestMediaFromUrl(
  sourceUrl: string,
  opts: { ownerId?: string | null; name?: string; kindHint?: MediaKind } = {},
): Promise<IngestResult> {
  const trimmed = sourceUrl.trim();
  if (!isIngestableSourceUrl(trimmed)) {
    return { ok: false, reason: "That isn't a public http(s) link we can fetch." };
  }

  let res: Response;
  try {
    res = await fetch(trimmed, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "PetParcel/1.0 (product media ingest)" },
    });
  } catch {
    return { ok: false, reason: "We couldn't reach that link. Check it and try again." };
  }
  if (!res.ok) return { ok: false, reason: `The source returned ${res.status}. Check the link.` };

  const body = await readCapped(res, HARD_READ_CAP);
  if (!body) return { ok: false, reason: "That file is too large to import (50 MB max)." };

  // Trust the BYTES over the header: a supplier can serve an HTML error page
  // with an image content-type, and an extension is not evidence at all.
  const sniffed = sniffContentType(body);
  const header = res.headers.get("content-type");
  const headerKind = kindForContentType(header);
  const kind: MediaKind | null = sniffed ?? headerKind ?? opts.kindHint ?? null;
  if (!kind) {
    return { ok: false, reason: "That link isn't a PNG, JPEG, GIF, WebP, AVIF, MP4 or WebM file." };
  }

  const declared =
    kind === "video"
      ? header?.startsWith("video/")
        ? header.split(";")[0]!.trim()
        : "video/mp4"
      : header?.startsWith("image/")
        ? header.split(";")[0]!.trim()
        : "image/jpeg";

  return finalize(kind, body, declared, opts);
}

/**
 * Optimize bytes the server already holds (a file the admin uploaded straight
 * to the API) and store our own copy. This is the path that lets an upload be
 * SHRUNK before it is stored, rather than a presigned PUT which stores raw.
 */
export async function ingestOptimizedBytes(
  kind: MediaKind,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  opts: { ownerId?: string | null; filename?: string } = {},
): Promise<IngestResult> {
  if (bytes.byteLength > UPLOAD_HARD_CAP) {
    return { ok: false, reason: "That file is over 50 MB. Please upload a smaller one." };
  }
  return finalize(kind, bytes, contentType, { ownerId: opts.ownerId, name: opts.filename });
}

/** Optimize, enforce the cap, then store. Shared by both entry points. */
async function finalize(
  kind: MediaKind,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  opts: { ownerId?: string | null; name?: string },
): Promise<IngestResult> {
  const optimized = await optimizeForKind(kind, bytes, contentType);
  if (optimized.overCap) return { ok: false, reason: optimized.overCap };

  const result = await saveCopy(kind, optimized.bytes, optimized.contentType, opts);
  if (!result.ok) return result;

  // Report the saving in the server log (bytes only - never a file name or URL).
  const saved = optimized.before - optimized.after;
  console.log(`[media] ${kind} ${optimized.optimized ? "optimized" : "stored as-is"}: ${formatRatio(optimized.before, optimized.after)}`);

  return { ...result, note: optimized.note, savedBytes: saved > 0 ? saved : 0 };
}

/** What the admin form should say after a successful import/upload. Pure. */
export function describeSave(sizeBefore: number, sizeAfter: number): string {
  if (sizeAfter >= sizeBefore) return "Saved.";
  return `Saved and optimized: ${formatRatio(sizeBefore, sizeAfter)}.`;
}

/** Re-exported so callers/tests can assert the read path is driver-aware. */
export { publicPathFor };
