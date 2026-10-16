// The pure rules for the admin media gallery (no DOM: vitest runs with
// environment "node", so the decisions are extracted and tested here).
import { describe, it, expect } from "vitest";
import { uploadKindOf, isAcceptedUpload, remainingSlots, isGalleryFull, tileLabel, humanSize } from "./media-gallery";
import { MAX_PRODUCT_MEDIA } from "../../../shared/media";

describe("uploadKindOf", () => {
  it("reads a video from its MIME type", () => {
    expect(uploadKindOf({ type: "video/mp4", name: "clip.mp4" })).toBe("video");
    expect(uploadKindOf({ type: "video/webm", name: "clip.webm" })).toBe("video");
    expect(uploadKindOf({ type: "video/quicktime", name: "clip.mov" })).toBe("video");
  });

  it("falls back to the extension when the browser sends no MIME type", () => {
    expect(uploadKindOf({ type: "", name: "clip.MP4" })).toBe("video");
    expect(uploadKindOf({ type: "", name: "shot.jpeg" })).toBe("image");
  });

  it("treats everything image-ish as an image", () => {
    for (const t of ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]) {
      expect(uploadKindOf({ type: t }), t).toBe("image");
    }
  });
});

describe("isAcceptedUpload", () => {
  it("accepts the five image types and the three video containers", () => {
    for (const t of ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]) {
      expect(isAcceptedUpload({ type: t }), t).toBe(true);
    }
    for (const t of ["video/mp4", "video/webm", "video/quicktime"]) {
      expect(isAcceptedUpload({ type: t }), t).toBe(true);
    }
  });

  it("refuses an unrelated file, and a video that only LOOKS like one by name", () => {
    expect(isAcceptedUpload({ type: "application/pdf", name: "doc.pdf" })).toBe(false);
    expect(isAcceptedUpload({ type: "application/octet-stream", name: "clip.mp4" })).toBe(true); // extension rescues it
    expect(isAcceptedUpload({ type: "application/octet-stream", name: "notes.txt" })).toBe(false);
  });
});

describe("gallery capacity (at most MAX_PRODUCT_MEDIA mixed assets)", () => {
  it("counts the remaining slots down to zero and never below", () => {
    expect(remainingSlots(0)).toBe(MAX_PRODUCT_MEDIA);
    expect(remainingSlots(MAX_PRODUCT_MEDIA - 1)).toBe(1);
    expect(remainingSlots(MAX_PRODUCT_MEDIA)).toBe(0);
    expect(remainingSlots(MAX_PRODUCT_MEDIA + 5)).toBe(0);
  });

  it("is full exactly at the limit", () => {
    expect(isGalleryFull(MAX_PRODUCT_MEDIA - 1)).toBe(false);
    expect(isGalleryFull(MAX_PRODUCT_MEDIA)).toBe(true);
  });

  it("the limit is 5 mixed images/videos per product", () => {
    expect(MAX_PRODUCT_MEDIA).toBe(5);
  });
});

describe("tileLabel", () => {
  it("names the kind and the position 1-based", () => {
    expect(tileLabel("image", 0, 3)).toBe("Image 1 of 3");
    expect(tileLabel("video", 2, 5)).toBe("Video 3 of 5");
  });
});

describe("humanSize", () => {
  it("renders MB and KB, and nothing for an unknown size", () => {
    expect(humanSize(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(humanSize(300 * 1024)).toBe("300 KB");
    expect(humanSize(0)).toBe("");
    expect(humanSize(Number.NaN)).toBe("");
  });
});
