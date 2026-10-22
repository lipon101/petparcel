// Guards the cookie consent banner: that it can be CLOSED without consenting,
// and that it says as little as it can while still saying what it does.
//
// WHY THIS SUITE EXISTS. Two things the banner must never do:
//
//   1. treat a dismissal as a choice. The banner can be closed - with the X, or
//      with Escape - and closing must record NOTHING: no consent is stored, the
//      tag keeps the region default it was given (in the EEA: storage denied,
//      cookieless measurement only), and the banner asks again on the next
//      visit. Only a button records a choice. A dismissal that quietly wrote
//      "denied" would be a decision the visitor never made, and one that wrote
//      "granted" would be consent they never gave;
//   2. bury the answer in a paragraph. The copy has to name what the cookies
//      are for and point at the policy - and then get out of the way, because
//      the three buttons already say what the choices are.
//
// vitest runs in a node environment here (no jsdom), so the component cannot be
// mounted; this reads the source as text, the way the repo's other page-level
// checks do.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "ConsentBanner.tsx"), "utf8");

/** The body of a `useCallback`, from its `const` to the line that closes it. */
function block(start: string): string {
  const from = src.indexOf(start);
  expect(from, `${start} is missing`).toBeGreaterThan(-1);
  const end = src.indexOf("\n  }, [", from);
  expect(end, `the end of ${start} is missing`).toBeGreaterThan(from);
  return src.slice(from, end);
}

/** The class list of the button that carries a given accessible name. */
function classOfButton(ariaLabel: string): string {
  const at = src.indexOf(`aria-label="${ariaLabel}"`);
  expect(at, `${ariaLabel} is missing`).toBeGreaterThan(-1);
  const from = src.indexOf('className="', at);
  expect(from, `the class list of ${ariaLabel} is missing`).toBeGreaterThan(-1);
  const to = src.indexOf('"', from + 11);
  return src.slice(from, to);
}

describe("the cookie consent banner", () => {
  it("offers a close control", () => {
    expect(src).toContain('aria-label="Close without choosing"');
    expect(src).toContain("onClick={dismiss}");
  });

  it("records NO choice when it is closed", () => {
    // The dismiss handler is the whole of "closed": if it ever grew a
    // `saveConsent` call, closing would silently become a decision.
    const dismiss = block("const dismiss = useCallback");
    expect(dismiss).not.toContain("saveConsent");
    expect(dismiss).not.toContain("writeStoredConsent");
    expect(dismiss).toContain("setVisible(false)");
  });

  it("keeps the recorded choice separate from the dismissal", () => {
    const choose = block("const choose = useCallback");
    expect(choose).toContain("saveConsent(state)");
  });

  it("still offers the three answers", () => {
    expect(src).toContain("Accept");
    expect(src).toContain("Reject");
    expect(src).toContain("Customise");
  });

  it("gives every short label a full accessible name", () => {
    // A word each is easier to scan; the full meaning is what a screen reader
    // is told.
    expect(src).toContain('aria-label="Accept all cookies"');
    expect(src).toContain('aria-label="Reject all cookies that are not essential"');
    expect(src).toContain('aria-label="Choose which cookies to allow"');
  });

  it("says what the cookies are for, in as few words as it can", () => {
    const paragraph = /id="consent-desc"[\s\S]*?<\/p>/.exec(src)?.[0] ?? "";
    // The paragraph is prose plus a link; the text a visitor reads is what is
    // left once the markup is stripped.
    const words = paragraph
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
    // It must still say the two things that matter (what they do, and that
    // consent is what makes the extra part happen) and must not repeat the
    // three choices the buttons already offer.
    expect(words.length).toBeLessThanOrEqual(40);
    expect(paragraph).toContain("run the store");
    expect(paragraph).toContain("your consent");
    expect(paragraph).toContain("Privacy Policy");
  });

  it("names the title it always had", () => {
    expect(src).toContain("We value your privacy");
  });
});

describe("the banner's shape", () => {
  it("keeps the copy to two lines by giving it a fixed width", () => {
    // A copy that grows a third line when the window narrows is what made the
    // banner tall. The width is fixed so the text breaks into exactly two lines
    // at any window size.
    expect(src).toContain("w-[27rem]");
  });

  it("puts the copy and the three answers on one row", () => {
    expect(src).toMatch(/sm:flex-row/);
  });

  it("draws the three answers as compact buttons with white text", () => {
    // One weight, one height, one radius - and every label in white, the way
    // the rest of the store's calls to action are drawn.
    for (const label of [
      "Accept all cookies",
      "Reject all cookies that are not essential",
      "Choose which cookies to allow",
    ]) {
      const className = classOfButton(label);
      expect(className, label).toContain("h-9");
      expect(className, label).toContain("text-white");
    }
  });
});
