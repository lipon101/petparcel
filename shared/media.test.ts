// The rules that decide what a product gallery may hold and what the server is
// allowed to FETCH. These are the security-relevant core of media ingest (the
// SSRF guard) plus the validation every asset passes, so they are tested
// directly rather than through a component or a live request.
import { describe, expect, it } from "vitest";
import {
  MAX_PRODUCT_MEDIA,
  extensionForContentType,
  galleryTiles,
  imageUrls,
  isIngestableSourceUrl,
  kindForContentType,
  kindFromUrl,
  normalizeMedia,
  describeSourceProblem,
} from "./media";

describe("isIngestableSourceUrl (the SSRF guard)", () => {
  it("accepts a normal public https asset", () => {
    expect(isIngestableSourceUrl("https://cf.cjdropshipping.com/83639716-b526-4a95-b703-d3ea0bae0c4c.jpg")).toBe(true);
    expect(isIngestableSourceUrl("http://example.com/a.mp4")).toBe(true);
  });

  it("refuses every shape that points at us or the private network", () => {
    for (const bad of [
      "http://localhost/x.jpg",
      "https://localhost:8080/x",
      "http://127.0.0.1/x",
      "http://127.1.2.3/x",
      "http://10.0.0.5/x",
      "http://192.168.1.1/x",
      "http://172.16.0.1/x",
      "http://172.31.255.255/x",
      "http://169.254.169.254/latest/meta-data/",
      "http://0.0.0.0/x",
      "http://[::1]/x",
      "https://foo.internal/x",
      "https://thing.local/x",
      "http://svc.home.arpa/x",
      "http://[fd00::1]/x",
    ]) {
      expect(isIngestableSourceUrl(bad), bad).toBe(false);
    }
  });

  it("refuses a non-http scheme and outright junk", () => {
    expect(isIngestableSourceUrl("file:///etc/passwd")).toBe(false);
    expect(isIngestableSourceUrl("ftp://example.com/a.jpg")).toBe(false);
    expect(isIngestableSourceUrl("javascript:alert(1)")).toBe(false);
    expect(isIngestableSourceUrl("")).toBe(false);
    expect(isIngestableSourceUrl("not a url")).toBe(false);
  });

  it("does not over-block a public host that merely looks private", () => {
    expect(isIngestableSourceUrl("https://172.example.com/a.jpg")).toBe(true);
    expect(isIngestableSourceUrl("https://localhost.example.com/a.jpg")).toBe(true);
  });
});

describe("describeSourceProblem", () => {
  it("says nothing for a good link, and a sentence otherwise", () => {
    expect(describeSourceProblem("https://cdn.example.com/a.jpg")).toBeNull();
    expect(describeSourceProblem("")).toMatch(/paste/i);
    expect(describeSourceProblem("http://127.0.0.1/a.jpg")).toMatch(/public/i);
  });
});

describe("kind + validation helpers", () => {
  it("maps an accepted content type to its kind and rejects anything else", () => {
    expect(kindForContentType("image/jpeg")).toBe("image");
    expect(kindForContentType("image/webp; charset=binary")).toBe("image");
    expect(kindForContentType("video/mp4")).toBe("video");
    expect(kindForContentType("video/webm")).toBe("video");
    expect(kindForContentType("text/html")).toBeNull();
    expect(kindForContentType("application/pdf")).toBeNull();
    expect(kindForContentType(null)).toBeNull();
  });

  it("infers a kind from a URL extension as a pre-check only", () => {
    expect(kindFromUrl("https://x/y.mp4")).toBe("video");
    expect(kindFromUrl("https://x/y.MP4?token=1")).toBe("video");
    expect(kindFromUrl("https://x/y.webm")).toBe("video");
    expect(kindFromUrl("https://x/y.jpg")).toBe("image");
  });

  it("stores our copy under the extension of the REAL content type", () => {
    expect(extensionForContentType("image/jpeg")).toBe("jpg");
    expect(extensionForContentType("video/mp4")).toBe("mp4");
    expect(extensionForContentType("video/quicktime")).toBe("bin");
  });
});

describe("normalizeMedia", () => {
  it("passes through the modern shape", () => {
    expect(normalizeMedia([{ url: "/a.jpg", kind: "image" }, { url: "/b.mp4", kind: "video" }])).toEqual([
      { url: "/a.jpg", kind: "image" },
      { url: "/b.mp4", kind: "video" },
    ]);
  });

  it("tolerates a bare string list (the pre-video shape) and infers kinds", () => {
    expect(normalizeMedia(["/a.jpg", "/b.mp4"])).toEqual([
      { url: "/a.jpg", kind: "image" },
      { url: "/b.mp4", kind: "video" },
    ]);
  });

  it("falls back to the images array when there is no media at all", () => {
    expect(normalizeMedia(undefined, ["/a.jpg"])).toEqual([{ url: "/a.jpg", kind: "image" }]);
    expect(normalizeMedia([], ["/a.jpg", "/b.png"])).toHaveLength(2);
  });

  it("drops empties and de-duplicates by url", () => {
    expect(normalizeMedia([{ url: "" }, { url: "/a.jpg", kind: "image" }, { url: "/a.jpg", kind: "image" }])).toEqual([
      { url: "/a.jpg", kind: "image" },
    ]);
  });
});

describe("imageUrls", () => {
  it("is the image-only projection that keeps products.images correct", () => {
    expect(
      imageUrls([
        { url: "/a.jpg", kind: "image" },
        { url: "/v.mp4", kind: "video" },
        { url: "/b.png", kind: "image" },
      ]),
    ).toEqual(["/a.jpg", "/b.png"]);
  });
});

describe("galleryTiles", () => {
  it("returns the real media when a video is present, up to the cap", () => {
    const media = Array.from({ length: MAX_PRODUCT_MEDIA }, (_, i) => ({
      url: `/m${i}.jpg`,
      kind: "image" as const,
    }));
    const tiles = galleryTiles(media);
    expect(tiles).toHaveLength(MAX_PRODUCT_MEDIA);
    expect(tiles.every((t) => !t.repeat)).toBe(true);
  });
});
