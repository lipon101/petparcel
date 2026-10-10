import { db } from "../server/_core/db.ts";
import { addresses, userProfiles } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
const rows = await db.select().from(addresses).where(eq(addresses.userId, "6c96dee2-847c-4040-b7fb-48b25bc2fcb3"));
console.log("ADDRESSES:", rows.length);
rows.forEach(r => console.log(` - ${r.label}: ${r.fullName}, ${r.line1}, ${r.city} ${r.state} ${r.postalCode} default=${r.isDefault}`));
const u = await db.select().from(userProfiles).where(eq(userProfiles.id, "6c96dee2-847c-4040-b7fb-48b25bc2fcb3"));
console.log("USER:", u[0]?.email, "| name:", u[0]?.name, "| role:", u[0]?.role);
process.exit(0);
