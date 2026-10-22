-- Per-account wishlist + link contact messages to the signed-in user.
--
-- Written idempotently (IF NOT EXISTS / guarded constraints) on purpose: the
-- 0006 and 0007 snapshots were never committed, so a machine-generated diff
-- against the 0005 base would try to re-CREATE contact_messages and re-ADD
-- reviews.images. This file only makes the two real changes and is safe to run
-- whether or not the earlier migrations already landed.

-- 1) contact_messages.user_id - the account that sent the message. Nullable so
--    rows written before the form required a session stay valid.
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "user_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "contact_messages"
    ADD CONSTRAINT "contact_messages_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_user_idx" ON "contact_messages" USING btree ("user_id");--> statement-breakpoint

-- 2) wishlist_items - one saved product per (user, product). The unique index
--    makes "save" idempotent, so a double tap can never create two rows.
CREATE TABLE IF NOT EXISTS "wishlist_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wishlist_items"
    ADD CONSTRAINT "wishlist_items_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wishlist_items"
    ADD CONSTRAINT "wishlist_items_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wishlist_user_product_idx" ON "wishlist_items" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wishlist_user_idx" ON "wishlist_items" USING btree ("user_id");
