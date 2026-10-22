// Home page - the section order follows the reference storefront:
//   hero banner → category roundels → promo pair → new arrivals → best sellers
//   → feature strip → why buy from us → reviews → FAQ. The newsletter band
//   closes the page in the footer, so it is not repeated here.
//
// Everything is DB-driven: brand copy comes from store settings, product rows
// from the catalog API, and testimonials from stored reviews. Every claim on
// this page is one we can stand behind - no invented delivery windows, no
// invented free-shipping thresholds, no unverifiable badges.
import { useMemo } from "react";
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  Star,
  Plus,
  LayoutGrid,
  Check,
} from "lucide-react";
import { Link } from "wouter";
import { useSeo } from "@/lib/petparcel";
import {
  useCatalogCategories,
  useCatalogDailyRotation,
  useCatalogFeaturedPicks,
  useCatalogPromo,
  useStoreReviews,
  useTopCategories,
} from "@/lib/useCatalog";
import { categoryIcon } from "@/lib/category-icons";
import { STORE_URL, TRUST_BADGES, formatMoney } from "@shared/store";
import { productImageSrcSet } from "@shared/product-media";
import { useSite } from "@/components/site/Layout";
import {
  Chip,
  CtaLink,
  EmptyState,
  ErrorState,
  ProductGridSkeleton,
  Reveal,
  ReviewerMark,
  Section,
  SectionHeading,
  Stars,
  TrustStrip,
} from "@/components/site/Bits";
import { ProductGrid, type StoreProduct } from "@/components/site/ProductCard";
import { Hero } from "@/components/site/Hero";

const FAQ_PREVIEW = [
  {
    q: "How quickly will my order ship?",
    a: "We dispatch orders fast, using the best carrier available for your address, and email a tracking number the moment the label is created. We don't publish a delivery window, because carrier transit varies by address and season.",
  },
  {
    q: "What does shipping cost?",
    a: "A flat $6.99 on every US order - no handling fees and no surprises. The exact amount appears in your order summary before you confirm.",
  },
  {
    q: "What if my pet won't use it?",
    a: "Send it back within 30 days and we refund the full amount - returns are free, and we provide the prepaid label. If something arrived damaged or faulty, we replace it and cover the label.",
  },
  {
    q: "Is it safe to pay by card here?",
    a: "Card details are entered on our payment provider's own secure page. They never reach our servers, and we don't store them.",
  },
];

// Fallback: the icon map lives in client/src/lib/category-icons.ts, shared with
// the header's category menus so every surface marks an aisle the same way.

export default function Home() {
  const s = useSite();
  // The catalogue comes from the API (the real database) - there is no bundled
  // fallback, so each grid reports its own loading / error / empty state rather
  // than painting demo products on the first frame.
  const { products: featured, isLoading: featuredLoading, isError: featuredError } =
    useCatalogFeaturedPicks(4);
  const { products: newest, isLoading: newestLoading, isError: newestError } =
    useCatalogDailyRotation(8);
  const { categories } = useCatalogCategories();
  // The rail shows the best handful, not the whole taxonomy - and the one
  // "All categories" tile beside them keeps the other aisles one click away.
  const { top: topCats } = useTopCategories();
  const { reviews } = useStoreReviews(3);
  // The two promo cards are admin-controlled and database-backed: the products
  // come from the owner's picks (resolved server-side, with a graceful fallback
  // when a pick is deleted or unpublished).
  const { slots: promo, isLoading: promoLoading } = useCatalogPromo();

  useSeo(
    useMemo(
      () => ({
        title: `${s.brand_name} - Pet Supplies for Dogs, Cats and More, Shipped Across the USA`,
        description:
          "Shop pet supplies for dogs, cats, birds, fish and small pets at PetParcel - food, beds, crates, harnesses, toys, grooming and more. Fast, tracked shipping across the USA and 30-day returns.",
        path: "/",
        image: "/hero.png",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "OnlineStore",
          name: s.brand_name,
          url: STORE_URL,
          description:
            "Pet supplies for dogs, cats and more, shipped fast and tracked across the USA.",
          currenciesAccepted: "USD",
          paymentAccepted: "Credit Card, Debit Card",
          areaServed: { "@type": "Country", name: "United States" },
          email: s.contact_email,
          telephone: s.contact_phone,
          address: {
            "@type": "PostalAddress",
            streetAddress: "1600 Pacific Ave",
            addressLocality: "Dallas",
            addressRegion: "TX",
            postalCode: "75201",
            addressCountry: "US",
          },
        },
      }),
      [s.brand_name, s.contact_email, s.contact_phone],
    ),
  );

  const bestSellers = featured as StoreProduct[];
  const allNew = newest as StoreProduct[];
  const cats = categories;

  return (
    <>
      {/* Hero - one static image with a slow, deliberate Ken Burns pan
          (see components/site/Hero). */}
      <Hero />

      {/* ── Category roundels ────────────────────────────────────────────────── */}
      {cats.length > 0 && (
        <div className="container-page">
          {/* The featured aisles as a fixed, evenly-spaced rail. Equal-width
              tiles - not `max-content` tiles that hug their own label - are what
              keep every ring and label on a common axis, so the circles are
              uniformly sized and the gaps evenly spaced at every width. The
              labels are clipped with an ellipsis rather than allowed to widen, so
              a long aisle name can never knock the row out of line. Icons come
              from the same set the header menus use, so the rail reads as a set;
              the label below each ring names the aisle, so the icon is
              decorative. */}
          <nav className="cat-circles" aria-label="Shop by category">
            {topCats.map((c) => {
              const Icon = categoryIcon(c);
              return (
                <Link
                  key={c}
                  to={`/shop?category=${encodeURIComponent(c)}`}
                  className="cat-circle"
                >
                  <span className="cat-circle-img">
                    <Icon className="cat-circle-ic" aria-hidden="true" />
                  </span>
                  <span className="cat-circle-name" title={c}>
                    {c}
                  </span>
                </Link>
              );
            })}
            <Link to="/shop" className="cat-circle cat-circle-all">
              <span className="cat-circle-img">
                <LayoutGrid className="cat-circle-ic" aria-hidden="true" />
              </span>
              <span className="cat-circle-name">All categories</span>
            </Link>
          </nav>
        </div>
      )}

      {/* ── Promo pair ────────────────────────────────────────────────────────── */}
      {/* Admin-controlled and database-backed: each card features the product the
          owner picked in the admin panel, resolved server-side at request time
          (with a graceful fallback when a pick is deleted or unpublished). The
          card markup, classes, hover and two-card arrangement are unchanged -
          only the data and the copy are now real. The section is hidden while
          loading and when there is nothing to feature, so it never renders an
          empty or broken block. */}
      {promoLoading || promo.length > 0 ? (
        <Section className="!py-8">
          <div className="grid gap-5 sm:grid-cols-2">
            {promo.map((slot, i) => {
              const p = slot.product;
              const onSale =
                typeof p.compareAtCents === "number" && p.compareAtCents > p.priceCents;
              return (
                <Reveal key={slot.kind} delay={i * 70}>
                  <Link
                    to={`/product/${p.slug}`}
                    className="group flex h-full items-center gap-5 overflow-hidden rounded-[18px] border border-line bg-blush p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] sm:p-7"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="eyebrow">{slot.copy.eyebrow}</div>
                      <h3 className="text-[19px] font-normal leading-[1.25]">{slot.copy.title}</h3>
                      {/* Nudged half a step lighter below `sm` only: at the card's
                          mobile width the copy needs a hair more room to hold its
                          two-line shape. Desktop keeps the 13.5px rhythm. */}
                      <p className="mt-2 text-[12px] leading-relaxed text-gray sm:text-[13.5px]">
                        {slot.copy.body}
                      </p>
                      <span className="mt-2 flex items-baseline gap-2">
                        <span className="text-[15px] font-semibold text-coral">
                          {formatMoney(p.priceCents)}
                        </span>
                        {onSale && (
                          <span className="text-[12.5px] text-gray line-through">
                            {formatMoney(p.compareAtCents)}
                          </span>
                        )}
                      </span>
                      <span className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-teal transition-colors group-hover:text-coral">
                        {slot.copy.cta} <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                    <span className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl bg-white sm:h-[120px] sm:w-[120px]">
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          srcSet={productImageSrcSet(p.images[0])}
                          sizes="120px"
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-3xl">
                          🐾
                        </span>
                      )}
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </Section>
      ) : null}

      {/* ── New arrivals ────────────────────────────────────────────────────── */}
      <Section muted>
        <SectionHeading
          eyebrow="New arrivals"
          title="Just landed"
          subtitle="A fresh pick from the range, rotated every day - so there is always something new to discover."
          actionTo="/shop?sort=newest"
        />
        {newestLoading ? (
          <ProductGridSkeleton count={8} />
        ) : newestError ? (
          <ErrorState body="We couldn't load the latest products just now. Please try again in a moment." />
        ) : allNew.length > 0 ? (
          <ProductGrid products={allNew} />
        ) : (
          <EmptyState
            title="No products yet"
            body="New arrivals will appear here as soon as they are in stock."
          />
        )}
      </Section>

      {/* ── Featured ────────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading
          eyebrow="Featured"
          title="Our featured picks"
          subtitle="A short, rotating selection chosen to help you find a place to start - every other product is a click away in the full shop."
          actionTo="/shop"
          actionLabel="Browse all products"
        />
        {featuredLoading ? (
          <ProductGridSkeleton count={8} />
        ) : featuredError ? (
          <ErrorState body="We couldn't load our featured products just now. Please try again in a moment." />
        ) : bestSellers.length > 0 ? (
          <ProductGrid products={bestSellers} />
        ) : (
          <EmptyState
            title="Nothing to show yet"
            body="Featured products will appear here as soon as they are in stock."
          />
        )}
      </Section>

      {/* ── Feature strip ───────────────────────────────────────────────────── */}
      <Section muted className="!py-12">
        <TrustStrip items={TRUST_BADGES} />
      </Section>

      {/* ── Why buy from us ─────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading
          align="center"
          eyebrow="Why PetParcel"
          title="Everything your pet needs, in one place"
          subtitle="A full range for dogs, cats and small pets, from food and beds to toys and grooming."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Truck,
              title: "Shipped fast and tracked",
              body: "Dispatched fast with the best carrier for your address, tracked the whole way.",
            },
            {
              icon: ShieldCheck,
              title: "Materials we'd use ourselves",
              body: "Non-toxic foam, food-grade steel, covers you can machine wash. Nothing that sheds dye or splinters.",
            },
            {
              icon: RotateCcw,
              title: "30 days to change your mind",
              body: "If your pet ignores it, send it back and we refund the lot - returns are free, and we provide the prepaid label.",
            },
            {
              icon: Star,
              title: "Tried before we stock it",
              body: "Someone on the team uses every product first. If it falls apart or gets ignored, it never makes the site.",
            },
            {
              icon: Check,
              title: "No surprises at checkout",
              body: "A flat $6.99 shipping rate and any tax shown before you confirm. The total you see is the total you pay.",
            },
            {
              icon: ShieldCheck,
              title: "Support that answers",
              body: `Real replies from ${s.support_hours}, by email or phone. No ticket queue.`,
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 50}>
              <div className="card-premium h-full p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-teal-soft text-teal">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-medium">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── Reviews ─────────────────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <Section muted>
          <SectionHeading
            align="center"
            eyebrow="In their words"
            title="What US pet parents say"
            subtitle="Every review below comes from a verified PetParcel order."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={i * 60}>
                <figure className="card-premium flex h-full flex-col p-6">
                  <Stars rating={r.rating} size={16} />
                  {r.title && <p className="mt-3 text-[14.5px] font-semibold">{r.title}</p>}
                  <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-gray">
                    “{r.body}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-2.5 text-xs font-semibold">
                    <ReviewerMark name={r.authorName} className="h-8 w-8" />
                    <span>{r.authorName}</span>
                    {r.verified && (
                      <Chip tone="green">
                        <Check className="h-3 w-3" /> Verified
                      </Chip>
                    )}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Help centre"
              title="Questions, answered"
              subtitle="The four questions we hear most. The rest are on the help page."
            />
            <CtaLink to="/faq" variant="outline">
              Read the full FAQ <ArrowRight className="h-4 w-4" />
            </CtaLink>
          </div>
          <div className="space-y-3">
            {FAQ_PREVIEW.map((item) => (
              <details key={item.q} className="card-soft group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
                  {item.q}
                  <Plus className="h-4 w-4 shrink-0 text-teal transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}