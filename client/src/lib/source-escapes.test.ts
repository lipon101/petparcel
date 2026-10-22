// ── No unicode escape may sit where it will not be interpreted ───────────────
//
// THE BUG THIS PINS. The side cart showed the shopper this:
//
//     Sign in to use your saved cart \u2014 it follows you between devices.
//
// The em dash was written as a `\u2014` escape - but that escape was in JSX
// TEXT, not in a string literal, and JSX text has no escape processing. So the
// browser rendered the six characters `\u2014` instead of a dash. The same
// applied to `Loading your cart\u2026`.
//
// WHY ESBUILD, AND HOW THE RULE WORKS. The escapes are perfectly legal in the
// places they are MEANT to be - inside a string literal, a template literal
// or a regular expression - and a line-based or quote-counting check gets all
// three wrong. So the file is compiled with esbuild (already a pinned
// dependency, used by this repo's own scripts) and the OUTPUT is inspected.
//
// esbuild's output tells the two cases apart exactly:
//
//   a string literal   "text \u2014 more"   ONE backslash
//   a template literal `text \u2014 more`   ONE backslash
//   a regex            /[\u0000-\u001f]/g   ONE backslash
//   JSX TEXT           "text \\u2014 more"  TWO backslashes
//   a JSX attribute    "a \\u2014 b"        TWO backslashes
//
// The reason is mechanical, not accidental. An escape that IS interpreted
// stays one backslash in the output. An escape in a position that is NOT
// interpreted (JSX text, and a quoted JSX attribute value - which JSX treats
// like HTML, decoding character references but not backslash escapes) is
// copied verbatim into a string, and the backslash it contains has to be
// escaped, so it becomes two.
//
// So: an escape that gains a backslash in the output is one the browser will
// render literally. Comparing the number of two-backslash escapes in the
// source with the number in the output finds them exactly - and the check
// below is a no-op for the escapes that are correctly placed.
//
// The rule this enforces is also the house rule the store already follows for
// its own copy: no em dash and no en dash. A dash is not worth a broken
// string, and the copy reads better without one.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { transform } from "esbuild";
import { describe, expect, it } from "vitest";

/** An escape that has become DOUBLED - the shape of the bug. */
const DOUBLED_ESCAPE = /\\\\u[0-9a-fA-F]{4}/g;

/** Where the repository root is, from this file (client/src/lib/...). */
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

/** Every `.tsx` file in the repository, minus the build output and deps. */
function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist" || entry === "work") {
      continue;
    }
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      tsxFiles(full, out);
    } else if (full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

function countDoubled(text: string): number {
  return (text.match(DOUBLED_ESCAPE) ?? []).length;
}

/**
 * The escapes in one file that the BROWSER would render literally.
 *
 * The file is compiled, so the compiler itself decides which escapes are
 * interpreted - there is no guessing about quotes, templates or regexes here.
 */
async function literalEscapes(file: string): Promise<number> {
  const source = readFileSync(file, "utf8");
  const output = (await transform(source, { loader: "tsx", jsx: "automatic" })).code;
  return countDoubled(output) - countDoubled(source);
}

describe("no unicode escape sits where it will not be interpreted", () => {
  const files = tsxFiles(REPO_ROOT);

  it("finds the TSX files to check (so the test cannot pass by scanning nothing)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("renders no escape literally in any TSX file", async () => {
    const problems: string[] = [];
    for (const file of files) {
      const count = await literalEscapes(file);
      if (count > 0) {
        problems.push(
          `${path.relative(REPO_ROOT, file)}: ${count} escape(s) sit where nothing interprets them`,
        );
      }
    }
    expect(problems).toEqual([]);
  });
});

describe("the rule detects the bug it is for", () => {
  /** How many escapes in this source would the browser render literally? */
  async function escapesThatRenderLiterally(source: string): Promise<number> {
    const output = (await transform(source, { loader: "tsx", jsx: "automatic" })).code;
    return countDoubled(output) - countDoubled(source);
  }

  it("catches an escape in JSX text", async () => {
    expect(await escapesThatRenderLiterally("const el = <p>text \\u2014 more</p>;")).toBe(1);
  });

  it("catches an escape in a quoted JSX attribute value", async () => {
    expect(await escapesThatRenderLiterally('const el = <p title="a \\u2014 b" />;')).toBe(1);
  });

  it("leaves an escape in a string literal alone", async () => {
    expect(await escapesThatRenderLiterally('const a = "\\u2014";')).toBe(0);
  });

  it("leaves an escape in a template literal alone", async () => {
    expect(await escapesThatRenderLiterally("const a = `x \\u2014 y`;")).toBe(0);
  });

  it("leaves an escape in a regular expression alone", async () => {
    // The store strips control characters with a character class like
    // /[\\u0000-\\u001f]/ - a legitimate, necessary use.
    expect(await escapesThatRenderLiterally("const re = /[\\u0000-\\u001f]/g;")).toBe(0);
  });
});
