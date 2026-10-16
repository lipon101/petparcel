// ──────────────────────────────────────────────────────────────────────────────
// Server-side SEO head for the SPA shell.
//
// WHY THIS EXISTS. Every per-route tag (title, description, canonical, Open
// Graph, Twitter card, JSON-LD) is written at runtime by the client `useSeo()`
// hook. That is fine for a browser, but a social crawler (Facebook, X, LinkedIn,
// Slack, iMessage) and any non-JS crawler read the RAW HTML the server returns -
// they never run the bundle, so they only ever saw the static, site-wide tags in
// `client/index.html`. A shared product link therefore previewed as the generic
// homepage, and the per-page JSON-LD was invisible to them.
//
// This module resolves the SAME per-route metadata on the server and injects it
// into the shell before it is sent, so the crawler sees the correct tags without
// executing any JavaScript. It mirrors the values `useSeo()` produces (same
// titles, same descriptions, same JSON-LD shapes) so the two never disagree.
//
// It is deliberately PURE apart from the product lookup: `resolveSeo` reads the
// catalog only for a `/product/:slug` route, and `injectSeo` is a pure string
// transform that a unit test can exercise without a database.
// ──────────────────────────────────────────────────────────────────────────────
import { STORE_NAME, STORE_URL, stripMarkdown } from "@shared/store";

/** The per-route metadata the shell is rendered with. Mirrors `SeoOptions` in
 *  `client/src/lib/petparcel.tsx`. */
export interface SeoHead {
  title: string;
  description: string;
  canonical: string;
  image: string;
  type: "website" | "product" | "article";
  noindex: boolean;
  jsonLd: Record<string, unknown> | null;
}

const DEFAULT_IMAGE = `${STORE_URL}/hero.png`;

/** The site-wide title suffix, applied exactly as `useSeo()` does. */
function fullTitle(title: string): string {
  return title.includes(STORE_NAME) ? title : `${title} | ${STORE_NAME}`;
}

/** An image path made absolute against the store origin (an already-absolute
 *  URL is left untouched). */
function absoluteImage(image: string | null | undefined): string {
  if (!image) return DEFAULT_IMAGE;
  return image.startsWith("http") ? image : `${STORE_URL}${image}`;
}

/** Strip a trailing slash (except for the root) so `/shop/` and `/shop` resolve
 *  to the same route. */
function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

/** The static content pages, mirroring the `useSeo()` calls in
 *  `client/src/pages/Content.tsx`. */
const CONTENT_PAGES: Record<string, { title: string; description: string }> = {
  "/about": {
    title: "About Us",
    description:
      "PetParcel is a US pet-supplies store built on a simple idea: everything a pet owner needs, from food and beds to toys and grooming, shipped fast and backed by real support.",
  },
  "/faq": {
    title: "Frequently Asked Questions",
    description:
      "Answers about PetParcel shipping, returns, payment methods, order tracking and product sizing.",
  },
  "/shipping-returns": {
    title: "Shipping & Returns",
    description:
      "PetParcel's flat US shipping rate, 30-day returns policy, and how to start a return.",
  },
  "/privacy": {
    title: "Privacy Policy",
    description:
      "How PetParcel collects, uses and protects your personal information, including cookies, payments and your privacy rights.",
  },
  "/terms": {
    title: "Terms of Service",
    description:
      "The terms governing your use of the PetParcel store, including orders, pricing, returns and liability.",
  },
  "/contact": {
    title: "Contact Support",
    description:
      "Contact PetParcel support for help with an order, a return or a product question.",
  },
};

/** A generic WebPage node for a content page, so a crawler still gets structured
 *  data on routes that have no richer schema. */
function webPageJsonLd(name: string, description: string, url: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    description,
    url,
    isPartOf: { "@id": `${STORE_URL}/#website` },
  };
}

/**
 * Resolve the SEO head for a request path. Product routes hit the catalog; every
 * other route is answered from constants, so the common case costs no query.
 */
export async function resolveSeo(pathname: string, search = ""): Promise<SeoHead> {
  const path = normalizePath(pathname);

  // ── Home ──────────────────────────────────────────────────────────────────
  if (path === "/") {
    return {
      title: `${STORE_NAME} - Pet Supplies for Dogs, Cats and More, Shipped Across the USA`,
      description:
        "Shop pet supplies for dogs, cats, birds, fish and small pets at PetParcel - food, beds, crates, harnesses, toys, grooming and more. Fast, tracked shipping across the USA and 30-day returns.",
      canonical: `${STORE_URL}/`,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: false,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "OnlineStore",
        name: STORE_NAME,
        url: STORE_URL,
        description:
          "Pet supplies for dogs, cats and more, shipped fast and tracked across the USA.",
        currenciesAccepted: "USD",
        paymentAccepted: "Credit Card, Debit Card",
        areaServed: { "@type": "Country", name: "United States" },
      },
    };
  }

  // ── Shop ──────────────────────────────────────────────────────────────────
  if (path === "/shop") {
    const category = new URLSearchParams(search).get("category");
    const hasCategory = Boolean(category && category !== "All");
    const heading = hasCategory ? category! : "Every product we stock";
    const canonical = `${STORE_URL}/shop${
      hasCategory ? `?category=${encodeURIComponent(category!)}` : ""
    }`;
    return {
      title: hasCategory ? `${category} - Shop` : "Shop All Pet Supplies",
      description: `Shop ${
        hasCategory ? category!.toLowerCase() : "pet supplies"
      } at PetParcel. Fast, tracked shipping across the USA and 30-day returns.`,
      canonical,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: false,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: heading,
        url: `${STORE_URL}/shop`,
        about: { "@type": "Thing", name: "Pet supplies" },
      },
    };
  }

  // ── Product ───────────────────────────────────────────────────────────────
  const productMatch = /^\/product\/([^/]+)$/.exec(path);
  if (productMatch) {
    const slug = decodeURIComponent(productMatch[1]);
    // Imported lazily so the static-serving path does not pull the whole data
    // layer (and its env binding) into the module graph unless a product page is
    // actually requested.
    const { getProductBySlug } = await import("../db");
    const product = await getProductBySlug(slug);
    if (!product) {
      return notFound();
    }
    const image = absoluteImage(product.images?.[0]);
    const reviewCount = product.reviewCount ?? 0;
    const rating = product.rating ?? 0;
    return {
      title: product.name,
      description: stripMarkdown(product.description).slice(0, 155),
      canonical: `${STORE_URL}/product/${product.slug}`,
      image,
      type: "product",
      noindex: false,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        image: [image],
        description: stripMarkdown(product.description),
        sku: product.variants?.[0]?.sku ?? undefined,
        category: product.category,
        brand: { "@type": "Brand", name: STORE_NAME },
        offers: {
          "@type": "Offer",
          url: `${STORE_URL}/product/${product.slug}`,
          priceCurrency: "USD",
          price: (product.priceCents / 100).toFixed(2),
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
          },
        },
        // Only ever emitted from real approved reviews.
        ...(reviewCount > 0
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: rating.toFixed(1),
                reviewCount,
              },
            }
          : {}),
      },
    };
  }

  // ── Cart / Checkout (noindex, but still get correct OG tags) ───────────────
  if (path === "/cart") {
    return {
      title: "Your Cart",
      description:
        "Review your PetParcel cart and check out. Fast, tracked US shipping and 30-day returns.",
      canonical: `${STORE_URL}/cart`,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: true,
      jsonLd: null,
    };
  }
  if (path === "/checkout") {
    return {
      title: "Checkout",
      description:
        "Complete your PetParcel order - fast, tracked US shipping and 30-day returns.",
      canonical: `${STORE_URL}/checkout`,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: true,
      jsonLd: null,
    };
  }

  // ── Wishlist / Track (private, per-visitor: noindex, but correct OG tags) ──
  // Both are user-specific surfaces - a wishlist belongs to an account and a
  // tracking lookup is keyed on an order number plus an email - so they are
  // noindex, exactly like /cart. They still get a correct title, description,
  // canonical and OG/Twitter tags so a link shared into a chat previews
  // properly, and a WebPage JSON-LD node like the other content routes.
  if (path === "/wishlist") {
    const canonical = `${STORE_URL}/wishlist`;
    const description = "The PetParcel products you've saved for later.";
    return {
      title: "My Wishlist",
      description,
      canonical,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: true,
      jsonLd: webPageJsonLd("My Wishlist", description, canonical),
    };
  }
  if (path === "/track") {
    const canonical = `${STORE_URL}/track`;
    const description =
      "Track your PetParcel order. Enter your order number and email to see live status, items and carrier tracking.";
    return {
      title: "Track Your Order",
      description,
      canonical,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: true,
      jsonLd: webPageJsonLd("Track Your Order", description, canonical),
    };
  }

  // ── Content pages ─────────────────────────────────────────────────────────
  const content = CONTENT_PAGES[path];
  if (content) {
    const canonical = `${STORE_URL}${path}`;
    return {
      title: content.title,
      description: content.description,
      canonical,
      image: DEFAULT_IMAGE,
      type: "website",
      noindex: false,
      jsonLd: webPageJsonLd(content.title, content.description, canonical),
    };
  }

  // ── Everything else: the 404 page ─────────────────────────────────────────
  return notFound();
}

function notFound(): SeoHead {
  return {
    title: "Page not found",
    description: "That page doesn't exist. Browse the PetParcel catalog instead.",
    canonical: `${STORE_URL}/404`,
    image: DEFAULT_IMAGE,
    type: "website",
    noindex: true,
    jsonLd: null,
  };
}

/** Escape a value for use inside an HTML attribute. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON for a `<script type="application/ld+json">` body. Mirrors the client's
 *  `serializeJsonLd`: every `<`/`>` is escaped so reflected content can never
 *  terminate the script element early, while the value still round-trips through
 *  `JSON.parse`. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Inject the resolved SEO head into the SPA shell. Each static tag in
 * `client/index.html` is replaced in place (so no duplicate tags are emitted),
 * and the per-page JSON-LD is appended just before `</head>`.
 *
 * Pure: same input, same output - which is what makes it unit-testable.
 */
export function injectSeo(html: string, seo: SeoHead): string {
  const title = fullTitle(seo.title);
  const robots = seo.noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large";

  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(title)}</title>`);
  out = out.replace(
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${escapeAttr(seo.description)}" />`,
  );
  out = out.replace(
    /<meta\s+name="robots"[^>]*>/,
    `<meta name="robots" content="${robots}" />`,
  );
  out = out.replace(
    /<link\s+rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${escapeAttr(seo.canonical)}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:title"[^>]*>/,
    `<meta property="og:title" content="${escapeAttr(title)}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${escapeAttr(seo.description)}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:type"[^>]*>/,
    `<meta property="og:type" content="${seo.type}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:url"[^>]*>/,
    `<meta property="og:url" content="${escapeAttr(seo.canonical)}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:image"[^>]*>/,
    `<meta property="og:image" content="${escapeAttr(seo.image)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:title"[^>]*>/,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:description"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${escapeAttr(seo.description)}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:image"[^>]*>/,
    `<meta name="twitter:image" content="${escapeAttr(seo.image)}" />`,
  );

  if (seo.jsonLd) {
    const block = `<script type="application/ld+json">${serializeJsonLd(seo.jsonLd)}</script>`;
    out = out.replace(/<\/head>/, `    ${block}\n  </head>`);
  }

  return out;
}
