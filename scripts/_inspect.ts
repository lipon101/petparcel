import { db } from "../server/_core/db";
import { sql } from "drizzle-orm";
async function main() {
  const t = await db.execute(sql`select table_name from information_schema.tables where table_schema='public' order by 1`);
  console.log("TABLES:", (t.rows as any[]).map(r=>r.table_name).join(", "));
  for (const tbl of ["products","product_variants","orders","order_items","reviews","store_settings","email_log","newsletter_subscribers","users","addresses"]) {
    try { const r = await db.execute(sql.raw(`select count(*)::int n from ${tbl}`)); console.log(tbl, (r.rows as any[])[0].n); }
    catch(e:any){ console.log(tbl, "ERR", e.message.slice(0,60)); }
  }
  const s = await db.execute(sql`select key, value from store_settings order by key`);
  console.log("SETTINGS:", (s.rows as any[]).map(r=>`${r.key}=${r.value}`).join(" | "));
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1)});
