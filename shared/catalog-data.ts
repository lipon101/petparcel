// Shared catalog data - the single source of truth for the store's product
// catalogue, used by the SEEDER (`pnpm seed`, server/seed.ts) to write the real
// products into the database. It is deliberately dependency-free (no
// node:crypto, no drizzle, no env) so it can be imported from a browser bundle
// AND from the server. `stableUuid` is a pure-JS hash, so both sides derive the
// SAME id for the same product.
//
// It is NOT a runtime fallback: the storefront reads products from the database
// only. There is no code path that serves this data to a shopper when the
// database is unreachable - a broken deployment shows an honest error instead of
// fabricated products.
//
// THE REAL CATALOGUE. This file carries the store's 98 real, in-stock products -
// the whole list the shop can actually ship. Every placeholder product that used
// to live here has been removed, so the storefront, the category tree, the
// sitemap and the Merchant Center feed all describe exactly what the shop can
// actually ship.
//
// NO REVIEWS LIVE HERE. The catalog carries products and variants only. Reviews
// are earned: a customer who has received an order writes one, it starts
// pending, and an admin approves it before it is ever shown. Seeding invented
// reviews would put fake ratings on real product pages, so `reviews` is empty
// for the product and the storefront shows a clean "no reviews yet" state until
// genuine approved reviews arrive.

import { PRODUCT_SPECS, type ProductSpecs } from "./product-specs";

// PRODUCT MEDIA HOSTING.
//
// Every `images` array below holds ABSOLUTE supplier URLs - the supplier's
// own product photography for exactly that product, on its own CDN. The repo
// therefore carries no product image bytes at all, which is what lets
// `client/public/images/products` be deleted without breaking a single page.
//
// An earlier revision pointed these at this repository's GitHub Release assets.
// Those 22 products' galleries have since been re-sourced from CJ and their
// stored URLs rewritten (and, for a database seeded before that, by
// drizzle/migrations/0024_hosted_product_images_repair.sql). The storefront
// still supports self-hosting: an admin who sets VITE_MEDIA_BASE_URL serves the
// same `products/<file>` keys from object storage - see shared/product-media.ts,
// which resolves that base AND adds the supplier CDN's on-the-fly
// resize/re-encode to every catalogue image.

/** When this catalog file last changed, as an ISO date.
 *
 *  Carried onto every product the bundled catalog builds so a page that renders
 *  from the bundle before the API answers still shows honest dates. Without it
 *  the bundle reported a fixed epoch and a product added long ago looked brand
 *  new. It is kept EQUAL to the date the products table was first seeded, so the
 *  first paint from the bundle and the API answer that replaces it agree - a
 *  mismatch here flashes a NEW badge on a product that is not new. Bump this
 *  only when the catalog is genuinely re-seeded. */
export const CATALOG_SEEDED_AT = "2026-06-01T00:00:00.000Z";

export type SeedVariant = {
  name: string;
  sku: string;
  priceCents: number;
  inventoryQty: number;
  /** The supplier VARIANT ID (VID) for this exact option, recovered from
   *  the real CJ listing's own productDetailData (stanProducts[].id). CJ's
   *  createOrderV2 needs a `vid` per line to fulfil the right option, so this is
   *  what lets a paid order be pushed to CJ automatically. Optional: a variant
   *  with no VID is simply not forwardable, and the order-forwarding service
   *  refuses to push an order containing it rather than guessing. */
  cjVid?: string;
};
export type SeedReview = { authorName: string; rating: number; title: string; body: string };
export type SeedProduct = {
  name: string; slug: string; category: string; description: string;
  priceCents: number; compareAtCents?: number; images: string[]; tags: string[];
  featured: boolean; sortOrder: number; variants: SeedVariant[]; reviews: SeedReview[];
  /** Real attributes for the Product Details tab (materials, size, weight,
   *  care), keyed by slug in shared/product-specs.ts and attached below. */
  specs: ProductSpecs;
  /** Bumped with the catalog so bundle-rendered pages show an honest date
   *  instead of a fixed epoch. Optional: absent means "unknown", not "today". */
  seededAt?: string;
};

/** A stable, valid-UUID-shaped id derived from a seed string. Pure JS (FNV-1a
 *  over four salted passes) so it runs identically in Node and the browser. */
export function stableUuid(seed: string): string {
  const parts: string[] = [];
  for (let k = 0; k < 4; k += 1) {
    let h = (0x811c9dc5 ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0;
    const s = `${k}:${seed}`;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    parts.push(h.toString(16).padStart(8, "0"));
  }
  const hex = parts.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// The specs live in their own module and are attached below, so this file stays
// a readable list of products instead of a wall of attribute strings.
const BASE_CATALOG: Omit<SeedProduct, "specs">[] = [
  // ── Pet Furnitures: Pet Furniture Tools ─────────────────────────────────────
  { name: "Intelligent Litter Box Fully Enclosed Anti-splash Automatic Cleaning Deodorant",
    slug: "intelligent-litter-box-automatic-self-cleaning-deodorant", category: "Pet Furniture Tools",
    description: "Intelligent Litter Box Fully Enclosed Anti-splash Automatic Cleaning Deodorant is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from plastic, and it weighs around 8500.00 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 21900, compareAtCents: 28900, images: ["https://media.petparcel.store/products/8ff500cc46a333ba8780.webp", "https://media.petparcel.store/products/3d3e619e9d3704a8b7d1.webp", "https://media.petparcel.store/products/54ad336954cabab31d38.webp", "https://media.petparcel.store/products/c98c5612a81d2365c835.webp", "https://media.petparcel.store/products/61ab1d788eeaba07caf5.webp"], tags: ["Self-cleaning", "Odour-locked", "Anti-splash", "Quiet cycle"], featured: true, sortOrder: 1,
    // ONE variant. The CJ listing carries a single buyable line (SKU
    // CJYD234462301AZ, whole-price $79.43) whose colour is White; the supplier's
    // own spec code for that line is "V1 Litter Box UK", which is an internal
    // code, not something a shopper should ever read. The variant is therefore
    // named by its real, customer-facing colour - "White" - and the supplier's
    // SKU is kept verbatim. The storefront states the single configuration
    // instead of drawing a one-chip chooser.
    variants: [
      { name: "White", sku: "CJYD234462301AZ", cjVid: "2504030718511602500", priceCents: 21900, inventoryQty: 38 },
    ],
    reviews: [] },

  // ── Pet Furnitures: Pet Tents ─────────────────────────────────────────────
  // The supplier dome tent bed, filed under the taxonomy's own "Pet
  // Tents" subcategory (Pet Furnitures > Pet Tents) - the supplier's own
  // category for this product, so no new shelf was invented for it.
  //
  // Every variant below is a REAL supplier line: the six size/colour
  // combinations (S/M/L × Military Green / Green Grey) carry the supplier's
  // exact SKUs and its own per-size costs ($4.13 / $4.92 / $6.46). Six further
  // supplier lines - the six "set" bundles (…7GT–…9IR "Green grey set" and …10JQ–…12LO "Military Green set", S/M/L each) - are
  // deliberately NOT offered: nothing in the listing says what the "set" adds,
  // and selling an option we cannot describe would be worse than not selling it.
  { name: "Foldable Pet Tent Bed with Cooling Mat and Cushion",
    slug: "foldable-pet-tent-bed-with-cooling-mat", category: "Pet Tents",
    description: "High-quality comfort for your pets, keeps your pet cozy and warm.\n\nBuilt to last: made from cloth, and it weighs around 464.00 g.\n\nChoose the option that suits your pet - S Military Green, M Military Green, L Military Green, S Green Grey, M Green Grey, L Green Grey.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- It spends cool even in summer.\n- Machine wash the inner cushion and outer microfiber fabric in cold water only.\n- This comfortable bed is lightweight and portable, suitable for travel.\n- This pet keeps your pet comfortable while camping and traveling in the wild.",
    priceCents: 3400, compareAtCents: 4900, images: ["https://media.petparcel.store/products/c9dc28fe713eca204cbf.webp", "https://media.petparcel.store/products/826405bdc17a4272ce05.webp", "https://media.petparcel.store/products/5d9985410fd80bdf8a88.webp", "https://media.petparcel.store/products/dcffa8fd748fc35286c3.webp", "https://media.petparcel.store/products/120e55599edd4ede7716.webp"], tags: ["Foldable", "Reversible cooling mat", "Machine washable", "Travel ready"], featured: true, sortOrder: 2,
    // One price across the three sizes. The supplier's own costs do step up with
    // size (+$0.79 to M, +$2.33 to L), but at this price point the difference is
    // under 7% of the retail price and does not justify three prices on a bed a
    // shopper picks by pet weight rather than by budget.
    variants: [
      { name: "S · Military Green", sku: "CJMY172457401AZ", cjVid: "1643077881620336640", priceCents: 3400, inventoryQty: 26 },
      { name: "M · Military Green", sku: "CJMY172457402BY", cjVid: "1643077881779720192", priceCents: 3400, inventoryQty: 26 },
      { name: "L · Military Green", sku: "CJMY172457403CX", cjVid: "1643077881871994880", priceCents: 3400, inventoryQty: 26 },
      { name: "S · Green Grey", sku: "CJMY172457404DW", cjVid: "1643077882060738560", priceCents: 3400, inventoryQty: 26 },
      { name: "M · Green Grey", sku: "CJMY172457405EV", cjVid: "1643077882119458816", priceCents: 3400, inventoryQty: 26 },
      { name: "L · Green Grey", sku: "CJMY172457406FU", cjVid: "1643077882182373376", priceCents: 3400, inventoryQty: 26 },
    ],
    reviews: [] },

  // ── Pet Outdoor Supplies: Pet Bags ─────────────────────────────────────────
  // The supplier double-shoulder dog carrier backpack, filed under the
  // taxonomy's own "Pet Bags" subcategory (Pet Outdoor Supplies > Pet Bags) -
  // the supplier's own category for this product, so no new shelf was invented
  // for it.
  //
  // Every variant below is a REAL supplier line: all twenty-one buyable
  // colour/size combinations the CJ listing carries, with the supplier's own
  // SKUs (CJJJCWGY02426-<Colour>-<Size>) and its own per-variant packed weight.
  // The supplier lists six colours across four sizes but does not stock every
  // combination - it carries no Orange in S or M, and no Dark grey in S - so
  // those three rows are absent here rather than invented, and the storefront
  // greys the unavailable pairs out.
  //
  // PRICED BY SIZE, NOT BY COLOUR. The supplier's cost tracks the packed weight
  // and sits inside a tight band per size - S $9.62-9.67, M $10.00-10.75,
  // L $10.28-10.64, XL $10.61-12.04 - so the four sizes carry the four price
  // steps and each colourway costs the same as its siblings. One row per size
  // keeps the price honest at the top of the band instead of inventing a
  // colour premium the supplier does not charge.
  { name: "Pet Dog Carrier Bag - Double Shoulder Portable Travel Backpack",
    slug: "pet-dog-carrier-bag-double-shoulder-travel-backpack", category: "Pet Bags",
    description: "Multiple size options for all fits.\n\nBuilt to last: made from cloth, and it weighs around 440.00 g.\n\nChoose the option that suits your pet - S Black, M Black, L Black, XL Black, S Red, M Red, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 4900, compareAtCents: 8900, images: ["https://media.petparcel.store/products/a48caa9ed25bfdd59233.webp", "https://media.petparcel.store/products/cd313f3d5b56c7a90fcd.webp", "https://media.petparcel.store/products/fd51c6d4a2b1d6186e69.webp", "https://media.petparcel.store/products/c3c8b9dd72cc0dccc63c.webp", "https://media.petparcel.store/products/49b04c98a0465c7632e1.webp"], tags: ["Hands-free", "Breathable mesh", "Double shoulder", "Folds flat", "Padded straps"], featured: true, sortOrder: 3,
    variants: [
      { name: "S · Black", sku: "CJJJCWGY02426-Black-S", cjVid: "5C02D4A4-2501-46C8-AA21-3FEC24EDDFCE", priceCents: 4900, inventoryQty: 42 },
      { name: "M · Black", sku: "CJJJCWGY02426-Black-M", cjVid: "1ED2C552-5674-4605-BC25-9535A344E114", priceCents: 5900, inventoryQty: 42 },
      { name: "L · Black", sku: "CJJJCWGY02426-Black-L", cjVid: "6B015962-C3C4-472B-83D8-B9521F18DACF", priceCents: 6900, inventoryQty: 42 },
      { name: "XL · Black", sku: "CJJJCWGY02426-Black-XL", cjVid: "80291B38-C353-4660-8D9A-76C122F0BAC2", priceCents: 7900, inventoryQty: 42 },
      { name: "S · Red", sku: "CJJJCWGY02426-Red-S", cjVid: "9407D5CF-2C29-42DF-83C9-C1CB5C0C47C2", priceCents: 4900, inventoryQty: 42 },
      { name: "M · Red", sku: "CJJJCWGY02426-Red-M", cjVid: "1A252A48-E558-4131-A4E9-AFE980A9973F", priceCents: 5900, inventoryQty: 42 },
      { name: "L · Red", sku: "CJJJCWGY02426-Red-L", cjVid: "A71172B8-3DD8-4079-AFBA-41BC4471EAA9", priceCents: 6900, inventoryQty: 42 },
      { name: "XL · Red", sku: "CJJJCWGY02426-Red-XL", cjVid: "E68AD4AE-8CC0-41F0-8164-4A91705AFDAB", priceCents: 7900, inventoryQty: 42 },
      { name: "S · Blue", sku: "CJJJCWGY02426-Blue-S", cjVid: "64D5831C-DD6B-484F-A442-AC155435E098", priceCents: 4900, inventoryQty: 42 },
      { name: "M · Blue", sku: "CJJJCWGY02426-Blue-M", cjVid: "6D811D61-B2D4-47FA-91D4-945BD7A98250", priceCents: 5900, inventoryQty: 42 },
      { name: "L · Blue", sku: "CJJJCWGY02426-Blue-L", cjVid: "4AEA9285-795B-489A-89CF-52143651E1D7", priceCents: 6900, inventoryQty: 42 },
      { name: "XL · Blue", sku: "CJJJCWGY02426-Blue-XL", cjVid: "B7D44B6A-7799-40D7-81BB-F9D0471A2A3B", priceCents: 7900, inventoryQty: 42 },
      { name: "S · Grey", sku: "CJJJCWGY02426-Grey-S", cjVid: "B20ABB11-A05B-40A7-8EF4-D033256CA095", priceCents: 4900, inventoryQty: 42 },
      { name: "M · Grey", sku: "CJJJCWGY02426-Grey-M", cjVid: "49123A89-8386-4209-ACD7-278B1DCBBDF2", priceCents: 5900, inventoryQty: 42 },
      { name: "L · Grey", sku: "CJJJCWGY02426-Grey-L", cjVid: "76499A08-309A-4181-B8C0-39C1AD61C496", priceCents: 6900, inventoryQty: 42 },
      { name: "XL · Grey", sku: "CJJJCWGY02426-Grey-XL", cjVid: "2BFC744D-1C48-42C7-BC5B-B28E79EF5822", priceCents: 7900, inventoryQty: 42 },
      { name: "M · Dark grey", sku: "CJJJCWGY02426-Dark grey-M", cjVid: "1605437143483166720", priceCents: 5900, inventoryQty: 42 },
      { name: "L · Dark grey", sku: "CJJJCWGY02426-Dark grey-L", cjVid: "2505271619051604000", priceCents: 6900, inventoryQty: 42 },
      { name: "XL · Dark grey", sku: "CJJJCWGY02426-Dark grey-XL", cjVid: "1620319187908440064", priceCents: 7900, inventoryQty: 42 },
      { name: "L · Orange", sku: "CJJJCWGY02426-Orange-L", cjVid: "1651773089350426624", priceCents: 6900, inventoryQty: 42 },
      { name: "XL · Orange", sku: "CJJJCWGY02426-Orange-XL", cjVid: "2503260804221611700", priceCents: 7900, inventoryQty: 42 },
    ],
    reviews: [] },
  // ===== // -- REAL SUPPLIER CATALOG (added on 2026-10-12T00:00:00.000Z) =====
  // -- Pet Outdoor Supplies > Barking Control Equipments --
  // Real supplier product, SKU CJYD2026270 (CJ id 1786012676196409344). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Smart Automatic Anti Barking Dog Collar Rechargeable Bark Stopper Stop Barking HD Digital Display IP67 Waterproof Collar For Dogs Pet Products",
    slug: "smart-anti-barking-dog-collar-rechargeable", category: "Barking Control Equipments",
    description: "Smart Automatic Anti Barking Dog Collar Rechargeable Bark Stopper Stop Barking HD Digital Display IP67 Waterproof Collar For Dogs Pet Products is a practical, hard-wearing pick built for calmer, quieter training - one your pet will reach for every day.\n\nBuilt to last: made from plastic, and it weighs around 131.00 g.\n\nChoose the option that suits your pet - Black, White.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 2549, images: ["https://media.petparcel.store/products/263e777261e1bcf29981.webp", "https://media.petparcel.store/products/20c8a1cf33e7f8f98112.webp", "https://media.petparcel.store/products/5afa695b426441120a93.webp", "https://media.petparcel.store/products/c3418a00dd13d024bdf7.webp"], tags: ["Barking Control Equipments", "Tracked shipping"], featured: false, sortOrder: 100,
    variants: [
      { name: "Black", sku: "CJYD202627001AZ", cjVid: "1786012676284489728", priceCents: 2549, inventoryQty: 25 },
      { name: "White", sku: "CJYD202627002BY", cjVid: "1786012676347404288", priceCents: 2549, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Furnitures > Pet Hammocks --
  // Real supplier product, SKU CJMY1112786 (CJ id 1389761927684689920). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Four Seasons Universal Cat  Recliner Cat Bed",
    slug: "four-seasons-universal-cat-recliner-bed", category: "Pet Hammocks",
    description: "Whether the source of patented goods: No.\n\nBuilt to last: made from metal, and it weighs around 1544.00 g.\n\nChoose the option that suits your pet - Grey 45 x 45 x 35, Pink 45 x 45 x 35, Sandwich cloth pink 45 x 45 x 35.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 3349, compareAtCents: 6499, images: ["https://media.petparcel.store/products/a53b0fd786d55ca3308f.webp", "https://media.petparcel.store/products/f85f08565c85febdd2d1.webp", "https://media.petparcel.store/products/1fbdac284d54a35b6e22.webp", "https://media.petparcel.store/products/827730564bc2e56b8b45.webp"], tags: ["Pet Hammocks", "Tracked shipping"], featured: false, sortOrder: 101,
    variants: [
      { name: "Grey · 45 x 45 x 35", sku: "CJMY111278601AZ", cjVid: "1389761929018478592", priceCents: 3349, inventoryQty: 25 },
      { name: "Pink · 45 x 45 x 35", sku: "CJMY111278602BY", cjVid: "1389761929026867200", priceCents: 3349, inventoryQty: 25 },
      { name: "Sandwich cloth pink · 45 x 45 x 35", sku: "CJMY111278603CX", cjVid: "1479370255355744256", priceCents: 3349, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Drinking & Feeding > Pet Drinking Tools --
  // Real supplier product, SKU CJMY1746053 (CJ id 1651788214971146240). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Pet Cat Dog Stainless Steel Automatic Circulation Water Dispenser Intelligent Fountain Pets Accessories",
    slug: "stainless-steel-automatic-circulating-water-fountain", category: "Pet Drinking Tools",
    description: "Pet Cat Dog Stainless Steel Automatic Circulation Water Dispenser Intelligent Fountain Pets Accessories is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from metal, and it weighs around 75.00 g.\n\nChoose the option that suits your pet - Basic pump 220V US, Basic pump US, Basic pump EU, Basic pump UK, Basic pump AU, Induction pump 220V US, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 3649, images: ["https://media.petparcel.store/products/4b144104a9de69914ab4.webp", "https://media.petparcel.store/products/c08c923673ae14e0db62.webp", "https://media.petparcel.store/products/546edc898c9c0d0283e1.webp", "https://media.petparcel.store/products/174a6d29741b011078f9.webp"], tags: ["Pet Drinking Tools", "Tracked shipping"], featured: false, sortOrder: 102,
    variants: [
      { name: "Basic pump · 220V US", sku: "CJMY174605301AZ", cjVid: "1651788215046643712", priceCents: 3649, inventoryQty: 25 },
      { name: "Basic pump · US", sku: "CJMY174605302BY", cjVid: "1651788215109558272", priceCents: 3649, inventoryQty: 25 },
      { name: "Basic pump · EU", sku: "CJMY174605303CX", cjVid: "1651788215172472832", priceCents: 3649, inventoryQty: 25 },
      { name: "Basic pump · UK", sku: "CJMY174605304DW", cjVid: "1651788215235387392", priceCents: 3649, inventoryQty: 25 },
      { name: "Basic pump · AU", sku: "CJMY174605305EV", cjVid: "1651788215294107648", priceCents: 3649, inventoryQty: 25 },
      { name: "Induction pump · 220V US", sku: "CJMY174605306FU", cjVid: "1651788215357022208", priceCents: 3649, inventoryQty: 25 },
      { name: "Induction pump · US", sku: "CJMY174605307GT", cjVid: "1651788215411548160", priceCents: 3649, inventoryQty: 25 },
      { name: "Induction pump · EU", sku: "CJMY174605308HS", cjVid: "1651788215470268416", priceCents: 3649, inventoryQty: 25 },
      { name: "Induction pump · UK", sku: "CJMY174605309IR", cjVid: "1651788215528988672", priceCents: 3649, inventoryQty: 25 },
      { name: "Induction pump · AU", sku: "CJMY174605310JQ", cjVid: "1651788215591903232", priceCents: 3649, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Drinking & Feeding > Pet Bowls --
  // Real supplier product, SKU CJGY1025454 (CJ id 1366573785234411520). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "1.5L Cat Dog Water Bowl Carried Floating Bowl Anti-Overflow Slow Water Feeder Dispenser Pet Fountain ABS&PP Dog Supplies",
    slug: "floating-pet-water-bowl-1-5l", category: "Pet Bowls",
    description: "Waterproof and easy to clean: The dual design of a waterproof frame and floating plate effectively prevents overflow.\n\nBuilt to last: made from plastic, and it weighs around 400.00 g.\n\nChoose the option that suits your pet - Pink, Blue, Grey, White, Pink 2L, White 2L, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Pet drinking fountains keep the floor clean and tidy.\n- The pet water basin is easy to disassemble and assemble, suitable for weekly cleaning, and absolutely clean, to ensure the health of the pet.\n- Slow water intake: The design of the automatic adjustment floating plate can reduce the pet's drinking water speed.\n- Floating cat water basins can prevent pets from suffocating and vomiting.",
    priceCents: 1249, images: ["https://media.petparcel.store/products/dafb16577b82aa4ea14d.webp", "https://media.petparcel.store/products/ee6ed1a5142db31c871e.webp", "https://media.petparcel.store/products/6bb8e3e57a82fb58e95d.webp", "https://media.petparcel.store/products/5d099a8e6316f9fa0aa4.webp"], tags: ["Pet Bowls", "Tracked shipping"], featured: false, sortOrder: 103,
    variants: [
      { name: "Pink", sku: "CJGY102545401AZ", cjVid: "1366573786647891968", priceCents: 1249, inventoryQty: 25 },
      { name: "Blue", sku: "CJGY102545402BY", cjVid: "1366573786715000832", priceCents: 1249, inventoryQty: 25 },
      { name: "Grey", sku: "CJGY102545403CX", cjVid: "1366573786782109696", priceCents: 1249, inventoryQty: 25 },
      { name: "White", sku: "CJGY102545404DW", cjVid: "1366573786849218560", priceCents: 1249, inventoryQty: 25 },
      { name: "Pink 2L", sku: "CJGY102545423WD", cjVid: "1708795443548786688", priceCents: 1249, inventoryQty: 25 },
      { name: "White 2L", sku: "CJGY102545424XC", cjVid: "1708795443611701248", priceCents: 1249, inventoryQty: 25 },
      { name: "Grey 2L", sku: "CJGY102545425YB", cjVid: "1708795443674615808", priceCents: 1249, inventoryQty: 25 },
      { name: "Blue 2L", sku: "CJGY102545426ZA", cjVid: "1708795443737530368", priceCents: 1249, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Collars, Harnesses & Accessories > Pet Collars --
  // Real supplier product, SKU CJGX1597441 (CJ id 1585221163377242112). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Reflective Collar Waterproof Holder Case For Airtag Air Tag Airtags Protective Cover Cat Dog Kitten Puppy Nylon Collar",
    slug: "reflective-airtag-collar-holder", category: "Pet Collars",
    description: "Gifts: advertising gifts, promotional gifts, welfare gifts, public relations gifts.\n\nBuilt to last: made from cloth, and it weighs around 12.00 g.\n\nChoose the option that suits your pet - Red, Yellow, Purple, Black, Pink, Orange, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Suitable season: Four Seasons Universal.",
    priceCents: 699, images: ["https://media.petparcel.store/products/52f5857dc8bbe5c5ef4f.webp", "https://media.petparcel.store/products/0af49e97489ef683e028.webp", "https://media.petparcel.store/products/5ef4d00d95803e18582e.webp", "https://media.petparcel.store/products/c2d6641ad62235e97625.webp"], tags: ["Pet Collars", "Tracked shipping"], featured: false, sortOrder: 104,
    variants: [
      { name: "Red", sku: "CJGX159744101AZ", cjVid: "1585221163461128192", priceCents: 699, inventoryQty: 25 },
      { name: "Yellow", sku: "CJGX159744102BY", cjVid: "1585221163465322496", priceCents: 699, inventoryQty: 25 },
      { name: "Purple", sku: "CJGX159744103CX", cjVid: "1585221163465322497", priceCents: 699, inventoryQty: 25 },
      { name: "Black", sku: "CJGX159744104DW", cjVid: "1585221163469516800", priceCents: 699, inventoryQty: 25 },
      { name: "Pink", sku: "CJGX159744105EV", cjVid: "1585221163469516801", priceCents: 699, inventoryQty: 25 },
      { name: "Orange", sku: "CJGX159744106FU", cjVid: "1585221163473711104", priceCents: 699, inventoryQty: 25 },
      { name: "Sky Blue", sku: "CJGX159744107GT", cjVid: "1585221163473711105", priceCents: 699, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Collars, Harnesses & Accessories > Pet Leashes --
  // Real supplier product, SKU CJGX1221930 (CJ id 1417723948015161344). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Dog Leash Retractable Leash And Dog Collar Spotlight Automatic Pet Dog Cat Traction Rope For Small Medium Dogs Pet Product",
    slug: "retractable-dog-leash-with-collar", category: "Pet Leashes",
    description: "Give your dog good reach and freedom of movement.\n\nBuilt to last: made from plastic, and it weighs around 282.00 g.\n\nChoose the option that suits your pet - Purple 3M Retractable lead, Purple 3M Lead and collar, Orange 3M Retractable lead, Orange 3M Lead and collar, Green 3M Retractable lead, Green 3M Lead and collar, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- This belt is suitable for Small medium / large Pets.\n- One-handed braking and locking system keeps pets from moving forward.\n- Telescopic design, the belt can automatically stretch and pull out.\n- The large handles are easy to grip.",
    priceCents: 599, images: ["https://media.petparcel.store/products/b3e6a1e01ad44e1f82d1.webp", "https://media.petparcel.store/products/8f000445783cb0aad313.webp", "https://media.petparcel.store/products/b850b5afca9ecdf1e950.webp", "https://media.petparcel.store/products/269eb1e08dc6c5218605.webp"], tags: ["Pet Leashes", "Tracked shipping"], featured: false, sortOrder: 105,
    variants: [
      { name: "Purple 3M · Retractable lead", sku: "CJGX122193001AZ", cjVid: "1417723949395087360", priceCents: 599, inventoryQty: 25 },
      { name: "Purple 3M · Lead and collar", sku: "CJGX122193002BY", cjVid: "1417723949407670272", priceCents: 599, inventoryQty: 25 },
      { name: "Orange 3M · Retractable lead", sku: "CJGX122193005EV", cjVid: "1417723949441224704", priceCents: 599, inventoryQty: 25 },
      { name: "Orange 3M · Lead and collar", sku: "CJGX122193006FU", cjVid: "1417723949470584832", priceCents: 599, inventoryQty: 25 },
      { name: "Green 3M · Retractable lead", sku: "CJGX122193009IR", cjVid: "1417723949504139264", priceCents: 599, inventoryQty: 25 },
      { name: "Green 3M · Lead and collar", sku: "CJGX122193010JQ", cjVid: "1417723949516722176", priceCents: 599, inventoryQty: 25 },
      { name: "Purple 5M · Retractable lead", sku: "CJGX122193013MN", cjVid: "1417723949575442432", priceCents: 599, inventoryQty: 25 },
      { name: "Purple 5M · Lead and collar", sku: "CJGX122193014NM", cjVid: "1417723949588025344", priceCents: 599, inventoryQty: 25 },
      { name: "Orange 5M · Retractable lead", sku: "CJGX122193017QJ", cjVid: "1417723949642551296", priceCents: 599, inventoryQty: 25 },
      { name: "Orange 5M · Lead and collar", sku: "CJGX122193018RI", cjVid: "1417723949650939904", priceCents: 599, inventoryQty: 25 },
      { name: "Green 5M · Retractable lead", sku: "CJGX122193021UF", cjVid: "1417723949684494336", priceCents: 599, inventoryQty: 25 },
      { name: "Green 5M · Lead and collar", sku: "CJGX122193022VE", cjVid: "1417723949692882944", priceCents: 599, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Collars, Harnesses & Accessories > Pet Harnesses --
  // Real supplier product, SKU CJJT1508437 (CJ id 1539929588468559872). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Summer Pet Dog Cooling Vest Heat Resistant Cool Dogs Clothes Breathable Sun-proof Clothing For Small Large Dogs Outdoor Walking",
    slug: "summer-dog-cooling-vest", category: "Pet Harnesses",
    description: "Stay Cool: The layered construction is designed to keep your dog cool when the temperature rises.\n\nBuilt to last: made from cloth, and it weighs around 130.00 g.\n\nChoose the option that suits your pet - Orange S, Orange M, Orange L, Orange XL, Orange 2XL, Orange 3XL, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The outer layer reflects heat and facilitates evaporation while the middle layer absorbs and stores water for evaporation.",
    priceCents: 1299, images: ["https://media.petparcel.store/products/7d293b5ac280ca856364.webp", "https://media.petparcel.store/products/2db5fdcc85c48afb6694.webp", "https://media.petparcel.store/products/16c5acd045ed8dbd569b.webp", "https://media.petparcel.store/products/209703971a8ca4c62552.webp"], tags: ["Pet Harnesses", "Tracked shipping"], featured: false, sortOrder: 106,
    variants: [
      { name: "Orange · S", sku: "CJJT150843701AZ", cjVid: "1539929588586000384", priceCents: 1299, inventoryQty: 25 },
      { name: "Orange · M", sku: "CJJT150843702BY", cjVid: "1539929588590194688", priceCents: 1299, inventoryQty: 25 },
      { name: "Orange · L", sku: "CJJT150843703CX", cjVid: "1539929588590194689", priceCents: 1299, inventoryQty: 25 },
      { name: "Orange · XL", sku: "CJJT150843704DW", cjVid: "1539929588594388992", priceCents: 1299, inventoryQty: 25 },
      { name: "Orange · 2XL", sku: "CJJT150843705EV", cjVid: "1539929588594388993", priceCents: 1299, inventoryQty: 25 },
      { name: "Orange · 3XL", sku: "CJJT150843706FU", cjVid: "1539929588594388994", priceCents: 1299, inventoryQty: 25 },
      { name: "Green · S", sku: "CJJT150843707GT", cjVid: "1539929588598583296", priceCents: 1299, inventoryQty: 25 },
      { name: "Green · M", sku: "CJJT150843708HS", cjVid: "1539929588598583297", priceCents: 1299, inventoryQty: 25 },
      { name: "Green · L", sku: "CJJT150843709IR", cjVid: "1539929588598583298", priceCents: 1299, inventoryQty: 25 },
      { name: "Green · XL", sku: "CJJT150843710JQ", cjVid: "1539929588602777600", priceCents: 1299, inventoryQty: 25 },
      { name: "Green · 2XL", sku: "CJJT150843711KP", cjVid: "1539929588602777601", priceCents: 1299, inventoryQty: 25 },
      { name: "Green · 3XL", sku: "CJJT150843712LO", cjVid: "1539929588602777602", priceCents: 1299, inventoryQty: 25 },
      { name: "Blue · S", sku: "CJJT150843713MN", cjVid: "1539929588606971904", priceCents: 1299, inventoryQty: 25 },
      { name: "Blue · M", sku: "CJJT150843714NM", cjVid: "1539929588606971905", priceCents: 1299, inventoryQty: 25 },
      { name: "Blue · L", sku: "CJJT150843715OL", cjVid: "1539929588606971906", priceCents: 1299, inventoryQty: 25 },
      { name: "Blue · XL", sku: "CJJT150843716PK", cjVid: "1539929588611166208", priceCents: 1299, inventoryQty: 25 },
      { name: "Blue · 2XL", sku: "CJJT150843717QJ", cjVid: "1539929588611166209", priceCents: 1299, inventoryQty: 25 },
      { name: "Blue · 3XL", sku: "CJJT150843718RI", cjVid: "1539929588611166210", priceCents: 1299, inventoryQty: 25 },
      { name: "Pink · S", sku: "CJJT150843719SH", cjVid: "1539929588615360512", priceCents: 1299, inventoryQty: 25 },
      { name: "Pink · M", sku: "CJJT150843720TG", cjVid: "1539929588615360513", priceCents: 1299, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Toys > Pet Toys --
  // Real supplier product, SKU CJMY2127082 (CJ id 2409030737241626200). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Interactive Cat Toy Ball Super Drive Cat Rolling Ball",
    slug: "interactive-cat-toy-ball-super-drive", category: "Pet Toys",
    description: "Auto shut off-Works 5 minutes and goes into sleep mode if cats aren't playing with it and wakes up once (after 2h) in a while to see if they are now interested.\n\nBuilt to last: made from plastic, and it weighs around 57.00 g.\n\nChoose the option that suits your pet - Magic Tail Style Red, Magic Tail Style Green, Magic Tail Gray, With Rope Style Red, With Rope Style Green, With Rope Style Gray, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Wake-up features-pets could make toys activate by paw's touch, and motion cat toys will help interact with cats when you are out.\n- Working modes-Fast speed or slow speed, interactive mode will only react when the pet pats it.\n- Definitely recommend it for outgoing cats. (Blue lights-fast mode, purple lighs-slow mode, yellow lights-interactive mode).\n- Chirping cat toys-realistic bird song could attract cats interested in this game, voice could be turned off by quickly pressing a button twice.",
    priceCents: 399, images: ["https://media.petparcel.store/products/variants/843bb9f5ce060006e0d0.webp", "https://media.petparcel.store/products/35acc8a5aec106e0db01.webp", "https://media.petparcel.store/products/fb61ea7436549d076366.webp", "https://media.petparcel.store/products/ecae874d6e5a1218e2aa.webp", "https://media.petparcel.store/products/4ac119cf560665d4a7de.webp"], tags: ["Pet Toys", "Tracked shipping"], featured: false, sortOrder: 107,
    variants: [
      { name: "Magic Tail Style Red", sku: "CJMY212708201AZ", cjVid: "2409030737241626400", priceCents: 399, inventoryQty: 25 },
      { name: "Magic Tail Style Green", sku: "CJMY212708202BY", cjVid: "2409030737241626600", priceCents: 399, inventoryQty: 25 },
      { name: "Magic Tail Gray", sku: "CJMY212708203CX", cjVid: "2409030737241626800", priceCents: 399, inventoryQty: 25 },
      { name: "With Rope Style Red", sku: "CJMY212708204DW", cjVid: "2409030737241627000", priceCents: 399, inventoryQty: 25 },
      { name: "With Rope Style Green", sku: "CJMY212708205EV", cjVid: "2409030737241627200", priceCents: 399, inventoryQty: 25 },
      { name: "With Rope Style Gray", sku: "CJMY212708206FU", cjVid: "2409030737241627300", priceCents: 399, inventoryQty: 25 },
      { name: "Bird call · red", sku: "CJMY212708207GT", cjVid: "2504291519531625300", priceCents: 399, inventoryQty: 25 },
      { name: "Bird call · Blue", sku: "CJMY212708208HS", cjVid: "2505050539131614100", priceCents: 399, inventoryQty: 25 },
      { name: "Dragonfly · Red", sku: "CJMY212708210JQ", cjVid: "2507181320461600100", priceCents: 399, inventoryQty: 25 },
      { name: "P02 Red Long Rope Wake Up", sku: "CJMY212708211KP", cjVid: "2604020657201624100", priceCents: 399, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Toys > Pet Training and Educational Toys --
  // Real supplier product, SKU CJYD2058496 (CJ id 2406120341111620600). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Summer Cooling Pet Water Bed Cushion Ice Pad Dog Sleeping Square Mat For Puppy Dogs Cats Pet Kennel Cool Cold",
    slug: "cooling-pet-water-bed-cushion", category: "Pet Training and Educational Toys",
    description: "This water playmat features a fish design that captures the attention of pets and children.\n\nBuilt to last: made from plastic, and it weighs around 18.00 g.\n\nChoose the option that suits your pet - Shark Pirate Ship 65cm, Pond World 65cm, Undersea World 65cm, Shark Pirate Ship 100cm, Seal Dolphin 100cm, Ice pad large, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- This water playmat for cats provides a cool and comfortable sensory experience for pets.",
    priceCents: 299, images: ["https://media.petparcel.store/products/02d38f075e9246d57921.webp", "https://media.petparcel.store/products/93d4d167b1a4eca41664.webp", "https://media.petparcel.store/products/df715a6f1a1e234898ec.webp", "https://media.petparcel.store/products/b81f6dad978e62aa5b48.webp"], tags: ["Pet Training and Educational Toys", "Tracked shipping"], featured: false, sortOrder: 108,
    variants: [
      { name: "Shark Pirate Ship · 65cm", sku: "CJYD205849601AZ", cjVid: "2406120341111620800", priceCents: 299, inventoryQty: 25 },
      { name: "Pond World · 65cm", sku: "CJYD205849602BY", cjVid: "2406120341111621200", priceCents: 299, inventoryQty: 25 },
      { name: "Undersea World · 65cm", sku: "CJYD205849603CX", cjVid: "2406120341111621400", priceCents: 299, inventoryQty: 25 },
      { name: "Shark Pirate Ship · 100cm", sku: "CJYD205849604DW", cjVid: "2406120341111621600", priceCents: 299, inventoryQty: 25 },
      { name: "Seal Dolphin · 100cm", sku: "CJYD205849605EV", cjVid: "2406120341111621800", priceCents: 299, inventoryQty: 25 },
      { name: "Ice pad large", sku: "CJYD205849606FU", cjVid: "2407170935211617300", priceCents: 299, inventoryQty: 25 },
      { name: "Pump (random colour)", sku: "CJYD205849607GT", cjVid: "2407220901471615300", priceCents: 299, inventoryQty: 25 },
      { name: "Ocean World · 65cm", sku: "CJYD205849608HS", cjVid: "2407230142511603500", priceCents: 299, inventoryQty: 25 },
      { name: "Ocean World · 100cm", sku: "CJYD205849609IR", cjVid: "2407230142511603700", priceCents: 299, inventoryQty: 25 },
      { name: "Ice pad small", sku: "CJYD205849610JQ", cjVid: "2506200638421621900", priceCents: 299, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Toys > Pet Plush Toys --
  // Real supplier product, SKU CJJT1317371 (CJ id 1448199534130892800). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Pet Toys Electric Jumping Shrimp USB Charging Simulation Lobster Funny Cat Plush Pets Toy",
    slug: "electric-jumping-shrimp-cat-toy", category: "Pet Plush Toys",
    description: "The lobster can be activated by tapping the tail of the lobster, and there are three modes of tail swinging.\n\nBuilt to last: made from cloth, and it weighs around 126.00 g.\n\nChoose the option that suits your pet - Jumping shrimp random colour 35cm USB, Soft sewn on eyes 32cm USB.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The movement adopts pom material to make the lobster more resistant to falling and knocking.\n- USB Rechargeable Cat Toy: Built-in sensor, can automatically flip or move.\n- It moves in a swinging manner, attracting your child to play, the chargeable motor is detachable, and you can unzip the zipper to take out it and clean it easily.\n- Child Good Choice: The toys adopt excellent materials and exquisite design concepts so that children can enjoy the joy of childhood toys.",
    priceCents: 799, images: ["https://media.petparcel.store/products/f1967c1432db5b03110f.webp", "https://media.petparcel.store/products/223257b99af667badd23.webp", "https://media.petparcel.store/products/e91597244a3ad66f4eca.webp", "https://media.petparcel.store/products/46c67b8a1df75f85fb12.webp"], tags: ["Pet Plush Toys", "Tracked shipping"], featured: false, sortOrder: 109,
    variants: [
      { name: "Jumping shrimp random colour · 35cm USB", sku: "CJJT131737102BY", cjVid: "1448218624769789952", priceCents: 799, inventoryQty: 25 },
      { name: "Soft sewn on eyes · 32cm USB", sku: "CJJT131737106FU", cjVid: "1571764263176384512", priceCents: 799, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Bedding > Pet Bedding --
  // Real supplier product, SKU CJGY1354527 (CJ id 1460790625321488384). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Foldable Dog House Pet Cat Bed Winter Dog Villa Sleep Kennel Removable Nest Warm Enclosed Cave Sofa Pets Supplies",
    slug: "foldable-dog-house-cat-bed", category: "Pet Bedding",
    description: "Can be placed in a balcony corridor or other places without worrying about sliding, providing a warm and dry shelter for pets.\n\nBuilt to last: made from cloth, and it weighs around 55.00 g.\n\nChoose the option that suits your pet - Green bear den Large, Green bear den Medium, Green bear den Small, Grey stars Blue Large, Grey stars Blue Medium, Grey stars Blue Small, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1849, images: ["https://media.petparcel.store/products/9e16b9a4cb623f26578a.webp", "https://media.petparcel.store/products/0f7e84b54927b596a7ea.webp", "https://media.petparcel.store/products/25baa1fb704c16fa8081.webp", "https://media.petparcel.store/products/11320e3b963567a76148.webp"], tags: ["Pet Bedding", "Tracked shipping"], featured: false, sortOrder: 110,
    variants: [
      { name: "Green bear den · Large", sku: "CJGY135452710JQ", cjVid: "1468834254459899904", priceCents: 1849, inventoryQty: 25 },
      { name: "Green bear den · Medium", sku: "CJGY135452711KP", cjVid: "1468834254464094208", priceCents: 1849, inventoryQty: 25 },
      { name: "Green bear den · Small", sku: "CJGY135452712LO", cjVid: "1468834254464094209", priceCents: 1849, inventoryQty: 25 },
      { name: "Grey stars Blue · Large", sku: "CJGY135452716PK", cjVid: "1470342425619861504", priceCents: 1849, inventoryQty: 25 },
      { name: "Grey stars Blue · Medium", sku: "CJGY135452717QJ", cjVid: "1470342425624055808", priceCents: 1849, inventoryQty: 25 },
      { name: "Grey stars Blue · Small", sku: "CJGY135452718RI", cjVid: "1470342425624055809", priceCents: 1849, inventoryQty: 25 },
      { name: "Brown bear · Large", sku: "CJGY135452734HS", cjVid: "1597137106919501825", priceCents: 1849, inventoryQty: 25 },
      { name: "Brown bear · Medium", sku: "CJGY135452735IR", cjVid: "1597137106923696128", priceCents: 1849, inventoryQty: 25 },
      { name: "Brown bear · Small", sku: "CJGY135452736JQ", cjVid: "1597137106923696129", priceCents: 1849, inventoryQty: 25 },
      { name: "Rabbit door curtain · Large", sku: "CJGY135452737KP", cjVid: "1597137106927890432", priceCents: 1849, inventoryQty: 25 },
      { name: "Rabbit door curtain · Medium", sku: "CJGY135452738LO", cjVid: "1597137106932084736", priceCents: 1849, inventoryQty: 25 },
      { name: "Rabbit door curtain · Small", sku: "CJGY135452739MN", cjVid: "1597137106932084737", priceCents: 1849, inventoryQty: 25 },
      { name: "Brown Snow House · Large", sku: "CJGY135452743QJ", cjVid: "1597137106940473345", priceCents: 1849, inventoryQty: 25 },
      { name: "Brown Snow House · Medium", sku: "CJGY135452744RI", cjVid: "1597137106940473346", priceCents: 1849, inventoryQty: 25 },
      { name: "Brown Snow House · Small", sku: "CJGY135452745SH", cjVid: "1597137106944667648", priceCents: 1849, inventoryQty: 25 },
      { name: "Grey cat · Large", sku: "CJGY135452746TG", cjVid: "1597137106944667649", priceCents: 1849, inventoryQty: 25 },
      { name: "Grey cat · Medium", sku: "CJGY135452747UF", cjVid: "1597137106948861952", priceCents: 1849, inventoryQty: 25 },
      { name: "Grey cat · Small", sku: "CJGY135452748VE", cjVid: "1597137106948861953", priceCents: 1849, inventoryQty: 25 },
      { name: "Grey Snow House · Large", sku: "CJGY135452752ZA", cjVid: "1597137106953056257", priceCents: 1849, inventoryQty: 25 },
      { name: "Grey Snow House · Medium", sku: "CJGY135452753AZ", cjVid: "1597137106957250560", priceCents: 1849, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Bedding > Pet Mats --
  // Real supplier product, SKU CJJT1006521 (CJ id 1357289526732656640). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Pet Cooling Pad Bed For Dogs Cats Puppy Kitten Cool Mat Pet Blanket Ice Silk Material Soft For Summer Sleeping  Blue Breathable",
    slug: "pet-cooling-pad-bed", category: "Pet Mats",
    description: "Cooling Material: The cooling mat is made of high-tech cooling cloth, which makes your pet enjoy a better cooling effect in summer.\n\nBuilt to last: made from cloth, and it weighs around 200.00 g.\n\nChoose the option that suits your pet - Blue S, Blue M, Red S, Red M, Blue L, Red L.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Multi-function: Portable and easy to fold, can be used on sleeping beds, kennel mats, cover car seats, lawns, beaches, indoors, or outdoors anywhere you want.\n- Improve Sleep: Cooling dog bed mat uses no electricity and contains no toxic gels.\n- It wicks heat out and releases it into the air, keeping the dog/cat feeling cool, have your pet in deep sleep and relax.\n- Washable: The mat is lightweight, easy to machine wash, and quick to dry.",
    priceCents: 899, images: ["https://media.petparcel.store/products/4eb72d72b020d2083bff.webp", "https://media.petparcel.store/products/89453d7693b8d1d71f9f.webp", "https://media.petparcel.store/products/4f0a4cba74414f15a7cc.webp", "https://media.petparcel.store/products/f3ec0d55621f793c3894.webp"], tags: ["Pet Mats", "Tracked shipping"], featured: false, sortOrder: 111,
    variants: [
      { name: "Blue · S", sku: "CJJT100652101AZ", cjVid: "1357289526749433856", priceCents: 899, inventoryQty: 25 },
      { name: "Blue · M", sku: "CJJT100652102BY", cjVid: "1357289526749433857", priceCents: 899, inventoryQty: 25 },
      { name: "Red · S", sku: "CJJT100652103CX", cjVid: "1357289526749433858", priceCents: 899, inventoryQty: 25 },
      { name: "Red · M", sku: "CJJT100652104DW", cjVid: "1357289526749433859", priceCents: 899, inventoryQty: 25 },
      { name: "Blue · L", sku: "CJJT100652105EV", cjVid: "1408995506419535872", priceCents: 899, inventoryQty: 25 },
      { name: "Red · L", sku: "CJJT100652106FU", cjVid: "1408995506432118784", priceCents: 899, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Apparels > Pet Sweatshirts & Hoodies --
  // Real supplier product, SKU CJGD1172394 (CJ id 1403920038016192512). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Cute Fruit Dog Clothes For Small Dogs Hoodies Winter Warm Fleece Pet Clothing Puppy Cat Costume Coat For French Chihuahua Outfit",
    slug: "cute-fruit-dog-hoodie-clothes", category: "Pet Sweatshirts & Hoodies",
    description: "Fruit design to make your puppy more cute, which will help reduce hair loss in the house, and avoid polluting the grass or other dust to walk your pet.\n\nBuilt to last: made from cloth, and it weighs around 49.00 g.\n\nChoose the option that suits your pet - Red Apple XS, Red Heart XS, Carrot XS, White & Green XS, Red Apple S, Red Heart S, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Breathable, lightweight, soft fabric, so that your dog in the cold autumn and winter feel more comfortable and warm.\n- Suitable for walking, outdoor, sports, family, winter tours and parties, photos and daily wear for holidays.",
    priceCents: 399, images: ["https://media.petparcel.store/products/17990b2601548ecca52e.webp", "https://media.petparcel.store/products/22ec4be8f4d843d4172c.webp", "https://media.petparcel.store/products/992039abdb19dedcbd25.webp", "https://media.petparcel.store/products/63d04b55e524e429ca60.webp"], tags: ["Pet Sweatshirts & Hoodies", "Tracked shipping"], featured: false, sortOrder: 112,
    variants: [
      { name: "Red Apple · XS", sku: "CJGD117239401AZ", cjVid: "1403920039480004608", priceCents: 399, inventoryQty: 25 },
      { name: "Red Heart · XS", sku: "CJGD117239407GT", cjVid: "1403920039534530560", priceCents: 399, inventoryQty: 25 },
      { name: "Carrot · XS", sku: "CJGD117239413MN", cjVid: "1403920039601639424", priceCents: 399, inventoryQty: 25 },
      { name: "White & Green · XS", sku: "CJGD117239419SH", cjVid: "1403920039660359680", priceCents: 399, inventoryQty: 25 },
      { name: "Red Apple · S", sku: "CJGD117239402BY", cjVid: "1403920039488393216", priceCents: 399, inventoryQty: 25 },
      { name: "Red Heart · S", sku: "CJGD117239408HS", cjVid: "1403920039542919168", priceCents: 399, inventoryQty: 25 },
      { name: "Carrot · S", sku: "CJGD117239414NM", cjVid: "1403920039610028032", priceCents: 399, inventoryQty: 25 },
      { name: "White & Green · S", sku: "CJGD117239420TG", cjVid: "1403920039672942592", priceCents: 399, inventoryQty: 25 },
      { name: "Red Apple · M", sku: "CJGD117239403CX", cjVid: "1403920039496781824", priceCents: 399, inventoryQty: 25 },
      { name: "Red Heart · M", sku: "CJGD117239409IR", cjVid: "1403920039551307776", priceCents: 399, inventoryQty: 25 },
      { name: "Carrot · M", sku: "CJGD117239415OL", cjVid: "1403920039622610944", priceCents: 399, inventoryQty: 25 },
      { name: "Red Apple · L", sku: "CJGD117239404DW", cjVid: "1403920039505170432", priceCents: 399, inventoryQty: 25 },
      { name: "Red Heart · L", sku: "CJGD117239410JQ", cjVid: "1403920039563890688", priceCents: 399, inventoryQty: 25 },
      { name: "Carrot · L", sku: "CJGD117239416PK", cjVid: "1403920039630999552", priceCents: 399, inventoryQty: 25 },
      { name: "Red Apple · XL", sku: "CJGD117239405EV", cjVid: "1403920039517753344", priceCents: 399, inventoryQty: 25 },
      { name: "Red Heart · XL", sku: "CJGD117239411KP", cjVid: "1403920039580667904", priceCents: 399, inventoryQty: 25 },
      { name: "Carrot · XL", sku: "CJGD117239417QJ", cjVid: "1403920039639388160", priceCents: 399, inventoryQty: 25 },
      { name: "Red Apple · 2XL", sku: "CJGD117239406FU", cjVid: "1403920039526141952", priceCents: 399, inventoryQty: 25 },
      { name: "Red Heart · 2XL", sku: "CJGD117239412LO", cjVid: "1403920039589056512", priceCents: 399, inventoryQty: 25 },
      { name: "Carrot · 2XL", sku: "CJGD117239418RI", cjVid: "1403920039651971072", priceCents: 399, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Bird Supplies > Bird Supplies --
  // Real supplier product, SKU CJNY1654898 (CJ id 1610174941469618176). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Parrot Xuanfeng Bird Cage With Feeder Toy Grass Nest Breeding Box",
    slug: "parrot-bird-cage-with-feeder", category: "Bird Supplies",
    description: "Parrot Xuanfeng Bird Cage With Feeder Toy Grass Nest Breeding Box is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from metal, and it weighs around 6600.00 g.\n\nChoose the option that suits your pet - Black Standard Meal, Black Swing Package, Black Grass Nest Package, Black Boutique Package, Black Deluxe Package, White Standard Meal, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 7999, images: ["https://media.petparcel.store/products/a90e4bd49167b6134310.webp", "https://media.petparcel.store/products/97c27f1200d077b8c971.webp", "https://media.petparcel.store/products/440fea2c059161c02609.webp", "https://media.petparcel.store/products/682f7f3d4a1a05b4f8c0.webp"], tags: ["Bird Supplies", "Tracked shipping"], featured: false, sortOrder: 113,
    variants: [
      { name: "Black Standard Meal", sku: "CJNY165489801AZ", cjVid: "1610174941536727040", priceCents: 7999, inventoryQty: 25 },
      { name: "Black Swing Package", sku: "CJNY165489802BY", cjVid: "1610174941540921344", priceCents: 7999, inventoryQty: 25 },
      { name: "Black Grass Nest Package", sku: "CJNY165489803CX", cjVid: "1610174941545115648", priceCents: 7999, inventoryQty: 25 },
      { name: "Black Boutique Package", sku: "CJNY165489804DW", cjVid: "1610174941549309952", priceCents: 7999, inventoryQty: 25 },
      { name: "Black Deluxe Package", sku: "CJNY165489805EV", cjVid: "1610174941549309953", priceCents: 7999, inventoryQty: 25 },
      { name: "White Standard Meal", sku: "CJNY165489806FU", cjVid: "1610174941553504256", priceCents: 7999, inventoryQty: 25 },
      { name: "White Swing Package", sku: "CJNY165489807GT", cjVid: "1610174941553504257", priceCents: 7999, inventoryQty: 25 },
      { name: "White Grass Nest Package", sku: "CJNY165489808HS", cjVid: "1610174941557698560", priceCents: 7999, inventoryQty: 25 },
      { name: "White Boutique Package", sku: "CJNY165489809IR", cjVid: "1610174941557698561", priceCents: 7999, inventoryQty: 25 },
      { name: "White Deluxe Package", sku: "CJNY165489810JQ", cjVid: "1610174941561892864", priceCents: 7999, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Bird Supplies > Bird Cages --
  // Real supplier product, SKU CJYD2235451 (CJ id 2412061027411625700). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Climbing And Playing Bird Cage Accessories Toy Solid Wood Jumping Platform Standing Board",
    slug: "climbing-playing-bird-cage-accessory", category: "Bird Cages",
    description: "Climbing And Playing Bird Cage Accessories Toy Solid Wood Jumping Platform Standing Board is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from wood, and it weighs around 85.00 g.\n\nChoose the option that suits your pet - Square 12 x 12, Small 15 x 8 cm, Large 19 x 10 cm, Large Fan, Semicircle Large, Semicircle Small, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 299, images: ["https://media.petparcel.store/products/e0acc8bcf3e43734d6f5.webp", "https://media.petparcel.store/products/50ee03ebd6177cb7e014.webp", "https://media.petparcel.store/products/418f0f9ef0ec6304c147.webp", "https://media.petparcel.store/products/3f4ceaa4ddf29e41d9cd.webp"], tags: ["Bird Cages", "Tracked shipping"], featured: false, sortOrder: 114,
    variants: [
      { name: "Square · 12 x 12", sku: "CJYD223545102BY", cjVid: "2412061027411626100", priceCents: 299, inventoryQty: 25 },
      { name: "Small · 15 x 8 cm", sku: "CJYD223545103CX", cjVid: "2412061027411626400", priceCents: 299, inventoryQty: 25 },
      { name: "Large · 19 x 10 cm", sku: "CJYD223545104DW", cjVid: "2412061027411626600", priceCents: 299, inventoryQty: 25 },
      { name: "Large Fan", sku: "CJYD223545105EV", cjVid: "2412061027411626800", priceCents: 299, inventoryQty: 25 },
      { name: "Semicircle Large", sku: "CJYD223545106FU", cjVid: "2412061027411627000", priceCents: 299, inventoryQty: 25 },
      { name: "Semicircle Small", sku: "CJYD223545107GT", cjVid: "2412061027411627200", priceCents: 299, inventoryQty: 25 },
      { name: "Small Fan", sku: "CJYD223545108HS", cjVid: "2412061027411627400", priceCents: 299, inventoryQty: 25 },
      { name: "Triangular Wood", sku: "CJYD223545109IR", cjVid: "2412061027411627600", priceCents: 299, inventoryQty: 25 },
      { name: "Standard", sku: "CJYD223545110JQ", cjVid: "2412061027411627800", priceCents: 299, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Groomings > Pet Hair Removers & Combs --
  // Real supplier product, SKU CJGY1035039 (CJ id 1368888013161107456). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "2-1 Reusable Pet Hair Remover Brush Lint Roller Portable Effective Self Cleaning Tool for Cat Dog Fur Hair Dust Removal Brush",
    slug: "reusable-pet-hair-remover-brush", category: "Pet Hair Removers & Combs",
    description: "2-1 Reusable Pet Hair Remover Brush Lint Roller Portable Effective Self Cleaning Tool for Cat Dog Fur Hair Dust Removal Brush is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from plastic, and it weighs around 104.00 g.\n\nChoose the option that suits your pet - White, Green, Pink, Blue.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 499, images: ["https://media.petparcel.store/products/e5cfda2ea05fa9c9d127.webp", "https://media.petparcel.store/products/2cf86274fff8e91aa161.webp", "https://media.petparcel.store/products/71905281ec5b0fe8d94c.webp", "https://media.petparcel.store/products/23c764cabc20f87c2ecb.webp"], tags: ["Pet Hair Removers & Combs", "Tracked shipping"], featured: false, sortOrder: 115,
    variants: [
      { name: "White", sku: "CJGY103503901AZ", cjVid: "1368888014532644864", priceCents: 499, inventoryQty: 25 },
      { name: "Green", sku: "CJGY103503902BY", cjVid: "1368888014624919552", priceCents: 499, inventoryQty: 25 },
      { name: "Pink", sku: "CJGY103503903CX", cjVid: "1368888014692028416", priceCents: 499, inventoryQty: 25 },
      { name: "Blue", sku: "CJGY103503904DW", cjVid: "1380458561456443392", priceCents: 499, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Groomings > Pet Towels --
  // Real supplier product, SKU CJGY1388413 (CJ id 1475029850208210944). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Quick-drying Pet Absorbent Towel Dog Bathrobe Pet Dog Bath Towel For Dogs Cats Microfiber Absorbent Pet Drying Towel Pet Supplies Pet Products",
    slug: "quick-drying-pet-absorbent-towel", category: "Pet Towels",
    description: "This bathrobe can cover your pet's whole body, if your pets take a shower or get wet in the rain, help them wear this bathrobe to dry the moisture quickly from their hair.\n\nBuilt to last: made from cloth, and it weighs around 100.00 g.\n\nChoose the option that suits your pet - Blue XS, Blue S, Blue M, Pink XS, Pink S, Pink M, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- This bathrobe also can be used as a warm coat in winter, if you choose the right size for your pets (how to choose please see size chart), they will walk or run freely, just like wearing a coat.\n- If you worry your pets catch a cold in the winter night, this bathrobe also can be used as a pajama.",
    priceCents: 699, images: ["https://media.petparcel.store/products/69ffcdcd222d17eb5fb1.webp", "https://media.petparcel.store/products/765596d7c7fc78ec9680.webp", "https://media.petparcel.store/products/fe595f49321a36265c0f.webp", "https://media.petparcel.store/products/8e15840bb64d4ddc0ae9.webp"], tags: ["Pet Towels", "Tracked shipping"], featured: false, sortOrder: 116,
    variants: [
      { name: "Blue · XS", sku: "CJGY138841301AZ", cjVid: "1475029850338234368", priceCents: 699, inventoryQty: 25 },
      { name: "Blue · S", sku: "CJGY138841302BY", cjVid: "1475029850342428672", priceCents: 699, inventoryQty: 25 },
      { name: "Blue · M", sku: "CJGY138841303CX", cjVid: "1475029850342428673", priceCents: 699, inventoryQty: 25 },
      { name: "Pink · XS", sku: "CJGY138841304DW", cjVid: "1475029850346622976", priceCents: 699, inventoryQty: 25 },
      { name: "Pink · S", sku: "CJGY138841305EV", cjVid: "1475029850346622977", priceCents: 699, inventoryQty: 25 },
      { name: "Pink · M", sku: "CJGY138841306FU", cjVid: "1475029850350817280", priceCents: 699, inventoryQty: 25 },
      { name: "Green · XS", sku: "CJGY138841307GT", cjVid: "1475029850350817281", priceCents: 699, inventoryQty: 25 },
      { name: "Green · S", sku: "CJGY138841308HS", cjVid: "1475029850355011584", priceCents: 699, inventoryQty: 25 },
      { name: "Green · M", sku: "CJGY138841309IR", cjVid: "1475029850355011585", priceCents: 699, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Groomings > Pet Nail Polishers --
  // Real supplier product, SKU CJGY1675701 (CJ id 1621435150108209152). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Pet Nail Clippers Dog Nail Clippers Cat Nail Clippers LED Electric Nail Grinder Pet Supplies LED Light Pet Nail Clippers",
    slug: "pet-nail-clippers", category: "Pet Nail Polishers",
    description: "Professional pet nail clippersDesigned to safely trim the claws of small and medium pets such as kitty cats, puppy, Teddy dog, rabbits and so on.\n\nBuilt to last: made from plastic, and it weighs around 89.00 g.\n\nChoose the option that suits your pet - Pink, Light coffee, Light Blue.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Built-in LED light, can clearly illuminate the bleeding line, prevent nail bleeding.\n- Easy to useErgonomically designed non-slip handles are easy and comfortable to use.",
    priceCents: 699, images: ["https://media.petparcel.store/products/9fe3471b754f7c1fd58d.webp", "https://media.petparcel.store/products/36424882c907f878c1e1.webp", "https://media.petparcel.store/products/2feaa0917a0c6a02c6bf.webp", "https://media.petparcel.store/products/2648050e46ab44ad82c6.webp"], tags: ["Pet Nail Polishers", "Tracked shipping"], featured: false, sortOrder: 117,
    variants: [
      { name: "Pink", sku: "CJGY167570101AZ", cjVid: "1621435150133374976", priceCents: 699, inventoryQty: 25 },
      { name: "Light coffee", sku: "CJGY167570102BY", cjVid: "1621435150133374977", priceCents: 699, inventoryQty: 25 },
      { name: "Light Blue", sku: "CJGY167570103CX", cjVid: "1621435150137569280", priceCents: 699, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Groomings > Pet Shower Products --
  // Real supplier product, SKU CJGY1986687 (CJ id 1767392629924311040). Every variant below is a
  // real supplier line: the CJ VID is the supplier's own variant id
  // (stanProducts[].id) and the SKU is the supplier's own variant SKU, so a paid
  // order pushes that exact option and can never order the wrong variant.
  { name: "Soft Silicone Pets Hair Remover Comb Handheld Bath Shower Hair Shampoo Massage Brush For Dogs Cats Cleaning Tools Pet Products",
    slug: "silicone-pet-hair-remover-comb", category: "Pet Shower Products",
    description: "Soft Silicone Pets Hair Remover Comb Handheld Bath Shower Hair Shampoo Massage Brush For Dogs Cats Cleaning Tools Pet Products is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from plastic, and it weighs around 78.00 g.\n\nChoose the option that suits your pet - White, Light Blue, Green, Dark Blue.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 299, images: ["https://media.petparcel.store/products/18d2919cf27cf137f353.webp", "https://media.petparcel.store/products/f2d0c436001f4bda054f.webp", "https://media.petparcel.store/products/8cccaf06ddc658b57bee.webp", "https://media.petparcel.store/products/0f3e16e2841966040bbf.webp"], tags: ["Pet Shower Products", "Tracked shipping"], featured: false, sortOrder: 118,
    variants: [
      { name: "White", sku: "CJGY198668701AZ", cjVid: "1767392630029168640", priceCents: 299, inventoryQty: 25 },
      { name: "Light Blue", sku: "CJGY198668702BY", cjVid: "1767392630104666112", priceCents: 299, inventoryQty: 25 },
      { name: "Green", sku: "CJGY198668703CX", cjVid: "1767392630184357888", priceCents: 299, inventoryQty: 25 },
      { name: "Dark Blue", sku: "CJGY198668704DW", cjVid: "1767392630259855360", priceCents: 299, inventoryQty: 25 },
    ],
    reviews: [] },

  // ===== // -- LIVE CJ SUPPLIER CATALOG (one product per category) =====
  // -- Pet Outdoor Supplies -- real supplier listing, CJ pid 1941393057446592513, supplier SKU CJBC2421685.
  { name: "Automatic Anti Bark Barking Dog Shock Control Collar Device Large Medium Small",
    slug: "automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small", category: "Pet Outdoor Supplies",
    description: "Automatic Anti Bark Barking Dog Shock Control Collar Device Large Medium Small is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from plastic, and it weighs around 453 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 2299, images: [`https://media.petparcel.store/products/697c27c590b239b08698.webp`, `https://media.petparcel.store/products/9251963e2dc0d377bba4.webp`, `https://media.petparcel.store/products/23a8eb7d1d510a05dd57.webp`, `https://media.petparcel.store/products/3369dac25545d2722e6e.webp`, `https://media.petparcel.store/products/4c762566606373f499b6.webp`], tags: ["Pet Outdoor Supplies", "US warehouse"], featured: false, sortOrder: 100,
    variants: [
      { name: "Black", sku: "CJBC242168501AZ", cjVid: "1941393057551450113", priceCents: 2299, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Barking Control Equipments -- real supplier listing, CJ pid 2082221710648397825, supplier SKU CJBC3015333.
  { name: "2 Pack Dog Door Bells Dog Doorbell To Go Outside Puppy Train Bell For Dogs To Ring",
    slug: "2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to", category: "Barking Control Equipments",
    description: "A Gift for Your Puppy: Teaching dog to ring a bell to go out out or go to the toilet, instead of bark or scratching on the door to get your attention.\n\nLightweight and easy to handle at around 100 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Ideal training gadget to treats game, toilet training, feed training and order training for your pets.\n- It can improve the feelings and communication with you lovely pet.\n- Adjustable Length: The training bell has a strong buckle that can hang from nearly any doorknobs or handles.\n- You can easily adjust the length between 33'' and 35'' and make it suitable for your dog friends to ring the bell.",
    priceCents: 5699, images: [`https://media.petparcel.store/products/0228c62f5ba5e34746bf.webp`, `https://media.petparcel.store/products/dc1c1a001e255f0ad5b9.webp`, `https://media.petparcel.store/products/630822ce7d019583ba3d.webp`, `https://media.petparcel.store/products/73ddc0625cc64d000e5c.webp`, `https://media.petparcel.store/products/eb7cf406dd18981bc58f.webp`], tags: ["Barking Control Equipments", "US warehouse"], featured: false, sortOrder: 101,
    variants: [
      { name: "PINK", sku: "CJBC301533301AZ", cjVid: "2082221710908444674", priceCents: 5699, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Trainers -- real supplier listing, CJ pid 2086539679061921794, supplier SKU CJTR3047373.
  { name: "Dog Training Clicker With Sring Wrist And Keyring Pet Dog Training Clickers For Puppy, Cat",
    slug: "dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo", category: "Trainers",
    description: "New communication tool about you and your puppy.\n\nLightweight and easy to handle at around 100 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Pet Dog Training Clickers for Puppy, Cat, Potty, Bird, Horse, Pet, Trainer Training Tools, Behavior Aids Just press to mark desired behavior, then reward for faster learning.\n- The spring wrist length: 16cm/6.3inches and can strength to 25cm/9.84inches.\n- Package include: Black + Blue,each color 1 pcs.",
    priceCents: 4999, images: [`https://media.petparcel.store/products/e4748d849a12b078a708.webp`, `https://media.petparcel.store/products/31889a56aff5d01576be.webp`, `https://media.petparcel.store/products/45ad5af205492e07873c.webp`, `https://media.petparcel.store/products/0cf0bb428662ac46b778.webp`, `https://media.petparcel.store/products/a972fb84799939350f80.webp`], tags: ["Trainers", "US warehouse"], featured: false, sortOrder: 102,
    variants: [
      { name: "BLUE", sku: "CJTR304737301AZ", cjVid: "2086539679238082562", priceCents: 4999, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Dog Training Pads & Diapers -- real supplier listing, CJ pid 2080458038578536449, supplier SKU CJTD3003068.
  { name: "Lavender Scented Disposable Pet Training Pads",
    slug: "lavender-scented-disposable-pet-training-pads", category: "Dog Training Pads & Diapers",
    description: "Overview Soft, quick-absorbing pet training pads with natural lavender scent effectively lock in liquid and neutralize unpleasant odors, equipped with leak-proof back film to safeguard floors and carpets.\n\nBuilt to last: made from cloth, packed at Carton,Plastic bags, and it weighs around 1720 g.\n\nChoose the option that suits your pet - 565, 786.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Perfect for puppy housebreaking, dog litter training, pet travel, in-crate use, sick pet nursing and daily household pet care scenarios.\n- Product information Material: All cotton.\n- 3 cm error is normal for manual measurement.\n- Check the detailed size chart prior to purchase.",
    priceCents: 5499, images: [`https://media.petparcel.store/products/89183ad131ca84f4534b.webp`, `https://media.petparcel.store/products/c7432a63aa133cf19029.webp`, `https://media.petparcel.store/products/23ff683722a8e35e99d6.webp`, `https://media.petparcel.store/products/87674074351f293c9014.webp`, `https://media.petparcel.store/products/a585d3ce69e0d77ea1f5.webp`], tags: ["Dog Training Pads & Diapers", "US warehouse"], featured: false, sortOrder: 103,
    variants: [
      { name: "565", sku: "CJTD300306801AZ", cjVid: "2080458039350288386", priceCents: 5499, inventoryQty: 300 },
      { name: "786", sku: "CJTD300306802BY", cjVid: "2080458039350288387", priceCents: 5499, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Snacks -- real supplier listing, CJ pid 2077267173520543745, supplier SKU CJPS2985401.
  { name: "Trace Element Tablets For Senior Dogs Multimineral Supplement For Elderly Canines, Supports Bone Health, Skin Coat & Digestion",
    slug: "trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani", category: "Pet Snacks",
    description: "Boost Coat & Vitality: Enhances fur shine, restores youthful vitality, and improves dull coats common in senior dogs.\n\nLightweight and easy to handle at around 150 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Gentle Digestive Care: Optimizes gastrointestinal function and eases digestive strain of elderly pups.\n- Strong Bone Support: Raises bone mineral density, effectively prevents osteoporosis in aging dogs.\n- Anti-Stress Formula: Alleviates stress and relieves environmental stress reactions for sensitive senior canines.\n- Easy Feeding: 80 chewable tablets total; feed 4.",
    priceCents: 2899, images: [`https://media.petparcel.store/products/6014dc84d4b31ceb6838.webp`, `https://media.petparcel.store/products/6e1b60da03a03eead7fe.webp`, `https://media.petparcel.store/products/9eb11122cf10a7293d10.webp`, `https://media.petparcel.store/products/22ac53b3743f66b22efa.webp`, `https://media.petparcel.store/products/4c6894db630d2a2fe520.webp`], tags: ["Pet Snacks", "US warehouse"], featured: false, sortOrder: 104,
    variants: [
      { name: "1 box", sku: "CJPS298540101AZ", cjVid: "2077267173700898818", priceCents: 2899, inventoryQty: 277 },
    ],
    reviews: [] },
  // -- Pet Bags -- real supplier listing, CJ pid 2093416983420723201, supplier SKU CJPB3106361.
  { name: "Traveler Bubble Backpack Pet Carriers For Cats And Dogs",
    slug: "traveler-bubble-backpack-pet-carriers-for-cats-and-dogs", category: "Pet Bags",
    description: "Perfect for dogs up to 15-pounds, or cats up to 18-pounds.\n\nLightweight and easy to handle at around 200 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Easily fits cats, small dogs, and most other small/medium-sized pets!\n- Please make sure your pet sits within 14.5 inches overall height and 12 inches wide Breathable & Perspective: Three side was made of PVC mesh for the carriers.\n- You can also rest assured that it is strong enough to stand up to the scratches or gnawing of your pets.",
    priceCents: 13199, images: [`https://media.petparcel.store/products/f297ef278c39dd5a8aef.webp`, `https://media.petparcel.store/products/54d42d2a53dffcabbb11.webp`, `https://media.petparcel.store/products/8dd84094b65a257edad0.webp`, `https://media.petparcel.store/products/cb49df9fabfcbf9b9186.webp`, `https://media.petparcel.store/products/0e2e7f96979740439b19.webp`], tags: ["Pet Bags", "US warehouse"], featured: false, sortOrder: 105,
    variants: [
      { name: "BLACK", sku: "CJPB310636101AZ", cjVid: "2093416983596883969", priceCents: 13199, inventoryQty: 60 },
    ],
    reviews: [] },
  // -- Pet Seat Belts -- real supplier listing, CJ pid 1925125360529211393, supplier SKU CJSB2382086.
  { name: "2Pcs Pet Dog Seat Belt Leash Adjustable Pet Dog Cat Safety Leads Harness",
    slug: "2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness", category: "Pet Seat Belts",
    description: "Prevents pet from distracting you or blocking your vision for safe drive.\n\nBuilt to last: made from cloth, and it weighs around 1000 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Belt tap clips directly into seatbelt buckle.\n- Easy and quick to buckle and unbuckle pet.\n- Work as a pet leash when 2 belts are connected together.\n- Swivel carabiner attaches to pet's body harness and allows pet to spin around without tangling.",
    priceCents: 2999, images: [`https://media.petparcel.store/products/112100784d4742bac5b8.webp`, `https://media.petparcel.store/products/04abcdbe05dfd082f5a6.webp`, `https://media.petparcel.store/products/5794451656373dbdcd2a.webp`, `https://media.petparcel.store/products/678527b08664e2c1cacb.webp`, `https://media.petparcel.store/products/945967d863b2979e9f19.webp`], tags: ["Pet Seat Belts", "US warehouse"], featured: false, sortOrder: 106,
    variants: [
      { name: "Black", sku: "CJSB238208601AZ", cjVid: "1925125360608903170", priceCents: 2999, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Car Mats -- real supplier listing, CJ pid 2609120047161637000, supplier SKU CJYD3156715.
  { name: "Car Pet Mat Pet Seat Center Protective Net",
    slug: "car-pet-mat-pet-seat-center-protective-net", category: "Pet Car Mats",
    description: "Car Pet Mat Pet Seat Center Protective Net is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 1850.00 g.\n\nChoose the option that suits your pet - Black 137x147, Orange Red 137x147.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 2399, images: [`https://media.petparcel.store/products/aae4e4ac1bdedc3c48b1.webp`, `https://media.petparcel.store/products/90e5ca339b88a93495ac.webp`, `https://media.petparcel.store/products/8a0070c6a88abb1cfaa6.webp`, `https://media.petparcel.store/products/2316be146e3ce3d02c47.webp`, `https://media.petparcel.store/products/96515a34920775ea9256.webp`], tags: ["Pet Car Mats", "Tracking"], featured: false, sortOrder: 107,
    variants: [
      { name: "Black · 137x147", sku: "CJYD315671501AZ", cjVid: "2609120047161638100", priceCents: 2399, inventoryQty: 300 },
      { name: "Orange Red · 137x147", sku: "CJYD315671502BY", cjVid: "2609120047161638101", priceCents: 2399, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Guardrails -- real supplier listing, CJ pid 2097258828843417601, supplier SKU CJPG3144586.
  { name: "Plastic Dog With Movable Enclosure, Suitable For Small And Medium-sized Dogs, Cats And Rabbits.",
    slug: "plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca", category: "Pet Guardrails",
    description: "Thickened PP material, safe and durable.\n\nLightweight and easy to handle at around 5996 g.\n\nChoose the option that suits your pet - Black 4p, White 4p, Black 6p, White 6p, Black 8p, White 8p.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Select high-quality thickened PP plastic and combine with reinforced steel hardware.\n- It is sturdy and durable, avoiding problems such as rusting, peeling paint, and sharp scratches on metal fences.\n- The edges of the panel are rounded without burrs, and it is resistant to scratching and biting.\n- Modular connection, suitable for multiple scenarios.",
    priceCents: 8199, images: [`https://media.petparcel.store/products/ec1ce72f37067aadc572.webp`, `https://media.petparcel.store/products/7057efbefcc96343ee1e.webp`, `https://media.petparcel.store/products/4112ec1a0d5710bbafd8.webp`, `https://media.petparcel.store/products/bbaf289869238ed40f0d.webp`, `https://media.petparcel.store/products/1d4413f6152a514c2012.webp`], tags: ["Pet Guardrails", "US warehouse"], featured: false, sortOrder: 108,
    variants: [
      { name: "Black 4p", sku: "CJPG314458601AZ", cjVid: "2097258829476757505", priceCents: 8199, inventoryQty: 300 },
      { name: "White 4p", sku: "CJPG314458602BY", cjVid: "2097258829476757506", priceCents: 8199, inventoryQty: 300 },
      { name: "Black 6p", sku: "CJPG314458603CX", cjVid: "2097258829476757507", priceCents: 8199, inventoryQty: 300 },
      { name: "White 6p", sku: "CJPG314458604DW", cjVid: "2097258829476757508", priceCents: 8199, inventoryQty: 300 },
      { name: "Black 8p", sku: "CJPG314458605EV", cjVid: "2097258829476757509", priceCents: 8199, inventoryQty: 300 },
      { name: "White 8p", sku: "CJPG314458606FU", cjVid: "2097258829476757510", priceCents: 8199, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Furnitures -- real supplier listing, CJ pid 1903376265475391489, supplier SKU CJSP2334644.
  { name: "Mushroom Cat Bed Cat Claw Scratcher With Wide Bed And Sisal Scratch Panel",
    slug: "mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel", category: "Pet Furnitures",
    description: "Additionally, it also features a swinging spring ball to provide your cat with endless fun and relaxation options.\n\nBuilt to last: made from wood, and it weighs around 4085 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Comfortable Headrest: Equipped with a soft PP cotton-wrapped headrest, this cat bed offers optimal support to your cat's head, ensuring a cozy sleeping experience and relieving cervical pressure.\n- Quick and Easy Installation: This cat scratching post is designed with a simple structure and detailed instructions, allowing you to set up effortlessly in no time.\n- Just insert the 2 mushroom panels inside the base and fixed them with screws, and then assemble the swinging ball, your cat will get a wonderful leisure place immediately!\n- Cute Appearance and Stable Frame: With soft faux fabric and adorable mushroom decorations, this cat bed adds a touch of charm to your room space.",
    priceCents: 4399, images: [`https://media.petparcel.store/products/84da021cd17d65d463a8.webp`, `https://media.petparcel.store/products/e5472f61cc5f0e8ef49d.webp`, `https://media.petparcel.store/products/63bc788e7ac3eb632f97.webp`, `https://media.petparcel.store/products/69ba4cd370021ccb3100.webp`, `https://media.petparcel.store/products/561153aea1e149e9f647.webp`], tags: ["Pet Furnitures", "US warehouse"], featured: false, sortOrder: 109,
    variants: [
      { name: "Multicolor", sku: "CJSP233464401AZ", cjVid: "1903376265542500353", priceCents: 4399, inventoryQty: 69 },
    ],
    reviews: [] },
  // -- Cat Scratching Posts -- real supplier listing, CJ pid 2082396640891764738, supplier SKU CJSP3017570.
  { name: "2-in-1 Cat Rocking Scratcher Chair Wooden Cat Bed Lounge Corrugated Cardboard Scratching Pad For Indoor Cats",
    slug: "2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard", category: "Cat Scratching Posts",
    description: "2-in-1 Cat Rocking Scratcher Chair Wooden Cat Bed Lounge Corrugated Cardboard Scratching Pad For Indoor Cats is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nLightweight and easy to handle at around 860 g.\n\nChoose the option that suits your pet - S, L.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 3999, images: [`https://media.petparcel.store/products/533569abde530c28aff1.webp`, `https://media.petparcel.store/products/9215803f552c7bde1f86.webp`, `https://media.petparcel.store/products/77ccc784e251c685f82d.webp`, `https://media.petparcel.store/products/862879de7c00649b7e3d.webp`, `https://media.petparcel.store/products/2e6e9c35e6525c3ea4e3.webp`], tags: ["Cat Scratching Posts", "US warehouse"], featured: false, sortOrder: 110,
    variants: [
      { name: "S", sku: "CJSP301757001AZ", cjVid: "2082396641147617282", priceCents: 3999, inventoryQty: 197 },
      { name: "L", sku: "CJSP301757002BY", cjVid: "2082396641147617283", priceCents: 3999, inventoryQty: 197 },
    ],
    reviews: [] },
  // -- Pet Furniture Protectors -- real supplier listing, CJ pid 2411070834521602600, supplier SKU CJYD2185818.
  { name: "Nordic Imperial Concubine Sofa Cover Four Seasons Universal Elastic Sofa Cover Cloth Set",
    slug: "nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover", category: "Pet Furniture Protectors",
    description: "Fabric principal component content: 95.\n\nBuilt to last: made from cloth, and it weighs around 600.00 g.\n\nChoose the option that suits your pet - Bright Red Single 90x140cm, Bright Red Double 145x185cm, Bright Red Three People 190x230cm, Bright Red 235x300cm For Four People, Advanced Yellow Single 90x140cm, Advanced Yellow Double 145x185cm, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 999, images: [`https://media.petparcel.store/products/637567db454abe66055d.webp`, `https://media.petparcel.store/products/3a1e5d7cd431b3c9cd4a.webp`, `https://media.petparcel.store/products/9d15d7eb338397f2a059.webp`, `https://media.petparcel.store/products/19f942521a231ede8987.webp`, `https://media.petparcel.store/products/6deb6e3449cb621786b8.webp`], tags: ["Pet Furniture Protectors", "Tracking"], featured: false, sortOrder: 111,
    variants: [
      { name: "Bright Red Single · 90x140cm", sku: "CJYD218581801AZ", cjVid: "2411070834521602800", priceCents: 999, inventoryQty: 300 },
      { name: "Bright Red Double · 145x185cm", sku: "CJYD218581802BY", cjVid: "2411070834521602900", priceCents: 999, inventoryQty: 300 },
      { name: "Bright Red Three People · 190x230cm", sku: "CJYD218581803CX", cjVid: "2411070834521603300", priceCents: 999, inventoryQty: 300 },
      { name: "Bright Red · 235x300cm For Four People", sku: "CJYD218581804DW", cjVid: "2411070834521603500", priceCents: 999, inventoryQty: 300 },
      { name: "Advanced Yellow Single · 90x140cm", sku: "CJYD218581805EV", cjVid: "2411070834521603600", priceCents: 999, inventoryQty: 300 },
      { name: "Advanced Yellow Double · 145x185cm", sku: "CJYD218581806FU", cjVid: "2411070834521603800", priceCents: 999, inventoryQty: 300 },
      { name: "Advanced Yellow Three People · 190x230cm", sku: "CJYD218581807GT", cjVid: "2411070834521604200", priceCents: 999, inventoryQty: 300 },
      { name: "Advanced Yellow · 235x300cm For Four People", sku: "CJYD218581808HS", cjVid: "2411070834521604400", priceCents: 999, inventoryQty: 300 },
      { name: "Black Single · 90x140cm", sku: "CJYD218581809IR", cjVid: "2411070834521604500", priceCents: 999, inventoryQty: 300 },
      { name: "Black Double · 145x185cm", sku: "CJYD218581810JQ", cjVid: "2411070834521604700", priceCents: 999, inventoryQty: 300 },
      { name: "Black Three People · 190x230cm", sku: "CJYD218581811KP", cjVid: "2411070834521604900", priceCents: 999, inventoryQty: 300 },
      { name: "Black · 235x300cm For Four People", sku: "CJYD218581812LO", cjVid: "2411070834521605100", priceCents: 999, inventoryQty: 300 },
      { name: "Lake Blue Single · 90x140cm", sku: "CJYD218581813MN", cjVid: "2411070834521605200", priceCents: 999, inventoryQty: 300 },
      { name: "Lake Blue Double · 145x185cm", sku: "CJYD218581814NM", cjVid: "2411070834521605400", priceCents: 999, inventoryQty: 300 },
      { name: "Lake Blue Three People · 190x230cm", sku: "CJYD218581815OL", cjVid: "2411070834521605600", priceCents: 999, inventoryQty: 300 },
      { name: "Lake Blue · 235x300cm For Four People", sku: "CJYD218581816PK", cjVid: "2411070834521605800", priceCents: 999, inventoryQty: 300 },
      { name: "Wine Red Single · 90x140cm", sku: "CJYD218581817QJ", cjVid: "2411070834521605900", priceCents: 999, inventoryQty: 300 },
      { name: "Wine Red Double · 145x185cm", sku: "CJYD218581818RI", cjVid: "2411070834521606100", priceCents: 999, inventoryQty: 300 },
      { name: "Wine Red Three People · 190x230cm", sku: "CJYD218581819SH", cjVid: "2411070834521606300", priceCents: 999, inventoryQty: 300 },
      { name: "Wine Red · 235x300cm For Four People", sku: "CJYD218581820TG", cjVid: "2411070834521606500", priceCents: 999, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Cat Trees & Condos -- real supplier listing, CJ pid 2102735860725415937, supplier SKU CJTC3191298.
  { name: "Multi-functional cat tree house cat climbing frame, lounge and recreation area detachable toy, 54in",
    slug: "multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area", category: "Cat Trees & Condos",
    description: "Multi-functional cat tree house cat climbing frame, lounge and recreation area detachable toy, 54in is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nLightweight and easy to handle at around 6895 g.\n\nChoose the option that suits your pet - Beige, dark blue.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 12599, images: [`https://media.petparcel.store/products/00fcbf1e77e7d5d10555.webp`, `https://media.petparcel.store/products/f87fca44a7fe678bee4b.webp`, `https://media.petparcel.store/products/870283b6f4c48ec00b7e.webp`, `https://media.petparcel.store/products/ee7e6db852a3036cc842.webp`, `https://media.petparcel.store/products/3b7fa86e654966360207.webp`], tags: ["Cat Trees & Condos", "US warehouse"], featured: false, sortOrder: 112,
    variants: [
      { name: "Beige", sku: "CJTC31912980001", cjVid: "2102735860868022274", priceCents: 12599, inventoryQty: 300 },
      { name: "dark blue", sku: "CJTC31912980002", cjVid: "2102735860868022275", priceCents: 12599, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Furniture Tools -- real supplier listing, CJ pid 2095039409988558850, supplier SKU CJFT3120295.
  { name: "Heavy-Duty No-Drill 4-Story Cat Tree-Solid Wood Multi-Story Boards, Multi-Column Design, 55.9in Cat Tower With Open Condo, Double Space Capsules & Perch, Indoor Cat Furniture For Multi-Cat Families",
    slug: "heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum", category: "Pet Furniture Tools",
    description: "Stable structure with multi-column support 50 lbs per level, multi-column and thickened base reduce tipping risk, giving you peace of mind.\n\nLightweight and easy to handle at around 18000 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- No-drill design protects walls Freestanding structure requires no drilling, letting you use it safely in homes and rentals.\n- Neutral wood appearance fits home decor Natural wood finish matches various interior styles, saving you the trouble of mismatching.\n- Independent spaces for multi-cat households Open condo, capsules and perches reduce cat conflicts, letting you avoid mediating fights.\n- 360° viewing keeps cats calm Elevated perches and transparent capsules keep cats relaxed, preventing anxious destruction.",
    priceCents: 13699, images: [`https://media.petparcel.store/products/d280fc68466913d92ff5.webp`, `https://media.petparcel.store/products/fa0fcb6d37ce69aa3d5d.webp`, `https://media.petparcel.store/products/d1cbc3535ca65c8a7e2a.webp`, `https://media.petparcel.store/products/c819518da9fddb9f24e0.webp`, `https://media.petparcel.store/products/5ffe7771639f1ef50153.webp`], tags: ["Pet Furniture Tools", "US warehouse"], featured: false, sortOrder: 113,
    variants: [
      { name: "7018NATURAL", sku: "CJFT31202950001", cjVid: "2095039410294743041", priceCents: 13699, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Houses & Cages -- real supplier listing, CJ pid 2097113492712873985, supplier SKU CJHC3141292.
  { name: "2-Tier Cat Condo with Hammock",
    slug: "2-tier-cat-condo-with-hammock", category: "Pet Houses & Cages",
    description: "Cat Condo to Hammock: The 2-layer felt cat house can be seamlessly transformed from a semi-enclosed condo to a spacious hammock.\n\nLightweight and easy to handle at around 3552 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The convertible design corresponds to various feline preferences, accommodating both the desire for snug enclosures and the penchant for open resting areas.\n- Solid Bamboo Construction: The frame of the modern cat house is crafted from bamboo, which is celebrated for its robustness, easy maintenance and environmental sustainability.\n- Moreover, the natural finish exudes warm tone, which is dedicated to enhance the aesthetic appeal to your space.\n- All Season Felt Clothes: Crafted from premium felt cloth, the wood cat house offers exceptional breathability, maintaining a all-season comfortable environment for felines.",
    priceCents: 9199, images: [`https://media.petparcel.store/products/50a0a6b51a648f88d6e9.webp`, `https://media.petparcel.store/products/6d276684b4d892d86622.webp`, `https://media.petparcel.store/products/a086d1f24b2603da2d57.webp`, `https://media.petparcel.store/products/a4cdaed83d2152afb517.webp`, `https://media.petparcel.store/products/f1fbcf984588f08aedac.webp`], tags: ["Pet Houses & Cages", "US warehouse"], featured: false, sortOrder: 114,
    variants: [
      { name: "Standard", sku: "CJHC31412920001", cjVid: "2097113493576900609", priceCents: 9199, inventoryQty: 230 },
    ],
    reviews: [] },
  // -- Dog Stairs & Steps -- real supplier listing, CJ pid 2013438747630202882, supplier SKU CJDS2735425.
  { name: "Dog Ramp For Bed, Pet Ramp For Dogs With Non-Slip Carpet And Top Platform",
    slug: "dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform", category: "Dog Stairs & Steps",
    description: "Dog Ramp For Bed, Pet Ramp For Dogs With Non-Slip Carpet And Top Platform is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nLightweight and easy to handle at around 14000 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 19499, images: [`https://media.petparcel.store/products/6812b66734d6990a9f0b.webp`, `https://media.petparcel.store/products/d50f4a7625caa7afc5b8.webp`, `https://media.petparcel.store/products/e5b299037abfb2bd63d4.webp`, `https://media.petparcel.store/products/abff9f098bc4d7586122.webp`, `https://media.petparcel.store/products/da059929e2465bf66a86.webp`], tags: ["Dog Stairs & Steps", "US warehouse"], featured: false, sortOrder: 115,
    variants: [
      { name: "Natural Black", sku: "CJDS273542501AZ", cjVid: "2013438747781197826", priceCents: 19499, inventoryQty: 51 },
    ],
    reviews: [] },
  // -- Pet Tents -- real supplier listing, CJ pid 1961274945106653185, supplier SKU CJPT2471685.
  { name: "Pink-Blue Options -- 1Pc Portable Foldable Pet Tent Exercise Pen Kennel Removable Zipper Top And Bottom Water Resistant Indoor Outdoor Use For Dogs Cats Other Pets",
    slug: "pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable", category: "Pet Tents",
    description: "Features*: * Spacious & Comfort - Roomy 8-Panel design with protected seams and reinforced corners.\n\nBuilt to last: made from cloth, and it weighs around 1014 g.\n\nChoose the option that suits your pet - Blue, Pink.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Petluv dog playpen keeps your pet stay in this pet tent secure,spacious interior take more fun for your pet.\n- Premium Quality - Waterproof Oxford cloth is selected as the material,which is conducive to cleaning;All 9 surfaces are covered with mesh gauze,which effectively blocks direct sunlight and is comfortable and breathable.\n- Portable & Lightweight - It takes just seconds to Open from Folded.\n- It is great for indoors,outdoors,traveling,camping,and more!Ideal for travel purpose.",
    priceCents: 5599, images: [`https://media.petparcel.store/products/969f32f8c07945de5673.webp`, `https://media.petparcel.store/products/d8f658bbb7f39352cfea.webp`, `https://media.petparcel.store/products/7f41709d4d8c53f9f058.webp`, `https://media.petparcel.store/products/817485a2e735c99535bd.webp`, `https://media.petparcel.store/products/de3eebb872a40f4ea179.webp`], tags: ["Pet Tents", "US warehouse"], featured: false, sortOrder: 116,
    variants: [
      { name: "Blue", sku: "CJPT247168501AZ", cjVid: "1961274945618358274", priceCents: 5599, inventoryQty: 20 },
      { name: "Pink", sku: "CJPT247168502BY", cjVid: "1961274945618358275", priceCents: 5599, inventoryQty: 20 },
    ],
    reviews: [] },
  // -- Pet Hammocks -- real supplier listing, CJ pid 2008727317827907585, supplier SKU CJPH2716034.
  { name: "Weaved Cat Bed, Elevated Hand-woven Braided Banana Leaf Kitten House Condo With Cushion, Beige",
    slug: "weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with", category: "Pet Hammocks",
    description: "Weaved Cat Bed, Elevated Hand-woven Braided Banana Leaf Kitten House Condo With Cushion, Beige is a practical, hard-wearing pick built for restful downtime - one your pet will reach for every day.\n\nLightweight and easy to handle at around 5200 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 13099, images: [`https://media.petparcel.store/products/03bcd6ddafe7c4685461.webp`, `https://media.petparcel.store/products/7be197d0046a21ac8796.webp`, `https://media.petparcel.store/products/4c9bc06e75ac521e030f.webp`, `https://media.petparcel.store/products/585ec868f6fcb06f6f78.webp`, `https://media.petparcel.store/products/0f78a015d82db5968b48.webp`], tags: ["Pet Hammocks", "US warehouse"], featured: false, sortOrder: 117,
    variants: [
      { name: "Natural", sku: "CJPH271603401AZ", cjVid: "2008727318029234177", priceCents: 13099, inventoryQty: 4 },
    ],
    reviews: [] },
  // -- Pet Drinking & Feeding -- real supplier listing, CJ pid 2085834701740335105, supplier SKU CJPB3044751.
  { name: "Ceramic Pet Hamster Bowl, Brown",
    slug: "ceramic-pet-hamster-bowl-brown", category: "Pet Drinking & Feeding",
    description: "Ceramic Pet Hamster Bowl, Brown is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nLightweight and easy to handle at around 100 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 4399, images: [`https://media.petparcel.store/products/5f984da4124d29e4b81a.webp`, `https://media.petparcel.store/products/db69f03c62f6856c8e80.webp`, `https://media.petparcel.store/products/dd9ebebbeb63f84afad0.webp`, `https://media.petparcel.store/products/15eb399e099920a0bc4d.webp`, `https://media.petparcel.store/products/73953a526ab888cea388.webp`], tags: ["Pet Drinking & Feeding", "US warehouse"], featured: false, sortOrder: 118,
    variants: [
      { name: "BROWN", sku: "CJPB304475101AZ", cjVid: "2085834702012964865", priceCents: 4399, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Pet Bowls -- real supplier listing, CJ pid 2100408394892300290, supplier SKU CJPB3171846.
  { name: "Cordless Dog Cat Water Fountain 4.5L, Dual Tank Filtration Automatic Pet Water Dispenser with Easy Cleaning",
    slug: "cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water", category: "Pet Bowls",
    description: "Description & Features Description & Features Dual-Tank Filtration System: This automatic pet water dispenser features separate clean water and wastewater tanks with a self-refilling ceramic bowl.\n\nLightweight and easy to handle at around 2018 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The innovative circulation system continuously provides fresh, hygienic drinking water for your pets, ensuring they always have access to clean hydration.\n- Smart Automation Features: Utilizing advanced intelligent timing technology, this pet fountain offers customizable drainage cycles at 3/6/9-hour intervals.\n- User-Friendly Operation: Featuring simple button controls, this water station activates with a 3-5 second press and hold of the power button.\n- The intuitive interface allows easy water volume and refill timing adjustments through icon buttons, complemented by convenient remote control access for effortless settings management.",
    priceCents: 11899, images: [`https://media.petparcel.store/products/52abb3f30fe4cee828fd.webp`, `https://media.petparcel.store/products/1f55c3eef2264e6ce9b2.webp`, `https://media.petparcel.store/products/bade4cd033ca071a7598.webp`, `https://media.petparcel.store/products/2362bb379d7dae259e4a.webp`, `https://media.petparcel.store/products/81ef9de21db35c970af0.webp`], tags: ["Pet Bowls", "US warehouse"], featured: false, sortOrder: 119,
    variants: [
      { name: "as pic", sku: "CJPB31718460001", cjVid: "2100408395206873090", priceCents: 11899, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Drinking Tools -- real supplier listing, CJ pid 2105138981798735874, supplier SKU CJDT3211288.
  { name: "3in1 Dog Water Bottle With Mist Sprayer & Food Storage, Portable Pet Travel Water Dispenser For Walking Hiking Camping",
    slug: "3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water", category: "Pet Drinking Tools",
    description: "Cut down your pet gear for walks, camping and road trips.\n\nLightweight and easy to handle at around 300 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- ONE-BUTTON WATER DISPENSER: Easily release fresh water into the wide drinking trough.\n- Dirty water won't flow back into the clean water tank for safe hydration.\n- FOLD-OUT DRINKING TROUGH: Extended drinking tray fits different dog & cat muzzles.\n- Fold flat after use to save space in backpacks or car storage.",
    priceCents: 4199, images: [`https://media.petparcel.store/products/f7259b82bc721015ee33.webp`, `https://media.petparcel.store/products/84f6e89c10a7aae9fb8b.webp`, `https://media.petparcel.store/products/911932c6c6016e9074cf.webp`, `https://media.petparcel.store/products/f4c4c85436197d6305ab.webp`, `https://media.petparcel.store/products/171e23949872434af977.webp`], tags: ["Pet Drinking Tools", "US warehouse"], featured: false, sortOrder: 120,
    variants: [
      { name: "Green", sku: "CJDT321128801AZ", cjVid: "2105138981928759297", priceCents: 4199, inventoryQty: 32 },
    ],
    reviews: [] },
  // -- Pet Feeding Tools -- real supplier listing, CJ pid 2091933790564667393, supplier SKU CJFT3092274.
  { name: "Portable Dog Water Bottle With Food Container & Filter, Travel Drinking Bottle For Pets",
    slug: "portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo", category: "Pet Feeding Tools",
    description: "Dog Water Bottle & Treat Container: Compare with the common dog water bottle, there is a 100g food container closely attach to the bowl of water bottle.\n\nLightweight and easy to handle at around 200 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- ALWAYS REMEMBER to turn the lock to right after use.\n- All operations can be finished by one hand, easy to use Safe and Heat Resistant Material & Widely Uses: The dog water bottle is made of food grade ABS+PC, BPA free material.\n- 250℉/121℃ affordable and dishwasher safe.\n- It's suitable for walking, travelling, picnic, camping, hiking, training with your pets.",
    priceCents: 8599, images: [`https://media.petparcel.store/products/b8209aa4a3e5318a4067.webp`, `https://media.petparcel.store/products/b8a34826562b88707451.webp`, `https://media.petparcel.store/products/7c3e8940ba3288852be2.webp`, `https://media.petparcel.store/products/d7642051e25b233bfd62.webp`, `https://media.petparcel.store/products/dcdb0d45184b170a2e39.webp`], tags: ["Pet Feeding Tools", "US warehouse"], featured: false, sortOrder: 121,
    variants: [
      { name: "Blue", sku: "CJFT309227401AZ", cjVid: "2091933790740828162", priceCents: 8599, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Fish & Aquatic Pets -- real supplier listing, CJ pid 1991063483994267649, supplier SKU CJFT2607374.
  { name: "Fish Tank Ozone Machine Fish Pond Ozone Generator Sterilization Device For Aquariums O3",
    slug: "fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu", category: "Fish & Aquatic Pets",
    description: "Algae removal, green/yellow water treatment,.\n\nLightweight and easy to handle at around 450 g.\n\nChoose the option that suits your pet - US ZY 0Z, European ZY OZ.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 2899, images: [`https://media.petparcel.store/products/254291cffbc7279af19b.webp`, `https://media.petparcel.store/products/98795ed21fd26f03200f.webp`, `https://media.petparcel.store/products/1fd6e97b4af34f10a6d4.webp`, `https://media.petparcel.store/products/e01b1d4429181f1326a5.webp`, `https://media.petparcel.store/products/e107dd165fb11d0df202.webp`], tags: ["Fish & Aquatic Pets", "Tracking"], featured: false, sortOrder: 122,
    variants: [
      { name: "US ZY 0Z", sku: "CJFT260737401AZ", cjVid: "1991063484048793601", priceCents: 2899, inventoryQty: 300 },
      { name: "European ZY OZ", sku: "CJFT260737402BY", cjVid: "1991063484048793602", priceCents: 2899, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Fish Tanks -- real supplier listing, CJ pid 1992918515617394690, supplier SKU CJFT2616973.
  { name: "Canvas Fish Pond Above Ground Koi Tank 126.8 Gal With Clear Viewing Panel",
    slug: "canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel", category: "Fish Tanks",
    description: "High-Quality Materials: Made with reinforced 0.9 mm triple-layer PVC scraper cloth and 1.2 mm high-transparency PVC, this canvas fish pond is durable, sun-resistant, and tear-resistant.\n\nLightweight and easy to handle at around 9250 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- It offers clear visibility and is wear-resistant and scratch-resistant, with a seamless design to avoid leaks.\n- Sturdy Structure: The above-ground fish pond features high-strength stainless steel pipes that are rust-resistant and corrosion-resistant.\n- Its strong, stable frame ensures that it remains intact and holds its shape, even when full of water, ensuring long-term durability.\n- Quick Drainage: With a large drainage valve, this fish pond allows quick water release with a simple turn, saving time and making maintenance more convenient.",
    priceCents: 16399, images: [`https://media.petparcel.store/products/ea0bd19daf7f27524642.webp`, `https://media.petparcel.store/products/cb983c35cc6ba3f8925a.webp`, `https://media.petparcel.store/products/703e472260918488c2b3.webp`, `https://media.petparcel.store/products/96ce3a15138f3744576e.webp`, `https://media.petparcel.store/products/1e0a0f6faa34c858d92a.webp`], tags: ["Fish Tanks", "US warehouse"], featured: false, sortOrder: 123,
    variants: [
      { name: "Black", sku: "CJFT26169730001", cjVid: "1992918515701280770", priceCents: 16399, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Fish Tank Decorations -- real supplier listing, CJ pid 2070783384532987905, supplier SKU CJTD2957968.
  { name: "Floating Frog On Swim Ring Resin Aquarium Ornament, Fish Tank Decor, Water Surface Accessory",
    slug: "floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa", category: "Fish Tank Decorations",
    description: "Floating Frog On Swim Ring Resin Aquarium Ornament, Fish Tank Decor, Water Surface Accessory is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nLightweight and easy to handle at around 200 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 899, images: [`https://media.petparcel.store/products/71e162ac252060020a22.webp`, `https://media.petparcel.store/products/8a338dca06fd94325abe.webp`, `https://media.petparcel.store/products/2b69615fc9b52f8d63c4.webp`, `https://media.petparcel.store/products/c0914f94c5e2149c4121.webp`, `https://media.petparcel.store/products/8525f7a116f1cc0c0e0d.webp`], tags: ["Fish Tank Decorations", "Tracking"], featured: false, sortOrder: 124,
    variants: [
      { name: "Green", sku: "CJTD295796801AZ", cjVid: "2070783384616873985", priceCents: 899, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Fish Tank Cleaning Supplies -- real supplier listing, CJ pid 1961255727572742145, supplier SKU CJTC2471558.
  { name: "1Pc 3-Stage External Canister Filter For Aquarium Fish Tank With 600L-H Flow Rate 35.4in Max Height 6W Easy Installation Silent",
    slug: "1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r", category: "Fish Tank Cleaning Supplies",
    description: "1Pc 3-Stage External Canister Filter For Aquarium Fish Tank With 600L-H Flow Rate 35.4in Max Height 6W Easy Installation Silent is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from plastic, and it weighs around 2042 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 10299, images: [`https://media.petparcel.store/products/170586a0a98af9806e01.webp`, `https://media.petparcel.store/products/7385d3f629435f289b02.webp`, `https://media.petparcel.store/products/560d09de87c6bf3a8095.webp`, `https://media.petparcel.store/products/3503e13069a9e746a8b1.webp`, `https://media.petparcel.store/products/ce0ea1f68031e5e9172d.webp`], tags: ["Fish Tank Cleaning Supplies", "US warehouse"], featured: false, sortOrder: 125,
    variants: [
      { name: "L", sku: "CJTC247155801AZ", cjVid: "1961255727648239618", priceCents: 10299, inventoryQty: 11 },
    ],
    reviews: [] },
  // -- Pet Collars, Harnesses & Accessories -- real supplier listing, CJ pid 2080039753131929602, supplier SKU CJBT2999818.
  { name: "Small Dog Collar Harness And Leash Set, Dog Harness No Pull With Bowtie, Breathable Cotton Adjustable Pet Puppy",
    slug: "small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha", category: "Pet Collars, Harnesses & Accessories",
    description: "Premium Breathable Cotton Material Made of soft, lightweight cotton fabric with excellent air permeability, this dog harness and leash set keeps your pet cool and dry during extended wear.\n\nBuilt to last: made from cloth, and it weighs around 270 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The skin-friendly, gentle material ensures comfort for daily use, making our dog collars, harnesses & leashes not only durable but also ideal for long-time outdoor activities without skin irritation.\n- Thoughtful Dual Sizes with Adjustable Fit Designed in S and M sizes to fit most small and medium breeds, both the dog harness and collar come with fully adjustable straps for a secure, personalized fit.\n- 22.3 in, Leash 59.1 inYou can easily adjust the tightness for comfort without slipping or constriction.\n- No-Pull, Comfortable & Safe Design Featuring a dog harness no pull and easy walk dog harness structure, the step-in design evenly distributes pulling force across the chest to avoid neck strain and choking.",
    priceCents: 6899, images: [`https://media.petparcel.store/products/f95a8d97fd5c2f1acfd1.webp`, `https://media.petparcel.store/products/ff7852b848a9ce9db360.webp`, `https://media.petparcel.store/products/efc1412c15b30300dab3.webp`, `https://media.petparcel.store/products/0a93757797cf7c758584.webp`, `https://media.petparcel.store/products/98c13c6aec4fb3807fa2.webp`], tags: ["Pet Collars, Harnesses & Accessories", "US warehouse"], featured: false, sortOrder: 126,
    variants: [
      { name: "PINK", sku: "CJBT299981801AZ", cjVid: "2080039753274535937", priceCents: 6899, inventoryQty: 48 },
    ],
    reviews: [] },
  // -- Pet Hair Accessories -- real supplier listing, CJ pid 2053070122767724546, supplier SKU CJHA2875792.
  { name: "Pet Fur Memory Charm Leather Keychain Keepsake For Dog Cat Hair Paw-Shaped Design Memorial Sympathy Gift For Grieving Owners",
    slug: "pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des", category: "Pet Hair Accessories",
    description: "Pet Fur Memory Charm Leather Keychain Keepsake For Dog Cat Hair Paw-Shaped Design Memorial Sympathy Gift For Grieving Owners is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from plastic and leather, and it weighs around 24 g.\n\nChoose the option that suits your pet - Pink, Yellow, Brown, Black, Red.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1799, images: [`https://media.petparcel.store/products/193d5b57096d8f69e334.webp`, `https://media.petparcel.store/products/d7da1d75c8730f29bb11.webp`, `https://media.petparcel.store/products/10c3f59490b2136a9151.webp`, `https://media.petparcel.store/products/f56ed58478c8e942b6e0.webp`, `https://media.petparcel.store/products/b3cb3abed45977fdada9.webp`], tags: ["Pet Hair Accessories", "US warehouse"], featured: false, sortOrder: 127,
    variants: [
      { name: "Pink", sku: "CJHA287579201AZ", cjVid: "2053070122889359362", priceCents: 1799, inventoryQty: 100 },
      { name: "Yellow", sku: "CJHA287579202BY", cjVid: "2053070122889359363", priceCents: 1799, inventoryQty: 100 },
      { name: "Brown", sku: "CJHA287579203CX", cjVid: "2053070122889359364", priceCents: 1799, inventoryQty: 100 },
      { name: "Black", sku: "CJHA287579204DW", cjVid: "2053070122889359365", priceCents: 1799, inventoryQty: 100 },
      { name: "Red", sku: "CJHA287579205EV", cjVid: "2053070122889359366", priceCents: 1799, inventoryQty: 100 },
    ],
    reviews: [] },
  // -- Pet Bows & Ties -- real supplier listing, CJ pid 2082183063620857857, supplier SKU CJBT3015319.
  { name: "4Pcs Dog Hair Bow Headband For Small Medium Dogs, Adjustable Pet Dog Hair Bow Headband For Pets Puppy Cats Grooming Accessories",
    slug: "4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h", category: "Pet Bows & Ties",
    description: "Novel and Adorable Design: The package comes with 4 pieces of dog bow headbands.\n\nBuilt to last: made from cloth, and it weighs around 50 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Add a touch of cuteness to your furry friend's day with this set of 4 soft, plush dog headbands.\n- Each one features a classic bow in vibrant blue,black, red, and pink.\n- Perfect for everyday wear, photo,also in Christmas, Halloween, Thansgiving, Valentine's Day.\n- Suitable Size: The size of dog hair bow headband is 3.15*4.53 inch.",
    priceCents: 5499, images: [`https://media.petparcel.store/products/ed45b4482c1f4e1ecf64.webp`, `https://media.petparcel.store/products/b941f0a9be5f0f718613.webp`, `https://media.petparcel.store/products/1e59efc4a70648a4eb8b.webp`, `https://media.petparcel.store/products/d7f867bb5f31fdafc414.webp`, `https://media.petparcel.store/products/72b98a85f47cfe45be21.webp`], tags: ["Pet Bows & Ties", "US warehouse"], featured: false, sortOrder: 128,
    variants: [
      { name: "MULTICOLOR", sku: "CJBT301531901AZ", cjVid: "2082183063763464194", priceCents: 5499, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Pet Necklaces -- real supplier listing, CJ pid 2082229584768839681, supplier SKU CJPN3015344.
  { name: "Dog Collar White And Pink Love Heart With Pendant Cute Dog Collar",
    slug: "dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar", category: "Pet Necklaces",
    description: "We have a choice of large, medium and small sizes for adult dogs and puppies or growing dogs.\n\nBuilt to last: made from cloth, and it weighs around 100 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 5499, images: [`https://media.petparcel.store/products/fd2e2cb4f2c474e1f799.webp`, `https://media.petparcel.store/products/6374ad0ace96137591fd.webp`, `https://media.petparcel.store/products/5d5ff699508d161ae205.webp`, `https://media.petparcel.store/products/5b7999eea75309a2a1dd.webp`, `https://media.petparcel.store/products/332d338414795ef43614.webp`], tags: ["Pet Necklaces", "US warehouse"], featured: false, sortOrder: 129,
    variants: [
      { name: "MULTICOLOR", sku: "CJPN301534401AZ", cjVid: "2082229584928223234", priceCents: 5499, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Pet Headwears -- real supplier listing, CJ pid 2503150220031613800, supplier SKU CJYD2328135.
  { name: "Dog Accessories Photo Concave Shape Pumpkin Hat",
    slug: "dog-accessories-photo-concave-shape-pumpkin-hat", category: "Pet Headwears",
    description: "Dog Accessories Photo Concave Shape Pumpkin Hat is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from leather and cloth, and it weighs around 45.00 g.\n\nChoose the option that suits your pet - Black S 12.5cm, Black M 14cm, Beige S 12.5cm, Beige M 14cm, Red S 12.5cm, Red M 14cm, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1399, images: [`https://media.petparcel.store/products/67b06431c4818d1de563.webp`, `https://media.petparcel.store/products/744ce932c99efa636b6f.webp`, `https://media.petparcel.store/products/fc8d88718218c57fa6e9.webp`, `https://media.petparcel.store/products/de20203d03b4cc48bd43.webp`, `https://media.petparcel.store/products/145925606be5e1784fd8.webp`], tags: ["Pet Headwears", "Tracking"], featured: false, sortOrder: 130,
    variants: [
      { name: "Black · S 12.5cm", sku: "CJYD232813501AZ", cjVid: "2503150220031614100", priceCents: 1399, inventoryQty: 300 },
      { name: "Black · M 14cm", sku: "CJYD232813502BY", cjVid: "2503150220031614200", priceCents: 1399, inventoryQty: 300 },
      { name: "Beige · S 12.5cm", sku: "CJYD232813503CX", cjVid: "2503150220031614400", priceCents: 1399, inventoryQty: 300 },
      { name: "Beige · M 14cm", sku: "CJYD232813504DW", cjVid: "2503150220031614600", priceCents: 1399, inventoryQty: 300 },
      { name: "Red · S 12.5cm", sku: "CJYD232813505EV", cjVid: "2503150220031614700", priceCents: 1399, inventoryQty: 300 },
      { name: "Red · M 14cm", sku: "CJYD232813506FU", cjVid: "2503150220031614900", priceCents: 1399, inventoryQty: 300 },
      { name: "Brown · S 12.5cm", sku: "CJYD232813507GT", cjVid: "2503150220031615100", priceCents: 1399, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Glasses -- real supplier listing, CJ pid 2084490822904827906, supplier SKU CJPG3033851.
  { name: "Pet Protection Small Doggles Dog Sunglasses Pet Goggles UV Sun Glasses Eye Wear Adjustable",
    slug: "pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea", category: "Pet Glasses",
    description: "Features Material Made of premium PC and plastic, sturdy and durable to use.\n\nBuilt to last: made from plastic, and it weighs around 88 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Adjustable Foldable Frame Eyeglasses frame is made of elastic band, adjustable and foldable, easy to wear and storage, for your pet's comfy wearing.\n- Soft pad on the goggles rim back, mild touch on your pet's hair and skin.\n- UV Proof,Wind Proof & Dust Proof Not only a decorative pet glasses but also filter out harmful UV rays, protect your pet's eyes from hurtful sunlight, wind, dust and dirt.\n- Fit for Small and Medium Pets Kindly know that this pet glasses is fit for small size pets like puppies or kittens, please check the size for your cutie pet before purchase.",
    priceCents: 2399, images: [`https://media.petparcel.store/products/64f70a235e49aa7ab249.webp`, `https://media.petparcel.store/products/58917cfa67d2641e229d.webp`, `https://media.petparcel.store/products/a58eb471f65ab361689a.webp`, `https://media.petparcel.store/products/5de019be4a70293f5c97.webp`, `https://media.petparcel.store/products/0827ee809fb25856d3e6.webp`], tags: ["Pet Glasses", "US warehouse"], featured: false, sortOrder: 131,
    variants: [
      { name: "1 pack", sku: "CJPG303385101AZ", cjVid: "2084490823043239937", priceCents: 2399, inventoryQty: 96 },
    ],
    reviews: [] },
  // -- Pet Collars -- real supplier listing, CJ pid 2105212766864125953, supplier SKU CJPC3212367.
  { name: "3-in-1 Anti-Bark Dog Collar, Dog Training Collar With Vibration.",
    slug: "3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration", category: "Pet Collars",
    description: "Anti Bark Dog Collar with Beep and Vibration, 7 Sensitivity Levels, Adjustable Reflective Nylon Strap for Dogs, 20-55 cm Progressive Beep and Vibration Training: The collar uses a step-by-step response system.\n\nLightweight and easy to handle at around 86 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The first activations provide warning beeps, followed by combinations of sound and vibration if barking continues.\n- 7 Sensitivity Levels: Features seven manually adjustable sensitivity settings, allowing you to select a suitable response level according to your dog and environment.\n- Automatic Safety Pause: After repeated activation, the collar enters a 1-minute sleep mode before becoming active again, helping prevent continuous stimulation.\n- Adjustable Reflective Collar: Includes an adjustable nylon strap measuring approximately 20 to 55 cm, suitable for different dog sizes.",
    priceCents: 4399, images: [`https://media.petparcel.store/products/acced887e3dbb2a76f3c.webp`, `https://media.petparcel.store/products/1f82c8b9d63295825166.webp`, `https://media.petparcel.store/products/e29048394811c57c4ee1.webp`, `https://media.petparcel.store/products/868966c8496e9daee0d3.webp`, `https://media.petparcel.store/products/e319cded24babb710e74.webp`], tags: ["Pet Collars", "Tracking"], featured: false, sortOrder: 132,
    variants: [
      { name: "As shown", sku: "CJPC32123670001", cjVid: "2105212767015120897", priceCents: 4399, inventoryQty: 189 },
    ],
    reviews: [] },
  // -- Pet Leashes -- real supplier listing, CJ pid 1996510667392868354, supplier SKU CJPL2631654.
  { name: "Ground Stake Fixed Dog Leash Allows Your Beloved Dog To Play More Freely",
    slug: "ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely", category: "Pet Leashes",
    description: "In outdoor scenarios such as lawns and campsites, simply drive the accompanying ground stake firmly into the ground to quickly secure the leash, without relying on fixed objects like trees or railings.\n\nLightweight and easy to handle at around 400 g.\n\nChoose the option that suits your pet - Fluorescent green-9M, Navy blue-9M, Purple-9M, Bright yellow-9M, Orange-9M.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The installation is convenient and stable.\n- Once fixed, your dog can move freely within the designated safe range, avoiding the trouble of the leash getting tangled and freeing the owner from holding the leash at all times, providing more peace of mind while.\n- The leash features an extended design of 30 feet (approximately 9.14 meters), providing ample space for your dog to move around.\n- Whether running, playing, or strolling leisurely, your dog can stretch freely, completely getting rid of the sense of constraint caused by a small activity range.",
    priceCents: 2699, images: [`https://media.petparcel.store/products/ca1ffc93ec11942bb15f.webp`, `https://media.petparcel.store/products/718c33a1fd8ea70945fe.webp`, `https://media.petparcel.store/products/bc8aa508fc45f10f436b.webp`, `https://media.petparcel.store/products/39cf891b6c19d750cd77.webp`, `https://media.petparcel.store/products/37f46760994e4cf40922.webp`], tags: ["Pet Leashes", "US warehouse"], featured: false, sortOrder: 133,
    variants: [
      { name: "Fluorescent green-9M", sku: "CJPL263165401AZ", cjVid: "1996510667518697473", priceCents: 2699, inventoryQty: 120 },
      { name: "Navy blue-9M", sku: "CJPL263165402BY", cjVid: "1996510667518697474", priceCents: 2699, inventoryQty: 120 },
      { name: "Purple-9M", sku: "CJPL263165403CX", cjVid: "1996510667518697475", priceCents: 2699, inventoryQty: 120 },
      { name: "Bright yellow-9M", sku: "CJPL263165404DW", cjVid: "1996510667518697476", priceCents: 2699, inventoryQty: 120 },
      { name: "Orange-9M", sku: "CJPL263165405EV", cjVid: "1996510667518697477", priceCents: 2699, inventoryQty: 120 },
    ],
    reviews: [] },
  // -- Pet Harnesses -- real supplier listing, CJ pid 1935996841896681474, supplier SKU CJPH2407139.
  { name: "Tactical Service Dog Harness Vest, Adjustable Reflective Dog Harness with Metal Buckle for Hiking Training",
    slug: "tactical-service-dog-harness-vest-adjustable", category: "Pet Harnesses",
    description: "Comfortable, adjustable, durable, breathable.\n\nBuilt to last: made from cloth, and it weighs around 350 g.\n\nChoose the option that suits your pet - Pink-S, Pink-M, Pink-L, Pink-XL, Black-S, Black-M, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Packaging and shipping information.\n- Gross weight of a single product.",
    priceCents: 4399, images: [`https://media.petparcel.store/products/cc58b4c5b7f97bcc2d32.webp`, `https://media.petparcel.store/products/8979f60f154b14a4984f.webp`, `https://media.petparcel.store/products/03ffeeb9bc63ab3fc902.webp`, `https://media.petparcel.store/products/23da02fb5fea0e8c64c6.webp`, `https://media.petparcel.store/products/286af9c1d4be8b14d7a2.webp`], tags: ["Pet Harnesses", "US warehouse"], featured: false, sortOrder: 134,
    variants: [
      { name: "Pink-S", sku: "CJPH240713901AZ", cjVid: "1935996842014121985", priceCents: 4399, inventoryQty: 200 },
      { name: "Pink-M", sku: "CJPH240713902BY", cjVid: "1935996842014121986", priceCents: 4399, inventoryQty: 200 },
      { name: "Pink-L", sku: "CJPH240713903CX", cjVid: "1935996842014121987", priceCents: 4399, inventoryQty: 200 },
      { name: "Pink-XL", sku: "CJPH240713904DW", cjVid: "1935996842014121988", priceCents: 4399, inventoryQty: 200 },
      { name: "Black-S", sku: "CJPH240713905EV", cjVid: "1935996842014121989", priceCents: 4399, inventoryQty: 200 },
      { name: "Black-M", sku: "CJPH240713906FU", cjVid: "1935996842014121990", priceCents: 4399, inventoryQty: 200 },
      { name: "Black-L", sku: "CJPH240713907GT", cjVid: "1935996842014121991", priceCents: 4399, inventoryQty: 200 },
      { name: "Black-XL", sku: "CJPH240713908HS", cjVid: "1935996842014121992", priceCents: 4399, inventoryQty: 200 },
      { name: "Tan-S", sku: "CJPH240713909IR", cjVid: "1935996842014121993", priceCents: 4399, inventoryQty: 200 },
      { name: "Tan-M", sku: "CJPH240713910JQ", cjVid: "1935996842014121994", priceCents: 4399, inventoryQty: 200 },
      { name: "Tan-XL", sku: "CJPH240713912LO", cjVid: "1935996842014121996", priceCents: 4399, inventoryQty: 200 },
      { name: "GrayCamo-S", sku: "CJPH240713913MN", cjVid: "1935996842014121997", priceCents: 4399, inventoryQty: 200 },
      { name: "GrayCamo-M", sku: "CJPH240713914NM", cjVid: "1935996842014121998", priceCents: 4399, inventoryQty: 200 },
    ],
    reviews: [] },
  // -- Pet Muzzles -- real supplier listing, CJ pid 2509070828311601300, supplier SKU CJYD2490986.
  { name: "Dog Mouth Cover Golden RetrieverGerman Shepherd Dedicated",
    slug: "dog-mouth-cover-golden-retrievergerman-shepherd-dedicated", category: "Pet Muzzles",
    description: "Dog Mouth Cover Golden RetrieverGerman Shepherd Dedicated is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from metal and leather, and it weighs around 250.00 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1299, images: [`https://media.petparcel.store/products/39bd7b0bee482b6e4fe7.webp`, `https://media.petparcel.store/products/2691e6815f7585406213.webp`, `https://media.petparcel.store/products/b0fddbd7c559811727fe.webp`, `https://media.petparcel.store/products/94d0fd35496b110f98da.webp`, `https://media.petparcel.store/products/039fe0b4bcc9ca9a65c5.webp`], tags: ["Pet Muzzles", "Tracking"], featured: false, sortOrder: 135,
    variants: [
      { name: "Black", sku: "CJYD249098601AZ", cjVid: "2509070828311602300", priceCents: 1299, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Collar, Leash & Harness Sets -- real supplier listing, CJ pid 2102113626738282497, supplier SKU CJPC3185008.
  { name: "No Pull Dog Harness, Collar & Leash Set, Adjustable Pet Walking Set With Travel Accessories For Dogs",
    slug: "no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac", category: "Pet Collar, Leash & Harness Sets",
    description: "Make everyday walks and outdoor adventures more convenient with this no-pull dog harness, collar, and leash set.\n\nLightweight and easy to handle at around 250 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Designed as a practical walking solution, the set includes essential accessories to help keep your dog comfortably equipped while you're out for walks, trips, and other activities.\n- The adjustable harness and collar allow for a more personalized fit, while the matching leash provides convenient control during outdoor walks.\n- The coordinated design also makes it easy to keep your pet's walking essentials together.\n- This set is suitable for daily walks, neighborhood outings, park visits, travel, training sessions, and outdoor adventures.",
    priceCents: 14099, images: [`https://media.petparcel.store/products/8999990ee21790d76be7.webp`, `https://media.petparcel.store/products/a798f8b5f653b8313be9.webp`, `https://media.petparcel.store/products/0ce6f450fe673d425265.webp`, `https://media.petparcel.store/products/12c243e56509ead0880c.webp`, `https://media.petparcel.store/products/c5d5e846ab5d020a5df0.webp`], tags: ["Pet Collar, Leash & Harness Sets", "US warehouse"], featured: false, sortOrder: 136,
    variants: [
      { name: "BLACK", sku: "CJPC318500801AZ", cjVid: "2102113626981552130", priceCents: 14099, inventoryQty: 76 },
    ],
    reviews: [] },
  // -- Custom Pet tags -- real supplier listing, CJ pid 1751074410796163072, supplier SKU CJGX1957824.
  { name: "Dog Collar Engraved With Lettering To Prevent Loss Of Neck Collar",
    slug: "dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar", category: "Custom Pet tags",
    description: "Dog Collar Engraved With Lettering To Prevent Loss Of Neck Collar is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from leather, and it weighs around 150.00 g.\n\nChoose the option that suits your pet - Red XS, Red S, Red M, Red L, Red XL, Grey XS, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1099, images: [`https://media.petparcel.store/products/fe15ce7f8fdcb8558a31.webp`, `https://media.petparcel.store/products/7cf00a4d72becce6444b.webp`, `https://media.petparcel.store/products/c10841f9b7cce09f6b86.webp`, `https://media.petparcel.store/products/b3368a3021e1758cc84e.webp`, `https://media.petparcel.store/products/b1ef9512b77229499a7c.webp`], tags: ["Custom Pet tags", "Tracking"], featured: false, sortOrder: 137,
    variants: [
      { name: "Red · XS", sku: "CJGX195782401AZ", cjVid: "1751074410913603584", priceCents: 1099, inventoryQty: 300 },
      { name: "Red · S", sku: "CJGX195782402BY", cjVid: "1751074410989101056", priceCents: 1099, inventoryQty: 300 },
      { name: "Red · M", sku: "CJGX195782403CX", cjVid: "1751074411064598528", priceCents: 1099, inventoryQty: 300 },
      { name: "Red · L", sku: "CJGX195782404DW", cjVid: "1751074411135901696", priceCents: 1099, inventoryQty: 300 },
      { name: "Red · XL", sku: "CJGX195782405EV", cjVid: "1751074411223982080", priceCents: 1099, inventoryQty: 300 },
      { name: "Grey · XS", sku: "CJGX195782406FU", cjVid: "1751074411295285248", priceCents: 1099, inventoryQty: 300 },
      { name: "Grey · S", sku: "CJGX195782407GT", cjVid: "1751074411366588416", priceCents: 1099, inventoryQty: 300 },
      { name: "Grey · M", sku: "CJGX195782408HS", cjVid: "1751074411437891584", priceCents: 1099, inventoryQty: 300 },
      { name: "Grey · L", sku: "CJGX195782409IR", cjVid: "1751074411509194752", priceCents: 1099, inventoryQty: 300 },
      { name: "Grey · XL", sku: "CJGX195782410JQ", cjVid: "1751074411584692224", priceCents: 1099, inventoryQty: 300 },
      { name: "Green · XS", sku: "CJGX195782411KP", cjVid: "1751074411655995392", priceCents: 1099, inventoryQty: 300 },
      { name: "Green · S", sku: "CJGX195782412LO", cjVid: "1751074411727298560", priceCents: 1099, inventoryQty: 300 },
      { name: "Green · M", sku: "CJGX195782413MN", cjVid: "1751074411798601728", priceCents: 1099, inventoryQty: 300 },
      { name: "Green · L", sku: "CJGX195782414NM", cjVid: "1751074411869904896", priceCents: 1099, inventoryQty: 300 },
      { name: "Green · XL", sku: "CJGX195782415OL", cjVid: "1751074411957985280", priceCents: 1099, inventoryQty: 300 },
      { name: "Brown · XS", sku: "CJGX195782416PK", cjVid: "1751074412033482752", priceCents: 1099, inventoryQty: 300 },
      { name: "Brown · S", sku: "CJGX195782417QJ", cjVid: "1751074412104785920", priceCents: 1099, inventoryQty: 300 },
      { name: "Brown · M", sku: "CJGX195782418RI", cjVid: "1751074412176089088", priceCents: 1099, inventoryQty: 300 },
      { name: "Brown · L", sku: "CJGX195782419SH", cjVid: "1751074412247392256", priceCents: 1099, inventoryQty: 300 },
      { name: "Brown · XL", sku: "CJGX195782420TG", cjVid: "1751074412318695424", priceCents: 1099, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Toys -- real supplier listing, CJ pid 1966043508778242050, supplier SKU CJCT2527401.
  { name: "650nm Red Laser Pointer Pen Light Visible Single Beam AAA Lazer Torch 10PCS 9900 Miles Mini Small Teaching Pen Light Pet Toys",
    slug: "650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99", category: "Pet Toys",
    description: "Features 650nm Red Ray Red Laser Pointer Pen Utilization of the latest crystal technology and optics creates this high quality;pen-sized laser pointer.\n\nLightweight and easy to handle at around 146 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- It emits an intense,brilliant laser beam,Use your Laser Pointer to aim at any desired targets on projection screens,video monitors,presentation.\n- Press the push button to turn it on,release the push button to shut if off automatically.\n- Laser radiation is potentially harmful!\n- Keep out of reach of children Package Includes 10x Red Laser Pen.",
    priceCents: 3499, images: [`https://media.petparcel.store/products/98031d70c723d41452b7.webp`, `https://media.petparcel.store/products/74db501741fc970a6a54.webp`, `https://media.petparcel.store/products/bd55671c97260fc832f1.webp`, `https://media.petparcel.store/products/fd50bc60bba32f168f48.webp`, `https://media.petparcel.store/products/9138bb545fffffdb5ce1.webp`], tags: ["Pet Toys", "US warehouse"], featured: false, sortOrder: 138,
    variants: [
      { name: "Red", sku: "CJCT252740101AZ", cjVid: "1966043508849545218", priceCents: 3499, inventoryQty: 25 },
    ],
    reviews: [] },
  // -- Pet Chase Toys -- real supplier listing, CJ pid 2080726616541650946, supplier SKU CJCT3005962.
  { name: "Pet Cat Tunnel Tube Toys 3 Way Collapsible, Tunnels For Indoor Cats, Interactive Tube With Teaser Wand, Peek Holes",
    slug: "pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive", category: "Pet Chase Toys",
    description: "Best Ways to Play: Our cat tunnel with 3 spacious tunnels, peephole & ball toy, this popular cat toy gives your kitty more ways to have fun.\n\nLightweight and easy to handle at around 200 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Provides hours of exercise & self-amusement.\n- This cat tunnel is more suitable for kittens and is made of polyester material.\n- Durable Construction: This cat tunnels for indoor cats use polyester fabric material design, not easy to scratch, sturdy spring steel frame, with protective end, Can play hide and seek game.\n- Collapsible & portable: Our cat tunnel folds down small in seconds for easy travel and storage.",
    priceCents: 5099, images: [`https://media.petparcel.store/products/bdbd5981d5ebc848e6a4.webp`, `https://media.petparcel.store/products/f5deed108b36ae889391.webp`, `https://media.petparcel.store/products/0c68800ae1b80b89d12f.webp`, `https://media.petparcel.store/products/b258060593689a1fea34.webp`, `https://media.petparcel.store/products/93b848c9e582c4a10b56.webp`], tags: ["Pet Chase Toys", "US warehouse"], featured: false, sortOrder: 139,
    variants: [
      { name: "BLACK", sku: "CJCT300596201AZ", cjVid: "2080726616663285762", priceCents: 5099, inventoryQty: 49 },
    ],
    reviews: [] },
  // -- Pet Chew Toys -- real supplier listing, CJ pid 2104846016072171522, supplier SKU CJCT3209072.
  { name: "5 Pack Vegetable Catnip Plush Toys, Cute Kicker Chew Toys For Indoor Cats",
    slug: "5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats", category: "Pet Chew Toys",
    description: "Adorable smiling faces attract your cat's interest instantly.\n\nLightweight and easy to handle at around 100 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Filled with Catnip: Built-in natural catnip inside each toy to stimulate cats' playful instinct, great for kicking, biting, wrestling and relieving boredom.\n- Soft & Durable Fabric: Made of premium plush material, safe for cats to chew.\n- Stitched firmly for long-time daily play.\n- Stress Relief for Indoor Cats: Perfect kicker toy satisfies cats' hunting instinct, helps reduce anxiety and destructive behavior.",
    priceCents: 2799, images: [`https://media.petparcel.store/products/23e11d6a2584e033d527.webp`, `https://media.petparcel.store/products/c3ff85f9081b601fdda5.webp`, `https://media.petparcel.store/products/dd6ddfb54ff0239bce76.webp`, `https://media.petparcel.store/products/55890c312b7fcb6bcc44.webp`, `https://media.petparcel.store/products/08f51aaaad9b2c88cca9.webp`], tags: ["Pet Chew Toys", "US warehouse"], featured: false, sortOrder: 140,
    variants: [
      { name: "5 pcs", sku: "CJCT320907201AZ", cjVid: "2104846016361578497", priceCents: 2799, inventoryQty: 92 },
    ],
    reviews: [] },
  // -- Pet Training and Educational Toys -- real supplier listing, CJ pid 1993164615406215169, supplier SKU CJTE2619923.
  { name: "Interactive Dog Treat Ball, A Chewing Toy Suitable For Small And Medium-sized Dogs.",
    slug: "interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d", category: "Pet Training and Educational Toys",
    description: "Dog Treat Ball Introducing the Dog Treat Ball-an interactive chew toydesigned for small and medium dogs.\n\nBuilt to last: made from plastic, and it weighs around 200 g.\n\nChoose the option that suits your pet - S, L.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- This unique ballcombines fun with functionality, making it perfect forboredom relief, lQ training, and slow feeding.lt's adurable teething toy that's safe for your furry friend.\n- Interactive Design: Engages your dog in playtime.\n- Treat Dispensing: Encourages natural foraginginstincts.\n- Bite-Resistant: Built to withstand tough chewing.",
    priceCents: 2599, images: [`https://media.petparcel.store/products/3160a6a6cfd518397512.webp`, `https://media.petparcel.store/products/8ad5d925c85336da50f4.webp`, `https://media.petparcel.store/products/204c6f5874b9747d99e0.webp`, `https://media.petparcel.store/products/64e7bdca9f9c0698418d.webp`, `https://media.petparcel.store/products/861e1d955a5cbf92e569.webp`], tags: ["Pet Training and Educational Toys", "US warehouse"], featured: false, sortOrder: 141,
    variants: [
      { name: "S", sku: "CJTE261992301AZ", cjVid: "1993164615544627202", priceCents: 2599, inventoryQty: 86 },
      { name: "L", sku: "CJTE261992302BY", cjVid: "1993164615544627203", priceCents: 2599, inventoryQty: 86 },
    ],
    reviews: [] },
  // -- Pet Sound Toys -- real supplier listing, CJ pid 2604081253511623400, supplier SKU CJYD2824522.
  { name: "Dog Toy For Entertainment And Self-Amusement Sounding Pet Food-Dispensing Toy Sniffing Mat",
    slug: "dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy", category: "Pet Sound Toys",
    description: "Dog Toy For Entertainment And Self-Amusement Sounding Pet Food-Dispensing Toy Sniffing Mat is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from plastic, and it weighs around 900.00 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1199, images: [`https://media.petparcel.store/products/0f215b0654f84ba7928e.webp`, `https://media.petparcel.store/products/539938d8206afdb354e2.webp`, `https://media.petparcel.store/products/89e53aa363d45cc9b959.webp`, `https://media.petparcel.store/products/a5361dd4b186c698af9b.webp`, `https://media.petparcel.store/products/0233f5120509ff5a6727.webp`], tags: ["Pet Sound Toys", "Tracking"], featured: false, sortOrder: 142,
    variants: [
      { name: "Blue", sku: "CJYD282452201AZ", cjVid: "2604081253511623800", priceCents: 1199, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Tunnel Toys -- real supplier listing, CJ pid 2606250325251608200, supplier SKU CJYD2953792.
  { name: "All-in-one No-installation Cat Scratcher Tunnel Toy",
    slug: "all-in-one-no-installation-cat-scratcher-tunnel-toy", category: "Pet Tunnel Toys",
    description: "All-in-one No-installation Cat Scratcher Tunnel Toy is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from plastic, and it weighs around 2000.00 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 3299, images: [`https://media.petparcel.store/products/71f20fc49cde628f5493.webp`, `https://media.petparcel.store/products/e5d3dc352919c71ac7e9.webp`, `https://media.petparcel.store/products/dcdc03f4ec6df9a9c27c.webp`, `https://media.petparcel.store/products/504bf2deeefe578e6c1d.webp`, `https://media.petparcel.store/products/000018ae7533aa4b109b.webp`], tags: ["Pet Tunnel Toys", "US warehouse"], featured: false, sortOrder: 143,
    variants: [
      { name: "Oval PLUS", sku: "CJYD295379201AZ", cjVid: "2606250325251608800", priceCents: 3299, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Toy Set -- real supplier listing, CJ pid 2083079011126984706, supplier SKU CJTS3024307.
  { name: "Interactive Cat Toy, 1 Toy With 2 Replacement Parts - Party Accessory Set",
    slug: "interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set", category: "Pet Toy Set",
    description: "Encourages playfulness and exercise: This interactive toy stimulates your cat's natural hunting instinct, promoting both physical and mental activity.\n\nLightweight and easy to handle at around 710 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Simple and safe design: Designed for hassle-free play.\n- The moving parts are securely attached to prevent accidental swallowing.\n- Includes replacement parts: The set includes the main toy plus two additional spring elements to extend playtime and provide variety.\n- Easy to use: Easy for you to operate to keep your cat entertained.",
    priceCents: 3499, images: [`https://media.petparcel.store/products/8fa1adebb81ff67e1c6d.webp`, `https://media.petparcel.store/products/8982fe7eaf8e56328257.webp`, `https://media.petparcel.store/products/0f98a2b6d1d6624b9404.webp`, `https://media.petparcel.store/products/e6ce59acb6d6043158d6.webp`, `https://media.petparcel.store/products/453ea6378b7e5a1d0cb2.webp`], tags: ["Pet Toy Set", "Tracking"], featured: false, sortOrder: 144,
    variants: [
      { name: "Other", sku: "CJTS30243070001", cjVid: "2083079011286368257", priceCents: 3499, inventoryQty: 192 },
    ],
    reviews: [] },
  // -- Pet Plush Toys -- real supplier listing, CJ pid 2104522050033946626, supplier SKU CJPT3206229.
  { name: "Christmas Squeaky Dog Toys, Plush Dog Toys With Crinkle Paper Interactive Chew Toys, Dog Cute Gifts, Dog Toy Set, Reduces Boredom, For Small Medium Dogs, Indoor And Outdoor Play",
    slug: "christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew", category: "Pet Plush Toys",
    description: "Squeaky & Crinkle Dog Toys: Our plush dog toys are equipped with a squeaker within the body and crinkle paper sounds in the tails and ears.\n\nBuilt to last: made from cloth, and it weighs around 68 g.\n\nChoose the option that suits your pet - Red-L, Red-S, Khaki-L, Khaki-S, White-L, White-S.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- These multi-sensory toys are designed to captivate your dog's attention instantly.\n- Our interactive plush toy features strategically placed squeakers and crinkle paper, making it highly appealing to dogs.\n- These adorable toys provide hours of entertainment and various play modes for extended fun, helping to reduce stress and boredom while keeping your pet healthy.\n- Ensure it's dry before giving it back to your dog.",
    priceCents: 899, images: [`https://media.petparcel.store/products/d36ab866fa41b3ac3a54.webp`, `https://media.petparcel.store/products/d578e7c58bfdbf88e15e.webp`, `https://media.petparcel.store/products/806d433a79b682b5212c.webp`, `https://media.petparcel.store/products/d26f295d1fe417ee72af.webp`, `https://media.petparcel.store/products/6f10be3081ac2aac9144.webp`], tags: ["Pet Plush Toys", "Tracking"], featured: false, sortOrder: 145,
    variants: [
      { name: "Red-L", sku: "CJPT320622901AZ", cjVid: "2104522050428211202", priceCents: 899, inventoryQty: 300 },
      { name: "Red-S", sku: "CJPT320622902BY", cjVid: "2104522050428211203", priceCents: 899, inventoryQty: 300 },
      { name: "Khaki-L", sku: "CJPT320622903CX", cjVid: "2104522050428211204", priceCents: 899, inventoryQty: 300 },
      { name: "Khaki-S", sku: "CJPT320622904DW", cjVid: "2104522050428211205", priceCents: 899, inventoryQty: 300 },
      { name: "White-L", sku: "CJPT320622905EV", cjVid: "2104522050428211206", priceCents: 899, inventoryQty: 300 },
      { name: "White-S", sku: "CJPT320622906FU", cjVid: "2104522050428211207", priceCents: 899, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Bedding -- real supplier listing, CJ pid 2080714942724071426, supplier SKU CJPM3005952.
  { name: "Cat Litter Mat Double Layer Waterproof Urine Proof Trapping Mat 1 Pack",
    slug: "cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack", category: "Pet Bedding",
    description: "Anti Tracking EZ Open Edge Litter Mat: Double-layer honeycomb design helps you gather the litter.\n\nLightweight and easy to handle at around 184 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- You just pick up the mat and all the litter falls through and then dump it back in the litter box make it recycling.\n- No more getting litter stuck to my feet on a daily basis!\n- Large holes is large enough to catch and trap litter.\n- Suitable for lots of type of litter, and kitty litter boxes,hooded,self cleaning litter box.",
    priceCents: 5699, images: [`https://media.petparcel.store/products/34484b83bb74ae6777d7.webp`, `https://media.petparcel.store/products/ca80b1b2258c2a584737.webp`, `https://media.petparcel.store/products/b242f523308b100ce548.webp`, `https://media.petparcel.store/products/21ee63209619ac4ec34f.webp`, `https://media.petparcel.store/products/0240c6d09edd22063491.webp`], tags: ["Pet Bedding", "US warehouse"], featured: false, sortOrder: 146,
    variants: [
      { name: "GREY", sku: "CJPM300595201AZ", cjVid: "2080714942891843586", priceCents: 5699, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Pet Mats -- real supplier listing, CJ pid 2091938725500452866, supplier SKU CJPM3092280.
  { name: "Absorbent Pet Feeding Mat 20x12 Inch, Waterproof Rubber Backing, Dark Gray Striped",
    slug: "absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip", category: "Pet Mats",
    description: "Strong Absorbent & Stain-Resistant Our dog food mat boasts exceptional absorbency, quickly soaking up any spilled water & milk and leaving no traces behind.\n\nLightweight and easy to handle at around 308 g.\n\nChoose the option that suits your pet - Dark Gray, Size 24L x 16W, Size 27L x 17W.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- It effectively prevents wet paws and keeps your pet's eating area clean.\n- Anti-Slip & Leak-Proof Our dog bowl mat features a non-slip rubber backing that securely maintains its position.\n- The waterproof rubber bottom provides excellent leak protection, preventing water from seeping into the floor and causing damage.\n- Easy to Clean The surface of our pet food mat is made of a special material that resists pet hair and dust.",
    priceCents: 7699, images: [`https://media.petparcel.store/products/19c3202ea2d3ef5ff433.webp`, `https://media.petparcel.store/products/a83c96ffa776f5b035aa.webp`, `https://media.petparcel.store/products/a18c4f322b5b4bbc634a.webp`, `https://media.petparcel.store/products/beeacd5327a001a866ca.webp`, `https://media.petparcel.store/products/354c3cc9a2f67a9d5221.webp`], tags: ["Pet Mats", "US warehouse"], featured: false, sortOrder: 147,
    variants: [
      { name: "Dark Gray", sku: "CJPM309228001AZ", cjVid: "2091938725643059201", priceCents: 7699, inventoryQty: 50 },
      { name: "Size 24L x 16W", sku: "CJPM309228002BY", cjVid: "2099949901563412482", priceCents: 7699, inventoryQty: 50 },
      { name: "Size 27L x 17W", sku: "CJPM309228003CX", cjVid: "2099949901911539713", priceCents: 7699, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Pet Nests -- real supplier listing, CJ pid 31E793E4-F497-4C75-B5D4-DAF0B695CCBF, supplier SKU CJJJCWMY00276.
  { name: "Round Long Hairy Autumn And Winter Nest Pad Cat Mattress",
    slug: "round-long-hairy-autumn-and-winter-nest-pad-cat-mattress", category: "Pet Nests",
    description: "The bed can be machine-washed or hand-washed for easy care.\n\nBuilt to last: made from cloth, and it weighs around 439.00 g.\n\nChoose the option that suits your pet - Pink 110cm, Green 60cm, A green 60cm, Red 120cm, Light coffee 50cm, Apricot 60cm, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- In addition, in order to keep the plush soft, smooth and fluffy, you can often dry it on sunny days.\n- The anti-slip bottom is designed with glue spots, which is anti-slip and durable.\n- Made of super soft and super warm plush, it really brings soft care to your pet.\n- High-quality PP cotton allows your pet to have a good and deep sleep.",
    priceCents: 899, images: [`https://media.petparcel.store/products/60cafea7d6e117668ce1.webp`, `https://media.petparcel.store/products/1e9f171f83966e289867.webp`, `https://media.petparcel.store/products/160b40d91f90ef7f5108.webp`, `https://media.petparcel.store/products/9a2d5f77e603e769402b.webp`, `https://media.petparcel.store/products/4c3d44c998a297a26d11.webp`], tags: ["Pet Nests", "US warehouse"], featured: false, sortOrder: 148,
    variants: [
      { name: "Pink · 110cm", sku: "CJJJCWMY00276-Pink-110cm", cjVid: "00D5B438-550F-408A-8A99-CFDDFBC58190", priceCents: 899, inventoryQty: 300 },
      { name: "Green · 60cm", sku: "CJJJCWMY00276-Green-60cm", cjVid: "0490621E-025B-41BC-A662-AF308E8D0EB2", priceCents: 899, inventoryQty: 300 },
      { name: "A green · 60cm", sku: "CJJJCWMY00276-A green-60cm", cjVid: "05115E0E-3636-4989-94A2-8D17931FC19F", priceCents: 899, inventoryQty: 300 },
      { name: "Red · 120cm", sku: "CJJJCWMY00276-Red-120cm", cjVid: "05551C07-BED8-4F1D-919B-7EAF39049BB4", priceCents: 899, inventoryQty: 300 },
      { name: "Light coffee · 50cm", sku: "CJJJCWMY00276-Light coffee-50cm", cjVid: "08CE7EA6-C851-43C3-8538-FD5786F90230", priceCents: 899, inventoryQty: 300 },
      { name: "Apricot · 60cm", sku: "CJJJCWMY00276-Apricot-60cm", cjVid: "09FA36B4-A6F2-4EA1-8084-BAD716396811", priceCents: 899, inventoryQty: 300 },
      { name: "Apricot · 70cm", sku: "CJJJCWMY00276-Apricot-70cm", cjVid: "0D1AA160-F9CD-48FD-92BA-A32D9E21F2EB", priceCents: 899, inventoryQty: 300 },
      { name: "Rice pink · 60cm", sku: "CJJJCWMY00276-Rice pink-60cm", cjVid: "0EC8E865-20CD-4152-838F-CCF72BCD2664", priceCents: 899, inventoryQty: 300 },
      { name: "Green · 100cm", sku: "CJJJCWMY00276-Green-100cm", cjVid: "10FC9A59-F7B9-4CF6-9776-BC8F22FFBBE0", priceCents: 899, inventoryQty: 300 },
      { name: "Beige brown · 60cm", sku: "CJJJCWMY00276-Beige brown-60cm", cjVid: "12C2A9D6-6A4F-4DCD-8925-46D9E649D30B", priceCents: 899, inventoryQty: 300 },
      { name: "A green · 70cm", sku: "CJJJCWMY00276-A green-70cm", cjVid: "1581182227784937472", priceCents: 899, inventoryQty: 300 },
      { name: "Light coffee · 80cm", sku: "CJJJCWMY00276-Light coffee-80cm", cjVid: "15FB8879-3378-4551-B47F-F387A140AEA0", priceCents: 899, inventoryQty: 300 },
      { name: "Apricot · 120cm", sku: "CJJJCWMY00276-Apricot-120cm", cjVid: "1B6FE72B-396A-4A0E-8FA9-160300C865E0", priceCents: 899, inventoryQty: 300 },
      { name: "Apricot · 50cm", sku: "CJJJCWMY00276-Apricot-50cm", cjVid: "1C4E6AB3-2DA2-4F86-838F-DACD3E980118", priceCents: 899, inventoryQty: 300 },
      { name: "Apricot · 100cm", sku: "CJJJCWMY00276-Apricot-100cm", cjVid: "1E694DFE-0F62-40A6-8169-F2F178EDF91F", priceCents: 899, inventoryQty: 300 },
      { name: "Rubber color · 70cm", sku: "CJJJCWMY00276-Rubber color-70cm", cjVid: "1FCA72F7-91F8-441F-9A70-4608B4BD9B54", priceCents: 899, inventoryQty: 300 },
      { name: "Red · 70cm", sku: "CJJJCWMY00276-Red-70cm", cjVid: "20B3F069-B3D7-4357-8EFB-5A8B77B43DAA", priceCents: 899, inventoryQty: 300 },
      { name: "Beige brown · 80cm", sku: "CJJJCWMY00276-Beige brown-80cm", cjVid: "23405E4A-1C4C-4ACB-A345-E283596132DE", priceCents: 899, inventoryQty: 300 },
      { name: "Gradient coffee · 100cm", sku: "CJJJCWMY00276-Gradient coffee-100cm", cjVid: "2509110310411615000", priceCents: 899, inventoryQty: 300 },
      { name: "DarkBrown · 80cm", sku: "CJJJCWMY00276-DarkBrown-80cm", cjVid: "2512040433031630500", priceCents: 899, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Beds -- real supplier listing, CJ pid 2072258275553931266, supplier SKU CJPB2963123.
  { name: "Elevated Breathable Mesh Pet Bed, Indoor Or Outdoor Use, Sizes For Small To XL Pets",
    slug: "elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p", category: "Pet Beds",
    description: "Our ultra-breathable mesh fabric promotes constant air circulation, making it the perfect solution for hot summer days across the US, where overheating is a top concern for pet parents.\n\nLightweight and easy to handle at around 1000 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The waterproof, stain-resistant mesh is easy to wipe clean, while the sturdy four-leg frame ensures long-lasting stability.\n- The low-profile height is gentle on senior pets or those with joint issues, and the lightweight design (1.0KG for L/XL/XXL, 1.6KG for XXXL) makes it effortless to take on trips or visit friends.\n- Invest in your pet's comfort with a premium bed that blends style, durability, and functionality-your furry friend deserves the best.",
    priceCents: 5799, images: [`https://media.petparcel.store/products/55fc3f7c42804d4ff6ac.webp`, `https://media.petparcel.store/products/f16509174d943e12165f.webp`, `https://media.petparcel.store/products/360c14fa723af00ce54c.webp`, `https://media.petparcel.store/products/68920125ece162d069fe.webp`, `https://media.petparcel.store/products/b64850d41de4a553b34e.webp`], tags: ["Pet Beds", "US warehouse"], featured: false, sortOrder: 149,
    variants: [
      { name: "Black", sku: "CJPB296312301AZ", cjVid: "2072258275688148994", priceCents: 5799, inventoryQty: 20 },
    ],
    reviews: [] },
  // -- Pet Blankets & Quilts -- real supplier listing, CJ pid 2082898128163672065, supplier SKU CJBQ3022427.
  { name: "Pet Blanket For Dogs Cats, 300GSM Ultra Soft Coral Fleece Blanket, Washable Small Dog Cat Blanket",
    slug: "pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal", category: "Pet Blankets & Quilts",
    description: "Cloud-Like Comfort: This blanket is made with premium 300GSM coral fleece that feels way more expensive than it is.\n\nBuilt to last: made from cloth, and it weighs around 100 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- It's lightweight but plush enough for year-round snuggles.\n- Perfect for small dogs, cats, puppies, and kittens who demand maximum cozy Protects Your Furniture Without the Fuss: Fur, dander, muddy paws.\n- This blanket catches it all so your couch, bed, and car seats stay clean.\n- Just toss it on and let your pet lounge anywhere without stressing about the mess.",
    priceCents: 5699, images: [`https://media.petparcel.store/products/15677ef83cb22d7a5d22.webp`, `https://media.petparcel.store/products/a02a277084acb4456eb9.webp`, `https://media.petparcel.store/products/ac3a1ed86defc6688d13.webp`, `https://media.petparcel.store/products/48dcc46e1f8b5484bda4.webp`, `https://media.petparcel.store/products/9f5a668cb43075a8c5af.webp`], tags: ["Pet Blankets & Quilts", "US warehouse"], featured: false, sortOrder: 150,
    variants: [
      { name: "White", sku: "CJBQ302242701AZ", cjVid: "2082898128344027138", priceCents: 5699, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Pet Apparels -- real supplier listing, CJ pid 2502140802471609200, supplier SKU CJYD2291704.
  { name: "Pet Clothes Round Neck T-shirt",
    slug: "pet-clothes-round-neck-t-shirt", category: "Pet Apparels",
    description: "Pet Clothes Round Neck T-shirt is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 100.00 g.\n\nChoose the option that suits your pet - Red S, Red M, Red L, Red XL, Red XXL, Blue S, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 499, images: [`https://media.petparcel.store/products/9fa3c24e86a781a7ad4d.webp`, `https://media.petparcel.store/products/20132af0188f8960e23c.webp`, `https://media.petparcel.store/products/e406bdab4f9a45c1be27.webp`, `https://media.petparcel.store/products/05c9a881f9f30a126c9c.webp`, `https://media.petparcel.store/products/0958c2a7d77deaf571dd.webp`], tags: ["Pet Apparels", "US warehouse"], featured: false, sortOrder: 151,
    variants: [
      { name: "Red · S", sku: "CJYD229170401AZ", cjVid: "2502140802471609400", priceCents: 499, inventoryQty: 300 },
      { name: "Red · M", sku: "CJYD229170402BY", cjVid: "2502140802471609600", priceCents: 499, inventoryQty: 300 },
      { name: "Red · L", sku: "CJYD229170403CX", cjVid: "2502140802471609700", priceCents: 499, inventoryQty: 300 },
      { name: "Red · XL", sku: "CJYD229170404DW", cjVid: "2502140802471609900", priceCents: 499, inventoryQty: 300 },
      { name: "Red · XXL", sku: "CJYD229170405EV", cjVid: "2502140802481600100", priceCents: 499, inventoryQty: 300 },
      { name: "Blue · S", sku: "CJYD229170406FU", cjVid: "2502140802481600200", priceCents: 499, inventoryQty: 300 },
      { name: "Blue · M", sku: "CJYD229170407GT", cjVid: "2502140802481600400", priceCents: 499, inventoryQty: 300 },
      { name: "Blue · L", sku: "CJYD229170408HS", cjVid: "2502140802481600500", priceCents: 499, inventoryQty: 300 },
      { name: "Blue · XL", sku: "CJYD229170409IR", cjVid: "2502140802481600600", priceCents: 499, inventoryQty: 300 },
      { name: "Blue · XXL", sku: "CJYD229170410JQ", cjVid: "2502140802481600800", priceCents: 499, inventoryQty: 300 },
      { name: "Black · S", sku: "CJYD229170411KP", cjVid: "2502140802481601000", priceCents: 499, inventoryQty: 300 },
      { name: "Black · M", sku: "CJYD229170412LO", cjVid: "2502140802481601100", priceCents: 499, inventoryQty: 300 },
      { name: "Black · L", sku: "CJYD229170413MN", cjVid: "2502140802481601200", priceCents: 499, inventoryQty: 300 },
      { name: "Black · XL", sku: "CJYD229170414NM", cjVid: "2502140802481601400", priceCents: 499, inventoryQty: 300 },
      { name: "Black · XXL", sku: "CJYD229170415OL", cjVid: "2502140802481601500", priceCents: 499, inventoryQty: 300 },
      { name: "Khaki · S", sku: "CJYD229170416PK", cjVid: "2502140802481601700", priceCents: 499, inventoryQty: 300 },
      { name: "Khaki · M", sku: "CJYD229170417QJ", cjVid: "2502140802481601800", priceCents: 499, inventoryQty: 300 },
      { name: "Khaki · L", sku: "CJYD229170418RI", cjVid: "2502140802481602000", priceCents: 499, inventoryQty: 300 },
      { name: "Khaki · XL", sku: "CJYD229170419SH", cjVid: "2502140802481602100", priceCents: 499, inventoryQty: 300 },
      { name: "Khaki · XXL", sku: "CJYD229170420TG", cjVid: "2502140802481602300", priceCents: 499, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Dresses -- real supplier listing, CJ pid 2601120626281635800, supplier SKU CJYD2725729.
  { name: "Dog Dresses For Outdoor Walks With A Leash",
    slug: "dog-dresses-for-outdoor-walks-with-a-leash", category: "Pet Dresses",
    description: "Body length 21 inches, chest circumference 27 inches, approximately 2 jin; M.\n\nBuilt to last: made from cloth, and it weighs around 120.00 g.\n\nChoose the option that suits your pet - Round neck gray plaid S, Round neck gray plaid M, Round neck gray plaid L, Round neck gray plaid XL, Round neck gray plaid XXL.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Body length 25 inches, chest circumference 33 inches, approximately 3.\n- Body length 30 inches, chest circumference 38 inches, approximately 5.\n- Body length 34 inches, chest circumference 44 inches, approximately 7.\n- Body length 40 inches, chest circumference 50 inches, approximately 10.",
    priceCents: 1299, images: [`https://media.petparcel.store/products/47d27f4c439ae214c42f.webp`, `https://media.petparcel.store/products/f9e9857539677bb20897.webp`, `https://media.petparcel.store/products/178fb038671719d15880.webp`, `https://media.petparcel.store/products/a9ca4ebadf3c8cc3e544.webp`, `https://media.petparcel.store/products/12d31530e4ea6cf6f5ea.webp`], tags: ["Pet Dresses", "Tracking"], featured: false, sortOrder: 152,
    variants: [
      { name: "Round neck gray plaid · S", sku: "CJYD272572906FU", cjVid: "2601120626281637400", priceCents: 1299, inventoryQty: 300 },
      { name: "Round neck gray plaid · M", sku: "CJYD272572907GT", cjVid: "2601120626281637600", priceCents: 1299, inventoryQty: 300 },
      { name: "Round neck gray plaid · L", sku: "CJYD272572908HS", cjVid: "2601120626281637800", priceCents: 1299, inventoryQty: 300 },
      { name: "Round neck gray plaid · XL", sku: "CJYD272572909IR", cjVid: "2601120626281638000", priceCents: 1299, inventoryQty: 300 },
      { name: "Round neck gray plaid · XXL", sku: "CJYD272572910JQ", cjVid: "2601120626281638500", priceCents: 1299, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Sweaters -- real supplier listing, CJ pid 2512120903101607500, supplier SKU CJYD2641666.
  { name: "Pet Dog Color-Block Cardigan Sweater",
    slug: "pet-dog-color-block-cardigan-sweater", category: "Pet Sweaters",
    description: "Green collar, sky-blue collar; Mohair style.\n\nBuilt to last: made from cloth, and it weighs around 57.00 g.\n\nChoose the option that suits your pet - Chrysanthemum XS, Chrysanthemum S, Chrysanthemum M, Chrysanthemum L, Chrysanthemum XL, Chrysanthemum 2XL, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1199, images: [`https://media.petparcel.store/products/12c44684de8b9a9cbd57.webp`, `https://media.petparcel.store/products/945a788cecff6f539fe4.webp`, `https://media.petparcel.store/products/43e737d44e6c7d2a8ae0.webp`, `https://media.petparcel.store/products/da5592ab03f0104a5921.webp`, `https://media.petparcel.store/products/b31484011c7a1a795048.webp`], tags: ["Pet Sweaters", "Tracking"], featured: false, sortOrder: 154,
    variants: [
      { name: "Chrysanthemum · XS", sku: "CJYD264166601AZ", cjVid: "2512120903101607700", priceCents: 1199, inventoryQty: 300 },
      { name: "Chrysanthemum · S", sku: "CJYD264166602BY", cjVid: "2512120903101607800", priceCents: 1199, inventoryQty: 300 },
      { name: "Chrysanthemum · M", sku: "CJYD264166603CX", cjVid: "2512120903101608000", priceCents: 1199, inventoryQty: 300 },
      { name: "Chrysanthemum · L", sku: "CJYD264166604DW", cjVid: "2512120903101608100", priceCents: 1199, inventoryQty: 300 },
      { name: "Chrysanthemum · XL", sku: "CJYD264166605EV", cjVid: "2512120903101608300", priceCents: 1199, inventoryQty: 300 },
      { name: "Chrysanthemum · 2XL", sku: "CJYD264166606FU", cjVid: "2512120903101608500", priceCents: 1199, inventoryQty: 300 },
      { name: "Sky Blue Collar · XS", sku: "CJYD264166607GT", cjVid: "2512120903101608600", priceCents: 1199, inventoryQty: 300 },
      { name: "Sky Blue Collar · S", sku: "CJYD264166608HS", cjVid: "2512120903101608800", priceCents: 1199, inventoryQty: 300 },
      { name: "Sky Blue Collar · M", sku: "CJYD264166609IR", cjVid: "2512120903101608900", priceCents: 1199, inventoryQty: 300 },
      { name: "Sky Blue Collar · L", sku: "CJYD264166610JQ", cjVid: "2512120903101609100", priceCents: 1199, inventoryQty: 300 },
      { name: "Sky Blue Collar · XL", sku: "CJYD264166611KP", cjVid: "2512120903101609300", priceCents: 1199, inventoryQty: 300 },
      { name: "Sky Blue Collar · 2XL", sku: "CJYD264166612LO", cjVid: "2512120903101609400", priceCents: 1199, inventoryQty: 300 },
      { name: "Mohair · XS", sku: "CJYD264166613MN", cjVid: "2512120903101609600", priceCents: 1199, inventoryQty: 300 },
      { name: "Mohair · S", sku: "CJYD264166614NM", cjVid: "2512120903101609700", priceCents: 1199, inventoryQty: 300 },
      { name: "Mohair · M", sku: "CJYD264166615OL", cjVid: "2512120903101609900", priceCents: 1199, inventoryQty: 300 },
      { name: "Mohair · L", sku: "CJYD264166616PK", cjVid: "2512120903111600100", priceCents: 1199, inventoryQty: 300 },
      { name: "Mohair · XL", sku: "CJYD264166617QJ", cjVid: "2512120903111600200", priceCents: 1199, inventoryQty: 300 },
      { name: "Mohair · 2XL", sku: "CJYD264166618RI", cjVid: "2512120903111600400", priceCents: 1199, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Sweatshirts & Hoodies -- real supplier listing, CJ pid 2602010458501628500, supplier SKU CJYD2750731.
  { name: "Large Dog Border Collie Pet Sweater",
    slug: "large-dog-border-collie-pet-sweater", category: "Pet Sweatshirts & Hoodies",
    description: "Chest circumference 70 cm (recommended for pets weighing 10.\n\nBuilt to last: made from cloth, and it weighs around 290.00 g.\n\nChoose the option that suits your pet - 3XL Blue, 3XL Coffee Color, 4XL Blue, 4XL Coffee Color, 5XL Blue, 5XL Coffee Color, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Chest circumference 75 cm (recommended for pets weighing 15.\n- Chest circumference 80 cm (recommended for pets weighing 20.\n- Chest circumference 85 cm (recommended for pets weighing 25.\n- Chest circumference 90 cm (recommended for pets weighing 30.",
    priceCents: 1199, images: [`https://media.petparcel.store/products/e430649d0c3db489afa8.webp`, `https://media.petparcel.store/products/d3674ce7364027908b65.webp`, `https://media.petparcel.store/products/c67d7f6b2eb074125ec9.webp`, `https://media.petparcel.store/products/e5db7b9770e4bd75bab7.webp`, `https://media.petparcel.store/products/62feb1837bafb3538986.webp`], tags: ["Pet Sweatshirts & Hoodies", "Tracking"], featured: false, sortOrder: 155,
    variants: [
      { name: "3XL Blue", sku: "CJYD275073101AZ", cjVid: "2602010458501628900", priceCents: 1199, inventoryQty: 300 },
      { name: "3XL Coffee Color", sku: "CJYD275073102BY", cjVid: "2602010458501629200", priceCents: 1199, inventoryQty: 300 },
      { name: "4XL Blue", sku: "CJYD275073103CX", cjVid: "2602010458501629500", priceCents: 1199, inventoryQty: 300 },
      { name: "4XL Coffee Color", sku: "CJYD275073104DW", cjVid: "2602010458501629800", priceCents: 1199, inventoryQty: 300 },
      { name: "5XL Blue", sku: "CJYD275073105EV", cjVid: "2602010458511620000", priceCents: 1199, inventoryQty: 300 },
      { name: "5XL Coffee Color", sku: "CJYD275073106FU", cjVid: "2602010458511620300", priceCents: 1199, inventoryQty: 300 },
      { name: "6XL Blue", sku: "CJYD275073107GT", cjVid: "2602010458511620600", priceCents: 1199, inventoryQty: 300 },
      { name: "6XL Coffee Color", sku: "CJYD275073108HS", cjVid: "2602010458511620900", priceCents: 1199, inventoryQty: 300 },
      { name: "7XL Blue", sku: "CJYD275073109IR", cjVid: "2602010458511621200", priceCents: 1199, inventoryQty: 300 },
      { name: "7XL Coffee Color", sku: "CJYD275073110JQ", cjVid: "2602010458511621500", priceCents: 1199, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Coats & Jackets -- real supplier listing, CJ pid 2407180220271601600, supplier SKU CJGD2086674.
  { name: "Pet Clothes Dog Anxiety Jacket Warm Vest",
    slug: "pet-clothes-dog-anxiety-jacket-warm-vest", category: "Pet Coats & Jackets",
    description: "Pet Clothes Dog Anxiety Jacket Warm Vest is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 45.00 g.\n\nChoose the option that suits your pet - Heather Gray XXS, Heather Gray XS, Heather Gray S, Heather Gray M, Heather Gray L, Heather Gray XL, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 999, images: [`https://media.petparcel.store/products/8f0849dee0275fa91c04.webp`, `https://media.petparcel.store/products/82b81fd346595df4c347.webp`, `https://media.petparcel.store/products/1633c0641ed6a9710dff.webp`, `https://media.petparcel.store/products/88ec64e6f4684b9be9b8.webp`, `https://media.petparcel.store/products/7012eb9f09caa52fa992.webp`], tags: ["Pet Coats & Jackets", "US warehouse"], featured: false, sortOrder: 156,
    variants: [
      { name: "Heather Gray · XXS", sku: "CJGD208667401AZ", cjVid: "2407180220271601800", priceCents: 999, inventoryQty: 300 },
      { name: "Heather Gray · XS", sku: "CJGD208667402BY", cjVid: "2407180220271602000", priceCents: 999, inventoryQty: 300 },
      { name: "Heather Gray · S", sku: "CJGD208667403CX", cjVid: "2407180220271602400", priceCents: 999, inventoryQty: 300 },
      { name: "Heather Gray · M", sku: "CJGD208667404DW", cjVid: "2407180220271602500", priceCents: 999, inventoryQty: 300 },
      { name: "Heather Gray · L", sku: "CJGD208667405EV", cjVid: "2407180220271602700", priceCents: 999, inventoryQty: 300 },
      { name: "Heather Gray · XL", sku: "CJGD208667406FU", cjVid: "2407180220271602800", priceCents: 999, inventoryQty: 300 },
      { name: "Heather Gray · XXL", sku: "CJGD208667407GT", cjVid: "2407180220271603000", priceCents: 999, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Jumpsuits -- real supplier listing, CJ pid 2411270650521628600, supplier SKU CJYD2225680.
  { name: "Dog Four Seasons Breathable Soft Bottom Jumpsuit",
    slug: "dog-four-seasons-breathable-soft-bottom-jumpsuit", category: "Pet Jumpsuits",
    description: "Dog Four Seasons Breathable Soft Bottom Jumpsuit is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 141.00 g.\n\nChoose the option that suits your pet - Color Mixing XS, Color Mixing S, Color Mixing M, Color Mixing L, Color Mixing XL, Dark Blue XS, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1299, images: [`https://media.petparcel.store/products/16fa3985b4f9b330145f.webp`, `https://media.petparcel.store/products/55c7afa1d4b524998a0d.webp`, `https://media.petparcel.store/products/aabf8ad158bfd1c57f32.webp`, `https://media.petparcel.store/products/5ab7a8cddf14a84593be.webp`, `https://media.petparcel.store/products/0ccbabd45cd6903df805.webp`], tags: ["Pet Jumpsuits", "Tracking"], featured: false, sortOrder: 157,
    variants: [
      { name: "Color Mixing · XS", sku: "CJYD222568001AZ", cjVid: "2411270650521628800", priceCents: 1299, inventoryQty: 300 },
      { name: "Color Mixing · S", sku: "CJYD222568002BY", cjVid: "2411270650521629100", priceCents: 1299, inventoryQty: 300 },
      { name: "Color Mixing · M", sku: "CJYD222568003CX", cjVid: "2411270650521629200", priceCents: 1299, inventoryQty: 300 },
      { name: "Color Mixing · L", sku: "CJYD222568004DW", cjVid: "2411270650521629600", priceCents: 1299, inventoryQty: 300 },
      { name: "Color Mixing · XL", sku: "CJYD222568005EV", cjVid: "2411270650521629800", priceCents: 1299, inventoryQty: 300 },
      { name: "Dark Blue · XS", sku: "CJYD222568006FU", cjVid: "2411270650531620000", priceCents: 1299, inventoryQty: 300 },
      { name: "Dark Blue · S", sku: "CJYD222568007GT", cjVid: "2411270650531620200", priceCents: 1299, inventoryQty: 300 },
      { name: "Dark Blue · M", sku: "CJYD222568008HS", cjVid: "2411270650531620400", priceCents: 1299, inventoryQty: 300 },
      { name: "Dark Blue · L", sku: "CJYD222568009IR", cjVid: "2411270650531620600", priceCents: 1299, inventoryQty: 300 },
      { name: "Dark Blue · XL", sku: "CJYD222568010JQ", cjVid: "2411270650531620700", priceCents: 1299, inventoryQty: 300 },
      { name: "Yellow · XS", sku: "CJYD222568011KP", cjVid: "2411270650531620900", priceCents: 1299, inventoryQty: 300 },
      { name: "Yellow · S", sku: "CJYD222568012LO", cjVid: "2411270650531621100", priceCents: 1299, inventoryQty: 300 },
      { name: "Yellow · M", sku: "CJYD222568013MN", cjVid: "2411270650531621300", priceCents: 1299, inventoryQty: 300 },
      { name: "Yellow · L", sku: "CJYD222568014NM", cjVid: "2411270650531621500", priceCents: 1299, inventoryQty: 300 },
      { name: "Yellow · XL", sku: "CJYD222568015OL", cjVid: "2411270650531621700", priceCents: 1299, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Pajamas -- real supplier listing, CJ pid 2406270208541620400, supplier SKU CJGD2069728.
  { name: "Anti-fur Pajamas Bow Decoration Big Dog Four-legged Pet Clothing",
    slug: "anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing", category: "Pet Pajamas",
    description: "Anti-fur Pajamas Bow Decoration Big Dog Four-legged Pet Clothing is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 320.00 g.\n\nChoose the option that suits your pet - Navy Blue Bow 26, Navy Blue Bow 28 Yards, Navy Blue Bow 30, Navy Blue Bow 32 Yards, Navy Blue Bow 34 Yards, Navy Blue Bow 36 Yards, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1299, images: [`https://media.petparcel.store/products/1ba878e0bb7ba77638bd.webp`, `https://media.petparcel.store/products/6d50f085bd495d7e7c67.webp`, `https://media.petparcel.store/products/202131f516c8ca14a5df.webp`, `https://media.petparcel.store/products/ae55804def297cec51a6.webp`, `https://media.petparcel.store/products/693520c7b589911c87d3.webp`], tags: ["Pet Pajamas", "Tracking"], featured: false, sortOrder: 158,
    variants: [
      { name: "Navy Blue Bow · 26", sku: "CJGD206972801AZ", cjVid: "2406270208541620600", priceCents: 1299, inventoryQty: 300 },
      { name: "Navy Blue Bow · 28 Yards", sku: "CJGD206972802BY", cjVid: "2406270208541620800", priceCents: 1299, inventoryQty: 300 },
      { name: "Navy Blue Bow · 30", sku: "CJGD206972803CX", cjVid: "2406270208541621000", priceCents: 1299, inventoryQty: 300 },
      { name: "Navy Blue Bow · 32 Yards", sku: "CJGD206972804DW", cjVid: "2406270208541621300", priceCents: 1299, inventoryQty: 300 },
      { name: "Navy Blue Bow · 34 Yards", sku: "CJGD206972805EV", cjVid: "2406270208541621500", priceCents: 1299, inventoryQty: 300 },
      { name: "Navy Blue Bow · 36 Yards", sku: "CJGD206972806FU", cjVid: "2406270208541621700", priceCents: 1299, inventoryQty: 300 },
      { name: "Navy Blue Bow · 38 Yards", sku: "CJGD206972807GT", cjVid: "2406270208541621900", priceCents: 1299, inventoryQty: 300 },
      { name: "Orange Bow · 26", sku: "CJGD206972808HS", cjVid: "2406270208541622100", priceCents: 1299, inventoryQty: 300 },
      { name: "Orange Bow · 28 Yards", sku: "CJGD206972809IR", cjVid: "2406270208541622300", priceCents: 1299, inventoryQty: 300 },
      { name: "Orange Bow · 30", sku: "CJGD206972810JQ", cjVid: "2406270208541622500", priceCents: 1299, inventoryQty: 300 },
      { name: "Orange Bow · 32 Yards", sku: "CJGD206972811KP", cjVid: "2406270208541622700", priceCents: 1299, inventoryQty: 300 },
      { name: "Orange Bow · 34 Yards", sku: "CJGD206972812LO", cjVid: "2406270208541622900", priceCents: 1299, inventoryQty: 300 },
      { name: "Orange Bow · 36 Yards", sku: "CJGD206972813MN", cjVid: "2406270208541623300", priceCents: 1299, inventoryQty: 300 },
      { name: "Orange Bow · 38 Yards", sku: "CJGD206972814NM", cjVid: "2406270208541623600", priceCents: 1299, inventoryQty: 300 },
      { name: "Leopard Bow · 26", sku: "CJGD206972815OL", cjVid: "2406270208541623800", priceCents: 1299, inventoryQty: 300 },
      { name: "Leopard Bow · 28 Yards", sku: "CJGD206972816PK", cjVid: "2406270208541623900", priceCents: 1299, inventoryQty: 300 },
      { name: "Leopard Bow · 30", sku: "CJGD206972817QJ", cjVid: "2406270208541624100", priceCents: 1299, inventoryQty: 300 },
      { name: "Leopard Bow · 32 Yards", sku: "CJGD206972818RI", cjVid: "2406270208541624300", priceCents: 1299, inventoryQty: 300 },
      { name: "Leopard Bow · 34 Yards", sku: "CJGD206972819SH", cjVid: "2406270208541624500", priceCents: 1299, inventoryQty: 300 },
      { name: "Leopard Bow · 36 Yards", sku: "CJGD206972820TG", cjVid: "2406270208541624700", priceCents: 1299, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Clothings -- real supplier listing, CJ pid 1765013135812988928, supplier SKU CJGD1982412.
  { name: "Winter Clothes Fleece-lined Warm Dog Cute Clothes",
    slug: "winter-clothes-fleece-lined-warm-dog-cute-clothes", category: "Pet Clothings",
    description: "Winter Clothes Fleece-lined Warm Dog Cute Clothes is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 400.00 g.\n\nChoose the option that suits your pet - Brown XS, Brown S, Brown M, Brown L, Brown XL, Brown 2XL, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 399, images: [`https://media.petparcel.store/products/b3b8ff3cc91f2b626228.webp`, `https://media.petparcel.store/products/187b78783f8099214798.webp`, `https://media.petparcel.store/products/3063db9284627c3438ad.webp`, `https://media.petparcel.store/products/01d94f63764ebd446b51.webp`, `https://media.petparcel.store/products/1a2f80c6c8ef60bb68da.webp`], tags: ["Pet Clothings", "US warehouse"], featured: false, sortOrder: 159,
    variants: [
      { name: "Brown · XS", sku: "CJGD198241201AZ", cjVid: "1765013135884292096", priceCents: 399, inventoryQty: 300 },
      { name: "Brown · S", sku: "CJGD198241202BY", cjVid: "1765013135938818048", priceCents: 399, inventoryQty: 300 },
      { name: "Brown · M", sku: "CJGD198241203CX", cjVid: "1765013135997538304", priceCents: 399, inventoryQty: 300 },
      { name: "Brown · L", sku: "CJGD198241204DW", cjVid: "1765013136047869952", priceCents: 399, inventoryQty: 300 },
      { name: "Brown · XL", sku: "CJGD198241205EV", cjVid: "1765013136106590208", priceCents: 399, inventoryQty: 300 },
      { name: "Brown · 2XL", sku: "CJGD198241206FU", cjVid: "1765013136165310464", priceCents: 399, inventoryQty: 300 },
      { name: "Brown · 3XL", sku: "CJGD198241207GT", cjVid: "1765013136219836416", priceCents: 399, inventoryQty: 300 },
      { name: "Apricot · XS", sku: "CJGD198241208HS", cjVid: "1765013136270168064", priceCents: 399, inventoryQty: 300 },
      { name: "Apricot · S", sku: "CJGD198241209IR", cjVid: "1765013136324694016", priceCents: 399, inventoryQty: 300 },
      { name: "Apricot · M", sku: "CJGD198241210JQ", cjVid: "1765013136387608576", priceCents: 399, inventoryQty: 300 },
      { name: "Apricot · L", sku: "CJGD198241211KP", cjVid: "1765013136442134528", priceCents: 399, inventoryQty: 300 },
      { name: "Apricot · XL", sku: "CJGD198241212LO", cjVid: "1765013136500854784", priceCents: 399, inventoryQty: 300 },
      { name: "Apricot · 2XL", sku: "CJGD198241213MN", cjVid: "1765013136555380736", priceCents: 399, inventoryQty: 300 },
      { name: "Apricot · 3XL", sku: "CJGD198241214NM", cjVid: "1765013136605712384", priceCents: 399, inventoryQty: 300 },
      { name: "Suit · 2XL", sku: "CJGD198241215OL", cjVid: "2410080657251609100", priceCents: 399, inventoryQty: 300 },
      { name: "Suit · 3XL", sku: "CJGD198241216PK", cjVid: "2410080657251609200", priceCents: 399, inventoryQty: 300 },
      { name: "Suit · L", sku: "CJGD198241217QJ", cjVid: "2410080657251609400", priceCents: 399, inventoryQty: 300 },
      { name: "Suit · M", sku: "CJGD198241218RI", cjVid: "2410080657251609500", priceCents: 399, inventoryQty: 300 },
      { name: "Suit · S", sku: "CJGD198241219SH", cjVid: "2410080657251609700", priceCents: 399, inventoryQty: 300 },
      { name: "Suit · XL", sku: "CJGD198241220TG", cjVid: "2410080657251609800", priceCents: 399, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Functional Clothings -- real supplier listing, CJ pid 2602240937331625600, supplier SKU CJYD2766388.
  { name: "Post-Surgical Rehabilitation Joint Protection Support Strap For Pets Knee Brace",
    slug: "post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac", category: "Pet Functional Clothings",
    description: "Leash not included), Black (HT5 model.\n\nLightweight and easy to handle at around 453.00 g.\n\nChoose the option that suits your pet - Black L, Black M, Black XL, Black With 1.5m Leash L, Black With 1.5m Leash M, Black With 1.5m Leash XL.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Asian sizes are 1 to 2 sizes smaller than European and American people.\n- Choose the larger size if your size between two sizes.\n- Please allow 2-3cm differences due to manual measurement.\n- Please check the size chart carefully before you buy the item, if you don't know how to choose size, please contact our customer service.",
    priceCents: 1899, images: [`https://media.petparcel.store/products/0ec4b4ea9e8a3b19cc81.webp`, `https://media.petparcel.store/products/3137a85fe0b873665952.webp`, `https://media.petparcel.store/products/c26b8231315fbc6f479f.webp`, `https://media.petparcel.store/products/e87fc2ae1bcd1269b8d8.webp`, `https://media.petparcel.store/products/0eabadc8e2dfc8db871e.webp`], tags: ["Pet Functional Clothings", "Tracking"], featured: false, sortOrder: 160,
    variants: [
      { name: "Black · L", sku: "CJYD276638802BY", cjVid: "2602240937331626100", priceCents: 1899, inventoryQty: 300 },
      { name: "Black · M", sku: "CJYD276638803CX", cjVid: "2602240937331626500", priceCents: 1899, inventoryQty: 300 },
      { name: "Black · XL", sku: "CJYD276638804DW", cjVid: "2602240937331627000", priceCents: 1899, inventoryQty: 300 },
      { name: "Black With 1.5m Leash · L", sku: "CJYD276638805EV", cjVid: "2602240937331627600", priceCents: 1899, inventoryQty: 300 },
      { name: "Black With 1.5m Leash · M", sku: "CJYD276638806FU", cjVid: "2602240937331628200", priceCents: 1899, inventoryQty: 300 },
      { name: "Black With 1.5m Leash · XL", sku: "CJYD276638807GT", cjVid: "2602240937331628600", priceCents: 1899, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Clothing Sets -- real supplier listing, CJ pid 2609150801291610000, supplier SKU CJYD3165651.
  { name: "Puppy Soldier Hat And Clothing Set",
    slug: "puppy-soldier-hat-and-clothing-set", category: "Pet Clothing Sets",
    description: "Puppy Soldier Hat And Clothing Set is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 180.00 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1899, images: [`https://media.petparcel.store/products/74550ff20ee5c49179b7.webp`, `https://media.petparcel.store/products/a2e4f24e9c6f961ea328.webp`, `https://media.petparcel.store/products/7baa48cb9cb4b8416c8e.webp`, `https://media.petparcel.store/products/18830430ec2082a84ca3.webp`, `https://media.petparcel.store/products/dd6988c757b9e8d3e1fe.webp`], tags: ["Pet Clothing Sets", "Tracking"], featured: false, sortOrder: 161,
    variants: [
      { name: "Clothes Suit", sku: "CJYD316565101AZ", cjVid: "2609150801291611200", priceCents: 1899, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Down & Parkas -- real supplier listing, CJ pid 2502170330091606200, supplier SKU CJYD2293333.
  { name: "Autumn And Winter Pet Clothes Small Dog Waterproof Thickened Warm",
    slug: "autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm", category: "Pet Down & Parkas",
    description: "Autumn And Winter Pet Clothes Small Dog Waterproof Thickened Warm is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 155.00 g.\n\nChoose the option that suits your pet - Melon Red S, Melon Red M, Melon Red XL, Melon Red 2XL, Melon Red 3XL, Khaki S, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1299, images: [`https://media.petparcel.store/products/2556fe080051dddf0d4d.webp`, `https://media.petparcel.store/products/e98542d12ac0494a3a9d.webp`, `https://media.petparcel.store/products/63cc3bf27986eacbc5c5.webp`], tags: ["Pet Down & Parkas", "Tracking"], featured: false, sortOrder: 162,
    variants: [
      { name: "Melon Red · S", sku: "CJYD229333301AZ", cjVid: "2502170330091606400", priceCents: 1299, inventoryQty: 300 },
      { name: "Melon Red · M", sku: "CJYD229333302BY", cjVid: "2502170330091606600", priceCents: 1299, inventoryQty: 300 },
      { name: "Melon Red · XL", sku: "CJYD229333303CX", cjVid: "2502170330091606800", priceCents: 1299, inventoryQty: 300 },
      { name: "Melon Red · 2XL", sku: "CJYD229333304DW", cjVid: "2502170330091607000", priceCents: 1299, inventoryQty: 300 },
      { name: "Melon Red · 3XL", sku: "CJYD229333305EV", cjVid: "2502170330091607100", priceCents: 1299, inventoryQty: 300 },
      { name: "Khaki · S", sku: "CJYD229333306FU", cjVid: "2502170330091607300", priceCents: 1299, inventoryQty: 300 },
      { name: "Khaki · M", sku: "CJYD229333307GT", cjVid: "2502170330091607500", priceCents: 1299, inventoryQty: 300 },
      { name: "Khaki · L", sku: "CJYD229333308HS", cjVid: "2502170330091607700", priceCents: 1299, inventoryQty: 300 },
      { name: "Khaki · XL", sku: "CJYD229333309IR", cjVid: "2502170330091607900", priceCents: 1299, inventoryQty: 300 },
      { name: "Khaki · 2XL", sku: "CJYD229333310JQ", cjVid: "2502170330091608000", priceCents: 1299, inventoryQty: 300 },
      { name: "Khaki · 3XL", sku: "CJYD229333311KP", cjVid: "2502170330091608200", priceCents: 1299, inventoryQty: 300 },
      { name: "Mustard Green · S", sku: "CJYD229333312LO", cjVid: "2502170330091608400", priceCents: 1299, inventoryQty: 300 },
      { name: "Mustard Green · M", sku: "CJYD229333313MN", cjVid: "2502170330091608600", priceCents: 1299, inventoryQty: 300 },
      { name: "Mustard Green · L", sku: "CJYD229333314NM", cjVid: "2502170330091608700", priceCents: 1299, inventoryQty: 300 },
      { name: "Mustard Green · XL", sku: "CJYD229333315OL", cjVid: "2502170330091608900", priceCents: 1299, inventoryQty: 300 },
      { name: "Mustard Green · 2XL", sku: "CJYD229333316PK", cjVid: "2502170330091609100", priceCents: 1299, inventoryQty: 300 },
      { name: "Mustard Green · 3XL", sku: "CJYD229333317QJ", cjVid: "2502170330091609200", priceCents: 1299, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Shoes & Socks -- real supplier listing, CJ pid E1AE8A64-6DA0-4FE6-8487-43F61733EE97, supplier SKU CJJJCWGD00138.
  { name: "Pet shoes wear dog shoes",
    slug: "pet-shoes-wear-dog-shoes", category: "Pet Shoes & Socks",
    description: "Waterproof PVC sole helps keep your feet dry, so dogs can wear them on light snow or muddy and wet streets.\n\nBuilt to last: made from cloth, and it weighs around 89.00 g.\n\nChoose the option that suits your pet - Black No1, Black No7, Black No8, black 4, black 5, black 2, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- The non-slip sturdy sole provides a protective layer to withstand hot and cold surfaces such as ice and snow.\n- Adjustable fuzzy belt, easy to put on and take off.",
    priceCents: 1499, images: [`https://media.petparcel.store/products/4f3d8f6806822e466f8a.webp`, `https://media.petparcel.store/products/76bf1f01b934cae9d68c.webp`, `https://media.petparcel.store/products/de0317b807ee510dd652.webp`, `https://media.petparcel.store/products/e9ff7df8b10a2d989bf8.webp`, `https://media.petparcel.store/products/ea60fd8dbb369817f030.webp`], tags: ["Pet Shoes & Socks", "US warehouse"], featured: false, sortOrder: 163,
    variants: [
      { name: "Black No1", sku: "CJJJCWGD00138-Black-No1", cjVid: "1775463530943221760", priceCents: 1499, inventoryQty: 300 },
      { name: "Black No7", sku: "CJJJCWGD00138-Black-No7", cjVid: "1775463530997747712", priceCents: 1499, inventoryQty: 300 },
      { name: "Black No8", sku: "CJJJCWGD00138-Black-No8", cjVid: "1775463531056467968", priceCents: 1499, inventoryQty: 300 },
      { name: "black · 4", sku: "CJJJCWGD00138-black-4", cjVid: "3A03C393-9C3B-4505-8D5F-66F97B5429CA", priceCents: 1499, inventoryQty: 300 },
      { name: "black · 5", sku: "CJJJCWGD00138-black-5", cjVid: "45A9100E-7839-40AF-8CE7-5569910253FC", priceCents: 1499, inventoryQty: 300 },
      { name: "black · 2", sku: "CJJJCWGD00138-black-2", cjVid: "85D4D120-930A-4850-B4DE-E3F53811EF91", priceCents: 1499, inventoryQty: 300 },
      { name: "black · 6", sku: "CJJJCWGD00138-black-6", cjVid: "8B8B5AC3-6B80-4AA9-81A9-31EF82981770", priceCents: 1499, inventoryQty: 300 },
      { name: "black · 3", sku: "CJJJCWGD00138-black-3", cjVid: "94433831-C1F2-4F06-AEED-88B4667816FE", priceCents: 1499, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Scarves -- real supplier listing, CJ pid 1996493861430915074, supplier SKU CJPS2631538.
  { name: "1Pc Adjustable Bandana Leather Pet Collar Triangle Scarf",
    slug: "1pc-adjustable-bandana-leather-pet-collar-triangle-scarf", category: "Pet Scarves",
    description: "1Pc Adjustable Bandana Leather Pet Collar Triangle Scarf is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth and leather, and it weighs around 22 g.\n\nChoose the option that suits your pet - Red L, Blue L, Pink M, Blue M.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 2199, images: [`https://media.petparcel.store/products/9d6a75b500ecc192d3ca.webp`, `https://media.petparcel.store/products/2c23f391beded1816892.webp`, `https://media.petparcel.store/products/229bf609c920c60c0f93.webp`, `https://media.petparcel.store/products/3f992df3ea51534104b9.webp`, `https://media.petparcel.store/products/c205478305a6dd2b356b.webp`], tags: ["Pet Scarves", "US warehouse"], featured: false, sortOrder: 164,
    variants: [
      { name: "Red L", sku: "CJPS263153801AZ", cjVid: "1996493861556744194", priceCents: 2199, inventoryQty: 100 },
      { name: "Blue L", sku: "CJPS263153802BY", cjVid: "1996493861556744195", priceCents: 2199, inventoryQty: 100 },
      { name: "Pink M", sku: "CJPS263153803CX", cjVid: "1996493861556744196", priceCents: 2199, inventoryQty: 100 },
      { name: "Blue M", sku: "CJPS263153804DW", cjVid: "1996493861556744197", priceCents: 2199, inventoryQty: 100 },
    ],
    reviews: [] },
  // -- Bird Supplies -- real supplier listing, CJ pid 1990620139723874305, supplier SKU CJBF2600938.
  { name: "Outdoor Wild Bird Feeder Squirrel-Proof Chew-Proof Metal Hanging Seed Feeder With 4 Feeding Ports For Small Songbirds",
    slug: "outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w", category: "Bird Supplies",
    description: "Highlights Effectively prevent annoyed unwanted guest, like squirrels or larger birds from overtaking the food.\n\nLightweight and easy to handle at around 1000 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- 4 Feeding ports let your kids observe 4 birds feeding simultaneously.\n- Withstand different weather conditions, like rain, wind, snow, heat, frost,.\n- The top lid is easy to open and refill food.\n- Enjoy the leisure time of bird watching.",
    priceCents: 5699, images: [`https://media.petparcel.store/products/7d867f8ce51c8ee8bcbf.webp`, `https://media.petparcel.store/products/b107b81f996ec5fe149a.webp`, `https://media.petparcel.store/products/9bb64df1603e89d7c3f2.webp`, `https://media.petparcel.store/products/e9c4f715b9eed59c0ed1.webp`, `https://media.petparcel.store/products/b8bc9525c2e484e548ee.webp`], tags: ["Bird Supplies", "US warehouse"], featured: false, sortOrder: 165,
    variants: [
      { name: "BirdFeeder", sku: "CJBF26009380001", cjVid: "1990620139811954690", priceCents: 5699, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Bird Feeders -- real supplier listing, CJ pid 1993023312350330882, supplier SKU CJBF2619195.
  { name: "Smart Bird Feeder With Camera AI Identify 10000+ Bird Specie Solar-Powered",
    slug: "smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered", category: "Bird Feeders",
    description: "AI Identify 10,000+ Bird Species: VEVOR smart bird feeder with camera features an advanced AI recognition system (30-day free) that can identify 10,000+ bird species.\n\nLightweight and easy to handle at around 2400 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- It automatically captures and identifies every visiting bird, while notifying you instantly via the phone app.\n- Stable 2.4GHz Wi-Fi connectivity and convenient app control allow you to enjoy real-time birdwatching on your phone.\n- Watch, Talk, and Enjoy: Enjoy 100+ bird videos every day with our lifetime free cloud (3 days) and cloud storage (30-day trial).\n- Our smart bird house includes audible alarm and two-way audio, allowing you to scare away squirrels while talking with birds and hearing their sounds.",
    priceCents: 9899, images: [`https://media.petparcel.store/products/71d148f5aa88b8de72c1.webp`, `https://media.petparcel.store/products/d2b9e7854a59f33021fa.webp`, `https://media.petparcel.store/products/f5d48bdc43b5531349a9.webp`, `https://media.petparcel.store/products/b32eca6d4ac7d009ae4f.webp`, `https://media.petparcel.store/products/32dc6f6fd9ec1b137952.webp`], tags: ["Bird Feeders", "US warehouse"], featured: false, sortOrder: 166,
    variants: [
      { name: "Multicolor", sku: "CJBF26191950001", cjVid: "1993023312597794817", priceCents: 9899, inventoryQty: 102 },
    ],
    reviews: [] },
  // -- Bird Cages -- real supplier listing, CJ pid 2034276978397466625, supplier SKU CJBC2793641.
  { name: "45-inch Metal Indoor Bird Cage, Parrot Cage, Bird Aviary with Detachable Rolling Stand, Storage Basket, and Accessories - Black",
    slug: "45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling", category: "Bird Cages",
    description: "45-inch Metal Indoor Bird Cage, Parrot Cage, Bird Aviary with Detachable Rolling Stand, Storage Basket, and Accessories - Black is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 8600 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 12399, images: [`https://media.petparcel.store/products/e2515469c1dc40e0d4c2.webp`, `https://media.petparcel.store/products/745e3ef5ad9dde6022aa.webp`, `https://media.petparcel.store/products/59dcae3bc34a71a6e17f.webp`, `https://media.petparcel.store/products/a466602d87bce601211d.webp`, `https://media.petparcel.store/products/f34476e4611ab14aad3f.webp`], tags: ["Bird Cages", "US warehouse"], featured: false, sortOrder: 167,
    variants: [
      { name: "BLACK-850x480x230 mm", sku: "CJBC27936410001", cjVid: "2034276980054216705", priceCents: 12399, inventoryQty: 118 },
    ],
    reviews: [] },
  // -- Bird Swings -- real supplier listing, CJ pid 2095007330227707906, supplier SKU CJBS3119475.
  { name: "Parrot Playstand Bird Plays Stand Cockatiel Playground Wooden Perch Gym Play",
    slug: "parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play", category: "Bird Swings",
    description: "Made of wood material, safe and non-toxic.\n\nLightweight and easy to handle at around 925 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Portable Parrot Stand is easy to move throughout your home.\n- You can put it in the bird cage as a bird cage rack.\n- Keep your pet bird entertained for hours, a great gift for your bird.\n- Multifunctional ladder toy, suitable for cockatiel, parrot, bird Package: 1* swing toy.",
    priceCents: 3299, images: [`https://media.petparcel.store/products/6aaa196cf411330036fd.webp`, `https://media.petparcel.store/products/1402cf1bc6065be3c617.webp`, `https://media.petparcel.store/products/df824c4975aecaa309f9.webp`, `https://media.petparcel.store/products/f71c12b1bba9fb670638.webp`, `https://media.petparcel.store/products/9253340cb6d72459ce84.webp`], tags: ["Bird Swings", "Tracking"], featured: false, sortOrder: 168,
    variants: [
      { name: "A", sku: "CJBS311947501AZ", cjVid: "2095007330408062977", priceCents: 3299, inventoryQty: 53 },
    ],
    reviews: [] },
  // -- Bird Toys -- real supplier listing, CJ pid 2085855419489247233, supplier SKU CJBT3044754.
  { name: "Bird Parakeet Toys Swing Hanging Standing Chewing Hammock Climbing Ladder Bird Cage Colorful Toys Suitable For Budgerigar",
    slug: "bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird", category: "Bird Toys",
    description: "11 PIECES BIRD TOYS: The bird toys include 11Pieces parrot toys to meet most bird's needs.\n\nLightweight and easy to handle at around 200 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- It's the perfect gift for your bird friends.\n- SAFE: These small interesting Bird toys are made of natural wood that dyed with edible color,which ensure the health and safety of your pet birds.\n- They are completely handmade, very durable and bite-resistant.\n- They can easily draw the attention of your pet parrots in a short time,climbbing and exploring.",
    priceCents: 7899, images: [`https://media.petparcel.store/products/310cf8f19f2f500f692b.webp`, `https://media.petparcel.store/products/fb88488199d40a83e83a.webp`, `https://media.petparcel.store/products/18b4a4443c5e529597a0.webp`, `https://media.petparcel.store/products/4ffcb9d028a1f076cd7a.webp`, `https://media.petparcel.store/products/2626e1f0e2b8db3a53dc.webp`], tags: ["Bird Toys", "US warehouse"], featured: false, sortOrder: 169,
    variants: [
      { name: "MULTICOLOR", sku: "CJBT304475401AZ", cjVid: "2085855419623464961", priceCents: 7899, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Bird Travel Bags -- real supplier listing, CJ pid 1470579871485923328, supplier SKU CJNY1379586.
  { name: "Convenient Outing Parrot Myna Bird Cage",
    slug: "convenient-outing-parrot-myna-bird-cage", category: "Bird Travel Bags",
    description: "Bag internal structure: zipper pocket.\n\nBuilt to last: made from plastic, and it weighs around 1000.00 g.\n\nChoose the option that suits your pet - Yellow, Red, Purple, Green, Black, Dark Blue, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Applicable gender: neutral/male and female.",
    priceCents: 1199, images: [`https://media.petparcel.store/products/d86e9e0ec0b57e396012.webp`, `https://media.petparcel.store/products/4252bf0667e26a43442f.webp`, `https://media.petparcel.store/products/2c73c168ffce983b8bdd.webp`, `https://media.petparcel.store/products/f55a1ebc6528323ce126.webp`, `https://media.petparcel.store/products/e51f51182a1608814026.webp`], tags: ["Bird Travel Bags", "Tracking"], featured: false, sortOrder: 170,
    variants: [
      { name: "Yellow", sku: "CJNY137958601AZ", cjVid: "1470579871565615104", priceCents: 1199, inventoryQty: 300 },
      { name: "Red", sku: "CJNY137958602BY", cjVid: "1470579871569809408", priceCents: 1199, inventoryQty: 300 },
      { name: "Purple", sku: "CJNY137958603CX", cjVid: "1470579871574003712", priceCents: 1199, inventoryQty: 300 },
      { name: "Green", sku: "CJNY137958604DW", cjVid: "1470579871574003713", priceCents: 1199, inventoryQty: 300 },
      { name: "Black", sku: "CJNY137958605EV", cjVid: "1470579871574003714", priceCents: 1199, inventoryQty: 300 },
      { name: "Dark Blue", sku: "CJNY137958606FU", cjVid: "1470579871578198016", priceCents: 1199, inventoryQty: 300 },
      { name: "Pink", sku: "CJNY137958607GT", cjVid: "1470579871578198017", priceCents: 1199, inventoryQty: 300 },
      { name: "Grey", sku: "CJNY137958608HS", cjVid: "1470579871578198018", priceCents: 1199, inventoryQty: 300 },
      { name: "Light Blue", sku: "CJNY137958609IR", cjVid: "1470579871582392320", priceCents: 1199, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Bird Accessories -- real supplier listing, CJ pid 2607130732231612100, supplier SKU CJYD2982071.
  { name: "Parrot Out Rope Towing Anti Loss Flight Suit",
    slug: "parrot-out-rope-towing-anti-loss-flight-suit", category: "Bird Accessories",
    description: "Parrot Out Rope Towing Anti Loss Flight Suit is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 17.00 g.\n\nChoose the option that suits your pet - 1 Meter Purple 4x8cm, 1 Meter Purple 5x8.5cm, 1 Meter Purple 5.5x10cm, 1 Meter Purple 6x10.5cm, 1 Meter Purple 12x7cm, 1 Meter Purple 13x7.5cm, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 399, images: [`https://media.petparcel.store/products/2aecfaf2c6c65087eb78.webp`, `https://media.petparcel.store/products/f8ae43ab38d9bcd88bd2.webp`, `https://media.petparcel.store/products/d825b57c7b8940b1c6ab.webp`, `https://media.petparcel.store/products/47278d5accdd28c0d470.webp`, `https://media.petparcel.store/products/697fb31ec0b8a70b0f94.webp`], tags: ["Bird Accessories", "Tracking"], featured: false, sortOrder: 171,
    variants: [
      { name: "1 Meter Purple · 4x8cm", sku: "CJYD298207101AZ", cjVid: "2607130732231613200", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Purple · 5x8.5cm", sku: "CJYD298207102BY", cjVid: "2607130732231613900", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Purple · 5.5x10cm", sku: "CJYD298207103CX", cjVid: "2607130732231614400", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Purple · 6x10.5cm", sku: "CJYD298207104DW", cjVid: "2607130732231614900", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Purple · 12x7cm", sku: "CJYD298207105EV", cjVid: "2607130732231615500", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Purple · 13x7.5cm", sku: "CJYD298207106FU", cjVid: "2607130732231616300", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Blue · 4x8cm", sku: "CJYD298207108HS", cjVid: "2607130732231616900", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Blue · 5x8.5cm", sku: "CJYD298207109IR", cjVid: "2607130732231617500", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Blue · 5.5x10cm", sku: "CJYD298207110JQ", cjVid: "2607130732231618100", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Blue · 6x10.5cm", sku: "CJYD298207111KP", cjVid: "2607130732231618700", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Blue · 12x7cm", sku: "CJYD298207112LO", cjVid: "2607130732231619201", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Blue · 13x7.5cm", sku: "CJYD298207113MN", cjVid: "2607130732231619700", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Green · 4x8cm", sku: "CJYD298207116PK", cjVid: "2607130732241610400", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Green · 5x8.5cm", sku: "CJYD298207117QJ", cjVid: "2607130732241611000", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Green · 5.5x10cm", sku: "CJYD298207118RI", cjVid: "2607130732241611500", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Green · 6x10.5cm", sku: "CJYD298207119SH", cjVid: "2607130732241612000", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Green · 12x7cm", sku: "CJYD298207120TG", cjVid: "2607130732241612500", priceCents: 399, inventoryQty: 300 },
      { name: "1 Meter Green · 13x7.5cm", sku: "CJYD298207121UF", cjVid: "2607130732241612900", priceCents: 399, inventoryQty: 300 },
      { name: "2 Meters Purple · 4x8cm", sku: "CJYD298207125YB", cjVid: "2607130732241613400", priceCents: 399, inventoryQty: 300 },
      { name: "2 Meters Purple · 5x8.5cm", sku: "CJYD298207126ZA", cjVid: "2607130732241613900", priceCents: 399, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Groomings -- real supplier listing, CJ pid 2081495460923068417, supplier SKU CJHR3009622.
  { name: "Comb With Rubber Handle, Flea And Tick Combs For Dogs Cats, Fine Tooth Dog Comb For Grooming",
    slug: "comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb", category: "Pet Groomings",
    description: "Comb With Rubber Handle, Flea And Tick Combs For Dogs Cats, Fine Tooth Dog Comb For Grooming is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nLightweight and easy to handle at around 50 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 2799, images: [`https://media.petparcel.store/products/3fb2f9c741ce50021ded.webp`, `https://media.petparcel.store/products/7269fc629c8c1aee8192.webp`, `https://media.petparcel.store/products/2acb34eccebfac11079a.webp`, `https://media.petparcel.store/products/e5bbbe2f7d6172605671.webp`, `https://media.petparcel.store/products/6fbd89cf23318afd9642.webp`], tags: ["Pet Groomings", "US warehouse"], featured: false, sortOrder: 172,
    variants: [
      { name: "PURPLE", sku: "CJHR300962201AZ", cjVid: "2081495461078257665", priceCents: 2799, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Pet Hair Removers & Combs -- real supplier listing, CJ pid 2097552582825844737, supplier SKU CJHR3147848.
  { name: "Pet Dog Grooming Scissors Stainless Straight Curved Thinning Shears Trimmer Kits",
    slug: "pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki", category: "Pet Hair Removers & Combs",
    description: "Comes with 7-inch cutting scissors, thinning shear, curved scissors, a grooming comb for removes tangles, mats, loose hair and dirt, Stimulates skin and hair follicles.\n\nLightweight and easy to handle at around 454 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Heavy Duty Stainless Steel Construction.\n- All Shears and grooming combs are made with heavy duty Stainless Steel, Coated Titanium and Cold treatment for hardness, durability and style; The blade of scissors is very smooth, sharp and durable without rusting.\n- This process reduces the friction to shear pet hair breezily.\n- Complete Dog & Cat Grooming Kits.",
    priceCents: 3299, images: [`https://media.petparcel.store/products/e0f291eb5870ef058a56.webp`, `https://media.petparcel.store/products/0288be1f554f13341f24.webp`, `https://media.petparcel.store/products/ef77cb5704fecec6ea67.webp`, `https://media.petparcel.store/products/a2b6d04bbf979e850243.webp`, `https://media.petparcel.store/products/7849d1511ceabeb0a339.webp`], tags: ["Pet Hair Removers & Combs", "US warehouse"], featured: false, sortOrder: 173,
    variants: [
      { name: "Standard", sku: "CJHR31478480001", cjVid: "2097552582997811201", priceCents: 3299, inventoryQty: 300 },
    ],
    reviews: [] },
  // -- Pet Nail Polishers -- real supplier listing, CJ pid 2082225432455663618, supplier SKU CJNP3015338.
  { name: "Cat Grooming Hammock Kit For Cats Dogs Up To 12 Lb, Hanging Harness And Sling For Nail Trimming, Includes Clippers Trimmer",
    slug: "cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f", category: "Pet Nail Polishers",
    description: "Grooming Hammock The PatiencET dog grooming hammock can be used for grooming your dog easily at home, such as trimming nails, grooming, bathing, eye & ear health care.\n\nLightweight and easy to handle at around 200 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- Comfortable and Safe It adopts a double-layer design and has been upgraded at the front and rear ends, making it more soft and comfortable.\n- Mesh design for better breathability.\n- It is equipped with a seat belt to prevent pets from running around, making it safer.\n- It is suitable for kittens and small to medium-sized dogs.",
    priceCents: 7199, images: [`https://media.petparcel.store/products/9b18dd5450d27986134e.webp`, `https://media.petparcel.store/products/77877e701f675c072ad4.webp`, `https://media.petparcel.store/products/95f128aacd8c553874c4.webp`, `https://media.petparcel.store/products/f9817ec4b8da00f2a010.webp`, `https://media.petparcel.store/products/a03a1f95faec5246cb80.webp`], tags: ["Pet Nail Polishers", "US warehouse"], featured: false, sortOrder: 174,
    variants: [
      { name: "BLACK", sku: "CJNP301533801AZ", cjVid: "2082225432665378817", priceCents: 7199, inventoryQty: 50 },
    ],
    reviews: [] },
  // -- Pet Shower Products -- real supplier listing, CJ pid 2102706478231511042, supplier SKU CJSP3190960.
  { name: "2 Pack Long & Short Handheld Dog Cat Shower Brush With Liquid Dispenser, Soft Silicone Grooming Brush For Pet Bathing & Massage",
    slug: "2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil", category: "Pet Shower Products",
    description: "Includes long-handle brush and compact handheld brush, meet different grooming needs for dogs, cats and other pets.\n\nLightweight and easy to handle at around 180 g.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.\n\n- One-Press Liquid Dispensing Design.\n- Fill shampoo inside the transparent container, press the button to release soap easily during bathing.\n- Gentle on pet skin, deep clean fur while offering soothing massage, no scratch to sensitive skin.\n- Comfortable handle for stable holding when washing pets, easy to operate and rinse clean after use.",
    priceCents: 2899, images: [`https://media.petparcel.store/products/d38d5482f811cda087f9.webp`, `https://media.petparcel.store/products/df577efaab559087080b.webp`, `https://media.petparcel.store/products/63e2054b8eadd1160f24.webp`, `https://media.petparcel.store/products/8a65930a3c83d66f12a4.webp`, `https://media.petparcel.store/products/43973a89b1c3578660ef.webp`], tags: ["Pet Shower Products", "US warehouse"], featured: false, sortOrder: 175,
    variants: [
      { name: "2 pcs", sku: "CJSP319096001AZ", cjVid: "2102706478390894594", priceCents: 2899, inventoryQty: 61 },
    ],
    reviews: [] },
  // -- Pet Towels -- real supplier listing, CJ pid 1879079284534824962, supplier SKU CJPT2270446.
  { name: "Pet Towel Dog Bathrobe Water Absorbent And Quick Drying Cleaning Beauty Glove Style Pocket Dog Bath Towel Accessori Cani",
    slug: "pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove", category: "Pet Towels",
    description: "Pet Towel Dog Bathrobe Water Absorbent And Quick Drying Cleaning Beauty Glove Style Pocket Dog Bath Towel Accessori Cani is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.\n\nBuilt to last: made from cloth, and it weighs around 240 g.\n\nChoose the option that suits your pet - BLUE-M 100x50cm, BLUE-L 130x70cm, GREEN-M 100x50cm, GREEN-L 130x70cm, Brown-M 100x50cm, Brown-L 130x70cm, and more.\n\nShips fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.",
    priceCents: 1099, images: [`https://media.petparcel.store/products/b6d706406d70492f6b85.webp`, `https://media.petparcel.store/products/92964a73fad6bb4037d5.webp`, `https://media.petparcel.store/products/3bdb196dc0729c3c86c5.webp`, `https://media.petparcel.store/products/b4357e92f548fa2b9fdf.webp`, `https://media.petparcel.store/products/8450316aca26089a5e51.webp`], tags: ["Pet Towels", "Tracking"], featured: false, sortOrder: 176,
    variants: [
      { name: "BLUE-M · 100x50cm", sku: "CJPT227044601AZ", cjVid: "1879079284576768002", priceCents: 1099, inventoryQty: 300 },
      { name: "BLUE-L · 130x70cm", sku: "CJPT227044602BY", cjVid: "1879079284576768003", priceCents: 1099, inventoryQty: 300 },
      { name: "GREEN-M · 100x50cm", sku: "CJPT227044603CX", cjVid: "1879079284576768004", priceCents: 1099, inventoryQty: 300 },
      { name: "GREEN-L · 130x70cm", sku: "CJPT227044604DW", cjVid: "1879079284576768005", priceCents: 1099, inventoryQty: 300 },
      { name: "Brown-M · 100x50cm", sku: "CJPT227044605EV", cjVid: "1879079284576768006", priceCents: 1099, inventoryQty: 300 },
      { name: "Brown-L · 130x70cm", sku: "CJPT227044606FU", cjVid: "1879079284576768007", priceCents: 1099, inventoryQty: 300 },
      { name: "PINK-M · 100x50cm", sku: "CJPT227044607GT", cjVid: "1879079284576768008", priceCents: 1099, inventoryQty: 300 },
      { name: "PINK-L · 130x70cm", sku: "CJPT227044608HS", cjVid: "1879079284576768009", priceCents: 1099, inventoryQty: 300 },
      { name: "GRAY-M · 100x50cm", sku: "CJPT227044609IR", cjVid: "1879079284576768010", priceCents: 1099, inventoryQty: 300 },
      { name: "GRAY-L · 130x70cm", sku: "CJPT227044610JQ", cjVid: "1879079284576768011", priceCents: 1099, inventoryQty: 300 },
    ],
    reviews: [] },
];

/** The catalog every side of the store reads, with each product's real specs
 *  attached. `?? {}` keeps a product that was added without specs working -
 *  its Product Details tab just has fewer rows - and `catalog-specs.test.ts`
 *  fails the build if any product in the list is missing them. */
export const CATALOG_DATA: SeedProduct[] = BASE_CATALOG.map((item) => ({
  ...item,
  specs: PRODUCT_SPECS[item.slug] ?? {},
  seededAt: CATALOG_SEEDED_AT,
}));

/** Store-wide testimonials. Empty on purpose: testimonials are real customer
 *  reviews (product_id IS NULL) that an admin has approved, never seeded copy. */
export const TESTIMONIALS: SeedReview[] = [];

/** Reviewer presentation now lives in `./reviewers`.
 *
 *  It moved out of this file for a concrete reason: these are `const` bindings,
 *  so a client component that imported one of them forced the bundler to keep
 *  this whole ~270 kB catalogue in the initial JavaScript of every page. A
 *  re-export is deliberately NOT left behind here, because that would rebuild
 *  the exact dependency the move removes. */
