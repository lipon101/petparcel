import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The two files Cloudflare's Security Center asks for are static assets, so a
// regression would be silent - nothing imports them and no type checks them.
// These tests read them from disk and pin the fields that make them valid.

const PUBLIC = path.resolve(__dirname, "../../client/public");

function read(rel: string): string {
  return readFileSync(path.join(PUBLIC, rel), "utf-8");
}

describe("security.txt (RFC 9116)", () => {
  const body = read(".well-known/security.txt");

  it("is served at the canonical location and declares itself", () => {
    expect(body).toContain("Canonical: https://www.petparcel.store/.well-known/security.txt");
  });

  it("has a Contact, an Expires, a Preferred-Languages and a Policy", () => {
    expect(body).toMatch(/^Contact: mailto:/m);
    expect(body).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m);
    expect(body).toMatch(/^Preferred-Languages: /m);
    expect(body).toMatch(/^Policy: https:\/\//m);
  });

  it("has an Expires in the future (a stale file is worse than none)", () => {
    const m = body.match(/^Expires: (.+)$/m);
    expect(m).not.toBeNull();
    expect(new Date(m![1]).getTime()).toBeGreaterThan(Date.now());
  });

  it("is mirrored at /security.txt for the legacy location", () => {
    expect(read("security.txt")).toBe(body);
  });
});

// robots.txt is no longer a static file: it is generated per request from the
// request HOST (see server/_core/robots.ts), so the SAME URL serves the real
// policy on the production storefront and disallow-all on a preview. The static
// file was removed because on Vercel the filesystem is checked before rewrites,
// so a static file would be served for every host and bypass the gate. The
// policy itself is asserted in robots.test.ts; here we only pin that the static
// file is GONE, so it cannot silently come back and shadow the route.
describe("robots.txt is served by the app, not a static file", () => {
  it("has no static client/public/robots.txt to shadow the host-aware route", () => {
    expect(existsSync(path.join(PUBLIC, "robots.txt"))).toBe(false);
  });
});
