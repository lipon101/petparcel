// Guards the buy box's quantity rules.
//
// The stepper shipped decorative: the field was `readOnly`, so the buttons could
// not move it - and even once they could, the one place the count was consumed
// (the add-to-cart press) dropped it, so every add landed as a single unit. These
// tests pin the arithmetic that makes the control real, and the boundaries that
// stop it promising more than the shelf holds.
import { describe, expect, it } from "vitest";
import {
  MAX_ORDER_QTY,
  MIN_ORDER_QTY,
  atCeiling,
  atFloor,
  clampQuantity,
  orderCeiling,
  stepQuantity,
} from "./quantity";
import { addCartLine, setCartLineQty, type CartLine } from "./petparcel";

const line = (over: Partial<CartLine> = {}): CartLine => ({
  slug: "pet-tent-bed",
  variantId: "v1",
  name: "Foldable Pet Tent Bed",
  variantName: "M · Military Green",
  priceCents: 3400,
  image: null,
  qty: 1,
  maxQty: 30,
  ...over,
});

describe("clampQuantity", () => {
  it("keeps a valid count as-is", () => {
    expect(clampQuantity(1, 30)).toBe(1);
    expect(clampQuantity(7, 30)).toBe(7);
    expect(clampQuantity(30, 30)).toBe(30);
  });

  it("never lets the count reach zero - a shopper removes a line, they do not order none", () => {
    expect(clampQuantity(0, 30)).toBe(MIN_ORDER_QTY);
    expect(clampQuantity(-4, 30)).toBe(MIN_ORDER_QTY);
  });

  it("stops at the ceiling instead of overshooting stock", () => {
    expect(clampQuantity(31, 30)).toBe(30);
    expect(clampQuantity(9999, 30)).toBe(30);
  });

  it("turns unparseable input into a floor of one rather than NaN", () => {
    for (const bad of ["", "abc", "  ", NaN, Infinity, -Infinity, null, undefined]) {
      expect(clampQuantity(bad as never, 30)).toBe(MIN_ORDER_QTY);
    }
  });

  it("truncates a fractional entry to a whole number", () => {
    expect(clampQuantity(4.9, 30)).toBe(4);
    expect(clampQuantity("4.9", 30)).toBe(4);
  });

  it("accepts a numeric string, because the field is text with inputMode=numeric", () => {
    expect(clampQuantity("12", 30)).toBe(12);
  });

  it("keeps a usable range for an out-of-stock variant instead of collapsing", () => {
    // Stock 0 still yields a ceiling of 1 so the control has a valid domain; the
    // sold-out state is expressed by disabling the buy buttons, not by making the
    // stepper's arithmetic undefined.
    expect(clampQuantity(1, 0)).toBe(1);
    expect(stepQuantity(1, 1, 0)).toBe(1);
  });
});

describe("stepQuantity", () => {
  it("moves the count by one in each direction", () => {
    expect(stepQuantity(1, 1, 30)).toBe(2);
    expect(stepQuantity(2, -1, 30)).toBe(1);
  });

  it("does not run past the floor when '-' is held", () => {
    expect(stepQuantity(1, -1, 30)).toBe(1);
    expect(stepQuantity(1, -5, 30)).toBe(1);
  });

  it("does not run past the ceiling when '+' is held", () => {
    expect(stepQuantity(30, 1, 30)).toBe(30);
    expect(stepQuantity(29, 5, 30)).toBe(30);
  });

  it("walks the full range without drifting", () => {
    let q = 1;
    for (let i = 0; i < 50; i++) q = stepQuantity(q, 1, 6);
    expect(q).toBe(6);
    for (let i = 0; i < 50; i++) q = stepQuantity(q, -1, 6);
    expect(q).toBe(1);
  });
});

describe("orderCeiling", () => {
  it("is the stock on hand when that is under the store cap", () => {
    expect(orderCeiling(1)).toBe(1);
    expect(orderCeiling(30)).toBe(30);
  });

  it("is capped at the per-line maximum so a huge stock cannot allow an absurd order", () => {
    expect(orderCeiling(100_000)).toBe(MAX_ORDER_QTY);
  });

  it("allows the full cap for an untracked line", () => {
    expect(orderCeiling(null)).toBe(MAX_ORDER_QTY);
    expect(orderCeiling(undefined)).toBe(MAX_ORDER_QTY);
  });

  it("never returns a ceiling below one, so the range is always valid", () => {
    expect(orderCeiling(0)).toBe(1);
    expect(orderCeiling(-3)).toBe(1);
  });
});

describe("atFloor / atCeiling", () => {
  it("reports the ends of the range so the buttons can disable", () => {
    expect(atFloor(1)).toBe(true);
    expect(atFloor(2)).toBe(false);
    expect(atCeiling(6, 6)).toBe(true);
    expect(atCeiling(5, 6)).toBe(false);
  });

  it("treats a value above the ceiling as at the ceiling", () => {
    expect(atCeiling(99, 6)).toBe(true);
  });
});

describe("the cart receives the quantity that was dialled in", () => {
  it("adds the requested count, not one unit", () => {
    const out = addCartLine([], line(), 3);
    expect(out).toHaveLength(1);
    expect(out[0].qty).toBe(3);
  });

  it("clamps an add against the line's own stock", () => {
    const out = addCartLine([], line({ maxQty: 4 }), 10);
    expect(out[0].qty).toBe(4);
  });

  it("merges a repeat add of the same line and still respects the stock cap", () => {
    const once = addCartLine([], line({ maxQty: 5 }), 3);
    const twice = addCartLine(once, line({ maxQty: 5 }), 3);
    expect(twice).toHaveLength(1);
    expect(twice[0].qty).toBe(5);
  });

  it("keeps different variants of the same product on separate lines", () => {
    const a = addCartLine([], line({ variantId: "v1" }), 2);
    const b = addCartLine(a, line({ variantId: "v2" }), 3);
    expect(b).toHaveLength(2);
    expect(b.map((l) => l.qty)).toEqual([2, 3]);
  });

  it("never stores an out-of-range add", () => {
    expect(addCartLine([], line(), 0)[0].qty).toBe(MIN_ORDER_QTY);
    expect(addCartLine([], line(), -5)[0].qty).toBe(MIN_ORDER_QTY);
  });
});

describe("editing a basket line", () => {
  it("sets the exact quantity the drawer asked for", () => {
    const out = setCartLineQty(addCartLine([], line(), 2), "pet-tent-bed", "v1", 4);
    expect(out[0].qty).toBe(4);
  });

  it("clamps the drawer's '+' to the line's stock", () => {
    const out = setCartLineQty(addCartLine([], line({ maxQty: 6 }), 5), "pet-tent-bed", "v1", 9);
    expect(out[0].qty).toBe(6);
  });

  it("removes the line rather than leaving a zero-quantity row", () => {
    expect(setCartLineQty(addCartLine([], line(), 2), "pet-tent-bed", "v1", 0)).toHaveLength(0);
  });

  it("leaves another line untouched", () => {
    const cart = addCartLine(addCartLine([], line({ variantId: "v1" }), 2), line({ variantId: "v2" }), 3);
    const out = setCartLineQty(cart, "pet-tent-bed", "v1", 5);
    expect(out.find((l) => l.variantId === "v2")?.qty).toBe(3);
  });
});
