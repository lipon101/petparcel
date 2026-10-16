// Admin panel view types.
//
// These are the shapes the admin UI renders. They are deliberately DECOUPLED
// from the server's drizzle row types: the panel talks to an `AdminDataSource`
// (see data-source.ts), and today that source is the in-memory demo dataset.
// When the panel is pointed at the real database the live source maps the
// existing `admin.*` tRPC procedures onto these same shapes, so no page has to
// change. Keeping the contract here - not in the server - is what makes the
// swap a one-line change.

export type AdminReviewStatus = "pending" | "approved" | "rejected";
export type AdminMessageStatus = "new" | "read" | "replied";
export type AdminSubscriberStatus = "subscribed" | "unsubscribed";

export interface AdminVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  inventoryQty: number;
  active: boolean;
  /** The upstream supplier variant id (VID) for this option, or null when it is
   *  not mapped. Editable so an operator can correct a mapping without a
   *  deploy; a variant with no VID is simply not auto-forwardable. */
  cjVid: string | null;
}

import type { ProductMedia } from "@shared/media";

/** Real, checkable attributes for the Product Details tab. Mirrors
 *  shared/product-specs.ts. Every key is optional - an attribute we do not know
 *  is left out so the tab shows one row fewer rather than a placeholder. */
export interface AdminProductSpecs {
  materials?: string;
  dimensions?: string;
  weight?: string;
  care?: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  priceCents: number;
  compareAtCents: number | null;
  images: string[];
  /** The gallery, images AND videos. `images` is the image-only projection and
   *  is derived from this when it is sent. */
  media: ProductMedia[];
  /** Real attributes for the Product Details tab. Optional: a product created
   *  without them simply shows fewer rows until they are filled in. */
  specs?: AdminProductSpecs;
  tags: string[];
  active: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  variants: AdminVariant[];
  rating: number | null;
  reviewCount: number;
}

export interface AdminVariantInput {
  name: string;
  sku: string;
  priceCents: number;
  inventoryQty: number;
  active: boolean;
  /** CJ variant id. Blank/absent clears the mapping. */
  cjVid?: string | null;
}

/** The writable fields of a product. `slug` is optional - the source derives it
 *  from the name when it is blank, exactly like the server does. */
export interface AdminProductInput {
  name: string;
  slug?: string;
  description: string;
  category: string;
  priceCents: number;
  compareAtCents: number | null;
  images: string[];
  /** Optional: when sent it is the source of truth for the gallery and `images`
   *  is derived from it. A caller that only knows images still works. */
  media?: ProductMedia[];
  /** Real attributes for the Product Details tab. Optional: omitted means "leave
   *  the stored specs untouched" on an update. */
  specs?: AdminProductSpecs;
  tags: string[];
  active: boolean;
  featured: boolean;
  sortOrder: number;
}

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** ROLL-UP for a top-level aisle: its own products plus its subcategories'. */
  productCount: number;
  /** The parent aisle's id for a subcategory, null for a top-level aisle. */
  parentId: string | null;
  featured: boolean;
  sortOrder: number;
  /** Subcategories filed under this aisle (empty for a subcategory). */
  children: AdminCategoryChild[];
}

/** A subcategory within an `AdminCategory`. */
export interface AdminCategoryChild {
  id: string;
  name: string;
  slug: string;
  description: string;
  productCount: number;
  featured: boolean;
  sortOrder: number;
}

export interface AdminCategoryInput {
  name: string;
  slug?: string;
  description: string;
  /** The parent aisle's id when creating/editing a SUBCATEGORY; null (or absent)
   *  for a top-level aisle. Passing null promotes a subcategory to top level. */
  parentId?: string | null;
  featured: boolean;
  sortOrder: number;
}

export interface AdminOrderItem {
  id: string;
  name: string;
  variant: string | null;
  priceCents: number;
  qty: number;
  image: string | null;
}

export interface AdminOrderEvent {
  id: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  email: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  items: AdminOrderItem[];
  events: AdminOrderEvent[];
  trackingNumber: string | null;
  carrier: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The raw crypto-payment picture for ONE order - what NOWPayments actually
 *  said, plus the last webhook we received. Written for an operator, so unlike
 *  the shopper's view it carries the invoice id and the raw IPN body. */
export interface AdminRawPaymentData {
  provider: string;
  configured: boolean;
  paymentStatus: string;
  storedStatusDetail: string | null;
  liveStatus: string | null;
  liveLabel: string | null;
  paymentId: string | null;
  invoiceId: string | null;
  paymentUrl: string | null;
  payAddress: string | null;
  payCurrency: string | null;
  payAmount: number | null;
  actuallyPaid: number | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  outcomeAmount: number | null;
  outcomeCurrency: string | null;
  lastIpn: Record<string, unknown> | null;
  lastIpnAt: string | null;
  lastIpnStatus: string | null;
  refund: {
    status: string | null;
    label: string | null;
    ref: string | null;
    amount: string | null;
    currency: string | null;
    refundedAt: string | null;
  };
  error: string | null;
}

/** Result of a refund attempt, as the panel reports it. */
export interface AdminRefundResult {
  ok: boolean;
  refundStatus: string;
  label: string;
  refundId: string | null;
  amount: string | null;
  currency: string | null;
  reason?: string;
}

/** One send attempt for an order, from `email_log`. */
export interface AdminEmailLogEntry {
  id: string;
  kind: string;
  /** What caused the send: 'ipn' | 'reconciliation' | 'post_return' |
   *  'admin_resend' | 'unpaid_alert', or null where not meaningful. */
  trigger: string | null;
  to: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
}

/** The email history for ONE order: every send attempt plus the two persisted
 *  one-shot claims (the paid receipt and the unpaid alert). */
export interface AdminOrderEmailHistory {
  confirmationEmailSentAt: string | null;
  unpaidAlertSentAt: string | null;
  emails: AdminEmailLogEntry[];
}

/** Result of a manual "resend confirmation email" action. */
export interface AdminResendResult {
  outcome: { status: string; reason?: string; sentAt?: string };
  history: AdminOrderEmailHistory;
}

/** One row of the durable Telegram retry queue, as the panel shows it. */
export interface AdminTelegramOutboxEntry {
  id: string;
  status: string;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  lastAttemptAt: string | null;
  createdAt: string;
}

/** The Telegram notification picture for ONE order.
 *
 *  `notifiedAt` is the authoritative one-shot claim: non-null means the owner was
 *  told, full stop. When it is null the `outbox` rows explain what happens next -
 *  a `pending` row means a sweep will retry, a `failed` row means the attempt
 *  budget ran out and the error is in `notifyError`/`lastError`. */
export interface AdminOrderTelegramStatus {
  notifiedAt: string | null;
  notifyError: string | null;
  outbox: AdminTelegramOutboxEntry[];
}

export interface AdminCustomer {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  orderCount: number;
  spendCents: number;
  createdAt: string;
  lastOrderAt: string | null;
}

/** A registered account. Every account is a "user"; only one that has PAID for
 *  an order is also a "customer". The two are shown separately so a signup is
 *  never reported as a sale. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  orderCount: number;
  emailVerified: boolean;
  createdAt: string;
}

export interface AdminReview {
  id: string;
  productId: string | null;
  productName: string | null;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  status: AdminReviewStatus;
  isPublic: boolean;
  verified: boolean;
  createdAt: string;
}

export interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  status: AdminMessageStatus;
  /** When an admin replied, and what was sent. Null until answered. */
  repliedAt: string | null;
  replyBody: string | null;
  createdAt: string;
}

/** The writable fields of a contact message (admin CRUD). */
export interface AdminContactMessageInput {
  name: string;
  email: string;
  topic: string;
  message: string;
}

export interface AdminSubscriber {
  id: string;
  email: string;
  source: string;
  status: AdminSubscriberStatus;
  createdAt: string;
}

/** How a paged admin list is asked for. Both numbers are optional - the server
 *  clamps whatever it is given - and `search` is matched in SQL across the whole
 *  list rather than in the browser across the page that happens to be loaded. */
export interface AdminPageParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

/** One page of subscribers, plus the totals needed to render the controls.
 *
 *  `total` counts ALL matching rows, not `rows`, so the panel can print
 *  "showing 26-50 of 312" without a second request. `page` is the page the
 *  server ACTUALLY served, which can differ from the one requested when the
 *  requested page no longer exists (the last rows on the final page were just
 *  deleted) - the server answers with the last real page instead of an empty
 *  one, and the caller adopts the page it was given. */
export interface AdminSubscriberPage {
  rows: AdminSubscriber[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AdminSettings {
  brandName: string;
  tagline: string;
  announcement: string;
  contactEmail: string;
  contactPhone: string;
  supportHours: string;
  businessAddress: string;
  currency: string;
  shippingFlatCents: number;
  freeShippingThresholdCents: number;
  taxRateBps: number;
  returnWindowDays: number;
  /** At or below this many units a variant is flagged low on stock. */
  lowStockThreshold: number;
  paymentProvider: string;
  emailFromName: string;
  emailFromAddress: string;
}

export interface AdminLowStockRow {
  id: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  inventoryQty: number;
}

export interface AdminTopProduct {
  name: string;
  units: number;
  revenueCents: number;
}

export interface AdminRevenuePoint {
  date: string;
  cents: number;
}

export interface AdminKpis {
  revenueCents: number;
  /** Paid revenue over the last 30 days, and the 30 days before that - the two
   *  real totals the hero compares. */
  revenue30dCents: number;
  revenuePrev30dCents: number;
  orderCount: number;
  productCount: number;
  customerCount: number;
  userCount: number;
  lowStockCount: number;
  pendingReviews: number;
  newMessages: number;
  subscriberCount: number;
  averageOrderCents: number;
  revenueByDay: AdminRevenuePoint[];
  topProducts: AdminTopProduct[];
  lowStock: AdminLowStockRow[];
  recentOrders: AdminOrder[];
}

/** One resolved home page promo card, as the admin panel previews it. */
export interface AdminPromoSlot {
  kind: "new_arrivals" | "best_sellers";
  product: AdminProduct;
  copy: { eyebrow: string; title: string; body: string; cta: string };
  /** `selected` = the owner's explicit pick; `fallback` = the pick was missing,
   *  deleted or unpublished, so the slot filled itself with the best available
   *  product instead of breaking. */
  source: "selected" | "fallback";
}

/** The home page promo cards' full admin state: the stored picks plus the
 *  resolved slot for each card (null when there is nothing to feature). */
export interface AdminPromoState {
  newArrivalsProductId: string;
  bestSellersProductId: string;
  newArrivals: AdminPromoSlot | null;
  bestSellers: AdminPromoSlot | null;
}

/** The home page "Our featured picks" rail's admin state: the owner's ORDERED
 *  product ids plus the resolved products, so the panel can preview the rail. */
export interface AdminFeaturedPicksState {
  productIds: string[];
  products: AdminProduct[];
}

/**
 * The single seam between the admin UI and its data. Every page reads and writes
 * through this interface, so pointing the panel at the real database is a matter
 * of supplying a different implementation - nothing in the pages changes.
 */
export interface AdminDataSource {
  readonly kind: "live";

  getKpis(): Promise<AdminKpis>;

  /** The home page promo cards' admin surface: the current picks plus the
   *  RESOLVED slot for each card (the real product and its derived copy), so the
   *  panel can preview exactly what the storefront will render. */
  getPromo(): Promise<AdminPromoState>;
  /** Save the picks. An empty string clears a pick, which makes the storefront
   *  fall back to the best available product for that slot. */
  setPromo(input: { newArrivalsProductId?: string; bestSellersProductId?: string }): Promise<AdminPromoState>;

  /** The home page "Our featured picks" rail: the owner's ordered picks plus the
   *  resolved products. */
  getFeaturedPicks(): Promise<AdminFeaturedPicksState>;
  /** Replace the ordered picks. An empty list clears them, so the rail falls
   *  back to the products flagged `featured`, then the newest. */
  setFeaturedPicks(productIds: string[]): Promise<AdminFeaturedPicksState>;

  listProducts(): Promise<AdminProduct[]>;
  getProduct(id: string): Promise<AdminProduct | null>;
  createProduct(input: AdminProductInput): Promise<AdminProduct>;
  updateProduct(id: string, input: AdminProductInput): Promise<AdminProduct>;
  /** Fetch a third-party asset once and store our own copy, returning the
   *  same-origin URL. Throws with a human message when the source is unusable. */
  ingestMedia(sourceUrl: string): Promise<ProductMedia>;
  /** Delete a product. A product with order history is ARCHIVED (removed from
   *  every surface but kept so its orders still reference it); one with none is
   *  hard-deleted. The result says which happened. */
  deleteProduct(id: string): Promise<{ archived: boolean }>;

  createVariant(productId: string, input: AdminVariantInput): Promise<AdminVariant>;
  updateVariant(id: string, input: AdminVariantInput): Promise<AdminVariant>;
  deleteVariant(id: string): Promise<void>;
  /** Set ONE variant's stock quantity - the inline editor's write. */
  setVariantStock(id: string, qty: number): Promise<AdminVariant>;

  listCategories(): Promise<AdminCategory[]>;
  createCategory(input: AdminCategoryInput): Promise<AdminCategory>;
  updateCategory(id: string, input: AdminCategoryInput): Promise<AdminCategory>;
  deleteCategory(id: string): Promise<void>;
  /** Persist a dragged order for ONE sibling list (the top-level aisles when
   *  `parentId` is null, or one aisle's subcategories). `ids` must be the
   *  COMPLETE list in its new sequence. */
  reorderCategories(parentId: string | null, ids: string[]): Promise<void>;

  listOrders(): Promise<AdminOrder[]>;
  getOrder(id: string): Promise<AdminOrder | null>;
  setOrderStatus(id: string, status: string, note?: string): Promise<AdminOrder>;
  setOrderPayment(id: string, paymentStatus: string): Promise<AdminOrder>;
  setOrderTracking(
    id: string,
    trackingNumber: string | null,
    carrier: string | null,
  ): Promise<AdminOrder>;
  /** Permanently remove an order and its dependent rows. */
  deleteOrder(id: string): Promise<void>;

  /** The raw NOWPayments picture for one order: stored handles, live status and
   *  the last IPN we received. */
  getRawPayment(id: string): Promise<AdminRawPaymentData>;
  /** Re-query NOWPayments live and reconcile the order (manual "refresh"). */
  refreshPaymentStatus(id: string): Promise<AdminRawPaymentData>;
  /** Refund a paid order through NOWPayments. `confirm` must be true - this is
   *  the only money-moving action in the panel. */
  refundPayment(
    id: string,
    opts: { confirm: true; amount?: number; reason?: string },
  ): Promise<AdminRefundResult>;

  /** The email history for one order: every send attempt plus the two persisted
   *  one-shot claims (the paid receipt and the unpaid alert). */
  getEmailHistory(id: string): Promise<AdminOrderEmailHistory>;
  /** The Telegram notification picture for one order: the one-shot claim, the
   *  last error, and the durable retry queue. */
  getTelegramStatus(id: string): Promise<AdminOrderTelegramStatus>;
  /** Resend the paid receipt. PAID ORDERS ONLY - the server refuses an unpaid
   *  order, and the send goes through the same one-shot claim, so it can never
   *  duplicate a receipt that has already gone. */
  resendConfirmationEmail(id: string): Promise<AdminResendResult>;

  listCustomers(): Promise<AdminCustomer[]>;
  /** Every registered account (the "Users" figure) - not only paid buyers. */
  listUsers(): Promise<AdminUser[]>;
  /** Permanently delete a user account and its credentials. Refused by the
   *  server for an admin/owner account, which can never be removed. */
  deleteUser(id: string): Promise<void>;

  listReviews(): Promise<AdminReview[]>;
  setReviewStatus(id: string, status: AdminReviewStatus): Promise<AdminReview>;
  setReviewVisibility(id: string, isPublic: boolean): Promise<AdminReview>;
  deleteReview(id: string): Promise<void>;

  listMessages(): Promise<AdminContactMessage[]>;
  setMessageStatus(id: string, status: AdminMessageStatus): Promise<AdminContactMessage>;
  /** Record a message the owner took elsewhere (a phone enquiry), so the inbox
   *  is a full CRUD surface rather than a read-only feed. */
  createMessage(input: AdminContactMessageInput): Promise<AdminContactMessage>;
  /** Edit a message's fields (and status). */
  updateMessage(
    id: string,
    input: Partial<AdminContactMessageInput> & { status?: AdminMessageStatus },
  ): Promise<AdminContactMessage>;
  /** Permanently remove a message. */
  deleteMessage(id: string): Promise<void>;
  /** Reply to the shopper: sends them an email AND records the reply against the
   *  row. `emailStatus` says whether the send actually went out. */
  replyToMessage(
    id: string,
    replyBody: string,
  ): Promise<{ message: AdminContactMessage; emailStatus: string; emailReason: string | null }>;

  listSubscribers(params?: AdminPageParams): Promise<AdminSubscriberPage>;
  setSubscriberStatus(id: string, status: AdminSubscriberStatus): Promise<AdminSubscriber>;
  /** Permanently remove a subscriber from the list. Distinct from
   *  `setSubscriberStatus`, which suppresses an address but keeps its record. */
  deleteSubscriber(id: string): Promise<void>;

  getSettings(): Promise<AdminSettings>;
  updateSettings(input: Partial<AdminSettings>): Promise<AdminSettings>;
}
