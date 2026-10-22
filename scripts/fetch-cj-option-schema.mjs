// Pull the REAL option dimension schema for every catalogue product from the
// live CJ API, and write it to a data file the store ships.
//
// WHAT IT COLLECTS, per product pid:
//   * the supplier's own dimension schema (productKey / productKeyEn)
//   * each variant's own option text (variantKey) and SKU
//
// It does NOT rewrite prices, stock, names or images - the sync is idempotent
// and only records what the supplier states.
//
// Run:  CJ_API_KEY=... node scripts/fetch-cj-option-schema.mjs
// Out:  shared/cj-option-schema-data.json
import fs from "node:fs";
import path from "node:path";
import { parseDimensionSchema } from "../shared/cj-option-schema.ts";

const KEY = process.env.CJ_API_KEY;
if (!KEY) {
  console.error("CJ_API_KEY is unset - refusing to run.");
  process.exit(1);
}
const BASE = "https://developers.cjdropshipping.com/api2.0/v1";
const REPORT = path.resolve("work/cj-sku-vid-report.json");
const OUT = path.resolve("work/cj-option-schema-data.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = JSON.parse(fs.readFileSync(REPORT, "utf8"));

const auth = async () => {
  const r = await fetch(BASE + "/authentication/getAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: KEY }),
  });
  const j = await r.json();
  if (j.code !== 200) throw new Error("auth failed: " + j.message);
  return j.data.accessToken;
};
let TOKEN = await auth();

async function get(pathname) {
  for (let a = 0; a < 6; a++) {
    const r = await fetch(BASE + pathname, { headers: { "CJ-Access-Token": TOKEN } });
    if (r.status === 429 || r.status >= 500) {
      await sleep(1200 * 2 ** a);
      continue;
    }
    const j = await r.json();
    if (j.code === 1600200 || j.code === 1600300) {
      TOKEN = await auth();
      continue;
    }
    return j;
  }
  return { code: -1, message: "exhausted retries" };
}

const products = {};
let ok = 0;
let failed = 0;

// Modest concurrency: CJ rate-limits, and a burst makes every request slower.
const CONCURRENCY = 3;
const queue = report.products.filter((p) => p.pid);
let cursor = 0;
let done = 0;

async function worker() {
  while (cursor < queue.length) {
    const p = queue[cursor++];
    const j = await get("/product/query?pid=" + encodeURIComponent(p.pid));
    await sleep(350);
    done++;
    if (j.code !== 200 || !j.data) {
      failed++;
      console.log(`[${done}/${queue.length}] FAIL ${p.slug} :: ${j.code} ${j.message ?? ""}`);
      continue;
    }
    const d = j.data;
    const dims = parseDimensionSchema(d.productKeyEn || d.productKey);
    products[p.slug] = {
      pid: String(p.pid),
      productKey: d.productKey ?? null,
      productKeyEn: d.productKeyEn ?? null,
      dimensions: dims.map((x) => ({ token: x.token, kind: x.kind, label: x.label })),
      variants: (d.variants ?? []).map((v) => ({
        vid: String(v.vid),
        variantKey: v.variantKey ?? null,
        variantSku: v.variantSku ?? null,
        variantNameEn: v.variantNameEn || null,
      })),
    };
    ok++;
    console.log(
      `[${done}/${queue.length}] ${p.slug} dims=${JSON.stringify(dims.map((x) => x.label))} variants=${products[p.slug].variants.length}`,
    );
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const out = {
  generatedAt: new Date().toISOString(),
  source: "cjdropshipping.com /product/query",
  products,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`\nDONE. ok=${ok} failed=${failed} -> ${path.relative(process.cwd(), OUT)}`);
