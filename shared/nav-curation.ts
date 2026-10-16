// Navigation curation.
//
// WHY THIS EXISTS. The browse taxonomy is a real supplier catalogue: fifteen
// aisles and sixty-eight subcategories. That is the right shape for a SHOP PAGE,
// which is a place a shopper goes to browse. It is the wrong shape for a HEADER
// and a FOOTER, which are places a shopper glances at while doing something else
// - rendering the whole tree there is a wall of ninety links that buries
// everything around it.
//
// So the header and footer show a CURATED slice and hand the full tree to the
// shop page in one click. The rules below are the curation, kept here - pure, no
// React and no database - so the header, the footer and their tests agree on the
// same list rather than each inventing one.
//
// THE RULES, in priority order:
//  1. STOCKED FIRST. An aisle the store actually carries leads. A supplier
//     catalogue is a target list, not a stock list, and a shopper must not have
//     to read past ten empty aisles to reach the ones with products.
//  2. THEN THE TAXONOMY'S OWN ORDER. Within the stocked and unstocked groups the
//     order is the catalogue's (or, once an admin has dragged the aisles, the
//     admin's - the caller passes the nodes already in that order, so this file
//     never has to know which).
//  3. CAP IT. A fixed, small number of aisles keeps the menu scannable. Anything
//     beyond the cap is not lost - the "Shop all categories" link opens the full
//     tree, which is what makes the cap safe.
//
// A subcategory is offered beside its aisle only when it is worth offering: the
// ones with stock, in order, capped. An aisle with no stocked subcategory simply
// shows none, rather than padding the menu with empty shelves.

/** One aisle, as the nav needs it: a name plus the subcategories beneath it. */
export interface NavNode {
  name: string;
  productCount: number;
  children: readonly { name: string; productCount: number }[];
}

/** The most aisles the header menu shows before it hands off to the shop page. */
export const HEADER_AISLE_LIMIT = 6;

/** The most subcategories shown beside one aisle in the header menu. */
export const HEADER_CHILD_LIMIT = 4;

/** The most aisles the footer's Shop column lists. */
export const FOOTER_AISLE_LIMIT = 6;

/** The most subcategories shown beside one aisle in the footer. */
export const FOOTER_CHILD_LIMIT = 0;

/** Stocked first, then the incoming order; a stable sort, so the taxonomy's (or
 *  the admin's) sequence survives inside each group. */
function stockedFirst<T extends { productCount: number }>(nodes: readonly T[]): T[] {
  return [...nodes.filter((n) => n.productCount > 0), ...nodes.filter((n) => n.productCount === 0)];
}

/** The subcategories worth naming beside an aisle: the stocked ones in order,
 *  capped. Empty when nothing beneath the aisle is stocked - see the header's
 *  own comment for why a subcategory is never used as padding. */
function featuredChildren(node: NavNode, limit: number): { name: string; productCount: number }[] {
  if (limit <= 0) return [];
  // STOCKED ONLY: an empty shelf is not worth a slot in a menu, and offering one
  // sends a shopper to a page with nothing to buy. The incoming order is kept
  // among the stocked ones, so the featured subcategories are the catalogue's
  // (or the admin's) own first choices that actually carry stock.
  return node.children
    .filter((c) => c.productCount > 0)
    .slice(0, limit)
    .map((c) => ({ name: c.name, productCount: c.productCount }));
}

/**
 * The curated navigation: the aisles to show, in order, each with the
 * subcategories worth offering beside it.
 *
 * `nodes` MUST already be in the order to fall back on (the tree endpoint
 * returns it in the taxonomy's own order, or the admin's once aisles have been
 * dragged) - this function only re-ranks by stock within that.
 */
export function curateNav(
  nodes: readonly NavNode[],
  aisleLimit: number,
  childLimit: number,
): { name: string; productCount: number; children: { name: string; productCount: number }[] }[] {
  return stockedFirst(nodes)
    .slice(0, aisleLimit)
    .map((n) => ({
      name: n.name,
      productCount: n.productCount,
      children: featuredChildren(n, childLimit),
    }));
}

/** The header's curated aisle list. */
export function curateHeaderNav(nodes: readonly NavNode[]) {
  return curateNav(nodes, HEADER_AISLE_LIMIT, HEADER_CHILD_LIMIT);
}

/** The footer's curated aisle list - fewer subcategories, same ranking. */
export function curateFooterNav(nodes: readonly NavNode[]) {
  return curateNav(nodes, FOOTER_AISLE_LIMIT, FOOTER_CHILD_LIMIT);
}

/** How many aisles the curation is holding back, so the menu can say "N more".
 *  Zero when everything is already shown. */
export function hiddenAisleCount(nodes: readonly NavNode[], aisleLimit: number): number {
  return Math.max(0, nodes.length - aisleLimit);
}
