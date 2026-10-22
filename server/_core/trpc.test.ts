import { afterEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { z } from "zod";

import { router, publicProcedure } from "./trpc";

// The exact error a duplicate signup produced before this was handled: Drizzle's
// wrapper, whose message is the INSERT plus every bound value - email, bcrypt
// hash, name.
function drizzleFailure() {
  return new DrizzleQueryError(
    'insert into "users" ("id", "email", "password_hash", "name") values (default, $1, $2, $3) returning "id"',
    ["asce1885@gmail.com", "$2b$10$lz3khdQ4ZWLRwguG/EufKu", "asce"],
    Object.assign(new Error('duplicate key value violates unique constraint "users_email_unique"'), {
      code: "23505",
    }),
  );
}

const testRouter = router({
  unhandled: publicProcedure.query(() => {
    throw drizzleFailure();
  }),
  handled: publicProcedure.query(() => {
    throw new TRPCError({ code: "CONFLICT", message: "That email is already registered." });
  }),
  // A procedure with a real input schema. Calling it with a bad value makes the
  // framework raise a BAD_REQUEST whose message IS the serialised zod issue list.
  validated: publicProcedure
    .input(z.object({ search: z.string().max(120).optional() }))
    .query(({ input }) => input.search ?? ""),
});

async function call(path: string, input?: unknown): Promise<{ status: number; body: string }> {
  const query = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const res = await fetchRequestHandler({
    endpoint: "/trpc",
    req: new Request(`http://app.test/trpc/${path}${query}`),
    router: testRouter,
    createContext: () => ({ c: {}, db: {}, user: null }) as never,
  });
  return { status: res.status, body: await res.text() };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// A router that forgets to translate a DB failure is a WHEN, not an IF - each
// app's routers.ts is written per-app. tRPC's default formatter puts
// `error.message` on the wire verbatim, so that oversight used to hand the
// browser the SQL statement and its params (2026-08-26, auth.signup on a
// published app). The floor is set here, once, for every procedure.
describe("errorFormatter", () => {
  it("never puts the failed query or its bound params on the wire", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const { status, body } = await call("unhandled");

    expect(status).toBe(500);
    expect(body).not.toMatch(/Failed query|insert into|params:|password_hash|\$2b\$|asce1885@gmail\.com/);
    expect(logged).toHaveBeenCalled(); // the detail survives - server-side only
  });

  it("answers a 500 with something a person can read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { body } = await call("unhandled");

    expect(JSON.parse(body).error.json.message).toBe(
      "Something went wrong on our end. Please try again in a moment.",
    );
  });

  it("leaves a deliberate TRPCError's message alone - that one is written for the user", async () => {
    const { status, body } = await call("handled");

    expect(status).toBe(409);
    expect(JSON.parse(body).error.json.message).toBe("That email is already registered.");
  });

  // A zod failure is neither an unhandled error nor a deliberate one, so it fell
  // through BOTH guards: the message contains no SQL and no stack, and it is not
  // an INTERNAL_SERVER_ERROR. What reached the browser was the serialised issue
  // list - field name, limit, validator - which is a description of our schema
  // and is meaningless to a shopper. It shipped until the search gate caught it.
  it("never puts a zod issue list (our field names and limits) on the wire", async () => {
    const { status, body } = await call("validated", { search: "x".repeat(5000) });

    expect(status).toBe(400);
    const message = JSON.parse(body).error.json.message;
    expect(message).toBe("Please check the details you entered and try again.");
    // None of the schema description survives. Note `"path"` alone is NOT a
    // usable marker: the tRPC envelope carries its own `data.path`, which is the
    // PROCEDURE name and is not a leak. The zod issue is what must be gone, and
    // its shape includes the field name it failed on.
    expect(body).not.toContain("too_big");
    expect(body).not.toContain('"origin"');
    expect(body).not.toContain("maximum");
    expect(body).not.toContain('"search"');
  });

  it("still accepts a valid value for that same field", async () => {
    const { status, body } = await call("validated", { search: "dog bed" });

    expect(status).toBe(200);
    expect(JSON.parse(body).result.data.json).toBe("dog bed");
  });
});
