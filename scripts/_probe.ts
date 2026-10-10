import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import { db } from "../server/_core/db";
import { orders } from "../drizzle/schema";
const rows = await db.select({ n: orders.orderNumber, s: orders.status, p: orders.paymentStatus, id: orders.id }).from(orders).orderBy(desc(orders.createdAt)).limit(4);
console.log(JSON.stringify(rows, null, 2));
process.exit(0);
