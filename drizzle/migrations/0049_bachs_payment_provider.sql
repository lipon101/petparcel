-- Move the store's payment rail from NOWPayments (crypto) to Bachs (cards),
-- and add the ledger that makes a repeated webhook harmless.
--
-- WHY THE PROVIDER NAME CHANGES. The store's only payment method is now a
-- hosted card checkout on Bachs. An order placed under the old provider says
-- `nowpayments` in `payment_provider`, which is a name for a rail that no
-- longer exists - so it is rewritten to `bachs`. The column is free text, so
-- this is a value change, not a schema change.
--
-- NOTHING ELSE ABOUT AN ORDER CHANGES. The stored payment STATUS is left
-- exactly as it is: an order that was paid under the old rail stays paid, and
-- an order that was never paid stays unpaid. Rewriting a status would rewrite
-- history - it would un-settle an order that really was settled, and the store
-- would go looking for money it had already received.
--
-- The provider reference on an order (`payment_ref`) was the old gateway's
-- payment id and `payment_invoice_id` was its invoice id. Neither means
-- anything to Bachs, so they are CLEARED rather than carried over: a stale id
-- in either column would make the store try to read a Bachs charge that does
-- not exist. The hosted URL is cleared for the same reason - it points at the
-- old gateway's invoice page.
--
-- The consequence is honest and visible: an unpaid order from the old rail has
-- no live checkout any more, so the shopper is offered a FRESH hosted checkout
-- when they resume it. A paid order is untouched and stays paid.
--
-- WHY THE NEW TABLE. The provider guarantees AT-LEAST-ONCE delivery: the same
-- event can arrive more than once, and a delivery that did not get a 2xx is
-- retried. Bachs says to use the event id to deduplicate. This table IS that
-- deduplication: the event id is the primary key, so a repeated delivery
-- loses an INSERT and does no work at all.
--
-- It is not the ONLY guard. The paid transition, the supplier forward, the
-- receipt email and the owner's Telegram ping each carry their own durable
-- claim, and an order that is already paid is never walked backwards by a
-- late event. This table is the first line of defence, not the only one.

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "type" text NOT NULL,
  "order_number" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "payment_webhook_events_order_idx"
  ON "payment_webhook_events" ("order_number");

-- The provider name.
UPDATE "orders"
   SET "payment_provider" = 'bachs',
       "updated_at" = now()
 WHERE "payment_provider" = 'nowpayments';

-- The old gateway's handles, which mean nothing to the new one.
UPDATE "orders"
   SET "payment_ref" = NULL,
       "payment_invoice_id" = NULL,
       "payment_url" = NULL,
       "payment_status_detail" = NULL,
       "payment_last_ipn" = NULL,
       "payment_last_ipn_at" = NULL,
       "payment_last_ipn_status" = NULL,
       "updated_at" = now()
 WHERE "payment_provider" = 'bachs'
   AND "payment_status" <> 'paid'
   AND (
     "payment_ref" IS NOT NULL
     OR "payment_invoice_id" IS NOT NULL
     OR "payment_url" IS NOT NULL
   );

-- A settled order keeps its record of how it was settled - the last webhook
-- body still holds the old gateway's payment id, which is what an operator
-- needs to reconcile it - but the old gateway's HANDLES are still cleared:
-- they are not Bachs ids, and a stale id in `payment_ref` would make a refund
-- be addressed to a charge that does not exist. The old hosted URL is cleared
-- too: it points at the previous gateway's invoice page, which is dead, and
-- the admin panel labels that link with the CURRENT provider's name.
UPDATE "orders"
   SET "payment_ref" = NULL,
       "payment_invoice_id" = NULL,
       "payment_url" = NULL,
       "updated_at" = now()
 WHERE "payment_provider" = 'bachs'
   AND "payment_status" = 'paid'
   AND (
     "payment_ref" IS NOT NULL
     OR "payment_invoice_id" IS NOT NULL
     OR "payment_url" IS NOT NULL
   );

-- The store's own "which provider" setting. It names whatever rail the store
-- used before - and on a database that predates the crypto integration it is
-- still the platform's own default name - so it is rewritten to the one method
-- the store has. The storefront uses it only to PREFER a provider (and falls
-- back to the only one there is), so this is cosmetic - but a stale name in the
-- panel is a real confusion, and this is where the provider name is recorded.
UPDATE "store_settings"
   SET "value" = '"bachs"'::jsonb,
       "updated_at" = now()
 WHERE "key" = 'payment_provider'
   AND "value" <> '"bachs"'::jsonb;
