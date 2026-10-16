// Pure selection logic for the deploy-time catalog sync (scripts/sync-catalog.ts).
//
// Kept dependency-free and separate from the script so the one decision that
// matters - which products may be retired - can be unit tested without a
// database. The rule it encodes is the safety guarantee of the whole sync:
// a product that is no longer in the catalog is retired ONLY when it has no
// order history, so a placed order can never lose the product it references.

export interface CatalogProductRow {
  id: string;
  slug: string;
  name: string;
  /** How many order line items reference this product. */
  orderCount: number;
}

export interface CatalogPartition {
  /** In the catalog - left completely untouched. */
  keep: CatalogProductRow[];
  /** Not in the catalog and never ordered - safe to retire. */
  retire: CatalogProductRow[];
  /** Not in the catalog but has real order history - NEVER deleted. */
  protect: CatalogProductRow[];
}

/** Split the database's products into keep / retire / protect against the
 *  catalog's slugs. Order is preserved within each bucket. */
export function partitionCatalog(
  rows: readonly CatalogProductRow[],
  keepSlugs: Iterable<string>,
): CatalogPartition {
  const keep = new Set(keepSlugs);
  const out: CatalogPartition = { keep: [], retire: [], protect: [] };
  for (const row of rows) {
    if (keep.has(row.slug)) out.keep.push(row);
    else if (row.orderCount > 0) out.protect.push(row);
    else out.retire.push(row);
  }
  return out;
}

// ── The browse taxonomy and the settings table ──────────────────────────────
// The two rules below are the same shape as `partitionCatalog`, and for the same
// reason: `seedCategories` and `seedSettings` only ever INSERT, so a row that is
// no longer declared would live in the database forever. The reconcile-down half
// of each needs a decision that can be tested without a database, so it lives
// here rather than inside the script.

/** One row of the `categories` table, as the reconciler needs it. */
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  /** Its parent aisle's id, or null when it sits at top level. */
  parentId: string | null;
  /** How many products store this category's NAME. */
  productCount: number;
}

export interface CategoryPartition {
  /** Declared by the shipped taxonomy - left completely untouched. */
  keep: CategoryRow[];
  /** Not declared and holding nothing - safe to retire. */
  retire: CategoryRow[];
  /** Not declared but products are filed under it - NEVER deleted. */
  protect: CategoryRow[];
}

/** Split the database's categories into keep / retire / protect against the
 *  taxonomy's own names. Order is preserved within each bucket.
 *
 *  The protect rule is the safety guarantee: a product stores its category as a
 *  plain NAME (there is no foreign key), so deleting a populated category would
 *  leave its products filed nowhere and drop them out of every filter. A name
 *  the taxonomy has dropped is therefore retired only once nothing is filed
 *  under it - an admin-created aisle a shopper can still browse is kept, and
 *  reported, so a cleanup can never empty a shelf that has stock on it. */
export function partitionCategories(
  rows: readonly CategoryRow[],
  plannedNames: Iterable<string>,
): CategoryPartition {
  const planned = new Set(plannedNames);
  const out: CategoryPartition = { keep: [], retire: [], protect: [] };
  for (const row of rows) {
    if (planned.has(row.name)) out.keep.push(row);
    else if (row.productCount > 0) out.protect.push(row);
    else out.retire.push(row);
  }
  return out;
}

/** Split the settings table's keys into keep / retire against the keys the code
 *  reads. A key no code names is a dead row - nothing can render it, and the
 *  admin panel cannot edit it - so it is safe to retire. */
export function partitionSettings(
  keys: readonly string[],
  plannedKeys: Iterable<string>,
): { keep: string[]; retire: string[] } {
  const planned = new Set(plannedKeys);
  const keep: string[] = [];
  const retire: string[] = [];
  for (const key of keys) (planned.has(key) ? keep : retire).push(key);
  return { keep, retire };
}
