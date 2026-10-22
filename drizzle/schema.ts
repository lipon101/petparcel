import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  bigint,
  integer,
  boolean,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { AddressSnapshot } from "../shared/store";
import type { ProductSpecs } from "../shared/product-specs";

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM TABLES - managed by the scaffold. NEVER redefine/drop the auth columns
// on `users`, and never touch `files` (server/_core/storage.ts writes it).
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  name: text("name"),
  role: text("role").notNull().default("user"), // 'user' | 'admin'  <- authorisation
  /** Set when the address is proven via the emailed link. NULL = unverified. */
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** Neon Auth (Better Auth) user id, when this account authenticates through
   *  Neon Auth. NULL for a legacy local (bcrypt) account. `users.id` stays the
   *  anchor every business FK points at, so switching the auth provider never
   *  rewrites order / wishlist / contact history - see migration 0010. */
  neonAuthUserId: text("neon_auth_user_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    contentType: text("content_type"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("files_owner_idx").on(t.ownerId), index("files_created_idx").on(t.createdAt)],
);

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS TABLES - PetParcel.
//
// Authorisation note: admin access is decided by `users.role` (the platform's
// `adminProcedure` reads exactly that), NOT by a role column on a business
// table. `user_profiles` therefore holds only profile data - one source of
// truth for permissions, no mirror column that can drift out of sync.
// ─────────────────────────────────────────────────────────────────────────────

/** Extra profile data for a customer. Row is created on first save. */
export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Saved shipping/billing addresses. Owner-scoped (user_id). */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label"),
    fullName: text("full_name").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("US"),
    phone: text("phone"),
    isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
    isDefaultBilling: boolean("is_default_billing").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

/** Catalog products. Store-owned: public read, admin write. */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Dogs"),
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    /** The gallery, as images AND videos. `images` above is kept as the
     *  image-only projection of this list so every older consumer (cart
     *  thumbnail, JSON-LD, OG image) stays correct, while the product page
     *  renders a real <video> for each `kind: "video"` entry. Every `url` is one
     *  we serve ourselves - a third-party source URL is never stored here. */
    media: jsonb("media").$type<{ url: string; kind: "image" | "video" }[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    /** Real attributes for the Product Details tab - materials, dimensions,
     *  weight and care. JSONB rather than four columns because the set of
     *  attributes is open (a food adds ingredients, a crate adds a door size)
     *  and the tab renders whatever keys are present. */
    specs: jsonb("specs").$type<ProductSpecs>().notNull().default({}),
    /** The SUPPLIER'S OWN option dimensions for this product, as stated on the
     *  supplier's product page: the real dimension token ("COLOR", "SIZE",
     *  "QTY") and the storefront's heading for it ("Colour", "Size", "Pack").
     *
     *  Stored on the PRODUCT rather than on each variant, because a dimension is
     *  a property of the product and not of one option value - and because two
     *  values of the same dimension must not be able to disagree about what the
     *  dimension is called. An EMPTY array is meaningful: it is the supplier's
     *  own statement that this product has no options (CJ's "Default"/"Title"
     *  listing), which is what lets the buy box say so plainly instead of drawing
     *  a chooser with one entry. Kept out of the variant NAME so no supplier word
     *  ever leaks into the customer-facing option text. */
    optionDimensions: jsonb("option_dimensions")
      .$type<{ token: string; kind: string; label: string }[]>()
      .notNull()
      .default([]),
    /** The supplier's raw schema string (`productKeyEn` / `productKey`), kept
     *  only for admin/diagnostics so the parsed `optionDimensions` above can be
     *  re-derived without another supplier call. Never rendered. */
    cjOptionSchema: text("cj_option_schema"),
    active: boolean("active").notNull().default(true),
    /** True once the product has been DELETED while it had order history.
     *
     *  A product a customer actually ordered is archived rather than erased, so
     *  `order_items.product_id` (ON DELETE SET NULL) keeps pointing at it and a
     *  placed order never loses the product it was for. An archived product is
     *  excluded from every storefront read and from the admin list, so it is
     *  gone from the owner's point of view while remaining recoverable. A
     *  product with no order history is hard-deleted instead. See `deleteProduct`
     *  in server/db.ts. */
    archived: boolean("archived").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_category_idx").on(t.category),
    index("products_active_idx").on(t.active),
  ],
);

/** Store categories. Admin-managed: the owner creates, renames, reorders and
 *  deletes them. A product carries its category NAME (not an FK) so the
 *  storefront's filtering and the hot catalog read are unchanged - renaming a
 *  category therefore RE-POINTS its products in the same transaction (see
 *  `updateCategory` in server/db.ts), and creating a product under a new name
 *  materialises the row (see `ensureCategoryRow`). */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull().unique(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    /** Parent aisle for a subcategory, NULL for a top-level aisle.
     *
     *  This is what makes the supplier tree browsable: a subcategory
     *  ("Pet Chew Toys") belongs to exactly one parent ("Pet Toys"), while a
     *  parent has a parent of NULL. Depth is capped at two in practice (the
     *  products, the filters and the admin pickers all assume parent ->
     *  subcategory), but nothing in the table forbids a deeper tree.
     *
     *  `onDelete: "set null"` rather than "cascade": deleting an aisle must
     *  never erase the aisles beneath it - they are promoted to top level, which
     *  is the non-destructive choice for a live catalog. Products reference a
     *  category by NAME (not an FK), so no product is ever touched either way. */
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    featured: boolean("featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    /** True once an admin has chosen this row's position by dragging.
     *
     *  The reader renders the built-in taxonomy's designed order until this is
     *  set, so a fresh database (and the live store today) shows the aisles in
     *  the curated sequence rather than insertion order. The first reorder marks
     *  every row in the affected list, after which `sort_order` decides alone -
     *  a drag therefore moves a category for real, and the choice survives a
     *  reload. See `reorderCategories` in server/db.ts. */
    orderPinned: boolean("order_pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("categories_sort_idx").on(t.sortOrder),
    index("categories_parent_idx").on(t.parentId),
  ],
);

/** Variants carry the SKU, the real price and the stock count. */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku").notNull(),
    priceCents: integer("price_cents").notNull(),
    inventoryQty: integer("inventory_qty").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    /** Upstream supplier variant id (VID) - the identifier CJ's order API needs to
     *  fulfil this exact option. NULL means "not yet mapped to a CJ variant", so
     *  the order-forwarding service refuses to push an order containing it
     *  rather than guessing. Populated from the real CJ listing (see
     *  shared/catalog-data.ts) and editable in the admin product editor. */
    cjVid: text("cj_vid"),
    /** The CJ variant SKU, kept alongside the VID so a human can reconcile the
     *  row against the CJ listing without a lookup. Usually equal to `sku` for
     *  a catalog product, but stored separately because an admin may re-SKU a
     *  variant locally while the CJ side keeps its own code. */
    cjSku: text("cj_sku"),
    /** The variant's OWN product photograph, hosted on our R2 bucket. CJ returns
     *  a real `variantImage` per variant (the blue bowl, the pink bowl), so a
     *  colour press can show the colour the shopper actually picked instead of
     *  the product's first photo. NULL means "no variant-specific shot" - the
     *  gallery then falls back to the product's own images, never a placeholder. */
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("variants_product_idx").on(t.productId),
    index("variants_sku_idx").on(t.sku),
    // A VID identifies exactly one CJ variant, so it must be unique across the
    // table - two store variants pointing at the same CJ variant would ship the
    // wrong option. Partial (WHERE cj_vid IS NOT NULL) so the many unmapped
    // rows do not collide on NULL.
    uniqueIndex("variants_cj_vid_idx").on(t.cjVid).where(sql`${t.cjVid} is not null`),
  ],
);

/** Orders. `user_id` is NULL for guest checkout. Addresses are snapshots. */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull().unique(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    status: text("status").notNull().default("pending"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
    paymentProvider: text("payment_provider"),
    /** The provider's CHARGE id (`ch_...`) - the identifier a refund is
     *  addressed to. Null until the shopper starts paying. */
    paymentRef: text("payment_ref"),
    /** The RAW provider status (Bachs: succeeded / processing / failed /
     *  underpaid / refunded / ...). The coarse `payment_status` above is what
     *  the admin panel and the CJ guard key off; this is what the shopper's
     *  confirmation page renders, so the real state is shown rather than a
     *  smoothed-over "unpaid". */
    paymentStatusDetail: text("payment_status_detail"),
    /** The provider's CHECKOUT SESSION id (`chk_...`). A charge id only exists
     *  once the shopper starts paying, so this is what the status endpoint
     *  reads in the window between "order placed" and "first card". */
    paymentInvoiceId: text("payment_invoice_id"),
    /** The hosted checkout URL we redirect the shopper to. Persisted so a
     *  retried checkout returns the SAME session instead of creating a second
     *  one - the idempotency guard for payment creation. */
    paymentUrl: text("payment_url"),
    /** The last webhook the provider delivered for this order, verbatim, plus
     *  when it arrived and the raw status it carried. Kept so the admin panel
     *  can show exactly what the provider last told us - the single most
     *  useful fact when a payment looks stuck - without re-querying anything. */
    paymentLastIpn: jsonb("payment_last_ipn").$type<Record<string, unknown>>(),
    paymentLastIpnAt: timestamp("payment_last_ipn_at", { withTimezone: true }),
    paymentLastIpnStatus: text("payment_last_ipn_status"),
    /** When the PAID confirmation email was sent (claimed). NULL = not sent.
     *
     *  WHY A TIMESTAMP AND NOT A BOOLEAN. The receipt email is triggered by the
     *  IPN webhook, the pull reconciliation and the admin refresh - three paths
     *  for one payment - and the provider retries a webhook until it gets a
     *  2xx.
     *  "Exactly one email per order" therefore has to be enforced by an ATOMIC
     *  claim on this column (a single conditional UPDATE), not by an
     *  if-not-sent-then-send check that two concurrent handlers can both pass.
     *  NULL means unclaimed; a timestamp means the receipt exists. */
    confirmationEmailSentAt: timestamp("confirmation_email_sent_at", { withTimezone: true }),
    /** When the "this order is still unpaid" alert was sent to the store owner.
     *
     *  WHY A TIMESTAMP AND NOT A BOOLEAN. The alert is driven by a scheduled job
     *  that can run concurrently (two serverless instances, or a manual run
     *  overlapping the cron), and it must fire EXACTLY ONCE per order - an owner
     *  who gets the same nudge every hour will start ignoring it. "Exactly one"
     *  is therefore enforced by an ATOMIC claim on this column (a single
     *  conditional UPDATE), not by an if-not-sent check two runs can both pass.
     *  NULL means unclaimed; a timestamp means the owner has been told. */
    unpaidAlertSentAt: timestamp("unpaid_alert_sent_at", { withTimezone: true }),
    /** When the owner's Telegram order notification was DELIVERED (claimed).
     *
     *  WHY A TIMESTAMP AND NOT A BOOLEAN. The notification fires from the same
     *  three verified payment paths as the paid receipt (IPN webhook, pull
     *  reconciliation, post-return confirmation), the provider retries a webhook
     *  until it gets a 2xx, and two serverless instances can handle one payment
     *  concurrently. "Exactly one notification per order" therefore has to be
     *  enforced by an ATOMIC claim on this column (a single conditional UPDATE),
     *  not by an if-not-sent-then-send check two concurrent handlers can both
     *  pass. NULL means unclaimed; a timestamp means the owner has been told. */
    telegramNotifiedAt: timestamp("telegram_notified_at", { withTimezone: true }),
    /** Why the last Telegram attempt did not land, for the admin panel. Cleared
     *  as soon as one succeeds. Never carries the bot token - see
     *  services/telegram.ts, which redacts any URL/credential before returning
     *  an error string. */
    telegramNotifyError: text("telegram_notify_error"),
    /** Refund lifecycle. A card refund settles asynchronously (Bachs reports
     *  it through the `refund.*` webhooks), so it has its own status
     *  (`created` -> `refunded` / `failed`) rather than a boolean.
     *  `refund_ref` is the provider's refund id, kept so a retry can be
     *  recognised as the same refund instead of issuing a second one. */
    refundStatus: text("refund_status"),
    refundRef: text("refund_ref"),
    refundAmount: text("refund_amount"),
    refundCurrency: text("refund_currency"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    shippingAddress: jsonb("shipping_address").$type<AddressSnapshot>().notNull(),
    billingAddress: jsonb("billing_address").$type<AddressSnapshot>().notNull(),
    trackingNumber: text("tracking_number"),
    carrier: text("carrier"),
    /** Upstream supplier order id returned by createOrderV2, stored so the order
     *  can be reconciled against CJ and polled for tracking. NULL until the
     *  order has been forwarded (or when forwarding is not configured). */
    cjOrderId: text("cj_order_id"),
    /** When the order was successfully pushed to CJ. NULL = not forwarded. */
    cjForwardedAt: timestamp("cj_forwarded_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_email_idx").on(t.email),
    index("orders_created_idx").on(t.createdAt),
  ],
);

/** Line items. Product/variant FKs are `set null` so a deleted product never
 *  erases order history - the name/price are snapshotted on the row. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    slug: text("slug"),
    nameSnapshot: text("name_snapshot").notNull(),
    variantSnapshot: text("variant_snapshot"),
    priceCents: integer("price_cents").notNull(),
    qty: integer("qty").notNull(),
    imageUrl: text("image_url"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/** Order timeline - one row per status change / admin note. */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

/** Durable ledger of the payment webhooks the store has processed.
 *
 *  WHY A TABLE AND NOT A FLAG. The provider guarantees AT-LEAST-ONCE delivery:
 *  "the same event may arrive more than once", and it retries a delivery that
 *  did not get a 2xx. Every one of those repeats carries the SAME event id, so
 *  the id is the natural key - and inserting it with a conflict guard turns
 *  "have I seen this?" into one atomic statement that two concurrent
 *  serverless instances cannot both pass.
 *
 *  It is not the only guard, and deliberately so: the paid transition, the CJ
 *  forward, the receipt and the Telegram ping each carry their own durable
 *  claim. This table is the FIRST line of defence - it stops a repeated
 *  delivery from doing any work at all - not the only one. */
export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    /** The provider's event id (`evt_...`). The primary key IS the dedupe. */
    id: text("id").primaryKey(),
    /** The event type (`collection.succeeded`, `refund.paid`, ...). */
    type: text("type").notNull(),
    /** The order it was matched to, when it could be matched. */
    orderNumber: text("order_number"),
    /** When the event was received. */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_webhook_events_order_idx").on(t.orderNumber)],
);

/** Durable idempotency ledger for upstream supplier order forwarding.
 *
 *  WHY A TABLE AND NOT A FLAG ON `orders`. A payment webhook can be delivered
 *  more than once (the provider retries, a shopper refreshes the return URL, two
 *  serverless instances race). Forwarding an order to CJ twice would place TWO
 *  real supplier orders and ship the customer twice - a real, unrecoverable
 *  cost. A boolean on `orders` cannot stop that: two concurrent transactions
 *  both read `cj_forwarded_at IS NULL` before either writes, and both proceed.
 *
 *  This table makes the claim ATOMIC. `order_id` is the PRIMARY KEY, so the
 *  INSERT that claims the forward is the mutual-exclusion point: exactly one
 *  caller can insert the row, and every other caller gets a unique-violation
 *  and knows the order is already being (or has been) forwarded. The row is
 *  written BEFORE the CJ call and updated with the outcome after, so a crash
 *  mid-call leaves a `pending` claim that a retry can safely resume rather than
 *  a second order. */
export const cjOrderForwards = pgTable(
  "cj_order_forwards",
  {
    /** The store order this claim is for. PK = one forward per order, ever. */
    orderId: uuid("order_id")
      .primaryKey()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** 'pending' | 'forwarded' | 'failed'. `pending` is a claim in flight. */
    status: text("status").notNull().default("pending"),
    /** The CJ order id once CJ has accepted the order. */
    cjOrderId: text("cj_order_id"),
    /** The exact payload sent, kept for reconciliation and support. */
    requestPayload: jsonb("request_payload"),
    /** CJ's response body (or the error), for diagnosis. */
    responsePayload: jsonb("response_payload"),
    /** How many times forwarding has been attempted (retries with backoff). */
    attempts: integer("attempts").notNull().default(0),
    /** Last error message, when status = 'failed'. */
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cj_order_forwards_status_idx").on(t.status)],
);

/** Product reviews. `product_id` NULL = a store-wide testimonial.
 *
 *  A review is EARNED, not claimed: `user_id` + `order_id` record the completed
 *  purchase it came from, and `verified` is set from that order server-side.
 *  Nothing is public on arrival - `status` starts at 'pending' and only an admin
 *  moves it to 'approved'. `is_public` lets an admin hide an approved review
 *  without rejecting it. Every public read and every rating aggregate filters on
 *  `status = 'approved' AND is_public = true`, so a pending or hidden review can
 *  never leak into a product's rating or count. */
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body").notNull(),
    verified: boolean("verified").notNull().default(false),
    /** 'pending' | 'approved' | 'rejected' - only 'approved' is ever public. */
    status: text("status").notNull().default("pending"),
    /** Admin can hide an approved review without rejecting it. */
    isPublic: boolean("is_public").notNull().default(true),
    /** Buyer photos, stored as public `/app-storage/<key>` paths. Empty for the
     *  reviews that carry none, so the page renders no gallery rather than a
     *  blank one. */
    images: jsonb("images").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_product_idx").on(t.productId),
    index("reviews_status_idx").on(t.status),
  ],
);

/** Key/value store settings (brand, shipping rates, contact, payment provider). */
export const storeSettings = pgTable("store_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Newsletter signups from the storefront footer. Store-owned: public write,
 *  admin read. `email` is unique so a repeat signup is a no-op, not a dupe. */
export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    source: text("source").notNull().default("footer"),
    /** 'subscribed' | 'unsubscribed' - an admin can suppress an address without
     *  deleting the record, so the list keeps the history. */
    status: text("status").notNull().default("subscribed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("newsletter_created_idx").on(t.createdAt)],
);

/** One row per contact-form message submitted from the storefront. Store-owned:
 *  public write, admin read. Every field is sanitised and capped in the router
 *  BEFORE it reaches this table, so a stored row is always safe to render and
 *  can never carry a scripted payload. */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The signed-in account that sent it. The form requires a session, so this
     *  is set on every new row; it stays nullable only so rows written before
     *  the form was gated (or by a future non-account widget) remain valid. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /** One of the shared CONTACT_TOPICS, defaulting to "Something else". */
    topic: text("topic").notNull().default("Something else"),
    message: text("message").notNull(),
    /** Where the message came from (the contact page, a future widget, ...). */
    source: text("source").notNull().default("contact"),
    /** Admin triage state: 'new' | 'read' | 'replied'. A message arrives 'new'
     *  and only an admin moves it, so the inbox can show what still needs an
     *  answer. */
    status: text("status").notNull().default("new"),
    /** When an admin sent a reply to this message, and what it said. Nullable:
     *  an unanswered message is the normal state, and the panel shows the reply
     *  inline so the customer's answer is visible without a second lookup. */
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    replyBody: text("reply_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contact_created_idx").on(t.createdAt),
    index("contact_user_idx").on(t.userId),
  ],
);

/** One saved product per (user, product). The wishlist is tied to the account,
 *  so it follows the shopper across devices instead of living in one browser's
 *  localStorage. The unique index makes "save" idempotent - a double tap can
 *  never create two rows for the same product. */
export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("wishlist_user_product_idx").on(t.userId, t.productId),
    index("wishlist_user_idx").on(t.userId),
  ],
);

/** One row per transactional email attempt, so the admin order view can show
 *  whether the customer was actually notified (and why not, when it failed).
 *  A missing RESEND_API_KEY records `skipped` here instead of throwing. */
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
    orderNumber: text("order_number"),
    /** 'order_confirmation' | 'shipping_notification' */
    kind: text("kind").notNull(),
    toEmail: text("to_email").notNull(),
    fromEmail: text("from_email"),
    replyTo: text("reply_to"),
    subject: text("subject").notNull(),
    /** 'sent' | 'skipped' | 'failed' */
    status: text("status").notNull().default("queued"),
    error: text("error"),
    providerId: text("provider_id"),
    providerMessageId: text("provider_message_id"),
    /** What CAUSED this send, for the order-confirmation / payment-confirmation
     *  kinds: 'ipn' (the signed webhook), 'reconciliation' (the live status
     *  pull), 'post_return' (the shopper's return confirmation) or
     *  'admin_resend'. For the unpaid-order alert it is 'unpaid_alert'. NULL for
     *  kinds where the trigger is not meaningful (shipping, welcome, ...). This
     *  is what the admin email-history panel shows, so an operator can tell a
     *  webhook-driven receipt from a manual resend. */
    trigger: text("trigger"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_log_order_idx").on(t.orderId),
    index("email_log_created_idx").on(t.createdAt),
  ],
);

/** One row per Resend webhook event (delivery lifecycle), so the store can see
 *  what actually happened to a message AFTER Resend accepted it - delivered,
 *  bounced, complained, opened, clicked. `email_log` records the SEND attempt;
 *  this records the provider's follow-up. `provider_message_id` is the Resend
 *  message id (the same value `email_log.provider_message_id` holds), which is
 *  how the two are joined. `svix_id` is UNIQUE so a re-delivered webhook (Svix
 *  retries) is idempotent rather than a duplicate row. */
export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Svix message id (`svix-id` header) - unique, so retries are idempotent. */
    svixId: text("svix_id").notNull().unique(),
    /** Resend event type, e.g. 'email.delivered'. */
    type: text("type").notNull(),
    /** Resend message id (`data.email_id`), joins to email_log.provider_message_id. */
    providerMessageId: text("provider_message_id"),
    toEmail: text("to_email"),
    fromEmail: text("from_email"),
    subject: text("subject"),
    /** Bounce/complaint detail when the provider supplies one. */
    reason: text("reason"),
    /** The event's own timestamp (`data.created_at`), when present. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_events_message_idx").on(t.providerMessageId),
    index("email_events_type_idx").on(t.type),
    index("email_events_received_idx").on(t.receivedAt),
  ],
);

/** Single-use, expiring email-verification tokens. The token is stored HASHED
 *  (SHA-256) so a leaked row is not a working link; only the raw token in the
 *  email can be redeemed. `consumed_at` makes redemption single-use. */
export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_verifications_user_idx").on(t.userId),
    index("email_verifications_expires_idx").on(t.expiresAt),
  ],
);

/** One row per throttled key (a scoped string such as `login_account:<email>`
 *  or `login_ip:<addr>`). DB-backed on purpose: the in-memory limiter in
 *  `_core/rate-limit.ts` keeps its counters per serverless instance, so a burst
 *  spread across cold instances is only seen in slices. A lockout that must
 *  survive across instances has to live in the database.
 *
 *  `count` is the number of failures inside the current window; once it reaches
 *  the rule's max, `locked_until` is set and the key is refused until it passes.
 *  A successful sign-in deletes the row, so a legitimate user is never locked
 *  out permanently. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    count: integer("count").notNull().default(0),
    firstAt: timestamp("first_at", { withTimezone: true }).notNull().defaultNow(),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [index("login_attempts_locked_idx").on(t.lockedUntil)],
);

/** A signed-in shopper's SAVED CART. Owner: exactly one row per user.
 *
 *  WHY THIS EXISTS. The basket used to live ONLY in `localStorage`, so it was
 *  invisible to the server: nothing could authorise a read or a write, an
 *  unauthenticated visitor's browser still held (and rendered) the previous
 *  account's items after a sign-out, and the basket did not survive a device
 *  change. Persisting it here makes the cart an OWNED resource, so every read
 *  and write can be checked against the session (see server/routers.ts `cart`).
 *
 *  `user_id` is UNIQUE, so `cart.ensure()` is an idempotent upsert and a user
 *  can never accumulate more than one cart. Deleting the account drops the cart
 *  (cascade) - a cart has no meaning without its owner. */
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // No explicit index on user_id: the UNIQUE constraint already creates one.
);

/** One line in a saved cart. `(cart_id, product_id, variant_id)` is UNIQUE with
 *  variant_id NULLS NOT DISTINCT (migration 0032), so the base product and each
 *  variant is exactly one line and `add` can merge by upsert instead of
 *  read-modify-write. `variant_id` is SET NULL rather than CASCADE: if a variant
 *  is retired the line survives, pointing at the base product. */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    qty: integer("qty").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("cart_items_line_idx").on(t.cartId, t.productId, t.variantId),
    index("cart_items_cart_idx").on(t.cartId),
  ],
);

/** Server-side REVOCATION record for one signed session.
 *
 *  A JWT is stateless: `logout` could only expire the cookie in the browser, so
 *  a copy of the token captured before sign-out stayed valid for its full 30-day
 *  life. Storing the session's own id (the `jti` claim) lets sign-out be a real
 *  server-side revocation - `requireSession` refuses a token whose row is gone.
 *  `expires_at` mirrors the token's exp so a cleanup can drop dead rows; nothing
 *  depends on the sweep to stay correct. */
export const authSessions = pgTable(
  "auth_sessions",
  {
    /** The JWT `jti` claim. This is the primary key: one row per issued token. */
    id: uuid("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

/** The durable Telegram retry queue.
 *
 *  WHY A TABLE AND NOT A LONGER IN-REQUEST RETRY. `services/order-notify.ts`
 *  retries a failed send a few times INSIDE the serverless invocation that
 *  observed the payment, because the shopper is waiting on that same request.
 *  A Telegram outage that outlasts that window would otherwise drop a real
 *  sale's notification. So a send Telegram did not accept is written here and
 *  picked up later by the sweep in `services/telegram-outbox.ts`.
 *
 *  THIS TABLE IS NOT THE EXACTLY-ONCE GUARD. `orders.telegram_notified_at` is
 *  (see `claimTelegramNotification`). A row here is only a "try again" reminder,
 *  and the sweep re-enters through `notifyPaidOrderOnce`, which re-wins that same
 *  atomic claim. Losing or duplicating a reminder row is therefore harmless -
 *  which is exactly the property a retry queue should have.
 *
 *  ONE ROW PER ORDER (`uniqueIndex` on `order_id`) makes the enqueue naturally
 *  idempotent: a retried webhook, an admin re-send and the daily reconciliation
 *  job can all raise the same reminder without stacking attempts.
 *
 *    status           'pending' -> 'sent' | 'failed'. 'failed' is PERMANENT (the
 *                     bounded attempt budget was exhausted) and carries
 *                     `last_error`, so an operator can see the give-up reason.
 *    attempts         sweep attempts made. Bounded; see OUTBOX_MAX_ATTEMPTS.
 *    next_attempt_at  the earliest time the sweep may claim the row. The claim
 *                     pushes it forward, which is also the lease that stops two
 *                     concurrent sweeps working one reminder. */
export const telegramOutbox = pgTable(
  "telegram_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Denormalised for the log line and the admin view: no join needed to say
     *  WHICH order a reminder is about. */
    orderNumber: text("order_number").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("telegram_outbox_order_idx").on(t.orderId),
    index("telegram_outbox_due_idx").on(t.status, t.nextAttemptAt),
  ],
);

/** A generic "this job already ran for this period" claim.
 *
 *  WHY IT EXISTS. Some scheduled work is idempotent and needs no guard (re-queueing
 *  a Telegram reminder is an upsert). A SUMMARY MESSAGE to the owner is not: if the
 *  cron fires twice in a day - a manual run overlapping the schedule, or a retried
 *  invocation - a second identical alert is noise the owner learns to ignore.
 *
 *  A unique `(job, period)` row is the mutual-exclusion point: the INSERT that wins
 *  is the one run allowed to send. `period` is a caller-chosen bucket (UTC day for
 *  the Telegram reconciliation), so the same table serves any daily/weekly job.
 *
 *  The insert is ON CONFLICT DO NOTHING, so a losing run is a normal, silent `false`
 *  rather than an error. */
export const jobRunClaims = pgTable(
  "job_run_claims",
  {
    job: text("job").notNull(),
    period: text("period").notNull(),
    /** Optional context for the winning run (counts, ids), for the admin/log. */
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.job, t.period] })],
);

export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderEvent = typeof orderEvents.$inferSelect;
export type PaymentWebhookEvent = typeof paymentWebhookEvents.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type WishlistItem = typeof wishlistItems.$inferSelect;
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type EmailLog = typeof emailLog.$inferSelect;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type TelegramOutboxRow = typeof telegramOutbox.$inferSelect;
export type JobRunClaim = typeof jobRunClaims.$inferSelect;
