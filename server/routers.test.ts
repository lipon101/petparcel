import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { slugify, parseDollarsToCents, newOrderNumber, sortCategories } from "../shared/store";

// Full rationale for what gets mocked below (and why ./_core/trpc doesn't
// need to be) lives on server/_core/test-caller.ts, next to makeCaller —
// mock every _core module routers.ts touches.
vi.mock("./_core/auth", () => {
  class AuthError extends Error {}
  return {
    authProvider: () => ({ login: vi.fn(), logout: vi.fn(), getSession: vi.fn() }),
    registerLocalUser: vi.fn(),
    AuthError,
    EmailTakenError: class EmailTakenError extends AuthError {},
  };
});

vi.mock("./store-settings", () => ({
  getSettings: vi.fn(async () => ({ brand_name: "PetParcel", currency: "USD" })),
  updateSettings: vi.fn(async () => ({ ok: true })),
}));

vi.mock("./services/payments", () => ({
  getProvider: vi.fn(() => ({
    id: "manual",
    label: "Pay on invoice",
    isConfigured: () => true,
    describe: () => "offline",
    start: vi.fn(async (input: { orderNumber: string }) => ({
      redirectUrl: `/order/${input.orderNumber}`,
      instructions: "ok",
    })),
  })),
  listProviders: vi.fn(() => [{ id: "manual", label: "Pay on invoice", configured: true, describe: "offline" }]),
  verifyPayment: vi.fn(async () => false),
}));

vi.mock("./db", () => ({
  // Catalog
  listProducts: vi.fn(async () => []),
  listFeaturedProducts: vi.fn(async () => []),
  listCategories: vi.fn(async () => []),
  getProductBySlug: vi.fn(),
  listProductReviews: vi.fn(async () => []),
  listRelatedProducts: vi.fn(async () => []),
  listStoreReviews: vi.fn(async () => []),
  hasPurchasedProduct: vi.fn(async () => false),
  getProfile: vi.fn(async () => null),
  createReview: vi.fn(),
  upsertProfile: vi.fn(),
  // Orders
  createOrder: vi.fn(),
  getOrderByNumber: vi.fn(),
  getOrderDetail: vi.fn(),
  listUserOrders: vi.fn(async () => []),
  updateOrderPayment: vi.fn(async () => null),
  updateOrderStatus: vi.fn(async () => null),
  OutOfStockError: class OutOfStockError extends Error {},
  // Addresses
  listAddresses: vi.fn(async () => []),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  getDefaultAddress: vi.fn(async () => null),
  // Admin
  adminStats: vi.fn(async () => ({
    revenueCents: 0,
    orderCount: 0,
    openOrders: 0,
    customerCount: 0,
    reviewCount: 0,
    lowStock: [],
    recentOrders: [],
    topProducts: [],
  })),
  adminListOrders: vi.fn(async () => []),
  listInventory: vi.fn(async () => []),
  listCustomers: vi.fn(async () => []),
  listAllReviews: vi.fn(async () => []),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
  setVariantInventory: vi.fn(),
}));

const { appRouter } = await import("./routers");
const { createOrder, listUserOrders, adminStats } = await import("./db");

const anonymous = { c: {} as never, db: {} as never, user: null };
const customer = { c: {} as never, db: {} as never, user: { id: "user-1", role: "user" } as never };
const admin = { c: {} as never, db: {} as never, user: { id: "admin-1", role: "admin" } as never };

// ── Pure helpers ─────────────────────────────────────────────────────────────
describe("slugify", () => {
  it("produces URL-safe slugs from product names", () => {
    expect(slugify("Orthopedic Memory Foam Dog Bed")).toBe("orthopedic-memory-foam-dog-bed");
    expect(slugify("Cat's Meow (Deluxe!)")).toBe("cats-meow-deluxe");
    expect(slugify("  spaced  out  ")).toBe("spaced-out");
  });
});

describe("parseDollarsToCents", () => {
  it("converts form input to integer cents", () => {
    expect(parseDollarsToCents("29.99")).toBe(2999);
    expect(parseDollarsToCents("$1,234.50")).toBe(123450);
    expect(parseDollarsToCents("0")).toBe(0);
  });

  it("returns null for blank or unparseable input", () => {
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents(null)).toBeNull();
    expect(parseDollarsToCents("abc")).toBeNull();
  });
});

describe("newOrderNumber", () => {
  it("is prefixed, short, and free of ambiguous characters", () => {
    const n = newOrderNumber();
    expect(n).toMatch(/^PP-[A-Z2-9]{8}$/);
    expect(n).not.toMatch(/[O0I1]/);
  });
});

describe("sortCategories", () => {
  it("orders known categories first, then alphabetically", () => {
    expect(sortCategories(["Grooming", "Zebra", "Dogs", "Cats"])).toEqual([
      "Dogs",
      "Cats",
      "Grooming",
      "Zebra",
    ]);
  });
});

// ── Access control ───────────────────────────────────────────────────────────
describe("admin gating", () => {
  it("rejects an anonymous caller", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.admin.stats().catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
  });

  it("rejects a signed-in non-admin", async () => {
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.admin.stats().catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  it("allows an admin through to the data layer", async () => {
    const caller = appRouter.createCaller(admin as never);
    const stats = await caller.admin.stats();
    expect(stats.revenueCents).toBe(0);
    expect(adminStats).toHaveBeenCalled();
  });
});

describe("orders.list", () => {
  it("requires a session", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.orders.list().catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
  });

  it("scopes the query to the signed-in user", async () => {
    const caller = appRouter.createCaller(customer as never);
    await caller.orders.list();
    expect(listUserOrders).toHaveBeenCalledWith("user-1");
  });
});

// ── Checkout ─────────────────────────────────────────────────────────────────
describe("checkout.place", () => {
  it("rejects an empty cart before touching the database", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.checkout
      .place({
        email: "buyer@example.com",
        items: [],
        shippingAddress: {
          fullName: "Ada Lovelace",
          line1: "1 Analytical Way",
          city: "Wilmington",
          state: "DE",
          postalCode: "19801",
          country: "US",
        },
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(vi.mocked(createOrder)).not.toHaveBeenCalled();
  });

  it("accepts a guest order and returns a payment redirect", async () => {
    vi.mocked(createOrder).mockResolvedValueOnce({
      orderNumber: "PP-ABCDEFGH",
      totalCents: 4999,
      currency: "USD",
      email: "buyer@example.com",
    } as never);

    const caller = appRouter.createCaller(anonymous as never);
    const result = await caller.checkout.place({
      email: "buyer@example.com",
      items: [{ slug: "dog-bed", variantId: null, qty: 1 }],
      shippingAddress: {
        fullName: "Ada Lovelace",
        line1: "1 Analytical Way",
        city: "Wilmington",
        state: "DE",
        postalCode: "19801",
        country: "US",
      },
      origin: "https://www.petparcel.store",
    });

    expect(result.orderNumber).toBe("PP-ABCDEFGH");
    expect(result.provider).toBe("manual");
    expect(result.redirectUrl).toBe("/order/PP-ABCDEFGH");
    // Prices come from the catalog, never from the client payload.
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, email: "buyer@example.com" }),
    );
  });
});
