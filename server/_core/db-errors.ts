// Reading a failed write. Kept in its own leaf module (no env, no driver, no
// imports at all) so anything - _core, server/db.ts, a router - can ask "was
// that a duplicate?" without dragging a DB connection into the process.
//
// Postgres reports a violated UNIQUE index as SQLSTATE 23505. The catch is that
// Drizzle never re-throws the driver's error: it wraps it in a
// `DrizzleQueryError` whose OWN message is
//
//     Failed query: insert into "users" (...) values (default, $1, $2, ...)
//     params: someone@example.com,$2b$10$…,Name
//
// and hangs the real error off `.cause`. So `catch (e) { /unique/.test(e.message) }`
// reads the wrapper, matches nothing, and the duplicate escapes as an
// INTERNAL_SERVER_ERROR that quotes the SQL - and every bound param, password
// hash included - back to the browser. Walk the cause chain instead.

/** SQLSTATE for `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

/** Postgres's own wording, used as a fallback when a driver drops the code. */
const UNIQUE_VIOLATION_TEXT = /duplicate key value violates unique constraint(?: "([^"]+)")?/i;

/**
 * True when `e` (or anything it wraps) is a UNIQUE-index violation.
 *
 * Pass `constraint` when a table has more than one unique index and the answer
 * changes the message - e.g. `isUniqueViolation(e, "notes_owner_title_unique")`.
 * Omit it when the table has exactly one, as `users` does with `email`.
 */
export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const seen = new Set<unknown>(); // `.cause` chains can loop; don't spin on one
  for (let err: unknown = e; err && typeof err === "object" && !seen.has(err); ) {
    seen.add(err);
    const { code, constraint: name, message, cause } = err as Record<string, unknown>;
    const text = typeof message === "string" ? message : "";
    const matched = UNIQUE_VIOLATION_TEXT.exec(text);
    if (String(code) === UNIQUE_VIOLATION || matched) {
      // The driver's own `constraint` field when it has one, else whatever
      // Postgres quoted in the message.
      const violated = typeof name === "string" ? name : (matched?.[1] ?? "");
      if (!constraint || violated === constraint) return true;
    }
    err = cause;
  }
  return false;
}

/** SQLSTATE for `undefined_table` - a query named a relation that does not exist. */
const UNDEFINED_TABLE = "42P01";

/** Postgres's own wording, used as a fallback when a driver drops the code. */
const UNDEFINED_TABLE_TEXT = /relation "([^"]+)" does not exist/i;

/**
 * True when `e` (or anything it wraps) is a missing-relation error.
 *
 * This is the signature of a schema that is BEHIND the code: a migration that
 * was generated and committed but never applied to the database the app is
 * talking to. It is not a bug in the request, so it must not be reported to the
 * user as one - the caller can turn it into an honest "temporarily unavailable"
 * message instead of the opaque "Something went wrong".
 */
export function isMissingRelation(e: unknown): boolean {
  const seen = new Set<unknown>();
  for (let err: unknown = e; err && typeof err === "object" && !seen.has(err); ) {
    seen.add(err);
    const { code, message, cause } = err as Record<string, unknown>;
    const text = typeof message === "string" ? message : "";
    if (String(code) === UNDEFINED_TABLE || UNDEFINED_TABLE_TEXT.test(text)) return true;
    err = cause;
  }
  return false;
}

/** Wording that means "the database is not reachable / not configured", as
 *  opposed to a genuine bug in the request. */
const DB_UNAVAILABLE_RE =
  /Missing required env var|ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ENOTFOUND|ETIMEDOUT|EPIPE|getaddrinfo|socket hang up|fetch failed|connection refused|password authentication|does not exist|relation .* does not exist|terminating connection|Connection terminated|Connection closed|timeout expired|connection timeout|Cannot use a pool after|remaining connection slots|too many clients|NeonDbError|DATABASE_URL/i;

/**
 * True when `e` (or anything it wraps) means the database is unreachable or not
 * configured - a cold Neon endpoint, a missing DATABASE_URL, a schema that is
 * behind the code - rather than a bug in the request.
 *
 * The cause chain is WALKED, not just the top-level message: Drizzle never
 * re-throws the driver's error, it wraps it in a `DrizzleQueryError` whose own
 * message is `Failed query: select ... params: ...` and hangs the real reason
 * (`getaddrinfo ENOTFOUND ...`, `Connection terminated unexpectedly`, ...) off
 * `.cause`. Testing only `err.message` therefore matches NOTHING for the very
 * failures this guard exists to catch.
 *
 * This is a LEAF module (no db, no env, no driver) so a router can ask the
 * question without dragging a database connection into the process. It is used
 * to answer with an honest, leak-free "temporarily unavailable" message - never
 * to serve fabricated data.
 */
export function isDbUnavailable(e: unknown): boolean {
  if (typeof e === "string") return DB_UNAVAILABLE_RE.test(e);
  const seen = new Set<unknown>(); // `.cause` chains can loop; don't spin on one
  for (let err: unknown = e; err && typeof err === "object" && !seen.has(err); ) {
    seen.add(err);
    const { message, code, cause } = err as {
      message?: unknown;
      code?: unknown;
      cause?: unknown;
    };
    const text = typeof message === "string" ? message : "";
    if (DB_UNAVAILABLE_RE.test(text) || DB_UNAVAILABLE_RE.test(String(code ?? ""))) {
      return true;
    }
    err = cause;
  }
  return false;
}

/** Postgres's own wording for a column that a query named but the table lacks. */
const UNDEFINED_COLUMN_TEXT = /column "([^"]+)"(?: of relation "([^"]+)")? does not exist/i;

/**
 * A short, operator-facing description of a schema that is BEHIND the code, or
 * null when the failure is not schema drift.
 *
 * This is the difference between a log line that says "database unavailable" and
 * one that names the exact fix. A missing column or relation is the signature of
 * a migration that was committed but never applied, so the message points at the
 * migration command rather than leaving an operator to guess. It is for the
 * SERVER LOG only - it is never sent to the browser (the user still gets the
 * short, leak-free "temporarily unavailable" sentence).
 */
export function schemaDriftDetail(e: unknown): string | null {
  const seen = new Set<unknown>();
  let sawUndefinedTable = false;
  // Walk the WHOLE chain first, preferring a message that NAMES the object. The
  // wrapper (DrizzleQueryError) can carry the driver's SQLSTATE on itself while
  // its own message is only `Failed query: ...`, so a code check that fires on
  // the first node would report a nameless "a relation" even though the cause
  // names it. Only fall back to the code-based generic when no message anywhere
  // names the object.
  for (let err: unknown = e; err && typeof err === "object" && !seen.has(err); ) {
    seen.add(err);
    const { code, message, cause } = err as Record<string, unknown>;
    const text = typeof message === "string" ? message : "";
    const col = UNDEFINED_COLUMN_TEXT.exec(text);
    if (col) {
      const where = col[2] ? ` on table "${col[2]}"` : "";
      return `missing column "${col[1]}"${where} - the database schema is behind the code; run \`pnpm db:migrate\` against it`;
    }
    const rel = UNDEFINED_TABLE_TEXT.exec(text);
    if (rel) {
      return `missing relation "${rel[1]}" - the database schema is behind the code; run \`pnpm db:migrate\` against it`;
    }
    if (String(code) === UNDEFINED_TABLE) sawUndefinedTable = true;
    err = cause;
  }
  if (sawUndefinedTable) {
    return "missing relation - the database schema is behind the code; run `pnpm db:migrate` against it";
  }
  return null;
}
