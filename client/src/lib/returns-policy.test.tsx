// Guards the /shipping-returns copy against the Merchant Center "Returns policy"
// form (PetParcel, ID 5875168829).
//
// The form is completed field by field and the live page is then reviewed against
// it, so a silent wording drift here is a compliance defect rather than a copy
// tweak: a window that no longer says 30 days, a refund figure that loses the
// word "business", or a policy that stops admitting defective items all put the
// listing at risk. This renders the REAL page to a static string - which also
// proves it still renders at all, so the negative assertions below can never pass
// on empty output.
//
// The 30-day default and the form value must move together: changing
// `return_window_days` is a policy change, not a setting nudge.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SETTINGS_DEFAULTS } from "@shared/store";
import { ShippingReturns } from "@/pages/Content";

/** The page as a shopper or reviewer reads it: tags stripped, entities unwrapped,
 *  whitespace collapsed - so an assertion is about the words, not the markup. */
function pageText(): string {
  return renderToStaticMarkup(<ShippingReturns />)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const text = pageText();

// Sanity first: a render that produced nothing would satisfy every `not` below.
it("renders the policy sections", () => {
  expect(text).toMatch(/Returns policy at a glance/);
  expect(text).toMatch(/Lost or delayed parcels/);
});

describe("shipping & returns matches the Merchant Center returns-policy form", () => {
  it("accepts returns for defective AND non-defective products", () => {
    expect(text).toMatch(/defective and non-defective/i);
    expect(text).toMatch(/changed your mind/i);
  });

  it("accepts exchanges", () => {
    expect(text).toMatch(/accept exchanges/i);
  });

  it("states the 30-day window the form declares, from the live setting", () => {
    expect(text).toContain(`${SETTINGS_DEFAULTS.return_window_days} days from delivery`);
    expect(text).toMatch(/30-day window/);
  });

  it("requires new, unused items only", () => {
    expect(text).toMatch(/New and unused only/i);
    // "resalable condition" was the old wording: it read as if a used-but-tidy
    // item were acceptable, which contradicts the form's "New only".
    expect(text).not.toMatch(/resalable/i);
  });

  it("offers a free prepaid label, included in the package, and return by mail", () => {
    expect(text).toMatch(/prepaid return label/i);
    expect(text).toMatch(/included in the package/i);
    expect(text).toMatch(/by mail/i);
  });

  it("addresses handing the item back in person, since the form says in store", () => {
    expect(text).toMatch(/in person/i);
  });

  it("charges no restocking fee", () => {
    expect(text).toMatch(/no restocking fee/i);
  });

  it("processes refunds within 10 business days - never plain days", () => {
    expect(text).toMatch(/10 business days/i);
    expect(text).not.toMatch(/10 days/i);
  });

  it("still allows 15 business days before tracing a stalled parcel", () => {
    expect(text).toMatch(/moved in 15 business days/i);
    expect(text).not.toMatch(/moved in 5 business days/);
  });
});

describe("shipping & returns states the flat rate and free returns, with no free-shipping tier", () => {
  it("quotes the flat $6.99 rate on every order", () => {
    expect(text).toMatch(/Flat \$6\.99 shipping/);
  });

  it("says returns are free and the label costs the customer nothing", () => {
    expect(text).toMatch(/Returns are free/i);
    expect(text).toMatch(/no return shipping cost to you/i);
    expect(text).toMatch(/no charge for it/i);
  });

  it("never advertises a free-shipping threshold that would contradict the flat rate", () => {
    // The live bug this guards: a free-over-$X tier on the store settings put
    // "Free shipping over $99" on product pages while this policy page said
    // "flat $6.99 on every order". The store now has NO free tier, so no
    // free-shipping threshold may appear anywhere in the policy copy.
    expect(text).not.toMatch(/free shipping over/i);
    expect(text).not.toMatch(/free over \$/i);
  });
});
