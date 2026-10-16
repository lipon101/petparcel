// Tests for the admin product-image upload helpers.
//
// These are the rules the uploader enforces before it spends a network round
// trip: which files are accepted, the size cap, and how a URL merges into /
// moves within / leaves the gallery. Pure functions, so no DOM is needed
// (vitest runs `environment: "node"` here; jsdom is deliberately not a
// dependency - see vitest.config.ts).
import { describe, expect, it } from "vitest";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  mergeImages,
  moveImage,
  parseImageUrls,
  removeImageAt,
  validateImageFile,
} from "./image-upload";

const file = (over: Partial<{ name: string; type: string; size: number }> = {}) => ({
  name: "photo.png",
  type: "image/png",
  size: 1024,
  ...over,
});

describe("validateImageFile", () => {
  it("accepts every whitelisted image type", () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(validateImageFile(file({ type }))).toBeNull();
    }
  });

  it("rejects a non-image file, naming it", () => {
    const reason = validateImageFile(file({ name: "notes.pdf", type: "application/pdf" }));
    expect(reason).toContain("notes.pdf");
    expect(reason).toContain("isn't an image");
  });

  it("rejects an image type the server would refuse (e.g. SVG), naming it", () => {
    const reason = validateImageFile(file({ name: "logo.svg", type: "image/svg+xml" }));
    expect(reason).toContain("logo.svg");
    expect(reason).toContain("SVG");
  });

  it("rejects a file over the 8 MB cap, naming it", () => {
    const reason = validateImageFile(file({ name: "huge.png", size: MAX_IMAGE_BYTES + 1 }));
    expect(reason).toContain("huge.png");
    expect(reason).toContain("8 MB");
  });

  it("accepts a file exactly at the cap", () => {
    expect(validateImageFile(file({ size: MAX_IMAGE_BYTES }))).toBeNull();
  });
});

describe("mergeImages", () => {
  it("appends new URLs and skips blanks and duplicates", () => {
    expect(mergeImages(["/a.png"], ["/b.png", "/a.png", "  ", "/c.png"])).toEqual([
      "/a.png",
      "/b.png",
      "/c.png",
    ]);
  });

  it("trims whitespace and returns a new array", () => {
    const existing = ["/a.png"];
    const next = mergeImages(existing, ["  /b.png  "]);
    expect(next).toEqual(["/a.png", "/b.png"]);
    expect(next).not.toBe(existing);
  });
});

describe("moveImage", () => {
  const images = ["/a.png", "/b.png", "/c.png"];

  it("moves an item forward and backward", () => {
    expect(moveImage(images, 0, 2)).toEqual(["/b.png", "/c.png", "/a.png"]);
    expect(moveImage(images, 2, 0)).toEqual(["/c.png", "/a.png", "/b.png"]);
  });

  it("is a no-op for an out-of-range or same-index move", () => {
    expect(moveImage(images, 0, 0)).toBe(images);
    expect(moveImage(images, 0, 5)).toBe(images);
    expect(moveImage(images, -1, 1)).toBe(images);
  });
});

describe("removeImageAt", () => {
  it("removes the item at the index and returns a new array", () => {
    const images = ["/a.png", "/b.png", "/c.png"];
    const next = removeImageAt(images, 1);
    expect(next).toEqual(["/a.png", "/c.png"]);
    expect(next).not.toBe(images);
  });
});

describe("parseImageUrls", () => {
  it("splits on newlines, trims, and drops blanks", () => {
    expect(parseImageUrls("https://a.png\n\n  /b.png  \n")).toEqual(["https://a.png", "/b.png"]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseImageUrls("   \n  ")).toEqual([]);
  });
});
