// CLI entry point for the demo-data seeder:  `pnpm seed`
//
// Loads DATABASE_URL from .env, seeds the catalog + settings + demo orders, and
// optionally creates a demo customer and an admin account so you can log in
// immediately after a fresh deploy.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/_core/db";
import { users } from "../drizzle/schema";
import { registerLocalUser } from "../server/_core/auth";
import { seedAll } from "../server/seed";

async function ensureUser(email: string, password: string, name: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (existing) return existing.id;
  const created = await registerLocalUser(email, password, name);
  return created.id;
}

async function promoteToAdmin(email: string) {
  await db.update(users).set({ role: "admin" }).where(eq(users.email, email.toLowerCase()));
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@petparcel.store";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "petparcel123";
  const customerEmail = process.env.SEED_CUSTOMER_EMAIL ?? "customer@petparcel.store";
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD ?? "petparcel123";

  const customerId = await ensureUser(customerEmail, customerPassword, "Demo Customer");
  const adminId = await ensureUser(adminEmail, adminPassword, "Store Admin");
  await promoteToAdmin(adminEmail);

  const result = await seedAll(customerId);

  console.log("Seed complete:", result);
  console.log("");
  console.log("  Admin login:    ", adminEmail, "/", adminPassword);
  console.log("  Customer login: ", customerEmail, "/", customerPassword);
  console.log("  Admin user id:  ", adminId);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
