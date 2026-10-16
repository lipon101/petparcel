// One place that turns ANY thrown value into a short, safe, user-facing string.
//
// The server's tRPC error formatter already guarantees that a deliberate error
// carries a shopper-written message and that an unhandled one is replaced with a
// generic sentence (see server/_core/trpc.ts). This is the client-side floor
// under that: a network failure, a malformed response or a thrown non-Error
// would otherwise surface a raw string like "Failed to fetch" or "[object
// Object]" on the page. Anything that still looks internal is swapped for the
// generic message, so no raw error text, code or internal detail can ever reach
// the shopper.
const GENERIC = "Something went wrong on our end. Please try again in a moment.";

const LEAK_PATTERN =
  /Failed query|insert into|update\s+"|delete from|select\s+.+\s+from|params:|relation\s+"|column\s+"|SQLSTATE|\$2[aby]\$|at\s+\w+\s+\(|node_modules|drizzle|pg_|ECONNREFUSED|ETIMEDOUT|Failed to fetch|NetworkError|Load failed|\[object|is not valid JSON|Unexpected token|Unexpected end of JSON/i;

/** A safe, human message for any error thrown by a tRPC call or a fetch. */
export function safeErrorMessage(err: unknown, fallback = GENERIC): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const text = raw.trim();
  if (!text || LEAK_PATTERN.test(text)) return fallback;
  return text;
}
