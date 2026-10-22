// Pure helpers for the admin product-image uploader.
//
// Kept out of the component so the rules - which file types are accepted, the
// size cap, how a new URL merges into the gallery, reorder and remove - are
// unit-testable without a DOM (vitest runs `environment: "node"` here and jsdom
// is deliberately not a dependency; see vitest.config.ts). The component owns
// only the network calls and the React state.

/** Image types the platform's storage accepts. Mirrors the server whitelist in
 *  server/routers.ts (PRODUCT_IMAGE_TYPES) so the client rejects a bad file
 *  before spending an upload round-trip. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
] as const;

/** The `accept` attribute for the file input. */
export const IMAGE_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

/** 8 MB, matching the server's storage limit. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** The minimal shape of a File this module needs (so a test can pass a plain
 *  object instead of constructing a real File). */
export interface ImageFileLike {
  name: string;
  type: string;
  size: number;
}

/**
 * Validate one file before uploading. Returns a human-readable reason it cannot
 * be used, or `null` when it is fine. The message names the file so a batch
 * upload can report exactly which one was skipped.
 */
export function validateImageFile(file: ImageFileLike): string | null {
  if (!file.type.startsWith("image/")) {
    return `"${file.name}" isn't an image (PNG, JPEG, GIF, WebP or AVIF only).`;
  }
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" is a ${file.type.replace("image/", "").toUpperCase()} - use PNG, JPEG, GIF, WebP or AVIF.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" is over 8 MB - please resize it first.`;
  }
  return null;
}

/** Append `incoming` URLs to `existing`, skipping blanks and duplicates so the
 *  same image can never appear twice in the gallery. Returns a NEW array. */
export function mergeImages(existing: string[], incoming: string[]): string[] {
  const next = [...existing];
  for (const url of incoming) {
    const trimmed = url.trim();
    if (trimmed && !next.includes(trimmed)) next.push(trimmed);
  }
  return next;
}

/** Move the image at `from` to index `to`. Out-of-range moves are a no-op, so a
 *  drag that lands nowhere cannot corrupt the list. Returns a NEW array. */
export function moveImage(images: string[], from: number, to: number): string[] {
  if (to < 0 || to >= images.length || from === to || from < 0 || from >= images.length) {
    return images;
  }
  const next = [...images];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Remove the image at `index`. Returns a NEW array. */
export function removeImageAt(images: string[], index: number): string[] {
  return images.filter((_, i) => i !== index);
}

/** Split a textarea of URLs (one per line) into a clean list. */
export function parseImageUrls(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
