// ── Checkout price integrity + canonical IPN origin ─────────────────────────
//
// These pin the two guarantees the store makes about money and about where the
// payment provider's settlement webhook is delivered. Both are security
// properties, not conveniences, so they are asserted against the REAL code path
// rather than a re-implementation:
//
//   A. THE PRICE IS SERVER-ONLY. The amount charged is computed from catalog rows
//      and store settings. A client that sends a price, a subtotal or a total of
//      its own choosing cannot change it, because those keys are never read -
//      `createOrder` derives every term from the database. Quantities, variants
//      and products are all validated. The invoice the provider is asked to
//      create carries EXACTLY the stored order total, in integer cents, with no
//      float drift - and an invoice whose echoed price disagrees is refused
//      rather than persisted.
//
//   B. THE CALLBACK URL IS A DEPLOYMENT FACT. The IPN callback URL and the
//      shopper's return URL are built from the canonical origin
//      (server/_core/site-url.ts), never from a request body or header. This is
//      the fix for the bug where checkout read `input.origin` from the browser -
//      a caller could choose where the store's settlement webhook went, and the
//      apex host's 308 redirect meant a plausible value silently stranded a paid
//      order on "awaiting payment".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  centsToMajor,
  formatMajor,
  majorToCents,
  orderTotalCents,
  shippingCentsFor,
  taxCentsFor,
  toCents,
} from "../shared/money";
import {
  orders as ordersTable,
  productVariants as variantsTable,
  products as productsTable,
} from "../drizzle/schema";

// ── fixtures ────────────────────────────────────────────────────────────────
//
// A tiny in-memory store the mocked db reads from. The tests set the exact rows
// the "catalog query" should return, which is what lets a scenario model a
// product that is inactive or a variant that has been retired - in the real code
// those rows are filtered by SQL, so an empty result IS the faithful simulation.
const store = {
  products: [] as Array<Record<string, unknown>>,
  variants: [] as Array<Record<string, unknown>>,
  orders: [] as Array<Record<string, unknown>>,
};

const SETTINGS = {
  brand_name: "PetParcel",
  currency: "USD",
  shipping_flat_cents: 699,
  free_shipping_threshold_cents: 5900,
  tax_rate_bps: 0,
};

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "prod-1",
    slug: "dog-bed",
    name: "Dog Bed",
    priceCents: 4999,
    active: true,
    archived: false,
    images: ["https://cdn.example/dog-bed.jpg"],
    ...overrides,
  };
}

function variant(overrides: Record<string, unknown> = {}) {
  return {
    id: "var-1",
    productId: "prod-1",
    name: "Large",
    priceCents: 5999,
    inventoryQty: 10,
    sortOrder: 0,
    ...overrides,
  };
}

/** A thenable chain, so both `await db.select()...` and the internal
 *  `return db.select()...` in `listVariantsForProducts` work. */
function chain(rows: unknown[]) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  c.from = vi.fn(() => c);
  c.where = vi.fn(() => c);
  c.orderBy = vi.fn(() => c);
  c.limit = vi.fn(() => c);
  c.returning = vi.fn(() => c);
  // The stock-reservation write in `createOrder` is `update(...).set(...).where(...)`,
  // so the chain needs `set` too.
  c.set = vi.fn(() => c);
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  c.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject);
  c.finally = (fn: () => void) => Promise.resolve(rows).finally(fn);
  void self;
  return c;
}

// ── mocks ───────────────────────────────────────────────────────────────────

// Read the env lazily so a test can set a key and have the config pick it up.
vi.mock("./_core/env", () => ({
  env: {
    isProd: false,
    get nowpayments() {
      return {
        apiKey: process.env.NOWPAYMENTS_API_KEY ?? "",
        ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET ?? "",
        payCurrency: process.env.NOWPAYMENTS_PAY_CURRENCY ?? "",
        baseUrl: process.env.NOWPAYMENTS_API_BASE ?? "",
      };
    },
  },
}));

// The one outbound seam. Captures every call so a test can assert exactly what
// body was sent to the provider, and answers with a canned invoice.
const outboundCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
let invoiceResponder: (body: Record<string, unknown>) => Record<string, unknown> = (body) => ({
  id: 900001,
  invoice_url: "https://nowpayments.io/payment/900001",
  order_id: body.order_id,
  price_amount: body.price_amount,
  ipn_callback_url: body.ipn_callback_url,
});

vi.mock("./_core/fetch", () => ({
  outboundFetch: vi.fn(async (url: string, init: { body?: string } = {}) => {
    const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    outboundCalls.push({ url, body });
    return new Response(JSON.stringify(invoiceResponder(body)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
}));

const updateCalls: Array<Record<string, unknown>> = [];

vi.mock("./_core/db", () => ({
  db: {
    select: vi.fn(() => {
      // Resolve the table from the `.from()` argument, so each read returns the
      // row set the test set up for that table.
      let rows: unknown[] = [];
      const c: Record<string, unknown> = {};
      c.from = vi.fn((t: unknown) => {
        if (t === productsTable) rows = store.products;
        else if (t === variantsTable) rows = store.variants;
        else if (t === ordersTable) rows = store.orders;
        return c;
      });
      c.where = vi.fn(() => c);
      c.orderBy = vi.fn(() => c);
      c.limit = vi.fn(() => c);
      c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
      c.catch = (reject: (e: unknown) => unknown) => Promise.resolve(rows).catch(reject);
      c.finally = (fn: () => void) => Promise.resolve(rows).finally(fn);
      return c;
    }),
    insert: vi.fn((t: unknown) => ({
      values: vi.fn((v: Record<string, unknown>) => {
        if (t === ordersTable) store.orders.push(v);
        return Promise.resolve([]);
      }),
    })),
    update: vi.fn(() => {
      const c: Record<string, unknown> = {};
      c.set = vi.fn((s: Record<string, unknown>) => {
        updateCalls.push(s);
        return c;
      });
      c.where = vi.fn(() => c);
      c.returning = vi.fn(() => Promise.resolve([{ id: "ok" }]));
      c.then = (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve);
      c.catch = (reject: (e: unknown) => unknown) => Promise.resolve([]).catch(reject);
      c.finally = (fn: () => void) => Promise.resolve([]).finally(fn);
      return c;
    }),
  },
  // A transaction handle with just the surface `createOrder` touches.
  atomic: vi.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      insert: () => ({ values: () => Promise.resolve([]) }),
      update: () => chain([{ id: "ok" }]),
    };
    const result = fn(tx);
    return Array.isArray(result) ? Promise.all(result) : result;
  }),
  isUniqueViolation: vi.fn(() => false),
}));

// PARTIAL mock: `createOrder` and `MAX_LINE_QTY` are the REAL implementations
// under test, so only the side-effects they reach for are stubbed (a receipt
// send, a supplier forward, a detail read). Mocking the whole module would have
// replaced the very code being asserted about.
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getOrderDetail: vi.fn(async () => null),
    claimOrderConfirmationEmail: vi.fn(async () => false),
    releaseOrderConfirmationEmail: vi.fn(async () => {}),
    getOrderConfirmationEmailSentAt: vi.fn(async () => null),
  };
});

vi.mock("./store-settings", () => ({
  getSettings: vi.fn(async () => SETTINGS),
  updateSettings: vi.fn(async () => ({ ok: true })),
}));

vi.mock("./services/order-receipt", () => ({
  sendPaidReceiptOnce: vi.fn(async () => ({ status: "not_paid" })),
}));
vi.mock("./services/cj-order-forward", () => ({
  forwardOrderToCj: vi.fn(async () => {}),
}));

// Imported AFTER the mocks are registered.
const { createOrder, MAX_LINE_QTY } = await import("./db");
const { createInvoice, nowPaymentsConfig } = await import("./services/nowpayments");
const { getProvider } = await import("./services/payments");
const { DEFAULT_SITE_ORIGIN, ipnCallbackUrl, normalizeOrigin, siteOrigin, siteUrl } = await import(
  "./_core/site-url"
);

const SHIPPING = {
  fullName: "Ada Lovelace",
  line1: "1 Analytical Way",
  city: "London",
  state: "CA",
  postalCode: "90210",
  country: "US",
  phone: null,
};

function orderInput(items: Array<Record<string, unknown>>) {
  return {
    userId: "user-1",
    email: "ada@example.com",
    items,
    shippingAddress: SHIPPING,
    billingAddress: SHIPPING,
    paymentProvider: "nowpayments",
    notes: null,
  } as unknown as Parameters<typeof createOrder>[0];
}

beforeEach(() => {
  store.products = [];
  store.variants = [];
  store.orders = [];
  outboundCalls.length = 0;
  updateCalls.length = 0;
  process.env.NOWPAYMENTS_API_KEY = "test-api-key";
  process.env.NOWPAYMENTS_IPN_SECRET = "test-ipn-secret";
  delete process.env.SITE_URL;
  delete process.env.APP_URL;
  delete process.env.PUBLIC_URL;
  invoiceResponder = (body) => ({
    id: 900001,
    invoice_url: "https://nowpayments.io/payment/900001",
    order_id: body.order_id,
    price_amount: body.price_amount,
    ipn_callback_url: body.ipn_callback_url,
  });
});

afterEach(() => {
  delete process.env.NOWPAYMENTS_API_KEY;
  delete process.env.NOWPAYMENTS_IPN_SECRET;
});

// ── A. money maths ──────────────────────────────────────────────────────────

describe("money maths (integer cents, no float drift)", () => {
  it("round-trips cents through major units exactly", () => {
    // The values that break naive `x / 100` handling, plus a sweep.
    for (const cents of [0, 1, 99, 100, 1234, 4999, 5999, 8497, 123456, 999999]) {
      expect(majorToCents(centsToMajor(cents)), `round trip for ${cents}`).toBe(cents);
    }
  });

  it("converts to the two-decimal amount the provider expects", () => {
    expect(centsToMajor(8497)).toBe(84.97);
    expect(centsToMajor(4999)).toBe(49.99);
    expect(formatMajor(8497)).toBe("84.97");
    expect(formatMajor(100)).toBe("1.00");
  });

  it("sums an order total from its parts without drift", () => {
    expect(orderTotalCents({ subtotalCents: 4999, shippingCents: 699, taxCents: 0 })).toBe(5698);
    // A sum that a float pipeline can land one cent off.
    expect(orderTotalCents({ subtotalCents: 3333, shippingCents: 333, taxCents: 333 })).toBe(3999);
  });

  it("computes tax on the integer product, not a float percentage", () => {
    // 8.25% of $49.99 is 412.4 cents → 412, and stable at scale.
    expect(taxCentsFor(4999, 825)).toBe(412);
    expect(taxCentsFor(0, 825)).toBe(0);
    expect(taxCentsFor(4999, 0)).toBe(0);
    // The case a float percentage gets wrong: 3333 * 0.0825 = 274.9725 → 275.
    expect(taxCentsFor(3333, 825)).toBe(275);
  });

  it("applies the free-shipping threshold at the boundary", () => {
    const settings = { shipping_flat_cents: 699, free_shipping_threshold_cents: 5900 };
    expect(shippingCentsFor(5899, settings)).toBe(699); // one cent below → charged
    expect(shippingCentsFor(5900, settings)).toBe(0); // exactly at → free
    expect(shippingCentsFor(999999, settings)).toBe(0);
  });

  it("coerces junk to a safe integer rather than NaN", () => {
    expect(toCents(undefined)).toBe(0);
    expect(toCents("not a number")).toBe(0);
    expect(toCents("4999")).toBe(4999);
  });
});

// ── A2. the charged amount is derived from the catalog, never the payload ────

describe("createOrder: the price is server-only", () => {
  it("charges the catalog price, not a price the client sent", () => {
    store.products = [product()];
    // A hostile payload: every price-shaped key a client could invent.
    const created = createOrder(
      orderInput([
        {
          slug: "dog-bed",
          variantId: null,
          qty: 2,
          price: 1,
          priceCents: 1,
          unitPrice: 1,
          subtotal: 1,
          total: 1,
          totalCents: 1,
          amount: 1,
        },
      ]),
    );
    return created.then((order) => {
      // 2 × $49.99 = $99.98, free shipping (over the $59 threshold), no tax.
      expect(order.subtotalCents).toBe(9998);
      expect(order.shippingCents).toBe(0);
      expect(order.totalCents).toBe(9998);
      // Explicitly NOT the one cent the payload asked for.
      expect(order.totalCents).not.toBe(1);
    });
  });

  it("uses the VARIANT price when a variant is chosen", () => {
    store.products = [product()];
    store.variants = [variant({ priceCents: 5999 })];
    return createOrder(orderInput([{ slug: "dog-bed", variantId: "var-1", qty: 1 }])).then((order) => {
      expect(order.subtotalCents).toBe(5999);
    });
  });

  it("adds flat shipping below the free-shipping threshold", () => {
    store.products = [product({ priceCents: 1000 })];
    return createOrder(orderInput([{ slug: "dog-bed", variantId: null, qty: 1 }])).then((order) => {
      expect(order.subtotalCents).toBe(1000);
      expect(order.shippingCents).toBe(699);
      expect(order.totalCents).toBe(1699);
    });
  });

  it("refuses an unknown product", () => {
    store.products = [];
    return expect(
      createOrder(orderInput([{ slug: "does-not-exist", variantId: null, qty: 1 }])),
    ).rejects.toThrow(/available/i);
  });

  it("refuses a product the catalog query did not return (inactive/archived)", () => {
    // The real code filters `active = true AND archived = false` in SQL, so a
    // hidden product simply is not in the result set - which is what an empty
    // fixture models.
    store.products = [];
    return expect(
      createOrder(orderInput([{ slug: "dog-bed", variantId: null, qty: 1 }])),
    ).rejects.toThrow(/available/i);
  });

  it("refuses a variant that does not belong to the product", () => {
    store.products = [product()];
    store.variants = []; // the variant was retired, or belongs to another product
    return expect(
      createOrder(orderInput([{ slug: "dog-bed", variantId: "var-ghost", qty: 1 }])),
    ).rejects.toThrow(/option is no longer available/i);
  });

  it("refuses a quantity above the per-line ceiling", () => {
    store.products = [product()];
    return expect(
      createOrder(orderInput([{ slug: "dog-bed", variantId: null, qty: MAX_LINE_QTY + 1 }])),
    ).rejects.toThrow(/exceeds the per-item limit/i);
  });

  it("refuses an empty cart", () => {
    return expect(createOrder(orderInput([]))).rejects.toThrow(/cart is empty/i);
  });

  it("clamps a non-positive quantity to one unit rather than charging nothing", () => {
    store.products = [product()];
    return createOrder(orderInput([{ slug: "dog-bed", variantId: null, qty: -5 }])).then((order) => {
      expect(order.subtotalCents).toBe(4999);
    });
  });

  it("keeps every amount a whole number of cents", () => {
    store.products = [product({ priceCents: 3333 })];
    return createOrder(orderInput([{ slug: "dog-bed", variantId: null, qty: 3 }])).then((order) => {
      expect(Number.isInteger(order.subtotalCents)).toBe(true);
      expect(Number.isInteger(order.totalCents)).toBe(true);
      expect(order.totalCents).toBe(order.subtotalCents + order.shippingCents + order.taxCents);
    });
  });
});

// ── A3. the invoice matches the order, exactly ───────────────────────────────

describe("createInvoice: the amount charged equals the order total", () => {
  it("sends the order total in the provider's major units, with no drift", async () => {
    await createInvoice({
      priceAmount: centsToMajor(8497),
      priceCurrency: "usd",
      orderId: "PP-TEST0001",
      orderDescription: "PetParcel order PP-TEST0001",
      ipnCallbackUrl: ipnCallbackUrl(),
      successUrl: siteUrl("/order/PP-TEST0001"),
      cancelUrl: siteUrl("/order/PP-TEST0001"),
    });
    expect(outboundCalls).toHaveLength(1);
    const sent = outboundCalls[0].body;
    expect(sent.price_amount).toBe(84.97);
    // The number that reaches the provider converts back to the exact stored total.
    expect(majorToCents(sent.price_amount as number)).toBe(8497);
  });

  it("refuses an invoice the provider priced differently from the order", async () => {
    // The provider echoing a different amount means the customer would be charged
    // something other than the order total - never persist that.
    invoiceResponder = (body) => ({
      id: 900002,
      invoice_url: "https://nowpayments.io/payment/900002",
      order_id: body.order_id,
      price_amount: 84.96, // one cent less than the 84.97 we sent
      ipn_callback_url: body.ipn_callback_url,
    });
    await expect(
      createInvoice({
        priceAmount: 84.97,
        priceCurrency: "usd",
        orderId: "PP-TEST0002",
        orderDescription: "PetParcel order PP-TEST0002",
        ipnCallbackUrl: ipnCallbackUrl(),
        successUrl: siteUrl("/order/PP-TEST0002"),
        cancelUrl: siteUrl("/order/PP-TEST0002"),
      }),
    ).rejects.toThrow(/priced the invoice at 84\.96 but the order total is 84\.97/);
  });

  it("refuses an invoice whose callback URL is not the one we sent", async () => {
    invoiceResponder = (body) => ({
      id: 900003,
      invoice_url: "https://nowpayments.io/payment/900003",
      order_id: body.order_id,
      price_amount: body.price_amount,
      ipn_callback_url: "https://petparcel.store/api/payments/nowpayments/ipn", // apex, not www
    });
    await expect(
      createInvoice({
        priceAmount: 10,
        priceCurrency: "usd",
        orderId: "PP-TEST0003",
        orderDescription: "PetParcel order PP-TEST0003",
        ipnCallbackUrl: ipnCallbackUrl(),
        successUrl: siteUrl("/order/PP-TEST0003"),
        cancelUrl: siteUrl("/order/PP-TEST0003"),
      }),
    ).rejects.toThrow(/different IPN callback URL/i);
  });

  it("always asks for the canonical callback URL and the exact amount", async () => {
    await createInvoice({
      priceAmount: centsToMajor(1699),
      priceCurrency: "usd",
      orderId: "PP-TEST0004",
      orderDescription: "PetParcel order PP-TEST0004",
      ipnCallbackUrl: ipnCallbackUrl(),
      successUrl: siteUrl("/order/PP-TEST0004"),
      cancelUrl: siteUrl("/order/PP-TEST0004"),
    });
    const sent = outboundCalls[0].body;
    expect(sent.ipn_callback_url).toBe(`${DEFAULT_SITE_ORIGIN}/api/payments/nowpayments/ipn`);
    expect(sent.price_amount).toBe(16.99);
  });
});

// ── A4. one invoice per order ───────────────────────────────────────────────

describe("invoice creation is idempotent", () => {
  it("reuses an existing invoice instead of creating a second one", async () => {
    // The order already carries a hosted invoice and is still unpaid: a
    // double-click or a retry must hand back the SAME invoice.
    store.orders = [
      {
        id: "order-1",
        orderNumber: "PP-TEST0005",
        totalCents: 4999,
        currency: "USD",
        email: "ada@example.com",
        paymentStatus: "unpaid",
        paymentUrl: "https://nowpayments.io/payment/EXISTING",
        paymentInvoiceId: "EXISTING",
      },
    ];
    const provider = getProvider("nowpayments");
    const result = await provider.start({
      orderId: "order-1",
      orderNumber: "PP-TEST0005",
      totalCents: 4999,
      currency: "USD",
      email: "ada@example.com",
      customerName: "Ada Lovelace",
      returnUrl: siteUrl("/order/PP-TEST0005"),
      ipnUrl: ipnCallbackUrl(),
    });
    expect(result.redirectUrl).toBe("https://nowpayments.io/payment/EXISTING");
    // The decisive assertion: no second invoice was requested.
    expect(outboundCalls).toHaveLength(0);
  });

  it("reuses the invoice when only the invoice id was persisted", async () => {
    // The window where the id landed but the redirect URL did not: still one
    // invoice, never two payment addresses for one order.
    store.orders = [
      {
        id: "order-2",
        orderNumber: "PP-TEST0006",
        totalCents: 4999,
        currency: "USD",
        email: "ada@example.com",
        paymentStatus: "unpaid",
        paymentUrl: null,
        paymentInvoiceId: "EXISTING-2",
      },
    ];
    const provider = getProvider("nowpayments");
    const result = await provider.start({
      orderId: "order-2",
      orderNumber: "PP-TEST0006",
      totalCents: 4999,
      currency: "USD",
      email: "ada@example.com",
      customerName: "Ada Lovelace",
      returnUrl: siteUrl("/order/PP-TEST0006"),
      ipnUrl: ipnCallbackUrl(),
    });
    expect(outboundCalls).toHaveLength(0);
    expect(result.providerRef).toBe("EXISTING-2");
  });

  it("creates exactly one invoice for a fresh order and sends the canonical URLs", async () => {
    store.orders = [
      {
        id: "order-3",
        orderNumber: "PP-TEST0007",
        totalCents: 8497,
        currency: "USD",
        email: "ada@example.com",
        paymentStatus: "unpaid",
        paymentUrl: null,
        paymentInvoiceId: null,
      },
    ];
    const provider = getProvider("nowpayments");
    const result = await provider.start({
      orderId: "order-3",
      orderNumber: "PP-TEST0007",
      totalCents: 8497,
      currency: "USD",
      email: "ada@example.com",
      customerName: "Ada Lovelace",
      returnUrl: siteUrl("/order/PP-TEST0007"),
      ipnUrl: ipnCallbackUrl(),
    });
    expect(outboundCalls).toHaveLength(1);
    expect(outboundCalls[0].body.price_amount).toBe(84.97);
    expect(outboundCalls[0].body.ipn_callback_url).toBe(
      `${DEFAULT_SITE_ORIGIN}/api/payments/nowpayments/ipn`,
    );
    expect(result.redirectUrl).toBe("https://nowpayments.io/payment/900001");
  });

  it("does not create an invoice at all when no key is configured", async () => {
    delete process.env.NOWPAYMENTS_API_KEY;
    store.orders = [];
    const provider = getProvider("nowpayments");
    const result = await provider.start({
      orderId: "order-4",
      orderNumber: "PP-TEST0008",
      totalCents: 4999,
      currency: "USD",
      email: "ada@example.com",
      customerName: "Ada Lovelace",
      returnUrl: siteUrl("/order/PP-TEST0008"),
      ipnUrl: ipnCallbackUrl(),
    });
    // Degrades to the store's own order page, unpaid - nothing is charged.
    expect(outboundCalls).toHaveLength(0);
    expect(result.redirectUrl).toBe("/order/PP-TEST0008");
    expect(result.providerRef).toBeNull();
  });
});

// ── B. the canonical origin ─────────────────────────────────────────────────

describe("canonical site origin", () => {
  it("defaults to the host that actually SERVES the store", () => {
    // The apex 308-redirects to www; register the URL that answers 200/401.
    expect(siteOrigin()).toBe(DEFAULT_SITE_ORIGIN);
    expect(DEFAULT_SITE_ORIGIN).toBe("https://www.petparcel.store");
  });

  it("builds the IPN callback URL on the registered path", () => {
    expect(ipnCallbackUrl()).toBe("https://www.petparcel.store/api/payments/nowpayments/ipn");
  });

  it("honours an explicitly configured origin", () => {
    process.env.SITE_URL = "https://shop.example.com/";
    expect(siteOrigin()).toBe("https://shop.example.com");
    expect(ipnCallbackUrl()).toBe("https://shop.example.com/api/payments/nowpayments/ipn");
    expect(siteUrl("/order/PP-1")).toBe("https://shop.example.com/order/PP-1");
  });

  it("ignores an unusable origin rather than building a broken URL with it", () => {
    // A bare host, a non-http scheme and an empty value must all fall back: a
    // malformed origin silently breaks payment confirmation, so it is never used.
    for (const bad of ["petparcel.store", "javascript:alert(1)", "   ", "not a url"]) {
      process.env.SITE_URL = bad;
      expect(siteOrigin(), `for ${JSON.stringify(bad)}`).toBe(DEFAULT_SITE_ORIGIN);
    }
    expect(normalizeOrigin(null)).toBeNull();
    expect(normalizeOrigin("petparcel.store")).toBeNull();
  });

  it("keeps a local development origin and its port", () => {
    process.env.SITE_URL = "http://localhost:3001";
    expect(siteOrigin()).toBe("http://localhost:3001");
  });

  it("is not influenced by anything a request could carry", () => {
    // The origin is read from configuration only - no argument, header or body
    // can reach it. This is the property the checkout used to violate.
    process.env.SITE_URL = "https://shop.example.com";
    expect(ipnCallbackUrl()).toContain("shop.example.com");
    delete process.env.SITE_URL;
    expect(ipnCallbackUrl()).toContain("www.petparcel.store");
    // and the config itself is a pure read of the environment
    expect(nowPaymentsConfig().apiKey).toBe("test-api-key");
  });
});
