// Promote (or create) a store administrator.
//
//   ADMIN_EMAIL=you@yourstore.com ADMIN_PASSWORD='a-strong-password' pnpm admin:create
//
// Deliberately takes BOTH values from the environment and ships with no default
// password, so no usable admin credential ever lives in the repository. Run it
// against whichever database you're targeting (it reads DATABASE_URL).
import "dotenv/config";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "../server/_core/db";
import { users } from "../drizzle/schema";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!email || !email.includes("@")) {
  console.error("Set ADMIN_EMAIL to a valid email address.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Set ADMIN_PASSWORD to at least 8 characters.");
  process.exit(1);
}

const passwordHash = await hash(password, 10);
const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);

if (existing) {
  await db.update(users).set({ role: "admin", passwordHash }).where(eq(users.id, existing.id));
  console.log(`Updated ${email} — now an admin, password reset.`);
} else {
  await db.insert(users).values({ email, passwordHash, name: "Store Owner", role: "admin" });
  console.log(`Created admin account ${email}.`);
}

console.log("Sign in at /login and the admin panel is available at /admin.");
process.exit(0);
