// Central, validated env access. Platform SDK only - business code should not
// read process.env directly.
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";

// Variables the platform itself injects. User config must not claim these
// names, and must not be read through the two accessors below either -
// platform values have their own typed fields (env.databaseUrl / env.jwtSecret
// / …). This list must match core/webapp_builder/scaffold.py's
// RESERVED_ENV_KEYS on the backend exactly - tests/test_webapp_builder_docs.py
// asserts the two are identical.
const RESERVED_ENV_KEYS = new Set([
  "DATABASE_URL", "DB_DRIVER", "DB_POOL_MAX", "JWT_SECRET", "AUTH_PROVIDER",
  "APP_SLUG", "APP_STORAGE_PRESIGN_URL", "APP_STORAGE_TOKEN",
  "NODE_ENV", "PORT", "API_PORT",
]);

// The scope is part of the instruction, not decoration: dev and prod hold
// SEPARATE values for the same key, so "add it in Settings" without saying
// WHICH column sends a user to fill the one they already filled. `isProd` is
// exactly the distinction the settings panel draws (spec §7.1).
const SETTINGS_HINT =
  `Add it in Settings → Environment variables (${isProd ? "prod" : "dev"})`;

function userVar(name: string): string | undefined {
  if (RESERVED_ENV_KEYS.has(name)) {
    throw new Error(
      `${name} is a platform variable - read it from env.* instead of env.config/env.secret`,
    );
  }
  return process.env[name];
}

export const env = {
  isProd,
  // LAZY on purpose. These two used to be `required(...)` calls evaluated at
  // module load, which meant importing ANY module that transitively reached
  // env.ts (api/index.ts → app.ts → context.ts → db.ts → env.ts) threw before
  // the serverless function could answer a single request. On Vercel that
  // surfaced as `FUNCTION_INVOCATION_FAILED` (HTTP 500) on every /api, /trpc
  // and /app-storage call - including /api/health - whenever DATABASE_URL or
  // JWT_SECRET was unset, and the storefront's product list came back empty.
  // A getter defers the check to the moment the value is actually USED, so the
  // function boots, /api/health answers, and a missing var produces a clear
  // error at the call site instead of a blank 500 at the edge.
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },
  // DB driver select (see db.ts). "tcp" = node-postgres pool (default, portable,
  // right for a resident process); "http" = Neon serverless HTTP (Neon DSN +
  // scale-to-zero only). Absent ⇒ "tcp" so the template works on any Postgres.
  dbDriver: (process.env.DB_DRIVER ?? "tcp") as "tcp" | "http",
  // Max TCP connections this app's pool may hold. Only the "tcp" driver has a
  // pool; "http" opens a connection per request and ignores this.
  //
  // 5, not node-postgres' default of 10: that default suits an app that owns its
  // database server. On the platform every app gets its own database on ONE
  // SHARED cluster, so the number that matters is (apps under active iteration
  // x max), and a handful of idle-but-open pools can exhaust the cluster's
  // connection slots long before any single app needs ten.
  //
  // `|| 5` also catches a non-numeric value: `Number("八")` is NaN, and a pool
  // built with max: NaN is a subtle production fault rather than a startup error.
  dbPoolMax: Math.max(1, Number(process.env.DB_POOL_MAX) || 5),
  get jwtSecret(): string {
    return required("JWT_SECRET");
  },
  authProvider: (process.env.AUTH_PROVIDER ?? "local") as "local" | "sso" | "neon",
  // Neon Auth (Better Auth). Values come from the Neon console's Auth tab and
  // are read from the environment ONLY - never hardcoded. `url` is the Auth base
  // URL (…/<db>/auth); `jwksUrl` defaults to `<url>/.well-known/jwks.json` when
  // unset. Both are optional: with AUTH_PROVIDER=local (the default) they are
  // never read, so an unconfigured deployment keeps working on the local path.
  neonAuth: {
    url: process.env.NEON_AUTH_URL ?? "",
    jwksUrl: process.env.NEON_AUTH_JWKS_URL ?? "",
  },
  appSlug: process.env.APP_SLUG ?? "app",
  port: Number(process.env.PORT ?? 3000),
  apiPort: Number(process.env.API_PORT ?? 3001),
  // ── Upstream supplier integration ─────────────────────────────────────────
  // The store fulfils through CJ. `apiKey` is the CJ API key from
  // My CJ → Authorization → API (shape `CJUserNum@api@…`). Absent is a NORMAL
  // state, not an error: the integration then fails safe - it logs clearly and
  // does nothing, so checkout still works and no order is silently dropped.
  //
  // `liveMode` is the sandbox switch. It is FALSE by default, so orders are
  // created with CJ's `isSandbox: 1` flag (simulated payment, never fulfilled)
  // until the owner explicitly opts in. Turning it on is the single deliberate
  // act that lets a real supplier order be placed.
  cj: {
    apiKey: process.env.CJ_API_KEY ?? "",
    /** The CJ account email, recorded on the order remark for reconciliation. */
    email: process.env.CJ_EMAIL ?? "",
    /** Default CJ logistics route name (e.g. "CJPacket Ordinary"). */
    logisticName: process.env.CJ_LOGISTIC_NAME ?? "CJPacket Ordinary",
    /** Origin country the parcel ships from. */
    fromCountryCode: process.env.CJ_FROM_COUNTRY_CODE ?? "CN",
    /** TRUE = place REAL orders. Anything else (unset, "false", "0") = sandbox. */
    liveMode: /^(1|true|yes|on)$/i.test(process.env.CJ_LIVE_MODE ?? ""),
  },
  // ── Crypto payments (NOWPayments) ──────────────────────────────────────────
  // The store's payment rail. TWO credentials with two different jobs:
  //
  //   apiKey     authenticates OUR OUTBOUND calls (create an invoice, read a
  //              payment's status). It can move money, so it is read here and
  //              used ONLY in server/services/nowpayments.ts - it is never sent
  //              to a browser and never logged.
  //   ipnSecret  verifies THEIR INBOUND callbacks (HMAC-SHA512 over the body,
  //              compared to the `x-nowpayments-sig` header). Absent, the IPN
  //              route refuses every request rather than trusting an unsigned
  //              one; payments are then still confirmed by the pull path.
  //
  // Both are read from the environment ONLY - never the DB, never committed.
  // An empty apiKey is a NORMAL state, not an error: checkout records the order
  // unpaid for offline settlement, exactly as it did before crypto was enabled.
  nowpayments: {
    apiKey: process.env.NOWPAYMENTS_API_KEY ?? "",
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET ?? "",
    /** Optional fixed `pay_currency` (e.g. "usdttrc20"). Empty = the shopper
     *  picks any coin on NOWPayments' hosted invoice. */
    payCurrency: process.env.NOWPAYMENTS_PAY_CURRENCY ?? "",
    /** API base. Defaults to production; overridable only for a test stub. */
    baseUrl: process.env.NOWPAYMENTS_API_BASE ?? "",
  },
  // ── Telegram order notifications (owner's private channel) ───────────────
  // A private, real-time ping to the store owner the moment a payment SETTLES.
  // Sent from the same verified payment paths as the paid receipt (see
  // services/order-notify.ts), so a forged return URL can never trigger one.
  //
  //   botToken  the bot's API token from @BotFather, shape `123456:AA...`. It
  //             can post as the bot, so it stays server-side ONLY - never sent
  //             to a browser, never logged, never returned in an error.
  //   chatId    the destination: the owner's numeric user id (`123456789`) or a
  //             channel/supergroup id (`-1001234567890`). A leading `@`
  //             (@petparcelbot-style public handle) is also accepted verbatim.
  //
  // Both blank is a NORMAL state, not an error: notifications are simply skipped
  // and the store runs exactly as before, so checkout is never blocked.
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    chatId: process.env.TELEGRAM_CHAT_ID ?? "",
    /** Optional `message_thread_id` for a forum/topics-enabled supergroup. */
    messageThreadId: process.env.TELEGRAM_MESSAGE_THREAD_ID ?? "",
    /** API base. Defaults to production; overridable only for a test stub. */
    baseUrl: process.env.TELEGRAM_API_BASE ?? "",
    /** Per-attempt timeout, then the next backoff step. */
    timeoutMs: Number(process.env.TELEGRAM_TIMEOUT_MS ?? 10_000) || 10_000,
  },
  storage: {
    presignUrl: process.env.APP_STORAGE_PRESIGN_URL ?? "",
    token: process.env.APP_STORAGE_TOKEN ?? "",
  },
  // Transactional email goes out through Resend's HTTPS API (outbound HTTP,
  // a supported capability). An empty key is a normal state, not an error -
  // the store simply records the email as 'skipped' instead of sending.
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    // Optional default From address (`Name <local@domain>` or a bare address).
    // The store's Settings -> Email value wins when set; this is the fallback
    // for a deployment that would rather keep the sender in the environment.
    from: process.env.EMAIL_FROM ?? "",
    // Resend signs webhooks with Svix. The signing secret (`whsec_...`) is read
    // from the environment ONLY - never the DB, never committed. Absent, the
    // webhook receiver refuses every request (it cannot verify a signature it
    // has no key for), which is the safe default.
    resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    // The From header for AUTH emails (signup verification, password reset,
    // magic link). When the app delivers those itself (the Neon Auth email
    // webhook path) it must NOT go out from the orders
    // inbox, so this is separate from `from` above and the store's Settings →
    // Email value never overrides it. Optional: an unset value falls back to the
    // auth sender on the owner's own domain in code. Name only, never a value.
    authFrom: process.env.AUTH_EMAIL_FROM ?? "",
    // ── Secondary SMTP provider (Brevo) ──────────────────────────────────
    // Used for every NON-critical email (see _core/email-routing.ts), so
    // Resend's hard daily cap can never cut off sign-in links, password resets
    // or contact-form replies. A pure relay: it injects NO third-party branding
    // and sends from our own custom domain. Secrets from the environment ONLY.
    // The BREVO_* names are the documented ones; the bare SMTP_* names remain a
    // FALLBACK alias so a deployment that already set them keeps working (a
    // BREVO_* value wins when both are present). Secrets from the environment
    // ONLY - never hardcoded, never committed.
    smtpHost: process.env.BREVO_SMTP_HOST ?? process.env.SMTP_HOST ?? "",
    smtpPort: Number(process.env.BREVO_SMTP_PORT ?? process.env.SMTP_PORT ?? 587) || 587,
    smtpUser: process.env.BREVO_SMTP_USER ?? process.env.SMTP_USER ?? "",
    smtpPass: process.env.BREVO_SMTP_PASS ?? process.env.SMTP_PASS ?? "",
    // Implicit TLS (port 465). Default false = STARTTLS upgrade, which is what
    // 587/2525 use. Never disables certificate verification.
    smtpSecure:
      (process.env.BREVO_SMTP_SECURE ?? process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
    // The From header for the secondary provider. Falls back to the shared
    // EMAIL_FROM, then to a bare address, so a deployment that sets only one
    // sender still sends. Name only, never a value.
    secondaryFrom: process.env.BREVO_FROM_EMAIL ?? "",
    // The `X-Mailer` identity every secondary-provider message advertises.
    // Defaults to the brand name; overridable so it is never tied to a library
    // or relay fingerprint. Not a secret - a display value only.
    smtpXMailer: process.env.SMTP_X_MAILER ?? "PetParcel",
  },

  /**
   * A user-supplied, PLAINTEXT configuration value set in the settings panel.
   * Pass `fallback` when a sensible default exists.
   *
   * Call this where you use the value, not at module top level - a top-level
   * call would let one unset variable take down the whole app, including
   * every page that does not need it.
   */
  config(name: string, fallback?: string): string {
    const v = userVar(name);
    if (v === undefined || v === "") {
      if (fallback !== undefined) return fallback;
      throw new Error(`Missing configuration: ${name}. ${SETTINGS_HINT}.`);
    }
    return v;
  },

  /**
   * A user-supplied SECRET set in the settings panel.
   *
   * Deliberately no `fallback` parameter: a secret with a default is
   * self-contradictory - falling back to a fake key would only turn "no key
   * configured" into "the third party returned 401", moving the failure as
   * far from its cause as possible.
   */
  secret(name: string): string {
    const v = userVar(name);
    if (!v) {
      throw new Error(`Missing secret: ${name}. ${SETTINGS_HINT}.`);
    }
    return v;
  },
};
