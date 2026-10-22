// Media rules shared by the server (ingest) and the client (admin form,
// product page). Pure and dependency-free so every rule is unit-testable
// without a DOM - the components own only the network and the state.
//
// A product's gallery is a list of `ProductMedia` items: an image OR a video.
// Video is a first-class kind, not an image with an mp4 URL, because the two
// need different elements, different size caps and different validation.

export type MediaKind = "image" | "video";

/** One gallery asset. `url` is ALWAYS one we serve ourselves (either an upload
 *  through the presigned put, or a server-side ingest that re-hosted a
 *  third-party asset) - a third-party origin URL is never stored here, so the
 *  storefront never reveals or depends on the source. */
export interface ProductMedia {
  url: string;
  kind: MediaKind;
}

/** Image types the platform storage accepts. Mirrors PRODUCT_IMAGE_TYPES in
 *  server/routers.ts so the client rejects a bad file before uploading. */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"] as const;

/** Video types we accept. mp4/H.264 first: it is what our upstream source serves and
 *  the one format every browser plays. */
export const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

/** 8 MB for an image (the existing cap), 50 MB for a video - a 10s 1080p clip
 *  is a few MB, so 50 MB is generous without inviting a file that would make a
 *  product page painful on a phone. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** How many assets (mixed images and videos) one product may carry. */
export const MAX_PRODUCT_MEDIA = 5;

/** The `accept` attribute for the admin file input. */
export const MEDIA_ACCEPT_ATTR = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(",");

/** The kind an incoming asset is, from its MIME type - or null when we do not
 *  accept that type at all. */
export function kindForContentType(contentType: string | null | undefined): MediaKind | null {
  const type = (contentType ?? "").split(";")[0]!.trim().toLowerCase();
  if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type)) return "image";
  if ((ACCEPTED_VIDEO_TYPES as readonly string[]).includes(type)) return "video";
  return null;
}

/** Best-effort kind from a URL alone (its extension). Used to label a tile
 *  before the real content type is known; never a substitute for it. */
export function kindFromUrl(url: string): MediaKind {
  const path = url.split(/[?#]/)[0]!.toLowerCase();
  if (/\.(mp4|webm|mov|m4v)$/.test(path)) return "video";
  return "image";
}

/** The file extension to store our own copy under, from the real content type.
 *  Never trust the source's extension - the MIME type is what we validated. */
export function extensionForContentType(contentType: string): string {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
  };
  return map[type] ?? "bin";
}

/**
 * Is this a URL our server is allowed to FETCH for ingest?
 *
 * This is the SSRF guard. It is deliberately a DENY list of the shapes that
 * point at the machine we run on or the private network behind it, plus a
 * scheme allow-list - because the ingest endpoint makes an outbound request
 * from inside our infrastructure, and a caller must never be able to use it to
 * probe `localhost`, a metadata service, or a private range.
 *
 * A hostname that RESOLVES to a private address (DNS rebinding) cannot be
 * caught here without resolving it; the platform's own network layer is the
 * real boundary. This rejects the obvious and the deliberate.
 */
export function isIngestableSourceUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "" || host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".home.arpa")) return false;
  if (host === "::1" || host === "0.0.0.0" || host === "::") return false;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
  if (/^169\.254\./.test(host)) return false; // link-local + cloud metadata
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return false;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return false; // IPv6 unique-local
  if (/^fe80:/.test(host)) return false; // IPv6 link-local
  return true;
}

/** Why a source URL cannot be ingested, as a short human sentence - or null
 *  when it is fine. Mirrors the server guard so the form can say so up front. */
export function describeSourceProblem(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Paste a link to the image or video first.";
  if (!isIngestableSourceUrl(trimmed)) {
    return "That doesn't look like a public http(s) link we can fetch.";
  }
  return null;
}

/** Confirm the bytes really are the type they claimed (magic-byte sniff).
 *  A file can lie in its Content-Type header; the first bytes cannot. */
export function sniffContentType(bytes: Uint8Array): MediaKind | null {
  const b = bytes;
  if (b.length < 12) return null;
  // PNG \x89PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image";
  // JPEG FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image";
  // GIF "GIF8"
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image";
  // RIFF....WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return "image";
  }
  // AVIF / HEIF: ....ftyp then brand avif/heic/mif1
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!);
    if (brand === "avif" || brand === "heic" || brand === "mif1") return "image";
    return "video"; // mp4 / m4v / mov all use an ftyp box
  }
  // WebM / Matroska EBML
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video";
  return null;
}

/** The gallery tiles for a product, filling up to `size` from the real assets.
 *  A video tile is returned as a video tile, never dressed up as an image, so
 *  the page renders the right element for each. */
export function galleryTiles(media: ProductMedia[], size = MAX_PRODUCT_MEDIA): Array<{
  url: string;
  kind: MediaKind;
  sourceIndex: number;
  repeat: boolean;
}> {
  const real = media.filter((m) => Boolean(m?.url));
  if (real.length === 0) return [];
  return Array.from({ length: Math.min(size, Math.max(size, real.length)) }, (_, i) => {
    const item = real[i % real.length]!;
    return { url: item.url, kind: item.kind, sourceIndex: i % real.length, repeat: i >= real.length };
  });
}

/** Normalise whatever the API/product handed us into a clean media list.
 *  Tolerates the older shape (a plain string array of images) so a product
 *  written before video existed still renders. */
export function normalizeMedia(input: unknown, images?: string[]): ProductMedia[] {
  const out: ProductMedia[] = [];
  const push = (url: unknown, kind?: unknown) => {
    if (typeof url !== "string" || !url.trim()) return;
    const k: MediaKind = kind === "video" ? "video" : kind === "image" ? "image" : kindFromUrl(url);
    if (!out.some((m) => m.url === url)) out.push({ url, kind: k });
  };
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") push(item);
      else if (item && typeof item === "object") {
        push((item as { url?: unknown }).url, (item as { kind?: unknown }).kind);
      }
    }
  }
  if (out.length === 0 && Array.isArray(images)) for (const url of images) push(url);
  return out;
}

/** The image-only projection of a media list. Keeps `products.images` (used by
 *  the cart, the JSON-LD, the OG image and every older consumer) correct. */
export function imageUrls(media: ProductMedia[]): string[] {
  return media.filter((m) => m.kind === "image").map((m) => m.url);
}
