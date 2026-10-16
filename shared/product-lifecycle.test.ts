import { describe, expect, it } from "vitest";
import { decideProductDeletion } from "./product-lifecycle";

// The product-deletion policy. This is the rule that keeps a placed order's link
// to the product it was for intact: `order_items.product_id` is ON DELETE SET
// NULL, so hard-deleting an order-referenced product would silently blank that
// link. The rule is pure, so it is pinned here without a database.
describe("decideProductDeletion", () => {
  it("hard-deletes a product nobody has ordered", () => {
    expect(decideProductDeletion(0)).toBe("hard-delete");
  });

  it("archives a product that appears in at least one order line", () => {
    expect(decideProductDeletion(1)).toBe("archive");
    expect(decideProductDeletion(7)).toBe("archive");
  });

  it("treats a negative count defensively as 'no orders'", () => {
    // A count can never be negative in practice; if it ever were, erring toward
    // the non-destructive branch would be wrong (it would archive forever), so
    // the rule falls through to hard-delete exactly as a zero count does.
    expect(decideProductDeletion(-1)).toBe("hard-delete");
  });
});
