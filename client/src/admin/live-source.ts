// Live implementation of AdminDataSource - the admin panel's ONE and ONLY data
// source, backed by the real database through the `admin.*` tRPC procedures.
//
// Every read and write the panel makes goes through here and lands in Postgres.
// Nothing is mocked, cached or seeded on the client: what the panel shows is the
// production database, and a mutation is visible on the storefront immediately
// (the storefront reads the same tables through `catalog.*`).
//
// SECURITY: every procedure this calls is an `adminProcedure`, so the SERVER
// enforces an authenticated session with the admin role on every call - the
// client is never trusted, even though the panel UI is currently ungated.
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { ADMIN_PAGE_SIZE_DEFAULT } from "@shared/admin-paging";
import { normalizeMedia, type ProductMedia } from "@shared/media";
import type { AppRouter } from "../../../server/routers";
import type {
  AdminCategory,
  AdminCategoryChild,
  AdminCategoryInput,
  AdminContactMessage,
  AdminCustomer,
  AdminDataSource,
  AdminEmailLogEntry,
  AdminFeaturedPicksState,
  AdminKpis,
  AdminMessageStatus,
  AdminOrder,
  AdminOrderEmailHistory,
  AdminOrderTelegramStatus,
  AdminPageParams,
  AdminProduct,
  AdminProductInput,
  AdminProductSpecs,
  AdminPromoSlot,
  AdminPromoState,
  AdminRawPaymentData,
  AdminRefundResult,
  AdminResendResult,
  AdminReview,
  AdminReviewStatus,
  AdminSettings,
  AdminSubscriber,
  AdminSubscriberPage,
  AdminSubscriberStatus,
  AdminTelegramOutboxEntry,
  AdminUser,
  AdminVariant,
  AdminVariantInput,
} from "./types";

/** A vanilla (non-React) tRPC client. The panel's pages use the React hooks for
 *  the storefront, but the data source is a plain module, so it needs its own
 *  caller. `AppRouter` is a type-only import, so no server code ships. */
function makeCaller() {
  return createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/trpc", transformer: superjson })],
  });
}

type Caller = ReturnType<typeof makeCaller>;
type Row = Record<string, unknown>;

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const bool = (v: unknown): boolean => v === true || v === "true";
const nullableStr = (v: unknown): string | null => (v == null || v === "" ? null : String(v));

/** A blank SKU is generated here (the server requires a non-empty one) so the
 *  editor's "a blank SKU is generated for you" promise actually holds. */
function ensureSku(name: string, sku: string): string {
  const trimmed = sku.trim();
  if (trimmed) return trimmed;
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12) || "VAR";
  return `${base}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function toVariantPayload(input: AdminVariantInput) {
  return {
    name: input.name.trim() || "Default",
    sku: ensureSku(input.name, input.sku),
    priceCents: Math.max(0, Math.round(input.priceCents)),
    inventoryQty: Math.max(0, Math.round(input.inventoryQty)),
    active: input.active,
    cjVid: input.cjVid && input.cjVid.trim() ? input.cjVid.trim() : null,
  };
}

export function createLiveSource(caller: Caller = makeCaller()): AdminDataSource {
  return {
    kind: "live",

    async getKpis(): Promise<AdminKpis> {
      const stats = (await caller.admin.stats.query()) as Row;
      const lowStock = asArray<Row>(stats.lowStock).map((r) => ({
        id: str(r.id),
        productId: str(r.productId),
        productName: str(r.productName),
        variantName: str(r.name),
        sku: str(r.sku),
        inventoryQty: num(r.inventoryQty),
      }));
      const recentOrders = asArray<Row>(stats.recentOrders).map(mapOrder);
      const topProducts = asArray<Row>(stats.topProducts).map((p) => ({
        name: str(p.name),
        units: num(p.units),
        revenueCents: num(p.revenue),
      }));
      return {
        revenueCents: num(stats.revenueCents),
        revenue30dCents: num(stats.revenue30dCents),
        revenuePrev30dCents: num(stats.revenuePrev30dCents),
        orderCount: num(stats.orderCount),
        productCount: num(stats.productCount),
        customerCount: num(stats.customerCount),
        userCount: num(stats.userCount),
        lowStockCount: num(stats.lowStockCount) || lowStock.length,
        pendingReviews: num(stats.pendingReviews),
        newMessages: num(stats.newMessages),
        subscriberCount: num(stats.subscriberCount),
        averageOrderCents: num(stats.averageOrderCents),
        revenueByDay: asArray<Row>(stats.revenueByDay).map((d) => ({
          date: str(d.date),
          cents: num(d.cents),
        })),
        topProducts,
        lowStock,
        recentOrders,
      };
    },

    // ── products ──────────────────────────────────────────────────────────
    // ── home page promo cards ───────────────────────────────────────────────
    async getPromo(): Promise<AdminPromoState> {
      const res = (await caller.admin.promo.query()) as Row;
      return mapPromoState(res);
    },

    async setPromo(input) {
      const res = (await caller.admin.setPromo.mutate(input)) as Row;
      return mapPromoState(res);
    },

    // ── home page featured picks ────────────────────────────────────────────
    async getFeaturedPicks(): Promise<AdminFeaturedPicksState> {
      const res = (await caller.admin.featuredPicks.query()) as Row;
      return mapFeaturedPicks(res);
    },

    async setFeaturedPicks(productIds: string[]): Promise<AdminFeaturedPicksState> {
      const res = (await caller.admin.setFeaturedPicks.mutate({ productIds })) as Row;
      return mapFeaturedPicks(res);
    },

    async listProducts(): Promise<AdminProduct[]> {
      const rows = await caller.admin.products.query({});
      return asArray<Row>(rows).map(mapProduct);
    },

    async getProduct(id) {
      const row = (await caller.admin.product.query({ id })) as Row | null;
      return row ? mapProduct(row) : null;
    },

    async createProduct(input: AdminProductInput) {
      const row = (await caller.admin.createProduct.mutate(toProductPayload(input))) as Row;
      return mapProduct(row);
    },

    async updateProduct(id, input: AdminProductInput) {
      const row = (await caller.admin.updateProduct.mutate({
        id,
        ...toProductPayload(input),
      })) as Row;
      return mapProduct(row);
    },

    async deleteProduct(id) {
      const res = (await caller.admin.deleteProduct.mutate({ id })) as { archived?: boolean };
      return { archived: res?.archived === true };
    },

    async ingestMedia(sourceUrl: string): Promise<ProductMedia> {
      const res = (await caller.admin.ingestMedia.mutate({ sourceUrl })) as { url: string; kind: "image" | "video" };
      return { url: res.url, kind: res.kind };
    },

    // ── variants ──────────────────────────────────────────────────────────
    async createVariant(productId, input: AdminVariantInput): Promise<AdminVariant> {
      const row = (await caller.admin.createVariant.mutate({
        productId,
        ...toVariantPayload(input),
      })) as Row;
      return mapVariant(row);
    },

    async updateVariant(id, input: AdminVariantInput): Promise<AdminVariant> {
      const row = (await caller.admin.updateVariant.mutate({
        id,
        ...toVariantPayload(input),
      })) as Row;
      return mapVariant(row);
    },

    async deleteVariant(id) {
      await caller.admin.deleteVariant.mutate({ id });
    },

    async setVariantStock(id, qty): Promise<AdminVariant> {
      const row = (await caller.admin.setInventory.mutate({ id, qty })) as Row;
      return mapVariant(row);
    },

    // ── categories ────────────────────────────────────────────────────────
    async listCategories(): Promise<AdminCategory[]> {
      const rows = await caller.admin.categories.query();
      return asArray<Row>(rows).map(mapCategory);
    },

    async createCategory(input: AdminCategoryInput) {
      const row = (await caller.admin.createCategory.mutate(toCategoryPayload(input))) as Row;
      return mapCategory(row);
    },

    async updateCategory(id, input: AdminCategoryInput) {
      const row = (await caller.admin.updateCategory.mutate({
        id,
        ...toCategoryPayload(input),
      })) as Row;
      return mapCategory(row);
    },

    async deleteCategory(id) {
      await caller.admin.deleteCategory.mutate({ id });
    },

    async reorderCategories(parentId, ids) {
      await caller.admin.reorderCategories.mutate({ parentId, ids });
    },

    // ── orders ────────────────────────────────────────────────────────────
    async listOrders(): Promise<AdminOrder[]> {
      const rows = await caller.admin.orders.query({});
      return asArray<Row>(rows).map(mapOrder);
    },

    async getOrder(id) {
      const detail = (await caller.admin.order.query({ id })) as Row | null;
      if (!detail) return null;
      return mapOrderDetail(detail);
    },

    async setOrderStatus(id, status, note) {
      const detail = (await caller.admin.setOrderStatus.mutate({
        id,
        status: status as never,
        note: note ?? null,
      })) as Row;
      return mapOrderDetail(detail);
    },

    async setOrderPayment(id, paymentStatus) {
      const detail = (await caller.admin.setPaymentStatus.mutate({
        id,
        paymentStatus: paymentStatus as never,
      })) as Row;
      return mapOrderDetail(detail);
    },

    async setOrderTracking(id, trackingNumber, carrier) {
      const detail = (await caller.admin.setTracking.mutate({
        id,
        trackingNumber,
        carrier,
      })) as Row;
      return mapOrderDetail(detail);
    },

    async deleteOrder(id) {
      await caller.admin.deleteOrder.mutate({ id });
    },

    // ── crypto payments (NOWPayments) ─────────────────────────────────────
    async getRawPayment(id): Promise<AdminRawPaymentData> {
      return mapRawPayment((await caller.admin.rawPayment.query({ id })) as unknown as Row);
    },

    async refreshPaymentStatus(id): Promise<AdminRawPaymentData> {
      const res = (await caller.admin.refreshPaymentStatus.mutate({ id })) as unknown as Row;
      return mapRawPayment((res.raw ?? res) as Row);
    },

    async refundPayment(id, opts): Promise<AdminRefundResult> {
      const res = (await caller.admin.refundPayment.mutate({
        id,
        confirm: opts.confirm,
        amount: opts.amount,
        reason: opts.reason,
      })) as unknown as Row;
      return {
        ok: bool(res.ok),
        refundStatus: str(res.refundStatus),
        label: str(res.label),
        refundId: nullableStr(res.refundId),
        amount: nullableStr(res.amount),
        currency: nullableStr(res.currency),
        reason: nullableStr(res.reason) ?? undefined,
      };
    },

    // ── email history (admin) ────────────────────────────────────────────────
    async getEmailHistory(id): Promise<AdminOrderEmailHistory> {
      return mapEmailHistory((await caller.admin.emailHistory.query({ id })) as unknown as Row);
    },

    async getTelegramStatus(id): Promise<AdminOrderTelegramStatus> {
      return mapTelegramStatus(
        (await caller.admin.telegramStatus.query({ id })) as unknown as Row,
      );
    },

    async resendConfirmationEmail(id): Promise<AdminResendResult> {
      const res = (await caller.admin.resendConfirmationEmail.mutate({
        id,
        origin: typeof window !== "undefined" ? window.location.origin : null,
      })) as unknown as Row;
      const outcome = (res.outcome ?? {}) as Row;
      return {
        outcome: {
          status: str(outcome.status),
          reason: nullableStr(outcome.reason) ?? undefined,
          sentAt: nullableStr(outcome.sentAt) ?? undefined,
        },
        history: mapEmailHistory((res.history ?? {}) as Row),
      };
    },

    // ── customers ─────────────────────────────────────────────────────────
    async listCustomers(): Promise<AdminCustomer[]> {
      const rows = await caller.admin.customers.query();
      return asArray<Row>(rows).map((c) => ({
        id: str(c.id),
        email: str(c.email),
        name: str(c.fullName ?? c.name),
        phone: nullableStr(c.phone),
        orderCount: num(c.orderCount),
        spendCents: num(c.spendCents),
        createdAt: str(c.createdAt),
        lastOrderAt: nullableStr(c.lastOrderAt),
      }));
    },

    // ── users (every registered account, not only paid buyers) ─────────────
    async listUsers(): Promise<AdminUser[]> {
      const rows = await caller.admin.users.query();
      return asArray<Row>(rows).map((u) => ({
        id: str(u.id),
        email: str(u.email),
        name: str(u.fullName ?? u.name),
        role: str(u.role) || "user",
        phone: nullableStr(u.phone),
        orderCount: num(u.orderCount),
        emailVerified: u.emailVerifiedAt != null && u.emailVerifiedAt !== "",
        createdAt: str(u.createdAt),
      }));
    },

    async deleteUser(id) {
      await caller.admin.deleteUser.mutate({ id });
    },

    // ── reviews ───────────────────────────────────────────────────────────
    async listReviews(): Promise<AdminReview[]> {
      const rows = await caller.admin.reviews.query();
      return asArray<Row>(rows).map(mapReview);
    },

    async setReviewStatus(id, status: AdminReviewStatus) {
      const row = (await caller.admin.setReviewStatus.mutate({ id, status })) as Row;
      return mapReview(row);
    },

    async setReviewVisibility(id, isPublic) {
      const row = (await caller.admin.setReviewVisibility.mutate({ id, isPublic })) as Row;
      return mapReview(row);
    },

    async deleteReview(id) {
      await caller.admin.deleteReview.mutate({ id });
    },

    // ── contact messages ──────────────────────────────────────────────────
    async listMessages(): Promise<AdminContactMessage[]> {
      const rows = await caller.admin.messages.query();
      return asArray<Row>(rows).map(mapMessage);
    },

    async setMessageStatus(id, status: AdminMessageStatus) {
      const row = (await caller.admin.setMessageStatus.mutate({ id, status })) as Row;
      return mapMessage(row);
    },

    async createMessage(input) {
      const row = (await caller.admin.createMessage.mutate(input)) as Row;
      return mapMessage(row);
    },

    async updateMessage(id, input) {
      const row = (await caller.admin.updateMessage.mutate({ id, ...input })) as Row;
      return mapMessage(row);
    },

    async deleteMessage(id) {
      await caller.admin.deleteMessage.mutate({ id });
    },

    async replyToMessage(id, replyBody) {
      const res = (await caller.admin.replyToMessage.mutate({ id, replyBody })) as {
        message: Row;
        emailStatus: string;
        emailReason: string | null;
      };
      return {
        message: mapMessage(res.message),
        emailStatus: res.emailStatus,
        emailReason: res.emailReason,
      };
    },

    // ── newsletter ────────────────────────────────────────────────────────
    async listSubscribers(params?: AdminPageParams): Promise<AdminSubscriberPage> {
      const res = (await caller.admin.newsletter.query(params)) as unknown as Row;
      const rows = asArray<Row>(res.rows).map(mapSubscriber);
      return {
        rows,
        total: num(res.total),
        page: num(res.page) || 1,
        pageSize: num(res.pageSize) || rows.length || ADMIN_PAGE_SIZE_DEFAULT,
        pageCount: num(res.pageCount) || 1,
      };
    },

    async setSubscriberStatus(id, status: AdminSubscriberStatus) {
      const row = (await caller.admin.setSubscriberStatus.mutate({ id, status })) as Row;
      return mapSubscriber(row);
    },

    async deleteSubscriber(id: string): Promise<void> {
      await caller.admin.deleteSubscriber.mutate({ id });
    },

    // ── settings ──────────────────────────────────────────────────────────
    async getSettings(): Promise<AdminSettings> {
      const s = (await caller.admin.settings.query()) as unknown as Row;
      return {
        brandName: str(s.brand_name),
        tagline: str(s.tagline),
        announcement: str(s.announcement),
        contactEmail: str(s.contact_email),
        contactPhone: str(s.contact_phone),
        supportHours: str(s.support_hours),
        businessAddress: str(s.business_address),
        currency: str(s.currency) || "USD",
        shippingFlatCents: num(s.shipping_flat_cents),
        freeShippingThresholdCents: num(s.free_shipping_threshold_cents),
        taxRateBps: num(s.tax_rate_bps),
        returnWindowDays: num(s.return_window_days),
        lowStockThreshold: num(s.low_stock_threshold) || 10,
        paymentProvider: str(s.payment_provider) || "nowpayments",
        emailFromName: str(s.email_from_name),
        emailFromAddress: str(s.email_from_address),
      };
    },

    async updateSettings(input: Partial<AdminSettings>) {
      await caller.admin.updateSettings.mutate({
        brand_name: input.brandName,
        tagline: input.tagline,
        announcement: input.announcement,
        contact_email: input.contactEmail,
        contact_phone: input.contactPhone,
        support_hours: input.supportHours,
        business_address: input.businessAddress,
        currency: input.currency,
        shipping_flat_cents: input.shippingFlatCents,
        free_shipping_threshold_cents: input.freeShippingThresholdCents,
        tax_rate_bps: input.taxRateBps,
        return_window_days: input.returnWindowDays,
        low_stock_threshold: input.lowStockThreshold,
        payment_provider: input.paymentProvider,
        email_from_name: input.emailFromName,
        email_from_address: input.emailFromAddress,
      });
      return this.getSettings();
    },
  };
}

// ── payload builders ─────────────────────────────────────────────────────────
function toProductPayload(input: AdminProductInput) {
  return {
    name: input.name.trim(),
    // Blank slug: the server derives it from the name (the same slugifier the
    // storefront's URLs use), so a product created here is reachable at once.
    slug: input.slug?.trim() || undefined,
    description: input.description,
    category: input.category.trim(),
    priceCents: Math.max(0, Math.round(input.priceCents)),
    compareAtCents: input.compareAtCents == null ? null : Math.max(0, Math.round(input.compareAtCents)),
    images: input.images,
    media: input.media,
    specs: input.specs,
    tags: input.tags,
    active: input.active,
    featured: input.featured,
    sortOrder: Math.round(input.sortOrder),
  };
}

function toCategoryPayload(input: AdminCategoryInput) {
  return {
    name: input.name.trim(),
    slug: input.slug?.trim() || undefined,
    description: input.description,
    // `undefined` (an absent parentId) leaves the parent untouched on an update
    // and means "top-level" on a create; an explicit null promotes a
    // subcategory to top level. The server distinguishes the two.
    parentId: input.parentId,
    featured: input.featured,
    sortOrder: Math.round(input.sortOrder),
  };
}

// ── mappers ──────────────────────────────────────────────────────────────────
function mapPromoSlot(v: unknown): AdminPromoSlot | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Row;
  if (!r.product) return null;
  const copy = (r.copy ?? {}) as Row;
  return {
    kind: (str(r.kind) || "new_arrivals") as AdminPromoSlot["kind"],
    product: mapProduct(r.product as Row),
    copy: {
      eyebrow: str(copy.eyebrow),
      title: str(copy.title),
      body: str(copy.body),
      cta: str(copy.cta),
    },
    source: (str(r.source) || "fallback") as AdminPromoSlot["source"],
  };
}

function mapFeaturedPicks(res: Row): AdminFeaturedPicksState {
  return {
    productIds: asArray<string>(res.productIds),
    products: asArray<Row>(res.products).map(mapProduct),
  };
}

function mapPromoState(res: Row): AdminPromoState {
  return {
    newArrivalsProductId: str(res.newArrivalsProductId),
    bestSellersProductId: str(res.bestSellersProductId),
    newArrivals: mapPromoSlot(res.newArrivals),
    bestSellers: mapPromoSlot(res.bestSellers),
  };
}

function mapProduct(row: Row): AdminProduct {
  return {
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    description: str(row.description),
    category: str(row.category),
    priceCents: num(row.priceCents),
    compareAtCents: row.compareAtCents == null ? null : num(row.compareAtCents),
    images: asArray<string>(row.images),
    media: normalizeMedia(asArray<Row>(row.media), asArray<string>(row.images)),
    specs: (row.specs ?? {}) as AdminProductSpecs,
    tags: asArray<string>(row.tags),
    active: bool(row.active),
    featured: bool(row.featured),
    sortOrder: num(row.sortOrder),
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
    variants: asArray<Row>(row.variants).map(mapVariant),
    rating: row.rating == null ? null : num(row.rating),
    reviewCount: num(row.reviewCount),
  };
}

function mapVariant(v: Row): AdminVariant {
  return {
    id: str(v.id),
    name: str(v.name),
    sku: str(v.sku),
    priceCents: num(v.priceCents),
    inventoryQty: num(v.inventoryQty),
    active: bool(v.active),
    cjVid: v.cjVid == null || v.cjVid === "" ? null : str(v.cjVid),
  };
}

function mapCategoryChild(c: Row): AdminCategoryChild {
  return {
    id: str(c.id),
    name: str(c.name),
    slug: str(c.slug),
    description: str(c.description),
    productCount: num(c.productCount),
    featured: bool(c.featured),
    sortOrder: num(c.sortOrder),
  };
}

function mapCategory(c: Row): AdminCategory {
  return {
    id: str(c.id),
    name: str(c.name),
    slug: str(c.slug),
    description: str(c.description),
    productCount: num(c.productCount),
    parentId: nullableStr(c.parentId),
    featured: bool(c.featured),
    sortOrder: num(c.sortOrder),
    children: asArray<Row>(c.children).map(mapCategoryChild),
  };
}

function mapRawPayment(row: Row): AdminRawPaymentData {
  const refund = (row.refund ?? {}) as Row;
  return {
    provider: str(row.provider) || "nowpayments",
    configured: bool(row.configured),
    paymentStatus: str(row.paymentStatus) || "unpaid",
    storedStatusDetail: nullableStr(row.storedStatusDetail),
    liveStatus: nullableStr(row.liveStatus),
    liveLabel: nullableStr(row.liveLabel),
    paymentId: nullableStr(row.paymentId),
    invoiceId: nullableStr(row.invoiceId),
    paymentUrl: nullableStr(row.paymentUrl),
    payAddress: nullableStr(row.payAddress),
    payCurrency: nullableStr(row.payCurrency),
    payAmount: row.payAmount == null ? null : num(row.payAmount),
    actuallyPaid: row.actuallyPaid == null ? null : num(row.actuallyPaid),
    priceAmount: row.priceAmount == null ? null : num(row.priceAmount),
    priceCurrency: nullableStr(row.priceCurrency),
    outcomeAmount: row.outcomeAmount == null ? null : num(row.outcomeAmount),
    outcomeCurrency: nullableStr(row.outcomeCurrency),
    lastIpn: (row.lastIpn as Record<string, unknown> | null) ?? null,
    lastIpnAt: nullableStr(row.lastIpnAt),
    lastIpnStatus: nullableStr(row.lastIpnStatus),
    refund: {
      status: nullableStr(refund.status),
      label: nullableStr(refund.label),
      ref: nullableStr(refund.ref),
      amount: nullableStr(refund.amount),
      currency: nullableStr(refund.currency),
      refundedAt: nullableStr(refund.refundedAt),
    },
    error: nullableStr(row.error),
  };
}

function mapEmailHistory(row: Row): AdminOrderEmailHistory {
  const emails = asArray<Row>(row.emails).map(
    (e): AdminEmailLogEntry => ({
      id: str(e.id),
      kind: str(e.kind),
      trigger: nullableStr(e.trigger),
      to: str(e.to),
      subject: str(e.subject),
      status: str(e.status),
      error: nullableStr(e.error),
      createdAt: str(e.createdAt),
    }),
  );
  return {
    confirmationEmailSentAt: nullableStr(row.confirmationEmailSentAt),
    unpaidAlertSentAt: nullableStr(row.unpaidAlertSentAt),
    emails,
  };
}

function mapTelegramStatus(row: Row): AdminOrderTelegramStatus {
  return {
    notifiedAt: nullableStr(row.notifiedAt),
    notifyError: nullableStr(row.notifyError),
    outbox: asArray<Row>(row.outbox).map(
      (o): AdminTelegramOutboxEntry => ({
        id: str(o.id),
        status: str(o.status),
        attempts: num(o.attempts),
        lastError: nullableStr(o.lastError),
        nextAttemptAt: str(o.nextAttemptAt),
        lastAttemptAt: nullableStr(o.lastAttemptAt),
        createdAt: str(o.createdAt),
      }),
    ),
  };
}

function mapOrder(row: Row): AdminOrder {
  return {
    id: str(row.id),
    orderNumber: str(row.orderNumber),
    email: str(row.email),
    customerName: str(row.customerName ?? row.email),
    status: str(row.status) || "pending",
    paymentStatus: str(row.paymentStatus) || "unpaid",
    subtotalCents: num(row.subtotalCents),
    shippingCents: num(row.shippingCents),
    taxCents: num(row.taxCents),
    totalCents: num(row.totalCents),
    currency: str(row.currency) || "USD",
    items: [],
    events: [],
    trackingNumber: nullableStr(row.trackingNumber),
    carrier: nullableStr(row.carrier),
    notes: nullableStr(row.notes),
    createdAt: str(row.createdAt),
    updatedAt: str(row.updatedAt),
  };
}

/** The order detail procedure returns `{ order, items, events }`; the status
 *  mutations return the same shape. Map it defensively either way. */
function mapOrderDetail(detail: Row): AdminOrder {
  const order = mapOrder((detail.order ?? detail) as Row);
  order.items = asArray<Row>(detail.items).map((it) => ({
    id: str(it.id),
    name: str(it.nameSnapshot ?? it.name),
    variant: nullableStr(it.variantSnapshot ?? it.variant),
    priceCents: num(it.priceCents),
    qty: num(it.qty),
    image: nullableStr(it.imageUrl ?? it.image),
  }));
  order.events = asArray<Row>(detail.events).map((e) => ({
    id: str(e.id),
    status: str(e.status),
    note: nullableStr(e.note),
    createdAt: str(e.createdAt),
  }));
  return order;
}

function mapReview(r: Row): AdminReview {
  return {
    id: str(r.id),
    productId: r.productId == null ? null : str(r.productId),
    productName: nullableStr(r.productName),
    authorName: str(r.authorName),
    rating: num(r.rating),
    title: nullableStr(r.title),
    body: str(r.body),
    status: (str(r.status) || "pending") as AdminReviewStatus,
    isPublic: bool(r.isPublic),
    verified: bool(r.verified),
    createdAt: str(r.createdAt),
  };
}

function mapMessage(m: Row): AdminContactMessage {
  return {
    id: str(m.id),
    name: str(m.name),
    email: str(m.email),
    topic: str(m.topic),
    message: str(m.message),
    status: (str(m.status) || "new") as AdminMessageStatus,
    repliedAt: m.repliedAt ? str(m.repliedAt) : null,
    replyBody: m.replyBody ? str(m.replyBody) : null,
    createdAt: str(m.createdAt),
  };
}

function mapSubscriber(s: Row): AdminSubscriber {
  return {
    id: str(s.id ?? s.email),
    email: str(s.email),
    source: str(s.source) || "footer",
    status: (str(s.status) || "subscribed") as AdminSubscriberStatus,
    createdAt: str(s.createdAt),
  };
}
