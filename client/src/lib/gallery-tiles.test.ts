// Guards the product gallery's tiles - the shots the rail shows and the big
// picture the shopper sees.
//
// WHY THIS SUITE EXISTS. Two defects lived in the gallery and neither was
// visible in a screenshot of the code:
//
//   1. the big stage rendered the picked option's photograph whatever the
//      shopper clicked, so the THUMBNAIL RAIL moved and the big picture stayed
//      put - the gallery looked frozen;
//   2. a product with fewer photographs than the rail had room for got a
//      filler tile that repeated the first shot, which reads as a placeholder
//      rather than as the product's own media.
//
// So the tiles are pinned here: every real shot appears once, the option's own
// photograph leads, a shot is never repeated to fill the rail, and no tile is
// ever a URL the store does not serve.
import { describe, expect, it } from "vitest";
import { buildGalleryTiles } from "./gallery-tiles";

const A = "https://media.petparcel.store/products/a.webp";
const B = "https://media.petparcel.store/products/b.webp";
const C = "https://media.petparcel.store/products/c.webp";
const D = "https://media.petparcel.store/products/d.webp";
const VARIANT = "https://media.petparcel.store/products/variants/v.webp";

describe("buildGalleryTiles", () => {
  it("shows the product's own photographs", () => {
    const tiles = buildGalleryTiles({ images: [A, B, C] });
    expect(tiles.map((t) => t.url)).toEqual([A, B, C]);
  });

  it("puts the picked option's own photograph FIRST", () => {
    // It is the picture of the option the shopper picked, so it is the one they
    // most want to see - and it must be IN the rail, not a hidden override.
    const tiles = buildGalleryTiles({ images: [A, B, C], variantImage: VARIANT });
    expect(tiles[0].url).toBe(VARIANT);
    expect(tiles[0].variant).toBe(true);
    expect(tiles.map((t) => t.url)).toEqual([VARIANT, A, B, C]);
  });

  it("never repeats a shot", () => {
    // The filler tile that used to sit at the end of a four-photo product's rail
    // is gone: the option's own photograph took that slot, and a shot is never
    // shown twice.
    const tiles = buildGalleryTiles({ images: [A, B, C, D], variantImage: VARIANT });
    expect(tiles).toHaveLength(5);
    expect(new Set(tiles.map((t) => t.url)).size).toBe(tiles.length);
  });

  it("shows a product with one photograph as one photograph", () => {
    // A single tile is not a choice, so the rail is not drawn for it - and the
    // picture that IS the product is not padded out with a copy of itself.
    const tiles = buildGalleryTiles({ images: [A] });
    expect(tiles).toHaveLength(1);
    expect(tiles[0].url).toBe(A);
  });

  it("never invents a picture", () => {
    const tiles = buildGalleryTiles({ images: [A] });
    for (const tile of tiles) {
      expect([A]).toContain(tile.url);
    }
  });

  it("shows a video as a video, never dressed up as a picture", () => {
    const video = "https://media.petparcel.store/products/clip.mp4";
    const tiles = buildGalleryTiles({
      images: [A],
      media: [
        { url: video, kind: "video" },
        { url: B, kind: "image" },
      ],
    });
    expect(tiles.map((t) => t.kind)).toEqual(["video", "image"]);
    expect(tiles[0].url).toBe(video);
  });

  it("does not show the same picture twice when the media list repeats it", () => {
    const tiles = buildGalleryTiles({
      images: [A, B],
      media: [
        { url: A, kind: "image" },
        { url: A, kind: "image" },
        { url: B, kind: "image" },
      ],
    });
    expect(new Set(tiles.map((t) => t.url)).size).toBe(tiles.length);
  });

  it("draws nothing for a product with no media at all", () => {
    expect(buildGalleryTiles({ images: [] })).toEqual([]);
  });
});
