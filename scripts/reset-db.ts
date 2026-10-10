// DESTRUCTIVE dev utility: drop every table in the dev database.
//
//   pnpm db:reset   then   pnpm db:generate && pnpm db:migrate && pnpm seed
//
// This exists because `drizzle-kit generate` compares the schema against the
// live database and stops on an interactive prompt when a table exists in the
// DB but not in the schema (e.g. the template's example `items` table). A reset
// gives you a clean baseline so migrations can be regenerated non-interactively.
//
// NEVER run this against production.
import "dotenv/config";
import pg from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set (checked .env)");

  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    // `public` is the only schema this template uses.
    await client.query("drop schema if exists public cascade");
    await client.query("create schema public");
    console.log("Dev database reset: schema public dropped and recreated.");
  } finally {
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exit(1);
  });
