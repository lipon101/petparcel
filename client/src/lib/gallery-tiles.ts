// The product gallery's tiles: every REAL shot the product has, with the picked
// option's own photograph first.
//
// WHY THIS EXISTS. The rail used to be "five tiles made from the product's
// photographs", and the big stage rendered the picked option's photograph
// WHATEVER the shopper clicked - so the stage never followed the rail, and a
// product with fewer photographs than the rail had room for got a tile that was
// only a repeat of the first. Two things were wrong with that, and both showed
// on the page:
//
//   1. clicking a thumbnail changed the lightbox but not the big picture, so the
//      gallery looked frozen;
//   2. the filler tile was the same photograph twice, which reads as a
//      placeholder rather than as the product's own media.
//
// So the tiles are now the real shots and nothing else: the option's own
// photograph first (it is the picture of the option the shopper picked), then
// the product's photographs. A shot is never repeated to fill the rail, and no
// picture is ever invented - every tile is a URL the store already serves.
import { GALLERY_SIZE } from "@shared/store";

export type GalleryTileKind = "image" | "video";

export interface GalleryTile {
  /** The shot the tile shows. */
  url: string;
  kind: GalleryTileKind;
  /** True when the tile is the picked option's own photograph. */
  variant: boolean;
}

/**
 * The gallery's tiles.
 *
 * `media` is the product's own media list (images AND videos). When it holds a
 * video the media IS the gallery - a video is never dressed up as a picture -
 * and otherwise the product's photographs are used.
 */
export function buildGalleryTiles(input: {
  /** The product's photographs. */
  images: string[];
  /** The product's media list, when it has one. */
  media?: readonly { url: string; kind: GalleryTileKind }[];
  /** The picked option's OWN photograph, when the supplier provides one. */
  variantImage?: string | null;
  /** How many of the product's own photographs the rail shows. */
  size?: number;
}): GalleryTile[] {
  const size = input.size ?? GALLERY_SIZE;
  const seen = new Set<string>();
  const distinct: GalleryTile[] = [];
  const add = (url: string | null | undefined, kind: GalleryTileKind, variant: boolean) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    distinct.push({ url, kind, variant });
  };

  // The picked option's own photograph leads the rail: it is the picture of the
  // option the shopper chose, so it is the one they most want to see.
  if (input.variantImage) add(input.variantImage, "image", true);

  const media = input.media ?? [];
  if (media.some((m) => m.kind === "video")) {
    media.forEach((m) => add(m.url, m.kind, false));
  } else {
    for (const src of input.images.slice(0, size)) add(src, "image", false);
  }
  return distinct;
}
