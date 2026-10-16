-- Server-owned saved carts + server-side session revocation.
--
-- WHY THIS EXISTS. Two real defects, one root cause: the basket was ONLY
-- localStorage, and the session was a stateless JWT that logout could not
-- revoke.
--
--  1. CART OWNERSHIP. Because the basket lived in the visitor's browser, the
--     server had no cart to authorise and the UI had no account to scope it to.
--     After signing out, the previous account's items stayed in localStorage and
--     kept rendering in the cart panel, and nothing could reject a mutation from
--     an unauthenticated caller. Persisting the basket against `users.id` makes
--     it an OWNED resource, so every read and write is checked against the
--     session (server/routers.ts `cart`) and sign-out can drop it.
--
--  2. SESSION REVOCATION. A stateless JWT stays valid until it expires; clearing
--     the cookie only removed the browser's copy. `auth_sessions` records each
--     issued token's `jti`, so sign-out is a real server-side revocation -
--     `requireSession` refuses a token whose row no longer exists.
--
-- IDEMPOTENT. Every object is guarded, so a re-run (or a partially applied
-- database) converges instead of erroring.

-- ── carts: exactly one per user ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "carts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "carts"
    ADD CONSTRAINT "carts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── cart_items: one line per (cart, product, variant) ───────────────────────
CREATE TABLE IF NOT EXISTS "cart_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cart_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "variant_id" uuid,
  "qty" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "cart_items"
    ADD CONSTRAINT "cart_items_cart_id_carts_id_fk"
    FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "cart_items"
    ADD CONSTRAINT "cart_items_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- SET NULL, not CASCADE: retiring a variant must not delete the shopper's line.
DO $$
BEGIN
  ALTER TABLE "cart_items"
    ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- NULLS NOT DISTINCT (PostgreSQL 15+) is load-bearing: without it the unique
-- index treats every NULL variant_id as distinct, so a base-product line could
-- be inserted twice and never merge. This makes `add` a safe upsert.
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_line_idx"
  ON "cart_items" ("cart_id", "product_id", "variant_id") NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS "cart_items_cart_idx" ON "cart_items" ("cart_id");

-- ── auth_sessions: revocable session records ────────────────────────────────
CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "auth_sessions"
    ADD CONSTRAINT "auth_sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "auth_sessions_user_idx" ON "auth_sessions" ("user_id");
