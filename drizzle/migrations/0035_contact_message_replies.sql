-- Admin replies to storefront contact messages.
--
-- The admin panel could already mark a message read or replied, but there was no
-- way to actually ANSWER one: the "Reply" button only flipped a status flag, so a
-- customer never received anything. These two columns record the reply that was
-- sent, which is what makes the inbox a real two-way channel.
--
-- Nullable on purpose: every existing row simply has no reply yet, and a message
-- that has never been answered is the normal state. No backfill, no default.
--
--   replied_at           when the reply was sent (drives the "Replied · <time>"
--                        line in the panel, and orders the newest reply first)
--   reply_body           the reply text, kept so the panel can show exactly what
--                        the customer was told without a second lookup
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "replied_at" timestamp with time zone;
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "reply_body" text;
