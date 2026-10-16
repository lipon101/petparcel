-- Category ordering: let an admin's chosen order survive every read.
--
-- The browse tree used to be rendered in the order the taxonomy declares, with
-- anything else (an admin-created aisle, or a row written by an earlier seeder)
-- falling to the end alphabetically. Dragging an aisle or a subcategory has to
-- move it for REAL, so the reader has to stop preferring the built-in taxonomy
-- over the stored `sort_order` the moment an admin has actually chosen an order.
--
-- `order_pinned` is that signal. It is described in full in drizzle/schema.ts;
-- the short version is that once it is set for a list, `sort_order` alone
-- decides that list's order.
--
-- WHY THE BACKFILL. The live store's stored `sort_order` is NOT its rendered
-- order: the ten CJdropshipping aisles carry their taxonomy index (0-9, because
-- 0014 inserted them in taxonomy order), while the five aisles the catalog
-- launched with (Cats, Dogs, Feeding, Grooming, Travel & Outdoors) all sit at 0
-- and were pushed to the END of the row by the taxonomy fallback. Pinning those
-- raw values as-is would therefore have reordered the storefront. So the last
-- five are first moved to positions 10-14 - the exact slot the fallback already
-- gave them - and only then is everything pinned. After this, every row's
-- `sort_order` IS its rendered position, so the admin list and the storefront
-- agree and a drag has something meaningful to rewrite.
--
-- The shift is COMPUTED, not `sort_order + 10`, so it is idempotent: re-running
-- sets the same five values rather than drifting them further each time. On a
-- fresh database (the taxonomy seeded, none of those five names present) it
-- matches no rows and changes nothing.
--
-- Written idempotently (ADD COLUMN IF NOT EXISTS / computed, not incremental
-- updates) on purpose: the 0006/0007 snapshots were never committed, so a
-- machine-generated diff can be unreliable.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "order_pinned" boolean NOT NULL DEFAULT false;--> statement-breakpoint

UPDATE "categories" SET "order_pinned" = true;--> statement-breakpoint

UPDATE "categories" SET "sort_order" = 10 + "ranked"."rn"
FROM (
  SELECT "id", (row_number() OVER (ORDER BY "name")) - 1 AS "rn"
  FROM "categories"
  WHERE "parent_id" IS NULL
    AND "name" IN ('Cats', 'Dogs', 'Feeding', 'Grooming', 'Travel & Outdoors')
) AS "ranked"
WHERE "categories"."id" = "ranked"."id";--> statement-breakpoint
