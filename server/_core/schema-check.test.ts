import { beforeEach, describe, expect, it, vi } from "vitest";

// The check reads the live schema through `db.execute(sql\`...\`)`. The driver is
// mocked so the rules can be exercised without a database: `execute` is the only
// thing this module touches.
vi.mock("./db", () => ({ db: { execute: vi.fn() } }));

import { db } from "./db";
import {
  EXPECTED_SCHEMA,
  countUnlinkedUsers,
  ensureSchemaChecked,
  findMissingObjects,
  formatSchemaWarning,
  formatUnlinkedUsersWarning,
  resetSchemaCheckForTests,
  resetUnlinkedUsersCheckForTests,
  runSchemaCheck,
  type SchemaCheckLogger,
} from "./schema-check";

/** A logger that records what the check would have printed. */
function captureLogger() {
  const warnings: string[] = [];
  const infos: string[] = [];
  const logger: SchemaCheckLogger = {
    warn: (m) => warnings.push(m),
    info: (m) => infos.push(m),
  };
  return { logger, warnings, infos };
}

/**
 * Build the information_schema rows for a database that has EXACTLY the expected
 * objects. Every expected table gets at least one column row (a real table can
 * never have zero columns), so the "table exists" and "column exists" checks are
 * both satisfied.
 */
function rowsForFullSchema(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const tables = new Set<string>();
  for (const obj of EXPECTED_SCHEMA) {
    if (obj.column === null) {
      rows.push({ table_schema: "public", table_name: obj.table, column_name: "id" });
    } else {
      rows.push({ table_schema: "public", table_name: obj.table, column_name: obj.column });
    }
    tables.add(obj.table);
  }
  // A real database also carries columns we do not check; add one to prove noise
  // does not confuse the check.
  for (const t of tables) rows.push({ table_schema: "public", table_name: t, column_name: "created_at" });
  return rows;
}

beforeEach(() => {
  vi.mocked(db.execute).mockReset();
  resetSchemaCheckForTests();
  resetUnlinkedUsersCheckForTests();
});

describe("countUnlinkedUsers", () => {
  it("returns the count and warns (count only, no PII) when accounts are unlinked", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: [{ n: 3 }] } as never);
    const { logger, warnings } = captureLogger();
    const n = await countUnlinkedUsers(logger);
    expect(n).toBe(3);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("3 local user row(s)");
    // The warning must never name an address.
    expect(warnings[0]).not.toContain("@");
  });

  it("stays silent when every account is linked", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: [{ n: 0 }] } as never);
    const { logger, warnings } = captureLogger();
    expect(await countUnlinkedUsers(logger)).toBe(0);
    expect(warnings).toHaveLength(0);
  });

  it("returns null (unknown) and never throws when the database is unreachable", async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error("connection refused"));
    const { logger, warnings } = captureLogger();
    expect(await countUnlinkedUsers(logger)).toBeNull();
    expect(warnings[0]).toContain("unlinked-user check skipped");
  });

  it("formatUnlinkedUsersWarning names a count, never an email", () => {
    const line = formatUnlinkedUsersWarning(2);
    expect(line).toContain("2 local user row(s)");
    expect(line).not.toContain("@");
  });
});

describe("findMissingObjects", () => {
  it("reports nothing when every expected object is present", () => {
    const rows = rowsForFullSchema();
    const columns = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const tables = new Set(rows.map((r) => String(r.table_name)));
    expect(findMissingObjects(columns, tables)).toEqual([]);
  });

  it("names a missing COLUMN and the migration that adds it", () => {
    const rows = rowsForFullSchema().filter(
      (r) => !(r.table_name === "products" && r.column_name === "specs"),
    );
    const columns = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const tables = new Set(rows.map((r) => String(r.table_name)));
    const missing = findMissingObjects(columns, tables);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toEqual({
      table: "products",
      column: "specs",
      migration: "0004_military_agent_brand",
    });
  });

  it("names a missing RELATION (a whole table a migration never created)", () => {
    const rows = rowsForFullSchema().filter((r) => r.table_name !== "wishlist_items");
    const columns = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const tables = new Set(rows.map((r) => String(r.table_name)));
    const missing = findMissingObjects(columns, tables);
    expect(missing).toContainEqual({
      table: "wishlist_items",
      column: null,
      migration: "0008_tired_serpent_society",
    });
  });

  it("does not treat a table's OTHER columns as satisfying a missing one", () => {
    // The regression this guards: `products` exists with many columns but no
    // `specs` - the exact production failure - must still be reported.
    const columns = new Set(["products.id", "products.name", "products.price_cents"]);
    const tables = new Set(["products"]);
    const missing = findMissingObjects(columns, tables);
    expect(missing.some((m) => m.table === "products" && m.column === "specs")).toBe(true);
  });

  it("reports the Neon Auth bridge column the sign-in 500 came from", () => {
    const rows = rowsForFullSchema().filter(
      (r) => !(r.table_name === "users" && r.column_name === "neon_auth_user_id"),
    );
    const columns = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
    const tables = new Set(rows.map((r) => String(r.table_name)));
    expect(findMissingObjects(columns, tables)).toContainEqual({
      table: "users",
      column: "neon_auth_user_id",
      migration: "0010_neon_auth_link",
    });
  });
});

describe("formatSchemaWarning", () => {
  it("names the object, the migration and the fix on one line", () => {
    const line = formatSchemaWarning({
      table: "products",
      column: "specs",
      migration: "0004_military_agent_brand",
    });
    expect(line).toContain('missing column "products.specs"');
    expect(line).toContain("0004_military_agent_brand");
    expect(line).toContain("pnpm db:migrate");
    expect(line.split("\n")).toHaveLength(1);
  });

  it("uses relation wording for a whole-table miss", () => {
    const line = formatSchemaWarning({
      table: "wishlist_items",
      column: null,
      migration: "0008_tired_serpent_society",
    });
    expect(line).toContain('missing relation "wishlist_items"');
    expect(line).toContain("0008_tired_serpent_society");
  });
});

describe("runSchemaCheck", () => {
  it("logs ok and returns no violations on a fully-migrated database", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: rowsForFullSchema() } as never);
    const { logger, warnings, infos } = captureLogger();

    const missing = await runSchemaCheck(logger);

    expect(missing).toEqual([]);
    expect(warnings).toEqual([]);
    expect(infos.join("\n")).toContain("[schema-check] ok");
  });

  it("warns once per missing object, naming the column and the migration", async () => {
    const rows = rowsForFullSchema().filter(
      (r) => !(r.table_name === "products" && r.column_name === "specs"),
    );
    vi.mocked(db.execute).mockResolvedValue({ rows } as never);
    const { logger, warnings } = captureLogger();

    const missing = await runSchemaCheck(logger);

    expect(missing).toHaveLength(1);
    const drift = warnings.find((w) => w.includes("products.specs"));
    expect(drift).toBeDefined();
    expect(drift).toContain("0004_military_agent_brand");
    expect(drift).toContain("pnpm db:migrate");
    expect(warnings.some((w) => w.includes("1 expected database object(s) are missing"))).toBe(true);
  });

  it("never throws when the database is unreachable - it logs skipped instead", async () => {
    vi.mocked(db.execute).mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOTFOUND ep-cold-pooler.neon.tech"), {
        code: "ENOTFOUND",
      }),
    );
    const { logger, warnings } = captureLogger();

    const missing = await runSchemaCheck(logger);

    expect(missing).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("[schema-check] skipped");
  });

  it("tolerates the driver returning a bare array (not a { rows } envelope)", async () => {
    vi.mocked(db.execute).mockResolvedValue(rowsForFullSchema() as never);
    const { logger, infos } = captureLogger();
    expect(await runSchemaCheck(logger)).toEqual([]);
    expect(infos.join("\n")).toContain("ok");
  });

  it("names schema drift when the introspection query itself hits a missing object", async () => {
    vi.mocked(db.execute).mockRejectedValue(
      Object.assign(new Error('column "whatever" does not exist'), { code: "42703" }),
    );
    const { logger, warnings } = captureLogger();

    await runSchemaCheck(logger);

    expect(warnings[0]).toContain("[schema-check] skipped");
    // schemaDriftDetail enriched the reason with the column name.
    expect(warnings[0]).toContain("whatever");
  });
});

describe("ensureSchemaChecked", () => {
  it("runs the query only once, however many times it is called", async () => {
    vi.mocked(db.execute).mockResolvedValue({ rows: rowsForFullSchema() } as never);
    const { logger } = captureLogger();

    await Promise.all([ensureSchemaChecked(logger), ensureSchemaChecked(logger)]);
    await ensureSchemaChecked(logger);

    expect(vi.mocked(db.execute)).toHaveBeenCalledTimes(1);
  });

  it("resolves (never rejects) even when the query fails, for fire-and-forget use", async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error("connection refused"));
    await expect(ensureSchemaChecked(captureLogger().logger)).resolves.toEqual([]);
  });
});
