// Pure rules for the admin media gallery: what each file is, whether the whole
// gallery is full, and how a tile should be labelled. Kept out of the component
// so it is unit-testable without a DOM (vitest runs with environment "node").
import { MAX_PRODUCT_MEDIA, type MediaKind } from "../../../shared/media";

/** The kind of a file the admin picked, from its MIME type. GIF is an image we
 *  accept but never re-encode (that would drop its frames). */
export function uploadKindOf(file: { type: string; name?: string }): MediaKind {
  if (/^video\//i.test(file.type)) return "video";
  if (/\.(mp4|webm|mov|m4v)$/i.test(file.name ?? "")) return "video";
  return "image";
}

export function isAcceptedUpload(file: { type: string; name?: string }): boolean {
  const kind = uploadKindOf(file);
  if (kind === "video") return /^video\/(mp4|webm|quicktime)$/i.test(file.type) || /\.(mp4|webm|mov|m4v)$/i.test(file.name ?? "");
  return /^image\/(png|jpeg|gif|webp|avif)$/i.test(file.type);
}

/** Room left in a gallery of at most MAX_PRODUCT_MEDIA assets. */
export function remainingSlots(current: number): number {
  return Math.max(0, MAX_PRODUCT_MEDIA - current);
}

export function isGalleryFull(current: number): boolean {
  return remainingSlots(current) === 0;
}

/** A short human label for a tile: "Image" / "Video", plus the position. */
export function tileLabel(kind: MediaKind, index: number, total: number): string {
  return `${kind === "video" ? "Video" : "Image"} ${index + 1} of ${total}`;
}

/** A human byte size for the tile meta line. */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
