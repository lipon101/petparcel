// Product detail — a thumbnail rail beside the main image, the buy box, variant
// picker, quantity, reviews and related products. Emits schema.org Product
// JSON-LD so the listing can earn rich results in Google.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { Check, Minus, Plus, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useSeo, averageRating } from "@/lib/petparcel";
import { STORE_URL, formatDate, formatMoney } from "@shared/store";
import {
  Badge,
  Breadcrumbs,
  Chip,
  CtaLink,
  EmptyState,
  PriceTag,
  Section,
  SectionHeading,
  Stars,
} from "@/components/site/Bits";
import { AddToCartButton, ProductGrid, totalStock, type StoreProduct } from "@/components/site/ProductCard";
import { useSite } from "@/components/site/Layout";
import { cn } from "@/lib/utils";

export default function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const s = useSite();
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
  const onSale =
    typeof product?.compareAtCents === "number" && product.compareAtCents > displayPrice;
  const rating = averageRating(reviews.map((r) => r.rating));
  const freeShip = (s.free_shipping_threshold_cents / 100).toFixed(0);

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
                brand: { "@type": "Brand", name: s.brand_name },
                offers: {
                  "@type": "Offer",
                  url: `${STORE_URL}/product/${product.slug}`,
                  priceCurrency: "USD",
                  price: (displayPrice / 100).toFixed(2),
                  availability:
                    stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
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
      [product?.id, slug, displayPrice, stock, images[0], reviews.length, rating, s.brand_name],
    ),
  );

  if (isLoading) {
    return (
      <Section className="!pt-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-[18px] bg-blush" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-blush" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-blush" />
            <div className="h-24 animate-pulse rounded bg-blush" />
          </div>
        </div>
      </Section>
    );
  }

  if (isError || !product) {
    return (
      <>
        <Section className="!pt-10">
          <Breadcrumbs
            trail={[{ label: "Home", to: "/" }, { label: "Shop", to: "/shop" }, { label: "Not found" }]}
          />
          <EmptyState
            icon={<span className="text-2xl">🔍</span>}
            title="We couldn't find that product"
            body="It may have sold out or been renamed. Browse the catalogue — we keep the range small on purpose."
            action={
              <CtaLink to="/shop" variant="outline">
                Browse all products
              </CtaLink>
            }
          />
        </Section>
      </>
    );
  }

  return (
    <>
      <Section className="!pt-10 !pb-12">
        <Breadcrumbs
          trail={[
            { label: "Home", to: "/" },
            { label: "Shop", to: "/shop" },
            { label: product.category, to: `/shop?category=${encodeURIComponent(product.category)}` },
            { label: product.name },
          ]}
        />

        <div className="grid gap-12 lg:grid-cols-2">
          {/* ── Gallery ──────────────────────────────────────────────────────── */}
          <div className={cn(images.length > 1 && "flex gap-4")}>
            {images.length > 1 && (
              <div className="flex w-[74px] shrink-0 flex-col gap-3">
                {images.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={cn(
                      "aspect-square w-full overflow-hidden rounded-xl border-2 bg-blush transition-all",
                      i === activeImage
                        ? "border-teal"
                        : "border-transparent opacity-65 hover:opacity-100",
                    )}
                    aria-label={`View image ${i + 1}`}
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex-1 overflow-hidden rounded-[18px] border border-line bg-blush">
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
              {onSale ? (
                <Badge variant="sale">
                  −{Math.round((1 - displayPrice / (product.compareAtCents as number)) * 100)}%
                </Badge>
              ) : product.featured ? (
                <Badge variant="best">Best seller</Badge>
              ) : null}
            </div>
          </div>

          {/* ── Buy box ──────────────────────────────────────────────────────── */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="teal">{product.category}</Chip>
              {product.tags.slice(0, 3).map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>

            <h1 className="mt-4 text-[30px] font-medium leading-[1.15] sm:text-[38px]">
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Stars rating={rating || 4.7} size={16} showValue count={reviews.length} />
              {reviews.length > 0 && (
                <a href="#reviews" className="text-[13.5px] font-semibold text-teal hover:text-coral">
                  Read {reviews.length} review{reviews.length === 1 ? "" : "s"}
                </a>
              )}
            </div>

            <div className="mt-5">
              <PriceTag priceCents={displayPrice} compareAtCents={product.compareAtCents} size="lg" />
              <p className="mt-1 text-[12.5px] text-gray">
                Price in USD. Tax, where applicable, is shown at checkout.
              </p>
            </div>

            <p className="mt-5 text-[15px] leading-relaxed text-gray">{product.description}</p>

            {/* Variant picker */}
            {product.variants.length > 0 && (
              <div className="mt-6">
                <div className="flex items-baseline justify-between">
                  <span className="field-label !mb-0">
                    {product.variants.length > 1 ? "Choose an option" : "Option"}
                  </span>
                  {selected && <span className="text-[12px] text-gray">SKU {selected.sku}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {product.variants.map((v) => {
                    const out = v.inventoryQty <= 0 || !v.active;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={out}
                        onClick={() => setVariantId(v.id)}
                        className={cn(
                          "rounded-[10px] border px-4 py-2.5 text-left text-[13.5px] transition-all",
                          v.id === variantId
                            ? "border-teal bg-teal-soft text-teal-deep"
                            : "border-line bg-white hover:border-teal/50",
                          out && "cursor-not-allowed opacity-45 line-through",
                        )}
                      >
                        <span className="block font-semibold">{v.name}</span>
                        <span className="block text-[12px] text-gray">
                          {formatMoney(v.priceCents)}
                          {out ? " · sold out" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity + add to cart */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex h-12 items-center overflow-hidden rounded-[10px] border border-line bg-white">
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.max(1, n - 1))}
                  className="inline-flex h-12 w-11 items-center justify-center transition-colors hover:bg-blush"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center text-sm font-semibold" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((n) => Math.min(Math.max(stock, 1), n + 1))}
                  className="inline-flex h-12 w-11 items-center justify-center transition-colors hover:bg-blush"
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

            <p className="mt-3 text-[13.5px] font-semibold">
              {stock > 0 ? (
                stock <= 5 ? (
                  <span className="text-amber-700">Only {stock} left — ships today</span>
                ) : (
                  <span className="text-teal-deep">In stock — ships within 1 business day</span>
                )
              ) : (
                <span className="text-coral-deep">Currently sold out</span>
              )}
            </p>

            {/* Trust points */}
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-3">
              {[
                { icon: Truck, label: `Free US shipping over $${freeShip}` },
                { icon: RotateCcw, label: `${s.return_window_days}-day returns` },
                { icon: ShieldCheck, label: "Secure card checkout" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-[10px] bg-teal-soft/70 px-3 py-2.5 text-[11.5px] font-semibold text-teal-deep"
                >
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── Reviews ─────────────────────────────────────────────────────────── */}
      <Section muted className="!pt-12">
        <div id="reviews" className="scroll-mt-32">
          <SectionHeading
            eyebrow="Reviews"
            title={
              reviews.length > 0
                ? `${reviews.length} customer review${reviews.length === 1 ? "" : "s"}`
                : "No reviews yet"
            }
            subtitle={
              reviews.length > 0
                ? `Rated ${rating.toFixed(1)} out of 5 by verified PetParcel customers.`
                : "We only publish reviews from real orders — be the first once yours arrives."
            }
          />

          {reviews.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              body="This space stays empty until a customer who bought it weighs in. You can be the first."
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
                  {r.title && <p className="mt-3 text-[14.5px] font-semibold">{r.title}</p>}
                  <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-gray">
                    “{r.body}”
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-2 text-xs font-semibold">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-soft text-teal-deep">
                      {r.authorName.charAt(0)}
                    </span>
                    <span>{r.authorName}</span>
                    {r.verified && (
                      <Chip tone="green">
                        <Check className="h-3 w-3" /> Verified
                      </Chip>
                    )}
                    <span className="ml-auto font-normal text-gray">{formatDate(r.createdAt)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── Related ─────────────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <Section>
          <SectionHeading
            eyebrow="You might also like"
            title={`More ${product.category.toLowerCase()} favourites`}
            actionTo={`/shop?category=${encodeURIComponent(product.category)}`}
            actionLabel={`All ${product.category}`}
          />
          <ProductGrid products={related} />
        </Section>
      )}
    </>
  );
}
