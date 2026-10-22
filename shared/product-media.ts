// The single source of truth for where a PRODUCT IMAGE is served from.
//
// WHY THIS EXISTS. The store's product images were originally committed to the
// repo under `client/public/images/products/*.webp` and referenced by a bare
// path (`/images/products/pet-tent-bed-1.webp`). The product catalogue
// (`shared/catalog-data.ts`) is bundled into BOTH the browser and the server, so
// it can only hold a path or a public URL - never a private bucket credential.
//
// This module turns the reference the catalogue stores into the URL the
// storefront should actually load:
//   * With VITE_MEDIA_BASE_URL set (the deployment points product media at
//     Cloudflare R2 or another CDN), it returns `${base}/products/<file>` - so
//     the bytes live in object storage and the repo carries none.
//   * With it UNSET (the default, and the only state a local dev box or CI can
//     rely on), it returns the same-origin `/images/products/<file>` path that is
//     served from `client/public`.
//
// Every catalogue image is now an ABSOLUTE remote URL (the supplier's own
// CDN), so the rewrite below is a no-op for them - the repo still carries no
// product bytes, and the two hosting modes stay interchangeable for an admin
// who pastes a relative path or uploads through the platform store.
//
// This is deliberately NOT a runtime fetch - it is a pure string resolver, so it
// behaves identically in the browser bundle and on the server, and it can be
// unit-tested without a network.
//
// It is also deliberately NOT applied to remote URLs an admin pastes into the
// product editor (those are already absolute) or to `/hero.png` and other chrome
// art, which are not product media.

/** The filename (or path) shape the catalogue stores for a product image. */
export type ProductImageRef = string;

/**
 * The CDN base for product media, or "" when the app should serve them itself.
 *
 * Read from `import.meta.env.VITE_MEDIA_BASE_URL` in the browser build and from
 * `process.env.VITE_MEDIA_BASE_URL` elsewhere. Both are optional; an unset value
 * is the normal, supported state.
 */
export function mediaBaseUrl(): string {
  let raw = "";
  // Vite inlines `import.meta.env` at build time; guard the access so the module
  // also imports cleanly under plain Node (the seeder, tests).
  try {
    const meta = (import.meta as { env?: Record<string, string | undefined> } | undefined)?.env;
    if (meta && typeof meta.VITE_MEDIA_BASE_URL === "string") raw = meta.VITE_MEDIA_BASE_URL;
  } catch {
    /* `import.meta` unavailable - fall through to process.env */
  }
  if (!raw) {
    try {
      raw = process.env?.VITE_MEDIA_BASE_URL ?? "";
    } catch {
      /* no process - leave raw empty */
    }
  }
  return raw.trim().replace(/\/+$/, "");
}

/** True when product media is served from an external base (R2 / a CDN). */
export function mediaIsRemote(): boolean {
  return mediaBaseUrl().length > 0;
}

/**
 * The URL to load a catalogue image from.
 *
 * Already-remote URLs (an admin's pasted `https://...` or a `data:` URL) are
 * returned untouched; only the repo-relative `/images/products/<file>` form is
 * rewritten onto the media base, so the two hosting modes are interchangeable.
 */
export function productImageUrl(ref: ProductImageRef | null | undefined): string | null {
  if (!ref) return null;
  const value = ref.trim();
  if (!value) return null;
  // Absolute, protocol-relative, data: and blob: URLs are already where they live.
  if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) return value;
  // An "app-storage" upload path is served by the app itself, never a CDN.
  if (value.startsWith("/app-storage/")) return value;

  const base = mediaBaseUrl();
  if (!base) return value; // same-origin default: serve from client/public

  // Only a `products/` reference is product media. Everything else (chrome art
  // like `/hero.png`, `/app-storage/...`, a promo SVG) is left exactly as it is,
  // so pointing product media at a CDN never rewrites the rest of the site.
  const m = value.match(/^\/?([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/)?products\/(.+)$/);
  if (!m) return value;
  return `${base}/products/${m[2]}`;
}

/** The same rewrite for a list, preserving order and dropping empties. */
export function productImageUrls(refs: ReadonlyArray<ProductImageRef> | null | undefined): string[] {
  if (!refs) return [];
  return refs.map((r) => productImageUrl(r)).filter((u): u is string => Boolean(u));
}

// ── Responsive delivery ───────────────────────────────────────────────────────────
// A store may serve its product images from a CDN that can render the SAME
// source file at the exact width a slot needs, re-encoded to WebP at a fixed
// quality - no build step, no stored derivative, nothing extra to host. That is
// the single largest lever on how fast a product grid and a product page paint.
//
// WHICH hosts support the `x-oss-process` transform is DEPLOYMENT configuration,
// not a constant in the code: it is read from `VITE_IMAGE_TRANSFORM_HOSTS`, a
// comma-separated hostname list. Unset (the default, and the only state a local
// dev box or CI relies on) means NO host is transformed, and every product image
// falls back to a plain `src` - nothing breaks and no query parameter is sent to
// a server that would not understand it.
//
// The transform is applied ONLY to the configured hosts. Any other URL (an
// admin's upload through `/app-storage`, a pasted link, a `data:` URI) is
// returned untouched.

/** Hosts whose images support `?x-oss-process=...`, from the deployment env. */
function transformableImageHosts(): Set<string> {
  let raw = "";
  try {
    const meta = (import.meta as { env?: Record<string, string | undefined> } | undefined)?.env;
    if (meta && typeof meta.VITE_IMAGE_TRANSFORM_HOSTS === "string") {
      raw = meta.VITE_IMAGE_TRANSFORM_HOSTS;
    }
  } catch {
    /* `import.meta` unavailable - fall through to process.env */
  }
  if (!raw) {
    try {
      raw = process.env?.VITE_IMAGE_TRANSFORM_HOSTS ?? "";
    } catch {
      /* no process - leave raw empty */
    }
  }
  return new Set(
    raw
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** The widths the storefront requests, from the smallest grid tile to the
 *  largest product-page stage. Kept in one place so `srcset` and the CSS slots
 *  cannot drift apart. */
export const PRODUCT_IMAGE_WIDTHS = [400, 800] as const;

/** The hosts that carry derivative objects. Resolved from `VITE_MEDIA_BASE_URL`
 *  (the store's own CDN) when set; otherwise this store's own media host, which is
 *  the host every catalogue image already uses. A THIRD-PARTY url (an admin's
 *  pasted link) is never in this set, so it is left on its plain `src` and can
 *  never 404 on a derivative that was never built. */
const DEFAULT_MEDIA_HOST = "media.petparcel.store";

function derivativeHosts(): Set<string> {
  const hosts = new Set<string>();
  const base = mediaBaseUrl();
  if (base) {
    try {
      hosts.add(new URL(base).hostname.toLowerCase());
    } catch {
      /* a malformed base is simply not a derivative host */
    }
  }
  hosts.add(DEFAULT_MEDIA_HOST);
  return hosts;
}

/**
 * The R2 derivative URL for a width, or null when this URL has no derivative.
 *
 * WHY DERIVATIVES RATHER THAN A URL TRANSFORM. The media host is a Cloudflare R2
 * bucket behind a custom domain. It serves the object as stored and does NOT
 * resize on the fly - measured against the live store: `?x-oss-process=...` is
 * ignored (identical byte count) and the `cdn-cgi/image` endpoint 404s. So a
 * per-slot smaller file has to EXIST as an object, which is what
 * `scripts/build-r2-derivatives.mjs` writes under `products/w400/`, `w800/` and
 * `w24/`. This function names those objects; it never invents a transform.
 */
function derivativeUrl(url: string | null, width: number): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!derivativeHosts().has(parsed.hostname.toLowerCase())) return null;
  const m = parsed.pathname.match(/^\/products\/([^/]+\.webp)$/);
  if (!m) return null;
  const base = mediaBaseUrl() || `${parsed.protocol}//${parsed.host}`;
  return `${base}/products/w${width}/${m[1]}`;
}

/**
 * The `srcset` for a product image, or undefined when this URL cannot be served
 * responsively (in which case the plain `src` is used and nothing breaks).
 *
 * Prefers the pre-built R2 derivatives; falls back to an on-the-fly transform for
 * a host that supports one. A single-candidate `srcset` is pointless, so fewer than
 * two candidates yields undefined and the caller simply omits the attribute.
 */
export function productImageSrcSet(url: ProductImageRef | null | undefined): string | undefined {
  const parts: string[] = [];
  for (const width of PRODUCT_IMAGE_WIDTHS) {
    const candidate = derivativeUrl(url ?? null, width) ?? productImageAtWidth(url, width);
    if (candidate) parts.push(`${candidate} ${width}w`);
  }
  return parts.length >= 2 ? parts.join(", ") : undefined;
}

/**
 * A tiny inline-sized version of the same image, for the blur-up placeholder that
 * paints instantly while the full image loads. Null when there is no derivative
 * host for this URL.
 */
export function productImagePlaceholder(url: ProductImageRef | null | undefined): string | null {
  return derivativeUrl(url ?? null, 24) ?? null;
}

export type ProductImageSlot = "card" | "detail" | "thumb";

/** The `sizes` attribute for a slot: how wide the image is DRAWN at each
 *  viewport, which is what lets the browser pick the smallest sufficient width
 *  from the `srcset` instead of the largest. */
export function productImageSizes(slot: ProductImageSlot): string {
  switch (slot) {
    // Four-up grid on desktop, two-up on phones; a card never exceeds ~320px.
    case "card":
      return "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";
    // The main gallery stage: full width on phones, capped by the stage box.
    case "detail":
      return "(min-width: 1024px) 620px, 100vw";
    // Gallery thumbnails are a fixed small tile.
    case "thumb":
      return "96px";
  }
}

/** True when this URL already carries an image transform of its own. */
function hasTransform(url: string): boolean {
  const q = url.indexOf("?");
  return q >= 0 && /(^|&)x-oss-process=/.test(url.slice(q + 1));
}

/**
 * A per-slot transform URL, for a host that resizes on the fly.
 *
 * The store's own media host does NOT (measured: `x-oss-process` is ignored,
 * `cdn-cgi/image` 404s), so today this returns null for every catalogue image and
 * `productImageSrcSet` above uses the pre-built R2 derivatives instead. It is kept
 * because the transform path is deployment configuration, not a constant: a host
 * that DOES transform (an OSS bucket, an image CDN) is switched on purely with
 * `VITE_IMAGE_TRANSFORM_HOSTS`, with the derivative objects as the fallback.
 */
export function productImageAtWidth(
  url: ProductImageRef | null | undefined,
  width: number,
  quality = 82,
): string | null {
  if (!url) return null;
  const value = url.trim();
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null; // relative / data: URLs are not ours to transform
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!transformableImageHosts().has(parsed.hostname.toLowerCase())) return null;
  // Never stack a second transform onto a URL that already has one.
  if (hasTransform(value)) return value;
  const sep = value.includes("?") ? "&" : "?";
  return `${value}${sep}x-oss-process=image/resize,w_${width}/format,webp/quality,q_${quality}`;
}
