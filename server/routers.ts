// ── AGENT-OWNED: tRPC API surface ────────────────────────────────────────────
// Procedures stay thin: validate with zod, call server/db.ts for data, and
// server/services/* for external systems. Access levels come from _core/trpc:
// publicProcedure (anyone) / protectedProcedure (ctx.user set) / adminProcedure.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import { authProvider, registerLocalUser, AuthError, EmailTakenError } from "./_core/auth";
// Imported from the leaf module (not `_core/db`) on purpose: `_core/db` binds
// the whole driver + env at import time, which would force a live DATABASE_URL
// into every test that merely imports this router.
import { isUniqueViolation } from "./_core/db-errors";
import * as q from "./db";
import { getSettings, updateSettings } from "./store-settings";
import { getProvider, listProviders, verifyPayment } from "./services/payments";
import { ORDER_STATUSES, PAYMENT_STATUSES, slugify, sortCategories } from "../shared/store";

// ── shared zod fragments ─────────────────────────────────────────────────────
const addressSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  line1: z.string().min(1, "Street address is required"),
  line2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(3, "ZIP code is required"),
  country: z.string().default("US"),
  phone: z.string().optional().nullable(),
});

const cartLineSchema = z.object({
  slug: z.string().min(1),
  variantId: z.string().nullable(),
  qty: z.number().int().min(1).max(99),
});

const productInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  description: z.string().default(""),
  category: z.string().min(1, "Category is required"),
  priceCents: z.number().int().min(0),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const variantInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  priceCents: z.number().int().min(0),
  inventoryQty: z.number().int().min(0).default(0),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});

// ── auth ─────────────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  signup: publicProcedure
    .input(
      z.object({
        email: z.email(),
        password: z.string().min(8, "Use at least 8 characters"),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await registerLocalUser(input.email, input.password, input.name);
        // Keep the business profile row in step with the account.
        await q.upsertProfile(user.id, { fullName: input.name ?? null });
        await authProvider().login(ctx.c, input.email, input.password);
        return user;
      } catch (e: unknown) {
        if (e instanceof EmailTakenError) {
          throw new TRPCError({ code: "CONFLICT", message: e.message });
        }
        throw e;
      }
    }),

  login: publicProcedure
    .input(z.object({ email: z.email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await authProvider().login(ctx.c, input.email, input.password);
      } catch (e) {
        if (e instanceof AuthError) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: e.message });
        }
        throw e;
      }
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await authProvider().logout(ctx.c);
    return { ok: true };
  }),
});

// ── catalog (public reads) ───────────────────────────────────────────────────
const catalogRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          category: z.string().optional(),
          search: z.string().optional(),
          sort: z.enum(["featured", "price-asc", "price-desc", "newest", "name"]).optional(),
        })
        .optional(),
    )
    .query(({ input }) => q.listProducts(input ?? {})),

  featured: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).optional() }).optional())
    .query(({ input }) => q.listFeaturedProducts(input?.limit ?? 8)),

  categories: publicProcedure.query(async () => sortCategories(await q.listCategories())),

  bySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(async ({ input }) => {
    const product = await q.getProductBySlug(input.slug);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    const [reviews, related] = await Promise.all([
      q.listProductReviews(product.id),
      q.listRelatedProducts(product.id, product.category, 4),
    ]);
    return { product, reviews, related };
  }),
});

// ── reviews ──────────────────────────────────────────────────────────────────
const reviewsRouter = router({
  store: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).optional() }).optional())
    .query(({ input }) => q.listStoreReviews(input?.limit ?? 6)),

  create: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        rating: z.number().int().min(1).max(5),
        title: z.string().max(120).optional(),
        body: z.string().min(10, "Tell us a little more").max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // "Verified purchase" is earned, never claimed.
      const purchased = await q.hasPurchasedProduct(ctx.user.id, input.productId);
      const profile = await q.getProfile(ctx.user.id);
      return q.createReview({
        productId: input.productId,
        authorName: profile?.fullName || ctx.user.name || "PetParcel customer",
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        verified: purchased,
      });
    }),
});

// ── store settings ───────────────────────────────────────────────────────────
const settingsRouter = router({
  public: publicProcedure.query(() => getSettings()),
  providers: publicProcedure.query(() => listProviders()),
});

// ── newsletter ───────────────────────────────────────────────────────────────
const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email("Enter a valid email address"),
        source: z.string().max(40).optional(),
      }),
    )
    .mutation(({ input }) => q.subscribeNewsletter(input.email, input.source ?? "footer")),
});

// ── checkout ─────────────────────────────────────────────────────────────────
const checkoutRouter = router({
  /** Place an order. Guests and logged-in customers both use this. Prices are
   *  re-resolved server-side from the catalog — never trusted from the client. */
  place: publicProcedure
    .input(
      z.object({
        email: z.email("Enter a valid email address"),
        items: z.array(cartLineSchema).min(1, "Your cart is empty"),
        shippingAddress: addressSchema,
        billingAddress: addressSchema.optional(),
        paymentProvider: z.string().default("manual"),
        notes: z.string().max(500).optional().nullable(),
        saveAddress: z.boolean().optional(),
        /** Absolute site origin, so the gateway can return the shopper here. */
        origin: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const order = await q.createOrder({
          userId: ctx.user?.id ?? null,
          email: input.email,
          items: input.items,
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress ?? input.shippingAddress,
          paymentProvider: input.paymentProvider,
          notes: input.notes ?? null,
        });

        // Signed-in shoppers can opt to keep this address on file.
        if (ctx.user && input.saveAddress) {
          await q.createAddress(ctx.user.id, {
            label: "Checkout",
            ...input.shippingAddress,
            isDefaultShipping: true,
          });
        }

        const origin = (input.origin ?? "").replace(/\/$/, "");
        const provider = getProvider(input.paymentProvider);
        const started = await provider.start({
          orderNumber: order.orderNumber,
          totalCents: order.totalCents,
          currency: order.currency,
          email: order.email,
          customerName: input.shippingAddress.fullName,
          returnUrl: `${origin}/order/${order.orderNumber}`,
          ipnUrl: `${origin}/api/payments/notify`,
        });

        return {
          orderNumber: order.orderNumber,
          totalCents: order.totalCents,
          provider: provider.id,
          redirectUrl: started.redirectUrl,
          instructions: started.instructions,
        };
      } catch (e) {
        if (e instanceof q.OutOfStockError) {
          throw new TRPCError({ code: "CONFLICT", message: e.message });
        }
        throw e;
      }
    }),

  /** Confirm payment after a hosted checkout. Asks the provider directly from
   *  the server, so a forged return URL cannot mark an order paid. */
  confirmPayment: publicProcedure
    .input(z.object({ orderNumber: z.string().min(3) }))
    .mutation(async ({ input }) => {
      const order = await q.getOrderByNumber(input.orderNumber);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.paymentStatus === "paid") return { paid: true, status: "paid" };

      const providerId = order.paymentProvider ?? "manual";
      const paid = await verifyPayment(providerId, order.orderNumber);
      if (paid) {
        await q.updateOrderPayment({
          orderId: order.id,
          paymentStatus: "paid",
          paymentProvider: providerId,
        });
        await q.updateOrderStatus(order.id, "paid", "Payment confirmed by the gateway.");
      }
      return { paid, status: paid ? "paid" : order.paymentStatus };
    }),
});

// ── orders ───────────────────────────────────────────────────────────────────
const ordersRouter = router({
  /** Signed-in customer: their own order history. */
  list: protectedProcedure.query(({ ctx }) => q.listUserOrders(ctx.user.id)),

  /** Signed-in customer: one of their own orders (id or order number). */
  mine: protectedProcedure.input(z.object({ ref: z.string().min(1) })).query(async ({ ctx, input }) => {
    const detail = await q.getUserOrderDetailByRef(input.ref, ctx.user.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    return detail;
  }),

  /**
   * Order lookup by order number + email.
   * - The owner of the order (logged in) needs no email.
   * - Anyone else must supply the exact email the order was placed with.
   * Both cases return the same shape, so the confirmation page and the public
   * /track page share one procedure.
   */
  lookup: publicProcedure
    .input(z.object({ orderNumber: z.string().min(3), email: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const order = await q.getOrderByNumber(input.orderNumber);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "We couldn't find that order." });

      const isOwner = Boolean(ctx.user && order.userId === ctx.user.id);
      if (!isOwner) {
        const supplied = (input.email ?? "").trim().toLowerCase();
        if (!supplied || supplied !== order.email.toLowerCase()) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "We couldn't find that order. Check the order number and the email you used.",
          });
        }
      }
      const detail = await q.getOrderDetail(order.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return detail;
    }),
});

// ── account (protected) ──────────────────────────────────────────────────────
const accountRouter = router({
  profile: protectedProcedure.query(async ({ ctx }) => ({
    profile: await q.getProfile(ctx.user.id),
    user: ctx.user,
  })),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().max(120).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
      }),
    )
    .mutation(({ ctx, input }) => q.upsertProfile(ctx.user.id, input)),

  addresses: protectedProcedure.query(({ ctx }) => q.listAddresses(ctx.user.id)),

  defaultAddress: protectedProcedure.query(({ ctx }) => q.getDefaultAddress(ctx.user.id)),

  addAddress: protectedProcedure
    .input(
      addressSchema.extend({
        label: z.string().max(60).optional().nullable(),
        isDefaultShipping: z.boolean().optional(),
        isDefaultBilling: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => q.createAddress(ctx.user.id, input)),

  updateAddress: protectedProcedure
    .input(
      addressSchema.extend({
        id: z.string().min(1),
        label: z.string().max(60).optional().nullable(),
        isDefaultShipping: z.boolean().optional(),
        isDefaultBilling: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const row = await q.updateAddress(id, ctx.user.id, rest);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Address not found" });
      return row;
    }),

  deleteAddress: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => q.deleteAddress(input.id, ctx.user.id)),
});

// ── admin ────────────────────────────────────────────────────────────────────
const adminRouter = router({
  stats: adminProcedure.query(() => q.adminStats()),

  // products
  products: adminProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(({ input }) =>
      q.listProducts({ includeInactive: true, search: input?.search, sort: "name", limit: 500 }),
    ),

  product: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const product = await q.getProductById(input.id);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    return product;
  }),

  createProduct: adminProcedure.input(productInputSchema).mutation(async ({ input }) => {
    const slug = slugify(input.slug || input.name);
    try {
      return await q.createProduct({ ...input, slug, compareAtCents: input.compareAtCents ?? null });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new TRPCError({ code: "CONFLICT", message: "That URL slug is already in use." });
      }
      throw e;
    }
  }),

  updateProduct: adminProcedure
    .input(productInputSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const slug = slugify(rest.slug || rest.name);
      try {
        const row = await q.updateProduct(id, {
          ...rest,
          slug,
          compareAtCents: rest.compareAtCents ?? null,
        });
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        return row;
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({ code: "CONFLICT", message: "That URL slug is already in use." });
        }
        throw e;
      }
    }),

  deleteProduct: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => q.deleteProduct(input.id)),

  // variants
  createVariant: adminProcedure
    .input(variantInputSchema.extend({ productId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await q.createVariant(input);
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({ code: "CONFLICT", message: "That SKU is already used." });
        }
        throw e;
      }
    }),

  updateVariant: adminProcedure
    .input(variantInputSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      try {
        const row = await q.updateVariant(id, rest);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });
        return row;
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({ code: "CONFLICT", message: "That SKU is already used." });
        }
        throw e;
      }
    }),

  deleteVariant: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => q.deleteVariant(input.id)),

  // inventory
  inventory: adminProcedure.query(() => q.listInventory()),
  setInventory: adminProcedure
    .input(z.object({ id: z.string().min(1), qty: z.number().int().min(0).max(1_000_000) }))
    .mutation(({ input }) => q.setVariantInventory(input.id, input.qty)),

  // orders
  orders: adminProcedure
    .input(z.object({ status: z.string().optional(), search: z.string().optional() }).optional())
    .query(({ input }) => q.adminListOrders(input ?? {})),

  order: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const detail = await q.getOrderDetail(input.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    return detail;
  }),

  setOrderStatus: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(ORDER_STATUSES),
        note: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const detail = await q.updateOrderStatus(input.id, input.status, input.note ?? null);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return detail;
    }),

  setPaymentStatus: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        paymentStatus: z.enum(PAYMENT_STATUSES),
        paymentRef: z.string().max(120).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const detail = await q.updateOrderPayment({
        orderId: input.id,
        paymentStatus: input.paymentStatus,
        paymentRef: input.paymentRef ?? null,
      });
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return detail;
    }),

  setTracking: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        trackingNumber: z.string().max(120).nullable(),
        carrier: z.string().max(60).nullable(),
        markShipped: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const detail = await q.updateOrderTracking({
        orderId: input.id,
        trackingNumber: input.trackingNumber,
        carrier: input.carrier,
      });
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (input.markShipped && detail.order.status !== "shipped") {
        return q.updateOrderStatus(input.id, "shipped", "Marked shipped.");
      }
      return detail;
    }),

  setOrderNotes: adminProcedure
    .input(z.object({ id: z.string().min(1), notes: z.string().max(2000).nullable() }))
    .mutation(async ({ input }) => {
      const detail = await q.updateOrderNotes(input.id, input.notes);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return detail;
    }),

  // customers
  customers: adminProcedure.query(() => q.listCustomers()),
  customer: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const detail = await q.getCustomerDetail(input.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
    return detail;
  }),

  // reviews
  reviews: adminProcedure.query(() => q.listAllReviews()),
  deleteReview: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => q.deleteReview(input.id)),

  // newsletter
  newsletter: adminProcedure.query(() => q.listNewsletterSubscribers()),

  // settings
  settings: adminProcedure.query(() => getSettings()),
  updateSettings: adminProcedure
    .input(
      z.object({
        brand_name: z.string().optional(),
        tagline: z.string().optional(),
        announcement: z.string().optional(),
        hero_headline: z.string().optional(),
        hero_subhead: z.string().optional(),
        contact_email: z.string().optional(),
        contact_phone: z.string().optional(),
        support_hours: z.string().optional(),
        business_address: z.string().optional(),
        shipping_flat_cents: z.number().int().min(0).optional(),
        free_shipping_threshold_cents: z.number().int().min(0).optional(),
        shipping_estimate: z.string().optional(),
        tax_rate_bps: z.number().int().min(0).max(10000).optional(),
        return_window_days: z.number().int().min(0).max(365).optional(),
        payment_provider: z.string().optional(),
        currency: z.string().optional(),
      }),
    )
    .mutation(({ input }) => updateSettings(input)),
});

export const appRouter = router({
  auth: authRouter,
  catalog: catalogRouter,
  reviews: reviewsRouter,
  settings: settingsRouter,
  newsletter: newsletterRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  account: accountRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
