import { db } from "../server/_core/db.ts";
import { products } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
const rows = await db.select().from(products).where(eq(products.slug, "trekmate-no-pull-dog-harness"));
console.log("ID:", rows[0]?.id, "| name:", rows[0]?.name, "| images:", JSON.stringify(rows[0]?.images));
process.exit(0);
