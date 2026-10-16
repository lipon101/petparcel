import { describe, expect, it } from "vitest";
import { partitionCatalog, type CatalogProductRow } from "./catalog-sync";

const row = (slug: string, orderCount = 0): CatalogProductRow => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  orderCount,
});

describe("partitionCatalog", () => {
  it("keeps every product the catalog still declares", () => {
    const { keep, retire, protect } = partitionCatalog(
      [row("litter-box"), row("old-harness")],
      ["litter-box"],
    );
    expect(keep.map((r) => r.slug)).toEqual(["litter-box"]);
    expect(retire.map((r) => r.slug)).toEqual(["old-harness"]);
    expect(protect).toEqual([]);
  });

  it("retires a stale product that has no order history", () => {
    const { retire } = partitionCatalog([row("demo-toy", 0)], ["litter-box"]);
    expect(retire.map((r) => r.slug)).toEqual(["demo-toy"]);
  });

  it("NEVER retires a stale product that has real order history", () => {
    const { retire, protect } = partitionCatalog([row("demo-toy", 3)], ["litter-box"]);
    expect(retire).toEqual([]);
    expect(protect.map((r) => r.slug)).toEqual(["demo-toy"]);
  });

  it("keeps a catalog product even when it has order history", () => {
    const { keep, protect } = partitionCatalog([row("litter-box", 5)], ["litter-box"]);
    expect(keep.map((r) => r.slug)).toEqual(["litter-box"]);
    expect(protect).toEqual([]);
  });

  it("preserves input order within each bucket", () => {
    const { retire } = partitionCatalog(
      [row("a"), row("b"), row("c")],
      [],
    );
    expect(retire.map((r) => r.slug)).toEqual(["a", "b", "c"]);
  });

  it("retires everything when the catalog is empty and nothing was ordered", () => {
    const { keep, retire } = partitionCatalog([row("a"), row("b")], []);
    expect(keep).toEqual([]);
    expect(retire).toHaveLength(2);
  });
});
