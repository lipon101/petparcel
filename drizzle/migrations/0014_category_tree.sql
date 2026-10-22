-- Category tree: give `categories` a self-referencing parent.
--
-- The storefront and the admin panel need to browse the CJdropshipping taxonomy
-- as a two-level tree (an aisle like "Pet Toys" with subcategories like "Pet
-- Chew Toys" beneath it), but `categories` was a flat list with no relationship
-- between rows. This adds a nullable `parent_id` self-FK: NULL means a top-level
-- aisle, a value means the row is a subcategory of that aisle.
--
-- ON DELETE SET NULL, not CASCADE: removing an aisle must never delete the
-- subcategories under it. They are promoted to top level instead. Products
-- reference a category by NAME (never an FK), so no product row is touched.
--
-- Written idempotently (ADD COLUMN IF NOT EXISTS / guarded constraint) on
-- purpose: the 0006/0007 snapshots were never committed, so a machine-generated
-- diff can be unreliable. This file makes the one real change and is safe to run
-- whether or not the earlier migrations already landed.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "categories"
    ADD CONSTRAINT "categories_parent_id_categories_id_fk"
    FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "categories_parent_idx" ON "categories" ("parent_id");
