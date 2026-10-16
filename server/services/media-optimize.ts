// Server-side media optimization: shrink an asset BEFORE we store it, so the
// store pays for — and the shopper downloads — a web-sized file rather than the
// 4 MB JPEG a phone camera produces.
//
// Two tools, and BOTH are optional by design:
//   • images  -> `sharp` (a normal dependency; the native binary is available on
//                Vercel's Node runtime, so this works in production).
//   • video   -> the `ffmpeg` binary (present in the Docker image and in a local
//                dev environment; NOT present in a Vercel serverless function).
//
// Neither is allowed to break an upload. If a tool is unavailable, or refuses a
// file, the ORIGINAL bytes are stored and the caller is told why via `note`, so
// a deployment without ffmpeg still accepts video — it just stores it as-is.
// That is the honest behaviour the brief asks for; silently failing is not.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, type MediaKind } from "../../shared/media";

/** Longest edge of a stored image. 1600px covers a 2x retina product tile and a
 *  full-width gallery shot without shipping a 6000px camera JPEG. */
export const IMAGE_MAX_DIMENSION = 1600;
/** WebP quality. 82 is the point where a product photo is visually identical to
 *  the source at normal viewing size while being a fraction of the bytes. */
export const WEBP_QUALITY = 82;
/** Videos are scaled to at most 1080p; anything taller is wasted on a phone. */
export const VIDEO_MAX_HEIGHT = 1080;
/** H.264 CRF: 24 is "visually lossless enough" for product footage. */
export const VIDEO_CRF = 24;
/** The `preset` ffmpeg uses. `veryfast` keeps a short clip's encode to seconds. */
export const VIDEO_PRESET = "veryfast";
/** Give ffmpeg a hard ceiling; a pathological input must not hang the request. */
export const VIDEO_TIMEOUT_MS = 60_000;

export interface OptimizeResult {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
  /** Bytes before / after, so callers can report a real ratio. */
  before: number;
  after: number;
  /** True when the stored bytes are the optimized ones. */
  optimized: boolean;
  /** A short human sentence when optimization was skipped — null on success. */
  note: string | null;
}

/** Never store something LARGER than we were given. A already-compressed WebP, or
 *  a tiny icon, can re-encode bigger; in that case the original wins. Pure and
 *  unit-tested. */
export function keepSmaller(
  original: Uint8Array<ArrayBuffer>,
  optimized: Uint8Array<ArrayBuffer>,
): Uint8Array<ArrayBuffer> {
  return optimized.byteLength < original.byteLength ? optimized : original;
}

/** Does this image benefit from a re-encode? GIF is excluded: re-encoding drops
 *  the animation frames, which would silently destroy an animated product GIF. */
export function isOptimizableImage(contentType: string): boolean {
  const t = contentType.split(";")[0]!.trim().toLowerCase();
  return t === "image/png" || t === "image/jpeg" || t === "image/webp" || t === "image/avif";
}

export function isOptimizableVideo(contentType: string): boolean {
  const t = contentType.split(";")[0]!.trim().toLowerCase();
  return t === "video/mp4" || t === "video/webm" || t === "video/quicktime";
}

// ── image ─────────────────────────────────────────────────────────────────────

// `sharp`'s default export is a FACTORY function, but its bundled .d.ts makes
// `typeof import("sharp")` lose the call signature, so `sharp(...)` was a TS2349.
// Modelling the factory explicitly keeps the call checked against sharp's own
// `Sharp` type.
type SharpFactory = (input: Buffer) => import("sharp").Sharp;
let sharpModule: SharpFactory | null | undefined;

/** Load sharp once, or remember that it is unavailable. A missing native binary
 *  must degrade, not crash the function at import time. */
export async function loadSharp(): Promise<SharpFactory | null> {
  if (sharpModule !== undefined) return sharpModule;
  try {
    const mod = (await import("sharp")) as unknown as { default: SharpFactory };
    sharpModule = mod.default;
  } catch {
    sharpModule = null;
  }
  return sharpModule;
}

/** Resize to `IMAGE_MAX_DIMENSION` and re-encode to WebP. Returns the original
 *  unchanged (with a note) whenever sharp is missing or the input is not a
 *  format we should touch. */
export async function optimizeImage(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<OptimizeResult> {
  const before = bytes.byteLength;
  const passthrough = (note: string): OptimizeResult => ({
    bytes,
    contentType,
    before,
    after: before,
    optimized: false,
    note,
  });

  if (!isOptimizableImage(contentType)) {
    return passthrough(contentType.startsWith("image/gif") ? "Animated GIF kept as-is." : "Unsupported image type kept as-is.");
  }
  const sharp = await loadSharp();
  if (!sharp) return passthrough("Image optimization is unavailable on this deployment.");

  try {
    const out = await sharp(Buffer.from(bytes))
      .rotate() // honour EXIF orientation before it is stripped
      .resize({ width: IMAGE_MAX_DIMENSION, height: IMAGE_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const optimized = new Uint8Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)) as Uint8Array<ArrayBuffer>;
    const chosen = keepSmaller(bytes, optimized);
    return {
      bytes: chosen,
      contentType: chosen === optimized ? "image/webp" : contentType,
      before,
      after: chosen.byteLength,
      optimized: chosen === optimized,
      note: chosen === optimized ? null : "Re-encode was larger; the original was kept.",
    };
  } catch {
    return passthrough("That image could not be optimized; the original was kept.");
  }
}

// ── video ─────────────────────────────────────────────────────────────────────

let ffmpegChecked: boolean | undefined;

/** Is an `ffmpeg` binary on PATH? Cached — a deployment either has it or does
 *  not, and probing per request would be wasteful. */
export async function ffmpegAvailable(): Promise<boolean> {
  if (ffmpegChecked !== undefined) return ffmpegChecked;
  ffmpegChecked = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
      p.on("error", () => resolve(false));
      p.on("close", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
  return ffmpegChecked;
}

/** Run ffmpeg with a hard timeout, returning its exit code. */
function runFfmpeg(args: string[], timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "ignore"] });
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error("ffmpeg timed out"));
    }, timeoutMs);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}

/**
 * Transcode to a web-friendly H.264/AAC MP4: scaled to `VIDEO_MAX_HEIGHT`,
 * CRF-encoded, and `+faststart` so the moov atom is at the front and the video
 * starts playing before it is fully downloaded.
 *
 * Falls back to the ORIGINAL with a note when ffmpeg is absent (a Vercel
 * function) or the input cannot be transcoded — a video upload must never fail
 * because a codec tool is missing.
 */
export async function optimizeVideo(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<OptimizeResult> {
  const before = bytes.byteLength;
  const passthrough = (note: string): OptimizeResult => ({
    bytes,
    contentType,
    before,
    after: before,
    optimized: false,
    note,
  });

  if (!isOptimizableVideo(contentType)) return passthrough("Unsupported video type kept as-is.");
  if (!(await ffmpegAvailable())) {
    return passthrough("Video compression is unavailable on this deployment; the original was stored.");
  }

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "pp-vid-"));
    const input = join(dir, "in.bin");
    const output = join(dir, "out.mp4");
    await writeFile(input, Buffer.from(bytes));
    const code = await runFfmpeg(
      [
        "-y",
        "-i", input,
        // scale DOWN only; never upscale a small clip (`-2` keeps width even)
        "-vf", `scale=-2:'min(${VIDEO_MAX_HEIGHT},ih)'`,
        "-c:v", "libx264",
        "-crf", String(VIDEO_CRF),
        "-preset", VIDEO_PRESET,
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        output,
      ],
      VIDEO_TIMEOUT_MS,
    );
    if (code !== 0) return passthrough("That video could not be compressed; the original was kept.");
    const out = await readFile(output);
    const optimized = new Uint8Array(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)) as Uint8Array<ArrayBuffer>;
    const chosen = keepSmaller(bytes, optimized);
    return {
      bytes: chosen,
      contentType: chosen === optimized ? "video/mp4" : contentType,
      before,
      after: chosen.byteLength,
      optimized: chosen === optimized,
      note: chosen === optimized ? null : "Re-encode was larger; the original was kept.",
    };
  } catch {
    return passthrough("That video could not be compressed; the original was kept.");
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Optimize by kind, then enforce the size cap. `overCap` is non-null when even
 *  the optimized file is too large — the caller turns that into a clear refusal
 *  rather than storing something that would break the product page. */
export async function optimizeForKind(
  kind: MediaKind,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<OptimizeResult & { overCap: string | null }> {
  const result = kind === "video" ? await optimizeVideo(bytes, contentType) : await optimizeImage(bytes, contentType);
  const cap = kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  const capMb = Math.round(cap / (1024 * 1024));
  return {
    ...result,
    overCap:
      result.after > cap
        ? kind === "video"
          ? `That video is still over ${capMb} MB after compression. Please trim it.`
          : `That image is still over ${capMb} MB after optimization. Please resize it.`
        : null,
  };
}

/** A one-line, human summary for logs/reports: `1.24 MB -> 180 KB (-86%)`. A
 *  size that GREW is reported honestly as a `+N%` growth (a negative saving
 *  printed as `-N%` would read as a saving, and `(--N%)` was a real defect). */
export function formatRatio(before: number, after: number): string {
  const mb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${Math.round(n / 1024)} KB`);
  if (!(before > 0)) return `${mb(before)} -> ${mb(after)}`;
  const pct = Math.round((1 - after / before) * 100);
  return `${mb(before)} -> ${mb(after)} (${pct >= 0 ? `-${pct}` : `+${Math.abs(pct)}`}%)`;
}
