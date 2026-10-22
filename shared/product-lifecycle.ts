// The product-deletion POLICY, as a pure function so it can be unit-tested
// without a database and so the rule lives in exactly one place.
//
// WHY A POLICY AT ALL. `order_items.product_id` is ON DELETE SET NULL. So
// hard-deleting a product a customer actually ordered does not fail - it
// silently blanks the link from that placed order back to the product it was
// for, and the order history loses what it was selling. The deploy-time catalog
// sync already refuses to prune an order-referenced product for this reason; the
// admin Delete must apply the same rule, or the two disagree about what "delete"
// means.
//
// THE RULE:
//   - a product with NO order lines  -> hard-delete. Its variants, reviews and
//     wishlist entries cascade away with it and there is nothing to preserve.
//   - a product WITH order lines     -> archive. The row survives (so the order
//     keeps its link) but is removed from every storefront and admin surface, so
//     it is gone from the owner's point of view and can be restored.
export type ProductDeletion = "archive" | "hard-delete";

export function decideProductDeletion(orderLineCount: number): ProductDeletion {
  return orderLineCount > 0 ? "archive" : "hard-delete";
}
