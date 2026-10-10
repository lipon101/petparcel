// Idempotent demo-data seeder. Safe to run repeatedly: it only inserts what is
// missing, so a re-run never duplicates the catalog or the reviews.
//
//   pnpm seed
//
// Run it once after `pnpm db:migrate` so a fresh clone looks like a real store
// (products, variants, inventory, reviews, testimonials, store settings).
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
    name: "CloudNine Orthopedic Dog Bed",
    slug: "cloudnine-orthopedic-dog-bed",
    category: "Dogs",
    description:
      "A 4-inch memory-foam base that takes the pressure off hips and joints, wrapped in a removable, machine-washable cover. Senior dogs and big breeds fall asleep on it in minutes — and the non-slip base keeps it where you put it.",
    priceCents: 7999,
    compareAtCents: 9999,
    images: ["/products/dog-bed.jpg"],
    tags: ["Best seller", "Orthopedic", "Machine washable"],
    featured: true,
    sortOrder: 1,
    variants: [
      { name: "Small (24\")", sku: "PP-BED-S", priceCents: 5999, inventoryQty: 24 },
      { name: "Medium (32\")", sku: "PP-BED-M", priceCents: 7999, inventoryQty: 31 },
      { name: "Large (40\")", sku: "PP-BED-L", priceCents: 9999, inventoryQty: 18 },
      { name: "X-Large (48\")", sku: "PP-BED-XL", priceCents: 11999, inventoryQty: 4 },
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
    name: "TrekMate No-Pull Dog Harness",
    slug: "trekmate-no-pull-dog-harness",
    category: "Dogs",
    description:
      "Front-clip, padded and reflective. The martingale loop discourages pulling without choking, and four adjustment points mean it actually fits a deep-chested dog. Rated for hikes and daily walks alike.",
    priceCents: 3499,
    compareAtCents: 4499,
    images: ["/products/harness.jpg"],
    tags: ["Reflective", "No-pull", "Front clip"],
    featured: true,
    sortOrder: 2,
    variants: [
      { name: "S (14–20 in girth)", sku: "PP-HARN-S", priceCents: 2999, inventoryQty: 40 },
      { name: "M (20–27 in girth)", sku: "PP-HARN-M", priceCents: 3499, inventoryQty: 52 },
      { name: "L (27–35 in girth)", sku: "PP-HARN-L", priceCents: 3999, inventoryQty: 27 },
      { name: "XL (35–44 in girth)", sku: "PP-HARN-XL", priceCents: 4499, inventoryQty: 3 },
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
    name: "BrainyBone Treat Puzzle",
    slug: "brainybone-treat-puzzle",
    category: "Dogs",
    description:
      "Slide, flip and spin compartments that turn a handful of kibble into twenty minutes of problem-solving. Great for rainy days, slow eating and separation-anxiety distractions. Dishwasher safe.",
    priceCents: 2499,
    images: ["/products/puzzle-toy.jpg"],
    tags: ["Mental enrichment", "Dishwasher safe"],
    featured: true,
    sortOrder: 3,
    variants: [
      { name: "Level 1 (Beginner)", sku: "PP-PUZ-1", priceCents: 1999, inventoryQty: 60 },
      { name: "Level 2 (Advanced)", sku: "PP-PUZ-2", priceCents: 2499, inventoryQty: 22 },
    ],
    reviews: [
      {
        authorName: "Alex T.",
        rating: 5,
        title: "Bought me 30 quiet minutes",
        body: "Started on Level 1 with my terrier mix, he had it solved in a week, so we ordered Level 2. Both hold up in the dishwasher.",
      },
    ],
  },
  {
    name: "SilkCoat Slicker Brush",
    slug: "silkcoat-slicker-brush",
    category: "Grooming",
    description:
      "Fine bent-wire pins with soft tips that lift loose undercoat without scratching skin. The one-click retract makes cleanup painless — no picking fur out of bristles by hand.",
    priceCents: 1899,
    images: ["/products/slicker-brush.jpg"],
    tags: ["De-shedding", "Self-cleaning"],
    featured: false,
    sortOrder: 4,
    variants: [
      { name: "Regular", sku: "PP-BRUSH-R", priceCents: 1899, inventoryQty: 75 },
      { name: "Mini (paws & face)", sku: "PP-BRUSH-M", priceCents: 1399, inventoryQty: 5 },
    ],
    reviews: [
      {
        authorName: "Rosa M.",
        rating: 5,
        title: "Took a whole second dog off my couch",
        body: "The retract button genuinely works. My golden tolerates it far better than the old brush.",
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
    images: ["/products/scratch-post.webp"],
    tags: ["Heavy base", "Sisal rope"],
    featured: true,
    sortOrder: 5,
    variants: [
      { name: "24 in", sku: "PP-POST-24", priceCents: 4499, inventoryQty: 20 },
      { name: "32 in", sku: "PP-POST-32", priceCents: 5499, inventoryQty: 14 },
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
    name: "AquaPurr Automatic Water Fountain",
    slug: "aquapurr-automatic-water-fountain",
    category: "Cats",
    description:
      "A quiet recirculating pump and a wide stainless-steel drinking tray. Moving water encourages cats to drink more, and the triple filter catches hair and grit. Whisper-quiet at under 30dB.",
    priceCents: 4999,
    images: ["/products/water-fountain.png"],
    tags: ["Quiet pump", "Triple filter"],
    featured: true,
    sortOrder: 6,
    variants: [
      { name: "2.5 L", sku: "PP-WATER-25", priceCents: 4999, inventoryQty: 33 },
      { name: "3.5 L", sku: "PP-WATER-35", priceCents: 5999, inventoryQty: 9 },
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
    name: "DreamNest Donut Cat Bed",
    slug: "dreamnest-donut-cat-bed",
    category: "Cats",
    description:
      "A deep, fluffy ring that cats curl into and knead. Self-warming faux fur holds their own body heat, and the whole thing is machine washable so hair doesn't build up.",
    priceCents: 3299,
    images: ["/products/cat-bed.jpg"],
    tags: ["Self-warming", "Machine washable"],
    featured: false,
    sortOrder: 7,
    variants: [
      { name: "Medium (20\")", sku: "PP-NEST-M", priceCents: 3299, inventoryQty: 28 },
      { name: "Large (24\")", sku: "PP-NEST-L", priceCents: 3999, inventoryQty: 16 },
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
    name: "SlowFeast Puzzle Bowl",
    slug: "slowfeast-puzzle-bowl",
    category: "Dogs",
    description:
      "A maze of ridges that stretches a 60-second meal into ten minutes. Slower eating means less gulped air, less bloating, and a dog that isn't begging again at noon. Dishwasher safe, non-slip base.",
    priceCents: 1599,
    images: ["/products/slow-feeder.jpg"],
    tags: ["Anti-gulp", "Non-slip"],
    featured: false,
    sortOrder: 8,
    variants: [
      { name: "Small (1.5 cups)", sku: "PP-BOWL-S", priceCents: 1299, inventoryQty: 48 },
      { name: "Large (3 cups)", sku: "PP-BOWL-L", priceCents: 1599, inventoryQty: 41 },
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
    body: "Compared this against the big pet stores and it was cheaper for the same thing, with free shipping over $49.",
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
        paymentProvider: demo.paymentStatus === "paid" ? "manual" : "manual",
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
