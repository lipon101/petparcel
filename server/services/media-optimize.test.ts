// The pure rules of the optimization layer. The heavy paths (sharp / ffmpeg) are
// covered by the real before/after run, but these decisions - whether a file is
// worth re-encoding, whether the re-encode WON, and how the saving reads - are
// logic, and logic that silently regresses here would re-ship 2 MB photos.
import { describe, it, expect } from "vitest";
import {
  keepSmaller,
  isOptimizableImage,
  isOptimizableVideo,
  formatRatio,
  IMAGE_MAX_DIMENSION,
  VIDEO_MAX_HEIGHT,
} from "./media-optimize";

const bytes = (n: number) => new Uint8Array(n) as Uint8Array<ArrayBuffer>;

describe("keepSmaller", () => {
  it("returns the optimized bytes when they are smaller", () => {
    const original = bytes(1000);
    const optimized = bytes(400);
    expect(keepSmaller(original, optimized)).toBe(optimized);
  });

  it("keeps the ORIGINAL when a re-encode grew the file (already-compressed input)", () => {
    const original = bytes(400);
    const optimized = bytes(1000);
    expect(keepSmaller(original, optimized)).toBe(original);
  });

  it("keeps the original on an exact tie (no gain, no risk)", () => {
    const original = bytes(500);
    const optimized = bytes(500);
    expect(keepSmaller(original, optimized)).toBe(original);
  });
});

describe("isOptimizableImage", () => {
  it("accepts the formats sharp can re-encode losslessly-enough", () => {
    for (const t of ["image/png", "image/jpeg", "image/webp", "image/avif"]) {
      expect(isOptimizableImage(t), t).toBe(true);
    }
  });

  it("REFUSES a GIF - re-encoding would silently drop its animation frames", () => {
    expect(isOptimizableImage("image/gif")).toBe(false);
  });

  it("is case-insensitive and tolerates a charset parameter", () => {
    expect(isOptimizableImage("IMAGE/JPEG")).toBe(true);
    expect(isOptimizableImage("image/jpeg; charset=binary")).toBe(true);
  });

  it("refuses a non-image", () => {
    expect(isOptimizableImage("application/pdf")).toBe(false);
    expect(isOptimizableImage("")).toBe(false);
  });
});

describe("isOptimizableVideo", () => {
  it("accepts the web-relevant containers", () => {
    for (const t of ["video/mp4", "video/webm", "video/quicktime"]) {
      expect(isOptimizableVideo(t), t).toBe(true);
    }
  });

  it("refuses a non-video and is tolerant of parameters/case", () => {
    expect(isOptimizableVideo("image/png")).toBe(false);
    expect(isOptimizableVideo("VIDEO/MP4; codecs=h264")).toBe(true);
  });
});

describe("formatRatio (the sentence the admin reads)", () => {
  it("renders MB in, KB out, with a negative percentage saving", () => {
    expect(formatRatio(2 * 1024 * 1024, 180 * 1024)).toBe("2.00 MB -> 180 KB (-91%)");
  });

  it("renders KB -> KB below a megabyte", () => {
    expect(formatRatio(900 * 1024, 300 * 1024)).toBe("900 KB -> 300 KB (-67%)");
  });

  it("reports 0% rather than NaN when the original size is unknown", () => {
    expect(formatRatio(0, 100 * 1024)).toBe("0 KB -> 100 KB");
  });

  it("shows a NEGATIVE saving honestly if the output is bigger", () => {
    // the arithmetic, stated plainly: 1 - 2000/1000 = -1 -> -100%
    expect(formatRatio(1000 * 1024, 2000 * 1024)).toBe("1000 KB -> 1.95 MB (+100%)");
  });
});

describe("chosen limits are the documented, sane web values", () => {
  it("image is capped at 1600px (a 2x retina product tile)", () => {
    expect(IMAGE_MAX_DIMENSION).toBe(1600);
  });

  it("video is capped at 1080p", () => {
    expect(VIDEO_MAX_HEIGHT).toBe(1080);
  });
});
