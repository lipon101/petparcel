import { describe, expect, it } from "vitest";
import {
  CONTENT_SECURITY_POLICY,
  requestHost,
  requestIsHttps,
  securityHeaders,
} from "./security-headers";

// The header set is a contract with the browser. These pin the parts a
// regression would silently drop.
describe("securityHeaders", () => {
  it("always sends the six unconditional headers", () => {
    const h = securityHeaders(false);
    expect(h["Content-Security-Policy"]).toBe(CONTENT_SECURITY_POLICY);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("sends HSTS on HTTPS and NOT over plain HTTP", () => {
    // A browser ignores HSTS over http://, and sending it from a dev origin
    // would pin the developer's browser to https for a year.
    expect(securityHeaders(true)["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(securityHeaders(false)["Strict-Transport-Security"]).toBeUndefined();
  });
});

// A non-production host (a `*.vercel.app` preview, a local run) must never be
// indexed. The header is the crawler-facing half of the rule; the client tag
// gate and the SSR noindex are the other two.
describe("X-Robots-Tag on non-production hosts", () => {
  it("is absent on the production host", () => {
    expect(securityHeaders(true, "www.petparcel.store")["X-Robots-Tag"]).toBeUndefined();
    expect(securityHeaders(true, "petparcel.store")["X-Robots-Tag"]).toBeUndefined();
  });

  it("is emitted for a Vercel preview host", () => {
    expect(securityHeaders(true, "petparcel-bpwf726dl-lipon.vercel.app")["X-Robots-Tag"]).toBe(
      "noindex, nofollow",
    );
  });

  it("is absent when no host is supplied (the existing call shape)", () => {
    expect(securityHeaders(false)["X-Robots-Tag"]).toBeUndefined();
  });
});

describe("requestHost", () => {
  const ctx = (url: string, headers: Record<string, string> = {}) => ({
    req: {
      url,
      header: (name: string) => headers[name.toLowerCase()],
    },
  });

  it("prefers x-forwarded-host over host", () => {
    expect(
      requestHost(
        ctx("http://localhost/", { "x-forwarded-host": "www.petparcel.store", host: "localhost" }),
      ),
    ).toBe("www.petparcel.store");
  });

  it("falls back to host, then to the URL", () => {
    expect(requestHost(ctx("http://localhost/", { host: "petparcel.store" }))).toBe(
      "petparcel.store",
    );
    expect(requestHost(ctx("https://www.petparcel.store/x"))).toBe("www.petparcel.store");
  });
});

describe("the CSP policy", () => {
  it("locks the dangerous directive defaults", () => {
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
  });

  it("does NOT allow unsafe-inline or unsafe-eval for scripts", () => {
    // The one allowance that exists is for STYLE, because React writes inline
    // style attributes (swatch colours). Script must never get one.
    const script = CONTENT_SECURITY_POLICY.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(script).toBeDefined();
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
    expect(CONTENT_SECURITY_POLICY).not.toContain("script-src 'self' 'unsafe");
  });

  it("allows exactly the media host the catalogue actually uses", () => {
    // If the R2 host were missing, every product image would be blocked and the
    // storefront would be blank - so this is asserted against the real host.
    expect(CONTENT_SECURITY_POLICY).toContain("https://media.petparcel.store");
    expect(CONTENT_SECURITY_POLICY).toContain("img-src 'self' data: blob:");
  });

  it("allows the Google tag hosts the storefront actually loads", () => {
    // The policy used to be `script-src 'self'` + `connect-src 'self'`, which
    // refuses the gtag.js loader, the inline tag snippet and the collection
    // beacon - silently disabling GA4 measurement on every self-hosted origin
    // while the page still looked healthy. These three allowances are the
    // minimum that makes the tag work, and they are pinned here so a future
    // "tighten the CSP" change cannot remove them without failing this suite.
    // The inline snippet itself is authorised by an exact sha256 (see
    // google-tag-csp.test.ts), never by 'unsafe-inline'.
    const script = CONTENT_SECURITY_POLICY.split(";").find((d) => d.trim().startsWith("script-src"));
    const connect = CONTENT_SECURITY_POLICY.split(";").find((d) => d.trim().startsWith("connect-src"));
    expect(script).toContain("https://www.googletagmanager.com");
    expect(connect).toContain("https://www.google-analytics.com");
    expect(CONTENT_SECURITY_POLICY).toContain("sha256-");
  });
});

describe("requestIsHttps", () => {
  const ctx = (url: string, headers: Record<string, string> = {}) => ({
    req: {
      url,
      header: (name: string) => headers[name.toLowerCase()],
    },
  });

  it("reads the scheme from the URL", () => {
    expect(requestIsHttps(ctx("https://petparcel.store/api/health"))).toBe(true);
    expect(requestIsHttps(ctx("http://localhost:3000/api/health"))).toBe(false);
  });

  it("honours the proxy header a real deploy sets", () => {
    expect(requestIsHttps(ctx("http://127.0.0.1:3000/", { "x-forwarded-proto": "https" }))).toBe(true);
    // A comma-separated chain must be read from its first hop, not its last.
    expect(requestIsHttps(ctx("http://127.0.0.1:3000/", { "x-forwarded-proto": "https, http" }))).toBe(true);
  });

  it("treats the production host suffix as HTTPS", () => {
    expect(requestIsHttps(ctx("http://127.0.0.1:3000/", { host: "www.petparcel.store" }))).toBe(true);
    expect(requestIsHttps(ctx("http://127.0.0.1:3000/", { "x-forwarded-host": "app.teamily.run" }))).toBe(true);
  });

  it("stays HTTP for a plain local origin - no HSTS pinning in dev", () => {
    expect(requestIsHttps(ctx("http://localhost:5173/", { host: "localhost:5173" }))).toBe(false);
  });
});
