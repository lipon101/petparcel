// ── Images that must NEVER be advertised ──────────────────────────────────────
//
// WHY THIS EXISTS. Google Merchant Center rejects a product image that carries
// burned-in promotional text, a watermark, a logo or a border: it is the
// "Promotional overlay on image" / "image contains text" policy, and it takes
// the WHOLE item out of the feed - the item shows as "Not approved", the
// customer never sees it, and the account's coverage drops.
//
// The concrete case that made this necessary: the Style 4 shots of the "Cute
// Fruit Dog Clothes" hoodie - SKUs CJGD117239419SH (XS) and CJGD117239420TG (S)
// - are a 2x2 collage with KOREAN PROMOTIONAL CAPTIONS burned into three of the
// four panels. Google flagged item CJGD117239420TG for exactly that, so it was
// the one item in the catalogue that would not approve.
//
// WHY THE IMAGE IS REMOVED RATHER THAN RE-SHOT. That picture is the SUPPLIER'S
// own photography, downloaded from the supplier's API and re-hosted on our own
// bucket (see scripts/sync-variant-images.mjs). We do not re-shoot it, and
// re-encoding the pixels would not remove the captions - they are IN the image.
// So the only honest fix is to STOP ADVERTISING IT. The variant then falls back
// to the product's own clean gallery shot, which is the same picture the
// storefront already shows for that option, and the item approves.
//
// WHY AN EXPLICIT LIST AND NOT A HEURISTIC. "Looks like it has text on it" is
// not a rule a machine can apply to a WebP, and a guess that wrongly removes a
// good image costs a product its best shot. So the list is explicit, and every
// entry carries the reason it is on it.
//
// THE IDENTIFIERS ARE STABLE. The bucket's variant objects are CONTENT-ADDRESSED
// - the key is a hash of the re-encoded bytes (see `variantKey` in
// scripts/sync-variant-images.mjs) - so the same source photo always lands on
// the same key. The key below therefore keeps identifying the same offending
// image across re-uploads, and the SKU list keeps identifying the offending
// option even if the bytes are ever re-encoded to a different key.
//
// THIS MODULE IS THE ONLY PLACE THE LIST LIVES. It is read by the feed builder
// (so the feed can never carry one of these images), by the variant-image sync
// (so the database never stores one), and by the test that pins the policy.

/** One image that must not be advertised, and why it is on the list. */
export interface NonCompliantImage {
  /**
   * The object key's hash - the file name without its extension, e.g.
   * "8943b5878400e342b3fb". The bucket's variant objects are content-addressed,
   * so this identifier is stable for the same bytes.
   */
  key: string;
  /**
   * The SKUs whose own photograph this is. Kept alongside the key so the option
   * is still recognised if the bytes are ever re-encoded to a different key.
   */
  skus: readonly string[];
  /** Why this image cannot be advertised. Shown by the tools that enforce it. */
  reason: string;
  /**
   * Whether the storefront may still show the picture.
   *
   * FALSE for a picture that is bad everywhere - a collage of the product with
   * captions burned over it, where even the shopper is better served by the
   * product's other photographs. TRUE for a picture that is honest but not
   * advertisable - the supplier's colour card, where the label and the frame
   * break Google's rules but the photograph inside is a real picture of the
   * right option, and the shopper benefits from seeing it.
   *
   * Either way the FEED never advertises it: Google reads the main image
   * strictly and only tolerates text in the additional images.
   */
  showInStore: boolean;
}

/** Every image the store has found to be un-advertisable, and why. */
export const NON_COMPLIANT_IMAGES: readonly NonCompliantImage[] = [
  {
    key: "8943b5878400e342b3fb",
    skus: ["CJGD117239419SH", "CJGD117239420TG"],
    reason:
      "2x2 collage with Korean promotional captions burned into three of the four " +
      'panels - Google\'s "Promotional overlay on image" / "image contains text" policy.',
    showInStore: false,
  },
  // The cat toy's own variant photographs are COLOUR CARDS: the product shot with
  // a rounded colour label in the corner ("Red", "Green", "Grey") and a
  // decorative band around the edge. Both break the rule - the label is text
  // over the picture, and the frame is an element that covers the product.
  // Google's automated check flagged one of them ("With Rope Style Gray") and
  // flags the rest one per review cycle, so the whole family is listed here.
  // The photograph inside each card is honest, so the storefront keeps them.
  {
    key: "e63619f5acd9c2739222",
    skus: ["CJMY212708201AZ"],
    reason: "Supplier colour card - a colour label over the picture and a decorative frame.",
    showInStore: true,
  },
  {
    key: "f67d489547d9084ac859",
    skus: ["CJMY212708202BY"],
    reason: "Supplier colour card - a colour label over the picture and a decorative frame.",
    showInStore: true,
  },
  {
    key: "4155903441ca120ccc6a",
    skus: ["CJMY212708203CX"],
    reason: "Supplier colour card - a colour label over the picture and a decorative frame.",
    showInStore: true,
  },
  {
    key: "c402cb5fb2a2220a7d3d",
    skus: ["CJMY212708204DW"],
    reason: "Supplier colour card - a colour label over the picture and a decorative frame.",
    showInStore: true,
  },
  {
    key: "9695fc839d097197fc94",
    skus: ["CJMY212708205EV"],
    reason: "Supplier colour card - a colour label over the picture and a decorative frame.",
    showInStore: true,
  },
  {
    key: "224c7d7019b24655cc55",
    skus: ["CJMY212708206FU"],
    reason:
      "Supplier colour card - a colour label over the picture and a decorative frame " +
      '(the one Google flagged: "Promotional overlay on image").',
    showInStore: true,
  },
  {
    key: "14b069ff07e3e75e7d02",
    skus: ["CJMY212708211KP"],
    reason:
      "Supplier colour card - a product title and a colour label over the picture, and a decorative frame.",
    showInStore: true,
  },
];

/**
 * The file-name stem of a media URL, lowercased.
 *
 * ".../products/variants/8943b5878400e342b3fb.webp" -> "8943b5878400e342b3fb"
 *
 * A bare key is accepted too, and any query string is dropped - the media host
 * serves the same object under "?v=2" style URLs after a re-upload.
 */
function imageKey(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const value = url.trim();
  if (!value) return null;
  const withoutQuery = value.split(/[?#]/, 1)[0];
  const segment = withoutQuery.split("/").pop() ?? "";
  const stem = segment.replace(/\.[A-Za-z0-9]+$/, "");
  return stem ? stem.toLowerCase() : null;
}

/** The list entry for this image, or null when the image may be advertised. */
export function nonCompliantImage(url: string | null | undefined): NonCompliantImage | null {
  const key = imageKey(url);
  if (!key) return null;
  return NON_COMPLIANT_IMAGES.find((entry) => entry.key.toLowerCase() === key) ?? null;
}

/** True when this image may not be advertised (burned-in text, a logo, ...). */
export function isNonCompliantImage(url: string | null | undefined): boolean {
  return nonCompliantImage(url) !== null;
}

/** True when this SKU's own photograph is one of the un-advertisable images. */
export function isNonCompliantVariantSku(sku: string | null | undefined): boolean {
  if (typeof sku !== "string") return false;
  const value = sku.trim().toLowerCase();
  if (!value) return false;
  return NON_COMPLIANT_IMAGES.some((entry) =>
    entry.skus.some((s) => s.trim().toLowerCase() === value),
  );
}
