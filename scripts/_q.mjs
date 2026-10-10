import { db } from "../server/_core/db.ts";
import { orders, orderItems, orderEvents } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
const [o] = await db.select().from(orders).where(eq(orders.orderNumber, "PP-9NL8QSMA"));
if (!o) { console.log("NOT FOUND"); process.exit(0); }
console.log("ORDER:", JSON.stringify({num:o.orderNumber,email:o.email,status:o.status,payment:o.paymentStatus,provider:o.paymentProvider,subtotal:o.subtotalCents,shipping:o.shippingCents,total:o.totalCents}));
const items = await db.select().from(orderItems).where(eq(orderItems.orderId,o.id));
console.log("ITEMS:", items.map(i=>`${i.nameSnapshot} x${i.qty} @${i.unitPriceCents}`).join(" | "));
const ev = await db.select().from(orderEvents).where(eq(orderEvents.orderId,o.id));
console.log("EVENTS:", ev.map(e=>`${e.type}:${e.message ?? ""}`).join(" ;; "));
process.exit(0);
