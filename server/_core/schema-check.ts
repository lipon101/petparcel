// Startup schema check.
//
// WHY THIS EXISTS: a Drizzle migration that is generated and committed but never
// applied to the database the app is actually talking to leaves the live schema
// BEHIND the code. The app then fails at the first query that touches the
// missing object - and because the tRPC error formatter deliberately hides the
// cause from the browser, that presents as an opaque "Something went wrong" with
// nothing on the page to say why. The only place the truth appears is the server
// log, and only for the request that happened to hit it first.
//
// This module turns that into ONE clear, actionable warning logged when the
// process starts (and once per warm serverless instance): it reads
// `information_schema` and names every object the code expects but the database
// lacks, together with the migration that adds it.
//
// Three properties are deliberate:
//   * NON-FATAL - the app still starts and serves whatever DOES exist. A missing
//     column must never take the whole storefront down.
//   * LOG-ONLY - nothing here is ever returned to the browser. The user still
//     gets the short, leak-free "temporarily unavailable" sentence.
//   * NO FALLBACK - a missing schema is REPORTED, never papered over with demo
//     data. The catalog stays real, or honestly unavailable.
import { sql } from "drizzle-orm";

import { db } from "./db";
import { schemaDriftDetail } from "./db-errors";

/** One object the code depends on, plus the migration that creates it. */
export type ExpectedObject = {
  /** Table the object lives on, or the relation name when the whole table is it. */
  table: string;
  /** Column that must exist, or null when the whole relation is the check. */
  column: string | null;
  /** Drizzle migration tag that adds it - named in the warning so the fix is obvious. */
  migration: string;
};

/**
 * The objects added by migrations `0004`-`0010`.
 *
 * Only LATER migrations are listed. The base schema from `0000`-`0003` is what a
 * fresh database always has, so checking it would be noise - and these are
 * exactly the objects whose absence has already broken production once
 * (`products.specs` for the catalog, `users.neon_auth_user_id` for sign-in).
 * `users.email_verified_at` and `contact_messages.user_id` are included because
 * they sit on hot paths (sign-in and the contact form) where a missing column
 * produces the same opaque 500.
 */
export const EXPECTED_SCHEMA: readonly ExpectedObject[] = [
  // 0004 - products.specs. `listProducts` selects every column, so its absence
  // takes down the whole catalog (home, shop, new arrivals, best sellers).
  { table: "products", column: "specs", migration: "0004_military_agent_brand" },
  // 0005 - `auth` migration: a whole new table plus a column on the hot
  // sign-in/sign-up path.
  { table: "email_verifications", column: null, migration: "0005_dizzy_fantastic_four" },
  { table: "users", column: "email_verified_at", migration: "0005_dizzy_fantastic_four" },
  // 0006 - the contact form's table.
  { table: "contact_messages", column: null, migration: "0006_contact_messages" },
  // 0007 - buyer photos on a review.
  { table: "reviews", column: "images", migration: "0007_review_images" },
  // 0008 - per-account wishlist, plus linking a contact message to its account.
  { table: "wishlist_items", column: null, migration: "0008_tired_serpent_society" },
  { table: "contact_messages", column: "user_id", migration: "0008_tired_serpent_society" },
  // 0009 - the DB-backed login/signup throttle. Absent, the lockout degrades to
  // allow-through (best-effort), so this one is a warning, not an outage.
  { table: "login_attempts", column: null, migration: "0009_wooden_blockbuster" },
  // 0010 - the Neon Auth bridge. A missing column here 500s auth.login/signup.
  { table: "users", column: "neon_auth_user_id", migration: "0010_neon_auth_link" },
  // 0012 - Resend webhook events. Absent, the webhook receiver's insert fails
  // (logged, never surfaced to the caller), so this is a warning, not an outage.
  { table: "email_events", column: null, migration: "0012_email_events" },
  // 0043 - the Telegram order-notification claim. `notifyPaidOrderOnce` claims
  // `orders.telegram_notified_at` with a conditional UPDATE on the PAID path, so
  // a database that has the code but not the migration fails that UPDATE - the
  // order is still paid and the receipt still goes out, so this is a warning
  // rather than an outage, but it is exactly the drift this list exists to name.
  { table: "orders", column: "telegram_notified_at", migration: "0043_telegram_order_notifications" },
  { table: "orders", column: "telegram_notify_error", migration: "0043_telegram_order_notifications" },
  // 0044 - the durable Telegram retry queue. Its absence is not an outage: the
  // enqueue is best-effort and the in-request notification still fires. But a
  // Telegram outage that outlasts the request would then lose the alert
  // silently, which is exactly the drift this list exists to name.
  { table: "telegram_outbox", column: null, migration: "0044_telegram_outbox" },
  // 0045 - the "this scheduled job already ran for this period" claim. Absent,
  // the daily reconciliation still runs and still re-queues reminders; it just
  // cannot guarantee the owner receives at most ONE summary per day.
  { table: "job_run_claims", column: null, migration: "0045_job_run_claims" },
] as const;

/** One expected object that the live database does not have. */
export type SchemaViolation = ExpectedObject;

const MIGRATE_HINT = "run `pnpm db:migrate` against this database";

/**
 * Pure: which expected objects the live snapshot is missing.
 *
 * Split out from the query so the rule can be unit-tested without a database.
 * `presentColumns` holds `"<table>.<column>"` and `presentTables` holds bare
 * relation names.
 */
export function findMissingObjects(
  presentColumns: ReadonlySet<string>,
  presentTables: ReadonlySet<string>,
): SchemaViolation[] {
  const missing: SchemaViolation[] = [];
  for (const obj of EXPECTED_SCHEMA) {
    if (obj.column === null) {
      if (!presentTables.has(obj.table)) missing.push(obj);
    } else if (!presentColumns.has(`${obj.table}.${obj.column}`)) {
      missing.push(obj);
    }
  }
  return missing;
}

/**
 * Pure: the one log line an operator needs for a missing object.
 *
 * Names the object AND the migration that adds it, then the command to run - so
 * nothing has to be looked up. Never sent to the browser; the router keeps its
 * short, leak-free user message.
 */
export function formatSchemaWarning(violation: SchemaViolation): string {
  const what =
    violation.column === null
      ? `missing relation "${violation.table}"`
      : `missing column "${violation.table}.${violation.column}"`;
  return (
    `[schema-check] ${what} - added by migration ${violation.migration}; ` +
    `the database schema is behind the code - ${MIGRATE_HINT}`
  );
}

/** Where the check writes. Injected so tests can capture the lines. */
export type SchemaCheckLogger = {
  warn: (message: string) => void;
  info: (message: string) => void;
};

const DEFAULT_LOGGER: SchemaCheckLogger = {
  // eslint-disable-next-line no-console
  warn: (message) => console.warn(message),
  // eslint-disable-next-line no-console
  info: (message) => console.log(message),
};

/** How much of a failure reason is worth logging. Enough to act on, not a dump. */
const MAX_REASON = 160;

/** A short, single-line description of why the introspection query failed. */
function reasonFor(err: unknown): string {
  const drift = schemaDriftDetail(err);
  if (drift) return drift;
  const raw = err instanceof Error ? err.message : String(err);
  const firstLine = raw.split("\n")[0] ?? raw;
  return firstLine.length > MAX_REASON ? `${firstLine.slice(0, MAX_REASON)}…` : firstLine;
}

/** Normalise the two drivers' `execute()` result shapes to a plain row list. */
function rowsOf(result: unknown): Record<string, unknown>[] {
  const maybe = result as { rows?: unknown } | null;
  if (maybe && Array.isArray(maybe.rows)) return maybe.rows as Record<string, unknown>[];
  return Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
}

/**
 * Read the live schema and log what is missing. NEVER throws.
 *
 * Returns the violations so a caller (or a test) can act on them without
 * re-parsing the log.
 */
export async function runSchemaCheck(
  logger: SchemaCheckLogger = DEFAULT_LOGGER,
): Promise<SchemaViolation[]> {
  try {
    // One query is enough: every relation has at least one column, so a table
    // that is entirely absent simply never appears here.
    const result = await db.execute(sql`
      select table_schema, table_name, column_name
      from information_schema.columns
      where table_schema not in ('pg_catalog', 'information_schema')
    `);
    const presentColumns = new Set<string>();
    const presentTables = new Set<string>();
    for (const row of rowsOf(result)) {
      const table = typeof row.table_name === "string" ? row.table_name : "";
      const column = typeof row.column_name === "string" ? row.column_name : "";
      if (!table || !column) continue;
      presentTables.add(table);
      presentColumns.add(`${table}.${column}`);
    }

    const missing = findMissingObjects(presentColumns, presentTables);
    if (missing.length === 0) {
      logger.info(
        `[schema-check] ok - database schema matches the code ` +
          `(${EXPECTED_SCHEMA.length} expected objects present)`,
      );
      return missing;
    }
    for (const violation of missing) logger.warn(formatSchemaWarning(violation));
    logger.warn(
      `[schema-check] ${missing.length} expected database object(s) are missing - ` +
        `the storefront will fail on any request that touches them until migrations are applied.`,
    );
    return missing;
  } catch (err) {
    // Non-fatal by design: a database that is unreachable at boot (a cold Neon
    // endpoint, a missing DATABASE_URL) is not a reason to refuse to start.
    logger.warn(`[schema-check] skipped - could not read the database schema (${reasonFor(err)})`);
    return [];
  }
}

let checked: Promise<SchemaViolation[]> | undefined;

/**
 * Run the check ONCE per process. Fire-and-forget friendly: the returned promise
 * never rejects, so `void ensureSchemaChecked()` is safe at a boot site.
 */
export function ensureSchemaChecked(logger?: SchemaCheckLogger): Promise<SchemaViolation[]> {
  if (!checked) {
    checked = runSchemaCheck(logger).catch(() => {
      // runSchemaCheck already swallows its own failures; this is belt-and-braces
      // so a fire-and-forget call can never surface an unhandled rejection.
      return [] as SchemaViolation[];
    });
  }
  return checked;
}

/** Test seam: forget that the check already ran. */
export function resetSchemaCheckForTests(): void {
  checked = undefined;
}

// ── Unlinked-user check ──────────────────────────────────────────────────────
//
// A local `users` row with `neon_auth_user_id IS NULL` is an account that has no
// Neon Auth credential behind it. On a Neon-Auth deployment that is a real
// problem: the person cannot sign in (the credential lives at the provider), and
// the bridge will only link them on their next successful sign-in - which they
// cannot complete. It is NOT fatal (the storefront and every other account keep
// working), so this is a WARNING, never a startup failure, and it names only a
// COUNT - never an email or any other PII.
//
// Surfaced in `/api/health` as `unlinkedUsers` so an operator can see it without
// reading logs, and logged once per process at boot.

/** Pure: the one log line for N unlinked accounts. No PII - a count only. */
export function formatUnlinkedUsersWarning(count: number): string {
  return (
    `[schema-check] ${count} local user row(s) have no Neon Auth link ` +
    `(neon_auth_user_id is null) - those accounts cannot sign in on a Neon Auth ` +
    `deployment until they are linked; they link automatically on a successful ` +
    `sign-in, or set users.neon_auth_user_id by hand.`
  );
}

/**
 * Count local users with no Neon Auth link. NEVER throws: a database that is
 * unreachable returns null (unknown), which the health endpoint reports as such
 * rather than as a false zero.
 */
export async function countUnlinkedUsers(
  logger: SchemaCheckLogger = DEFAULT_LOGGER,
): Promise<number | null> {
  try {
    const result = await db.execute(sql`
      select count(*)::int as n from users where neon_auth_user_id is null
    `);
    const row = rowsOf(result)[0];
    const n = row && typeof row.n === "number" ? row.n : Number(row?.n ?? 0);
    if (n > 0) logger.warn(formatUnlinkedUsersWarning(n));
    return n;
  } catch (err) {
    logger.warn(`[schema-check] unlinked-user check skipped (${reasonFor(err)})`);
    return null;
  }
}

let unlinkedChecked: Promise<number | null> | undefined;

/** Run the unlinked-user check ONCE per process. Never rejects. */
export function ensureUnlinkedUsersChecked(logger?: SchemaCheckLogger): Promise<number | null> {
  if (!unlinkedChecked) {
    unlinkedChecked = countUnlinkedUsers(logger).catch(() => null);
  }
  return unlinkedChecked;
}

/** Test seam: forget that the unlinked-user check already ran. */
export function resetUnlinkedUsersCheckForTests(): void {
  unlinkedChecked = undefined;
}
