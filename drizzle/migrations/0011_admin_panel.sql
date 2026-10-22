-- Make the admin panel fully real: managed categories, plus the two triage
-- columns the panel's inbox and mailing list need.
--
-- Three changes, all additive and all idempotent:
--
--   1. `categories` - the owner can create / rename / reorder / delete a
--      category. A product stores the category NAME (not an FK), so renaming a
--      category re-points its products in the same transaction (see
--      `updateCategory` in server/db.ts); creating a product under a new name
--      materialises the row (`ensureCategoryRow`). Existing product categories
--      are back-filled so the panel opens with the store's real aisles.
--
--   2. `contact_messages.status` - 'new' | 'read' | 'replied', so the inbox can
--      show what still needs an answer. Existing rows default to 'new'.
--
--   3. `newsletter_subscribers.status` - 'subscribed' | 'unsubscribed', so an
--      address can be suppressed without deleting the record.
--
-- Written idempotently (IF NOT EXISTS / guarded constraint / ON CONFLICT) on
-- purpose: the 0006/0007 snapshots were never committed, so a machine-generated
-- diff can be unreliable. This file makes only the real changes and is safe to
-- run whether or not the earlier migrations already landed.
CREATE TABLE IF NOT EXISTS "categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text DEFAULT '' NOT NULL,
        "featured" boolean DEFAULT false NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "categories" ADD CONSTRAINT "categories_name_unique" UNIQUE ("name");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_unique" UNIQUE ("slug");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_sort_idx" ON "categories" USING btree ("sort_order");--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "newsletter_subscribers" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'subscribed' NOT NULL;--> statement-breakpoint
-- Back-fill the categories that already exist on products, so the panel's
-- Categories page opens with the store's real aisles instead of an empty list.
-- `ON CONFLICT DO NOTHING` keeps this a no-op on a re-run.
INSERT INTO "categories" ("name", "slug", "sort_order")
SELECT DISTINCT
  p."category",
  btrim(lower(regexp_replace(p."category", '[^a-zA-Z0-9]+', '-', 'g')), '-'),
  0
FROM "products" p
WHERE p."category" IS NOT NULL AND btrim(p."category") <> ''
ON CONFLICT DO NOTHING;
