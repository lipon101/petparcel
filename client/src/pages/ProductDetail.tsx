// Product detail — gallery, variant picker, quantity, add to cart, reviews and
// related products. Emits schema.org Product JSON-LD for rich results.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { ArrowRight, Check, Minus, Plus, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useSeo, averageRating } from "@/lib/petparcel";
import { STORE_URL, formatDate, formatMoney } from "@shared/store";
import {
  Breadcrumbs,
  Chip,
  CtaLink,
  EmptyState,
  PriceTag,
  Section,
  SectionHeading,
  Stars,
} from "@/components/site/Bits";
import { AddToCartButton, ProductCard, totalStock, type StoreProduct } from "@/components/site/ProductCard";
import { cn } from "@/lib/utils";

export default function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { data, isLoading, isError } = trpc.catalog.bySlug.useQuery({ slug });
  const product = data?.product;
  const reviews = data?.reviews ?? [];
  const related = (data?.related ?? []) as StoreProduct[];

  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  // Default to the first in-stock active variant whenever the product changes.
  useEffect(() => {
    setActiveImage(0);
    setQty(1);
    if (!product) return;
    const inStock = product.variants.find((v) => v.active && v.inventoryQty > 0);
    setVariantId((inStock ?? product.variants.find((v) => v.active) ?? product.variants[0])?.id ?? null);
  }, [product?.id]);

  const selected = product?.variants.find((v) => v.id === variantId) ?? null;
  const displayPrice = selected?.priceCents ?? product?.priceCents ?? 0;
  const stock = selected ? selected.inventoryQty : product ? totalStock(product as StoreProduct) : 0;
  const images = product?.images?.length ? product.images : [];

  const rating = averageRating(reviews.map((r) => r.rating));

  useSeo(
    useMemo(
      () => ({
        title: product ? product.name : "Product",
        description: product
          ? product.description.slice(0, 155)
          : "Pet supplies shipped free across the USA.",
        path: `/product/${slug}`,
        image: images[0] ?? "/hero.png",
        type: "product" as const,
        noindex: !product,
        jsonLd:
          product && images[0]
            ? {
                "@context": "https://schema.org",
                "@type": "Product",
                name: product.name,
                image: [`${STORE_URL}${images[0]}`],
                description: product.description,
                sku: selected?.sku ?? undefined,
                category: product.category,
                brand: { "@type": "Brand", name: "PetParcel" },
                offers: {
                  "@type": "Offer",
                  url: `${STORE_URL}/product/${product.slug}`,
                  priceCurrency: "USD",
                  price: (displayPrice / 100).toFixed(2),
                  availability:
                    stock > 0
                      ? "https://schema.org/InStock"
                      : "https://schema.org/OutOfStock",
                  itemCondition: "https://schema.org/NewCondition",
                  shippingDetails: {
                    "@type": "OfferShippingDetails",
                    shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
                  },
                },
                ...(reviews.length > 0
                  ? {
                      aggregateRating: {
                        "@type": "AggregateRating",
                        ratingValue: rating.toFixed(1),
                        reviewCount: reviews.length,
                      },
                    }
                  : {}),
              }
            : null,
      }),
      [product?.id, slug, displayPrice, stock, images[0], reviews.length, rating],
    ),
  );

  if (isLoading) {
    return (
      <Section className="!pt-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </Section>
    );
  }

  if (isError || !product) {
    return (
      <Section className="!pt-8">
        <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "Shop", to: "/shop" }, { label: "Not found" }]} />
        <EmptyState
          icon={<span className="text-2xl">🔍</span>}
          title="We couldn't find that product"
          body="It may have sold out or been renamed. Browse the catalog — we keep the range small on purpose."
          action={
            <CtaLink to="/shop" variant="outline">
              Browse all products
            </CtaLink>
          }
        />
      </Section>
    );
  }

  return (
    <>
      <Section className="!pt-8 !pb-10">
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Shop", to: "/shop" },
            { label: product.category, to: `/shop?category=${encodeURIComponent(product.category)}` },
            { label: product.name },
          ]}
        />

        <div className="grid gap-10 lg:grid-cols-2">
          {/* ── Gallery ───────────────────────────────────────────────── */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-border bg-muted">
              <div className="aspect-square w-full">
                {images[activeImage] ? (
                  <img
                    src={images[activeImage]}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl">🐾</div>
                )}
              </div>
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-3">
                {images.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      "h-20 w-20 overflow-hidden rounded-xl border-2 transition",
                      i === activeImage ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Buy box ───────────────────────────────────────────────── */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="teal">{product.category}</Chip>
              {product.tags.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>

            <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{product.name}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Stars rating={rating || 4.7} size={16} showValue count={reviews.length} />
              {reviews.length > 0 && (
                <a href="#reviews" className="text-sm font-semibold text-primary hover:underline">
                  Read {reviews.length} review{reviews.length === 1 ? "" : "s"}
                </a>
              )}
            </div>

            <div className="mt-5">
              <PriceTag priceCents={displayPrice} compareAtCents={product.compareAtCents} size="lg" />
              <p className="mt-1 text-xs text-muted-foreground">Price in USD, tax shown at checkout.</p>
            </div>

            <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">{product.description}</p>

            {/* Variant picker */}
            {product.variants.length > 0 && (
              <div className="mt-6">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold">
                    {product.variants.length > 1 ? "Choose an option" : "Option"}
                  </span>
                  {selected && (
                    <span className="text-xs text-muted-foreground">SKU {selected.sku}</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const out = v.inventoryQty <= 0 || !v.active;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={out}
                        onClick={() => setVariantId(v.id)}
                        className={cn(
                          "rounded-xl border-2 px-4 py-2.5 text-left text-sm font-semibold transition",
                          v.id === variantId
                            ? "border-primary bg-secondary"
                            : "border-border bg-card hover:border-primary/40",
                          out && "cursor-not-allowed opacity-45 line-through",
                        )}
                      >
                        <span className="block">{v.name}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {formatMoney(v.priceCents)}
                          {out ? " · sold out" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity + add */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex h-12 items-center rounded-full border border-input bg-card">
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  className="inline-flex h-12 w-11 items-center justify-center rounded-l-full hover:bg-secondary"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-bold" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.min(Math.max(stock, 1), n + 1))}
                  className="inline-flex h-12 w-11 items-center justify-center rounded-r-full hover:bg-secondary"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <AddToCartButton
                product={product as StoreProduct}
                variant={selected}
                size="lg"
                className="flex-1 sm:flex-none"
              />
              <CtaLink to="/cart" variant="outline" size="lg">
                View cart
              </CtaLink>
            </div>

            <p className="mt-3 text-sm font-semibold">
              {stock > 0 ? (
                stock <= 5 ? (
                  <span className="text-amber-700">Only {stock} left in stock — ships today</span>
                ) : (
                  <span className="text-emerald-700">In stock — ships within 1 business day</span>
                )
              ) : (
                <span className="text-rose-700">Currently sold out</span>
              )}
            </p>

            {/* Trust points */}
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Truck, label: "Free US shipping over $49" },
                { icon: RotateCcw, label: "30-day returns" },
                { icon: ShieldCheck, label: "Secure card checkout" },
              ].map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2.5 text-xs font-semibold">
                  <Icon className="h-4 w-4 shrink-0 text-primary" /> {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── Reviews ──────────────────────────────────────────────────────── */}
      <Section muted className="!pt-4">
        <div id="reviews" className="scroll-mt-24">
          <SectionHeading
            eyebrow="Reviews"
            title={reviews.length > 0 ? `${reviews.length} customer review${reviews.length === 1 ? "" : "s"}` : "No reviews yet"}
            subtitle={
              reviews.length > 0
                ? `Rated ${rating.toFixed(1)} out of 5 by verified PetParcel customers.`
                : "Be the first to review this product after your order arrives."
            }
          />

          {reviews.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body="We only publish reviews from real orders, so this space stays empty until a customer weighs in."
              action={
                <CtaLink to="/shop" variant="outline">
                  Keep browsing
                </CtaLink>
              }
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r.id} className="card-soft flex h-full flex-col p-6">
                  <Stars rating={r.rating} size={15} />
                  {r.title && <p className="mt-3 text-sm font-bold">{r.title}</p>}
                  <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    “{r.body}”
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-2 text-xs font-semibold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                      {r.authorName.charAt(0)}
                    </span>
                    <span>{r.authorName}</span>
                    {r.verified && <Chip tone="green"><Check className="h-3 w-3" /> Verified</Chip>}
                    <span className="ml-auto font-normal text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── Related ──────────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <Section>
          <SectionHeading
            eyebrow="You might also like"
            title={`More ${product.category.toLowerCase()} favorites`}
            action={
              <CtaLink to={`/shop?category=${encodeURIComponent(product.category)}`} variant="outline" size="sm">
                All {product.category} <ArrowRight className="h-4 w-4" />
              </CtaLink>
            }
          />
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
