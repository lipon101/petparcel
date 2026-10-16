// Product detail, structured to the reference storefront's layout: a slim
// breadcrumb bar, a two-column product area (thumbnail rail + main image, and
// the buy box), a full-width four-promise band, the tab set, and "You May Also
// Like". Everything is tightened so the page reads as one dense, premium block
// rather than a stack of airy sections.
//
// Two rules run through the whole page:
//
//  * Nothing is invented. Every count, rating and social-proof line is derived
//    from the store's own data. A product with no approved reviews shows a
//    confident "be the first" state rather than a made-up score, and a product
//    with no settled order shows no purchase toast at all.
//  * Real attributes over filler. The Product Details tab prints the product's
//    own materials, dimensions, weight and care, and the shipping tab quotes the
//    LIVE store policy, so nothing on this page can promise something the shop
//    does not actually do.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  Check,
  Heart,
  ArrowRight,
  Home,
  Minus,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { useSeo, averageRating, useCart, scrollToTop } from "@/lib/petparcel";
import { trackAddToCart, trackViewItem } from "@/lib/analytics";
import { useCatalogBySlug, useCatalogCategories } from "@/lib/useCatalog";
import { STORE_URL, formatDate, formatMoney, isLowStock, productShortLine, stripMarkdown } from "@shared/store";
import {
  Badge,
  Breadcrumbs,
  Chip,
  CtaLink,
  EmptyState,
  PriceTag,
  ReviewerMark,
  Section,
  Stars,
} from "@/components/site/Bits";
import { AddToCartButton, totalStock, type StoreProduct } from "@/components/site/ProductCard";
import { ReviewForm } from "@/components/site/ReviewForm";
import {
  ProductGallery,
  ProductTabs,
  ProductTrustStrip,
  RecentPurchaseToast,
  RelatedProducts,
  StickyAddBar,
  isNewArrival,
  type TabName,
} from "@/components/site/ProductExtras";
import { useSite } from "@/components/site/Layout";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/lib/wishlist";
import { buildVariantOptions } from "@/lib/variant-options";
import { atCeiling, atFloor, clampQuantity, orderCeiling, stepQuantity } from "@/lib/quantity";
import { buildProductBreadcrumb } from "@shared/product-breadcrumb";

export default function ProductDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const s = useSite();
  const [, navigate] = useLocation();
  const { product, reviews, related, isLoading, isError } = useCatalogBySlug(slug);
  const { add, signedIn } = useCart();

  // The shopper's pick is a SIZE + COLOUR pair, not a flat row id. Null means
  // "not chosen yet", so the page falls straight through to the model's own
  // sensible default (the first buyable pair) without a flash while an effect
  // settles - and a product swap can never leave a stale pair behind.
  // The live pick, one value per DRAWN AXIS in axis order. A (size, colour)
  // pair could only carry two dimensions when one of them was a colour; a
  // product whose two dimensions are both non-colour (a pattern row and a size
  // row) has no colour half, so the pair model wrote both axes into `size` and
  // the pick resolved to nothing. The positional array keeps every dimension.
  const [selection, setSelection] = useState<(string | null)[] | null>(null);
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<TabName>("Description");
  const [shared, setShared] = useState(false);
  // The wishlist is per account and lives on the server; the heart reads and
  // writes through this context so it can never drift from what is saved.
  const { isWished, toggle: toggleWish, promptSignIn } = useWishlist();
  const wished = product ? isWished(product.id) : false;

  // The two PERMANENT SELECTOR STEPS, derived from the product's real variants.
  // The live page shipped twelve flat rows (S/M/L/XL x Black/Blue/Red); this is
  // what collapses them into four size chips and three colour swatches so the
  // buy box fits above the fold. Nothing here invents an option the product does
  // not really carry.
  const options = useMemo(
    () => buildVariantOptions(product?.variants ?? [], product?.optionDimensions ?? []),
    [product?.variants, product?.optionDimensions],
  );

  // The browse tree, used for ONE thing on this page: placing the product's
  // category under its real parent aisle in the breadcrumb. React Query caches
  // it, so a shopper arriving from the shop page pays nothing for it.
  const { nodes: categoryTree } = useCatalogCategories();

  // The compact trail: Home > Shop > Aisle > Subcategory. Built from the real
  // taxonomy and deliberately WITHOUT the product name - see
  // shared/product-breadcrumb.ts for why the name is left to the <h1>.
  const crumbs = useMemo(
    () => buildProductBreadcrumb(product?.category ?? "", categoryTree),
    [product?.category, categoryTree],
  );

  // Reset the transient UI whenever the product changes. Clearing the pick lets
  // the model hand back the NEW product's default on the very next render.
  useEffect(() => {
    setQty(1);
    setTab("Description");
    setShared(false);
    setSelection(null);
  }, [product?.id]);

  // GA4 view_item - fired once per product view. Keyed on the product id, so
  // switching size/colour does not re-fire it, and a route change to another
  // product does. Consent is enforced inside the helper.
  useEffect(() => {
    if (!product) return;
    trackViewItem(product);
  }, [product?.id]);

  const sel = selection ?? options.defaultAxisSelection;
  const selected = product ? options.findAxis(sel) : null;
  const pick = (next: (string | null)[]) => setSelection(next);
  // Which value the shopper currently holds on one drawn axis - read straight
  // off the positional pick, so the page never has to care which dimension the
  // product leads with or whether either of them is a colour.
  const currentOn = (axisIndex: number): string | null => sel[axisIndex] ?? null;
  // The value held on the OTHER axis, which is what decides whether a value here
  // is still buyable ("is this colour in stock in the size I picked?").
  const otherOn = (axisIndex: number): string | null => {
    if (options.axes.length < 2) return null;
    return currentOn(axisIndex === 0 ? 1 : 0);
  };
  const displayPrice = selected?.priceCents ?? product?.priceCents ?? 0;
  const stock = selected ? selected.inventoryQty : product ? totalStock(product as StoreProduct) : 0;
  // The most units of the option ON SCREEN a shopper may take: the stock on
  // hand, capped at the store's per-line maximum. It is what the stepper's "+"
  // stops at and what the add-to-cart press is clamped against, so the two can
  // never disagree about what is orderable.
  const lineCeiling = orderCeiling(stock);
  // Changing size/colour can drop the ceiling below the number already dialled
  // in (switching from a size with 30 on hand to one with 4). Re-clamp on every
  // variant change so the stepper can never sit on a quantity the shelf cannot
  // fill - without resetting a deliberate count when the ceiling still allows it.
  useEffect(() => {
    setQty((n) => clampQuantity(n, lineCeiling));
  }, [lineCeiling, selected?.id]);
  // Low-stock threshold is a live store setting, so this badge, the admin
  // dashboard and the admin products list can never disagree.
  const lowStockThreshold = s.low_stock_threshold;
  const images = product?.images ?? [];
  const onSale = typeof product?.compareAtCents === "number" && product.compareAtCents > displayPrice;
  // Read from APPROVED reviews only - the API already filters to those, so a
  // pending or hidden review can never move the score.
  const reviewCount = reviews.length;
  const rating = averageRating(reviews.map((r) => r.rating));
  // The buy box carries ONE short line, DERIVED from the product's real category,
  // material AND - when both of those are generic or too long - its own real key
  // attribute (a stated one, else a real option value such as a colour or size).
  // It is built by `productShortLine` in shared/store.ts rather than being the
  // first sentence of the description: the description opens with the supplier's
  // own ~200-character title, so the first sentence was itself ~180 characters
  // and wrapped to three or four rows inside the buy box - which is what made
  // this page read as cramped. The derived line is bounded to fit one row by
  // construction, so it can never wrap and never needs an ellipsis.
  const summary = useMemo(
    () =>
      product
        ? productShortLine({
            category: product.category,
            specs: product.specs,
            optionValues: (product.variants ?? []).map((v) => v.name),
          })
        : "",
    [product],
  );
  const isNew = product ? isNewArrival(product.createdAt) : false;

  useSeo(
    useMemo(
      () => ({
        title: product ? product.name : "Product",
        description: product
          ? stripMarkdown(product.description).slice(0, 155)
          : "Everyday pet supplies for dogs and cats, shipped fast and tracked.",
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
                description: stripMarkdown(product.description),
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
              }
            : null,
      }),
      [product?.id, slug, displayPrice, stock, images[0], reviewCount, rating, s.brand_name],
    ),
  );

  if (isLoading) {
    return (
      <div className="pp-wrap">
        <div className="pp-layout">
          <div className="aspect-square animate-pulse rounded-[18px] bg-blush" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-blush" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-blush" />
            <div className="h-24 animate-pulse rounded bg-blush" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <Section className="!pt-10">
        <Breadcrumbs
          trail={[{ label: "Home", to: "/" }, { label: "Shop", to: "/shop" }, { label: "Not found" }]}
        />
        <EmptyState
          icon={<span className="text-2xl">🔍</span>}
          title="We couldn't find that product"
          body="It may have sold out or been renamed. Browse the full catalogue to find what you need."
          action={
            <CtaLink to="/shop" variant="outline">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Browse all products
            </CtaLink>
          }
        />
      </Section>
    );
  }

  const cartLine = {
    slug: product.slug,
    variantId: selected?.id ?? null,
    name: product.name,
    variantName: selected?.name ?? null,
    priceCents: displayPrice,
    // The PICKED VARIANT's own photo when it has one, so the basket line shows
    // the colour the shopper chose rather than the product's generic hero shot.
    image: selected?.imageUrl ?? images[0] ?? null,
    maxQty: selected ? selected.inventoryQty : totalStock(product as StoreProduct),
  };

  const toggleWishlist = () => {
    // Signed out: the server would reject the toggle, so send the shopper to
    // sign in and return them to this product instead of doing nothing.
    void toggleWish(product.id).then((saved) => {
      if (saved === null) promptSignIn();
    });
  };

  const share = async () => {
    const url = `${window.location.origin}/product/${product.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 2200);
    } catch {
      /* the shopper dismissed the share sheet - nothing to report */
    }
  };

  const reviewsSlot =
    reviewCount === 0 ? (
      <div className="reviews-split-grid">
        <div className="reviews-left-col">
          <p className="reviews-empty">
            No reviews yet - be the first to share yours.
          </p>
          <ul className="pd-check-list">
            <li>
              <Check className="h-4 w-4" aria-hidden="true" />
              Every review here comes from a real order, so what you read is a verified
              purchase.
            </li>
            <li>
              <Check className="h-4 w-4" aria-hidden="true" />
              Bought this one? Your words help the next pet owner decide.
            </li>
          </ul>
        </div>
        <div className="reviews-right-col">
          <ReviewForm productId={product.id} />
        </div>
      </div>
    ) : (
      <div className="reviews-split-grid">
        <div className="reviews-left-col">
          <div className="reviews-list">
            {reviews.map((r) => (
              <figure key={r.id} className="card-soft flex h-full flex-col p-5">
                <Stars rating={r.rating} size={15} />
                {r.title && <p className="mt-2.5 text-[14.5px] font-semibold">{r.title}</p>}
                <blockquote className="mt-1.5 flex-1 text-sm leading-relaxed text-gray">
                  “{r.body}”
                </blockquote>
                {r.images && r.images.length > 0 && (
                  <div className="pd-review-photos">
                    {r.images.map((src, i) => (
                      <img key={`${src}-${i}`} src={src} alt="" loading="lazy" decoding="async" />
                    ))}
                  </div>
                )}
                <figcaption className="mt-3.5 flex items-center gap-2 text-xs font-semibold">
                  <ReviewerMark name={r.authorName} className="h-7 w-7" />
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
        </div>
        <div className="reviews-right-col">
          <ReviewForm productId={product.id} />
        </div>
      </div>
    );

  return (
    <>
      {/* ── Breadcrumb: a slim row with a home icon, tight to the top ───────── */}
      <div className="pp-wrap pp-breadcrumb-wrap">
        <nav className="pd-breadcrumb" aria-label="Breadcrumb">
          {crumbs.map((crumb, i) => (
            <span key={`${crumb.label}-${i}`} className="pd-crumb">
              {i > 0 && (
                <span className="bc-sep" aria-hidden="true">
                  ›
                </span>
              )}
              {crumb.to ? (
                <Link to={crumb.to}>
                  {i === 0 && <Home className="h-3.5 w-3.5" aria-hidden="true" />}
                  {crumb.label}
                </Link>
              ) : (
                <span className="bc-here" aria-current="page">
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* ── Product area: gallery left, buy box right ───────────────────────── */}
      <div className="pp-wrap pp-layout">
        <ProductGallery
          product={product as StoreProduct}
          variantImage={selected?.imageUrl ?? null}
          badge={
            onSale ? (
              <Badge variant="sale">
                −{Math.round((1 - displayPrice / (product.compareAtCents as number)) * 100)}%
              </Badge>
            ) : isNew ? (
              <Badge variant="new">NEW</Badge>
            ) : product.featured ? (
              <Badge variant="best">Featured</Badge>
            ) : null
          }
        />

        <div className="pp-info" id="pd-buybox">
          <h1 className="pd-title">{product.name}</h1>

          {/* Availability: ONE real read on stock for the chosen option. There is
              no duplicate "In Stock" pill and no generic reassurance line - the
              store back-orders nothing, so low stock and sold out both state the
              fact plainly and point at what the shopper can do. */}
          <div className="pd-avail">
            <span
              className={cn(
                "pd-avail-badge",
                stock <= 0 ? "is-out" : isLowStock(stock, lowStockThreshold) ? "is-low" : "is-in",
              )}
            >
              <span className="pd-avail-dot" aria-hidden="true" />
              {stock <= 0 ? "Sold out" : isLowStock(stock, lowStockThreshold) ? `Low stock - only ${stock} left` : "In stock"}
            </span>
            {stock <= 0 && (
              <span className="pd-avail-note">
                Out of stock right now - check back soon or choose another option.
              </span>
            )}
          </div>

          {/* Delivery estimate: the store's own shipping window, read from the
              live settings so it can never promise a speed the shop does not
              actually run. */}
          <p className="pd-delivery">
            <Truck className="h-3.5 w-3.5" aria-hidden="true" />
            Order today · {s.shipping_estimate}
          </p>

          {/* Rating line. With approved reviews it shows the real score; on a
              product that has none yet it invites the first review instead of
              leaving the row blank - the row belongs to the buy box at every
              stage of the product's life. */}
          <div className="pd-rating-row">
            {reviewCount > 0 ? (
              <>
                <Stars rating={rating} size={15} showValue count={reviewCount} />
                <button
                  type="button"
                  onClick={() => {
                    setTab("Reviews");
                    document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="pd-rating-link"
                >
                  Read {reviewCount} verified review{reviewCount === 1 ? "" : "s"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTab("Reviews");
                  document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="pd-rating-link pd-rating-empty"
              >
                <Stars rating={0} size={15} />
                Be the first to review
              </button>
            )}
          </div>

          {/* Price row. */}
          <div className="pd-price-row">
            <PriceTag priceCents={displayPrice} compareAtCents={product.compareAtCents} size="lg" />
          </div>

          {/* The three things that unblock a buy decision, stated for THIS store:
              how it ships, how returning works, and that paying is safe. The
              shipping and return lines quote the live store policy, so they can
              never drift from what the shop actually does. */}
          <ul className="pd-assurance">
            <li>
              <Truck className="h-4 w-4" aria-hidden="true" />
              <span>
                {s.free_shipping_threshold_cents > 0
                  ? `Free tracked US shipping over ${formatMoney(s.free_shipping_threshold_cents)}`
                  : `Flat ${formatMoney(s.shipping_flat_cents)} tracked US shipping`}
              </span>
            </li>
            <li>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>{s.return_window_days}-day free returns</span>
            </li>
            <li>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span>Secure checkout</span>
            </li>
          </ul>

          {/* Short description; the full copy lives in its tab below. */}
          <p className="pd-short">{summary}</p>

          {/* Two-step variant picker: one compact size-chip row and one colour
              swatch row. Only the CHOSEN option's SKU and price are shown; the
              other eleven combinations stay collapsed, so the whole buy box sits
              above the fold. Both axes come straight from the product's real
              variants and a sold-out combination is greyed rather than hidden. */}
          {product.variants.length > 0 && (
            <div className="pd-options">
              {/* ONE GROUP PER REAL OPTION DIMENSION. The axes are read from the
                  product's own option values, so a colourway dimension draws as
                  swatches headed "Colour" and a size dimension as chips headed
                  "Size" - a size group can never be labelled "Choose a colour"
                  again. One control is drawn per real option value, its dot is
                  the real colour of that colourway, and a value is disabled only
                  when the store's own stock for it is zero. */}
              {options.axes.map((axis, axisIndex) => {
                const isColor = axis.kind === "color";
                const held = currentOn(axisIndex);
                const other = otherOn(axisIndex);
                return (
                  <div className="pd-opt-group" key={`${axis.kind}-${axisIndex}`}>
                    <div className="pd-opt-head">
                      <span className="pd-label">{axis.label}</span>
                      {axis.kind === "size" ? (
                        <button
                          type="button"
                          className="pd-sizeguide-link"
                          onClick={() => {
                            setTab("Product Details");
                            document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          Size guide
                        </button>
                      ) : (
                        <span className="pd-opt-current">
                          {held ? axis.displayValue(held) : "Select"}
                        </span>
                      )}
                    </div>
                    <div
                      className={isColor ? "pd-swatches" : "pd-chips"}
                      role="group"
                      aria-label={axis.ariaLabel}
                    >
                      {axis.values.map((value) => {
                        const chosen = held === value;
                        const out = !axis.available(value, other);
                        const label = axis.displayValue(value);
                        const onPick = () => {
                          pick(options.nextAxisSelection(axisIndex, value, sel));
                        };
                        return isColor ? (
                          <button
                            key={value}
                            type="button"
                            disabled={out}
                            aria-pressed={chosen}
                            aria-label={label}
                            title={label}
                            onClick={onPick}
                            className={cn("color-swatch", chosen && "is-on", out && "is-out")}
                          >
                            <span
                              className={cn(
                                "color-swatch-dot",
                                options.swatchNeedsBorder(value) && "has-border",
                              )}
                              style={options.swatchStyle(value)}
                            />
                          </button>
                        ) : (
                          <button
                            key={value}
                            type="button"
                            disabled={out}
                            aria-pressed={chosen}
                            title={label}
                            onClick={onPick}
                            className={cn("size-chip", chosen && "is-on", out && "is-out")}
                          >
                            {axis.chipLabel(value)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Nothing to choose between. When the SUPPLIER states a dimension
                  ("Set", "Pack", "Colour") the row names it and shows the real
                  option value - a genuine single-option listing, stated plainly.
                  When the supplier states none at all, the product really does
                  come in one configuration, so nothing is drawn: printing a
                  heading there is what used to make the page read as a
                  placeholder titled "Option". */}
              {options.singleLabel && (
                <p
                  className={cn(
                    "pd-opt-single",
                    !options.singleDimensionStated && "pd-opt-single-plain",
                  )}
                >
                  {options.singleDimensionStated && options.singleLabelHeading ? (
                    <span className="pd-label">{options.singleLabelHeading}</span>
                  ) : null}
                  <span className="pd-opt-single-value">{options.singleLabel}</span>
                </p>
              )}

              {/* The pick, made observable. Two things read this: a screen
                  reader (via the visible option text), and the responsive
                  verification gate, which presses every control and asserts the
                  SELECTED VARIANT really changes - not merely that a price label
                  moved. A catalogue can hold several distinct variants at one
                  price (e.g. six colours all at $18.49), so the price alone is
                  not proof that a press switched anything; the resolved variant
                  id is. It is the store's own row id, already public in the
                  product payload, and it names no supplier. */}
              {selected && (
                <p className="pd-opt-meta" data-variant-id={selected.id}>
                  {/* The supplier's own SKU is deliberately NOT shown to a
                      shopper - it is an internal fulfilment reference, not
                      customer-facing information, and publishing it invites a
                      customer to search the supplier's own site. It stays
                      available to the admin panel only. */}
                  {selected.inventoryQty <= 0 ? (
                    <span className="pd-opt-stock is-out">Sold out</span>
                  ) : (
                    <span className="pd-opt-stock">{formatMoney(selected.priceCents)}</span>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Quantity stepper: label above, − / number / + in one row. The two
              buttons are REAL controls: they step the line live, "-" stops at
              one (a shopper removes a line, they never order zero) and "+"
              stops at the stock on hand, so the control cannot promise more
              than the shelf holds. The field also accepts a typed number. The
              live region below announces the value to a screen reader without
              moving anything on screen. */}
          <div className="pd-qty">
            <div className="pd-label">Quantity</div>
            <div className="qty-stepper">
              <button
                type="button"
                className="qty-btn"
                aria-label="Decrease quantity"
                disabled={atFloor(qty)}
                onClick={() => setQty((n) => stepQuantity(n, -1, lineCeiling))}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                className="qty-input"
                type="text"
                inputMode="numeric"
                value={qty}
                onChange={(e) =>
                  setQty((n) => clampQuantity(e.target.value === "" ? n : e.target.value, lineCeiling))
                }
                onBlur={(e) => setQty((n) => clampQuantity(e.target.value || n, lineCeiling))}
                aria-label="Quantity"
              />
              <button
                type="button"
                className="qty-btn"
                aria-label="Increase quantity"
                disabled={atCeiling(qty, lineCeiling)}
                title={atCeiling(qty, lineCeiling) ? `Only ${lineCeiling} available` : undefined}
                onClick={() => setQty((n) => stepQuantity(n, 1, lineCeiling))}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <span className="sr-only" aria-live="polite">
              {`Quantity ${qty}`}
            </span>
          </div>

          {/* Primary actions */}
          <div className="pd-actions">
            <AddToCartButton
              product={product as StoreProduct}
              variant={selected}
              qty={qty}
              size="lg"
              className="flex-1"
            />
            <button
              type="button"
              disabled={stock <= 0}
              onClick={() => {
                const line = clampQuantity(qty, lineCeiling);
                add(cartLine, line);
                // Buy Now adds the line too, so it reports the same add_to_cart
                // as the button beside it (only for a real, signed-in add).
                if (signedIn) trackAddToCart(product as StoreProduct, selected, line);
                scrollToTop();
                navigate("/checkout");
              }}
              className={cn(
                "btn btn-outline btn-lg flex-1",
                stock <= 0 && "cursor-not-allowed opacity-45",
              )}
            >
              <ShoppingCart className="h-4 w-4" aria-hidden="true" /> Buy Now
            </button>
          </div>

          {/* Secondary links row */}
          <div className="pd-links">
            <button
              type="button"
              aria-pressed={wished}
              onClick={toggleWishlist}
              className={cn("pd-link", wished && "is-on")}
            >
              <Heart className={cn("h-4 w-4", wished && "fill-current")} aria-hidden="true" />
              <span>{wished ? "On your wishlist" : "Add to Wishlist"}</span>
            </button>
            <button type="button" onClick={() => void share()} className="pd-link">
              <Share2 className="h-4 w-4" aria-hidden="true" />
              <span>Share this product</span>
            </button>
            <span className="text-[12.5px] font-semibold text-teal-deep" aria-live="polite">
              {shared ? "Link copied" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Features strip: a full-width band, four promises in one row ─────── */}
      <ProductTrustStrip />

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="pp-wrap pp-tabs-wrap">
        <div id="reviews" className="scroll-mt-32">
          <ProductTabs
            product={product as StoreProduct}
            reviewsSlot={reviewsSlot}
            tab={tab}
            reviewCount={reviewCount}
            stock={stock}
            onTab={(t) => {
              setTab(t);
              document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        </div>
      </div>

      {/* ── Related ────────────────────────────────────────────────────────── */}
      {/* Cross-sell and close: the section that fills the space below the tabs,
          and the last thing a shopper sees before deciding. */}
      <RelatedProducts product={product as StoreProduct} related={related} />

      {/* Real social proof only: renders nothing when no settled order exists. */}
      <RecentPurchaseToast product={product as StoreProduct} />

      {/* Pinned buy bar: appears once the real buy box scrolls out of view. */}
      <StickyAddBar product={product as StoreProduct} variant={selected} />
    </>
  );
}
