// ── AGENT-OWNED: tRPC API surface ────────────────────────────────────────────
// Procedures stay thin: validate with zod, call server/db.ts for data, and
// server/services/* for external systems. Access levels come from _core/trpc:
// publicProcedure (anyone) / protectedProcedure (ctx.user set) / adminProcedure.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure, adminProcedure } from "./_core/trpc";
import {
  authProvider,
  authProviderUsesNeon,
  changePassword,
  clearOAuthChallengeCookie,
  googleSignInStart,
  loginViaGoogleVerifier,
  readOAuthChallengeCookie,
  registerLocalUser,
  registerNeonUser,
  requestOrigin,
  setOAuthChallengeCookie,
  AuthError,
  EmailTakenError,
  type RegisteredUser,
} from "./_core/auth";
import { googleCallbackUrl } from "../shared/google-auth";
import { neonAuthBaseUrl, neonAuthRequestPasswordReset, neonAuthResetPassword, NeonAuthOriginError } from "./_core/neon-auth";
import { assertTurnstile } from "./_core/turnstile";
import type { SessionUser } from "../shared/types";
import {
  isEmailVerified,
  resendVerificationForEmail,
  sendVerificationEmailForToken,
  verifyEmailToken,
} from "./_core/email-verification";
import { SignupValidationError, sanitizeSignupName } from "../shared/signup-validation";
import { searchFilterQuery, SEARCH_TERM_MAX } from "../shared/search-term";
import { resolvePaging } from "../shared/admin-paging";
// Imported from the leaf module (not `_core/db`) on purpose: `_core/db` binds
// the whole driver + env at import time, which would force a live DATABASE_URL
// into every test that merely imports this router.
import { isDbUnavailable, isUniqueViolation, schemaDriftDetail } from "./_core/db-errors";
import * as q from "./db";
import { getSettings, updateSettings } from "./store-settings";
import { resolvePromoSlots } from "./promo";
import {
  getOrderRawPaymentData,
  getProvider,
  listProviders,
  reconcileOrderPayment,
  RefundError,
  refundOrderPayment,
  verifyPayment,
} from "./services/payments";
import { forwardOrderToCj } from "./services/cj-order-forward";
import {
  EMAIL_KIND_LABEL,
  listEmailsForOrder,
  listRecentEmails,
  sendShippingNotification,
  sendWelcomeEmail,
  sendAdminNewOrderEmail,
  absoluteUrl,
  toEmailLines,
  type EmailKind,
} from "./services/email";
// The paid receipt. Sent ONLY from a verified payment path (the IPN webhook, the
// live reconciliation, or the post-return confirmation), gated on a settled
// status and idempotent via an atomic claim. See services/order-receipt.ts.
import { sendPaidReceiptOnce } from "./services/order-receipt";
// The owner's private Telegram ping. Sent from the SAME verified payment paths
// as the receipt and gated on the same settled status, but idempotent on its own
// claim (`orders.telegram_notified_at`), so the two side effects are independent:
// one failing never suppresses the other. Never throws - see
// services/order-notify.ts - so it is safe to await here.
import { notifyPaidOrderOnce } from "./services/order-notify";
import {
  StorageError,
  storageCommit,
  storagePutUrl,
  publicPathFor,
} from "./_core/storage";
import {
  LOW_STOCK_MAX,
  LOW_STOCK_MIN,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  slugify,
  sortCategories,
  type StoreCategoryNode,
} from "../shared/store";
import { callerKey, createRateLimiter, enforceRateLimit } from "./_core/rate-limit";
import {
  assertNotLocked,
  clearFailures,
  loginKeys,
  recordFailure,
  LOGIN_ACCOUNT_RULE,
  LOGIN_IP_RULE,
  SIGNUP_IP_RULE,
} from "./_core/login-throttle";
import {
  ADMIN_ACCOUNT_UNDELETABLE_MESSAGE,
  ADMIN_LOGIN_DENIED_MESSAGE,
  isAdminRole,
  isDesignatedAdmin,
} from "./_core/admin-access";
import { assertCardDetailsAcceptable } from "./_core/card-validate";
import { ipnCallbackUrl, orderUrl, siteOrigin } from "./_core/site-url";
import {
  CONTACT_MESSAGE_MAX,
  CONTACT_NAME_MAX,
  CONTACT_TOPICS,
  sanitizeMessage,
  sanitizePlainText,
  validateSignupEmail,
} from "../shared/signup-validation";
import { sendContactMessageEmail, sendContactReplyEmail } from "./services/email";
import { ingestMediaFromUrl, ingestOptimizedBytes, base64ToBytes } from "./services/media-ingest";

/** Best-effort welcome email for a newly created account. Never throws: the
 *  account already exists, so a mail problem must not fail the signup. */
async function sendWelcomeBestEffort(
  user: { email: string; name?: string | null },
  origin?: string | null,
): Promise<void> {
  try {
    const settings = await getSettings();
    await sendWelcomeEmail(
      {
        name: user.name ?? "",
        email: user.email,
        shopUrl: absoluteUrl(origin, "/shop"),
        accountUrl: absoluteUrl(origin, "/account"),
      },
      settings,
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[auth.signup] welcome email failed", e);
  }
}

/** Image types the platform's storage accepts. Mirrors the whitelist in
 *  _core/storage and names the reason, so an admin uploading a PDF to a product
 *  gallery gets a sentence rather than an opaque 500. */
const PRODUCT_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

/** Strip any path a caller could smuggle into the storage key. The uuid prefix
 *  already makes the key unique; this keeps the readable tail honest. */
function sanitizeBasename(name: string): string {
  const tail = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = tail
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-60);
  return cleaned || "upload";
}

/** Keep only our OWN storage read paths, at most five.
 *
 *  A review photo is served from `/app-storage/<key>`. Anything that is not
 *  exactly that shape - an off-site URL, a `data:` URI, a `javascript:` payload -
 *  is dropped rather than stored, so a review can never be used to smuggle an
 *  arbitrary URL onto the page. */
function sanitizeReviewImages(images: string[] | undefined): string[] {
  if (!images) return [];
  return images
    .map((s) => s.trim())
    .filter((s) => s.startsWith("/app-storage/") && !s.includes(".."))
    .filter((s) => /^\/app-storage\/[A-Za-z0-9._\/-]{1,380}$/.test(s))
    .slice(0, 5);
}

/** Translate a StorageError into the tRPC error an admin can act on. */
function storageErrorToTrpc(e: unknown): never {
  if (e instanceof StorageError) {
    if (e.code === "not_configured") {
      // The message now names the exact next step (which variables to set)
      // rather than a dead end - it is written in _core/storage.ts so the
      // ingest path and the upload path give the SAME actionable sentence.
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: e.message });
    }
    if (e.code === "forbidden") {
      throw new TRPCError({ code: "FORBIDDEN", message: "That file name isn't allowed." });
    }
    if (e.code === "not_found") {
      throw new TRPCError({ code: "NOT_FOUND", message: "The upload didn't arrive - please try again." });
    }
    throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
  }
  throw e;
}

// ── shared zod fragments ─────────────────────────────────────────────────────
// ── abuse controls ────────────────────────────────────────────────────────────
// Two limiters, tuned separately because the things being protected have very
// different shapes: signing in is cheap and should tolerate a fat-fingered
// human, whereas placing an order writes rows and emails a human - a much lower
// ceiling is right. Both are per-caller (see callerKey) and in-memory, so a
// multi-instance burst is only partially seen; that is acceptable here because
// every rule they guard is also enforced on its own merits.
const loginLimiter = createRateLimiter({ windowMs: 60_000, max: 8 });
// Stricter than the customer login: the admin door is a single account, so a
// tighter per-IP bucket is affordable and makes grinding it much slower.
const adminLoginLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const signupLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 6 });
const orderLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });
const newsletterLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 12 });
const contactLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 5 });

const addressSchema = z.object({
  fullName: z.string().min(1, "Name is required"),
  line1: z.string().min(1, "Street address is required"),
  line2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().min(3, "ZIP code is required"),
  country: z.string().default("US"),
  phone: z.string().optional().nullable(),
});

const cartLineSchema = z.object({
  slug: z.string().min(1),
  variantId: z.string().nullable(),
  qty: z.number().int().min(1).max(99),
});

const productInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().optional(),
  description: z.string().default(""),
  category: z.string().min(1, "Category is required"),
  priceCents: z.number().int().min(0),
  compareAtCents: z.number().int().min(0).nullable().optional(),
  images: z.array(z.string()).default([]),
  /** The gallery, images AND videos. When sent it is the source of truth and
   *  `images` is derived from it; a third-party source URL is never stored. */
  media: z
    .array(z.object({ url: z.string().min(1).max(500), kind: z.enum(["image", "video"]) }))
    .max(5)
    .optional(),
  tags: z.array(z.string()).default([]),
  /** Real, checkable attributes for the Product Details tab. Optional: a product
   *  created without them simply shows fewer rows until they are filled in. */
  specs: z
    .object({
      materials: z.string().max(500).optional(),
      dimensions: z.string().max(500).optional(),
      weight: z.string().max(500).optional(),
      care: z.string().max(1000).optional(),
    })
    .optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const variantInputSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  priceCents: z.number().int().min(0),
  inventoryQty: z.number().int().min(0).default(0),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
  // Upstream supplier variant id. Optional; blank/null clears the mapping.
  cjVid: z.string().trim().min(1).nullable().optional(),
});

// ── auth ─────────────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(({ ctx }) => ctx.user),

  signup: publicProcedure
    .input(
      z.object({
        // Deliberately loose here: the shared validator owns the real rules and
        // its messages are written for the shopper, so a bad address gets a
        // helpful 400 rather than zod's generic "Invalid email".
        email: z.string().min(1, "Enter your email address."),
        password: z.string().min(1, "Enter a password."),
        name: z.string().optional(),
        origin: z.string().optional(),
        // Cloudflare Turnstile token from the browser widget. Optional in the
        // schema because the check is a no-op until TURNSTILE_SECRET_KEY is set
        // (see _core/turnstile.ts); once it is, a missing token is refused.
        turnstileToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Bot check FIRST, before any rate-limit bookkeeping or account work: a
      // scripted signup should not even consume the throttle budget.
      await assertTurnstile(input.turnstileToken, callerKey(ctx.c));
      enforceRateLimit(signupLimiter, `signup:${callerKey(ctx.c)}`);
      // DB-backed throttle: a burst of rejected signups from one host is refused
      // across instances, not just on the instance that happened to see it.
      const signupIpKey = `signup_ip:${callerKey(ctx.c)}`;
      await assertNotLocked([{ key: signupIpKey, rule: SIGNUP_IP_RULE }]);

      // ── Neon Auth path ──────────────────────────────────────────────────────
      // When Neon Auth is the active provider, the credential lives there, not
      // in our `users` table. We create the account in Neon Auth, bridge it to a
      // local row (linking an existing one by email so its role and history are
      // preserved), and set our session cookie from the Neon Auth session token.
      if (authProviderUsesNeon()) {
        let created: { user: SessionUser; providerToken: string };
        try {
          created = await registerNeonUser(
            input.email,
            input.password,
            input.name,
            // The REAL request origin, not the client-supplied string: Neon Auth
            // checks this against its trusted-origin allowlist, so it must be the
            // origin the browser actually sent.
            requestOrigin(ctx.c) ?? input.origin,
          );
        } catch (e: unknown) {
          if (e instanceof EmailTakenError) {
            await recordFailure(signupIpKey, SIGNUP_IP_RULE);
            throw new TRPCError({ code: "CONFLICT", message: e.message });
          }
          if (e instanceof SignupValidationError) {
            await recordFailure(signupIpKey, SIGNUP_IP_RULE);
            throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
          }
          // Neon Auth refuses a credential request whose `Origin` is missing or
          // not on its trusted-origin allowlist (400 MISSING_ORIGIN / 403
          // INVALID_ORIGIN). That is the CALLER's request being unusable, not a
          // server fault, so it must be a 400 - rethrowing it as an unknown
          // error is what turned it into an opaque 500. No failure is recorded:
          // this is a client misconfiguration, not an abuse signal, and the
          // rate limiter above already throttles a flood.
          if (e instanceof NeonAuthOriginError) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Sign-up could not be completed from this request. Please try again from the store's website.",
            });
          }
          throw e;
        }
        const { user, providerToken } = created;
        // Best-effort profile row; a failure must not fail the signup.
        await q
          .upsertProfile(user.id, { fullName: sanitizeSignupName(input.name) })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error("[auth.signup] profile upsert failed", e);
          });
        let signedIn = true;
        try {
          await authProvider().establishSession?.(ctx.c, user, providerToken);
        } catch (e) {
          signedIn = false;
          // eslint-disable-next-line no-console
          console.error("[auth.signup] account created but session could not be established", e);
        }
        await sendWelcomeBestEffort({ email: user.email, name: input.name }, input.origin ?? requestOrigin(ctx.c));
        return { ...user, emailVerified: false, verification: null, signedIn };
      }

      // ── Local (bcrypt) path ─────────────────────────────────────────────────
      // Phase 1 - create the account. This is the REAL write; a failure here is
      // a genuine signup failure and is reported as such (duplicate email,
      // invalid input, or a real database problem).
      let registered: RegisteredUser;
      try {
        registered = await registerLocalUser(input.email, input.password, input.name);
      } catch (e: unknown) {
        if (e instanceof EmailTakenError) {
          await recordFailure(signupIpKey, SIGNUP_IP_RULE);
          throw new TRPCError({ code: "CONFLICT", message: e.message });
        }
        if (e instanceof SignupValidationError) {
          await recordFailure(signupIpKey, SIGNUP_IP_RULE);
          throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
        }
        throw e;
      }
      const { user, verificationToken } = registered;

      // Phase 2 - side effects that must NOT fail the signup. The account
      // already exists, so a profile-row or mail problem is logged and the
      // shopper still gets a working account.
      await q
        .upsertProfile(user.id, { fullName: sanitizeSignupName(input.name) })
        .catch((e) => {
          // eslint-disable-next-line no-console
          console.error("[auth.signup] profile upsert failed", e);
        });
      const verification = await sendVerificationEmailForToken(
        user.email,
        verificationToken,
        input.origin,
      );

      // Phase 3 - establish the session. Best-effort: if the session cannot be
      // minted (e.g. JWT_SECRET is not configured on this deployment) the
      // account is STILL created, so we return an accurate result telling the
      // shopper to sign in rather than a misleading 500 that hides the fact
      // their account now exists.
      let signedIn = true;
      try {
        await authProvider().login(ctx.c, user.email, input.password);
      } catch (e) {
        signedIn = false;
        // eslint-disable-next-line no-console
        console.error("[auth.signup] account created but session could not be established", e);
      }
      await sendWelcomeBestEffort({ email: user.email, name: input.name }, input.origin ?? requestOrigin(ctx.c));
      return { ...user, emailVerified: false, verification, signedIn };
    }),

  verifyEmail: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const result = await verifyEmailToken(input.token);
      if (!result.ok) {
        const message =
          result.reason === "expired"
            ? "That verification link has expired. Request a new one below."
            : result.reason === "used"
              ? "That verification link has already been used."
              : "That verification link isn't valid.";
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }
      return { ok: true, email: result.email };
    }),

  resendVerification: publicProcedure
    .input(z.object({ email: z.string().min(1), origin: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(signupLimiter, `resend:${callerKey(ctx.c)}`);
      await resendVerificationForEmail(input.email, input.origin);
      // The same answer whether or not the address exists - no account probing.
      return { ok: true };
    }),

  login: publicProcedure
    .input(z.object({ email: z.email(), password: z.string() }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(loginLimiter, `login:${callerKey(ctx.c)}`);
      // DB-backed lockout, checked BEFORE the credential compare so a locked
      // account is refused without touching bcrypt. Two keys: the account (stops
      // grinding one address from many IPs) and the caller's IP (stops one host
      // spraying many addresses).
      const keys = loginKeys(input.email, callerKey(ctx.c));
      await assertNotLocked([
        { key: keys.account, rule: LOGIN_ACCOUNT_RULE },
        { key: keys.ip, rule: LOGIN_IP_RULE },
      ]);
      try {
        const user = await authProvider().login(ctx.c, input.email, input.password);
        // Success clears both counters, so earlier typos never accumulate into a
        // lockout for a legitimate user.
        await clearFailures([keys.account, keys.ip]);
        return user;
      } catch (e) {
        // A missing/untrusted Origin is the provider refusing the REQUEST, not a
        // bad credential: answer 400, and do NOT record a login failure (it is a
        // client misconfiguration, not a wrong-password attempt).
        if (e instanceof NeonAuthOriginError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Sign-in could not be completed from this request. Please try again from the store's website.",
          });
        }
        if (e instanceof AuthError) {
          await recordFailure(keys.account, LOGIN_ACCOUNT_RULE);
          await recordFailure(keys.ip, LOGIN_IP_RULE);
          throw new TRPCError({ code: "UNAUTHORIZED", message: e.message });
        }
        throw e;
      }
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await authProvider().logout(ctx.c);
    return { ok: true };
  }),

  // ── Google sign-in ─────────────────────────────────────────────────────
  // The store's Google sign-in. Neon Auth performs the whole OAuth exchange, so
  // these two procedures only start the flow and finish it - the client secret
  // stays with the provider and no authorisation code ever reaches this server.
  //
  // Two steps rather than a redirect from here, because the shopper must be sent
  // to GOOGLE's own consent screen: the provider answers with the URL to go to,
  // and the browser navigates itself. Doing it in two calls also means the
  // start is a normal tRPC response, so a failure is a clean message instead of
  // a half-finished redirect.

  /** The URL to send the browser to so it can sign in with Google.
   *
   *  Also returns the provider's own base URL. The callback needs it, because
   *  OAuth happens on the PROVIDER's origin: the session it establishes is a
   *  cookie for that origin, which `HttpOnly` then hides from our JavaScript. The
   *  only thing our page can obtain is the session token, and it has to ask the
   *  provider for it - so it needs to know where the provider is. That URL is
   *  already public (it is the address the browser is about to visit), so this
   *  discloses nothing that is not already in the redirect. */
  googleSignInStart: publicProcedure
    .mutation(async ({ ctx }) => {
      enforceRateLimit(loginLimiter, `google:${callerKey(ctx.c)}`);
      // The callback stays on ONE fixed path; the shopper's destination is
      // carried in the site's own page state (`?next=` on our own page), never
      // smuggled through the provider and never used to build a URL for it.
      const origin = requestOrigin(ctx.c);
      if (!origin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Google sign-in is not available right now." });
      }
      try {
        const { url, challengeCookie } = await googleSignInStart(ctx.c, googleCallbackUrl(origin));
        // Park the provider's OAuth challenge on OUR origin. The provider sets
        // its own copy `Partitioned` to its own origin, so the browser never
        // sends it back from here - and the verifier exchange at the callback
        // cannot succeed without it. This is the fix for the callback that used
        // to spin forever.
        if (challengeCookie) setOAuthChallengeCookie(ctx.c, challengeCookie);
        return { url, providerBaseUrl: neonAuthBaseUrl() };
      } catch (e) {
        if (e instanceof AuthError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
        }
        throw e;
      }
    }),

  /** Finish a Google sign-in. `verifier` is the one-time value the provider
   *  appended to the callback URL; the server exchanges it - with the challenge
   *  cookie parked at the start - for the provider session, VERIFIES it, bridges
   *  the account to a local `users` row (an existing account with the same
   *  address keeps its role and history) and mints the site's own cookie. */
  googleSignInComplete: publicProcedure
    .input(z.object({ verifier: z.string().min(8).max(500) }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(loginLimiter, `google-complete:${callerKey(ctx.c)}`);
      const challenge = readOAuthChallengeCookie(ctx.c);
      if (!challenge) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "That sign-in link has expired or was already used. Please start again.",
        });
      }
      try {
        const user = await loginViaGoogleVerifier(ctx.c, input.verifier, challenge);
        // The challenge is single-use; drop it now that it has been spent.
        clearOAuthChallengeCookie(ctx.c);
        // Never echo the token: the client only needs to know it worked and who
        // it is, so the session cookie can settle before it redirects.
        return { ok: true, user: { id: user.id, email: user.email, role: user.role } };
      } catch (e) {
        if (e instanceof AuthError) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: e.message });
        }
        throw e;
      }
    }),

  /** Ask the provider to email a password-reset link. Answers `{ ok: true }`
   *  whether or not the address exists, so the page can never be used to probe
   *  which emails have accounts. */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email().max(320), origin: z.string().url().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(loginLimiter, `reset-request:${callerKey(ctx.c)}`);
      if (!authProviderUsesNeon()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password reset is not available on this store.",
        });
      }
      const origin = input.origin ?? requestOrigin(ctx.c);
      if (!origin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Password reset is not available right now." });
      }
      try {
        await neonAuthRequestPasswordReset({
          email: input.email.trim().toLowerCase(),
          redirectTo: `${origin.replace(/\/+$/, "")}/reset-password`,
          origin: requestOrigin(ctx.c),
        });
      } catch (e) {
        // Log server-side only; the shopper is told nothing that could reveal
        // whether the address exists.
        // eslint-disable-next-line no-console
        console.error("[auth] password-reset request failed", e);
      }
      return { ok: true };
    }),

  /** Complete a password reset with the token from the emailed link. A bad or
   *  expired token is a 400 with a calm message, never a 500. */
  resetPassword: publicProcedure
    .input(z.object({ token: z.string().min(1).max(500), newPassword: z.string().min(8).max(200) }))
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(loginLimiter, `reset-complete:${callerKey(ctx.c)}`);
      if (!authProviderUsesNeon()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password reset is not available on this store.",
        });
      }
      try {
        await neonAuthResetPassword({
          token: input.token,
          newPassword: input.newPassword,
          origin: requestOrigin(ctx.c),
        });
        return { ok: true };
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That reset link is invalid or has expired. Please request a new one.",
        });
      }
    }),
});

// ── catalog (public reads) ───────────────────────────────────────────────────
// Every catalog read goes straight to the database. There is NO fallback to a
// bundled/demo catalog: the storefront must show the REAL catalogue or an honest
// error, never fabricated products. When the database is unreachable (a missing
// DATABASE_URL, a cold Neon endpoint, a schema that is behind the code) the read
// fails LOUDLY with a short, leak-free message - the real cause is logged
// server-side only - so a broken deployment is visible instead of silently
// serving stale demo data.
async function readCatalog<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (err) {
    if (isDbUnavailable(err)) {
      // The real cause stays server-side. When it is schema drift (a migration
      // committed but never applied) name the exact missing column/relation and
      // the fix, so an operator reading the log does not have to guess.
      const drift = schemaDriftDetail(err);
      // eslint-disable-next-line no-console
      console.error(
        drift ? `[catalog] schema drift: ${drift}` : "[catalog] database unavailable",
        err,
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "The store is temporarily unavailable. Please try again in a moment.",
      });
    }
    throw err;
  }
}

/** Parse a comma-separated id list into a de-duplicated, order-preserving array.
 *  Used by the home page featured-picks setting, which stores the owner's chosen
 *  product ids as one string. */
function dedupeIds(csv: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of csv.split(",")) {
    const id = raw.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

const catalogRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          category: z.string().max(120).optional(),
          // Capped at the shared ceiling so no caller can push a term longer
          // than the page would ever display into the data layer. The limit is
          // an ORDER OF MAGNITUDE above the longest real query, so it constrains
          // abuse without ever touching a genuine search.
          search: z.string().max(SEARCH_TERM_MAX).optional(),
          sort: z.enum(["featured", "price-asc", "price-desc", "newest", "name"]).optional(),
        })
        .optional(),
    )
    // The term is normalised at the EDGE of the pipeline (control characters
    // stripped, whitespace collapsed, length capped) so the data layer only ever
    // sees a term of the same shape the shop page echoed - the page and the
    // query cannot disagree about what was searched for.
    //
    // `searchFilterQuery` - NOT `sanitize(...) || undefined` - keeps the crucial
    // distinction between "no term supplied" (browse) and "a term supplied that
    // cannot match" (match nothing). The `|| undefined` form erased it, so a
    // one-character or metacharacter-only query came back as the whole catalogue.
    .query(({ input }) =>
      readCatalog(() =>
        q.listProducts({ ...(input ?? {}), search: searchFilterQuery(input?.search) }),
      ),
    ),

  featured: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).optional() }).optional())
    .query(({ input }) => readCatalog(() => q.listFeaturedProducts(input?.limit ?? 4))),

  // The home page "Just landed" rail: a DAILY-ROTATING pick of the whole
  // catalogue, resolved server-side from the database. The order is a hash of
  // the product id salted with the UTC date, so every visitor sees the same
  // eight on a given day and the set rotates at midnight UTC - the section is
  // dynamic and premium instead of the same static "newest 8" every day. Public:
  // the storefront reads it on every home page load.
  dailyRotation: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).optional() }).optional())
    .query(({ input }) => readCatalog(() => q.listDailyRotation(input?.limit ?? 8))),

  // The home page "Our featured picks" rail, resolved from the DATABASE at
  // request time: the owner's ordered picks when set, else the products flagged
  // `featured`, else the newest. Public - the storefront reads it on every home
  // page load, so an admin change shows up on the next load with no redeploy.
  featuredPicks: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).optional() }).optional())
    .query(({ input }) =>
      readCatalog(async () => {
        const settings = await getSettings();
        const ids = dedupeIds(String(settings.featured_pick_ids ?? ""));
        return q.listFeaturedPicks(ids, input?.limit ?? 4);
      }),
    ),

  // The home page's two promo cards, resolved from the DATABASE at request time.
  // The owner's admin-selected product for each card wins; a deleted or
  // unpublished pick falls back to the best available product (newest /
  // most-ordered) so a card is never empty or broken. Public: the storefront
  // reads it on every home page load, so an admin change shows up on the next
  // load with no redeploy. `readCatalog` gives the same honest empty/error
  // behaviour as the other catalog reads when the database is unreachable.
  promo: publicProcedure.query(() =>
    readCatalog(async () => {
      const slots = await resolvePromoSlots();
      return [slots.new_arrivals, slots.best_sellers].filter((s): s is NonNullable<typeof s> => s !== null);
    }),
  ),

  // The browse TREE: every top-level aisle with the subcategories filed under
  // it, each carrying its live product count. Aisle order comes from the shared
  // browse taxonomy (`shared/category-tree.ts`), so the shop page, the header
  // menus and the footer all render the same sequence; an aisle the taxonomy
  // does not know (an admin-invented one) is sorted after them, in catalog
  // order, rather than dropped.
  //
  // A product FILTER for an aisle name is expanded to include its
  // subcategories server-side (`categoryFilterValues` in server/db.ts), so
  // selecting a parent shows the gear stored on its children too.
  categories: publicProcedure.query(async (): Promise<StoreCategoryNode[]> => {
    const tree = await readCatalog(() => q.listCategories());
    const rows = await readCatalog(() => q.listProducts({ limit: 500 }));

    // Per-category live count from the grid the storefront actually serves,
    // used only for aisles that exist in the products table but have no row in
    // `categories` (a legacy name). Categories WITH a row already carry an
    // authoritative count from the DB.
    const liveCounts: Record<string, number> = {};
    for (const row of rows) liveCounts[row.category] = (liveCounts[row.category] ?? 0) + 1;

    const present = new Set<string>();
    for (const node of tree) {
      present.add(node.name);
      for (const child of node.children) present.add(child.name);
    }

    // Names the grid serves that have no category row at all - surfaced as
    // top-level tiles so no product is unreachable, in catalog order.
    const orphans = sortCategories(
      Array.from(new Set(rows.map((r) => r.category))).filter((name) => !present.has(name)),
    );

    const nodes: StoreCategoryNode[] = [
      ...tree.map((node) => ({
        id: node.id,
        name: node.name,
        slug: node.slug,
        productCount: node.productCount,
        featured: node.featured,
        children: node.children.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          productCount: c.productCount,
        })),
      })),
      ...orphans.map((name) => ({
        id: name,
        name,
        slug: slugify(name),
        productCount: liveCounts[name] ?? 0,
        featured: false,
        children: [],
      })),
    ];

    // Aisles we actually stock lead the row; the rest keep the taxonomy's order
    // behind them. The browse taxonomy is the store's target shelf set, not its
    // current stock, so a shopper must not have to scroll past ten empty aisles
    // to reach the ones with products - while every aisle stays reachable.
    return [...nodes.filter((n) => n.productCount > 0), ...nodes.filter((n) => n.productCount === 0)];
  }),

  // Live stock per category, for the surfaces that show only the best handful.
  // A map rather than an ordered array, so the ranking rule stays in one place
  // (shared/store.ts `topCategories`) instead of being split across the wire.
  categoryCounts: publicProcedure.query(async (): Promise<Record<string, number>> => {
    const rows = await readCatalog(() => q.listProducts({ limit: 500 }));
    const counts: Record<string, number> = {};
    for (const row of rows) counts[row.category] = (counts[row.category] ?? 0) + 1;
    return counts;
  }),

  bySlug: publicProcedure.input(z.object({ slug: z.string().min(1) })).query(async ({ input }) => {
    const product = await readCatalog(() => q.getProductBySlug(input.slug));
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    const [reviews, related] = await Promise.all([
      readCatalog(() => q.listProductReviews(product.id)),
      readCatalog(() => q.listRelatedProducts(product.id, product.category, 4)),
    ]);
    return { product, reviews, related };
  }),
});

// ── reviews ──────────────────────────────────────────────────────────────────
const reviewsRouter = router({
  store: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(24).optional() }).optional())
    .query(({ input }) => readCatalog(() => q.listStoreReviews(input?.limit ?? 6))),

  create: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        rating: z.number().int().min(1).max(5),
        title: z.string().max(120).optional(),
        body: z.string().min(10, "Tell us a little more").max(2000),
        // Buyer photos: only our OWN storage read path is accepted, so a review
        // can never be used to inject an arbitrary off-site URL. Capped at five.
        images: z.array(z.string().max(400)).max(5).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verified purchase is enforced HERE, on the server - the UI only reflects
      // it. A customer with no settled order for this product cannot review it.
      const orderId = await q.findPurchasedOrderForProduct(ctx.user.id, input.productId);
      if (!orderId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only customers who have bought this product can review it.",
        });
      }
      if (await q.hasReviewedProduct(ctx.user.id, input.productId)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already reviewed this product.",
        });
      }
      const profile = await q.getProfile(ctx.user.id);
      // Starts pending: an admin approves it before it is ever shown.
      return q.createReview({
        productId: input.productId,
        userId: ctx.user.id,
        orderId,
        authorName: profile?.fullName || ctx.user.name || "PetParcel customer",
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        verified: true,
        images: sanitizeReviewImages(input.images),
      });
    }),

  /** Whether the signed-in customer may review this product, and why not when
   *  they may not - so the product page can show the right message. */
  canReview: protectedProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const orderId = await q.findPurchasedOrderForProduct(ctx.user.id, input.productId);
      if (!orderId) return { canReview: false, reason: "not_purchased" as const };
      if (await q.hasReviewedProduct(ctx.user.id, input.productId)) {
        return { canReview: false, reason: "already_reviewed" as const };
      }
      return { canReview: true, reason: null };
    }),

  /** The product page's social proof, in ONE round trip: the recent REAL
   *  purchases of this product. Nothing is fabricated - a product with no
   *  settled order in the window returns an empty list, and the page then shows
   *  no toast rather than an invented one. Public on purpose: it is the same
   *  information a shopper standing in a shop would see, first name and city
   *  only. */
  recentPurchases: publicProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        limit: z.number().int().min(1).max(5).optional(),
      }),
    )
    .query(({ input }) => q.listRecentProductPurchases(input.productId, input.limit ?? 3)),

  /** Photo upload, step 1: a signed PUT URL for a verified buyer's review photo.
   *
   *  Gated - you must be signed in AND have at least one settled order - and the
   *  content type is checked against the same image whitelist the admin uploader
   *  uses, so the endpoint cannot be used as anonymous file storage. The bytes go
   *  straight to storage (step 2 is the browser's PUT). */
  photoUploadUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!PRODUCT_IMAGE_TYPES.has(input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That file type isn't supported. Use a PNG, JPEG, GIF or WebP image.",
        });
      }
      if (!(await q.hasAnyPurchasedOrder(ctx.user.id))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Review photos are reserved for customers with a settled order.",
        });
      }
      const key = `reviews/${crypto.randomUUID()}-${sanitizeBasename(input.filename)}`;
      try {
        const { uploadUrl, publicPath } = await storagePutUrl(key, input.contentType, {
          ownerId: ctx.user.id,
        });
        return { uploadUrl, key, publicPath };
      } catch (e) {
        storageErrorToTrpc(e);
      }
    }),

  /** Photo upload, step 3: index the object that just landed and hand back the
   *  public path to store on the review (step 2 is the browser's PUT). */
  photoCommit: protectedProcedure
    .input(z.object({ key: z.string().min(1).max(400), name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const rec = await storageCommit(input.key, { ownerId: ctx.user.id, name: input.name });
        return { key: rec.key, url: `/app-storage/${rec.key}` };
      } catch (e) {
        storageErrorToTrpc(e);
      }
    }),
});

// ── store settings ───────────────────────────────────────────────────────────
const settingsRouter = router({
  public: publicProcedure.query(() => getSettings()),
  providers: publicProcedure.query(() => listProviders()),

  // Change the ADMIN's password. The credential lives with the ACTIVE provider
  // (Neon Auth's hash is scrypt, not bcrypt), so this delegates to the provider
  // rather than writing `users.password_hash` - a local write would not change
  // what the live sign-in accepts. Admin-gated: only the designated admin can
  // rotate the store credential. A rejected current password is a 401, never a
  // 500, and neither password is ever logged.
  changePassword: adminProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1, "Enter your current password."),
        newPassword: z.string().min(8, "Use at least 8 characters.").max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await changePassword(ctx.c, input.currentPassword, input.newPassword);
        return { ok: true };
      } catch (e) {
        if (e instanceof AuthError) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: e.message });
        }
        throw e;
      }
    }),
});

// ── newsletter ───────────────────────────────────────────────────────────────
const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        // Capped and shape-checked before anything is stored, so only a real,
        // deliverable address can enter the list. `subscribeNewsletter` trims and
        // lower-cases it to one canonical form, so a padded or mixed-case paste
        // is deduped rather than stored twice.
        email: z.string().max(254, "That email address is too long.").email("Enter a valid email address"),
        source: z.string().max(40).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      enforceRateLimit(newsletterLimiter, `newsletter:${callerKey(ctx.c)}`);
      return q.subscribeNewsletter(input.email, input.source ?? "footer");
    }),
});

// ── contact ────────────────────────────────────────────────────────────────
const contactRouter = router({
  // Requires a signed-in account: the form is gated so no anonymous spam can be
  // submitted, and every message is linked to the real user id that sent it.
  // The client hides the form when signed out, but the server is the authority -
  // an unauthenticated call is rejected here with a safe UNAUTHORIZED error.
  submit: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Please add your name."),
        email: z.string().min(1, "Please add your email."),
        topic: z.enum(CONTACT_TOPICS as unknown as [string, ...string[]]).optional(),
        message: z.string().min(1, "Please add a message."),
        // See the signup procedure: no-op until Turnstile is configured.
        turnstileToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertTurnstile(input.turnstileToken, callerKey(ctx.c));
      enforceRateLimit(contactLimiter, `contact:${callerKey(ctx.c)}`);
      // Validate + sanitise BEFORE any write: strip control characters, collapse
      // whitespace, cap every field, and refuse a nonsense address. This is what
      // keeps the stored row safe to render and impossible to weaponise as an
      // injection or a scripted payload.
      const cleanName = sanitizePlainText(input.name, CONTACT_NAME_MAX);
      const cleanMessage = sanitizeMessage(input.message, CONTACT_MESSAGE_MAX);
      let cleanEmail: string;
      try {
        cleanEmail = validateSignupEmail(input.email);
      } catch (e) {
        if (e instanceof SignupValidationError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
        }
        throw e;
      }
      if (cleanName.length < 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please add your name." });
      }
      if (cleanMessage.length < 10) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Please add a little more detail." });
      }
      const topic =
        input.topic && (CONTACT_TOPICS as readonly string[]).includes(input.topic)
          ? input.topic
          : "Something else";
      try {
        const saved = await q.submitContactMessage({
          userId: ctx.user.id,
          name: cleanName,
          email: cleanEmail,
          topic,
          message: cleanMessage,
          source: "contact",
        });
        // Best-effort internal notification: the message is already stored, so a
        // mail outage must never turn into a failed submission for the shopper.
        if (saved) {
          await sendContactMessageEmail(
            { name: cleanName, email: cleanEmail, topic, message: cleanMessage, receivedAt: saved.createdAt ?? new Date() },
            await getSettings(),
          ).catch(() => undefined);
        }
        return { ok: true };
      } catch (e) {
        if (isDbUnavailable(e)) {
          // The one failure the shopper can act on: tell them to email us
          // directly rather than pretend the message was received.
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "We couldn't save your message just now. Please email support@petparcel.store directly.",
          });
        }
        throw e;
      }
    }),
});

// ── wishlist (per account) ───────────────────────────────────────────────────
// The wishlist is tied to the signed-in account and persisted in the database,
// so it follows the shopper across devices. Both procedures are protected: an
// anonymous caller is rejected with a safe UNAUTHORIZED error, and the client
// shows a "sign in to save" prompt instead of the heart acting on nothing.
const wishlistRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const ids = await q.listWishlistProductIds(ctx.user.id);
    if (ids.length === 0) return [];
    // Resolve the saved ids against the SAME catalog read the grid uses, so the
    // wishlist can never show a product the shop no longer stocks.
    const all = await readCatalog(() => q.listProducts({ limit: 500 }));
    const byId = new Map(all.map((p) => [p.id, p]));
    return ids
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }),

  toggle: protectedProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .mutation(({ ctx, input }) => q.toggleWishlistItem(ctx.user.id, input.productId)),
});

// ── cart ─────────────────────────────────────────────────────────────────────
// The SAVED cart. Every procedure below is a `protectedProcedure`, so an
// unauthenticated caller is refused by the server with UNAUTHORIZED before any
// handler runs - the client's gating is a convenience, never the control.
//
// OWNERSHIP IS BY CONSTRUCTION. No procedure accepts a cart id, a user id or an
// owner of any kind: each one takes the caller's identity from `ctx.user.id`,
// which the session middleware resolved. There is therefore no identifier to
// guess, replay or tamper with - one account cannot read or mutate another's
// basket even with a hand-written request.
//
// The client sends only WHAT is wanted (slug + variantId + qty); names, prices
// and stock ceilings are resolved here from the catalog, so a tampered payload
// can change what is DISPLAYED but never what is CHARGED.
const cartLineInput = z.object({
  slug: z.string().min(1),
  variantId: z.string().min(1).nullable(),
  qty: z.number().int().min(0).max(99),
});
/** Exported for the checkout price-integrity tests, which assert that a payload
 *  carrying a `price`/`total` cannot even be accepted (zod strips what the schema
 *  does not declare). */
export { cartLineInput as cartLineSchema };

/** Turn a client line reference into the catalog ids the data layer needs.
 *  A slug that is no longer sellable is a shopper-facing BAD_REQUEST, not a
 *  500 - the catalog can retire a product between browsing and adding. */
async function resolveCartLine(input: {
  slug: string;
  variantId: string | null;
}): Promise<{ productId: string; variantId: string | null }> {
  const product = await q.getProductBySlug(input.slug);
  if (!product) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "That product is no longer available." });
  }
  return { productId: product.id, variantId: input.variantId };
}

const cartRouter = router({
  /** The signed-in shopper's saved basket, priced from the live catalog. */
  get: protectedProcedure.query(({ ctx }) => q.getCart(ctx.user.id)),

  /** Add units to a line (merging into the existing line for the same option). */
  add: protectedProcedure.input(cartLineInput).mutation(async ({ ctx, input }) => {
    const { productId, variantId } = await resolveCartLine(input);
    await q.addCartItem(ctx.user.id, productId, variantId, input.qty);
    return q.getCart(ctx.user.id);
  }),

  /** Set one line to an exact quantity. Zero removes it. */
  setQty: protectedProcedure.input(cartLineInput).mutation(async ({ ctx, input }) => {
    const { productId, variantId } = await resolveCartLine(input);
    await q.setCartItemQty(ctx.user.id, productId, variantId, input.qty);
    return q.getCart(ctx.user.id);
  }),

  /** Remove one line. */
  remove: protectedProcedure
    .input(z.object({ slug: z.string().min(1), variantId: z.string().min(1).nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { productId, variantId } = await resolveCartLine(input);
      await q.removeCartItem(ctx.user.id, productId, variantId);
      return q.getCart(ctx.user.id);
    }),

  /** Empty the basket. */
  clear: protectedProcedure.mutation(async ({ ctx }) => {
    await q.clearCart(ctx.user.id);
    return q.getCart(ctx.user.id);
  }),

  /** Merge a guest basket into the signed-in cart in one call. Used by the
   *  sign-in RESTORE so a basket built before signing in is not lost. Additive
   *  by design - it can only add, never subtract, so a stale client cannot wipe
   *  a saved cart. */
  merge: protectedProcedure
    .input(z.object({ lines: z.array(cartLineInput).max(50) }))
    .mutation(async ({ ctx, input }) => {
      for (const line of input.lines) {
        if (line.qty <= 0) continue;
        const { productId, variantId } = await resolveCartLine(line);
        // Best-effort per line: a product retired mid-merge must not lose the
        // rest of the basket.
        try {
          await q.addCartItem(ctx.user.id, productId, variantId, line.qty);
        } catch {
          /* retired between browse and sign-in - skip it */
        }
      }
      return q.getCart(ctx.user.id);
    }),
});

// ── checkout ─────────────────────────────────────────────────────────────────
const checkoutRouter = router({
  /** Place an order. Requires a signed-in account - there is NO guest checkout,
   *  which keeps every order tied to a real, recoverable identity.
   *
   *  Prices are re-resolved server-side from the catalog and no client-supplied
   *  amount is read anywhere in this procedure, so a tampered payload can change
   *  what is DISPLAYED but never what is CHARGED. */
  place: protectedProcedure
    .input(
      z.object({
        email: z.email("Enter a valid email address"),
        items: z.array(cartLineSchema).min(1, "Your cart is empty"),
        shippingAddress: addressSchema,
        billingAddress: addressSchema.optional(),
        paymentProvider: z.string().default("nowpayments"),
        /** Card data is OPTIONAL: the storefront hands the shopper to the
         *  gateway's hosted page, so in normal use none of this ever reaches us.
         *  The fields exist for direct API callers, and are validated below so
         *  invented or published test card data is refused at our edge. */
        card: z
          .object({
            number: z.string().max(32).optional(),
            expiry: z.string().max(16).optional(),
            cvv: z.string().max(8).optional(),
          })
          .optional()
          .nullable(),
        notes: z.string().max(500).optional().nullable(),
        saveAddress: z.boolean().optional(),
        /** DEPRECATED and IGNORED. The site origin used to be read from here, which
         *  let a caller choose where the payment provider's IPN callback was sent.
         *  The canonical origin now comes from server configuration
         *  (server/_core/site-url.ts). The field is still ACCEPTED so an
         *  already-deployed client does not start failing validation, but it can
         *  no longer influence any URL the server generates. */
        origin: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(orderLimiter, `order:${ctx.user.id}`);
      assertCardDetailsAcceptable(input.card);
      try {
        const order = await q.createOrder({
          userId: ctx.user.id,
          email: input.email,
          items: input.items,
          shippingAddress: input.shippingAddress,
          billingAddress: input.billingAddress ?? input.shippingAddress,
          paymentProvider: input.paymentProvider,
          notes: input.notes ?? null,
        });

        // Signed-in shoppers can opt to keep this address on file.
        if (ctx.user && input.saveAddress) {
          await q.createAddress(ctx.user.id, {
            label: "Checkout",
            ...input.shippingAddress,
            isDefaultShipping: true,
          });
        }

        // ── The canonical origin, NOT the request's ────────────────────────────
        // `origin` is ignored on purpose. It used to be the source of the IPN
        // callback URL, which meant a caller could decide where the provider's
        // settlement webhook was delivered - and, because the apex host
        // 308-redirects, a plausible-looking value could silently strand a paid
        // order. The origin is a DEPLOYMENT FACT and is resolved server-side.
        const origin = siteOrigin();
        const provider = getProvider(input.paymentProvider);
        const started = await provider.start({
          orderId: order.id,
          orderNumber: order.orderNumber,
          totalCents: order.totalCents,
          currency: order.currency,
          email: order.email,
          customerName: input.shippingAddress.fullName,
          returnUrl: orderUrl(order.orderNumber),
          // The provider's server-to-server notification endpoint. Verified by
          // HMAC-SHA512 in _core/app.ts before any of it is trusted.
          ipnUrl: ipnCallbackUrl(),
        });

        // ⚠ NO CONFIRMATION EMAIL HERE. Placing an order is not paying for one:
        // the shopper has not been to the gateway yet, and on a crypto checkout
        // they may never complete it. Sending a receipt at this point is exactly
        // the bug that told a customer "a confirmation email is on its way" for
        // an order that was still awaiting payment.
        //
        // The receipt is sent from the VERIFIED payment paths only - the
        // signature-checked IPN webhook, the live status reconciliation, and the
        // post-return confirmation - and only once the provider reports the
        // payment as settled. See services/order-receipt.ts and
        // `confirmPayment` / the IPN route below.
        //
        // The ADMIN alert keeps firing here on purpose: the owner wants to know
        // an order was placed, paid or not, so they can watch an unpaid crypto
        // invoice and chase it if it stalls.
        const settings = await getSettings();
        const detail = await q.getOrderDetail(order.id);
        const adminEmailResult = detail
          ? await sendAdminNewOrderEmail(
              {
                id: detail.order.id,
                orderNumber: detail.order.orderNumber,
                email: detail.order.email,
                currency: detail.order.currency,
                subtotalCents: detail.order.subtotalCents,
                shippingCents: detail.order.shippingCents,
                taxCents: detail.order.taxCents,
                totalCents: detail.order.totalCents,
                shippingAddress: detail.order.shippingAddress,
              },
              toEmailLines(detail.items),
              settings,
              origin,
            )
          : { status: "failed" as const, reason: "Order detail unavailable for the admin email." };

        return {
          orderNumber: order.orderNumber,
          totalCents: order.totalCents,
          provider: provider.id,
          redirectUrl: started.redirectUrl,
          instructions: started.instructions,
          // The confirmation email is NOT sent at this point (see above), so the
          // checkout result reports it honestly as still pending payment.
          emailStatus: "pending_payment" as const,
          emailReason: null,
          adminEmailStatus: adminEmailResult.status,
          adminEmailReason: adminEmailResult.reason ?? null,
        };
      } catch (e) {
        if (e instanceof q.OutOfStockError) {
          throw new TRPCError({ code: "CONFLICT", message: e.message });
        }
        throw e;
      }
    }),

  /** Confirm payment after a hosted checkout. Asks the provider directly from
   *  the server, so a forged return URL cannot mark an order paid. */
  confirmPayment: publicProcedure
    .input(z.object({ orderNumber: z.string().min(3) }))
    .mutation(async ({ input }) => {
      const order = await q.getOrderByNumber(input.orderNumber);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.paymentStatus === "paid") return { paid: true, status: "paid" };

      const providerId = order.paymentProvider ?? "nowpayments";
      const paid = await verifyPayment(providerId, order.orderNumber);
      if (paid) {
        await q.updateOrderPayment({
          orderId: order.id,
          paymentStatus: "paid",
          paymentProvider: providerId,
        });
        // Move the order to paid, then hand the receipt to the ONE module that
      // owns it: gated on the settlement we just verified, and idempotent via
      // an atomic claim, so a duplicate webhook or a double poll cannot send
      // the customer a second receipt.
      await q.updateOrderStatus(order.id, "paid", "Payment confirmed by the gateway.");
      await sendPaidReceiptOnce({ orderId: order.id, verifiedPaid: true, trigger: "post_return" });
      // Announce the settled order to the owner's Telegram channel. Same gate,
      // its own atomic idempotency claim, and it never throws - so this can sit
      // on the confirmation path without endangering it.
      await notifyPaidOrderOnce({
        orderId: order.id,
        verifiedPaid: true,
        trigger: "post_return",
      });
        // Push the paid order to the upstream supplier. Idempotent (a durable claim in
        // `cj_order_forwards` means a repeated confirm can never place a second
        // CJ order) and fail-safe (it never throws, so a CJ problem cannot break
        // the confirmation the shopper is waiting on).
        await forwardOrderToCj(order.id);
      }
      return { paid, status: paid ? "paid" : order.paymentStatus };
    }),

  /**
   * Start (or resume) the crypto payment for an order that has not been paid.
   *
   * WHY THIS EXISTS. An order is created at checkout, but its NOWPayments
   * invoice only exists if the shopper actually reaches the gateway. Two real
   * cases leave an order with NO invoice and no way to ever pay it:
   *   - it was placed while the store had no API key (offline settlement), and
   *     the keys have since been configured;
   *   - invoice creation failed, or the shopper closed the tab on the way.
   * Without this, such an order is permanently stuck on "awaiting payment" while
   * the shopper stares at a page with no way forward.
   *
   * It reuses the SAME provider `start()` call as checkout, so the existing
   * idempotency guard applies: an order that already has a hosted invoice URL
   * and is still unpaid gets the SAME invoice back instead of a second one.
   *
   * Refuses an order that is already settled (nothing to pay) and a store with
   * no key configured (there is nothing to create). Public, like the status
   * query: the order number is the capability.
   */
  resumePayment: publicProcedure
    .input(
      z.object({
        orderNumber: z.string().min(3),
        /** DEPRECATED and IGNORED - the canonical origin is resolved server-side.
         *  Accepted only so an already-deployed client keeps validating. */
        origin: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const order = await q.getOrderByNumber(input.orderNumber);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (order.paymentStatus === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This order has already been paid." });
      }
      if (order.paymentStatus === "refunded") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This order has been refunded." });
      }
      const provider = getProvider(order.paymentProvider ?? "nowpayments");
      if (!provider.isConfigured()) {
        // Honest, actionable copy - not a generic error. The store simply has no
        // way to take crypto until the merchant account is connected.
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Crypto payments aren't switched on for this store yet.",
        });
      }

      // Canonical origin, never the request's - see the note in `place` above.
      const started = await provider.start({
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalCents: order.totalCents,
        currency: order.currency,
        email: order.email,
        customerName: order.shippingAddress.fullName,
        returnUrl: orderUrl(order.orderNumber),
        ipnUrl: ipnCallbackUrl(),
      });

      // `start()` already persisted the invoice handles; keep them in step for a
      // resumed order that had none (best-effort, exactly as in checkout).
      if (started.providerRef) {
        try {
          await q.setOrderPaymentInvoice({
            orderId: order.id,
            invoiceId: started.providerRef,
            paymentUrl: started.redirectUrl,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn(`[payments] could not persist resumed invoice for ${order.orderNumber}: ${(e as Error).message}`);
        }
      }

      return { redirectUrl: started.redirectUrl, instructions: started.instructions };
    }),

  /**
   * Live crypto payment status for an order, straight from NOWPayments.
   *
   * This is what the confirmation page polls so the shopper sees the REAL state
   * (waiting / confirming / finished) rather than a smoothed "unpaid". It also
   * RECONCILES: a page view can settle an order whose webhook was missed, so the
   * pull path is a safety net for the push path.
   *
   * Public on purpose - the order number is the capability, exactly like the
   * existing `orders.lookup`. It returns only the payment's own public fields
   * (address, amounts, status) and never any key material.
   */
  paymentStatus: publicProcedure
    .input(z.object({ orderNumber: z.string().min(3) }))
    .query(async ({ input }) => {
      const order = await q.getOrderByNumber(input.orderNumber);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      const view = await reconcileOrderPayment(order.id);
      if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      // A page view can be the ONLY thing that observes a settlement (a missed
      // webhook), so reconciliation also delivers the receipt. Gated on the raw
      // status we just read, and idempotent - this is why the claim has to be
      // atomic rather than an if-not-sent check.
      if (view.stage === "paid") {
        await sendPaidReceiptOnce({
          orderId: order.id,
          rawStatus: view.status,
          verifiedPaid: true,
          trigger: "reconciliation",
        });
        await notifyPaidOrderOnce({
          orderId: order.id,
          rawStatus: view.status,
          verifiedPaid: true,
          trigger: "reconciliation",
        });
      }
      return view;
    }),
});

// ── orders ───────────────────────────────────────────────────────────────────
const ordersRouter = router({
  /** Signed-in customer: their own order history. */
  list: protectedProcedure.query(({ ctx }) => q.listUserOrders(ctx.user.id)),

  /** Signed-in customer: one of their own orders (id or order number). */
  mine: protectedProcedure.input(z.object({ ref: z.string().min(1) })).query(async ({ ctx, input }) => {
    const detail = await q.getUserOrderDetailByRef(input.ref, ctx.user.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    return detail;
  }),

  /**
   * Order lookup by order number + email.
   * - The owner of the order (logged in) needs no email.
   * - Anyone else must supply the exact email the order was placed with.
   * Both cases return the same shape, so the confirmation page and the public
   * /track page share one procedure.
   */
  lookup: publicProcedure
    .input(z.object({ orderNumber: z.string().min(3), email: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const order = await q.getOrderByNumber(input.orderNumber);
      if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "We couldn't find that order." });

      const isOwner = Boolean(ctx.user && order.userId === ctx.user.id);
      if (!isOwner) {
        const supplied = (input.email ?? "").trim().toLowerCase();
        if (!supplied || supplied !== order.email.toLowerCase()) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "We couldn't find that order. Check the order number and the email you used.",
          });
        }
      }
      const detail = await q.getOrderDetail(order.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      // The order page states whether the confirmation email has gone. That fact
      // belongs to the PERSISTED claim, not to a client-side guess: the receipt
      // is sent from the server's payment paths, possibly minutes later and on a
      // different instance, so a client flag would go stale immediately.
      return { ...detail, confirmationEmailSentAt: order.confirmationEmailSentAt ?? null };
    }),
});

// ── account (protected) ──────────────────────────────────────────────────────
const accountRouter = router({
  profile: protectedProcedure.query(async ({ ctx }) => ({
    profile: await q.getProfile(ctx.user.id),
    user: ctx.user,
    emailVerified: await isEmailVerified(ctx.user.id),
  })),

  updateProfile: protectedProcedure
    .input(
      z.object({
        fullName: z.string().max(120).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
      }),
    )
    .mutation(({ ctx, input }) => q.upsertProfile(ctx.user.id, input)),

  addresses: protectedProcedure.query(({ ctx }) => q.listAddresses(ctx.user.id)),

  defaultAddress: protectedProcedure.query(({ ctx }) => q.getDefaultAddress(ctx.user.id)),

  addAddress: protectedProcedure
    .input(
      addressSchema.extend({
        label: z.string().max(60).optional().nullable(),
        isDefaultShipping: z.boolean().optional(),
        isDefaultBilling: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => q.createAddress(ctx.user.id, input)),

  updateAddress: protectedProcedure
    .input(
      addressSchema.extend({
        id: z.string().min(1),
        label: z.string().max(60).optional().nullable(),
        isDefaultShipping: z.boolean().optional(),
        isDefaultBilling: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const row = await q.updateAddress(id, ctx.user.id, rest);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Address not found" });
      return row;
    }),

  deleteAddress: protectedProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => q.deleteAddress(input.id, ctx.user.id)),

  /** Re-send the verification email for the signed-in account. Only meaningful
   *  while the address is unverified; a short cooldown stops it being spammed.
   *  The send is best-effort - a mail outage must not fail the request. */
  resendVerification: protectedProcedure
    .input(z.object({ origin: z.string().url().max(300).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      enforceRateLimit(loginLimiter, `resend-verify:${ctx.user.id}`);
      if (await isEmailVerified(ctx.user.id)) {
        return { ok: true, alreadyVerified: true };
      }
      await resendVerificationForEmail(ctx.user.email, input?.origin ?? requestOrigin(ctx.c));
      return { ok: true, alreadyVerified: false };
    }),
});

// ── admin ────────────────────────────────────────────────────────────────────
/** Category create/update payload. `slug` is optional - the DB layer derives it
 *  from the name when blank, with the same slugifier products use. */
const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "A category needs a name.").max(80),
  slug: z.string().trim().max(80).optional(),
  description: z.string().max(500).optional(),
  /** The parent AISLE's id for a subcategory, or null/absent for a top-level
   *  one. Passed as null explicitly to promote a subcategory to top level. */
  parentId: z.string().min(1).nullable().optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

/** A row in the storefront's browse tree: a top-level aisle with its
 *  subcategories. The shape lives in shared/store.ts because the shop page and
 *  the admin pickers consume it too; re-exported here so a client that already
 *  imports the router's types gets it from one place. */
export type { StoreCategoryNode } from "../shared/store";

// ── admin auth (the DEDICATED admin sign-in) ─────────────────────────────────
// A separate sign-in surface for the single store owner, deliberately NOT the
// storefront's customer login.
//
// WHY A SEPARATE ENDPOINT rather than reusing `auth.login`: the customer login
// mints a session for ANY valid credential, and the panel is then protected by
// `adminProcedure`. That works, but it means a normal shopper's password is
// accepted at the admin door and only rejected afterwards. This endpoint refuses
// a non-admin account AT THE DOOR - it never returns a session the panel could
// use, and it reuses the exact same DB-backed lockout as the customer login (a
// stricter per-IP bucket, in fact), so the owner's credentials cannot be ground
// down from the admin surface.
//
// Nothing here is the authority for data access: `adminProcedure` still gates
// every `admin.*` call on the server, so a session minted anywhere else is still
// refused there.
const adminAuthRouter = router({
  /** The signed-in DESIGNATED admin, or null. Lets the admin login page render
   *  "already signed in" without ever revealing panel contents. */
  me: publicProcedure.query(({ ctx }) => (isDesignatedAdmin(ctx.user) ? ctx.user : null)),

  login: publicProcedure
    .input(
      z.object({
        email: z.email(),
        password: z.string().min(1, "Enter your password."),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Stricter than the customer login: a dedicated bucket per IP, so an
      // attacker hammering the ADMIN door cannot also use up the shopper's
      // normal login budget (and vice versa).
      enforceRateLimit(adminLoginLimiter, `admin-login:${callerKey(ctx.c)}`);
      const keys = loginKeys(input.email, callerKey(ctx.c));
      await assertNotLocked([
        { key: keys.account, rule: LOGIN_ACCOUNT_RULE },
        { key: keys.ip, rule: LOGIN_IP_RULE },
      ]);
      try {
        const user = await authProvider().login(ctx.c, input.email, input.password);
        if (!isDesignatedAdmin(user)) {
          // A valid credential for an account that is NOT the one admin. Tear
          // the session back down immediately, count the attempt toward the
          // lockout (so the admin door cannot be probed with other people's
          // accounts), and answer with ONE sentence that reveals nothing about
          // whether the account exists or carries the admin role.
          await authProvider().logout(ctx.c);
          await recordFailure(keys.account, LOGIN_ACCOUNT_RULE);
          await recordFailure(keys.ip, LOGIN_IP_RULE);
          throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_LOGIN_DENIED_MESSAGE });
        }
        await clearFailures([keys.account, keys.ip]);
        return user;
      } catch (e) {
        if (e instanceof TRPCError) throw e; // our deliberate FORBIDDEN - already recorded
        if (e instanceof AuthError) {
          await recordFailure(keys.account, LOGIN_ACCOUNT_RULE);
          await recordFailure(keys.ip, LOGIN_IP_RULE);
          throw new TRPCError({ code: "UNAUTHORIZED", message: e.message });
        }
        throw e;
      }
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await authProvider().logout(ctx.c);
    return { ok: true };
  }),
});

const adminRouter = router({
  stats: adminProcedure.query(async () => {
    // The low-stock threshold is a persisted setting, so the dashboard reads it
    // live rather than assuming the default - the owner can change it in
    // Settings and the "Low on stock" card follows immediately.
    const settings = await getSettings();
    return q.adminStats(settings.low_stock_threshold);
  }),

  // products
  products: adminProcedure
    .input(z.object({ search: z.string().max(SEARCH_TERM_MAX).optional() }).optional())
    .query(({ input }) =>
      q.listProducts({
        includeInactive: true,
        search: searchFilterQuery(input?.search),
        sort: "name",
        limit: 500,
      }),
    ),

  product: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const product = await q.getProductById(input.id);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
    return product;
  }),

  createProduct: adminProcedure.input(productInputSchema).mutation(async ({ input }) => {
    const slug = slugify(input.slug || input.name);
    try {
      const created = await q.createProduct({
        ...input,
        slug,
        compareAtCents: input.compareAtCents ?? null,
      });
      // Keep the categories list in step: a product filed under a brand-new aisle
      // materialises that aisle. Best-effort - the product write already landed.
      await q.ensureCategoryRow(created.category).catch(() => undefined);
      return created;
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new TRPCError({ code: "CONFLICT", message: "That URL slug is already in use." });
      }
      throw e;
    }
  }),

  updateProduct: adminProcedure
    .input(productInputSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const slug = slugify(rest.slug || rest.name);
      try {
        const row = await q.updateProduct(id, {
          ...rest,
          slug,
          compareAtCents: rest.compareAtCents ?? null,
        });
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        await q.ensureCategoryRow(row.category).catch(() => undefined);
        return row;
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({ code: "CONFLICT", message: "That URL slug is already in use." });
        }
        throw e;
      }
    }),

  deleteProduct: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => q.deleteProduct(input.id)),

  /** Ingest a third-party asset (e.g. an upstream supplier image or video) ONCE and
   *  hand back a same-origin URL we serve ourselves. After this the source URL
   *  is never emitted to a browser, the asset no longer depends on the
   *  supplier's uptime or hotlink policy, and video becomes possible at all. */
  ingestMedia: adminProcedure
    .input(
      z.object({
        sourceUrl: z.string().min(1).max(2000),
        /** Optional hint from the form ("image" | "video"). Only used to pick
         *  the optimization branch when the source's own type is ambiguous. */
        kindHint: z.enum(["image", "video"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ingestMediaFromUrl(input.sourceUrl, {
        ownerId: ctx.user.id,
        kindHint: input.kindHint,
      });
      if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
      return { url: result.url, kind: result.kind, note: result.note ?? null };
    }),

  /**
   * Optimize bytes the server holds and store them, returning our own URL.
   *
   * This is the flow the browser uses when it uploads a FILE directly: rather
   * than a presigned PUT (which would store the raw bytes), the form posts the
   * file here so it can be resized/re-encoded BEFORE it is stored. Images are
   * resized to 1600px and re-encoded to WebP; videos are transcoded to 1080p
   * H.264 with +faststart. Both degrade gracefully (the original is stored and
   * `note` explains why) when a tool is unavailable.
   */
  optimizeMedia: adminProcedure
    .input(
      z.object({
        kind: z.enum(["image", "video"]),
        contentType: z.string().min(1).max(120),
        /** base64 (no data: prefix). Bounded so a runaway body cannot be sent. */
        dataBase64: z.string().min(1).max(70_000_000),
        filename: z.string().min(1).max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const bytes = base64ToBytes(input.dataBase64);
      if (!bytes) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That file couldn't be read. Please try again." });
      }
      const result = await ingestOptimizedBytes(input.kind, bytes, input.contentType, {
        ownerId: ctx.user.id,
        filename: input.filename,
      });
      if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
      return { url: result.url, kind: result.kind, note: result.note ?? null, savedBytes: result.savedBytes ?? 0 };
    }),

  // categories - admin-managed. A product stores the category NAME, so renaming
  // a category re-points its products (see q.updateCategory) and deleting one is
  // refused while products still use it, so a product can never be orphaned.
  categories: adminProcedure.query(() => q.listCategories()),
  createCategory: adminProcedure.input(categoryInputSchema).mutation(async ({ input }) => {
    // A subcategory must point at a real, TOP-LEVEL aisle: the tree is two
    // levels deep everywhere it is rendered, so a parent that is itself a
    // subcategory would be invisible in the browse UI. Rejecting it here keeps
    // the stored tree and the rendered tree in agreement.
    if (input.parentId) {
      const parent = await q.getCategoryById(input.parentId);
      if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "That parent category no longer exists." });
      if (parent.parentId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Subcategories cannot be nested further." });
      }
    }
    try {
      return await q.createCategory({
        name: input.name,
        slug: input.slug ? slugify(input.slug) : undefined,
        description: input.description,
        parentId: input.parentId ?? null,
        featured: input.featured,
        sortOrder: input.sortOrder,
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new TRPCError({ code: "CONFLICT", message: "A category with that name already exists." });
      }
      throw e;
    }
  }),
  updateCategory: adminProcedure
    .input(categoryInputSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const current = await q.getCategoryById(id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      // Guard the tree's shape on the way in as well as on the way out: a
      // category cannot become its own parent, and cannot be re-parented under
      // one of its own subcategories (which would detach a whole branch).
      if (rest.parentId) {
        if (rest.parentId === id) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A category cannot be its own parent." });
        }
        const parent = await q.getCategoryById(rest.parentId);
        if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "That parent category no longer exists." });
        if (parent.parentId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Subcategories cannot be nested further." });
        }
        // Re-parenting an aisle that HAS subcategories would push those
        // subcategories a third level down (they would become grandchildren),
        // which no browse surface can render. Refuse it outright rather than
        // silently building a tree the storefront cannot show.
        const childNames = await q.listChildCategoryNames(id);
        if (childNames.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Move its subcategories out first - a category with subcategories stays top-level.",
          });
        }
      }
      const name = rest.name.trim();
      if (name !== current.name) {
        const clash = (await q.listCategories()).find((c) => c.name === name && c.id !== id);
        if (clash) {
          throw new TRPCError({ code: "CONFLICT", message: "Another category already uses that name." });
        }
      }
      try {
        const row = await q.updateCategory(id, { ...rest, slug: rest.slug ? slugify(rest.slug) : undefined });
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
        return row;
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({ code: "CONFLICT", message: "Another category already uses that name." });
        }
        throw e;
      }
    }),
  deleteCategory: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const current = await q.getCategoryById(input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      const inUse = await q.countProductsInCategory(current.name);
      if (inUse > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Move the ${inUse} product${inUse === 1 ? "" : "s"} in \u201c${current.name}\u201d to another category first.`,
        });
      }
      // Refuse while subcategories still hang off this aisle rather than
      // silently promoting (FK `set null`) a whole branch to top level, which
      // would be a surprising, hard-to-undo side effect of one delete.
      const children = await q.listChildCategoryNames(input.id);
      if (children.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Move the ${children.length} subcategor${children.length === 1 ? "y" : "ies"} under \u201c${current.name}\u201d first.`,
        });
      }
      await q.deleteCategory(input.id);
      return { ok: true };
    }),

  // Drag-and-drop reordering. `ids` is the COMPLETE sibling list in its new
  // sequence - the top-level aisles when `parentId` is null, or one aisle's
  // subcategories otherwise - and is written as positions 0..n-1.
  //
  // The list is checked against the current one first: a reorder that does not
  // name every sibling exactly once is refused, because a partial list would
  // renumber only the rows it mentions and silently shuffle the rest. The
  // comparison is PER SIBLING LIST, not against every category, so reordering
  // one aisle's children can never disturb another aisle's.
  reorderCategories: adminProcedure
    .input(
      z.object({
        parentId: z.string().min(1).nullable(),
        ids: z.array(z.string().min(1)).min(1).max(500),
      }),
    )
    .mutation(async ({ input }) => {
      const current = await q.listCategoryIds(input.parentId);
      if (current.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That category list no longer exists." });
      }
      const wanted = new Set(input.ids);
      const sameSet =
        wanted.size === input.ids.length &&
        wanted.size === current.length &&
        current.every((id) => wanted.has(id));
      if (!sameSet) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That order doesn't match the current list. Reload and try again.",
        });
      }
      const moved = await q.reorderCategories({ ids: input.ids, parentId: input.parentId });
      return { ok: true, moved };
    }),

  // variants
  createVariant: adminProcedure
    .input(variantInputSchema.extend({ productId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await q.createVariant(input);
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({ code: "CONFLICT", message: "That SKU is already used." });
        }
        throw e;
      }
    }),

  updateVariant: adminProcedure
    .input(variantInputSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      try {
        const row = await q.updateVariant(id, rest);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });
        return row;
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new TRPCError({ code: "CONFLICT", message: "That SKU is already used." });
        }
        throw e;
      }
    }),

  deleteVariant: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => q.deleteVariant(input.id)),

  // inventory
  inventory: adminProcedure.query(() => q.listInventory()),
  setInventory: adminProcedure
    .input(z.object({ id: z.string().min(1), qty: z.number().int().min(0).max(1_000_000) }))
    .mutation(({ input }) => q.setVariantInventory(input.id, input.qty)),

  // orders
  orders: adminProcedure
    .input(z.object({ status: z.string().max(40).optional(), search: z.string().max(SEARCH_TERM_MAX).optional() }).optional())
    .query(({ input }) => q.adminListOrders(input ?? {})),

  order: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const detail = await q.getOrderDetail(input.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    // The email log travels with the order so the admin view can answer
    // "was the customer actually notified?" from real rows.
    const emails = await listEmailsForOrder(input.id);
    return { ...detail, emails };
  }),

  setOrderStatus: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(ORDER_STATUSES),
        note: z.string().max(500).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const detail = await q.updateOrderStatus(input.id, input.status, input.note ?? null);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return detail;
    }),

  setPaymentStatus: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        paymentStatus: z.enum(PAYMENT_STATUSES),
        paymentRef: z.string().max(120).optional().nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const detail = await q.updateOrderPayment({
        orderId: input.id,
        paymentStatus: input.paymentStatus,
        paymentRef: input.paymentRef ?? null,
      });
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return detail;
    }),

  setTracking: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        trackingNumber: z.string().max(120).nullable(),
        carrier: z.string().max(60).nullable(),
        markShipped: z.boolean().optional(),
        /** Absolute origin for the links inside the email. */
        origin: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // Read the state BEFORE the write: the shipping notification belongs to
      // the transition into "shipped", so re-saving a tracking number on an
      // order that already shipped must not email the customer a second time.
      const before = await q.getOrderDetail(input.id);
      const wasShipped = before?.order.status === "shipped";

      const detail = await q.updateOrderTracking({
        orderId: input.id,
        trackingNumber: input.trackingNumber,
        carrier: input.carrier,
      });
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

      let final = detail;
      if (input.markShipped && detail.order.status !== "shipped") {
        final = (await q.updateOrderStatus(input.id, "shipped", "Marked shipped.")) ?? detail;
      }

      // Fire the shipping notification on the real event: the order became
      // shipped AND carries a tracking number, and it was not shipped before.
      let emailStatus: string | null = null;
      let emailReason: string | null = null;
      const nowShipped = final.order.status === "shipped";
      if (nowShipped && !wasShipped && final.order.trackingNumber) {
        const settings = await getSettings();
        const result = await sendShippingNotification(
          {
            id: final.order.id,
            orderNumber: final.order.orderNumber,
            email: final.order.email,
            currency: final.order.currency,
            subtotalCents: final.order.subtotalCents,
            shippingCents: final.order.shippingCents,
            taxCents: final.order.taxCents,
            totalCents: final.order.totalCents,
            shippingAddress: final.order.shippingAddress,
            carrier: final.order.carrier,
            trackingNumber: final.order.trackingNumber,
          },
          toEmailLines(final.items),
          settings,
          input.origin,
        );
        emailStatus = result.status;
        emailReason = result.reason ?? null;
      }

      return { ...final, emails: await listEmailsForOrder(input.id), emailStatus, emailReason };
    }),

  setOrderNotes: adminProcedure
    .input(z.object({ id: z.string().min(1), notes: z.string().max(2000).nullable() }))
    .mutation(async ({ input }) => {
      const detail = await q.updateOrderNotes(input.id, input.notes);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return detail;
    }),

  // Permanently remove an order (and its cascading children) so the owner can
  // keep the panel clean of spam or test records. Admin-only, like every other
  // order mutation; a stale id answers NOT_FOUND rather than silently no-op'ing.
  deleteOrder: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const removed = await q.deleteOrder(input.id);
      if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      return { ok: true };
    }),

  // ── crypto payments (NOWPayments) ───────────────────────────────────────
  // The raw provider view for ONE order: the stored handles plus the live
  // status and the last IPN we received. This is what the panel's crypto card
  // renders, so an operator can see exactly what NOWPayments said without
  // opening the provider's dashboard.
  rawPayment: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const detail = await q.getOrderDetail(input.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    return getOrderRawPaymentData(detail.order);
  }),

  /** Re-query NOWPayments live and reconcile the order. This is the manual
   *  "refresh status" action - it settles an order whose webhook was missed,
   *  and it is idempotent (a paid order is never walked backwards). */
  refreshPaymentStatus: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const detail = await q.getOrderDetail(input.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      const view = await reconcileOrderPayment(input.id);
      if (!view) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      const after = await q.getOrderDetail(input.id);
      return { view, raw: await getOrderRawPaymentData(after!.order) };
    }),

  /** Refund a paid order through NOWPayments.
   *
   *  `confirm: true` is REQUIRED. This is the only money-moving action in the
   *  panel, so the client must explicitly acknowledge it before the call can
   *  return funds - a mis-wired button cannot refund by accident. Any partial
   *  amount must be positive; omitting it is a full refund. */
  refundPayment: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        confirm: z.literal(true),
        amount: z.number().positive().optional(),
        reason: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await refundOrderPayment(input.id, {
          amount: input.amount,
          reason: input.reason,
          requestedBy: ctx.user?.email ?? null,
        });
      } catch (e) {
        if (e instanceof RefundError) {
          throw new TRPCError({
            code: e.status === 404 ? "NOT_FOUND" : e.status === 409 ? "CONFLICT" : "BAD_REQUEST",
            message: e.message,
          });
        }
        throw e;
      }
    }),

  // ── email history (admin) ───────────────────────────────────────────────────
  // Everything the panel needs to answer "was the customer told, when, by which
  // path, and to what address?" for ONE order: every send attempt from
  // `email_log` (status, recipient, trigger) plus the two persisted one-shot
  // claims (the paid receipt and the unpaid alert), so the panel can state
  // whether each has gone even before any log row exists.
  emailHistory: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const detail = await q.getOrderDetail(input.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    return q.getOrderEmailHistory(input.id);
  }),

  /** The Telegram notification picture for ONE order.
   *
   *  Answers the operator's question directly: WAS THE OWNER TOLD, and if not,
   *  why and is it still going to be? Reads the one-shot claim and the last
   *  error off `orders` (the authority), plus the durable retry queue - a queued
   *  reminder still `pending` means "not told yet, but a sweep will retry",
   *  which must not be shown as delivered. `telegram_notify_error` is already
   *  redacted at its source (`services/telegram.ts`), so it can never carry the
   *  bot token into the panel. */
  telegramStatus: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const detail = await q.getOrderDetail(input.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    return q.getOrderTelegramStatus(input.id);
  }),

  /** Resend the paid receipt for an order.
   *
   *  PAID ORDERS ONLY. This goes through the SAME gate and the SAME atomic
   *  claim as every other receipt path, so it can deliver a receipt that has
   *  not gone yet (the `not_delivered` case - an attempt refused while
   *  RESEND_API_KEY was unset) but can NEVER duplicate one that has. An unpaid
   *  order is refused here as well as in the gate, so the button cannot be used
   *  to tell a customer their order is confirmed when it is not. */
  resendConfirmationEmail: adminProcedure
    .input(z.object({ id: z.string().min(1), origin: z.string().max(300).optional().nullable() }))
    .mutation(async ({ input }) => {
      const detail = await q.getOrderDetail(input.id);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      if (detail.order.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            `Order ${detail.order.orderNumber} is not paid (status "${detail.order.paymentStatus}"), ` +
            `so no confirmation email can be sent.`,
        });
      }
      const outcome = await sendPaidReceiptOnce({
        orderId: input.id,
        verifiedPaid: true,
        origin: input.origin ?? null,
        trigger: "admin_resend",
      });
      // Re-sending the receipt is also the escape hatch for a notification that
      // did not land (a Telegram outage released its claim). It can deliver one
      // that has not gone yet and can never duplicate one that has.
      const notifyOutcome = await notifyPaidOrderOnce({
        orderId: input.id,
        verifiedPaid: true,
        trigger: "admin_resend",
      });
      return {
        outcome,
        notifyOutcome,
        history: await q.getOrderEmailHistory(input.id),
      };
    }),

  // customers = paid buyers; users = every registered account (see db.ts)
  customers: adminProcedure.query(() => q.listCustomers()),
  users: adminProcedure.query(() => q.listUsers()),
  customer: adminProcedure.input(z.object({ id: z.string().min(1) })).query(async ({ input }) => {
    const detail = await q.getCustomerDetail(input.id);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
    return detail;
  }),

  // Permanently delete a user account so the owner can clear spam or test
  // signups. HARD GUARD: an admin/owner account is never deletable - it is the
  // only way back into this panel - and the rule is enforced here AND again in
  // the data layer (see deleteUserAccount), so no future caller can bypass it.
  // The provider's own credential rows are cleaned up in the same call, so the
  // person cannot sign back in and be silently re-created.
  deleteUser: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const role = await q.getUserRole(input.id);
      if (role === null) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
      if (isAdminRole(role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_ACCOUNT_UNDELETABLE_MESSAGE });
      }
      try {
        const summary = await q.deleteUserAccount(input.id);
        if (!summary) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
        return { ok: true as const, id: summary.id };
      } catch (e) {
        // The data-layer guard is the last line of defence; surface its sentence
        // as a clean refusal rather than a 500.
        if (e instanceof q.AdminDeleteRefusedError) {
          throw new TRPCError({ code: "FORBIDDEN", message: e.message });
        }
        throw e;
      }
    }),

  // reviews
  reviews: adminProcedure.query(() => q.listAllReviews()),
  setReviewStatus: adminProcedure
    .input(z.object({ id: z.string().min(1), status: z.enum(["pending", "approved", "rejected"]) }))
    .mutation(({ input }) => q.setReviewStatus(input.id, input.status)),
  setReviewVisibility: adminProcedure
    .input(z.object({ id: z.string().min(1), isPublic: z.boolean() }))
    .mutation(({ input }) => q.setReviewVisibility(input.id, input.isPublic)),
  deleteReview: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => q.deleteReview(input.id)),

  // newsletter
  //
  // SERVER-SIDE PAGED. A newsletter list only ever grows - every footer signup
  // appends a row - so the panel must not pull it whole. The caller names a page
  // and gets exactly that, with the TOTAL alongside so it can print "N of M" from
  // the same response. `resolvePaging` clamps the request, so an unbounded or
  // malformed page request cannot turn into an unbounded query: the size is
  // capped at ADMIN_PAGE_SIZE_MAX and the page number at ADMIN_PAGE_MAX. `search`
  // is filtered in SQL (not in the browser) so it searches the whole list rather
  // than the page that happened to be loaded.
  newsletter: adminProcedure
    .input(
      z
        .object({
          page: z.number().int().optional(),
          pageSize: z.number().int().optional(),
          search: z.string().max(SEARCH_TERM_MAX).optional(),
        })
        .optional(),
    )
    .query(({ input }) => q.listNewsletterSubscribersPage(resolvePaging(input), input?.search ?? "")),
  setSubscriberStatus: adminProcedure
    .input(z.object({ id: z.string().min(1), status: z.enum(["subscribed", "unsubscribed"]) }))
    .mutation(async ({ input }) => {
      const row = await q.setNewsletterSubscriberStatus(input.id, input.status);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Subscriber not found" });
      return row;
    }),
  // Permanently remove a subscriber, so the owner can clear a random, spam or
  // fake address that reached the list.
  //
  // WHAT THIS IS FOR, and why it is not `setSubscriberStatus`. Suppressing an
  // address (marking it unsubscribed) deliberately KEEPS the record so the list
  // retains its history; a bogus address should leave no trace at all - once
  // deleted it cannot be exported, mailed or shown again. Both live on purpose.
  //
  // ADMIN-ONLY via `adminProcedure`, enforced on the SERVER: a non-admin (or an
  // anonymous) call is refused before the body runs, so the browser is never the
  // control.
  //
  // IDEMPOTENT IN EFFECT, HONEST IN REPLY. The delete is a single primary-key
  // DELETE and reports whether it matched. A second delete of the same id - a
  // double click, a retried request - matches nothing and answers NOT_FOUND,
  // which is the truth: there is no such subscriber any more. Reporting success
  // twice would claim a delete that did not happen.
  deleteSubscriber: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const ok = await q.deleteNewsletterSubscriber(input.id);
      if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Subscriber not found" });
      return { ok: true as const, id: input.id };
    }),

  // contact messages - the storefront contact form's inbox
  messages: adminProcedure.query(() => q.listContactMessages()),
  setMessageStatus: adminProcedure
    .input(z.object({ id: z.string().min(1), status: z.enum(["new", "read", "replied"]) }))
    .mutation(async ({ input }) => {
      const row = await q.setContactMessageStatus(input.id, input.status);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      return row;
    }),
  // Full CRUD on the inbox. The panel could previously only flip a status flag;
  // these make it a real two-way surface: create a message the owner records
  // (a phone enquiry), edit one, delete one, and REPLY to one - which actually
  // sends the customer an email rather than only marking the row.
  createMessage: adminProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(CONTACT_NAME_MAX),
        email: z.string().trim().email().max(200),
        topic: z.string().trim().min(1).max(120),
        message: z.string().trim().min(1).max(CONTACT_MESSAGE_MAX),
      }),
    )
    .mutation(({ input }) =>
      q.createContactMessage({
        name: sanitizePlainText(input.name, CONTACT_NAME_MAX),
        email: input.email,
        topic: sanitizePlainText(input.topic, 120),
        message: sanitizeMessage(input.message, CONTACT_MESSAGE_MAX),
        source: "admin",
      }),
    ),
  updateMessage: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(CONTACT_NAME_MAX).optional(),
        email: z.string().trim().email().max(200).optional(),
        topic: z.string().trim().min(1).max(120).optional(),
        message: z.string().trim().min(1).max(CONTACT_MESSAGE_MAX).optional(),
        status: z.enum(["new", "read", "replied"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const patch: Record<string, string> = {};
      if (rest.name !== undefined) patch.name = sanitizePlainText(rest.name, CONTACT_NAME_MAX);
      if (rest.email !== undefined) patch.email = rest.email;
      if (rest.topic !== undefined) patch.topic = sanitizePlainText(rest.topic, 120);
      if (rest.message !== undefined) patch.message = sanitizeMessage(rest.message, CONTACT_MESSAGE_MAX);
      if (rest.status !== undefined) patch.status = rest.status;
      const row = await q.updateContactMessage(id, patch);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      return row;
    }),
  deleteMessage: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const ok = await q.deleteContactMessage(input.id);
      if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      return { ok: true };
    }),
  /** Reply to a message: send the customer an email AND record the reply against
   *  the row. The reply is stored even when the send fails, so the panel never
   *  loses what the owner wrote - the returned `emailStatus` says whether it
   *  actually went out. */
  replyToMessage: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        replyBody: z.string().trim().min(1).max(CONTACT_MESSAGE_MAX),
      }),
    )
    .mutation(async ({ input }) => {
      const messages = await q.listContactMessages(500);
      const target = messages.find((m) => m.id === input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      const replyBody = sanitizeMessage(input.replyBody, CONTACT_MESSAGE_MAX);
      const settings = await getSettings();
      const sent = await sendContactReplyEmail(
        {
          to: target.email,
          name: target.name,
          originalMessage: target.message,
          replyBody,
        },
        settings,
      ).catch(() => ({ status: "failed" as const, reason: "Could not reach the mail provider." }));
      const row = await q.recordContactMessageReply(input.id, replyBody);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      return { message: row, emailStatus: sent.status, emailReason: sent.reason ?? null };
    }),

  // ── product images (upload) ──────────────────────────────────────────────
  /** Step 1 of the 3-step upload: hand back a signed PUT URL. The browser
   *  uploads the bytes straight to storage; the server never sees them. */
  uploadImage: adminProcedure
    .input(
      z.object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!PRODUCT_IMAGE_TYPES.has(input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That file type isn't supported. Use a PNG, JPEG, GIF, WebP or AVIF image.",
        });
      }
      const key = `products/${crypto.randomUUID()}-${sanitizeBasename(input.filename)}`;
      try {
        const { uploadUrl, publicPath } = await storagePutUrl(key, input.contentType, {
          ownerId: ctx.user.id,
        });
        return { uploadUrl, key, publicPath };
      } catch (e) {
        storageErrorToTrpc(e);
      }
    }),

  /** Step 3 of the 3-step upload: index the object that just landed (step 2 is
   *  the browser's PUT). Returns the URL to store on the product. */
  commitImage: adminProcedure
    .input(z.object({ key: z.string().min(1).max(400), name: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const rec = await storageCommit(input.key, { ownerId: ctx.user.id, name: input.name });
        // publicPathFor() is the driver's own read URL: the R2 public URL when
        // R2 is configured, else the same-origin /app-storage path (which works
        // in an <img src> and on the storefront either way).
        return { key: rec.key, url: publicPathFor(rec.key) };
      } catch (e) {
        storageErrorToTrpc(e);
      }
    }),

  // ── transactional email ──────────────────────────────────────────────────
  /** Recent send attempts across the store, for the admin email panel. */
  emails: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional())
    .query(({ input }) => listRecentEmails(input?.limit ?? 50)),

  /** Re-send a transactional email for an order (confirmation or shipping).
   *  Used when the first attempt was skipped for a missing key, or failed. */
  resendOrderEmail: adminProcedure
    .input(
      z.object({
        orderId: z.string().min(1),
        kind: z.enum(["order_confirmation", "shipping_notification"]),
        origin: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const detail = await q.getOrderDetail(input.orderId);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      const settings = await getSettings();
      const ctx = {
        id: detail.order.id,
        orderNumber: detail.order.orderNumber,
        email: detail.order.email,
        currency: detail.order.currency,
        subtotalCents: detail.order.subtotalCents,
        shippingCents: detail.order.shippingCents,
        taxCents: detail.order.taxCents,
        totalCents: detail.order.totalCents,
        shippingAddress: detail.order.shippingAddress,
        carrier: detail.order.carrier,
        trackingNumber: detail.order.trackingNumber,
      };
      const lines = toEmailLines(detail.items);
      const result = input.kind === "shipping_notification"
          ? await sendShippingNotification(ctx, lines, settings, input.origin)
          // The confirmation kind is now the PAID receipt, which is gated and
          // one-shot. This admin action is the deliberate override for the
          // ``not_delivered`` case (an attempt refused while RESEND_API_KEY was
          // unset) - it goes through the same gate and claim, so it can deliver
          // a receipt that has not gone yet but can never duplicate one that
          // has.
          : await sendPaidReceiptOnce({
              orderId: input.orderId,
              verifiedPaid: true,
              origin: input.origin,
              trigger: "admin_resend",
            });
      // The same admin action is the retry path for a Telegram notification that
      // did not land (its claim is released on failure, so this can still deliver
      // it) and can never send a duplicate.
      await notifyPaidOrderOnce({
        orderId: input.orderId,
        verifiedPaid: true,
        trigger: "admin_resend",
      });
      return {
        ...result,
        kind: input.kind as EmailKind,
        kindLabel: EMAIL_KIND_LABEL[input.kind as EmailKind],
        emails: await listEmailsForOrder(input.orderId),
      };
    }),

  // settings
  settings: adminProcedure.query(() => getSettings()),

  // The home page promo cards' admin surface: read the current picks (with the
  // resolved product so the panel can preview the real card) and save new ones.
  // An empty string clears a pick, which makes the storefront fall back to the
  // best available product for that slot.
  promo: adminProcedure.query(async () => {
    const settings = await getSettings();
    const slots = await resolvePromoSlots();
    return {
      newArrivalsProductId: settings.promo_new_arrivals_product_id,
      bestSellersProductId: settings.promo_best_sellers_product_id,
      newArrivals: slots.new_arrivals,
      bestSellers: slots.best_sellers,
    };
  }),
  setPromo: adminProcedure
    .input(
      z.object({
        newArrivalsProductId: z.string().max(64).optional(),
        bestSellersProductId: z.string().max(64).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const patch: Record<string, string> = {};
      if (input.newArrivalsProductId !== undefined) {
        patch.promo_new_arrivals_product_id = input.newArrivalsProductId.trim();
      }
      if (input.bestSellersProductId !== undefined) {
        patch.promo_best_sellers_product_id = input.bestSellersProductId.trim();
      }
      await updateSettings(patch);
      const settings = await getSettings();
      const slots = await resolvePromoSlots();
      return {
        newArrivalsProductId: settings.promo_new_arrivals_product_id,
        bestSellersProductId: settings.promo_best_sellers_product_id,
        newArrivals: slots.new_arrivals,
        bestSellers: slots.best_sellers,
      };
    }),

  // The home page "Our featured picks" rail: the owner's ORDERED product ids.
  // Read returns the stored order plus the resolved products (so the panel can
  // preview the real rail); save replaces the order. An empty list clears the
  // picks, which makes the storefront fall back to the products flagged
  // `featured`, then the newest - so the rail is never empty.
  featuredPicks: adminProcedure.query(async () => {
    const settings = await getSettings();
    const ids = dedupeIds(String(settings.featured_pick_ids ?? ""));
    const products = await q.getActiveProductsByIds(ids);
    const byId = new Map(products.map((p) => [p.id, p]));
    return {
      productIds: ids,
      products: ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
    };
  }),
  setFeaturedPicks: adminProcedure
    .input(z.object({ productIds: z.array(z.string().max(64)).max(24) }))
    .mutation(async ({ input }) => {
      const ids = dedupeIds(input.productIds.join(","));
      await updateSettings({ featured_pick_ids: ids.join(",") });
      const settings = await getSettings();
      const stored = dedupeIds(String(settings.featured_pick_ids ?? ""));
      const products = await q.getActiveProductsByIds(stored);
      const byId = new Map(products.map((p) => [p.id, p]));
      return {
        productIds: stored,
        products: stored.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
      };
    }),

  updateSettings: adminProcedure
    .input(
      z.object({
        brand_name: z.string().optional(),
        tagline: z.string().optional(),
        announcement: z.string().optional(),
        hero_headline: z.string().optional(),
        hero_subhead: z.string().optional(),
        contact_email: z.string().optional(),
        contact_phone: z.string().optional(),
        support_hours: z.string().optional(),
        business_address: z.string().optional(),
        shipping_flat_cents: z.number().int().min(0).optional(),
        free_shipping_threshold_cents: z.number().int().min(0).optional(),
        shipping_estimate: z.string().optional(),
        tax_rate_bps: z.number().int().min(0).max(10000).optional(),
        return_window_days: z.number().int().min(0).max(365).optional(),
        low_stock_threshold: z.number().int().min(LOW_STOCK_MIN).max(LOW_STOCK_MAX).optional(),
        payment_provider: z.string().optional(),
        currency: z.string().optional(),
        email_from_name: z.string().max(120).optional(),
        email_from_address: z.string().max(200).optional(),
        email_reply_to: z.string().max(200).optional(),
      }),
    )
    .mutation(({ input }) => updateSettings(input)),
});

export const appRouter = router({
  auth: authRouter,
  adminAuth: adminAuthRouter,
  catalog: catalogRouter,
  reviews: reviewsRouter,
  settings: settingsRouter,
  newsletter: newsletterRouter,
  contact: contactRouter,
  wishlist: wishlistRouter,
  cart: cartRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  account: accountRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;