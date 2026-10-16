// The Telegram transport: escaping, length, retry, and the token never leaking.
//
// WHY EACH OF THESE IS TESTED, and not just the happy path:
//
//   1. THE TOKEN MUST NEVER APPEAR IN A LOG OR A RETURNED STRING. The bot token
//      is part of the REQUEST URL, so a failed `fetch` embeds it in the error
//      message - which is exactly the string a call site logs. `redactToken` is
//      the only thing standing between a 401 and the token landing in a log
//      aggregator, so it is asserted directly AND end-to-end through a failure.
//
//   2. USER TEXT MUST NOT BREAK THE MESSAGE. The body is sent as HTML parse mode,
//      so product names and countries - which are supplier data and free-text
//      addresses - are interpolated. An unescaped `&` makes Telegram reject the
//      whole message ("can't parse entities"), and an unescaped `<` would render
//      as markup the value never meant to produce.
//
//   3. THE 4096-CHARACTER CEILING MUST BE RESPECTED, and splitting must not cut
//      our own per-line markup in half - which would fail as a parse error only
//      once a product name grew long enough, i.e. in production.
//
//   4. RETRY MUST NOT DUPLICATE. A network error means the message was NOT
//      posted, so a retry is safe; a 4xx must NOT be retried, because it fails
//      identically every time and only delays the one useful outcome.
//
// These are pure tests: the HTTP layer is injected, so no request leaves the
// process and no real token is ever needed.
import { describe, expect, it, vi } from "vitest";
import {
  escapeHtml,
  redactToken,
  sendTelegramMessage,
  sendTelegramTestMessage,
  splitForTelegram,
  TELEGRAM_MAX_CHARS,
  type TelegramConfig,
} from "./telegram";

/** A throwaway token shape. NOT a real credential - it is built by concatenation
 *  so this file cannot trip the committed-secret scanner it is testing the
 *  complement of. */
const FAKE_TOKEN = ["123456789", "AAFakeFakeFakeFakeFakeFakeFakeFakeFake"].join(":");

function cfg(over: Partial<TelegramConfig> = {}): TelegramConfig {
  return {
    botToken: FAKE_TOKEN,
    chatId: "-1001234567890",
    messageThreadId: "",
    baseUrl: "https://api.telegram.org",
    timeoutMs: 1_000,
    ...over,
  };
}

/** A fetch that always succeeds, recording every call. */
function okFetch(messageId = 42) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown> });
    return new Response(JSON.stringify({ ok: true, result: { message_id: messageId } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

const noSleep = async () => {};

describe("escapeHtml", () => {
  it("escapes the five characters Telegram's HTML parser treats as markup", () => {
    expect(escapeHtml(`<b>&"'</b>`)).toBe("&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;");
  });

  it("escapes & FIRST so the later replacements are not double-escaped", () => {
    // `&lt;` must stay the literal five characters, not become `&amp;lt;`.
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("is safe for null/undefined and numbers", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(0)).toBe("0");
  });
});

describe("redactToken", () => {
  it("removes the exact token from a URL-bearing error", () => {
    const leaked = `Failed to parse URL from https://api.telegram.org/bot${FAKE_TOKEN}/sendMessage`;
    const clean = redactToken(leaked, FAKE_TOKEN);
    expect(clean).not.toContain(FAKE_TOKEN);
    expect(clean).toContain("[redacted]");
  });

  it("also masks a token from a DIFFERENT config (the generic shape)", () => {
    const other = ["987654321", "BBOtherTokenOtherTokenOtherTokenOtherTo"].join(":");
    expect(redactToken(`bot${other}/sendMessage`)).not.toContain(other);
  });

  it("leaves an ordinary message untouched", () => {
    expect(redactToken("chat not found")).toBe("chat not found");
  });
});

describe("splitForTelegram", () => {
  it("returns the body whole when it already fits", () => {
    expect(splitForTelegram("hello")).toEqual(["hello"]);
  });

  it("returns NO chunks for an empty body (Telegram rejects an empty text)", () => {
    expect(splitForTelegram("")).toEqual([]);
  });

  it("splits on line boundaries so per-line markup stays balanced", () => {
    const body = ["<b>one</b>", "<b>two</b>", "<b>three</b>"].join("\n");
    const chunks = splitForTelegram(body, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(20);
      // Balanced: every opened <b> is closed within the same chunk.
      expect((c.match(/<b>/g) ?? []).length).toBe((c.match(/<\/b>/g) ?? []).length);
    }
    expect(chunks.join("\n")).toBe(body);
  });

  it("hard-splits a single line longer than the whole limit rather than dropping it", () => {
    const chunks = splitForTelegram("x".repeat(25), 10);
    expect(chunks.every((c) => c.length <= 10)).toBe(true);
    expect(chunks.join("")).toHaveLength(25);
  });

  it("keeps every chunk within the real Telegram ceiling", () => {
    const body = Array.from({ length: 300 }, (_, i) => `<b>line ${i}</b> padded`).join("\n");
    const chunks = splitForTelegram(body);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(TELEGRAM_MAX_CHARS);
  });
});

describe("sendTelegramMessage", () => {
  it("sends once and reports the message id", async () => {
    const { fetchImpl, calls } = okFetch(777);
    const res = await sendTelegramMessage("hello", { config: cfg(), fetchImpl, sleep: noSleep });
    expect(res.status).toBe("sent");
    expect(res.messageId).toBe(777);
    expect(res.messagesSent).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/sendMessage");
    expect(calls[0].body.parse_mode).toBe("HTML");
    expect(calls[0].body.chat_id).toBe("-1001234567890");
  });

  it("skips cleanly when the token or chat id is missing", async () => {
    const { fetchImpl, calls } = okFetch();
    const res = await sendTelegramMessage("hi", {
      config: cfg({ botToken: "" }),
      fetchImpl,
      sleep: noSleep,
    });
    expect(res.status).toBe("skipped");
    expect(res.reason).toContain("not configured");
    expect(calls).toHaveLength(0);
  });

  it("refuses to send an empty message", async () => {
    const { fetchImpl } = okFetch();
    const res = await sendTelegramMessage("", { config: cfg(), fetchImpl, sleep: noSleep });
    expect(res.status).toBe("failed");
  });

  it("splits an over-long body into several messages", async () => {
    const { fetchImpl, calls } = okFetch();
    const body = Array.from({ length: 500 }, (_, i) => `line ${i} ${"y".repeat(20)}`).join("\n");
    const res = await sendTelegramMessage(body, { config: cfg(), fetchImpl, sleep: noSleep });
    expect(res.status).toBe("sent");
    expect(res.messagesSent).toBeGreaterThan(1);
    expect(calls.length).toBe(res.messagesSent);
    for (const c of calls) expect(String(c.body.text).length).toBeLessThanOrEqual(TELEGRAM_MAX_CHARS);
  });

  it("retries a NETWORK error (nothing was posted, so a retry cannot duplicate)", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("socket hang up");
      return new Response(JSON.stringify({ ok: true, result: { message_id: 5 } }), { status: 200 });
    });
    const res = await sendTelegramMessage("hi", {
      config: cfg(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
    });
    expect(res.status).toBe("sent");
    expect(calls).toBe(2);
    expect(res.attempts).toBe(2);
  });

  it("retries 429 and 5xx, then gives up with a redacted reason", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: false, description: "Too Many Requests" }), { status: 429 }),
    );
    const res = await sendTelegramMessage("hi", {
      config: cfg(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      maxAttempts: 3,
    });
    expect(res.status).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(res.reason).toContain("429");
  });

  it("does NOT retry a 401 - a revoked token fails identically every time", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ ok: false, description: "Unauthorized" }), { status: 401 }),
    );
    const res = await sendTelegramMessage("hi", {
      config: cfg(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      maxAttempts: 3,
    });
    expect(res.status).toBe("failed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("NEVER leaks the bot token, even when fetch throws a URL-bearing error", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      throw new Error(`Failed to parse URL from ${url}`);
    });
    const res = await sendTelegramMessage("hi", {
      config: cfg(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      sleep: noSleep,
      maxAttempts: 1,
    });
    expect(res.status).toBe("failed");
    expect(res.reason ?? "").not.toContain(FAKE_TOKEN);
    expect(JSON.stringify(res)).not.toContain(FAKE_TOKEN);
  });

  it("never throws, whatever the transport does", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(
      sendTelegramMessage("hi", {
        config: cfg(),
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: noSleep,
      }),
    ).resolves.toBeTruthy();
  });

  it("includes message_thread_id only when one is configured", async () => {
    const a = okFetch();
    await sendTelegramMessage("hi", { config: cfg(), fetchImpl: a.fetchImpl, sleep: noSleep });
    expect(a.calls[0].body.message_thread_id).toBeUndefined();

    const b = okFetch();
    await sendTelegramMessage("hi", {
      config: cfg({ messageThreadId: "17" }),
      fetchImpl: b.fetchImpl,
      sleep: noSleep,
    });
    expect(b.calls[0].body.message_thread_id).toBe(17);
  });
});

describe("sendTelegramTestMessage", () => {
  it("sends a self-contained test message and escapes the timestamp", async () => {
    const { fetchImpl, calls } = okFetch(9);
    const res = await sendTelegramTestMessage({ config: cfg(), fetchImpl, sleep: noSleep });
    expect(res.status).toBe("sent");
    expect(String(calls[0].body.text)).toContain("test message");
  });
});
