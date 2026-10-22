// Transactional email: template rendering, graceful degradation without a key,
// and the send paths. `_core/db` and `_core/fetch` are mocked so the suite is
// deterministic - no database, no network.
import { beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({ resendApiKey: "", emailFrom: "" }));
const logRows = vi.hoisted(() => ({ written: [] as Record<string, unknown>[] }));
const adminState = vi.hoisted(() => ({ email: null as string | null }));

vi.mock("../_core/env", () => ({
  env: {
    isProd: false,
    get email() {
      return { resendApiKey: envState.resendApiKey, from: envState.emailFrom };
    },
  },
}));

vi.mock("../_core/admin-access", () => ({
  designatedAdminEmail: () => adminState.email,
}));

vi.mock("../_core/db", () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        logRows.written.push(v);
        return { returning: async () => [{ id: "log-1" }] };
      },
    }),
  },
}));

vi.mock("../_core/fetch", () => ({
  outboundFetch: vi.fn(),
}));

const { outboundFetch } = await import("../_core/fetch");
const {
  absoluteUrl,
  carrierTrackingUrl,
  renderOrderConfirmation,
  renderShippingNotification,
  renderWelcome,
  renderAdminNewOrder,
  listUnsubscribeHeaders,
  unsubscribeFooterLine,
  resolveFrom,
  sendTransactionalEmail,
  sendWelcomeEmail,
  sendAdminNewOrderEmail,
  buildOrderEmailData,
  toEmailLines,
} = await import("./email");

type Settings = Parameters<typeof sendTransactionalEmail>[0]["settings"];

const settings = {
  brand_name: "PetParcel",
  contact_email: "support@petparcel.store",
  business_address: "1600 Pacific Ave, Dallas, TX 75201, USA",
  email_from_name: "PetParcel",
  email_from_address: "orders@petparcel.store",
  email_reply_to: "support@petparcel.store",
} as unknown as Settings;

const order = {
  id: "order-1",
  orderNumber: "PP-ABCDEFGH",
  email: "buyer@example.com",
  currency: "USD",
  subtotalCents: 4999,
  shippingCents: 0,
  taxCents: 0,
  totalCents: 4999,
  shippingAddress: {
    fullName: "Ada Lovelace",
    line1: "1 Analytical Way",
    line2: "Apt 4",
    city: "Dallas",
    state: "TX",
    postalCode: "75201",
    country: "US",
  },
  carrier: "USPS" as string | null,
  trackingNumber: "9400111899223857182" as string | null,
};

const lines = [
  { name: "Orthopedic Memory Foam Dog Bed", variant: "Large / Grey", qty: 1, priceCents: 4999 },
];

beforeEach(() => {
  envState.resendApiKey = "";
  envState.emailFrom = "";
  adminState.email = null;
  logRows.written = [];
  vi.mocked(outboundFetch).mockReset();
});

describe("resolveFrom", () => {
  it("formats a display name with a valid address", () => {
    expect(resolveFrom("PetParcel", "orders@petparcel.store")).toBe(
      "PetParcel <orders@petparcel.store>",
    );
  });

  it("drops the label when the address has no TLD", () => {
    // A From of "PetParcel <orders@petparcel>" is accepted by our own form and
    // rejected by the provider - a failure that would land on a customer's order.
    expect(resolveFrom("PetParcel", "orders@petparcel")).toBe("orders@petparcel");
  });

  it("returns the bare address when no name is set", () => {
    expect(resolveFrom("", "orders@petparcel.store")).toBe("orders@petparcel.store");
  });
});

describe("absoluteUrl", () => {
  it("joins an origin and a path, trimming a trailing slash", () => {
    expect(absoluteUrl("https://shop.example.com/", "/order/PP-1")).toBe(
      "https://shop.example.com/order/PP-1",
    );
  });

  it("falls back to the production domain when no origin is known", () => {
    // The admin resend path has no browser origin to hand.
    expect(absoluteUrl(null, "/track")).toBe("https://www.petparcel.store/track");
  });
});

describe("carrierTrackingUrl", () => {
  it("builds a deep link for the carriers that publish one", () => {
    expect(carrierTrackingUrl("USPS", "123")).toContain("tools.usps.com");
    expect(carrierTrackingUrl("UPS", "123")).toContain("ups.com");
    expect(carrierTrackingUrl("FedEx", "123")).toContain("fedex.com");
    expect(carrierTrackingUrl("DHL", "123")).toContain("dhl.com");
  });

  it("returns null rather than guessing when it cannot build one", () => {
    expect(carrierTrackingUrl("Other", "123")).toBeNull();
    expect(carrierTrackingUrl("USPS", null)).toBeNull();
  });
});

describe("renderOrderConfirmation", () => {
  it("itemises the order and totals, and links to tracking", () => {
    const data = buildOrderEmailData(order, toEmailLines([
      { nameSnapshot: "Dog Bed", variantSnapshot: "Large", qty: 2, priceCents: 4999, imageUrl: null },
    ]), "https://shop.example.com");
    const { subject, html, text } = renderOrderConfirmation(data, "PetParcel");

    expect(subject).toContain("PP-ABCDEFGH");
    expect(html).toContain("Dog Bed");
    expect(html).toContain("Large");
    expect(html).toContain("$99.98"); // 2 × 49.99
    expect(html).toContain("https://shop.example.com/order/PP-ABCDEFGH");
    // Plain-text fallback carries the same itemisation.
    expect(text).toContain("2 x Dog Bed (Large) - $99.98");
    expect(text).toContain("Total: $49.99");
  });

  it("escapes customer-supplied text", () => {
    const data = buildOrderEmailData(
      { ...order, shippingAddress: { ...order.shippingAddress, fullName: "<script>alert(1)</script>" } },
      lines,
      "https://shop.example.com",
    );
    const { html } = renderOrderConfirmation(data, "PetParcel");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderShippingNotification", () => {
  it("carries the carrier, the tracking number and a deep link", () => {
    const data = buildOrderEmailData(order, lines, "https://shop.example.com");
    const { subject, html, text } = renderShippingNotification(data, "PetParcel");

    expect(subject).toContain("on its way");
    expect(html).toContain("USPS");
    expect(html).toContain("9400111899223857182");
    expect(html).toContain("tools.usps.com");
    expect(text).toContain("Tracking number: 9400111899223857182");
  });
});

describe("sendTransactionalEmail", () => {
  const rendered = { subject: "Hi", html: "<p>Hi</p>", text: "Hi" };

  it("skips gracefully when no API key is configured, and still logs", async () => {
    const result = await sendTransactionalEmail({
      kind: "order_confirmation",
      to: "buyer@example.com",
      rendered,
      settings,
      orderId: "order-1",
      orderNumber: "PP-ABCDEFGH",
    });

    expect(result.status).toBe("skipped");
    expect(outboundFetch).not.toHaveBeenCalled();
    // The store must be able to say "nobody was told" - so the attempt is rowed.
    expect(logRows.written).toHaveLength(1);
    expect(logRows.written[0]).toMatchObject({
      kind: "order_confirmation",
      toEmail: "buyer@example.com",
      status: "skipped",
      orderNumber: "PP-ABCDEFGH",
    });
  });

  it("sends through Resend when the key is present", async () => {
    envState.resendApiKey = "re_test_key";
    vi.mocked(outboundFetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_123" }), { status: 200 }),
    );

    const result = await sendTransactionalEmail({
      kind: "shipping_notification",
      to: "buyer@example.com",
      rendered,
      settings,
      orderId: "order-1",
    });

    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("msg_123");
    expect(outboundFetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(outboundFetch).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.from).toBe("PetParcel <orders@petparcel.store>");
    expect(body.to).toEqual(["buyer@example.com"]);
    expect(body.reply_to).toBe("support@petparcel.store");
    expect(logRows.written[0]).toMatchObject({ status: "sent", providerMessageId: "msg_123" });
  });

  it("records a failure with the provider's reason instead of throwing", async () => {
    envState.resendApiKey = "re_test_key";
    vi.mocked(outboundFetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "The domain is not verified" }), { status: 403 }),
    );

    const result = await sendTransactionalEmail({
      kind: "order_confirmation",
      to: "buyer@example.com",
      rendered,
      settings,
    });

    expect(result.status).toBe("failed");
    expect(result.reason).toContain("not verified");
    expect(logRows.written[0]).toMatchObject({ status: "failed" });
  });

  it("fails fast on an unusable recipient address", async () => {
    const result = await sendTransactionalEmail({
      kind: "order_confirmation",
      to: "not-an-email",
      rendered,
      settings,
    });
    expect(result.status).toBe("failed");
    expect(outboundFetch).not.toHaveBeenCalled();
  });

  it("fails when no sender address is configured", async () => {
    const result = await sendTransactionalEmail({
      kind: "order_confirmation",
      to: "buyer@example.com",
      rendered,
      settings: { ...settings, email_from_address: "" } as Settings,
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("sender address");
  });

  it("falls back to EMAIL_FROM when the store has no from-address", async () => {
    envState.resendApiKey = "re_test_key";
    envState.emailFrom = "PetParcel <orders@petparcel.store>";
    vi.mocked(outboundFetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_env" }), { status: 200 }),
    );
    const result = await sendTransactionalEmail({
      kind: "order_confirmation",
      to: "buyer@example.com",
      rendered,
      settings: { ...settings, email_from_address: "" } as Settings,
    });
    expect(result.status).toBe("sent");
    const body = JSON.parse(String((vi.mocked(outboundFetch).mock.calls[0][1] as RequestInit).body));
    expect(body.from).toBe("PetParcel <orders@petparcel.store>");
  });
});

describe("renderWelcome", () => {
  it("greets the customer by first name and links to the shop", () => {
    const { subject, html, text } = renderWelcome(
      { name: "Ada Lovelace", email: "ada@example.com", shopUrl: "https://shop.example.com/shop", accountUrl: "https://shop.example.com/account" },
      "PetParcel",
    );
    expect(subject).toContain("Welcome to PetParcel");
    expect(html).toContain("Hi Ada");
    expect(html).toContain("https://shop.example.com/shop");
    expect(html).toContain("https://shop.example.com/account");
    expect(text).toContain("Welcome to PetParcel!");
    expect(text).toContain("Start shopping: https://shop.example.com/shop");
  });
});

describe("renderAdminNewOrder", () => {
  it("names the customer, the order and the total", () => {
    const data = buildOrderEmailData(order, lines, "https://shop.example.com");
    const { subject, html, text } = renderAdminNewOrder(data, "PetParcel", data.orderUrl);
    expect(subject).toContain("PP-ABCDEFGH");
    expect(subject).toContain("$49.99");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("buyer@example.com");
    expect(html).toContain("Orthopedic Memory Foam Dog Bed");
    expect(text).toContain("New order received!");
  });

  // Regression: this template used to ship with the shell's raw
  // {{SUPPORT_EMAIL}} / {{BUSINESS_ADDRESS}} tokens still in the HTML, so the
  // owner's own alert showed literal braces. EVERY renderer must resolve them.
  it("leaves no unreplaced shell placeholder in the HTML", () => {
    const data = buildOrderEmailData(order, lines, "https://shop.example.com");
    const { html } = renderAdminNewOrder(data, "PetParcel", data.orderUrl);
    expect(html).not.toContain("{{");
    expect(html).toContain("support@petparcel.store");
    expect(html).toContain("1600 Pacific Ave");
  });
});

describe("deliverability", () => {
  it("renders no unreplaced shell placeholder in ANY template", () => {
    const data = buildOrderEmailData(order, lines, "https://shop.example.com");
    const rendered = [
      renderOrderConfirmation(data),
      renderShippingNotification(data),
      renderWelcome({ name: "Ada", email: "ada@example.com", shopUrl: "https://s/shop", accountUrl: "https://s/account" }),
      renderAdminNewOrder(data, "PetParcel", data.orderUrl),
    ];
    for (const r of rendered) {
      expect(r.html).not.toContain("{{");
      expect(r.text).not.toContain("{{");
    }
  });

  it("puts a real physical address and a support contact in every footer", () => {
    const data = buildOrderEmailData(order, lines, "https://shop.example.com");
    for (const r of [
      renderOrderConfirmation(data),
      renderShippingNotification(data),
      renderAdminNewOrder(data, "PetParcel", data.orderUrl),
    ]) {
      expect(r.html).toContain("1600 Pacific Ave");
      expect(r.text).toMatch(/support@|Write to/);
    }
  });

  it("emits a transactional message with NO List-Unsubscribe header", () => {
    // Offering a way out of a receipt is a spam signal, so unsubscribe is
    // deliberately opt-in per send - a receipt must not ask for one.
    expect(listUnsubscribeHeaders(null)).toBeNull();
    expect(listUnsubscribeHeaders("  ")).toBeNull();
  });

  it("emits a mailto List-Unsubscribe with no one-click for a mailto address", () => {
    expect(listUnsubscribeHeaders("mailto:support@petparcel.store")).toEqual({
      "List-Unsubscribe": "<mailto:support@petparcel.store>",
    });
  });

  it("advertises one-click POST only for an https unsubscribe endpoint", () => {
    expect(listUnsubscribeHeaders("https://www.petparcel.store/unsubscribe?u=abc")).toEqual({
      "List-Unsubscribe": "<https://www.petparcel.store/unsubscribe?u=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("renders a plain unsubscribe line linking to the support inbox", () => {
    const line = unsubscribeFooterLine("support@petparcel.store");
    expect(line).toContain("Unsubscribe");
    expect(line).toContain("mailto:support@petparcel.store?subject=unsubscribe");
  });
});

describe("sendWelcomeEmail", () => {
  it("no-ops without a key and records a welcome row", async () => {
    const result = await sendWelcomeEmail(
      { name: "Ada", email: "ada@example.com", shopUrl: "https://s/shop", accountUrl: "https://s/account" },
      settings,
    );
    expect(result.status).toBe("skipped");
    expect(outboundFetch).not.toHaveBeenCalled();
    expect(logRows.written[0]).toMatchObject({ kind: "welcome", toEmail: "ada@example.com", status: "skipped" });
  });
});

describe("sendAdminNewOrderEmail", () => {
  it("sends to the designated admin address (ADMIN_EMAIL)", async () => {
    adminState.email = "owner@petparcel.store";
    envState.resendApiKey = "re_test_key";
    vi.mocked(outboundFetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_admin" }), { status: 200 }),
    );
    const result = await sendAdminNewOrderEmail(order, lines, settings, "https://shop.example.com");
    expect(result.status).toBe("sent");
    const body = JSON.parse(String((vi.mocked(outboundFetch).mock.calls[0][1] as RequestInit).body));
    expect(body.to).toEqual(["owner@petparcel.store"]);
    expect(logRows.written[0]).toMatchObject({ kind: "admin_new_order", toEmail: "owner@petparcel.store" });
  });

  it("falls back to the store support inbox when ADMIN_EMAIL is unset", async () => {
    adminState.email = null;
    const result = await sendAdminNewOrderEmail(order, lines, settings, "https://shop.example.com");
    expect(result.status).toBe("skipped");
    expect(logRows.written[0]).toMatchObject({ kind: "admin_new_order", toEmail: "support@petparcel.store" });
  });
});
