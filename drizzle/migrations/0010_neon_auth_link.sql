-- Bridge the local `users` table to Neon Auth (Better Auth).
--
-- Neon Auth stores its own users in the `neon_auth` schema with its OWN ids,
-- which do NOT match the `users.id` UUIDs that orders / wishlist_items /
-- contact_messages / reviews reference. Rather than repoint every foreign key
-- (which would rewrite live order history), we keep `users.id` as the anchor and
-- add a nullable, unique link column: `neon_auth_user_id` holds the Neon Auth
-- user id for accounts that authenticate through Neon Auth.
--
--   * NULL  -> a legacy local (bcrypt) account that has not yet signed in via
--              Neon Auth. Existing rows keep working untouched.
--   * set   -> the account is owned by Neon Auth; `password_hash` is left NULL
--              because Neon Auth holds the credential.
--
-- On the first Neon Auth sign-in we LINK by email (so the existing admin /
-- customer rows keep their orders and their role) and only CREATE a row when no
-- local account with that email exists.
--
-- Written idempotently (IF NOT EXISTS / guarded constraint) on purpose: the
-- 0006/0007 snapshots were never committed, so a machine-generated diff can be
-- unreliable. This file makes the one real change and is safe to run whether or
-- not the earlier migrations already landed.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "neon_auth_user_id" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_neon_auth_user_id_unique" UNIQUE ("neon_auth_user_id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
