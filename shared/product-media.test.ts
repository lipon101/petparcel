import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  PRODUCT_IMAGE_WIDTHS,
  productImageAtWidth,
  productImageSizes,
  productImageSrcSet,
  productImageUrl,
  productImageUrls,
} from "./product-media";

const REPO_ROOT = join(__dirname, "..");
const REPO_IMAGE_DIR = join(REPO_ROOT, "client", "public", "images", "products");

describe("productImageUrl", () => {
  it("returns null for empty input", () => {
    expect(productImageUrl(null)).toBeNull();
    expect(productImageUrl(undefined)).toBeNull();
    expect(productImageUrl("")).toBeNull();
    expect(productImageUrl("   ")).toBeNull();
  });

  it("serves the repo path unchanged when no media base is configured", () => {
    // The default deployment (and every local/CI run) has no VITE_MEDIA_BASE_URL,
    // so the same-origin /images/products path is returned verbatim.
    delete process.env.VITE_MEDIA_BASE_URL;
    expect(productImageUrl("/images/products/pet-tent-bed-1.webp")).toBe(
      "/images/products/pet-tent-bed-1.webp",
    );
  });

  it("leaves already-remote and non-product URLs untouched", () => {
    process.env.VITE_MEDIA_BASE_URL = "https://media.example.com";
    expect(productImageUrl("https://supplier.example.com/a.jpg")).toBe(
      "https://supplier.example.com/a.jpg",
    );
    expect(productImageUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    // App-storage uploads are served by the app itself, never a CDN.
    expect(productImageUrl("/app-storage/abc.png")).toBe("/app-storage/abc.png");
    // Chrome art (hero, promo SVGs) is not product media.
    expect(productImageUrl("/hero.png")).toBe("/hero.png");
    delete process.env.VITE_MEDIA_BASE_URL;
  });

  it("maps a list in order, dropping empties", () => {
    delete process.env.VITE_MEDIA_BASE_URL;
    expect(productImageUrls(["/images/products/a.webp", "", "/images/products/b.webp"])).toEqual([
      "/images/products/a.webp",
      "/images/products/b.webp",
    ]);
  });
});

describe("every catalogue image is a real hosted URL", () => {
  // The storefront's product images are the SUPPLIER's own CDN URLs, not files in
  // the repo. This pins the invariant that makes deleting
  // `client/public/images/products` safe: every image the catalogue names is an
  // absolute https URL, and the repo carries no product bytes.
  //
  it("names only absolute https image URLs", () => {
    const src = readFileSync(join(REPO_ROOT, "shared", "catalog-data.ts"), "utf8");
    const urls = [...src.matchAll(/https:\/\/[^"'`\s]+/g)].map((m) => m[0]);
    const imageUrls = urls.filter((u) => /\.(?:jpe?g|png|webp|avif)(?:$|\?)/.test(u));
    expect(imageUrls.length).toBeGreaterThan(0);
    for (const url of imageUrls) {
      expect(url.startsWith("https://")).toBe(true);
    }
    // No catalogue image may be a repo-relative path any more.
    expect(src.includes('\"/images/products/')).toBe(false);
    // And none may point at the retired GitHub-release host.
    expect(src.includes("releases/download")).toBe(false);
  });

  it("carries no product image files in the repo", () => {
    // The folder may be absent entirely (the goal) or empty; it must never hold
    // a product image, because the bytes are served from the supplier's CDN.
    const files = existsSync(REPO_IMAGE_DIR) ? readdirSync(REPO_IMAGE_DIR) : [];
    expect(files).toEqual([]);
  });
});

describe("responsive image delivery", () => {
  const CDN = "https://cdn.example.com/abc.jpg";
  const CDN2 = "https://img.example.com/product/2024/01/01/x.png";

  // The transform is opt-in PER DEPLOYMENT: only hosts named in
  // VITE_IMAGE_TRANSFORM_HOSTS receive the `?x-oss-process=...` parameter, so a
  // deployment whose CDN does not understand it is never sent one.
  beforeEach(() => {
    process.env.VITE_IMAGE_TRANSFORM_HOSTS = "cdn.example.com, img.example.com";
  });
  afterEach(() => {
    delete process.env.VITE_IMAGE_TRANSFORM_HOSTS;
  });

  it("appends the resize + WebP transform for a configured host", () => {
    expect(productImageAtWidth(CDN, 600)).toBe(
      `${CDN}?x-oss-process=image/resize,w_600/format,webp/quality,q_82`,
    );
    expect(productImageAtWidth(CDN2, 300)).toBe(
      `${CDN2}?x-oss-process=image/resize,w_300/format,webp/quality,q_82`,
    );
  });

  it("transforms nothing when no host is configured (the default)", () => {
    delete process.env.VITE_IMAGE_TRANSFORM_HOSTS;
    expect(productImageAtWidth(CDN, 600)).toBeNull();
    expect(productImageSrcSet(CDN)).toBeUndefined();
  });

  it("skips a host that does not support the transform", () => {
    // A self-hosted upload, an admin-pasted URL, or a data: URI must never
    // receive a query parameter its server does not understand.
    expect(productImageAtWidth("https://media.example.com/products/a.webp", 600)).toBeNull();
    expect(productImageAtWidth("/images/products/a.webp", 600)).toBeNull();
    expect(productImageAtWidth("data:image/png;base64,AAAA", 600)).toBeNull();
  });

  it("never stacks a second transform on an already-transformed URL", () => {
    const once = productImageAtWidth(CDN, 600)!;
    expect(productImageAtWidth(once, 900)).toBe(once);
  });

  it("builds a multi-candidate srcset with width descriptors", () => {
    const srcset = productImageSrcSet(CDN)!;
    const entries = srcset.split(", ");
    expect(entries).toHaveLength(PRODUCT_IMAGE_WIDTHS.length);
    for (const width of PRODUCT_IMAGE_WIDTHS) {
      expect(srcset).toContain(`w_${width}`);
      expect(srcset).toContain(`${width}w`);
    }
  });

  it("omits srcset for a URL that cannot be transformed", () => {
    // A single candidate would be pointless and misleading, so the caller falls
    // back to a plain src.
    expect(productImageSrcSet("https://media.example.com/a.webp")).toBeUndefined();
    expect(productImageSrcSet(null)).toBeUndefined();
  });

  it("gives each layout slot a sizes hint that matches its rendered width", () => {
    expect(productImageSizes("card")).toContain("vw");
    expect(productImageSizes("detail")).toContain("100vw");
    expect(productImageSizes("thumb")).toBe("96px");
  });
});
