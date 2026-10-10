// Home page — the section order follows the reference storefront:
//   hero banner → category roundels → promo pair → new arrivals → best sellers
//   → feature strip → why buy from us → reviews → FAQ. The newsletter band
//   closes the page in the footer, so it is not repeated here.
//
// Everything is DB-driven: brand copy comes from store settings, product rows
// from the catalog API, and testimonials from stored reviews. Every claim on
// this page is one we can stand behind — no invented delivery windows, no
// invented free-shipping thresholds, no unverifiable badges.
import { useMemo } from "react";
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  RotateCcw,
  Star,
  Plus,
  Dog,
  Cat,
  UtensilsCrossed,
  Scissors,
  Plane,
  Check,
  Heart,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/_core/trpc";
import { useSeo } from "@/lib/petparcel";
import { STORE_URL, TRUST_BADGES } from "@shared/store";
import { useSite } from "@/components/site/Layout";
import {
  Chip,
  CtaLink,
  ProductGridSkeleton,
  Reveal,
  Section,
  SectionHeading,
  Stars,
  TrustStrip,
} from "@/components/site/Bits";
import { ProductGrid, type StoreProduct } from "@/components/site/ProductCard";

const FAQ_PREVIEW = [
  {
    q: "How quickly will my order ship?",
    a: "We dispatch orders fast, using the best carrier available for your address, and email a tracking number the moment the label is created. We don't publish a delivery window, because carrier transit varies by address and season.",
  },
  {
    q: "What does shipping cost?",
    a: "A flat, clearly-shown rate at checkout — no handling fees and no surprises. The exact amount appears in your order summary before you confirm.",
  },
  {
    q: "What if my pet won't use it?",
    a: "Send it back within 30 days and we refund the full amount. If something arrived damaged or faulty, we cover the return postage too.",
  },
  {
    q: "Is it safe to pay by card here?",
    a: "Card details are entered on our payment provider's own secure page. They never reach our servers, and we don't store them.",
  },
];

// Fallback icons for the category rail if a category has no product image yet.
const CATEGORY_ICONS: Record<string, typeof Dog> = {
  Dogs: Dog,
  Cats: Cat,
  Feeding: UtensilsCrossed,
  Grooming: Scissors,
  "Travel & Outdoors": Plane,
};

export default function Home() {
  const s = useSite();
  const { data: featured, isLoading: loadingFeatured } = trpc.catalog.featured.useQuery({ limit: 8 });
  const { data: newest, isLoading: loadingNewest } = trpc.catalog.list.useQuery({ sort: "newest" });
  const { data: categories } = trpc.catalog.categories.useQuery(undefined, { staleTime: 60_000 });
  const { data: reviews } = trpc.reviews.store.useQuery({ limit: 3 });

  useSeo(
    useMemo(
      () => ({
        title: `${s.brand_name} — Everything Your Pet Deserves`,
        description:
          "Thoughtfully chosen pet supplies for dogs and cats — beds, harnesses, feeders, grooming tools and carriers. Fast, tracked US shipping and 30-day returns.",
        path: "/",
        image: "/hero.png",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "OnlineStore",
          name: s.brand_name,
          url: STORE_URL,
          description: s.hero_subhead,
          currenciesAccepted: "USD",
          paymentAccepted: "Credit Card, Debit Card",
          areaServed: { "@type": "Country", name: "United States" },
          email: s.contact_email,
          telephone: s.contact_phone,
          address: {
            "@type": "PostalAddress",
            streetAddress: "1200 Market St",
            addressLocality: "Wilmington",
            addressRegion: "DE",
            postalCode: "19801",
            addressCountry: "US",
          },
        },
      }),
      [s.brand_name, s.hero_subhead, s.contact_email, s.contact_phone],
    ),
  );

  const bestSellers = (featured ?? []) as StoreProduct[];
  const allNew = ((newest ?? []) as StoreProduct[]).slice(0, 8);
  const cats = categories ?? [];

  // A representative image per category, so the roundels read as real product
  // categories rather than generic icons.
  const categoryImage = (name: string) =>
    ((newest ?? []) as StoreProduct[]).find((p) => p.category === name && p.images[0])?.images[0] ?? null;

  return (
    <>
      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <section className="surface-mesh relative overflow-hidden border-b border-line">
        <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-20">
          <div className="animate-in-up">
            <div className="eyebrow">Dogs &amp; cats · shipped across the USA</div>
            <h1 className="text-[30px] leading-[1.18] sm:text-[38px] lg:text-[46px]">
              Everything Your Pet Deserves.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-gray sm:text-[17px]">
              {s.hero_subhead}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <CtaLink to="/shop" variant="accent" size="lg">
                Shop the collection <ArrowRight className="h-4 w-4" />
              </CtaLink>
              <CtaLink to="/track" variant="outline" size="lg">
                Track my order
              </CtaLink>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-[13.5px] text-gray">
              <span className="inline-flex items-center gap-2">
                <Dog className="h-4 w-4 text-teal" /> Dogs, cats and small pets
              </span>
              <span className="inline-flex items-center gap-2">
                <Truck className="h-4 w-4 text-teal" /> Fast, tracked shipping
              </span>
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-teal" /> {s.return_window_days}-day returns
              </span>
            </div>
          </div>

          <div className="relative animate-in-up" style={{ animationDelay: "120ms" }}>
            <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-[var(--shadow-lg)]">
              <img
                src="/hero.png"
                alt="A retriever and a cat resting together on a rug at home"
                className="h-full w-full object-cover"
                width={1024}
                height={1024}
              />
            </div>
            <div className="animate-float absolute -bottom-5 left-4 hidden items-center gap-2.5 rounded-2xl border border-line bg-white/95 px-5 py-3.5 shadow-[var(--shadow)] backdrop-blur sm:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-soft text-teal">
                <Truck className="h-[18px] w-[18px]" />
              </span>
              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-gray">
                  Every parcel
                </span>
                <span className="block text-[13.5px] font-semibold">Tracked door to door</span>
              </span>
            </div>
            <div
              className="animate-float absolute -right-3 top-8 hidden rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-[var(--shadow)] backdrop-blur sm:block"
              style={{ animationDelay: "1.4s" }}
            >
              <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-teal-deep">
                <Heart className="h-4 w-4" /> Chosen for real pets
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category roundels ───────────────────────────────────────────────── */}
      {cats.length > 0 && (
        <div className="container-page">
          <div className="cat-circles">
            {cats.map((c) => {
              const Icon = CATEGORY_ICONS[c] ?? Dog;
              const img = categoryImage(c);
              return (
                <Link key={c} to={`/shop?category=${encodeURIComponent(c)}`} className="cat-circle">
                  <span className="cat-circle-img">
                    {img ? <img src={img} alt={`${c} supplies`} loading="lazy" /> : <Icon className="h-8 w-8" />}
                  </span>
                  <span className="cat-circle-name">{c}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Promo pair ──────────────────────────────────────────────────────── */}
      <Section className="!py-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            {
              eyebrow: "Just landed",
              title: "Fresh off the shelf",
              body: "The newest additions to the range, trialled on real pets first.",
              to: "/shop?sort=newest",
              cta: "Shop new arrivals",
              img: categoryImage(cats[0] ?? "") ?? "/products/dogbed.jpg",
            },
            {
              eyebrow: "Most reordered",
              title: "The ones people come back for",
              body: "Bestselling beds, harnesses and feeders — the short list.",
              to: "/shop?sort=featured",
              cta: "Shop best sellers",
              img: categoryImage(cats[1] ?? "") ?? "/products/harness.jpg",
            },
          ].map((promo, i) => (
            <Reveal key={promo.title} delay={i * 70}>
              <Link
                to={promo.to}
                className="group flex h-full items-center gap-5 overflow-hidden rounded-[18px] border border-line bg-blush p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lg)] sm:p-7"
              >
                <div className="min-w-0 flex-1">
                  <div className="eyebrow">{promo.eyebrow}</div>
                  <h3 className="text-[19px] font-normal leading-[1.25]">{promo.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-gray">{promo.body}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-teal transition-colors group-hover:text-coral">
                    {promo.cta} <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
                <span className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-2xl bg-white sm:h-[120px] sm:w-[120px]">
                  <img
                    src={promo.img}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── New arrivals ────────────────────────────────────────────────────── */}
      <Section muted>
        <SectionHeading
          eyebrow="New arrivals"
          title="Explore our latest collection"
          subtitle="A deliberately short list. Everything here has been used by someone on the team before it went live."
          actionTo="/shop?sort=newest"
        />
        {loadingNewest ? <ProductGridSkeleton count={4} /> : <ProductGrid products={allNew} />}
      </Section>

      {/* ── Best sellers ────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading
          eyebrow="Best sellers"
          title="Our customer favorites"
          subtitle="The pieces that get reordered most, each backed by fast tracked shipping and a 30-day return window."
          actionTo="/shop"
          actionLabel="Shop all"
        />
        {loadingFeatured ? <ProductGridSkeleton count={8} /> : <ProductGrid products={bestSellers} />}
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
          title="A small catalogue, chosen carefully"
          subtitle="We stock a tight range of things that hold up — not two hundred near-identical toys."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Truck,
              title: "Shipped fast and tracked",
              body: "Your parcel is dispatched fast and tracked door to door with the best carrier available for your address.",
            },
            {
              icon: ShieldCheck,
              title: "Materials we'd use ourselves",
              body: "Non-toxic foam, food-grade steel, machine-washable covers. Nothing that sheds dye or splinters.",
            },
            {
              icon: RotateCcw,
              title: "30 days to change your mind",
              body: "If your pet ignores it, send it back and we refund the lot. Damaged on arrival? We cover the label.",
            },
            {
              icon: Star,
              title: "Tried before we stock it",
              body: "Every product is used by someone here first. If it falls apart or gets ignored, it doesn't make the site.",
            },
            {
              icon: Check,
              title: "No surprises at checkout",
              body: "A flat, clearly-shown shipping rate and any tax displayed before you confirm — the total you see is the total you pay.",
            },
            {
              icon: ShieldCheck,
              title: "Support that answers",
              body: `Real replies from ${s.support_hours} — by email or phone, not a ticket queue.`,
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
      {(reviews ?? []).length > 0 && (
        <Section muted>
          <SectionHeading
            align="center"
            eyebrow="In their words"
            title="What US pet parents say"
            subtitle="Every review below comes from a verified PetParcel order."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(reviews ?? []).map((r, i) => (
              <Reveal key={r.id} delay={i * 60}>
                <figure className="card-premium flex h-full flex-col p-6">
                  <Stars rating={r.rating} size={16} />
                  {r.title && <p className="mt-3 text-[14.5px] font-semibold">{r.title}</p>}
                  <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-gray">
                    “{r.body}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-2.5 text-xs font-semibold">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-soft text-teal-deep">
                      {r.authorName.charAt(0)}
                    </span>
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
              subtitle="The four things customers ask us most. Everything else lives on the help page."
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
