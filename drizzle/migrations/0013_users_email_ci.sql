-- Case-insensitive uniqueness for `users.email`.
--
-- The original `users_email_unique` constraint compared addresses case-
-- SENSITIVELY, so `Foo@x.com` and `foo@x.com` could both exist as separate
-- accounts. Every app write path lower-cases the address, but a row created
-- before that convention (or by a direct insert) can carry mixed case - and the
-- Neon Auth bridge, which links a provider account to a local row BY EMAIL,
-- would then MISS the canonical row and create a DUPLICATE account for the same
-- person (the exact bug that let a mixed-case admin row be shadowed by a fresh
-- 'user' row). This migration makes the database itself enforce one account per
-- address regardless of casing.
--
-- Written to be safe to run on any database:
--   * the new index is created FIRST, and a pre-existing case-duplicate only
--     raises a WARNING (it never aborts the migration / the deploy);
--   * the old case-sensitive constraint is dropped ONLY once the new index
--     exists, so email uniqueness is never absent for even one statement.
-- Idempotent: re-running is a no-op.

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique" ON "users" (lower("email"));
EXCEPTION WHEN unique_violation THEN
  RAISE WARNING '[0013] users_email_lower_unique not created - duplicate emails differing only by case exist; resolve them and re-run';
END $$;--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_email_lower_unique') THEN
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
  END IF;
END $$;
