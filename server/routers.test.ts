import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { slugify, parseDollarsToCents, newOrderNumber, sortCategories } from "../shared/store";

// Full rationale for what gets mocked below (and why ./_core/trpc doesn't
// need to be) lives on server/_core/test-caller.ts, next to makeCaller -
// mock every _core module routers.ts touches.

// The authorize URL the provider would hand back for a Google sign-in. The real
// one comes from Neon Auth; the tests only need it to be a URL the assertions can
// recognise.
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/auth?client_id=test";

vi.mock("./_core/auth", () => {
  class AuthError extends Error {}
  // A single, shared login spy so a test can make session establishment fail
  // (the "account created but JWT_SECRET missing" case) without touching the
  // other procedures that call authProvider().
  const login = vi.fn(async () => {});
  return {
    authProvider: () => ({ login, logout: vi.fn(), getSession: vi.fn() }),
    // The signup router branches on this; the tests exercise the LOCAL path, so
    // it must report false (Neon Auth off) for the existing assertions to hold.
    // A vi.fn so the Google sign-in tests can flip it on.
    authProviderUsesNeon: vi.fn(() => false),
    registerLocalUser: vi.fn(),
    registerNeonUser: vi.fn(),
    loginViaGoogleVerifier: vi.fn(),
    googleSignInStart: vi.fn(async () => ({ url: GOOGLE_AUTHORIZE_URL, challengeCookie: "challenge-value" })),
    setOAuthChallengeCookie: vi.fn(),
    readOAuthChallengeCookie: vi.fn(() => "challenge-value"),
    clearOAuthChallengeCookie: vi.fn(),
    requestOrigin: vi.fn(() => "https://petparcel.vercel.app"),
    AuthError,
    EmailTakenError: class EmailTakenError extends AuthError {},
    __login: login,
  };
});

// The auth procedures read feature flags from env, and the Google sign-in
// procedures talk to the Neon Auth client. Mock both so the router tests never
// depend on the ambient environment or touch the network.
vi.mock("./_core/env", () => ({
  env: { appSlug: "petparcel", isProd: false },
}));
vi.mock("./_core/neon-auth", () => ({
  // The Google sign-in procedures read the provider's base URL (for the callback
  // to reach it from the browser) and ask it to start a flow. The provider base
  // is deliberately a marker host, so a test can tell it apart from the site's.
  neonAuthBaseUrl: vi.fn(() => "https://auth.example.test/neondb/auth"),
  neonAuthGetVerifiedUser: vi.fn(),
  neonAuthSocialSignInStart: vi.fn(async () => ({
    url: GOOGLE_AUTHORIZE_URL,
    challengeCookie: "challenge-value",
  })),
  neonAuthSessionFromVerifier: vi.fn(),
  neonAuthRequestPasswordReset: vi.fn(async () => {}),
  neonAuthResetPassword: vi.fn(async () => {}),
  // The router maps this to a 400. It must be the SAME class the router imports,
  // so the mock exports its own and the tests construct it from here.
  NeonAuthOriginError: class NeonAuthOriginError extends Error {},
}));

vi.mock("./store-settings", () => ({
  getSettings: vi.fn(async () => ({ brand_name: "PetParcel", currency: "USD" })),
  updateSettings: vi.fn(async () => ({ ok: true })),
}));

vi.mock("./services/payments", () => ({
  getProvider: vi.fn(() => ({
    id: "bachs",
    label: "Card (Visa, Mastercard, Amex)",
    isConfigured: () => true,
    describe: () => "Bachs hosted card checkout",
    start: vi.fn(async (input: { orderNumber: string }) => ({
      redirectUrl: `/order/${input.orderNumber}`,
      instructions: "ok",
    })),
  })),
  listProviders: vi.fn(() => [
    {
      id: "bachs",
      label: "Card (Visa, Mastercard, Amex)",
      configured: true,
      describe: "Bachs hosted card checkout",
    },
  ]),
  verifyPayment: vi.fn(async () => false),
  reconcileOrderPayment: vi.fn(async () => null),
}));

vi.mock("./db", () => ({
  // Catalog
  listProducts: vi.fn(async () => []),
  listFeaturedProducts: vi.fn(async () => []),
  getProductBySlug: vi.fn(),
  listProductReviews: vi.fn(async () => []),
  listRelatedProducts: vi.fn(async () => []),
  listStoreReviews: vi.fn(async () => []),
  hasPurchasedProduct: vi.fn(async () => false),
  findPurchasedOrderForProduct: vi.fn(async () => null),
  hasReviewedProduct: vi.fn(async () => false),
  setReviewStatus: vi.fn(async () => null),
  setReviewVisibility: vi.fn(async () => null),
  getProfile: vi.fn(async () => null),
  createReview: vi.fn(),
  upsertProfile: vi.fn(async () => {}),
  // Orders
  createOrder: vi.fn(),
  getOrderByNumber: vi.fn(),
  getOrderDetail: vi.fn(),
  getOrderEmailHistory: vi.fn(async () => ({
    confirmationEmailSentAt: null,
    unpaidAlertSentAt: null,
    emails: [],
  })),
  listUserOrders: vi.fn(async () => []),
  updateOrderPayment: vi.fn(async () => null),
  updateOrderStatus: vi.fn(async () => null),
  setOrderPaymentInvoice: vi.fn(async () => {}),
  updateOrderTracking: vi.fn(async () => null),
  deleteOrder: vi.fn(async () => true),
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
  listUsers: vi.fn(async () => []),
  getUserRole: vi.fn(async () => null),
  deleteUserAccount: vi.fn(async () => null),
  AdminDeleteRefusedError: class AdminDeleteRefusedError extends Error {},
  listAllReviews: vi.fn(async () => []),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  deleteProduct: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
  setVariantInventory: vi.fn(),
  // Contact + wishlist
  submitContactMessage: vi.fn(async () => ({ id: "msg-1", createdAt: new Date() })),
  listWishlistProductIds: vi.fn(async () => []),
  toggleWishlistItem: vi.fn(async () => ({ saved: true })),
  // Categories (admin-managed)
  listCategories: vi.fn(async () => []),
  getCategoryById: vi.fn(async () => null),
  countProductsInCategory: vi.fn(async () => 0),
  listChildCategoryNames: vi.fn(async () => []),
  ensureCategoryRow: vi.fn(async () => {}),
  createCategory: vi.fn(),
  updateCategory: vi.fn(async () => null),
  deleteCategory: vi.fn(async () => {}),
  // Contact messages + newsletter triage
  listContactMessages: vi.fn(async () => []),
  setContactMessageStatus: vi.fn(async () => null),
  listNewsletterSubscribers: vi.fn(async () => []),
  listNewsletterSubscribersPage: vi.fn(async (paging: { page: number; pageSize: number }) => ({
    rows: [],
    total: 0,
    page: paging.page,
    pageSize: paging.pageSize,
    pageCount: 1,
  })),
  deleteNewsletterSubscriber: vi.fn(async () => true),
  setNewsletterSubscriberStatus: vi.fn(async () => null),
}));

// Storage is mocked so these tests exercise ROUTER behaviour - the content-type
// whitelist, admin gating, and StorageError → TRPCError mapping - rather than
// reaching object storage or the real `files` table.
vi.mock("./_core/storage", () => {
  class StorageError extends Error {
    constructor(message: string, readonly code: string) {
      super(message);
      this.name = "StorageError";
    }
  }
  return {
    StorageError,
    storagePutUrl: vi.fn(async () => {
      throw new StorageError("App storage not configured.", "not_configured");
    }),
    storageCommit: vi.fn(async (key: string) => ({ key })),
  };
});

vi.mock("./services/email", () => ({
  EMAIL_KIND_LABEL: {
    order_confirmation: "Order confirmation",
    payment_confirmation: "Payment confirmation",
    shipping_notification: "Shipping notification",
    welcome: "Welcome",
    admin_new_order: "New-order alert (admin)",
  },
  sendShippingNotification: vi.fn(async () => ({ status: "skipped", reason: "RESEND_API_KEY is not set" })),
  sendWelcomeEmail: vi.fn(async () => ({ status: "skipped", reason: "RESEND_API_KEY is not set" })),
  sendAdminNewOrderEmail: vi.fn(async () => ({ status: "skipped", reason: "RESEND_API_KEY is not set" })),
  absoluteUrl: vi.fn((origin: string | null | undefined, path: string) =>
    `${(origin ?? "").replace(/\/$/, "") || "https://www.petparcel.store"}${path}`,
  ),
  listEmailsForOrder: vi.fn(async () => []),
  listRecentEmails: vi.fn(async () => []),
  toEmailLines: vi.fn((items: unknown[]) => items),
  sendContactMessageEmail: vi.fn(async () => ({ status: "skipped", reason: "RESEND_API_KEY is not set" })),
}));

// The paid receipt lives behind its own gate (services/order-receipt.ts): sent
// only from a VERIFIED payment path and exactly once per order. Mocked so these
// router tests never reach the mail provider or the atomic claim, and so a test
// can assert whether the receipt path was invoked at all.
vi.mock("./services/order-receipt", () => ({
  sendPaidReceiptOnce: vi.fn(async () => ({ status: "sent", sentAt: new Date() })),
}));

// The signup flow now emails a verification link; mock the module so these
// router tests never reach Resend or the verification table.
vi.mock("./_core/email-verification", () => ({
  sendVerificationEmailForToken: vi.fn(async () => ({ status: "skipped", reason: "RESEND_API_KEY is not set" })),
  sendVerificationEmail: vi.fn(async () => ({ status: "skipped" })),
  verifyEmailToken: vi.fn(async () => ({ ok: false, reason: "invalid" })),
  resendVerificationForEmail: vi.fn(async () => {}),
  isEmailVerified: vi.fn(async () => false),
}));

// The DB-backed login/signup throttle is mocked so these tests exercise the
// ROUTER's wiring (which keys it checks, when it records a failure, when it
// clears) rather than reaching the real `login_attempts` table. The throttle's
// own counting logic is covered by server/_core/login-throttle.test.ts.
vi.mock("./_core/login-throttle", () => ({
  assertNotLocked: vi.fn(async () => {}),
  recordFailure: vi.fn(async () => {}),
  clearFailures: vi.fn(async () => {}),
  loginKeys: (email: string, ip: string) => ({
    account: `login_account:${email.trim().toLowerCase()}`,
    ip: `login_ip:${ip}`,
  }),
  LOGIN_ACCOUNT_RULE: { max: 5, lockMs: 900_000, windowMs: 900_000 },
  LOGIN_IP_RULE: { max: 20, lockMs: 900_000, windowMs: 900_000 },
  SIGNUP_IP_RULE: { max: 10, lockMs: 3_600_000, windowMs: 3_600_000 },
  LOCKED_MESSAGE: "Too many failed attempts. Please wait a few minutes and try again.",
}));

const { appRouter } = await import("./routers");
const {
  createOrder,
  listUserOrders,
  adminStats,
  updateOrderTracking,
  deleteOrder,
  getOrderDetail,
  getOrderByNumber,
  findPurchasedOrderForProduct,
  hasReviewedProduct,
  createReview,
  setReviewStatus,
  listProducts,
  submitContactMessage,
  toggleWishlistItem,
  listCategories,
  getCategoryById,
  countProductsInCategory,
  listChildCategoryNames,
  createCategory,
  updateCategory,
  deleteCategory,
  listContactMessages,
  setContactMessageStatus,
  listNewsletterSubscribersPage,
  deleteNewsletterSubscriber,
  setNewsletterSubscriberStatus,
  getUserRole,
  deleteUserAccount,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductBySlug,
} = await import("./db");
const { sendShippingNotification, sendWelcomeEmail } = await import("./services/email");
const { sendPaidReceiptOnce } = await import("./services/order-receipt");
const { getOrderEmailHistory } = await import("./db");

// A minimal Hono-context stand-in: the rate limiter reads `c.req.header`, so a
// bare `{}` would throw before the procedure body ever runs.
const fakeC = { req: { header: () => undefined } } as never;
const anonymous = { c: fakeC, db: {} as never, user: null };
const customer = { c: fakeC, db: {} as never, user: { id: "user-1", role: "user" } as never };
const admin = { c: fakeC, db: {} as never, user: { id: "admin-1", role: "admin" } as never };

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

// Deleting a user account. The HARD GUARD is the point: the owner's own
// (admin) account must never be deletable, or they lock themselves out of the
// panel forever. The refusal happens in the router AND again in the data layer.
describe("admin.deleteUser", () => {
  it("refuses to delete an admin/owner account and touches nothing", async () => {
    vi.mocked(getUserRole).mockResolvedValueOnce("admin");
    const caller = appRouter.createCaller(admin as never);
    const err = await caller.admin.deleteUser({ id: "owner-1" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect(deleteUserAccount).not.toHaveBeenCalled();
  });

  it("deletes a normal account through the data layer", async () => {
    vi.mocked(getUserRole).mockResolvedValueOnce("user");
    vi.mocked(deleteUserAccount).mockResolvedValueOnce({
      id: "u-2",
      email: "someone@example.com",
      role: "user",
      neonAuth: { users: 1, sessions: 1, accounts: 1, members: 0, invitations: 0, verifications: 0 },
    });
    const caller = appRouter.createCaller(admin as never);
    const res = await caller.admin.deleteUser({ id: "u-2" });
    expect(res.ok).toBe(true);
    expect(deleteUserAccount).toHaveBeenCalledWith("u-2");
  });

  it("answers NOT_FOUND for an account that does not exist", async () => {
    vi.mocked(deleteUserAccount).mockClear();
    vi.mocked(getUserRole).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(admin as never);
    const err = await caller.admin.deleteUser({ id: "nope" }).catch((e) => e);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
    expect(deleteUserAccount).not.toHaveBeenCalled();
  });

  it("rejects an anonymous caller before it reads a role", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.admin.deleteUser({ id: "u-2" }).catch((e) => e);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
  });
});

// ── Dedicated admin sign-in (adminAuth) ──────────────────────────────────────
// The admin door is SEPARATE from the customer login and refuses any account
// that is not the store's ONE designated admin. These tests pin that contract:
// the designated admin is let in, a normal customer is refused AT THE DOOR (and
// their session torn down), an admin-role account that is not the designated
// address is still refused, a bad password is a 401 that records a lockout
// failure, and a locked caller is refused before the credential check.
describe("adminAuth.login", () => {
  const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  afterEach(() => {
    if (ORIGINAL_ADMIN_EMAIL === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL;
  });

  it("lets the designated admin in and clears the lockout counters", async () => {
    process.env.ADMIN_EMAIL = "owner@store.com";
    const { clearFailures } = await import("./_core/login-throttle");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    vi.mocked(clearFailures).mockClear();
    authMod.__login.mockResolvedValueOnce({
      id: "admin-1",
      email: "owner@store.com",
      name: "Owner",
      role: "admin",
    });

    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.adminAuth.login({ email: "owner@store.com", password: "right" });
    expect(res.role).toBe("admin");
    expect(vi.mocked(clearFailures)).toHaveBeenCalledWith([
      "login_account:owner@store.com",
      "login_ip:unknown",
    ]);
  });

  it("refuses a normal customer AT THE DOOR and tears the session down", async () => {
    process.env.ADMIN_EMAIL = "owner@store.com";
    const { recordFailure } = await import("./_core/login-throttle");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    vi.mocked(recordFailure).mockClear();
    // A VALID credential - but for a non-admin account.
    authMod.__login.mockResolvedValueOnce({
      id: "user-1",
      email: "shopper@example.com",
      name: "Shopper",
      role: "user",
    });

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.adminAuth
      .login({ email: "shopper@example.com", password: "right" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    // The message must not reveal whether the account exists or is an admin.
    expect((err as TRPCError).message).not.toMatch(/exist|admin|role|found/i);
    // The attempt counts toward the lockout, so the door cannot be probed.
    const keys = vi.mocked(recordFailure).mock.calls.map((c) => c[0]);
    expect(keys).toContain("login_account:shopper@example.com");
  });

  it("refuses an admin-role account that is NOT the designated address", async () => {
    process.env.ADMIN_EMAIL = "owner@store.com";
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    authMod.__login.mockResolvedValueOnce({
      id: "admin-2",
      email: "other-admin@store.com",
      name: "Other",
      role: "admin",
    });

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.adminAuth
      .login({ email: "other-admin@store.com", password: "right" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  it("answers a bad password with a 401 and records a lockout failure", async () => {
    const { recordFailure } = await import("./_core/login-throttle");
    const { AuthError } = await import("./_core/auth");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    vi.mocked(recordFailure).mockClear();
    authMod.__login.mockRejectedValueOnce(new AuthError("Invalid email or password"));

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.adminAuth
      .login({ email: "owner@store.com", password: "wrong" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    const keys = vi.mocked(recordFailure).mock.calls.map((c) => c[0]);
    expect(keys).toContain("login_account:owner@store.com");
    expect(keys).toContain("login_ip:unknown");
  });

  it("refuses a locked caller before checking the password", async () => {
    const { assertNotLocked } = await import("./_core/login-throttle");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    const { TRPCError: TRPCErrorClass } = await import("@trpc/server");
    vi.mocked(assertNotLocked).mockRejectedValueOnce(
      new TRPCErrorClass({
        code: "TOO_MANY_REQUESTS",
        message: "Too many failed attempts. Please wait a few minutes and try again.",
      }),
    );
    authMod.__login.mockClear();

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.adminAuth
      .login({ email: "owner@store.com", password: "whatever" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    expect(authMod.__login).not.toHaveBeenCalled();
  });

  it("adminAuth.me returns the designated admin, and null for anyone else", async () => {
    process.env.ADMIN_EMAIL = "owner@store.com";
    const designated = {
      c: fakeC,
      db: {} as never,
      user: { id: "admin-1", email: "owner@store.com", role: "admin" } as never,
    };
    expect(await appRouter.createCaller(designated as never).adminAuth.me()).toMatchObject({
      email: "owner@store.com",
    });
    // The `admin` fixture carries no email, so with ADMIN_EMAIL set it is NOT the
    // designated admin - me must be null.
    expect(await appRouter.createCaller(admin as never).adminAuth.me()).toBeNull();
    expect(await appRouter.createCaller(anonymous as never).adminAuth.me()).toBeNull();
  });
});

// ── No self-promotion ────────────────────────────────────────────────────────
// The admin role is granted OUT OF BAND only (a migration / `pnpm admin:create`).
// No public or customer-facing procedure may write it, so a shopper cannot
// escalate themselves by smuggling a `role` field into a normal request.
describe("no self-promotion", () => {
  it("account.updateProfile ignores a role field", async () => {
    const { upsertProfile } = await import("./db");
    vi.mocked(upsertProfile).mockClear();
    const caller = appRouter.createCaller(customer as never);
    await caller.account.updateProfile({ fullName: "Shopper", role: "admin" } as never);
    const passed = vi.mocked(upsertProfile).mock.calls.at(-1)?.[1] as unknown as Record<string, unknown>;
    expect(passed).not.toHaveProperty("role");
    expect(passed).toMatchObject({ fullName: "Shopper" });
  });

  it("auth.signup ignores a role field", async () => {
    const { registerLocalUser } = await import("./_core/auth");
    vi.mocked(registerLocalUser).mockResolvedValueOnce({
      user: { id: "u_new", email: "new@example.com", name: "New", role: "user" },
      verificationToken: "tok",
    } as never);
    const caller = appRouter.createCaller(anonymous as never);
    await caller.auth.signup({
      email: "new@example.com",
      password: "Str0ngPass234",
      name: "New",
      role: "admin",
    } as never);
    const passed = vi.mocked(registerLocalUser).mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;
    expect(passed).not.toHaveProperty("role");
  });
});

// ── Welcome email on signup ──────────────────────────────────────────────────
describe("auth.signup - welcome email", () => {
  it("sends a welcome email to the new account", async () => {
    const { registerLocalUser } = await import("./_core/auth");
    vi.mocked(sendWelcomeEmail).mockClear();
    vi.mocked(registerLocalUser).mockResolvedValueOnce({
      user: { id: "u_welcome", email: "welcome@example.com", name: "Ada", role: "user" },
      verificationToken: "tok",
    } as never);
    const caller = appRouter.createCaller(anonymous as never);
    await caller.auth.signup({
      email: "welcome@example.com",
      password: "Str0ngPass234",
      name: "Ada",
      origin: "https://www.petparcel.store",
    });
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(sendWelcomeEmail).mock.calls.at(-1)?.[0] as {
      email: string;
      name: string;
      shopUrl: string;
      accountUrl: string;
    };
    expect(arg.email).toBe("welcome@example.com");
    expect(arg.name).toBe("Ada");
    expect(arg.shopUrl).toContain("/shop");
    expect(arg.accountUrl).toContain("/account");
  });
});

describe("admin.deleteOrder", () => {
  beforeEach(() => {
    vi.mocked(deleteOrder).mockReset();
    vi.mocked(deleteOrder).mockResolvedValue(true);
  });

  it("rejects an anonymous caller", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.admin.deleteOrder({ id: "order-1" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    expect(deleteOrder).not.toHaveBeenCalled();
  });

  it("rejects a signed-in non-admin", async () => {
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.admin.deleteOrder({ id: "order-1" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect(deleteOrder).not.toHaveBeenCalled();
  });

  it("deletes the order for an admin and reports success", async () => {
    const caller = appRouter.createCaller(admin as never);
    const res = await caller.admin.deleteOrder({ id: "order-1" });
    expect(res).toEqual({ ok: true });
    expect(deleteOrder).toHaveBeenCalledWith("order-1");
  });

  it("answers NOT_FOUND for a stale id rather than silently no-op'ing", async () => {
    vi.mocked(deleteOrder).mockResolvedValue(false);
    const caller = appRouter.createCaller(admin as never);
    const err = await caller.admin.deleteOrder({ id: "gone" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
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

// ── Contact (auth-gated) ─────────────────────────────────────────────────────
// The form requires a signed-in account so no anonymous spam can be submitted
// and every message is linked to a real user id.
describe("contact.submit", () => {
  it("rejects an anonymous caller before touching the database", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.contact
      .submit({ name: "Ada Lovelace", email: "ada@example.com", topic: "Product question", message: "A long enough message." })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    expect(vi.mocked(submitContactMessage)).not.toHaveBeenCalled();
  });

  it("stores the message linked to the signed-in user", async () => {
    const caller = appRouter.createCaller(customer as never);
    const res = await caller.contact.submit({
      name: "Ada Lovelace",
      email: "ada@example.com",
      topic: "Product question",
      message: "A long enough message about a product.",
    });
    expect(res).toEqual({ ok: true });
    expect(submitContactMessage).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", email: "ada@example.com", topic: "Product question" }),
    );
  });
});

// ── Wishlist (auth-gated, per account) ───────────────────────────────────────
describe("wishlist", () => {
  it("rejects an anonymous caller", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.wishlist.list().catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
  });

  it("toggles a product for the signed-in account", async () => {
    const caller = appRouter.createCaller(customer as never);
    const res = await caller.wishlist.toggle({ productId: "prod-1" });
    expect(res).toEqual({ saved: true });
    expect(toggleWishlistItem).toHaveBeenCalledWith("user-1", "prod-1");
  });
});

// ── Checkout ─────────────────────────────────────────────────────────────────
describe("checkout.place", () => {
  it("refuses a guest - there is no guest checkout", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.checkout
      .place({
        email: "buyer@example.com",
        items: [{ slug: "dog-bed", variantId: null, qty: 1 }],
        shippingAddress: {
          fullName: "Ada Lovelace",
          line1: "1 Analytical Way",
          city: "Dallas",
          state: "TX",
          postalCode: "75201",
          country: "US",
        },
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    expect(vi.mocked(createOrder)).not.toHaveBeenCalled();
  });

  it("rejects an empty cart before touching the database", async () => {
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.checkout
      .place({
        email: "buyer@example.com",
        items: [],
        shippingAddress: {
          fullName: "Ada Lovelace",
          line1: "1 Analytical Way",
          city: "Dallas",
          state: "TX",
          postalCode: "75201",
          country: "US",
        },
      })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(vi.mocked(createOrder)).not.toHaveBeenCalled();
  });

  it("accepts an order for a signed-in customer and returns a payment redirect", async () => {
    vi.mocked(createOrder).mockResolvedValueOnce({
      orderNumber: "PP-ABCDEFGH",
      totalCents: 4999,
      currency: "USD",
      email: "buyer@example.com",
    } as never);

    const caller = appRouter.createCaller(customer as never);
    const result = await caller.checkout.place({
      email: "buyer@example.com",
      items: [{ slug: "dog-bed", variantId: null, qty: 1 }],
      shippingAddress: {
        fullName: "Ada Lovelace",
        line1: "1 Analytical Way",
        city: "Dallas",
        state: "TX",
        postalCode: "75201",
        country: "US",
      },
      origin: "https://www.petparcel.store",
    });

    expect(result.orderNumber).toBe("PP-ABCDEFGH");
    expect(result.provider).toBe("bachs");
    expect(result.redirectUrl).toBe("/order/PP-ABCDEFGH");
    // Prices come from the catalog, never from the client payload.
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", email: "buyer@example.com" }),
    );
  });
});

// ── Order confirmation email ────────────────────────────────────────────────
// Placing an order is NOT paying for one. The confirmation email used to be
// sent here, which told a customer "a confirmation email is on its way" for an
// order that was still awaiting payment. It is now gated on a verified payment
// (services/order-receipt.ts), so checkout must NOT send it and must report the
// email as pending payment. The admin alert still fires, so the owner can watch
// an unpaid card checkout and chase it.
describe("checkout.place - does NOT send the confirmation email", () => {
  it("reports the confirmation as pending payment and never sends a receipt", async () => {
    vi.mocked(sendPaidReceiptOnce).mockClear();
    vi.mocked(createOrder).mockResolvedValueOnce({
      id: "order-1",
      orderNumber: "PP-EMAIL001",
      totalCents: 4999,
      currency: "USD",
      email: "buyer@example.com",
    } as never);
    vi.mocked(getOrderDetail).mockResolvedValueOnce({
      order: {
        id: "order-1",
        orderNumber: "PP-EMAIL001",
        email: "buyer@example.com",
        currency: "USD",
        subtotalCents: 4999,
        shippingCents: 0,
        taxCents: 0,
        totalCents: 4999,
        shippingAddress: { fullName: "Ada Lovelace" },
      },
      items: [{ nameSnapshot: "Dog Bed", variantSnapshot: null, qty: 1, priceCents: 4999, imageUrl: null }],
      events: [],
    } as never);

    const caller = appRouter.createCaller(customer as never);
    const result = await caller.checkout.place({
      email: "buyer@example.com",
      items: [{ slug: "dog-bed", variantId: null, qty: 1 }],
      shippingAddress: {
        fullName: "Ada Lovelace",
        line1: "1 Analytical Way",
        city: "Dallas",
        state: "TX",
        postalCode: "75201",
        country: "US",
      },
      origin: "https://www.petparcel.store",
    });

    // The receipt is NOT sent at checkout - only the admin alert is.
    expect(sendPaidReceiptOnce).not.toHaveBeenCalled();
    expect(result.emailStatus).toBe("pending_payment");
    expect(result.adminEmailStatus).toBe("skipped");
  });
});

// ── Shipping notification email ─────────────────────────────────────────────
describe("admin.setTracking - shipping notification", () => {
  const shippedOrder = {
    order: {
      id: "order-1",
      orderNumber: "PP-SHIP001",
      email: "buyer@example.com",
      status: "paid",
      currency: "USD",
      subtotalCents: 4999,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 4999,
      shippingAddress: { fullName: "Ada Lovelace" },
      carrier: null,
      trackingNumber: null,
    },
    items: [],
    events: [],
  };

  it("fires when an unshipped order gains a tracking number", async () => {
    vi.mocked(getOrderDetail)
      .mockResolvedValueOnce(shippedOrder as never) // the pre-write read
      .mockResolvedValueOnce(shippedOrder as never); // the post-write read
    vi.mocked(updateOrderTracking).mockResolvedValue({
      order: {
        ...shippedOrder.order,
        carrier: "USPS",
        trackingNumber: "9400111899223857182",
        status: "shipped",
      },
      items: [],
      events: [],
    } as never);

    const caller = appRouter.createCaller(admin as never);
    const result = await caller.admin.setTracking({
      id: "order-1",
      trackingNumber: "9400111899223857182",
      carrier: "USPS",
      markShipped: true,
      origin: "https://www.petparcel.store",
    });

    expect(sendShippingNotification).toHaveBeenCalledTimes(1);
    expect(result.emailStatus).toBe("skipped");
  });

  it("does NOT re-email an order that had already shipped", async () => {
    vi.mocked(sendShippingNotification).mockClear();
    // Reset the per-call queues from the previous case so the pre-write read is
    // deterministic, then pin the shipped state it must observe.
    vi.mocked(getOrderDetail).mockReset();
    vi.mocked(updateOrderTracking).mockReset();
    const alreadyShipped = {
      ...shippedOrder,
      order: { ...shippedOrder.order, status: "shipped", trackingNumber: "OLD123" },
    };
    vi.mocked(getOrderDetail).mockResolvedValue(alreadyShipped as never);
    vi.mocked(updateOrderTracking).mockResolvedValue(alreadyShipped as never);

    const caller = appRouter.createCaller(admin as never);
    const result = await caller.admin.setTracking({
      id: "order-1",
      trackingNumber: "NEW456",
      carrier: "UPS",
      markShipped: true,
      origin: "https://www.petparcel.store",
    });

    expect(sendShippingNotification).not.toHaveBeenCalled();
    expect(result.emailStatus).toBeNull();
  });
});

// ── Reviews: verified purchase + pending-until-approved ──────────────────────
describe("reviews.create", () => {
  it("refuses a customer with no settled order for the product", async () => {
    vi.mocked(findPurchasedOrderForProduct).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.reviews
      .create({ productId: "prod-1", rating: 5, body: "Great bed, dog loves it." })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect(vi.mocked(createReview)).not.toHaveBeenCalled();
  });

  it("accepts a verified buyer and stores the review as pending", async () => {
    vi.mocked(findPurchasedOrderForProduct).mockResolvedValueOnce("order-9");
    vi.mocked(hasReviewedProduct).mockResolvedValueOnce(false);
    vi.mocked(createReview).mockResolvedValueOnce({ id: "rev-1", status: "pending" } as never);

    const caller = appRouter.createCaller(customer as never);
    await caller.reviews.create({ productId: "prod-1", rating: 5, body: "Great bed, dog loves it." });

    expect(createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod-1",
        userId: "user-1",
        orderId: "order-9",
        verified: true,
      }),
    );
  });

  it("refuses a second review of the same product", async () => {
    vi.mocked(findPurchasedOrderForProduct).mockResolvedValueOnce("order-9");
    vi.mocked(hasReviewedProduct).mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.reviews
      .create({ productId: "prod-1", rating: 4, body: "Reviewing it twice here." })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("CONFLICT");
  });

  it("requires a session", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.reviews
      .create({ productId: "prod-1", rating: 5, body: "Great bed, dog loves it." })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
  });
});

describe("reviews.canReview", () => {
  it("reports not_purchased for a non-buyer", async () => {
    vi.mocked(findPurchasedOrderForProduct).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(customer as never);
    expect(await caller.reviews.canReview({ productId: "prod-1" })).toEqual({
      canReview: false,
      reason: "not_purchased",
    });
  });

  it("reports already_reviewed once a review exists", async () => {
    vi.mocked(findPurchasedOrderForProduct).mockResolvedValueOnce("order-9");
    vi.mocked(hasReviewedProduct).mockResolvedValueOnce(true);
    const caller = appRouter.createCaller(customer as never);
    expect(await caller.reviews.canReview({ productId: "prod-1" })).toEqual({
      canReview: false,
      reason: "already_reviewed",
    });
  });

  it("allows a verified buyer who has not reviewed yet", async () => {
    vi.mocked(findPurchasedOrderForProduct).mockResolvedValueOnce("order-9");
    vi.mocked(hasReviewedProduct).mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(customer as never);
    expect(await caller.reviews.canReview({ productId: "prod-1" })).toEqual({
      canReview: true,
      reason: null,
    });
  });
});

describe("admin review moderation", () => {
  it("is admin-only", async () => {
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.admin
      .setReviewStatus({ id: "rev-1", status: "approved" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  it("lets an admin approve a pending review", async () => {
    const caller = appRouter.createCaller(admin as never);
    await caller.admin.setReviewStatus({ id: "rev-1", status: "approved" });
    expect(setReviewStatus).toHaveBeenCalledWith("rev-1", "approved");
  });
});

// ── admin: categories, messages and newsletter (real-DB CRUD) ────────────────
describe("admin.categories", () => {
  it("is admin-only on every operation", async () => {
    const anon = await appRouter.createCaller(anonymous as never).admin.categories().catch((e) => e);
    expect((anon as TRPCError).code).toBe("UNAUTHORIZED");
    const cust = await appRouter.createCaller(customer as never).admin.categories().catch((e) => e);
    expect((cust as TRPCError).code).toBe("FORBIDDEN");
    const custWrite = await appRouter
      .createCaller(customer as never)
      .admin.createCategory({ name: "Cats" })
      .catch((e) => e);
    expect((custWrite as TRPCError).code).toBe("FORBIDDEN");
  });

  it("lists the real categories with their live product counts", async () => {
    vi.mocked(listCategories).mockResolvedValue([
      {
        id: "cat-1",
        name: "Dogs",
        slug: "dogs",
        description: "",
        featured: false,
        sortOrder: 0,
        productCount: 3,
        parentId: null,
        children: [],
      },
    ] as never);
    const rows = await appRouter.createCaller(admin as never).admin.categories();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Dogs", productCount: 3 });
  });

  it("rejects a blank name before it reaches the database", async () => {
    vi.mocked(createCategory).mockClear();
    const err = await appRouter
      .createCaller(admin as never)
      .admin.createCategory({ name: "   " })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("creates a category and returns the stored row", async () => {
    vi.mocked(createCategory).mockResolvedValue({ id: "cat-2", name: "Cats", slug: "cats" } as never);
    const row = await appRouter
      .createCaller(admin as never)
      .admin.createCategory({ name: "Cats", sortOrder: 1 });
    expect(createCategory).toHaveBeenCalledWith(expect.objectContaining({ name: "Cats", sortOrder: 1 }));
    expect(row).toMatchObject({ id: "cat-2", name: "Cats" });
  });

  it("re-points products when a category is renamed", async () => {
    vi.mocked(getCategoryById).mockResolvedValue({ id: "cat-1", name: "Dogs" } as never);
    vi.mocked(listCategories).mockResolvedValue([
      { id: "cat-1", name: "Dogs", slug: "dogs", productCount: 3, parentId: null, children: [] },
    ] as never);
    vi.mocked(updateCategory).mockResolvedValue({ id: "cat-1", name: "Dogs & Puppies", slug: "dogs-puppies" } as never);
    const row = await appRouter
      .createCaller(admin as never)
      .admin.updateCategory({ id: "cat-1", name: "Dogs & Puppies" });
    expect(updateCategory).toHaveBeenCalledWith(
      "cat-1",
      expect.objectContaining({ name: "Dogs & Puppies" }),
    );
    expect(row).toMatchObject({ name: "Dogs & Puppies" });
  });

  it("refuses to rename onto a name another category already uses", async () => {
    vi.mocked(getCategoryById).mockResolvedValue({ id: "cat-1", name: "Dogs" } as never);
    vi.mocked(listCategories).mockResolvedValue([
      { id: "cat-2", name: "Cats", slug: "cats", productCount: 1, parentId: null, children: [] },
    ] as never);
    vi.mocked(updateCategory).mockClear();
    const err = await appRouter
      .createCaller(admin as never)
      .admin.updateCategory({ id: "cat-1", name: "Cats" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("CONFLICT");
    expect(updateCategory).not.toHaveBeenCalled();
  });

  it("refuses to delete a category that still holds products", async () => {
    vi.mocked(getCategoryById).mockResolvedValue({ id: "cat-1", name: "Dogs" } as never);
    vi.mocked(countProductsInCategory).mockResolvedValue(4);
    vi.mocked(deleteCategory).mockClear();
    const err = await appRouter
      .createCaller(admin as never)
      .admin.deleteCategory({ id: "cat-1" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("CONFLICT");
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("deletes an empty category", async () => {
    vi.mocked(getCategoryById).mockResolvedValue({ id: "cat-9", name: "Empty", parentId: null } as never);
    vi.mocked(countProductsInCategory).mockResolvedValue(0);
    vi.mocked(listChildCategoryNames).mockResolvedValue([]);
    const res = await appRouter.createCaller(admin as never).admin.deleteCategory({ id: "cat-9" });
    expect(deleteCategory).toHaveBeenCalledWith("cat-9");
    expect(res).toEqual({ ok: true });
  });

  it("refuses to delete a category that still has subcategories", async () => {
    // Deleting it would silently promote a whole branch to top level (the FK is
    // `set null`), which is a surprising side effect of one click.
    vi.mocked(getCategoryById).mockResolvedValue({ id: "cat-1", name: "Pet Toys", parentId: null } as never);
    vi.mocked(countProductsInCategory).mockResolvedValue(0);
    vi.mocked(listChildCategoryNames).mockResolvedValue(["Pet Chew Toys", "Pet Plush Toys"]);
    vi.mocked(deleteCategory).mockClear();
    const err = await appRouter
      .createCaller(admin as never)
      .admin.deleteCategory({ id: "cat-1" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("CONFLICT");
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("files a subcategory under its parent aisle", async () => {
    vi.mocked(getCategoryById).mockResolvedValue({ id: "cat-toys", name: "Pet Toys", parentId: null } as never);
    vi.mocked(createCategory).mockResolvedValue({ id: "cat-chew", name: "Pet Chew Toys" } as never);
    const row = await appRouter
      .createCaller(admin as never)
      .admin.createCategory({ name: "Pet Chew Toys", parentId: "cat-toys" });
    expect(createCategory).toHaveBeenCalledWith(expect.objectContaining({ parentId: "cat-toys" }));
    expect(row).toMatchObject({ id: "cat-chew" });
  });

  it("refuses to nest a subcategory further (the tree is two levels)", async () => {
    // A parent that is itself a subcategory would be invisible in every browse
    // surface, so the write is refused rather than stored.
    vi.mocked(getCategoryById).mockResolvedValue({ id: "cat-chew", name: "Pet Chew Toys", parentId: "cat-toys" } as never);
    vi.mocked(createCategory).mockClear();
    const err = await appRouter
      .createCaller(admin as never)
      .admin.createCategory({ name: "Pet Chew Balls", parentId: "cat-chew" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("refuses to file a category under its own subcategory", async () => {
    vi.mocked(getCategoryById).mockResolvedValue({ id: "cat-toys", name: "Pet Toys", parentId: null } as never);
    vi.mocked(listChildCategoryNames).mockResolvedValue(["Pet Chew Toys"]);
    vi.mocked(updateCategory).mockClear();
    const err = await appRouter
      .createCaller(admin as never)
      .admin.updateCategory({ id: "cat-toys", name: "Pet Toys", parentId: "cat-chew" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(updateCategory).not.toHaveBeenCalled();
  });
});

describe("admin.messages + newsletter triage", () => {
  it("requires an admin session", async () => {
    const err = await appRouter.createCaller(customer as never).admin.messages().catch((e) => e);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  it("reads the message inbox from the database", async () => {
    vi.mocked(listContactMessages).mockResolvedValue([
      { id: "m-1", name: "Ada", email: "ada@example.com", topic: "Q", message: "hi", status: "new" },
    ] as never);
    const rows = await appRouter.createCaller(admin as never).admin.messages();
    expect(rows[0]).toMatchObject({ id: "m-1", status: "new" });
  });

  it("moves a message's status and returns the updated row", async () => {
    vi.mocked(setContactMessageStatus).mockResolvedValue({ id: "m-1", status: "read" } as never);
    const row = await appRouter.createCaller(admin as never).admin.setMessageStatus({ id: "m-1", status: "read" });
    expect(setContactMessageStatus).toHaveBeenCalledWith("m-1", "read");
    expect(row).toMatchObject({ status: "read" });
  });

  it("rejects an unknown message status", async () => {
    const err = await appRouter
      .createCaller(admin as never)
      .admin.setMessageStatus({ id: "m-1", status: "banana" } as never)
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
  });

  it("suppresses a subscriber without deleting the record", async () => {
    vi.mocked(setNewsletterSubscriberStatus).mockResolvedValue({
      id: "s-1",
      email: "x@y.co",
      status: "unsubscribed",
    } as never);
    const row = await appRouter
      .createCaller(admin as never)
      .admin.setSubscriberStatus({ id: "s-1", status: "unsubscribed" });
    expect(setNewsletterSubscriberStatus).toHaveBeenCalledWith("s-1", "unsubscribed");
    expect(row).toMatchObject({ status: "unsubscribed" });
  });
});

// ── Newsletter delete + server-side pagination ───────────────────────────────
// The delete is the panel's only way to remove a random, spam or fake address.
// Its contract is pinned here: admin-only ON THE SERVER, a real DELETE of the id
// that was named, and an honest NOT_FOUND when the id matches nothing - a second
// delete of the same id must not report a success that did not happen.
describe("admin newsletter - delete and pagination", () => {
  it("refuses a non-admin caller, before the database is touched", async () => {
    vi.mocked(deleteNewsletterSubscriber).mockClear();
    const err = await appRouter
      .createCaller(customer as never)
      .admin.deleteSubscriber({ id: "s-1" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect(deleteNewsletterSubscriber).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller", async () => {
    // Anonymous never even reaches the admin gate: `adminProcedure` extends
    // `protectedProcedure`, so a missing session is UNAUTHORIZED (there is no
    // caller to be forbidden) while a signed-in non-admin is FORBIDDEN.
    const err = await appRouter
      .createCaller(anonymous as never)
      .admin.deleteSubscriber({ id: "s-1" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
  });

  it("deletes the subscriber that was named, and reports it", async () => {
    vi.mocked(deleteNewsletterSubscriber).mockResolvedValue(true);
    const res = await appRouter.createCaller(admin as never).admin.deleteSubscriber({ id: "s-1" });
    expect(deleteNewsletterSubscriber).toHaveBeenCalledWith("s-1");
    expect(res).toEqual({ ok: true, id: "s-1" });
  });

  it("answers NOT_FOUND for an id that matched nothing, and never claims success", async () => {
    vi.mocked(deleteNewsletterSubscriber).mockResolvedValue(false);
    const err = await appRouter
      .createCaller(admin as never)
      .admin.deleteSubscriber({ id: "gone" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
  });

  it("rejects a blank id before touching the database", async () => {
    vi.mocked(deleteNewsletterSubscriber).mockClear();
    const err = await appRouter
      .createCaller(admin as never)
      .admin.deleteSubscriber({ id: "" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(deleteNewsletterSubscriber).not.toHaveBeenCalled();
  });

  it("serves the first page at the default size when asked for nothing", async () => {
    await appRouter.createCaller(admin as never).admin.newsletter();
    expect(listNewsletterSubscribersPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25, offset: 0, limit: 25 }),
      "",
    );
  });

  it("passes the offset the page implies, plus the search term", async () => {
    await appRouter
      .createCaller(admin as never)
      .admin.newsletter({ page: 2, pageSize: 50, search: "spam" });
    expect(listNewsletterSubscribersPage).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 50, offset: 50, limit: 50 }),
      "spam",
    );
  });

  it("clamps an oversized page request rather than honouring it", async () => {
    await appRouter
      .createCaller(admin as never)
      .admin.newsletter({ page: 1, pageSize: 100_000 });
    expect(listNewsletterSubscribersPage).toHaveBeenCalledWith(
      expect.objectContaining({ pageSize: 100, limit: 100 }),
      "",
    );
  });

  it("is admin-only for reading the list too", async () => {
    const err = await appRouter
      .createCaller(customer as never)
      .admin.newsletter()
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });
});

describe("admin image upload", () => {
  it("rejects a non-image content type before touching storage", async () => {
    const caller = appRouter.createCaller(admin as never);
    const err = await caller.admin
      .uploadImage({ filename: "invoice.pdf", contentType: "application/pdf" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
  });

  it("is admin-only", async () => {
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.admin
      .uploadImage({ filename: "bed.png", contentType: "image/png" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
  });

  it("maps unconfigured storage to a message an admin can act on", async () => {
    // Storage env vars are absent in the test runner, so the real _core module
    // throws StorageError("not_configured") - which must NOT surface as a 500.
    const caller = appRouter.createCaller(admin as never);
    const err = await caller.admin
      .uploadImage({ filename: "bed.png", contentType: "image/png" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("PRECONDITION_FAILED");
    expect((err as TRPCError).message).toContain("storage");
  });
});

// ── Category reads ───────────────────────────────────────────────────────────
// A regression guard. The categories endpoint and the product grid have to agree:
// if `categories` is read from its own query, it can name an aisle that
// `catalog.list` returns nothing for (the taxonomy was renamed in code but the
// rows still carry the old name), and the storefront then advertises a category
// that filters down to an empty grid.
const seedProduct = (id: string, category: string) => ({
  id,
  name: `Item ${id}`,
  slug: `item-${id}`,
  category,
  variants: [],
  rating: null,
  reviewCount: 0,
});

describe("catalog.categories", () => {
  /** A `listCategories()` row, in the two-level tree shape the endpoint serves. */
  const seedCategory = (id: string, name: string, productCount: number, children: unknown[] = []) => ({
    id,
    name,
    slug: name.toLowerCase(),
    description: "",
    productCount,
    parentId: null,
    featured: false,
    sortOrder: 0,
    children,
  });

  it("serves the browse tree with each aisle's subcategories", async () => {
    vi.mocked(listCategories).mockResolvedValueOnce([
      seedCategory("cat-toys", "Pet Toys", 5, [
        { id: "cat-chew", name: "Pet Chew Toys", slug: "pet-chew-toys", description: "", productCount: 2, featured: false, sortOrder: 0 },
      ]),
    ] as never);
    vi.mocked(listProducts).mockResolvedValueOnce([] as never);
    const caller = appRouter.createCaller(anonymous as never);
    const nodes = await caller.catalog.categories();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].name).toBe("Pet Toys");
    expect(nodes[0].children.map((c) => c.name)).toEqual(["Pet Chew Toys"]);
  });

  it("surfaces a LIVE aisle the tree has no row for, so no product is unreachable", async () => {
    // A product filed on a legacy name the `categories` table does not know
    // still needs a tile that filters to it.
    vi.mocked(listCategories).mockResolvedValueOnce([] as never);
    vi.mocked(listProducts).mockResolvedValueOnce([
      seedProduct("4", "Legacy Aisle"),
      seedProduct("5", "Legacy Aisle"),
    ] as never);
    const caller = appRouter.createCaller(anonymous as never);
    const nodes = await caller.catalog.categories();
    expect(nodes.map((n) => n.name)).toEqual(["Legacy Aisle"]);
    expect(nodes[0]).toMatchObject({ productCount: 2, children: [] });
  });

  it("leads with the aisles that actually carry stock", async () => {
    // The browse taxonomy is the store's target shelf set, not its current
    // stock, so an aisle with products must not be hidden behind empty ones.
    vi.mocked(listCategories).mockResolvedValueOnce([
      seedCategory("cat-empty", "Bird Supplies", 0),
      seedCategory("cat-toys", "Pet Toys", 3),
    ] as never);
    vi.mocked(listProducts).mockResolvedValueOnce([] as never);
    const caller = appRouter.createCaller(anonymous as never);
    const nodes = await caller.catalog.categories();
    expect(nodes.map((n) => n.name)).toEqual(["Pet Toys", "Bird Supplies"]);
  });

  it("reports live stock per category for the condensed menus", async () => {
    vi.mocked(listProducts).mockResolvedValueOnce([
      seedProduct("1", "Toys"),
      seedProduct("2", "Toys"),
      seedProduct("3", "Birds"),
    ] as never);
    const caller = appRouter.createCaller(anonymous as never);
    expect(await caller.catalog.categoryCounts()).toEqual({ Toys: 2, Birds: 1 });
  });
});

// ── No fallback / demo data ──────────────────────────────────────────────────
// The storefront must show the REAL catalogue or an honest error - never a
// bundled demo catalogue. These guard the two ways that used to happen: a
// database error was swallowed and demo rows served, and an empty result was
// silently replaced with demo rows.
describe("catalog reads never fall back to demo data", () => {
  it("fails loudly (not with demo products) when the database is unreachable", async () => {
    vi.mocked(listProducts).mockRejectedValueOnce(
      Object.assign(new Error("getaddrinfo ENOTFOUND ep-cold-pooler.neon.tech"), {
        code: "ENOTFOUND",
      }) as never,
    );
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.catalog.list({}).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
    // A short, leak-free message - no host, no SQL, no driver text.
    expect((err as TRPCError).message).not.toMatch(/ENOTFOUND|neon|select|relation/i);
  });

  it("returns an empty list (not demo products) when the catalogue is genuinely empty", async () => {
    vi.mocked(listProducts).mockResolvedValueOnce([] as never);
    const caller = appRouter.createCaller(anonymous as never);
    expect(await caller.catalog.list({})).toEqual([]);
  });
});

// ── Signup resilience ────────────────────────────────────────────────────────
// The account write is the real signup; establishing the session is a separate,
// best-effort step. A deployment missing JWT_SECRET used to turn a SUCCESSFUL
// account creation into a misleading 500 - the shopper was told signup failed
// while their account actually existed.
describe("auth.signup", () => {
  it("creates the account and reports signedIn:false when the session cannot be established", async () => {
    const { registerLocalUser } = await import("./_core/auth");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    vi.mocked(registerLocalUser).mockResolvedValueOnce({
      user: { id: "u_new", email: "new@example.com", name: "New", role: "user" },
      verificationToken: "tok",
    } as never);
    authMod.__login.mockRejectedValueOnce(new Error("Missing required env var: JWT_SECRET"));

    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.auth.signup({
      email: "new@example.com",
      password: "Str0ngPass234",
      name: "New",
    });
    expect(res.signedIn).toBe(false);
    expect(res.email).toBe("new@example.com");
  });

  it("reports signedIn:true on the normal path", async () => {
    const { registerLocalUser } = await import("./_core/auth");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    vi.mocked(registerLocalUser).mockResolvedValueOnce({
      user: { id: "u_ok", email: "ok@example.com", name: "Ok", role: "user" },
      verificationToken: "tok",
    } as never);
    authMod.__login.mockResolvedValueOnce(undefined);

    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.auth.signup({
      email: "ok@example.com",
      password: "Str0ngPass234",
      name: "Ok",
    });
    expect(res.signedIn).toBe(true);
  });

  // The bug this pins: a request with no `Origin` header made Neon Auth answer
  // 400 MISSING_ORIGIN, which the router rethrew as an unknown error and tRPC
  // turned into an opaque 500. It is the CALLER's request that is unusable, so
  // it must be a 400 - and the provider's raw text must not reach the shopper.
  it("answers 400 (not 500) when Neon Auth refuses the request's Origin", async () => {
    const { authProviderUsesNeon, registerNeonUser } = await import("./_core/auth");
    const { NeonAuthOriginError } = await import("./_core/neon-auth");
    vi.mocked(authProviderUsesNeon).mockReturnValueOnce(true);
    vi.mocked(registerNeonUser).mockRejectedValueOnce(
      new NeonAuthOriginError(
        "Origin header is required when callbackURL is not an absolute URL",
        "MISSING_ORIGIN",
        400,
      ),
    );

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth
      .signup({ email: "no-origin@example.com", password: "Str0ngPass234", name: "No" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect((err as TRPCError).message).not.toMatch(/neon|origin header|MISSING_ORIGIN|INVALID_ORIGIN/i);
  });
});

// ── Login / signup throttle wiring ───────────────────────────────────────────
// The counting itself lives in _core/login-throttle.ts (covered by its own
// test); here we pin the ROUTER's contract: which keys are checked, that a bad
// password records a failure for BOTH the account and the IP, that a success
// clears them, and that a locked caller is refused with a non-enumerating 429.
describe("auth.login throttle wiring", () => {
  it("records a failure for the account AND the IP on a bad password", async () => {
    const { recordFailure, clearFailures } = await import("./_core/login-throttle");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    const { AuthError } = await import("./_core/auth");
    vi.mocked(recordFailure).mockClear();
    vi.mocked(clearFailures).mockClear();
    authMod.__login.mockRejectedValueOnce(new AuthError("Invalid email or password"));

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth
      .login({ email: "victim@example.com", password: "wrong" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    expect((err as TRPCError).message).toBe("Invalid email or password");
    const keys = vi.mocked(recordFailure).mock.calls.map((c) => c[0]);
    expect(keys).toContain("login_account:victim@example.com");
    expect(keys).toContain("login_ip:unknown");
    expect(vi.mocked(clearFailures)).not.toHaveBeenCalled();
  });

  it("clears both counters on a successful sign-in", async () => {
    const { clearFailures } = await import("./_core/login-throttle");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    vi.mocked(clearFailures).mockClear();
    authMod.__login.mockResolvedValueOnce({ id: "u1", email: "ok@example.com", name: "Ok", role: "user" });

    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.auth.login({ email: "ok@example.com", password: "right" });
    expect(res.email).toBe("ok@example.com");
    expect(vi.mocked(clearFailures)).toHaveBeenCalledWith([
      "login_account:ok@example.com",
      "login_ip:unknown",
    ]);
  });

  it("refuses a locked caller with a non-enumerating 429 before checking the password", async () => {
    const { assertNotLocked } = await import("./_core/login-throttle");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    const { TRPCError: TRPCErrorClass } = await import("@trpc/server");
    vi.mocked(assertNotLocked).mockRejectedValueOnce(
      new TRPCErrorClass({ code: "TOO_MANY_REQUESTS", message: "Too many failed attempts. Please wait a few minutes and try again." }),
    );
    authMod.__login.mockClear();

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth
      .login({ email: "locked@example.com", password: "whatever" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    // The message must not reveal whether the account exists.
    expect((err as TRPCError).message).not.toMatch(/exist|found|account|email/i);
    // The credential check must not even run for a locked caller.
    expect(authMod.__login).not.toHaveBeenCalled();
  });

  // A missing/untrusted Origin is the provider refusing the REQUEST, not a bad
  // password: it must be a 400, and it must NOT be counted as a failed
  // credential (which would lock a legitimate shopper out of their own account).
  it("answers 400 (not 401) when Neon Auth refuses the request's Origin", async () => {
    const { recordFailure } = await import("./_core/login-throttle");
    const authMod = (await import("./_core/auth")) as unknown as { __login: ReturnType<typeof vi.fn> };
    const { NeonAuthOriginError } = await import("./_core/neon-auth");
    vi.mocked(recordFailure).mockClear();
    authMod.__login.mockRejectedValueOnce(
      new NeonAuthOriginError("Invalid origin", "INVALID_ORIGIN", 403),
    );

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth
      .login({ email: "no-origin@example.com", password: "whatever" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(vi.mocked(recordFailure)).not.toHaveBeenCalled();
  });
});

describe("auth.signup throttle wiring", () => {
  it("records a failure against the signup IP when the address is taken", async () => {
    const { recordFailure } = await import("./_core/login-throttle");
    const { registerLocalUser, EmailTakenError } = await import("./_core/auth");
    vi.mocked(recordFailure).mockClear();
    vi.mocked(registerLocalUser).mockRejectedValueOnce(new EmailTakenError("taken"));

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth
      .signup({ email: "dup@example.com", password: "Str0ngPass234", name: "Dup" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("CONFLICT");
    expect(vi.mocked(recordFailure).mock.calls.map((c) => c[0])).toContain("signup_ip:unknown");
  });
});

describe("auth google sign-in", () => {
  // Both procedures require Neon Auth as the active provider.
  beforeEach(async () => {
    const { authProviderUsesNeon } = await import("./_core/auth");
    vi.mocked(authProviderUsesNeon).mockReturnValue(true);
  });
  afterEach(async () => {
    const { authProviderUsesNeon } = await import("./_core/auth");
    vi.mocked(authProviderUsesNeon).mockReturnValue(false);
  });

  it("start hands back the provider's authorize URL and its base URL for the callback", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.auth.googleSignInStart();
    // The browser is sent to the provider's own authorize endpoint...
    expect(res.url).toContain("accounts.google.com");
    // ...and the callback is told where the provider lives, because the session
    // it creates is a cookie on THAT origin which our JS cannot read. Only the
    // public base URL is disclosed - the address the browser is about to visit.
    expect(res.providerBaseUrl).toBe("https://auth.example.test/neondb/auth");
  });

  it("start sends the provider a callback on this site's own /auth/callback path", async () => {
    const { googleSignInStart } = await import("./_core/auth");
    vi.mocked(googleSignInStart).mockClear();
    const caller = appRouter.createCaller(anonymous as never);
    await caller.auth.googleSignInStart();
    expect(vi.mocked(googleSignInStart).mock.calls[0][1]).toBe(
      "https://petparcel.vercel.app/auth/callback",
    );
  });

  it("start parks the provider's OAuth challenge on our own origin", async () => {
    const { setOAuthChallengeCookie } = await import("./_core/auth");
    vi.mocked(setOAuthChallengeCookie).mockClear();
    const caller = appRouter.createCaller(anonymous as never);
    await caller.auth.googleSignInStart();
    // The challenge is what the verifier exchange needs; without it parked here
    // the callback can never complete (the provider's own copy is partitioned to
    // its origin and never comes back).
    expect(vi.mocked(setOAuthChallengeCookie)).toHaveBeenCalledWith(expect.anything(), "challenge-value");
  });

  it("start answers 400 (not 500) when the provider refuses to start the flow", async () => {
    const { googleSignInStart, AuthError } = await import("./_core/auth");
    vi.mocked(googleSignInStart).mockRejectedValueOnce(
      new AuthError("Google sign-in is not available right now. Please try again."),
    );
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth.googleSignInStart().catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect((err as TRPCError).message).not.toMatch(/neon|stack|http/i);
  });

  it("complete bridges the account and never echoes the session token back", async () => {
    const { loginViaGoogleVerifier } = await import("./_core/auth");
    vi.mocked(loginViaGoogleVerifier).mockResolvedValueOnce({
      id: "u_google",
      email: "shopper@example.com",
      name: "Shopper",
      role: "user",
    });

    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.auth.googleSignInComplete({ verifier: "provider-session-verifier" });
    expect(res.ok).toBe(true);
    expect(res.user).toEqual({ id: "u_google", email: "shopper@example.com", role: "user" });
    // The verifier is a credential: it must not come back in the response body.
    expect(JSON.stringify(res)).not.toContain("provider-session-verifier");
  });

  it("complete answers 401 (not 500) when the provider session cannot be verified", async () => {
    const { loginViaGoogleVerifier, AuthError } = await import("./_core/auth");
    vi.mocked(loginViaGoogleVerifier).mockRejectedValueOnce(
      new AuthError("That sign-in could not be completed. Please try again."),
    );
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth
      .googleSignInComplete({ verifier: "forged-provider-verifier" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
  });

  it("complete answers 401 with a start-again message when the challenge cookie is gone", async () => {
    const { readOAuthChallengeCookie, loginViaGoogleVerifier } = await import("./_core/auth");
    vi.mocked(readOAuthChallengeCookie).mockReturnValueOnce(null);
    vi.mocked(loginViaGoogleVerifier).mockClear();
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth
      .googleSignInComplete({ verifier: "some-verifier-value" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    expect((err as TRPCError).message).toMatch(/expired|start again/i);
    expect(vi.mocked(loginViaGoogleVerifier)).not.toHaveBeenCalled();
  });

  it("complete rejects an implausibly short verifier before touching the provider", async () => {
    const { loginViaGoogleVerifier } = await import("./_core/auth");
    vi.mocked(loginViaGoogleVerifier).mockClear();
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth.googleSignInComplete({ verifier: "short" }).catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(vi.mocked(loginViaGoogleVerifier)).not.toHaveBeenCalled();
  });
});

describe("auth password reset", () => {
  beforeEach(async () => {
    const { authProviderUsesNeon } = await import("./_core/auth");
    vi.mocked(authProviderUsesNeon).mockReturnValue(true);
  });
  afterEach(async () => {
    const { authProviderUsesNeon } = await import("./_core/auth");
    vi.mocked(authProviderUsesNeon).mockReturnValue(false);
  });

  it("request answers ok without revealing whether the address exists", async () => {
    const { neonAuthRequestPasswordReset } = await import("./_core/neon-auth");
    vi.mocked(neonAuthRequestPasswordReset).mockClear();
    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.auth.requestPasswordReset({ email: "shopper@example.com" });
    expect(res.ok).toBe(true);
    // The provider is asked with a redirect back to OUR reset page.
    expect(vi.mocked(neonAuthRequestPasswordReset).mock.calls[0][0].redirectTo).toBe(
      "https://petparcel.vercel.app/reset-password",
    );
  });

  it("request still answers ok when the provider call fails (no enumeration)", async () => {
    const { neonAuthRequestPasswordReset } = await import("./_core/neon-auth");
    vi.mocked(neonAuthRequestPasswordReset).mockRejectedValueOnce(new Error("boom"));
    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.auth.requestPasswordReset({ email: "shopper@example.com" });
    expect(res.ok).toBe(true);
  });

  it("reset completes with a valid token", async () => {
    const { neonAuthResetPassword } = await import("./_core/neon-auth");
    vi.mocked(neonAuthResetPassword).mockClear();
    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.auth.resetPassword({ token: "reset-token", newPassword: "new-password-1" });
    expect(res.ok).toBe(true);
    expect(vi.mocked(neonAuthResetPassword).mock.calls[0][0].token).toBe("reset-token");
  });

  it("reset answers 400 (not 500) on an invalid or expired token", async () => {
    const { neonAuthResetPassword } = await import("./_core/neon-auth");
    vi.mocked(neonAuthResetPassword).mockRejectedValueOnce(new Error("INVALID_TOKEN"));
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.auth
      .resetPassword({ token: "bad-token", newPassword: "new-password-1" })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect((err as TRPCError).message).toMatch(/invalid|expired/i);
  });
});

// ── Admin product CRUD + storefront visibility ───────────────────────────────
// The admin panel is a REAL CRUD: every action goes through these tRPC
// procedures to the database, and the storefront reads the same rows live. These
// tests pin the two contracts that make that true - the admin read INCLUDES
// hidden products while the storefront read EXCLUDES them, and create/update/
// delete reach the data layer with the right arguments.
describe("admin product CRUD", () => {
  const productRow = {
    id: "prod-1",
    name: "Test Bed",
    slug: "test-bed",
    description: "",
    category: "Pet Bedding",
    priceCents: 2999,
    compareAtCents: null,
    images: [],
    media: [],
    tags: [],
    specs: {},
    active: true,
    featured: false,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.mocked(createProduct).mockReset();
    vi.mocked(updateProduct).mockReset();
    vi.mocked(deleteProduct).mockReset();
    vi.mocked(listProducts).mockReset();
    vi.mocked(listProducts).mockResolvedValue([]);
  });

  it("rejects an anonymous caller from creating a product", async () => {
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.admin
      .createProduct({ name: "X", category: "Dogs", priceCents: 100 })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("rejects a signed-in non-admin from creating a product", async () => {
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.admin
      .createProduct({ name: "X", category: "Dogs", priceCents: 100 })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect(createProduct).not.toHaveBeenCalled();
  });

  it("creates a product for an admin, slugifying the name", async () => {
    vi.mocked(createProduct).mockResolvedValueOnce(productRow as never);
    const caller = appRouter.createCaller(admin as never);
    const created = await caller.admin.createProduct({
      name: "Test Bed",
      category: "Pet Bedding",
      priceCents: 2999,
    });
    expect(created).toEqual(productRow);
    const arg = vi.mocked(createProduct).mock.calls[0][0];
    expect(arg.slug).toBe("test-bed");
    expect(arg.name).toBe("Test Bed");
  });

  it("answers CONFLICT when the slug is already taken", async () => {
    const dup = Object.assign(new Error("duplicate key value violates unique constraint"), {
      code: "23505",
    });
    vi.mocked(createProduct).mockRejectedValueOnce(dup);
    const caller = appRouter.createCaller(admin as never);
    const err = await caller.admin
      .createProduct({ name: "Test Bed", category: "Pet Bedding", priceCents: 2999 })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("CONFLICT");
  });

  it("updates a product and answers NOT_FOUND for a stale id", async () => {
    vi.mocked(updateProduct).mockResolvedValueOnce(productRow as never);
    const caller = appRouter.createCaller(admin as never);
    const updated = await caller.admin.updateProduct({
      id: "prod-1",
      name: "Test Bed",
      category: "Pet Bedding",
      priceCents: 3499,
    });
    expect(updated).toEqual(productRow);
    expect(vi.mocked(updateProduct).mock.calls[0][0]).toBe("prod-1");

    vi.mocked(updateProduct).mockResolvedValueOnce(null);
    const err = await caller.admin
      .updateProduct({ id: "gone", name: "X", category: "Dogs", priceCents: 100 })
      .catch((e) => e);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
  });

  it("deletes a product and reports whether it was archived", async () => {
    vi.mocked(deleteProduct).mockResolvedValueOnce({ ok: true, archived: true });
    const caller = appRouter.createCaller(admin as never);
    const res = await caller.admin.deleteProduct({ id: "prod-1" });
    expect(res).toEqual({ ok: true, archived: true });
    expect(deleteProduct).toHaveBeenCalledWith("prod-1");
  });

  it("rejects a non-admin from deleting", async () => {
    const caller = appRouter.createCaller(customer as never);
    const err = await caller.admin.deleteProduct({ id: "prod-1" }).catch((e) => e);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect(deleteProduct).not.toHaveBeenCalled();
  });

  // The visibility contract. The admin list must ask for hidden products; the
  // storefront list must NOT - that single difference is what makes "hide" take
  // effect on the live storefront with no redeploy.
  it("admin.products includes hidden products; catalog.list does not", async () => {
    const adminCaller = appRouter.createCaller(admin as never);
    await adminCaller.admin.products();
    const adminArg = vi.mocked(listProducts).mock.calls.at(-1)?.[0];
    expect(adminArg?.includeInactive).toBe(true);

    vi.mocked(listProducts).mockClear();
    const publicCaller = appRouter.createCaller(anonymous as never);
    await publicCaller.catalog.list();
    const publicArg = vi.mocked(listProducts).mock.calls.at(-1)?.[0];
    expect(publicArg?.includeInactive).toBeUndefined();
  });

  it("catalog.bySlug answers NOT_FOUND for a hidden or missing product", async () => {
    vi.mocked(getProductBySlug).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.catalog.bySlug({ slug: "hidden-thing" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
  });
});
// ── Admin email history + resend ─────────────────────────────────────────────
// The panel must be able to answer "was the customer told, when, by which path,
// and to what address?" from real rows, and the resend must be PAID ORDERS ONLY
// and must never duplicate a receipt that has already gone.
describe("admin.emailHistory", () => {
  it("returns the send attempts plus the two persisted one-shot claims", async () => {
    vi.mocked(getOrderDetail).mockResolvedValueOnce({
      order: { id: "order-1", orderNumber: "PP-1", paymentStatus: "paid" },
      items: [],
      events: [],
    } as never);
    vi.mocked(getOrderEmailHistory).mockResolvedValueOnce({
      confirmationEmailSentAt: new Date("2026-10-15T07:00:00Z"),
      unpaidAlertSentAt: null,
      emails: [
        {
          id: "e1",
          kind: "payment_confirmation",
          trigger: "ipn",
          to: "buyer@example.com",
          subject: "Payment received",
          status: "sent",
          error: null,
          createdAt: new Date("2026-10-15T07:00:00Z"),
        },
      ],
    } as never);

    const caller = appRouter.createCaller(admin as never);
    const history = await caller.admin.emailHistory({ id: "order-1" });
    expect(history.confirmationEmailSentAt).toBeInstanceOf(Date);
    expect(history.emails).toHaveLength(1);
    expect(history.emails[0].trigger).toBe("ipn");
  });

  it("answers NOT_FOUND for a missing order", async () => {
    vi.mocked(getOrderDetail).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(admin as never);
    const err = await caller.admin.emailHistory({ id: "nope" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
  });
});

describe("admin.resendConfirmationEmail", () => {
  it("REFUSES an unpaid order and never reaches the receipt path", async () => {
    vi.mocked(sendPaidReceiptOnce).mockClear();
    vi.mocked(getOrderDetail).mockResolvedValueOnce({
      order: { id: "order-1", orderNumber: "PP-5VJGT7AS", paymentStatus: "unpaid" },
      items: [],
      events: [],
    } as never);

    const caller = appRouter.createCaller(admin as never);
    const err = await caller.admin.resendConfirmationEmail({ id: "order-1" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
    expect(sendPaidReceiptOnce).not.toHaveBeenCalled();
  });

  it("sends for a PAID order through the same one-shot claim", async () => {
    vi.mocked(sendPaidReceiptOnce).mockClear();
    vi.mocked(sendPaidReceiptOnce).mockResolvedValueOnce({ status: "sent", sentAt: new Date() } as never);
    vi.mocked(getOrderDetail).mockResolvedValueOnce({
      order: { id: "order-1", orderNumber: "PP-1", paymentStatus: "paid" },
      items: [],
      events: [],
    } as never);

    const caller = appRouter.createCaller(admin as never);
    const res = await caller.admin.resendConfirmationEmail({ id: "order-1" });
    expect(res.outcome.status).toBe("sent");
    expect(sendPaidReceiptOnce).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", verifiedPaid: true, trigger: "admin_resend" }),
    );
  });

  it("reports already_sent rather than duplicating a receipt that has gone", async () => {
    vi.mocked(sendPaidReceiptOnce).mockClear();
    vi.mocked(sendPaidReceiptOnce).mockResolvedValueOnce({
      status: "already_sent",
      sentAt: new Date(),
    } as never);
    vi.mocked(getOrderDetail).mockResolvedValueOnce({
      order: { id: "order-1", orderNumber: "PP-1", paymentStatus: "paid" },
      items: [],
      events: [],
    } as never);

    const caller = appRouter.createCaller(admin as never);
    const res = await caller.admin.resendConfirmationEmail({ id: "order-1" });
    expect(res.outcome.status).toBe("already_sent");
  });
});

// ── Returning from payment ──────────────────────────────────────────────
// The shopper comes back from the hosted checkout with an EMPTY cart: its items belong
// to the ORDER now, so clearing it is correct. What was wrong was the client
// treating "empty cart" as "no order" and rendering "There's nothing to check
// out". The fix remembers which order was placed (see
// client/src/lib/last-order.ts) and sends the shopper to /order/:orderNumber.
//
// These pin the SERVER half of that return path. The client cannot be the
// authority on whether an order may be paid again, so the gate lives here.
describe("checkout.resumePayment - the return-from-payment gate", () => {
  it("offers a way to resume payment for an UNPAID order", async () => {
    vi.mocked(getOrderByNumber).mockResolvedValueOnce({
      id: "order-1",
      orderNumber: "PP-5VJGT7AS",
      totalCents: 4999,
      currency: "USD",
      email: "buyer@example.com",
      paymentStatus: "unpaid",
      paymentProvider: "bachs",
      shippingAddress: { fullName: "Ada Lovelace" },
    } as never);

    const caller = appRouter.createCaller(anonymous as never);
    const res = await caller.checkout.resumePayment({ orderNumber: "PP-5VJGT7AS" });
    // A redirect is returned, so the order page's "Complete your payment"
    // control has somewhere to send the shopper.
    expect(res.redirectUrl).toBe("/order/PP-5VJGT7AS");
  });

  it("REFUSES a PAID order, so a returning shopper can never pay twice", async () => {
    vi.mocked(getOrderByNumber).mockResolvedValueOnce({
      id: "order-1",
      orderNumber: "PP-1",
      paymentStatus: "paid",
      paymentProvider: "bachs",
    } as never);

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.checkout.resumePayment({ orderNumber: "PP-1" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
  });

  it("REFUSES a REFUNDED order", async () => {
    vi.mocked(getOrderByNumber).mockResolvedValueOnce({
      id: "order-1",
      orderNumber: "PP-1",
      paymentStatus: "refunded",
      paymentProvider: "bachs",
    } as never);

    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.checkout.resumePayment({ orderNumber: "PP-1" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("BAD_REQUEST");
  });

  it("answers NOT_FOUND for an unknown order number", async () => {
    vi.mocked(getOrderByNumber).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.checkout.resumePayment({ orderNumber: "PP-NOPE" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
  });
});
describe("orders.lookup - the returning shopper can still see their order", () => {
  const detail = {
    order: { id: "order-1", orderNumber: "PP-5VJGT7AS", userId: "user-1", email: "buyer@example.com" },
    items: [],
    events: [],
  };

  it("returns the order to its signed-in OWNER without asking for an email", async () => {
    // The session survived the round trip to the provider - the common case.
    vi.mocked(getOrderByNumber).mockResolvedValueOnce(detail.order as never);
    vi.mocked(getOrderDetail).mockResolvedValueOnce(detail as never);

    const caller = appRouter.createCaller(customer as never);
    const found = await caller.orders.lookup({ orderNumber: "PP-5VJGT7AS" });
    expect(found.order.orderNumber).toBe("PP-5VJGT7AS");
  });

  it("accepts the email for a non-owner, case-insensitively (fresh tab / expired session)", async () => {
    vi.mocked(getOrderByNumber).mockResolvedValueOnce(detail.order as never);
    vi.mocked(getOrderDetail).mockResolvedValueOnce(detail as never);

    const caller = appRouter.createCaller(anonymous as never);
    const found = await caller.orders.lookup({
      orderNumber: "PP-5VJGT7AS",
      email: "Buyer@Example.com",
    });
    expect(found.order.orderNumber).toBe("PP-5VJGT7AS");
  });

  it("refuses a non-owner whose email does not match - the order number alone is not a key", async () => {
    vi.mocked(getOrderByNumber).mockResolvedValueOnce(detail.order as never);
    const caller = appRouter.createCaller(anonymous as never);
    const err = await caller.orders
      .lookup({ orderNumber: "PP-5VJGT7AS", email: "someone-else@example.com" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("NOT_FOUND");
  });
});
