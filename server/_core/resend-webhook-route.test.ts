// The webhook ROUTE, exercised through the real Hono app (`createApp`).
//
// This is the end-to-end shape of the security rule: an unsigned or
// badly-signed POST is a 400 and NOTHING is recorded; a correctly Svix-signed
// POST is a 200 and the event is recorded. The verifier itself is real (not
// mocked) so the test proves the wiring, not just the helper.
//
// `createApp` pulls in the tRPC router and the storage/jobs modules, so those
// are mocked to keep this a unit test of the webhook route. `./env` is mocked
// to supply a signing secret (the real one is env-only).
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = Buffer.from("route-test-signing-key-0123456789");
const SECRET = `whsec_${KEY.toString("base64")}`;

const recorded = vi.hoisted(() => ({ calls: [] as unknown[] }));

vi.mock("./env", () => ({
  env: {
    isProd: false,
    email: { resendApiKey: "", from: "", resendWebhookSecret: SECRET },
  },
}));
vi.mock("../routers", () => ({ appRouter: {} }));
vi.mock("./context", () => ({ createContext: () => ({}) }));
vi.mock("./storage", () => ({ serveAppStorage: () => new Response("", { status: 200 }) }));
// The job registry is mocked so importing app.ts (which registers the CJ sync
// jobs) does not need the real registry. `registerJob` must be present because
// app.ts imports ../services/cj-jobs for its side effect.
vi.mock("./jobs", () => ({ getJob: () => undefined, registerJob: () => undefined }));
vi.mock("../services/email-events", () => ({
  recordEmailEvent: vi.fn(async (r: unknown) => {
    recorded.calls.push(r);
    return { inserted: true };
  }),
}));

const { createApp } = await import("./app");

function sign(id: string, ts: number, body: string): string {
  return createHmac("sha256", KEY).update(`${id}.${ts}.${body}`).digest("base64");
}

const BODY = JSON.stringify({
  type: "email.delivered",
  data: { email_id: "msg_1", to: "a@example.com", subject: "Order confirmed" },
});

beforeEach(() => {
  recorded.calls = [];
});

describe("POST /api/webhooks/resend", () => {
  it("rejects an unsigned request with 400 and records nothing", async () => {
    const app = createApp();
    const res = await app.request("/api/webhooks/resend", { method: "POST", body: BODY });
    expect(res.status).toBe(400);
    expect(recorded.calls).toHaveLength(0);
  });

  it("rejects a bad signature with 400 and records nothing", async () => {
    const app = createApp();
    const ts = Math.floor(Date.now() / 1000);
    const res = await app.request("/api/webhooks/resend", {
      method: "POST",
      body: BODY,
      headers: {
        "svix-id": "msg_1",
        "svix-timestamp": String(ts),
        "svix-signature": "v1,not-a-real-signature",
      },
    });
    expect(res.status).toBe(400);
    expect(recorded.calls).toHaveLength(0);
  });

  it("accepts a correctly signed request with 200 and records the event", async () => {
    const app = createApp();
    const ts = Math.floor(Date.now() / 1000);
    const res = await app.request("/api/webhooks/resend", {
      method: "POST",
      body: BODY,
      headers: {
        "svix-id": "msg_1",
        "svix-timestamp": String(ts),
        "svix-signature": `v1,${sign("msg_1", ts, BODY)}`,
      },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; type: string; recorded: boolean };
    expect(json.ok).toBe(true);
    expect(json.type).toBe("email.delivered");
    expect(json.recorded).toBe(true);
    expect(recorded.calls).toHaveLength(1);
    expect((recorded.calls[0] as { svixId: string }).svixId).toBe("msg_1");
  });

  it("rejects a signed-but-unparseable body with 400", async () => {
    const app = createApp();
    const ts = Math.floor(Date.now() / 1000);
    const bad = "not json";
    const res = await app.request("/api/webhooks/resend", {
      method: "POST",
      body: bad,
      headers: {
        "svix-id": "msg_2",
        "svix-timestamp": String(ts),
        "svix-signature": `v1,${sign("msg_2", ts, bad)}`,
      },
    });
    expect(res.status).toBe(400);
    expect(recorded.calls).toHaveLength(0);
  });
});
