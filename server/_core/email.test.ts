// The low-level Resend transport: it must build the correct payload and NO-OP
// (never throw) when no API key is configured. `_core/env` and `_core/fetch` are
// mocked so the suite is deterministic - no network, no real key.
import { beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({ resendApiKey: "", from: "" }));

vi.mock("./env", () => ({
  env: {
    isProd: false,
    get email() {
      return { resendApiKey: envState.resendApiKey, from: envState.from };
    },
  },
}));

vi.mock("./fetch", () => ({ outboundFetch: vi.fn() }));

const { outboundFetch } = await import("./fetch");
const { sendEmail } = await import("./email");

beforeEach(() => {
  envState.resendApiKey = "";
  envState.from = "";
  vi.mocked(outboundFetch).mockReset();
});

describe("sendEmail", () => {
  it("no-ops gracefully (never throws) when RESEND_API_KEY is unset", async () => {
    const result = await sendEmail({
      to: "buyer@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      kind: "order_confirmation",
    });
    expect(result.status).toBe("skipped");
    expect(result.reason).toContain("RESEND_API_KEY");
    expect(outboundFetch).not.toHaveBeenCalled();
  });

  it("builds the correct Resend payload (from/to/subject/html/text/reply_to)", async () => {
    envState.resendApiKey = "re_test_key";
    envState.from = "PetParcel <orders@petparcel.store>";
    vi.mocked(outboundFetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }),
    );

    const result = await sendEmail({
      to: "buyer@example.com",
      subject: "Your order",
      html: "<p>Thanks</p>",
      text: "Thanks",
      replyTo: "support@petparcel.store",
      // A CRITICAL kind: it must use the Resend transport, not the secondary one.
      kind: "order_confirmation",
    });

    expect(result.status).toBe("sent");
    expect(result.providerMessageId).toBe("msg_1");
    const [url, init] = vi.mocked(outboundFetch).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      from: "PetParcel <orders@petparcel.store>",
      to: ["buyer@example.com"],
      subject: "Your order",
      html: "<p>Thanks</p>",
      text: "Thanks",
      reply_to: "support@petparcel.store",
    });
    expect((init as RequestInit).headers).toMatchObject({
      authorization: "Bearer re_test_key",
    });
  });

  it("reports a provider rejection as a status, not a throw", async () => {
    envState.resendApiKey = "re_test_key";
    envState.from = "orders@petparcel.store";
    vi.mocked(outboundFetch).mockResolvedValue(
      new Response(JSON.stringify({ message: "The domain is not verified" }), { status: 403 }),
    );
    const result = await sendEmail({
      to: "buyer@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      kind: "order_confirmation",
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("not verified");
  });

  it("fails fast on an unusable recipient without calling the provider", async () => {
    envState.resendApiKey = "re_test_key";
    envState.from = "orders@petparcel.store";
    const result = await sendEmail({
      to: "not-an-email",
      subject: "Hi",
      html: "<p>Hi</p>",
      kind: "order_confirmation",
    });
    expect(result.status).toBe("failed");
    expect(outboundFetch).not.toHaveBeenCalled();
  });

  it("fails when no sender is configured (no EMAIL_FROM, no override)", async () => {
    envState.resendApiKey = "re_test_key";
    envState.from = "";
    const result = await sendEmail({
      to: "buyer@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      kind: "order_confirmation",
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("sender address");
  });

  it("routes a NON-critical kind to the secondary provider, never Resend", async () => {
    // Even with Resend fully configured, a sign-in or contact-reply email must
    // NOT spend Resend's hard daily cap - it goes to the secondary SMTP provider.
    envState.resendApiKey = "re_test_key";
    envState.from = "orders@petparcel.store";
    const result = await sendEmail({
      to: "buyer@example.com",
      subject: "Your sign-in link",
      html: "<p>Link</p>",
      kind: "auth_magic_link",
    });
    // No SMTP credentials in this test env, so it is 'skipped' - but the key
    // point is that Resend was never called.
    expect(result.status).toBe("skipped");
    expect(outboundFetch).not.toHaveBeenCalled();
  });
});
