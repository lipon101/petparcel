// Client-side view types. These mirror what the API returns over the wire.
// Timestamps are typed `Date | string` because tRPC/superjson hands the browser
// ISO strings while the server type says Date - accepting both keeps the casts
// honest without reaching into drizzle from the browser bundle.
export interface StoreVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  inventoryQty: number;
  sortOrder: number;
  active: boolean;
  /** The variant's OWN photograph (R2), when the supplier provides one. A colour
   *  press shows this so the shopper sees the colour they picked. */
  imageUrl?: string | null;
}

export interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  priceCents: number;
  compareAtCents: number | null;
  images: string[];
  /** The gallery, images AND videos (`images` is the image-only projection).
   *  Optional so a product written before video existed still type-checks. */
  media?: { url: string; kind: "image" | "video" }[];
  tags: string[];
  /** Real attributes for the Product Details tab. Optional so the shape stays
   *  valid for a product an admin created without filling them in. */
  specs?: StoreProductSpecs;
  /** The SUPPLIER'S OWN option dimensions for this product, as stored on its row
   *  ("Colour", "Size", "Pack", "Set"). Optional: a product added by hand that
   *  the supplier fetch has not covered has none, and the buy box then infers the
   *  headings from the option values alone. */
  optionDimensions?: { token: string; kind: string; label: string }[];
  active: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  variants: StoreVariant[];
  /** Real aggregate from the reviews table - null/0 when a product has none yet. */
  rating?: number | null;
  reviewCount?: number;
}

/** The measurable attributes shown in the Product Details tab. Mirrors
 *  shared/product-specs.ts, which both sides of the store read. */
export interface StoreProductSpecs {
  materials?: string;
  dimensions?: string;
  weight?: string;
  care?: string;
}

/** One real purchase of a product, for the product page's social proof. First
 *  name and city only - the store never publishes more about a customer. */
export interface StoreRecentPurchase {
  orderId: string;
  firstName: string;
  city: string;
  purchasedAt: Date | string;
}

export interface StoreAddressSnapshot {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  userId: string | null;
  email: string;
  status: string;
  paymentStatus: string;
  paymentProvider: string | null;
  paymentRef: string | null;
  /** When the PAID confirmation email was sent, or null when it has not been.
   *  The confirmation email is sent ONLY after the payment is verified as
   *  settled, so the order page reads this to state the truth: "confirmation
   *  email sent" is shown only when it is non-null. It is the persisted send
   *  record, so it survives a refresh and comes from the right instance. */
  confirmationEmailSentAt?: string | null;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  shippingAddress: StoreAddressSnapshot;
  billingAddress: StoreAddressSnapshot;
  trackingNumber: string | null;
  carrier: string | null;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface StoreOrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  slug: string | null;
  nameSnapshot: string;
  variantSnapshot: string | null;
  priceCents: number;
  qty: number;
  imageUrl: string | null;
}

export interface StoreOrderEvent {
  id: string;
  orderId: string;
  status: string;
  note: string | null;
  createdAt: Date | string;
}

/** One transactional-email attempt, as recorded in `email_log` and shown on the
 *  admin order view. `skipped` is the pre-setup state (no RESEND_API_KEY),
 *  and `error` explains a `failed` attempt. */
export interface StoreEmailLog {
  id: string;
  orderId: string | null;
  orderNumber: string | null;
  kind: string;
  toEmail: string;
  fromEmail: string | null;
  replyTo: string | null;
  subject: string;
  status: string;
  error: string | null;
  providerId: string | null;
  providerMessageId: string | null;
  createdAt: Date | string;
}

export interface StoreOrderDetail {
  order: StoreOrder;
  items: StoreOrderItem[];
  events: StoreOrderEvent[];
  /** Present on the ADMIN order query; omitted from the customer-facing ones. */
  emails?: StoreEmailLog[];
}

export interface StoreReview {
  id: string;
  productId: string | null;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  /** Buyer photos as public `/app-storage/<key>` paths. Absent/empty for a
   *  review that carries none, so the page renders no gallery. */
  images?: string[];
  /** 'pending' | 'approved' | 'rejected'. Only approved + public reviews are
   *  ever returned by the public reads, so this is present mainly for the admin
   *  list. Optional so the bundled static fallback (which has no reviews) fits. */
  status?: string;
  isPublic?: boolean;
  createdAt: Date | string;
}

export interface StoreAddress {
  id: string;
  label: string | null;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: Date | string;
}
