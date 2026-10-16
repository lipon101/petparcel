// Set (or reset) a user's password.
//
//   pnpm set-password <email> <new-password>
//   # or, to keep the password out of your shell history AND out of `ps`:
//   SET_PASSWORD_EMAIL=you@example.com SET_PASSWORD_NEW='a-strong-password' pnpm set-password
//
// Reads DATABASE_URL (same as every other script in this repo), hashes with the
// app's own bcrypt library at the SAME cost factor the app uses (10), and
// updates the row in place.
//
// WHY A SCRIPT: `users.password_hash` is a bcrypt digest (e.g. `$2b$10$...`).
// It cannot be edited by hand - a hand-typed string is not a valid digest and
// will simply never verify, locking the account out. Only a fresh hash of the
// intended password lets the account sign in.
//
// It NEVER prints the password or the hash - only a confirmation, and the
// affected account's email + id. If the write cannot be read back and verified
// with a real bcrypt compare, it reports failure rather than a false success.
import "dotenv/config";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import { db } from "../server/_core/db";
import { users } from "../drizzle/schema";

// Must match server/_core/auth.ts (bcrypt cost 10) so every hash in the table
// is produced with one consistent work factor.
const BCRYPT_COST = 10;

const email = (process.argv[2] ?? process.env.SET_PASSWORD_EMAIL ?? "").trim().toLowerCase();
const password = process.argv[3] ?? process.env.SET_PASSWORD_NEW ?? "";

if (!email || !email.includes("@")) {
  console.error("Usage: pnpm set-password <email> <new-password>");
  console.error("   or: SET_PASSWORD_EMAIL=you@example.com SET_PASSWORD_NEW='...' pnpm set-password");
  process.exit(1);
}
if (password.length < 8) {
  console.error("The new password must be at least 8 characters.");
  process.exit(1);
}

const passwordHash = await hash(password, BCRYPT_COST);

const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (!existing) {
  console.error(`No account found for ${email}. Nothing was changed.`);
  process.exit(1);
}

await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id));

// Read the row back and prove the stored digest actually matches the new
// password - confirmation without ever echoing the hash.
const [after] = await db.select().from(users).where(eq(users.id, existing.id)).limit(1);
const verified = !!after?.passwordHash && (await compare(password, after.passwordHash));
if (!verified) {
  console.error("The update could not be verified - the password was NOT changed.");
  process.exit(1);
}

console.log(`Password updated for ${after.email} (id ${after.id}, role ${after.role}).`);
console.log("Existing sessions stay signed in until their token expires; sign in again with the new password.");
process.exit(0);
