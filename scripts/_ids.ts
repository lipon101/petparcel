// Throwaway probe: prints real catalog/order identifiers used to screenshot the
// parameterised routes (`verify_webapp needs_concrete_path`). Not part of the app.
import "dotenv/config";
import { asc } from "drizzle-orm";
import { db } from "../server/_core/db";
import { orders, products } from "../drizzle/schema";

const p = await db
  .select({ id: products.id, slug: products.slug })
  .from(products)
  .orderBy(asc(products.slug))
  .limit(4);
const o = await db.select({ id: orders.id, num: orders.orderNumber }).from(orders).limit(4);

console.log(JSON.stringify({ products: p, orders: o }, null, 2));
process.exit(0);
