// Guards the Bing Webmaster Tools site-verification tag.
//
// WHY THIS SUITE EXISTS. Bing re-checks the `msvalidate.01` meta tag to keep a
// site verified, so the tag must stay in the served document head PERMANENTLY -
// removing it (or letting a refactor drop it) silently revokes verification.
// The tag lives in the static shell, which the server sends for every route, so
// it is present site-wide; these tests pin both facts: the exact tag in
// `client/index.html`, and its survival through the SSR head injection.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { injectSeo, resolveSeo } from "./ssr-meta";

const INDEX_HTML = path.resolve(import.meta.dirname, "..", "..", "client", "index.html");
const shell = readFileSync(INDEX_HTML, "utf-8");

const BING_TAG = '<meta name="msvalidate.01" content="2D2F8A4755734D76AF417F492E8D6DB9" />';

describe("the Bing site-verification tag", () => {
  it("is present in the document head, exactly as Bing issued it", () => {
    expect(shell).toContain(BING_TAG);
  });

  it("appears exactly once (a duplicate would be a copy-paste slip)", () => {
    expect((shell.match(/name="msvalidate\.01"/g) ?? []).length).toBe(1);
  });

  it("survives the SSR head injection, so it is served on every route", async () => {
    // The injection rewrites the per-route tags in place; the verification tag
    // is not one of them and must pass through untouched - on the home page and
    // on any other route alike.
    for (const route of ["/", "/shop", "/about", "/cart"]) {
      const out = injectSeo(shell, await resolveSeo(route));
      expect(out).toContain(BING_TAG);
    }
  });
});
