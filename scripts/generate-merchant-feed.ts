// Generates server/_core/merchant-feed-data.ts from the live catalog.
//
//   pnpm merchant:feed
//
// Run it whenever products change (or as a Vercel build step) so the Merchant
// Center feed always reflects what is actually live, active and in stock.
//
// WHY IT WRITES A TS MODULE, NOT client/public/google-merchant-feed.xml. The
// feed is served per request from the request HOST (server/_core/merchant-feed.ts),
// so a static file cannot work: on Vercel the filesystem is checked before
// rewrites, so a static file would be served for every host and would shadow the
// host-aware route - the same reason the static sitemap.xml and robots.txt were
// removed. The item list therefore ships as the generated, type-checked module
// `server/_core/merchant-feed-data.ts`, which the server imports and the esbuild
// bundle inlines.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { listProducts } from "../server/db";
import { buildMerchantFeedItems, type MerchantFeedItem } from "../shared/merchant-feed";

/** A JSON string literal, safe to embed in a TS module. */
const js = (s: string) => JSON.stringify(s);

/** One data-module entry literal, in a stable key order. */
function entry(i: MerchantFeedItem): string {
  const parts = [
    `id: ${js(i.id)}`,
    `title: ${js(i.title)}`,
    `description: ${js(i.description)}`,
    `link: ${js(i.link)}`,
    `imageLink: ${js(i.imageLink)}`,
    `additionalImageLinks: [${i.additionalImageLinks.map(js).join(", ")}]`,
    `priceCents: ${i.priceCents}`,
    `salePriceCents: ${i.salePriceCents === null ? "null" : i.salePriceCents}`,
    `availability: ${js(i.availability)}`,
    `condition: "new"`,
    `brand: ${js(i.brand)}`,
    `identifierExists: ${i.identifierExists}`,
    `productType: ${js(i.productType)}`,
    `itemGroupId: ${i.itemGroupId === null ? "null" : js(i.itemGroupId)}`,
    `returnPolicyLabel: ${js(i.returnPolicyLabel)}`,
  ];
  return `  { ${parts.join(", ")} },`;
}

/** Re-render the module, verbatim, from the committed generated data. */
function renderFeedModule(items: MerchantFeedItem[]): string {
  return `// GENERATED - do not hand-edit. Re-run \`pnpm merchant:feed\` to refresh.
//
// WHY THIS IS A MODULE AND NOT client/public/google-merchant-feed.xml. The feed
// is served per request from the request HOST (see server/_core/merchant-feed.ts),
// exactly the way robots.txt and sitemap.xml are: the production storefront
// advertises its real items, and a \`*.vercel.app\` preview - or a local run -
// advertises an EMPTY feed, so a preview deployment can never hand Google the
// live store's prices, stock or SKUs. A static file is one file for every
// hostname a Vercel project serves, and on Vercel the filesystem is checked
// before rewrites, so a static feed would be served for every host and shadow
// the host-aware route entirely. The item list therefore ships as this bundled
// module, which server/_core/merchant-feed.ts imports and the esbuild server
// bundle inlines.
//
// Source: the live catalog (active, unarchived products and their sellable
// variants), mapped by shared/merchant-feed.ts. Regenerate with
// \`pnpm merchant:feed\`, which runs as a build step so the list stays fresh. On a
// catalog failure the committed module is left UNTOUCHED rather than replaced by
// an item-less file - the same "a stale feed beats an empty one" rule the
// sitemap generator keeps, because an empty feed would de-list the whole store.
import type { MerchantFeedItem } from "@shared/merchant-feed";

export const MERCHANT_FEED_ITEMS: MerchantFeedItem[] = [
${items.map(entry).join("\n")}
];
`;
}

async function main() {
  // The feed needs the live catalog, which means a database round trip.
  //
  // This runs inside \`pnpm build\`, so how it behaves when the database is
  // unreachable is a DEPLOYMENT decision, not a detail. Failing the build would
  // let a transient database hiccup block shipping the storefront entirely; and
  // writing an item-less module would REPLACE a good committed feed with one that
  // silently de-lists every product - far worse for the store than a stale feed.
  //
  // So: on failure, keep the committed module exactly as it is, say so loudly,
  // and let the deploy continue. A stale feed is recoverable on the next deploy;
  // a failed one is a store nobody can buy from.
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  try {
    products = await listProducts({ includeInactive: false, includeArchived: false });
  } catch (err) {
    console.warn(
      `[merchant-feed] SKIPPED - catalog unavailable (${
        err instanceof Error ? err.message : String(err)
      }).`,
    );
    console.warn(
      "[merchant-feed] The committed server/_core/merchant-feed-data.ts is left UNTOUCHED so it " +
        "keeps serving. Set DATABASE_URL (or re-run `pnpm merchant:feed` with the " +
        "database reachable) to refresh the feed.",
    );
    return;
  }

  const items = buildMerchantFeedItems(products);
  const out = resolve(process.cwd(), "server/_core/merchant-feed-data.ts");
  writeFileSync(out, renderFeedModule(items), "utf8");
  console.log(
    `Wrote ${items.length} feed items to ${out} (from ${products.length} products)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
