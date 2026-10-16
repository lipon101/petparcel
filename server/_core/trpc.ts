import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { AppContext } from "./context";
import { ADMIN_FORBIDDEN_MESSAGE, isDesignatedAdmin } from "./admin-access";

/** All a client ever learns about an unhandled server failure. Short, safe and
 *  free of any internal detail - no SQL, no table or relation names, no stack,
 *  no infrastructure hints. The real cause is logged server-side only. */
export const OPAQUE_SERVER_ERROR =
  "Something went wrong on our end. Please try again in a moment.";

// tRPC's default formatter copies `error.message` straight onto the wire. For a
// TRPCError you threw on purpose that is exactly right - the message was
// written for the user. For anything that merely ESCAPED a procedure it is a
// leak: Drizzle's failure message is `Failed query: <the whole INSERT>\nparams:
// <every bound value>`, so a duplicate signup used to answer 500 with the SQL
// and the bcrypt password hash in it, which the signup form then printed on the
// page (2026-08-26, auth.signup on a published app).
//
// Two rules keep the wire clean:
//   1. An unhandled failure (INTERNAL_SERVER_ERROR) is ALWAYS replaced with one
//      short, safe sentence - never the driver's message, never a stack.
//   2. A deliberate TRPCError keeps its message, because that text was written
//      for the shopper - but only after a leak guard: if the message still looks
//      like SQL, a stack frame or a driver error, it is swapped for a safe
//      fallback for its code. So no raw error text, code or internal detail can
//      reach the browser even if a router forgets to translate a failure.
//
// The real cause is logged server-side only, so operators keep the detail.
const LEAK_PATTERN =
  /Failed query|insert into|update\s+"|delete from|select\s+.+\s+from|params:|relation\s+"|column\s+"|SQLSTATE|\$2[aby]\$|at\s+\w+\s+\(|node_modules|drizzle|pg_|ECONNREFUSED|ETIMEDOUT/i;

/** A SHAPE AN APP MUST NEVER SHOW. A zod failure is serialised as a JSON blob
 *  that describes our schema - `{"origin":"string","code":"too_big",
 *  "maximum":120,"path":["search"]}` - so a caller who sends an over-long
 *  field learns our field names, our limits and our validator. Useful to a
 *  developer, free reconnaissance to anyone else, and meaningless to a shopper.
 *  These markers identify it without depending on zod's exact wording. */
const VALIDATION_DUMP =
  /"origin"\s*:|too_big|too_small|invalid_type|unrecognized_keys|invalid_enum_value|"path"\s*:\s*\[|expected\s+"?\w+\"?[, ]/i;

/** A short, safe message for a given tRPC code, used when a deliberate error's
 *  own text cannot be trusted (or is missing). */
function safeFallbackFor(code: string): string {
  switch (code) {
    case "BAD_REQUEST":
      return "Please check the details you entered and try again.";
    case "UNAUTHORIZED":
      return "Please sign in to continue.";
    case "FORBIDDEN":
      return "You don't have access to that.";
    case "NOT_FOUND":
      return "We couldn't find what you were looking for.";
    case "CONFLICT":
      return "That didn't go through - please try again.";
    case "TOO_MANY_REQUESTS":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return OPAQUE_SERVER_ERROR;
  }
}

const t = initTRPC.context<AppContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // `stack` (dev only) starts with the same message - drop it with the rest.
    const { stack: _stack, ...data } = shape.data;
    if (error.code === "INTERNAL_SERVER_ERROR") {
      // eslint-disable-next-line no-console
      console.error("[trpc] unhandled error", error.cause ?? error); // detail stays server-side
      return { ...shape, message: OPAQUE_SERVER_ERROR, data };
    }
    // A deliberate error: keep its user-facing message unless it looks internal.
    //
    // The validation-dump check is separate from LEAK_PATTERN on purpose. A zod
    // message contains none of the SQL/stack markers - it is not a leaked
    // INTERNAL failure, it is a leaked SCHEMA, and it was reaching the browser
    // verbatim (an over-long search field came back as the raw zod issue list).
    const isValidationDump =
      error.code === "BAD_REQUEST" &&
      (VALIDATION_DUMP.test(error.message) ||
        (error.cause as { name?: string } | undefined)?.name === "ZodError");
    const message = isValidationDump
      ? safeFallbackFor(error.code)
      : error.message && !LEAK_PATTERN.test(error.message)
        ? error.message
        : safeFallbackFor(error.code);
    return { ...shape, message, data };
  },
});

export const router = t.router;
export const middleware = t.middleware;

/** Open to anyone. */
export const publicProcedure = t.procedure;

/** Requires an authenticated user; narrows ctx.user to non-null for downstream
 *  middleware/procedures. Inlined into .use() (not via a standalone middleware())
 *  so the ctx narrowing actually chains - a standalone middleware re-infers its
 *  input ctx from the root, where user is nullable. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Requires the SINGLE designated admin (see ./admin-access).
 *
 *  Builds on protectedProcedure, so ctx.user is non-null and an anonymous caller
 *  is already refused with UNAUTHORIZED before this runs. This layer adds the
 *  role check AND the single-admin address check: a signed-in account that is
 *  not the store's one admin gets FORBIDDEN - without an email match even if it
 *  somehow carries the `admin` role.
 *
 *  No client-side check can substitute for this: the browser only decides what
 *  it RENDERS, and a direct API call reaches this middleware regardless. */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isDesignatedAdmin(ctx.user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: ADMIN_FORBIDDEN_MESSAGE });
  }
  return next({ ctx });
});
