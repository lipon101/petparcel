// The product page's breadcrumb trail.
//
// WHY THIS EXISTS. The product page used to print `Home > <category> > <product
// name>`. On a real product the name is a full descriptive sentence ("Intelligent
// Litter Box Fully Enclosed Anti-splash Automatic Cleaning Deodorant"), so the
// trail dumped a long line of text across the top of the page - the first thing a
// shopper sees, and the least useful. The category was also printed as a bare
// leaf, so a shopper could not tell which AISLE it belonged to.
//
// The trail this module builds is the one the rest of the web uses:
//
//   Home > Shop > <Aisle> > <Subcategory>
//
// * The product NAME is dropped. The page's own <h1> already states it, so
//   repeating it in the trail adds length without adding orientation. A trail's
//   job is to say WHERE you are, not WHAT you are looking at.
// * The product's category is placed under its real parent AISLE when the browse
//   tree knows it, so "Pet Furniture Tools" reads as "Pet Furnitures > Pet
//   Furniture Tools" - the shopper can go up one level, then one more.
// * `Shop` is always present, giving every product page a consistent second step
//   and a reliable way back to the full catalogue.
// * It works for ANY product, including an admin-added row whose category is a
//   legacy name with no row in the browse tree: the aisle simply folds into the
//   category step rather than rendering an empty link.
//
// Pure and dependency-free, so the header, the page and the tests all agree on
// the same trail.

/** A minimum shape of the browse tree this module needs: an aisle and its
 *  subcategory names. Structurally compatible with `StoreCategoryNode`, so the
 *  page can pass its live tree straight in without a mapping step. */
export interface BreadcrumbTaxonomyNode {
  name: string;
  children: readonly { name: string }[];
}

export interface BreadcrumbCrumb {
  label: string;
  /** Where the crumb goes. The final crumb has no `to` - it is the current page. */
  to?: string;
}

/** The product's category resolved against the browse tree: the AISLE it sits
 *  under (when there is one) and the category itself. */
export interface CategoryTrail {
  aisle: string | null;
  category: string;
}

/** Find the aisle a category belongs to, or `null` when the category is itself a
 *  top-level aisle or is not in the tree at all (a legacy/admin-added name). */
export function resolveCategoryTrail(
  category: string,
  taxonomy: readonly BreadcrumbTaxonomyNode[],
): CategoryTrail {
  const name = category.trim();
  if (!name) return { aisle: null, category: "" };
  const parent = taxonomy.find((node) => node.children.some((c) => c.name === name));
  return { aisle: parent?.name ?? null, category: name };
}

/** The shop URL for a category filter, matching the rest of the storefront. */
function shopUrl(category?: string): string {
  return category ? `/shop?category=${encodeURIComponent(category)}` : "/shop";
}

/**
 * Build the product page's breadcrumb trail.
 *
 * `trail` is empty when the product has no usable category - the caller can then
 * simply not render a breadcrumb rather than show a lone "Home" fragment.
 */
export function buildProductBreadcrumb(
  category: string,
  taxonomy: readonly BreadcrumbTaxonomyNode[],
): BreadcrumbCrumb[] {
  const { aisle, category: leaf } = resolveCategoryTrail(category, taxonomy);
  if (!leaf) return [];

  const crumbs: BreadcrumbCrumb[] = [
    { label: "Home", to: "/" },
    { label: "Shop", to: "/shop" },
  ];

  // The aisle is a real step up the tree: "Pet Furnitures".
  if (aisle) crumbs.push({ label: aisle, to: shopUrl(aisle) });

  // The category is the last step. It links too, so the shopper can jump straight
  // to the filtered grid; the CURRENT page is still the product, so the final
  // crumb stays a link rather than becoming an inert piece of text.
  crumbs.push({ label: leaf, to: shopUrl(leaf) });

  return crumbs;
}
