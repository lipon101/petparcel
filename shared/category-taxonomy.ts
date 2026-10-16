// Category-name tolerance.
//
// The shared catalog (`catalog-data.ts`) is the source of truth for which aisles
// the store carries. A product ROW, though, stores its category as a plain
// string, and a row written under an earlier name keeps that name until
// something rewrites it. So a filter for the current name would find nothing,
// and a renamed aisle would quietly start returning an empty grid.
//
// These helpers bridge the two without rewriting stored data, which also keeps
// them free of any database import and therefore directly testable.
//
// `RENAMED_CATEGORIES` is keyed by the OLD name and valued with the name used
// now. An array value means the old name covered more than one aisle, so it
// matches all of them - guessing which single aisle an individual row belonged
// to would be worse than matching a couple extra.

export const RENAMED_CATEGORIES: Record<string, string | string[]> = {
  "Travel & Outdoors": ["Travel", "Training"],
  Feeding: "Feeders & Fountains",
};

/** Every stored category string that should be treated as the requested aisle.
 *
 *  Returns an empty array for "no filter" - an absent category, or the "All"
 *  sentinel the shop page passes - so callers can add no predicate at all.
 *  Inverts `RENAMED_CATEGORIES` too, so a row already saved under the current
 *  name is still found by it. */
export function categoryEquivalents(category?: string): string[] {
  if (!category || category === "All") return [];
  const names = new Set<string>([category]);
  for (const [oldName, mapped] of Object.entries(RENAMED_CATEGORIES)) {
    const targets = Array.isArray(mapped) ? mapped : [mapped];
    if (targets.includes(category)) names.add(oldName);
  }
  return [...names];
}

/** The aisle a stored category string should be REPORTED under, i.e. the name
 *  the storefront uses now.
 *
 *  `knownCategories` is the catalog's current taxonomy. A stored name that is
 *  already current is returned untouched - which is what keeps an
 *  admin-invented category alive rather than silently renamed. A name no longer
 *  in the taxonomy is mapped forward when the forward name exists, and otherwise
 *  returned as-is so nothing ever disappears from the storefront. */
export function canonicalCategory(stored: string, knownCategories: Iterable<string>): string {
  const mapped = RENAMED_CATEGORIES[stored];
  if (!mapped) return stored;
  const known = knownCategories instanceof Set ? knownCategories : new Set(knownCategories);
  const candidates = Array.isArray(mapped) ? mapped : [mapped];
  return candidates.find((name) => known.has(name)) ?? candidates[0] ?? stored;
}
