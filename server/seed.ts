// Idempotent demo-data seeder. Safe to run repeatedly: it only inserts what is
// missing, so a re-run never duplicates the catalog or the reviews.
//
//   pnpm seed
//
// Run it once after `pnpm db:migrate` so a fresh clone looks like a real store
// (products, variants, inventory, reviews, testimonials, store settings).
//
// The catalog below mirrors the kind of pet supplies a US dropshipper sources
// from CJdropshipping's Pet Supplies category — dog & cat gear, grooming tools,
// feeding gadgets and travel accessories — with realistic US retail pricing.
// The owner replaces images and copy from the admin panel; nothing here is
// hardcoded into the storefront.
import { eq, sql } from "drizzle-orm";
import { db } from "./_core/db";
import {
  orderEvents,
  orderItems,
  orders,
  productVariants,
  products,
  reviews,
  storeSettings,
} from "../drizzle/schema";
import { SETTINGS_DEFAULTS } from "../shared/store";

type SeedVariant = { name: string; sku: string; priceCents: number; inventoryQty: number };

type SeedProduct = {
  name: string;
  slug: string;
  category: string;
  description: string;
  priceCents: number;
  compareAtCents?: number;
  images: string[];
  tags: string[];
  featured: boolean;
  sortOrder: number;
  variants: SeedVariant[];
  reviews: { authorName: string; rating: number; title: string; body: string }[];
};

const CATALOG: SeedProduct[] = [
  {
    name: "TrekMate No-Pull Dog Harness",
    slug: "trekmate-no-pull-dog-harness",
    category: "Dogs",
    description:
      "A front-clip, padded harness that stops pulling without choking. The martingale loop redirects forward motion, four adjustment points fit a deep-chested dog, and reflective stitching keeps evening walks visible. Rated for daily walks and weekend hikes alike.",
    priceCents: 3499,
    compareAtCents: 4499,
    images: ["/products/harness.jpg"],
    tags: ["Best seller", "No-pull", "Reflective"],
    featured: true,
    sortOrder: 1,
    variants: [
      { name: "S (14–20 in girth)", sku: "PP-HARN-S", priceCents: 2999, inventoryQty: 42 },
      { name: "M (20–27 in girth)", sku: "PP-HARN-M", priceCents: 3499, inventoryQty: 58 },
      { name: "L (27–35 in girth)", sku: "PP-HARN-L", priceCents: 3999, inventoryQty: 31 },
      { name: "XL (35–44 in girth)", sku: "PP-HARN-XL", priceCents: 4499, inventoryQty: 4 },
    ],
    reviews: [
      {
        authorName: "Priya S.",
        rating: 5,
        title: "Walked a 70lb husky with two fingers",
        body: "The front clip is the real deal. Reflective stitching is bright at night too. Ordered a second one for my mum's beagle.",
      },
      {
        authorName: "Curtis L.",
        rating: 5,
        title: "Finally one that fits a boxer",
        body: "Every other harness sat too high on his chest. The four adjusters fixed that. Hardware feels solid.",
      },
    ],
  },
  {
    name: "CloudNine Orthopedic Dog Bed",
    slug: "cloudnine-orthopedic-dog-bed",
    category: "Dogs",
    description:
      "A 4-inch memory-foam base that takes the pressure off hips and joints, wrapped in a removable, machine-washable cover. Senior dogs and big breeds fall asleep on it in minutes — and the non-slip base keeps it where you put it.",
    priceCents: 7999,
    compareAtCents: 9999,
    images: ["/products/dogbed.jpg"],
    tags: ["Best seller", "Orthopedic", "Machine washable"],
    featured: true,
    sortOrder: 2,
    variants: [
      { name: "Small (24\")", sku: "PP-BED-S", priceCents: 5999, inventoryQty: 24 },
      { name: "Medium (32\")", sku: "PP-BED-M", priceCents: 7999, inventoryQty: 33 },
      { name: "Large (40\")", sku: "PP-BED-L", priceCents: 9999, inventoryQty: 19 },
      { name: "X-Large (48\")", sku: "PP-BED-XL", priceCents: 11999, inventoryQty: 3 },
    ],
    reviews: [
      {
        authorName: "Megan R.",
        rating: 5,
        title: "Our 11-year-old lab sleeps through the night again",
        body: "He used to pace at 3am. Two weeks on this bed and he's out cold till morning. The cover washes up perfectly after a muddy day.",
      },
      {
        authorName: "Daniel O.",
        rating: 4,
        title: "Great bed, runs a touch warm",
        body: "No complaints from the dog, and the foam genuinely rebounds. Only note is it holds heat in summer — we put a cotton sheet over it.",
      },
    ],
  },
  {
    name: "TuffRope Braided Chew Toy",
    slug: "tuffrope-braided-chew-toy",
    category: "Dogs",
    description:
      "Tightly braided cotton that stands up to determined chewers and flosses teeth while it's at it. No plastic squeaker to swallow, no dye that runs. Machine washable, and it doubles as a game of tug.",
    priceCents: 1899,
    compareAtCents: 2499,
    images: ["/products/rope.jpg"],
    tags: ["Best seller", "Durable", "Dental"],
    featured: true,
    sortOrder: 3,
    variants: [
      { name: "Medium (11 in)", sku: "PP-ROPE-M", priceCents: 1899, inventoryQty: 64 },
      { name: "Large (15 in)", sku: "PP-ROPE-L", priceCents: 2299, inventoryQty: 38 },
    ],
    reviews: [
      {
        authorName: "Alex T.",
        rating: 5,
        title: "Survived a pit mix for three months",
        body: "Everything else is shredded in a week. This one is still going and it cleans his teeth. Buying two more.",
      },
    ],
  },
  {
    name: "SlowFeast Maze Bowl",
    slug: "slowfeast-maze-bowl",
    category: "Feeding",
    description:
      "A maze of ridges that stretches a 60-second meal into ten minutes. Slower eating means less gulped air, less bloating, and a dog that isn't begging again at noon. Dishwasher safe with a non-slip base.",
    priceCents: 1599,
    images: ["/products/slowbowl.jpg"],
    tags: ["Anti-gulp", "Non-slip", "Dishwasher safe"],
    featured: false,
    sortOrder: 4,
    variants: [
      { name: "Small (1.5 cups)", sku: "PP-BOWL-S", priceCents: 1299, inventoryQty: 52 },
      { name: "Large (3 cups)", sku: "PP-BOWL-L", priceCents: 1599, inventoryQty: 44 },
    ],
    reviews: [
      {
        authorName: "Tomas E.",
        rating: 5,
        title: "No more post-dinner vomiting",
        body: "The vet suggested a slow feeder and this one actually slows him down. Cleans up easily.",
      },
    ],
  },
  {
    name: "FrostPaw Cooling Mat",
    slug: "frostpaw-cooling-mat",
    category: "Dogs",
    description:
      "Pressure-activated gel that pulls heat away the moment your dog lies down — no water, no electricity, no fridge. Recharges itself after a few minutes off the mat. Folds flat for the car or the crate.",
    priceCents: 3999,
    compareAtCents: 4999,
    images: ["/products/coolmat.jpg"],
    tags: ["Best seller", "Summer", "No power needed"],
    featured: true,
    sortOrder: 5,
    variants: [
      { name: "Medium (20×16 in)", sku: "PP-COOL-M", priceCents: 3999, inventoryQty: 36 },
      { name: "Large (28×20 in)", sku: "PP-COOL-L", priceCents: 4999, inventoryQty: 21 },
    ],
    reviews: [
      {
        authorName: "Hannah B.",
        rating: 5,
        title: "Saved our summer",
        body: "Our flat-faced pug actually lies on it instead of panting on the tile. Stays cool for hours.",
      },
      {
        authorName: "Ken A.",
        rating: 4,
        title: "Works well, wipe it down",
        body: "Genuinely cool to the touch. Just wipe the surface after muddy paws or it gets grimy.",
      },
    ],
  },
  {
    name: "NightWalk LED Retractable Leash",
    slug: "nightwalk-led-retractable-leash",
    category: "Dogs",
    description:
      "A 16-foot retractable leash with a built-in LED torch for early walks and late nights. One-thumb brake and lock, a tangle-free tape, and a rechargeable battery that lasts a week of walks.",
    priceCents: 2799,
    images: ["/products/leash.jpg"],
    tags: ["LED", "Rechargeable", "16 ft"],
    featured: false,
    sortOrder: 6,
    variants: [
      { name: "Up to 55 lb", sku: "PP-LEASH-S", priceCents: 2799, inventoryQty: 40 },
      { name: "Up to 110 lb", sku: "PP-LEASH-L", priceCents: 3299, inventoryQty: 26 },
    ],
    reviews: [
      {
        authorName: "Rosa M.",
        rating: 5,
        title: "The light is brighter than my phone",
        body: "Great for 6am walks in winter. The brake is smooth and the tape doesn't jam like my old one.",
      },
    ],
  },
  {
    name: "FurAway Grooming Glove",
    slug: "furaway-grooming-glove",
    category: "Grooming",
    description:
      "255 soft silicone tips that lift loose hair and undercoat while your pet thinks it's being petted. Works wet or dry, and the hair peels off in one sheet. A favourite for cats and short-haired dogs that hate brushes.",
    priceCents: 1699,
    compareAtCents: 2199,
    images: ["/products/glove.jpg"],
    tags: ["Best seller", "De-shedding", "Gentle"],
    featured: true,
    sortOrder: 7,
    variants: [
      { name: "Right hand", sku: "PP-GLOVE-R", priceCents: 1699, inventoryQty: 70 },
      { name: "Left hand", sku: "PP-GLOVE-L", priceCents: 1699, inventoryQty: 55 },
      { name: "Pair", sku: "PP-GLOVE-P", priceCents: 2999, inventoryQty: 30 },
    ],
    reviews: [
      {
        authorName: "Grace W.",
        rating: 5,
        title: "My cat actually purrs through it",
        body: "She runs from the brush but sits still for this. Pulls off a shocking amount of fur.",
      },
      {
        authorName: "Ben C.",
        rating: 5,
        title: "Cheaper than a groomer visit",
        body: "Does 90% of what the groomer does for shedding. The hair comes off in one piece.",
      },
    ],
  },
  {
    name: "GlowTrim LED Nail Clipper",
    slug: "glowtrim-led-nail-clipper",
    category: "Grooming",
    description:
      "A built-in LED that lights the quick so you can see exactly where to cut — no more nicked paws. Stainless blades, a safety guard, and a non-slip grip. For dogs and cats.",
    priceCents: 1999,
    images: ["/products/nailclipper.jpg"],
    tags: ["LED", "Safety guard", "Stainless"],
    featured: false,
    sortOrder: 8,
    variants: [
      { name: "Standard", sku: "PP-NAIL-STD", priceCents: 1999, inventoryQty: 48 },
    ],
    reviews: [
      {
        authorName: "Leah S.",
        rating: 5,
        title: "No more guessing the quick",
        body: "The light makes it obvious where to stop. First time I've trimmed without a yelp.",
      },
    ],
  },
  {
    name: "AquaPurr Cat Water Fountain",
    slug: "aquapurr-cat-water-fountain",
    category: "Cats",
    description:
      "A quiet recirculating pump and a wide stainless-steel drinking tray. Moving water encourages cats to drink more, and the triple filter catches hair and grit. Whisper-quiet at under 30dB.",
    priceCents: 4999,
    compareAtCents: 5999,
    images: ["/products/catfountain.jpg"],
    tags: ["Best seller", "Quiet pump", "Triple filter"],
    featured: true,
    sortOrder: 9,
    variants: [
      { name: "2.5 L", sku: "PP-WATER-25", priceCents: 4999, inventoryQty: 34 },
      { name: "3.5 L", sku: "PP-WATER-35", priceCents: 5999, inventoryQty: 11 },
    ],
    reviews: [
      {
        authorName: "Sofia D.",
        rating: 5,
        title: "My cat drinks so much more now",
        body: "Her vet actually commented on it. The pump is genuinely silent — I only hear it when the reservoir runs low.",
      },
    ],
  },
  {
    name: "FlapJoy Interactive Cat Toy",
    slug: "flapjoy-interactive-cat-toy",
    category: "Cats",
    description:
      "A rechargeable flapping bird that chirps and flutters to trigger your cat's hunting instinct. Touch-activated, with a catnip pouch and a washable plush cover. Turns a bored indoor cat into a busy one.",
    priceCents: 2499,
    compareAtCents: 2999,
    images: ["/products/cattoy.jpg"],
    tags: ["Best seller", "Rechargeable", "Catnip"],
    featured: true,
    sortOrder: 10,
    variants: [
      { name: "Bird", sku: "PP-CATTOY-BIRD", priceCents: 2499, inventoryQty: 45 },
      { name: "Bird + spare cover", sku: "PP-CATTOY-SET", priceCents: 3299, inventoryQty: 20 },
    ],
    reviews: [
      {
        authorName: "Nia F.",
        rating: 5,
        title: "She carries it around like prey",
        body: "Chirps and flaps just enough to keep her interested. Charges over USB in an hour.",
      },
      {
        authorName: "Will H.",
        rating: 4,
        title: "Great, cover needs washing",
        body: "My cat is obsessed. The plush cover gets slobbery so buy the spare set.",
      },
    ],
  },
  {
    name: "DreamNest Donut Cat Bed",
    slug: "dreamnest-donut-cat-bed",
    category: "Cats",
    description:
      "A deep, fluffy ring that cats curl into and knead. Self-warming faux fur holds their own body heat, and the whole thing is machine washable so hair doesn't build up.",
    priceCents: 3299,
    images: ["/products/catbed.jpg"],
    tags: ["Self-warming", "Machine washable"],
    featured: false,
    sortOrder: 11,
    variants: [
      { name: "Medium (20\")", sku: "PP-NEST-M", priceCents: 3299, inventoryQty: 30 },
      { name: "Large (24\")", sku: "PP-NEST-L", priceCents: 3999, inventoryQty: 18 },
    ],
    reviews: [
      {
        authorName: "Grace W.",
        rating: 5,
        title: "Two cats, one bed, daily negotiations",
        body: "They both want it. Holds shape after washing, which is more than I can say for the last one.",
      },
    ],
  },
  {
    name: "TowerScratch Sisal Cat Post",
    slug: "towerscratch-sisal-cat-post",
    category: "Cats",
    description:
      "Floor-to-platform sisal rope that survives determined claws, on a weighted base that doesn't tip mid-pounce. Sturdy enough for a 15lb cat to launch from the top.",
    priceCents: 5499,
    compareAtCents: 6999,
    images: ["/products/scratchpost.jpg"],
    tags: ["Best seller", "Heavy base", "Sisal rope"],
    featured: true,
    sortOrder: 12,
    variants: [
      { name: "24 in", sku: "PP-POST-24", priceCents: 4499, inventoryQty: 22 },
      { name: "32 in", sku: "PP-POST-32", priceCents: 5499, inventoryQty: 15 },
    ],
    reviews: [
      {
        authorName: "Hannah B.",
        rating: 5,
        title: "She stopped shredding the sofa",
        body: "Two days after this arrived the couch was safe again. The sisal is tightly wound, not that flimsy stuff.",
      },
      {
        authorName: "Ken A.",
        rating: 4,
        title: "Solid, assembly takes a minute",
        body: "Sturdy post and a genuinely heavy base. Instructions are one diagram, but it's obvious enough.",
      },
    ],
  },
  {
    name: "CleanPaws Covered Litter Box",
    slug: "cleanpaws-covered-litter-box",
    category: "Cats",
    description:
      "A hooded box that keeps litter off your floor and gives your cat privacy. A charcoal filter traps odours, the high sides stop overspray, and the swing door lifts off for easy scooping. Scoop included.",
    priceCents: 4499,
    images: ["/products/litterbox.jpg"],
    tags: ["Odour filter", "High sides", "Scoop included"],
    featured: false,
    sortOrder: 13,
    variants: [
      { name: "Standard", sku: "PP-LITTER-STD", priceCents: 4499, inventoryQty: 27 },
      { name: "XL", sku: "PP-LITTER-XL", priceCents: 5499, inventoryQty: 12 },
    ],
    reviews: [
      {
        authorName: "Amara K.",
        rating: 5,
        title: "No more litter trails",
        body: "The high sides and door made a huge difference. Filter actually works — no smell in a small apartment.",
      },
    ],
  },
  {
    name: "LickJoy Silicone Lick Mat",
    slug: "lickjoy-silicone-lick-mat",
    category: "Feeding",
    description:
      "A textured silicone mat that turns peanut butter or wet food into ten minutes of calm licking. Great for bath-time distraction, crate training and slowing down fast eaters. Dishwasher safe and freezer-friendly.",
    priceCents: 1499,
    images: ["/products/lickmat.jpg"],
    tags: ["Enrichment", "Freezer safe", "Dishwasher safe"],
    featured: false,
    sortOrder: 14,
    variants: [
      { name: "Small", sku: "PP-LICK-S", priceCents: 1499, inventoryQty: 60 },
      { name: "Large", sku: "PP-LICK-L", priceCents: 1899, inventoryQty: 42 },
    ],
    reviews: [
      {
        authorName: "Jordan P.",
        rating: 5,
        title: "Bath time is finally calm",
        body: "Smear peanut butter on it and my dog forgets he's in the tub. Freezes well for hot days.",
      },
    ],
  },
  {
    name: "MudBuster Paw Cleaner",
    slug: "mudbuster-paw-cleaner",
    category: "Grooming",
    description:
      "A portable cup with soft silicone bristles that cleans muddy paws in seconds — add water, insert paw, twist, dry. Keeps mud off your floors and car seats after every walk.",
    priceCents: 2299,
    compareAtCents: 2799,
    images: ["/products/pawcleaner.jpg"],
    tags: ["Portable", "Soft bristles", "Easy clean"],
    featured: false,
    sortOrder: 15,
    variants: [
      { name: "Small", sku: "PP-PAW-S", priceCents: 2299, inventoryQty: 38 },
      { name: "Large", sku: "PP-PAW-L", priceCents: 2699, inventoryQty: 24 },
    ],
    reviews: [
      {
        authorName: "Curtis L.",
        rating: 5,
        title: "No more muddy footprints",
        body: "Works exactly as shown. My lab's paws come out clean in about ten seconds.",
      },
    ],
  },
  {
    name: "TrailSip 2-in-1 Travel Bottle",
    slug: "trailsip-2-in-1-travel-bottle",
    category: "Travel & Outdoors",
    description:
      "A leakproof water bottle with a fold-out drinking trough and a screw-on food compartment. One hand to operate, so it's perfect for hikes, road trips and the dog park. BPA-free.",
    priceCents: 2299,
    images: ["/products/travelbottle.jpg"],
    tags: ["Best seller", "Leakproof", "BPA-free"],
    featured: true,
    sortOrder: 16,
    variants: [
      { name: "350 ml", sku: "PP-TRAVEL-350", priceCents: 2299, inventoryQty: 44 },
      { name: "550 ml", sku: "PP-TRAVEL-550", priceCents: 2799, inventoryQty: 29 },
    ],
    reviews: [
      {
        authorName: "Will H.",
        rating: 5,
        title: "Lives in my hiking bag",
        body: "No leaks in the pack and the trough is easy for my dog to drink from. The food compartment is a bonus.",
      },
    ],
  },
  {
    name: "VoyagerPet Carrier Backpack",
    slug: "voyagerpet-carrier-backpack",
    category: "Travel & Outdoors",
    description:
      "A soft-sided carrier with mesh windows on three sides, a padded back panel and a safety tether inside. Airline-friendly for small pets and comfortable enough for a full day out.",
    priceCents: 5999,
    compareAtCents: 7499,
    images: ["/products/carrier.jpg"],
    tags: ["Airline friendly", "Ventilated", "Padded"],
    featured: false,
    sortOrder: 17,
    variants: [
      { name: "Up to 12 lb", sku: "PP-CARRY-S", priceCents: 5999, inventoryQty: 20 },
      { name: "Up to 18 lb", sku: "PP-CARRY-L", priceCents: 6999, inventoryQty: 13 },
    ],
    reviews: [
      {
        authorName: "Sofia D.",
        rating: 5,
        title: "My cat travels calmly in it",
        body: "Good ventilation and he can see out. Fits under the seat on a regional flight.",
      },
    ],
  },
  {
    name: "AutoServe Programmable Feeder",
    slug: "autoserve-programmable-feeder",
    category: "Feeding",
    description:
      "Schedule up to four meals a day and let the feeder handle breakfast. A portion-control dial, a voice recorder to call your pet, and a desiccant compartment that keeps kibble fresh. Battery or USB powered.",
    priceCents: 4299,
    compareAtCents: 5299,
    images: ["/products/autofeeder.jpg"],
    tags: ["Best seller", "Programmable", "Voice recorder"],
    featured: true,
    sortOrder: 18,
    variants: [
      { name: "4 L", sku: "PP-FEED-4", priceCents: 4299, inventoryQty: 26 },
      { name: "6 L", sku: "PP-FEED-6", priceCents: 4999, inventoryQty: 14 },
    ],
    reviews: [
      {
        authorName: "Megan R.",
        rating: 5,
        title: "No more 5am wake-ups",
        body: "Set it once and my cat gets breakfast without standing on my chest. The voice recording is a nice touch.",
      },
      {
        authorName: "Daniel O.",
        rating: 4,
        title: "Reliable, app would be nice",
        body: "Does exactly what it says. Programming is on the unit itself, which is fine once you've done it.",
      },
    ],
  },
  {
    name: "SlantSip Ceramic Bowl",
    slug: "slantsip-ceramic-bowl",
    category: "Feeding",
    description:
      "A slanted, elevated ceramic bowl that takes pressure off the neck and helps flat-faced breeds eat comfortably. Heavy enough not to slide, and dishwasher safe. Holds 3 cups.",
    priceCents: 2499,
    images: ["/products/ceramicbowl.jpg"],
    tags: ["Elevated", "Non-slip", "Dishwasher safe"],
    featured: false,
    sortOrder: 19,
    variants: [
      { name: "Single bowl", sku: "PP-CERAMIC-1", priceCents: 2499, inventoryQty: 33 },
      { name: "Set of 2", sku: "PP-CERAMIC-2", priceCents: 4299, inventoryQty: 18 },
    ],
    reviews: [
      {
        authorName: "Leah S.",
        rating: 5,
        title: "Great for my pug",
        body: "The slant means he doesn't gulp air. Looks nice on the floor too, and it's heavy so it stays put.",
      },
    ],
  },
  {
    name: "SnuggleSoft Pet Blanket",
    slug: "snugglesoft-pet-blanket",
    category: "Dogs",
    description:
      "A plush, double-sided throw that gives anxious pets something to knead and burrow into. Warm without being heavy, and it survives the washing machine. Use it on the couch, in the crate or the car.",
    priceCents: 2699,
    images: ["/products/blanket.jpg"],
    tags: ["Cozy", "Machine washable", "Anti-anxiety"],
    featured: false,
    sortOrder: 20,
    variants: [
      { name: "Small (24×30 in)", sku: "PP-BLANK-S", priceCents: 2699, inventoryQty: 40 },
      { name: "Large (40×50 in)", sku: "PP-BLANK-L", priceCents: 3499, inventoryQty: 25 },
    ],
    reviews: [
      {
        authorName: "Amara K.",
        rating: 5,
        title: "Our rescue finally settles",
        body: "He kneads it and falls asleep. Washes up soft every time, no pilling.",
      },
    ],
  },
];

const TESTIMONIALS = [
  {
    authorName: "Jordan P.",
    rating: 5,
    title: "Fast shipping, exactly as pictured",
    body: "Ordered Monday, had it Thursday. The bed is exactly what the photos showed. Will order again for my sister's dog.",
  },
  {
    authorName: "Amara K.",
    rating: 5,
    title: "Support actually answered",
    body: "I ordered the wrong size harness and they swapped it without a fuss. Real humans, quick reply.",
  },
  {
    authorName: "Will H.",
    rating: 5,
    title: "Good prices for the quality",
    body: "Compared this against the big pet stores and it was cheaper for the same thing, and it arrived quickly.",
  },
  {
    authorName: "Nia F.",
    rating: 4,
    title: "Cat approves",
    body: "The scratching post is sturdy and my cat claimed it immediately. Took a few days to arrive, but worth it.",
  },
  {
    authorName: "Ben C.",
    rating: 5,
    title: "Third order this year",
    body: "Consistent quality every time. The slow feeder bowl fixed our lab's gulping problem completely.",
  },
  {
    authorName: "Leah S.",
    rating: 5,
    title: "Great first impression",
    body: "Parcel arrived neatly packed with a little thank-you card. Small thing, but it stood out.",
  },
];

export async function seedCatalog(): Promise<{ products: number; variants: number; reviews: number }> {
  let productCount = 0;
  let variantCount = 0;
  let reviewCount = 0;
  const productIdBySlug = new Map<string, string>();

  for (const item of CATALOG) {
    const [existing] = await db.select().from(products).where(eq(products.slug, item.slug)).limit(1);
    let productId = existing?.id;
    if (!productId) {
      const [row] = await db
        .insert(products)
        .values({
          name: item.name,
          slug: item.slug,
          description: item.description,
          category: item.category,
          priceCents: item.priceCents,
          compareAtCents: item.compareAtCents ?? null,
          images: item.images,
          tags: item.tags,
          active: true,
          featured: item.featured,
          sortOrder: item.sortOrder,
        })
        .returning();
      productId = row.id;
      productCount += 1;
    }
    productIdBySlug.set(item.slug, productId);

    for (const v of item.variants) {
      const [existingVariant] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, v.sku))
        .limit(1);
      if (existingVariant) continue;
      await db.insert(productVariants).values({
        productId,
        name: v.name,
        sku: v.sku,
        priceCents: v.priceCents,
        inventoryQty: v.inventoryQty,
        active: true,
      });
      variantCount += 1;
    }

    for (const r of item.reviews) {
      const [existingReview] = await db
        .select()
        .from(reviews)
        .where(sql`${reviews.productId} = ${productId} and ${reviews.authorName} = ${r.authorName}`)
        .limit(1);
      if (existingReview) continue;
      await db.insert(reviews).values({
        productId,
        authorName: r.authorName,
        rating: r.rating,
        title: r.title,
        body: r.body,
        verified: true,
      });
      reviewCount += 1;
    }
  }

  for (const t of TESTIMONIALS) {
    const [existing] = await db
      .select()
      .from(reviews)
      .where(sql`${reviews.productId} is null and ${reviews.authorName} = ${t.authorName}`)
      .limit(1);
    if (existing) continue;
    await db.insert(reviews).values({
      productId: null,
      authorName: t.authorName,
      rating: t.rating,
      title: t.title,
      body: t.body,
      verified: true,
    });
    reviewCount += 1;
  }

  return { products: productCount, variants: variantCount, reviews: reviewCount };
}

/** Store settings: only write defaults for keys that have no row yet, so an
 *  admin's edits are never clobbered by a re-seed. */
export async function seedSettings(): Promise<number> {
  let written = 0;
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    const [existing] = await db.select().from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
    if (existing) continue;
    await db.insert(storeSettings).values({ key, value });
    written += 1;
  }
  return written;
}

/**
 * Demo orders so the admin dashboard has something to show. Creates one paid,
 * shipped order and one pending order, using real products from the catalog.
 * Skipped entirely when any order already exists.
 */
export async function seedDemoOrders(customerUserId: string | null): Promise<number> {
  const [existing] = await db.select({ value: sql<number>`count(*)::int` }).from(orders);
  if ((existing?.value ?? 0) > 0) return 0;

  const rows = await db.select().from(products).where(eq(products.active, true)).limit(8);
  const variantRows = await db.select().from(productVariants);
  if (rows.length < 2) return 0;

  const images = (id: string) => rows.find((p) => p.id === id)?.images[0] ?? null;
  const variantOf = (productId: string) => variantRows.find((v) => v.productId === productId) ?? null;

  const addr = {
    fullName: "Jordan Avery",
    line1: "418 Maple Street",
    line2: "Apt 3B",
    city: "Portland",
    state: "OR",
    postalCode: "97205",
    country: "US",
    phone: "+1 503 555 0188",
  };

  const demos: {
    number: string;
    email: string;
    status: string;
    paymentStatus: string;
    picks: number[];
    daysAgo: number;
    tracking?: { number: string; carrier: string };
  }[] = [
    {
      number: "PP-DEMO0001",
      email: "jordan.avery@example.com",
      status: "shipped",
      paymentStatus: "paid",
      picks: [0, 2],
      daysAgo: 6,
      tracking: { number: "9400111899562745772639", carrier: "USPS" },
    },
    {
      number: "PP-DEMO0002",
      email: "casey.nguyen@example.com",
      status: "pending",
      paymentStatus: "unpaid",
      picks: [3],
      daysAgo: 1,
    },
  ];

  let created = 0;
  for (const demo of demos) {
    const lines = demo.picks
      .map((i) => rows[i])
      .filter(Boolean)
      .map((p) => {
        const variant = variantOf(p.id);
        return {
          product: p,
          variant,
          qty: 1,
          unit: variant?.priceCents ?? p.priceCents,
        };
      });

    const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
    const shipping = subtotal >= 4900 ? 0 : 599;
    const total = subtotal + shipping;
    const createdAt = new Date(Date.now() - demo.daysAgo * 86_400_000);

    const [order] = await db
      .insert(orders)
      .values({
        orderNumber: demo.number,
        userId: customerUserId,
        email: demo.email,
        status: demo.status,
        paymentStatus: demo.paymentStatus,
        paymentProvider: "2checkout",
        subtotalCents: subtotal,
        shippingCents: shipping,
        taxCents: 0,
        totalCents: total,
        currency: "USD",
        shippingAddress: { ...addr, fullName: demo.email.split("@")[0] },
        billingAddress: { ...addr, fullName: demo.email.split("@")[0] },
        trackingNumber: demo.tracking?.number ?? null,
        carrier: demo.tracking?.carrier ?? null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    await db.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        productId: l.product.id,
        variantId: l.variant?.id ?? null,
        slug: l.product.slug,
        nameSnapshot: l.product.name,
        variantSnapshot: l.variant?.name ?? null,
        priceCents: l.unit,
        qty: l.qty,
        imageUrl: images(l.product.id),
      })),
    );

    await db.insert(orderEvents).values([
      { orderId: order.id, status: "pending", note: "Order placed — awaiting payment confirmation.", createdAt },
      ...(demo.paymentStatus === "paid"
        ? [{ orderId: order.id, status: "paid", note: "Payment received.", createdAt }]
        : []),
      ...(demo.status === "shipped"
        ? [
            { orderId: order.id, status: "processing", note: "Packing your parcel.", createdAt },
            {
              orderId: order.id,
              status: "shipped",
              note: `Shipped via ${demo.tracking?.carrier} — ${demo.tracking?.number}`,
              createdAt,
            },
          ]
        : []),
    ]);

    created += 1;
  }

  return created;
}

export async function seedAll(customerUserId: string | null = null) {
  const settings = await seedSettings();
  const catalog = await seedCatalog();
  const demos = await seedDemoOrders(customerUserId);
  return { settings, ...catalog, demoOrders: demos };
}
