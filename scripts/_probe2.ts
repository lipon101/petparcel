import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../server/_core/db";
import { orders } from "../drizzle/schema";
import { updateOrderPayment } from "../server/db";

const id = "bcbaee8a-89b3-4d8d-a7de-dfb4f7a90ae9";
const detail = await updateOrderPayment({ orderId: id, paymentStatus: "unpaid", paymentRef: null });
console.log("returned status:", detail?.order?.paymentStatus);
const [row] = await db.select({ p: orders.paymentStatus }).from(orders).where(eq(orders.id, id));
console.log("db status:", row?.p);
process.exit(0);
