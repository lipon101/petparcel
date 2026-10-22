// ── Telegram transport - the owner's private notification channel ──────────
//
// WHAT THIS IS. A thin, hardened client for exactly one Telegram API call:
// `sendMessage`. It is the transport under `services/order-notify.ts`, which
// builds the order alert; this module knows nothing about orders, and the order
// module knows nothing about HTTP.
//
// WHY IT IS SEPARATE FROM THE EMAIL SERVICE. Email and Telegram fail in
// completely different ways and must be judged by different rules. Resend gives
// an idempotent HTTP API with a durable log table; Telegram gives a rate limit
// (429 with a `retry_after`), a per-message ceiling (4096 characters), and a
// body that PARSES our markup. Each of those needs its own handling, and mixing
// it into `email.ts` would make one 1300-line file responsible for two
// unrelated failure models.
//
// THE FOUR PROPERTIES THIS MODULE GUARANTEES:
//
//   1. THE TOKEN IS NEVER EXPOSED. The bot token is part of the REQUEST URL
//      (`/bot<token>/sendMessage`), which is exactly the shape that leaks: a
//      thrown `fetch` error, a logged response body and a stack trace all carry
//      the URL. So every string this module logs or RETURNS is passed through
//      `redactToken` first, and the raw token is never a field on any returned
//      object. A caller cannot accidentally print it, because it is never
//      handed one.
//
//   2. USER-SUPPLIED TEXT CANNOT BREAK OR INJECT. The body is sent with
//      `parse_mode: "HTML"`, so a product name or a country containing `<`, `>`
//      or `&` would either be rejected by Telegram ("can't parse entities") or
//      render as markup the shopper's data was never meant to produce. Every
//      interpolated value goes through `escapeHtml` before it reaches a message.
//
//   3. THE 4096-CHARACTER CEILING IS RESPECTED. Telegram rejects a longer
//      message outright, and `order-notify.ts` cannot know how long a catalogue
//      product name will be next year. `splitForTelegram` breaks an over-long
//      body into several messages on LINE boundaries (so our own per-line markup
//      stays balanced) and hard-splits only in the pathological case of a single
//      line longer than the whole limit. Length is measured with `String.length`
//      - UTF-16 units, which is >= the code-point count - so the check errs
//      toward splitting early and can never let a body through that Telegram
//      would reject.
//
//   4. IT NEVER THROWS. A notification is a SIDE EFFECT of a payment that has
//      already succeeded. If Telegram is down, rate-limiting, or misconfigured,
//      the caller must still complete: the order is paid, the receipt is sent,
//      CJ has the order. Every failure is returned as a `TelegramSendResult`,
//      never as an exception - which is what lets `order-notify.ts` sit directly
//      on the payment-confirmation path without endangering it.
//
// RETRY POLICY, and why it is split the way it is:
//   * RETRIED - a network error (we never reached Telegram, so nothing was
//     posted), HTTP 429 (rate limit, honouring the `retry_after` it returns), and
//     HTTP 5xx (Telegram's own fault).
//   * NOT RETRIED - HTTP 400/401/403/404. A malformed body, a revoked token or a
//     wrong chat id will fail IDENTICALLY on every attempt; retrying only delays
//     the one useful outcome, which is a clear error the owner can act on.
// The delays are short and bounded (0.5s, then 2s) because the caller is holding
// a serverless invocation open: a notification that costs 20 seconds to fail is
// worse than one that reports the failure immediately.
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";

/** Production API base. Overridable ONLY for a stub server in tests. */
export const TELEGRAM_DEFAULT_BASE = "https://api.telegram.org";

/** Telegram's hard per-message limit. A longer body is rejected with HTTP 400. */
export const TELEGRAM_MAX_CHARS = 4096;

/**
 * The target the message builder aims for, comfortably under the hard limit.
 *
 * WHY NOT `TELEGRAM_MAX_CHARS`. Splitting is a safety net, not the plan: several
 * short, complete messages read better than one that was cut in half, and the
 * builder (`order-notify.ts`) can cap its item list to stay under this. Keeping
 * a few hundred characters of headroom also means the emoji and the multi-byte
 * characters in a product name cannot push a body over between the length check
 * and the send.
 */
export const TELEGRAM_SAFE_CHARS = 3900;

/** Delays BEFORE each retry. Length = maxAttempts - 1. */
const RETRY_DELAYS_MS = [500, 2_000];

export interface TelegramConfig {
  /** The @BotFather token, shape `123456789:AAH...`. SERVER-SIDE ONLY. */
  botToken: string;
  /** Numeric id (`123456789`, `-1001234567890`) or a public `@handle`. */
  chatId: string;
  /** Optional `message_thread_id` for a forum/topics-enabled supergroup. */
  messageThreadId: string;
  baseUrl: string;
  timeoutMs: number;
}

export function telegramConfig(): TelegramConfig {
  return {
    botToken: env.telegram.botToken.trim(),
    chatId: env.telegram.chatId.trim(),
    messageThreadId: env.telegram.messageThreadId.trim(),
    baseUrl: (env.telegram.baseUrl || TELEGRAM_DEFAULT_BASE).replace(/\/+$/, ""),
    timeoutMs: env.telegram.timeoutMs,
  };
}

/**
 * Are BOTH the token and the destination set?
 *
 * Deliberately requires both. A token with no chat id cannot deliver anything,
 * and treating that half-configured state as "configured" would produce a
 * stream of confusing 400s instead of the one clear "not set up yet" line the
 * admin panel needs to show.
 *
 * Unset is a NORMAL state, not an error: notifications are skipped and the store
 * runs exactly as it did before this module existed.
 */
export function isTelegramConfigured(): boolean {
  const c = telegramConfig();
  return Boolean(c.botToken && c.chatId);
}

/**
 * Remove the bot token from any string that might be logged or returned.
 *
 * WHY THIS EXISTS AT ALL. The token lives in the REQUEST URL, so it is embedded
 * in every error a failed `fetch` can throw (`Failed to parse URL from
 * https://api.telegram.org/bot123456:AAH.../sendMessage`), in any response body
 * Telegram echoes back, and in a stack trace that includes the url. Those are
 * precisely the strings that end up in `console.error` and, on this store, in an
 * admin panel. Rather than trust every call site to remember, every error string
 * leaving this module is redacted HERE, at the source.
 *
 * Two passes, because the two shapes differ: the exact configured token, and the
 * generic `<digits>:<base64url>` shape (which also catches a token from a
 * different environment - e.g. a stale value a caller passed in).
 */
export function redactToken(text: string, token?: string): string {
  let out = String(text ?? "");
  const configured = (token ?? env.telegram.botToken ?? "").trim();
  if (configured) out = out.split(configured).join("[redacted]");
  // The generic shape, so a token from another env/config is masked too. The
  // quantifier braces keep this file from matching its own source text.
  out = out.replace(/bot\d{6,12}:[A-Za-z0-9_-]{20,}/g, "bot[redacted]");
  out = out.replace(/\b\d{6,12}:[A-Za-z0-9_-]{25,}\b/g, "[redacted]");
  return out;
}

/** A console sink that can never print the token, whatever it is handed. */
function logSafe(level: "log" | "warn" | "error", message: string): void {
  // eslint-disable-next-line no-console
  console[level](redactToken(message));
}

/**
 * Escape a value for Telegram's HTML parse mode.
 *
 * The five characters Telegram's parser treats as markup. `&` MUST be replaced
 * first, or the ampersands introduced by the later replacements would themselves
 * be double-escaped and render as literal `&amp;lt;`.
 *
 * Quotes are escaped as well as the brackets: the messages use
 * `<a href="...">`, and an unescaped quote in an interpolated value inside an
 * attribute would close it early.
 */
export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Break a body into messages Telegram will accept.
 *
 * Splits on NEWLINES, not on a character count, and that is the whole trick: the
 * markup in these messages is balanced per line (`<b>x</b>`), so cutting between
 * lines keeps every chunk valid HTML. Cutting at an arbitrary offset would
 * sooner or later slice a `<b>` in half and Telegram would reject the chunk with
 * "can't parse entities" - a failure that only appears once a product name grows
 * long enough, i.e. in production.
 *
 * The one case a line boundary cannot help with is a single line longer than the
 * whole limit (a pathological product name). That line is hard-split, because
 * the alternative is not sending it at all.
 *
 * An empty body yields NO messages rather than one empty one - Telegram rejects
 * an empty `text`.
 */
export function splitForTelegram(text: string, limit: number = TELEGRAM_MAX_CHARS): string[] {
  const body = String(text ?? "");
  if (body.length === 0) return [];
  const max = Math.max(1, Math.floor(limit));
  if (body.length <= max) return [body];

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length > 0) chunks.push(current);
    current = "";
  };

  for (const line of body.split("\n")) {
    let remaining = line;
    // A single line that cannot fit in a message of its own: emit it in
    // limit-sized pieces. Rare, and better than dropping the tail.
    while (remaining.length > max) {
      flush();
      chunks.push(remaining.slice(0, max));
      remaining = remaining.slice(max);
    }
    const candidate = current.length > 0 ? `${current}\n${remaining}` : remaining;
    if (candidate.length > max) {
      flush();
      current = remaining;
    } else {
      current = candidate;
    }
  }
  flush();
  return chunks;
}

export interface TelegramSendResult {
  status: "sent" | "skipped" | "failed";
  /** Present on `skipped`/`failed`. ALWAYS redacted - safe to store and display. */
  reason?: string;
  /** The `message_id` of the LAST message delivered, when Telegram returned one. */
  messageId?: number | null;
  /** How many messages actually landed (a long body may need several). */
  messagesSent?: number;
  /** Total HTTP attempts made across all chunks, for the log line. */
  attempts?: number;
}

export interface TelegramDeps {
  /** Injected in tests. Defaults to the platform's controlled outbound fetch. */
  fetchImpl?: typeof outboundFetch;
  /** Injected in tests so the backoff is exercised without real delay. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected in tests; defaults to the environment. */
  config?: TelegramConfig;
  /** Total attempts per message, including the first. Default 3. */
  maxAttempts?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** One attempt at one message. Never throws - every failure is a value. */
type AttemptResult =
  | { ok: true; messageId: number | null }
  | { ok: false; retryable: boolean; reason: string; retryAfterMs?: number };

async function postOnce(
  cfg: TelegramConfig,
  text: string,
  fetchImpl: typeof outboundFetch,
): Promise<AttemptResult> {
  // The token forms part of the PATH, per Telegram's own API design. That is
  // exactly why every string below is redacted before it can escape.
  const url = `${cfg.baseUrl}/bot${cfg.botToken}/sendMessage`;
  const threadId = Number(cfg.messageThreadId);
  const body: Record<string, unknown> = {
    chat_id: cfg.chatId,
    text,
    parse_mode: "HTML",
    // A notification is a list of links; a preview card for each one would
    // triple the message height and bury the order details.
    disable_web_page_preview: true,
  };
  if (Number.isFinite(threadId) && threadId > 0) body.message_thread_id = threadId;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      timeoutMs: cfg.timeoutMs,
    });
  } catch (e) {
    // We never reached Telegram: the message was NOT posted, so a retry cannot
    // duplicate anything. The error text carries the token-bearing URL, hence
    // redactToken - this is the single most important call in the module.
    return {
      ok: false,
      retryable: true,
      reason: `Could not reach Telegram: ${redactToken((e as Error).message)}`,
    };
  }

  const raw = await res.text().catch(() => "");
  let parsed: {
    ok?: boolean;
    description?: string;
    error_code?: number;
    parameters?: { retry_after?: number };
    result?: { message_id?: number };
  } = {};
  try {
    parsed = raw ? (JSON.parse(raw) as typeof parsed) : {};
  } catch {
    parsed = {};
  }

  if (res.ok && parsed.ok !== false) {
    return { ok: true, messageId: parsed.result?.message_id ?? null };
  }

  // Telegram's own human-readable sentence, e.g. "chat not found" or "Bad
  // Request: can't parse entities". Redacted: a bot token inside a chat_id
  // mistake is unusual but not impossible, and this string is surfaced.
  const detail = redactToken(parsed.description ?? raw.slice(0, 200) ?? `HTTP ${res.status}`);
  const retryAfterMs =
    typeof parsed.parameters?.retry_after === "number"
      ? parsed.parameters.retry_after * 1000
      : undefined;

  // 429 (rate limit) and 5xx (Telegram's fault) are worth another attempt. A
  // 4xx is not: a revoked token or a wrong chat id fails identically every time.
  const retryable = res.status === 429 || res.status >= 500;
  return {
    ok: false,
    retryable,
    reason: `Telegram rejected the message (${res.status}): ${detail}`,
    retryAfterMs,
  };
}

/**
 * Send one message, retrying the retryable failures with backoff.
 * Returns the last attempt's outcome; never throws.
 */
async function sendWithRetry(
  cfg: TelegramConfig,
  text: string,
  fetchImpl: typeof outboundFetch,
  sleep: (ms: number) => Promise<void>,
  maxAttempts: number,
): Promise<{ result: AttemptResult; attempts: number }> {
  const attempts = Math.max(1, maxAttempts);
  let attemptsMade = 0;
  let last: AttemptResult = { ok: false, retryable: false, reason: "no attempt was made" };

  for (let i = 0; i < attempts; i += 1) {
    attemptsMade += 1;
    last = await postOnce(cfg, text, fetchImpl);
    if (last.ok) return { result: last, attempts: attemptsMade };
    if (!last.retryable) return { result: last, attempts: attemptsMade };
    if (i === attempts - 1) break;
    // Honour Telegram's own pacing when it tells us (429), otherwise use the
    // fixed backoff ladder. Never less than the ladder, so a hostile or absent
    // `retry_after` cannot turn this into a hot loop.
    const ladder = RETRY_DELAYS_MS[Math.min(i, RETRY_DELAYS_MS.length - 1)];
    const wait = Math.max(ladder, last.retryAfterMs ?? 0);
    await sleep(wait);
  }

  return { result: last, attempts: attemptsMade };
}

/**
 * Deliver a message to the owner's Telegram chat.
 *
 * NEVER THROWS, and never returns a string carrying the bot token. A caller on
 * the payment path can therefore call this without a try/catch and without
 * endangering the order flow.
 *
 * A body longer than the limit is delivered as several messages; if a LATER
 * chunk fails permanently the result is `failed` while `messagesSent` reports
 * how many did land, so the owner's view of what was delivered stays truthful
 * rather than guessing.
 */
export async function sendTelegramMessage(
  text: string,
  deps: TelegramDeps = {},
): Promise<TelegramSendResult> {
  try {
    const cfg = deps.config ?? telegramConfig();
    if (!cfg.botToken || !cfg.chatId) {
      return {
        status: "skipped",
        reason:
          "Telegram is not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in the environment).",
        messagesSent: 0,
        attempts: 0,
      };
    }

    const chunks = splitForTelegram(text);
    if (chunks.length === 0) {
      return { status: "failed", reason: "Refused to send an empty message.", messagesSent: 0, attempts: 0 };
    }

    const fetchImpl = deps.fetchImpl ?? outboundFetch;
    const sleep = deps.sleep ?? defaultSleep;
    const maxAttempts = deps.maxAttempts ?? 2 + RETRY_DELAYS_MS.length;

    let messagesSent = 0;
    let attempts = 0;
    let lastMessageId: number | null = null;

    for (const chunk of chunks) {
      const { result, attempts: used } = await sendWithRetry(
        cfg,
        chunk,
        fetchImpl,
        sleep,
        maxAttempts,
      );
      attempts += used;
      if (!result.ok) {
        // `result.reason` is already redacted by `postOnce`. Log it, but never
        // the body and never the URL.
        logSafe("error", `[telegram] send failed after ${used} attempt(s): ${result.reason}`);
        return {
          status: "failed",
          reason: result.reason,
          messagesSent,
          attempts,
          messageId: lastMessageId,
        };
      }
      messagesSent += 1;
      lastMessageId = result.messageId;
    }

    return { status: "sent", messageId: lastMessageId, messagesSent, attempts };
  } catch (e) {
    // Belt and braces: nothing above is expected to throw, but a notification
    // must never be the reason a payment path fails.
    const reason = redactToken(`Unexpected Telegram error: ${(e as Error).message}`);
    logSafe("error", `[telegram] ${reason}`);
    return { status: "failed", reason, messagesSent: 0, attempts: 0 };
  }
}

/**
 * Send a test notification, for the setup check in the docs and the admin panel.
 *
 * Takes no order and touches no order table: it exists so the owner can prove
 * the token, the chat id and the bot's channel membership are right BEFORE the
 * first real order arrives, instead of discovering a typo from a missed sale.
 */
export async function sendTelegramTestMessage(deps: TelegramDeps = {}): Promise<TelegramSendResult> {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const body = [
    "🐾 <b>PetParcel - Telegram notifications are live</b>",
    "",
    "This is a test message. Every <b>paid</b> order will arrive here with the",
    "order number, the amount, the products and the customer's country.",
    "",
    `Sent ${escapeHtml(now)} UTC`,
  ].join("\n");
  return sendTelegramMessage(body, deps);
}
