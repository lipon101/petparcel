// The store's browse taxonomy: a two-level tree of aisles and subcategories.
//
// WHY THIS FILE EXISTS. `shared/store.ts` holds `CATEGORY_ORDER` - the flat
// pet-niche list the storefront was originally designed around - and a product
// stores its category as a plain NAME. Neither can express "this aisle has
// subcategories", which is what a real supplier catalogue (and a browsable shop
// page) needs. This module is the single, pure description of that tree: the
// importer and the storefront's browse surfaces both read it, so what is
// inserted into the database and what the shop page offers to click can never
// drift apart.
//
// It is DELIBERATELY free of any database import, which is what makes it
// directly testable (see `category-tree.test.ts`) and safe to import from a
// client component.
//
// KEY CONSTRAINT - names are GLOBALLY UNIQUE in the database. The `categories`
// table has a unique index on `name`, and a product references its category by
// NAME, so two different aisles may not both be called "Pet Bags": a filter for
// that name would be ambiguous. The source taxonomy lists one name twice (see
// `CATEGORY_TREE_DUPLICATES`), so `uniqueFlatCategories()` keeps the FIRST
// parent that claims a name and reports the rest - the tree stays valid and
// every name still resolves to exactly one place.

/** One top-level aisle and the subcategories filed under it. */
export interface CategoryTreeNode {
  name: string;
  children: string[];
}

/**
 * The browse taxonomy, in the order the aisles should appear. Parents lead with
 * the subcategories beneath them. Names are reproduced verbatim from the
 * supplier's catalogue - including its own capitalisation ("Custom Pet tags")
 * and pluralisation ("Pet Groomings") - so a stored category can be matched
 * against the source list without a translation table.
 */
export const CJ_CATEGORY_TREE: readonly CategoryTreeNode[] = [
  {
    name: "Pet Toys",
    children: [
      "Pet Chase Toys",
      "Pet Chew Toys",
      "Pet Training and Educational Toys",
      "Pet Sound Toys",
      "Pet Tunnel Toys",
      "Pet Toy Set",
      "Pet Plush Toys",
    ],
  },
  {
    name: "Pet Drinking & Feeding",
    children: ["Pet Bowls", "Pet Drinking Tools", "Pet Feeding Tools"],
  },
  {
    name: "Pet Outdoor Supplies",
    children: [
      "Barking Control Equipments",
      "Trainers",
      "Dog Training Pads & Diapers",
      "Pet Snacks",
      "Pet Bags",
      "Pet Seat Belts",
      "Pet Car Mats",
      "Pet Guardrails",
    ],
  },
  {
    name: "Bird Supplies",
    children: [
      "Bird Feeders",
      "Bird Cages",
      "Bird Swings",
      "Bird Toys",
      "Bird Travel Bags",
      "Bird Accessories",
    ],
  },
  {
    name: "Fish & Aquatic Pets",
    children: ["Fish Tanks", "Fish Tank Decorations", "Fish Tank Cleaning Supplies"],
  },
  {
    name: "Pet Apparels",
    children: [
      "Pet Dresses",
      "Pet Tops",
      "Pet Sweaters",
      "Pet Sweatshirts & Hoodies",
      "Pet Coats & Jackets",
      "Pet Jumpsuits",
      "Pet Pajamas",
      "Pet Clothings",
      "Pet Functional Clothings",
      "Pet Clothing Sets",
      "Pet Down & Parkas",
      "Pet Shoes & Socks",
      "Pet Scarves",
      "Pet Bags",
    ],
  },
  {
    name: "Pet Collars, Harnesses & Accessories",
    children: [
      "Pet Hair Accessories",
      "Pet Bows & Ties",
      "Pet Necklaces",
      "Pet Headwears",
      "Pet Glasses",
      "Pet Collars",
      "Pet Leashes",
      "Pet Harnesses",
      "Pet Muzzles",
      "Pet Collar, Leash & Harness Sets",
      "Custom Pet tags",
      "Collars, Leashes & Harnesses",
    ],
  },
  {
    name: "Pet Groomings",
    children: [
      "Pet Hair Removers & Combs",
      "Pet Nail Polishers",
      "Pet Shower Products",
      "Pet Towels",
    ],
  },
  {
    name: "Pet Furnitures",
    children: [
      "Cat Scratching Posts",
      "Pet Furniture Protectors",
      "Cat Trees & Condos",
      "Pet Furniture Tools",
      "Pet Houses & Cages",
      "Dog Stairs & Steps",
      "Pet Tents",
      "Pet Hammocks",
    ],
  },
  {
    name: "Pet Bedding",
    children: ["Pet Mats", "Pet Nests", "Pet Beds", "Pet Blankets & Quilts"],
  },
];

/** A category flattened to the shape the database stores: a name, the name of
 *  its parent aisle (or null for a top-level one) and its order among siblings. */
export interface FlatCategory {
  name: string;
  parent: string | null;
  sortOrder: number;
}

/** A name the source taxonomy lists under more than one aisle. Kept explicit
 *  rather than silently swallowed, because it is the one place the source list
 *  cannot be inserted verbatim (the name column is unique). */
export interface CategoryNameCollision {
  name: string;
  parents: string[];
}

/** Every (name -> parents[]) collision in the source tree, in tree order. */
export function findCategoryNameCollisions(
  tree: readonly CategoryTreeNode[] = CJ_CATEGORY_TREE,
): CategoryNameCollision[] {
  const parentsByName = new Map<string, string[]>();
  for (const parent of tree) {
    for (const child of parent.children) {
      const parents = parentsByName.get(child) ?? [];
      parents.push(parent.name);
      parentsByName.set(child, parents);
    }
  }
  const out: CategoryNameCollision[] = [];
  for (const [name, parents] of parentsByName) {
    if (parents.length > 1) out.push({ name, parents });
  }
  return out;
}

/** The collisions in the shipped tree - exposed so the importer can report them
 *  and a test can pin that there is exactly one. */
export const CATEGORY_TREE_DUPLICATES: readonly CategoryNameCollision[] =
  findCategoryNameCollisions();

/**
 * The tree flattened to database rows, with each NAME kept once.
 *
 * A name claimed by more than one aisle is filed under the FIRST parent that
 * claims it (tree order), which is the deterministic choice - the alternative,
 * inventing a disambiguated name like "Pet Bags (Apparel)", would put a label in
 * the catalogue that the supplier's own list does not contain.
 */
export function uniqueFlatCategories(
  tree: readonly CategoryTreeNode[] = CJ_CATEGORY_TREE,
): FlatCategory[] {
  const seen = new Set<string>();
  const out: FlatCategory[] = [];
  tree.forEach((parent, parentIndex) => {
    if (!seen.has(parent.name)) {
      seen.add(parent.name);
      out.push({ name: parent.name, parent: null, sortOrder: parentIndex });
    }
    parent.children.forEach((child, childIndex) => {
      if (seen.has(child)) return;
      seen.add(child);
      out.push({ name: child, parent: parent.name, sortOrder: childIndex });
    });
  });
  return out;
}

/**
 * Every category NAME the shipped taxonomy declares - the aisles and every
 * subcategory filed under one.
 *
 * This is the set a reconciler compares the database against. `seedCategories`
 * only ever INSERTS the declared tree, so a row left over from an earlier
 * taxonomy (a retired aisle, a duplicate) would otherwise live in the database
 * forever and keep rendering as a browse tile. Anything OUTSIDE this set is
 * either an admin's own addition (which the reconciler protects the moment a
 * product is filed under it) or dead weight it may retire.
 */
export function plannedCategoryNames(
  tree: readonly CategoryTreeNode[] = CJ_CATEGORY_TREE,
): Set<string> {
  return new Set(uniqueFlatCategories(tree).map((c) => c.name));
}

/** name -> its parent aisle, built once from the shipped tree. */
const PARENT_BY_NAME: Map<string, string> = new Map(
  uniqueFlatCategories().filter((c) => c.parent).map((c) => [c.name, c.parent as string]),
);

/** The subcategories filed under an aisle, in tree order. Empty for a
 *  subcategory, and for any name the tree does not know. */
export function categoryChildren(name: string): string[] {
  const parent = CJ_CATEGORY_TREE.find((p) => p.name === name);
  return parent ? [...parent.children] : [];
}

/** The top-level aisle a subcategory belongs to, or null when the name is a
 *  top-level aisle itself (or is not in the tree at all). */
export function categoryParent(name: string): string | null {
  return PARENT_BY_NAME.get(name) ?? null;
}

/** True for a name that has subcategories in the tree. */
export function isCategoryParent(name: string): boolean {
  return CJ_CATEGORY_TREE.some((p) => p.name === name);
}

/**
 * Every category name a filter for `name` should match, INCLUDING the name
 * itself first.
 *
 * Selecting an aisle must show the products filed under its subcategories too -
 * that is what makes browsing "Pet Toys" useful before anything is filed
 * directly on it. Selecting a subcategory returns just that subcategory. A name
 * the tree does not know returns only itself, so an admin-invented category
 * keeps matching exactly its own rows (never a sibling's).
 */
export function categoryWithDescendants(name: string): string[] {
  if (!name) return [];
  const children = categoryChildren(name);
  return children.length ? [name, ...children] : [name];
}

/** The full list of top-level aisle names, in tree order. */
export function treeParentNames(): string[] {
  return CJ_CATEGORY_TREE.map((p) => p.name);
}
