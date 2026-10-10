// Transactional email: template rendering, graceful degradation without a key,
// and the send paths. `_core/db` and `_core/fetch` are mocked so the suite is
// deterministic — no database, no network.
import { beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({ resendApiKey: "" }));
const logRows = vi.hoisted(() => ({ written: [] as Record<string, unknown>[] }));

vi.mock("../_core/env", () => ({
  env: {
    isProd: false,
    get email() {
      return { resendApiKey: envState.resendApiKey };
    },
  },
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
  resolveFrom,
  sendTransactionalEmail,
  buildOrderEmailData,
  toEmailLines,
} = await import("./email");

type Settings = Parameters<typeof sendTransactionalEmail>[0]["settings"];

const settings = {
  brand_name: "PetParcel",
  contact_email: "support@petparcel.store",
  business_address: "PetParcel LLC, Wilmington, DE",
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
    city: "Wilmington",
    state: "DE",
    postalCode: "19801",
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
    // rejected by the provider — a failure that would land on a customer's order.
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
    expect(text).toContain("2 x Dog Bed (Large) — $99.98");
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
    // The store must be able to say "nobody was told" — so the attempt is rowed.
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
});
