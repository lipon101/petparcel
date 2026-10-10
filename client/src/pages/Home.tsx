// Home page — structured like a classic DTC storefront:
//   hero banner → category roundels → new arrivals → best sellers →
//   trust strip → why-buy → reviews → FAQ → closing CTA.
// The whole page is DB-driven: brand copy comes from store settings and the
// product rows / testimonials come from the API.
import { useMemo } from "react";
import {
  ArrowRight,
  Truck,
  ShieldCheck,
  HeartHandshake,
  Sparkles,
  Headphones,
  RotateCcw,
  Star,
  Plus,
  Dog,
  Cat,
  UtensilsCrossed,
  Scissors,
  Plane,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useSeo } from "@/lib/petparcel";
import { STORE_URL, TRUST_BADGES } from "@shared/store";
import { useSite } from "@/components/site/Layout";
import {
  Chip,
  CtaLink,
  ProductGridSkeleton,
  Section,
  SectionHeading,
  Stars,
  TrustStrip,
} from "@/components/site/Bits";
import { ProductGrid, type StoreProduct } from "@/components/site/ProductCard";

const FAQ_PREVIEW = [
  {
    q: "How fast will my order arrive?",
    a: "Orders leave our US warehouse within 1 business day. Standard delivery is 3–6 business days, and you'll get a tracking number the moment it ships.",
  },
  {
    q: "Do you really ship free?",
    a: "Yes — every order over $49 ships free anywhere in the United States. Below that it's a flat $5.99, shown up front at checkout.",
  },
  {
    q: "What if my pet doesn't like it?",
    a: "Return it within 30 days for a full refund. If something arrived damaged, we replace it — just contact support with your order number.",
  },
  {
    q: "Is checkout secure?",
    a: "Payments run through a PCI-compliant gateway on their own secure page. Card details never touch our servers.",
  },
];

// Category → icon + accent, so the roundels read as a real category rail.
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
  const { data: reviews } = trpc.reviews.store.useQuery({ limit: 6 });

  useSeo(
    useMemo(
      () => ({
        title: `${s.brand_name} — ${s.tagline}`,
        description: `${s.hero_subhead} Free US shipping over $49, 30-day returns, and vet-approved gear for dogs and cats.`,
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
      [s.brand_name, s.tagline, s.hero_subhead, s.contact_email, s.contact_phone],
    ),
  );

  const bestSellers = (featured ?? []) as StoreProduct[];
  const newArrivals = ((newest ?? []) as StoreProduct[]).slice(0, 8);
  const cats = categories ?? [];
  const freeShip = (s.free_shipping_threshold_cents / 100).toFixed(0);

  return (
    <>
      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-secondary/50">
        <div className="container-page grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
          <div>
            <Chip tone="teal" className="mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Trusted by 40,000+ US pet parents
            </Chip>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              {s.hero_headline}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {s.hero_subhead}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <CtaLink to="/shop" size="lg">
                Shop pet essentials <ArrowRight className="h-4 w-4" />
              </CtaLink>
              <CtaLink to="/track" variant="outline" size="lg">
                Track my order
              </CtaLink>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Stars rating={4.8} showValue /> <span>average from 2,100+ reviews</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" /> Free shipping over ${freeShip}
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl">
              <img
                src="/hero.png"
                alt="A happy golden retriever and a cat relaxing together at home"
                className="h-full w-full object-cover"
                width={1024}
                height={1024}
              />
            </div>
            <div className="absolute -bottom-4 left-4 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-lg sm:block">
              <p className="text-xs font-semibold text-muted-foreground">Delivered in</p>
              <p className="text-sm font-extrabold">{s.shipping_estimate}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category roundels ───────────────────────────────────────────────── */}
      {cats.length > 0 && (
        <Section className="!py-10">
          <SectionHeading
            align="center"
            eyebrow="Shop by category"
            title="Find exactly what your pet needs"
          />
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
            {cats.map((c) => {
              const Icon = CATEGORY_ICONS[c] ?? Dog;
              return (
                <a
                  key={c}
                  href={`/shop?category=${encodeURIComponent(c)}`}
                  className="group flex w-24 flex-col items-center gap-3 text-center sm:w-28"
                >
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-primary ring-1 ring-inset ring-primary/10 transition group-hover:bg-primary group-hover:text-primary-foreground sm:h-24 sm:w-24">
                    <Icon className="h-8 w-8 sm:h-9 sm:w-9" />
                  </span>
                  <span className="text-sm font-bold leading-tight group-hover:text-primary">{c}</span>
                </a>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── New arrivals ────────────────────────────────────────────────────── */}
      <Section muted>
        <SectionHeading
          eyebrow="Just landed"
          title="New arrivals"
          subtitle="The latest additions to the PetParcel shelf — trialled on real pets before they went live."
          action={
            <CtaLink to="/shop?sort=newest" variant="outline" size="sm">
              See what's new <ArrowRight className="h-4 w-4" />
            </CtaLink>
          }
        />
        {loadingNewest ? <ProductGridSkeleton count={4} /> : <ProductGrid products={newArrivals} />}
      </Section>

      {/* ── Best sellers ────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading
          eyebrow="Best sellers"
          title="Loved by dogs, cats and their humans"
          subtitle="Our most-reordered toys, beds and gear — every one backed by free US shipping and a 30-day return window."
          action={
            <CtaLink to="/shop" variant="outline" size="sm">
              View all products <ArrowRight className="h-4 w-4" />
            </CtaLink>
          }
        />
        {loadingFeatured ? <ProductGridSkeleton count={8} /> : <ProductGrid products={bestSellers} />}
      </Section>

      {/* ── Trust strip ─────────────────────────────────────────────────────── */}
      <Section muted className="!py-10">
        <TrustStrip items={TRUST_BADGES} />
      </Section>

      {/* ── Why buy from us ─────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading
          align="center"
          eyebrow="Why PetParcel"
          title="Pet gear without the guesswork"
          subtitle="We stock a tight range of things that actually hold up — no 200-page catalog of near-identical toys."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Truck,
              title: "Ships from US warehouses",
              body: "No month-long overseas waits. Your parcel leaves within one business day and arrives in 3–6 days.",
            },
            {
              icon: ShieldCheck,
              title: "Vet-approved materials",
              body: "Non-toxic foam, food-grade steel and machine-washable covers. Nothing that sheds dye or splinters.",
            },
            {
              icon: HeartHandshake,
              title: "Real support, real people",
              body: `Questions answered by humans in Wilmington, DE — ${s.support_hours}.`,
            },
            {
              icon: RotateCcw,
              title: "30-day happy-pet promise",
              body: "If your pet ignores it, send it back. We refund the lot, including the return label on damaged items.",
            },
            {
              icon: Sparkles,
              title: "Tested on real pets",
              body: "Every product is trialled on staff dogs and cats before it goes on the shelf. If it fails, it doesn't ship.",
            },
            {
              icon: Headphones,
              title: "Transparent pricing",
              body: `Free shipping over $${freeShip}, a flat rate below that, and no surprise fees at checkout.`,
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card-soft p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Reviews / social proof ──────────────────────────────────────────── */}
      {(reviews ?? []).length > 0 && (
        <Section muted>
          <SectionHeading
            align="center"
            eyebrow="Social proof"
            title="What US pet parents say"
            subtitle="Every review below is from a verified PetParcel order."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {(reviews ?? []).map((r) => (
              <figure key={r.id} className="card-soft flex h-full flex-col p-6">
                <Stars rating={r.rating} size={16} />
                {r.title && <p className="mt-3 text-sm font-bold">{r.title}</p>}
                <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  “{r.body}”
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-2 text-xs font-semibold">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    {r.authorName.charAt(0)}
                  </span>
                  <span>{r.authorName}</span>
                  {r.verified && <Chip tone="green">Verified</Chip>}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {/* ── FAQ preview ─────────────────────────────────────────────────────── */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <SectionHeading
              eyebrow="Help center"
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
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-bold">
                  {item.q}
                  <Plus className="h-4 w-4 shrink-0 text-primary transition group-open:rotate-45" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Closing CTA ─────────────────────────────────────────────────────── */}
      <Section muted>
        <div className="card-soft overflow-hidden">
          <div className="grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">Free shipping on orders over ${freeShip}</h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Stock up on the things your pet actually uses. Everything ships from the US, arrives in{" "}
                {s.shipping_estimate}, and comes with a {s.return_window_days}-day return window.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <CtaLink to="/shop" size="lg">
                  Start shopping <ArrowRight className="h-4 w-4" />
                </CtaLink>
                <CtaLink to="/contact" variant="outline" size="lg">
                  Talk to support
                </CtaLink>
              </div>
            </div>
            <ul className="space-y-3 text-sm">
              {[
                `Free US shipping over $${freeShip}`,
                `Flat $${(s.shipping_flat_cents / 100).toFixed(2)} below that`,
                `${s.return_window_days}-day returns, no restocking fee`,
                "Secure card checkout via a PCI-compliant gateway",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
                  <span className="text-muted-foreground">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
