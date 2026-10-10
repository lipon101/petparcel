// Client-side view types. These mirror what the API returns over the wire.
// Timestamps are typed `Date | string` because tRPC/superjson hands the browser
// ISO strings while the server type says Date — accepting both keeps the casts
// honest without reaching into drizzle from the browser bundle.
export interface StoreVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  inventoryQty: number;
  sortOrder: number;
  active: boolean;
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
  tags: string[];
  active: boolean;
  featured: boolean;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  variants: StoreVariant[];
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
