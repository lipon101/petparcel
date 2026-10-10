// Generates client/public/sitemap.xml from the live catalog.
//
//   pnpm sitemap
//
// Run it whenever products change (or as a Vercel build step) so the sitemap
// always reflects what is actually live and `active`.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { listSeoProducts } from "../server/db";
import { STORE_URL } from "../shared/store";

const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/shop", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.5" },
  { path: "/faq", changefreq: "monthly", priority: "0.6" },
  { path: "/shipping-returns", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function main() {
  const products = await listSeoProducts();

  const urls: string[] = STATIC_PAGES.map(
    (p) => `  <url>
    <loc>${esc(`${STORE_URL}${p.path}`)}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
  );

  for (const p of products) {
    const lastmod = p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : undefined;
    urls.push(`  <url>
    <loc>${esc(`${STORE_URL}/product/${p.slug}`)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;

  const out = resolve(process.cwd(), "client/public/sitemap.xml");
  writeFileSync(out, xml, "utf8");
  console.log(`Wrote ${urls.length} URLs to ${out}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
