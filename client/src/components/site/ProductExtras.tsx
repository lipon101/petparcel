// The blocks a real product page needs below the buy box: the five-tile gallery,
// the four-promise band, the tab set, and "You May Also Like".
//
// Design rules that hold across every block here:
//
//  * Nothing invents data. The recent-purchase toast reads real settled orders
//    and renders NOTHING when there are none; the social proof is the store's own
//    orders, and the customer is shown as a first name and a city, never more.
//  * The trust band and the shipping tab read the LIVE store settings, so the
//    promises on this page match the policy the admin panel actually holds.
//  * Every block reuses the site's existing primitives (SectionHeading, card-soft,
//    grid-4, badge) so it inherits the current sizes and spacing instead of
//    introducing new ones.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Film,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  X,
  ZoomIn,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useSite } from "@/components/site/Layout";
import { Stars } from "@/components/site/Bits";
import { ProductGrid, totalStock, useAddToCart, type StoreProduct } from "@/components/site/ProductCard";
import { cn } from "@/lib/utils";
import { compactVariantLabel } from "@/lib/variant-options";
import { normalizeMedia, type MediaKind } from "@shared/media";
import { formatMoney, galleryImages, parseProductCopy, productShippingLine, productTrustStrip } from "@shared/store";
import { productImageUrl, productImageSrcSet } from "@shared/product-media";
import type { StoreProductSpecs } from "@/lib/types";

/** True when the product was added recently enough to carry a NEW badge.
 *  Derived from the row's own created_at, so it stops being true on its own as
 *  the store ages - nothing to remember to switch off. */
const NEW_WINDOW_DAYS = 30;
export function isNewArrival(createdAt: Date | string | undefined | null): boolean {
  if (!createdAt) return false;
  const t = typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/** "12 minutes ago" / "3 hours ago" / "2 days ago" - from a real timestamp. */
function timeAgo(value: Date | string): string {
  const t = typeof value === "string" ? new Date(value).getTime() : value.getTime();
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 60) return `${Math.max(1, mins)} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ── Gallery ───────────────────────────────────────────────────────────────────
/** The five-tile gallery: a thumbnail rail beside a square main image, with a
 *  click-to-zoom lightbox.
 *
 *  The product supplies the real photographs; `galleryImages` fills the rail to
 *  five from them, so a product shot once still shows five working tiles rather
 *  than broken ones - there is no placeholder art anywhere. The rail is centred
 *  against the square stage, so the main image and all five thumbnails share one
 *  axis and read as perfectly aligned. */
export function ProductGallery({
  product,
  badge,
  variantImage,
}: {
  product: StoreProduct;
  badge?: React.ReactNode;
  /** The picked variant's OWN photograph (R2), when the supplier provides one.
   *  The stage shows it so a colour press reveals the colour the shopper chose;
   *  the rail keeps the product's full media set. */
  variantImage?: string | null;
}) {
  // The gallery is the product's real media: images AND videos. When the
  // product has no media of its own we fall back to filling five working IMAGE
  // tiles from its photographs (the long-standing behaviour), so a product shot
  // once still shows a full rail rather than broken tiles. A video is never
  // dressed up as an image - it gets a <video> element of its own.
  const media = useMemo(
    () => normalizeMedia(product.media, product.images),
    // Keyed on the join so a re-render with the same media does not rebuild the
    // rail, while a product swap (different media) does.
    [product.media?.map((m) => m.url).join("|") ?? "", product.images.join("|")], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const tiles = useMemo(() => {
    const hasVideo = media.some((m) => m.kind === "video");
    if (hasVideo) {
      return media.map((m, i) => ({ url: m.url, kind: m.kind as MediaKind, sourceIndex: i, repeat: false }));
    }
    return galleryImages(product.images).map((t) => ({
      url: t.src,
      kind: "image" as MediaKind,
      sourceIndex: t.sourceIndex,
      repeat: t.repeat,
    }));
  }, [media, product.images.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const poster = media.find((m) => m.kind === "image")?.url ?? product.images[0];
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setActive(0);
    setZoom(false);
  }, [product.id]);

  // The lightbox owns Escape and the arrow keys while it is open, and locks the
  // page behind it so scrolling does not drift the product page underneath.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      if (e.key === "ArrowRight") setActive((i) => (i + 1) % Math.max(1, tiles.length));
      if (e.key === "ArrowLeft") setActive((i) => (i - 1 + tiles.length) % Math.max(1, tiles.length));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoom, tiles.length]);

  const current = tiles[active];

  return (
    <>
      <div className="pd-gallery">
        {tiles.length > 1 && (
          <div className="pd-thumbs" role="group" aria-label={`${product.name} images`}>
            {tiles.map((tile, i) => (
              <button
                key={`${tile.url}-${i}`}
                type="button"
                onClick={() => setActive(i)}
                className={cn("pd-thumb", i === active && "is-active")}
                aria-label={
                  tile.repeat
                    ? `Show image ${i + 1} (same photo as image ${tile.sourceIndex + 1})`
                    : `Show image ${i + 1}`
                }
                aria-current={i === active}
              >
                {tile.kind === "video" ? (
                  <span className="relative block h-full w-full">
                    <video src={tile.url} muted playsInline preload="metadata" poster={poster} className="h-full w-full object-cover" />
                    <Film className="pd-thumb-play" aria-hidden="true" />
                  </span>
                ) : (
                  <img
                    src={productImageUrl(tile.url) ?? tile.url}
                    srcSet={productImageSrcSet(tile.url)}
                    sizes="96px"
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="pd-stage">
          <button
            type="button"
            className="pd-stage-btn"
            onClick={() => setZoom(true)}
            aria-label="Zoom image"
          >
            {current ? (
              current.kind === "video" ? (
                <video
                  key={current.url}
                  src={current.url}
                  poster={poster}
                  controls
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onClick={(e) => e.stopPropagation()}
                  className="pd-main-img"
                />
              ) : (
                <img
                  // The product stage is the LCP element on a product page, so its
                  // bytes are the ones that decide when the page LOOKS ready. The
                  // 800px derivative is what a 2x phone and a desktop stage both
                  // actually draw; the canonical object is only reached by a
                  // browser that cannot take the derivative at all.
                  src={productImageUrl(variantImage ?? current.url) ?? (variantImage ?? current.url)}
                  srcSet={productImageSrcSet(variantImage ?? current.url)}
                  sizes="(min-width: 1024px) 620px, 100vw"
                  fetchPriority="high"
                  decoding="async"
                  alt={product.name}
                  className="pd-main-img"
                />
              )
            ) : (
              <span className="flex h-full w-full items-center justify-center text-5xl">🐾</span>
            )}
          </button>
          {badge}
          <span className="pd-zoom-hint" aria-hidden="true">
            <ZoomIn className="h-3.5 w-3.5" /> {current?.kind === "video" ? "Playing video" : "Click to zoom"}
          </span>
        </div>
      </div>

      {zoom && current && (
        <div
          className="pd-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`${product.name} image viewer`}
          onClick={() => setZoom(false)}
        >
          <button
            ref={closeRef}
            type="button"
            className="pd-lightbox-close"
            onClick={() => setZoom(false)}
            aria-label="Close image viewer"
          >
            <X className="h-5 w-5" />
          </button>
          {tiles.length > 1 && (
            <button
              type="button"
              className="pd-lightbox-nav pd-lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                setActive((i) => (i - 1 + tiles.length) % tiles.length);
              }}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {current.kind === "video" ? (
            <video
              key={`lb-${current.url}`}
              src={current.url}
              poster={poster}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="pd-lightbox-img"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={current.url}
              alt={product.name}
              className="pd-lightbox-img"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {tiles.length > 1 && (
            <button
              type="button"
              className="pd-lightbox-nav pd-lightbox-next"
              onClick={(e) => {
                e.stopPropagation();
                setActive((i) => (i + 1) % tiles.length);
              }}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ── Features strip ────────────────────────────────────────────────────────────
const TRUST_ICONS = [Truck, ShieldCheck, RotateCcw, Package] as const;

/** The four promises a shopper wants answered before buying: when it ships, that
 *  paying is safe, that returning it is easy, and that it arrives packed well.
 *  Shipping and returns read the live settings, so this never drifts from the
 *  real policy.
 *
 *  Rendered as a FULL-WIDTH band (not confined to the product column) with the
 *  four items in a single horizontal row on desktop, which is what makes the
 *  page read as a complete storefront rather than a narrow column. */
export function ProductTrustStrip() {
  const s = useSite();
  const items = productTrustStrip(s);
  return (
    <div className="features-strip is-band">
      <div className="features-grid pp-wrap">
        {items.map((item, i) => {
          const Icon = TRUST_ICONS[i % TRUST_ICONS.length];
          return (
            <div key={item.key} className="feature-item">
              <span className="feature-ic">
                <Icon className="h-[22px] w-[22px]" />
              </span>
              <div>
                <div className="feature-title">{item.title}</div>
                <div className="feature-sub">{item.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ["Description", "Product Details", "Reviews", "Shipping & Returns"] as const;
export type TabName = (typeof TABS)[number];

/** The Product Details tab: the reference's spec table. SKU, category and stock
 *  are real row values; materials, dimensions, weight and care are the product's
 *  own stated attributes. An attribute we do not hold is simply left out, so the
 *  table is never padded with dashes or placeholders. */
function DetailsTab({
  product,
  specs,
  stock,
}: {
  product: StoreProduct;
  specs?: StoreProductSpecs;
  stock: number;
}) {
  const rows: { label: string; value: string }[] = [
    // No SKU row: the supplier's own SKU is an internal fulfilment reference,
    // never customer-facing. It is kept for the admin panel only.
    { label: "Category", value: product.category },
    { label: "Type", value: product.tags[0] ?? "" },
    { label: "Materials", value: specs?.materials ?? "" },
    { label: "Dimensions", value: specs?.dimensions ?? "" },
    { label: "Weight", value: specs?.weight ?? "" },
    { label: "Care", value: specs?.care ?? "" },
    { label: "Stock", value: stock > 0 ? `${stock} in stock` : "Sold out" },
  ].filter((r) => Boolean(r.value));

  return (
    <table className="spec-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Description, Product Details, Reviews and Shipping & Returns.
 *
 *  Two notes on content: the description is the product's own copy with its key
 *  features pulled from the product's real tags, and the shipping tab quotes the
 *  store's live rate, estimate and return window rather than a hard-coded
 *  promise. The Reviews tab is a slot - the caller passes the reviews block in,
 *  so the verified-buyer gate and the confident empty state live in one place. */
export function ProductTabs({
  product,
  reviewsSlot,
  tab,
  onTab,
  reviewCount = 0,
  stock = 0,
}: {
  product: StoreProduct;
  reviewsSlot: React.ReactNode;
  /** Controlled so the rest of the page can send the shopper straight to a tab
   *  - the "read the reviews" link under the price opens the Reviews tab rather
   *  than pointing at an anchor that may not be mounted. */
  tab: TabName;
  onTab: (t: TabName) => void;
  /** Real approved-review count, so the tab reads "Reviews (N)". */
  reviewCount?: number;
  /** Live stock for the selected variant, for the spec table. */
  stock?: number;
}) {
  const s = useSite();
  // The description is parsed into prose + key features, so a supplier string
  // that still carries `**Bold**: text` runs renders as a proper sales page
  // rather than a wall of asterisks. Features come from the copy first (they are
  // the real selling points), then any product tag not already covered.
  const copy = useMemo(() => parseProductCopy(product.description), [product.description]);
  const features = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of [...copy.features, ...product.tags.filter(Boolean)]) {
      const key = f.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(f);
      }
    }
    return out.slice(0, 8);
  }, [copy.features, product.tags]);
  /* The description promo is a brand block, not a product shot, so it uses its
     own editorial lifestyle image rather than the first gallery photo. Keeping
     it separate means the gallery's lead image stays a clean product cut-out.

     Keyed by SLUG, not hardcoded: with more than one product in the catalog a
     single fixed path would put the same photo on every product page. A product
     without its own editorial shot falls back to its own first gallery image, so
     the block is never empty and never shows another product's room. */
  // The editorial shot is one of the product's OWN real supplier images (a
  // different frame from the lead cut-out), so the block always shows this
  // product and never another product's room. A product without an entry falls
  // back to its own first gallery image below.
  const PROMO_IMAGES: Record<string, string> = {
    "intelligent-litter-box-automatic-self-cleaning-deodorant":
      "https://media.petparcel.store/products/c98c5612a81d2365c835.webp",
    "foldable-pet-tent-bed-with-cooling-mat":
      "https://media.petparcel.store/products/dcffa8fd748fc35286c3.webp",
    "pet-dog-carrier-bag-double-shoulder-travel-backpack":
      "https://media.petparcel.store/products/c3c8b9dd72cc0dccc63c.webp",
  };
  const promoImage = productImageUrl(PROMO_IMAGES[product.slug] ?? product.images[0] ?? null);

  const label = (t: TabName) => (t === "Reviews" ? `Reviews (${reviewCount})` : t);

  return (
    <div className="pd-tabs">
      <div className="tabs" role="tablist" aria-label="Product information">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`pd-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`pd-panel-${t}`}
            className={cn("tab-btn", tab === t && "active")}
            onClick={() => onTab(t)}
          >
            {label(t)}
          </button>
        ))}
      </div>

      <div
        className="tab-pane"
        role="tabpanel"
        id={`pd-panel-${tab}`}
        aria-labelledby={`pd-tab-${tab}`}
      >
        {tab === "Description" && (
          <div className="desc-grid">
            <div className="desc-text">
              {/* The copy is parsed into prose paragraphs and a key-feature
                  list, so a long description reads as a premium sales page
                  instead of one grey wall - and a supplier string that still
                  carries inline markdown is rendered properly, never verbatim. */}
              {copy.paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
              {features.length > 0 && (
                <>
                  <p className="pd-prose-title">Key features</p>
                  <ul className="pd-check-list">
                    {features.map((f) => (
                      <li key={f}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            {promoImage && (
              <aside className="desc-promo">
                <img
                  src={promoImage}
                  srcSet={productImageSrcSet(promoImage)}
                  sizes="(min-width: 1024px) 360px, 100vw"
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <div className="desc-promo-content">
                  <h3>Ready for every day</h3>
                  <p>Chosen for real homes, shipped fast and tracked.</p>
                </div>
              </aside>
            )}
          </div>
        )}

        {tab === "Product Details" && (
          <DetailsTab product={product} specs={product.specs} stock={stock} />
        )}

        {tab === "Reviews" && reviewsSlot}

        {tab === "Shipping & Returns" && (
          <div className="desc-text">
            <ul className="pd-check-list">
              <li>
                <Check className="h-4 w-4" aria-hidden="true" />
                {productShippingLine(s)}
              </li>
              <li>
                <Check className="h-4 w-4" aria-hidden="true" />
                {s.shipping_estimate}. Every parcel gets a tracking reference the moment it
                leaves us, and you can follow it any time from the{" "}
                <Link to="/track" className="pd-link">
                  tracking page
                </Link>
                .
              </li>
              <li>
                <Check className="h-4 w-4" aria-hidden="true" />
                Changed your mind? Send it back within {s.return_window_days} days for a full
                refund.
              </li>
              <li>
                <Check className="h-4 w-4" aria-hidden="true" />
                Returns are free: we provide a prepaid return label, so there's no return
                shipping cost to you. Anything that arrives damaged is on us - we replace it
                and cover the label.
              </li>
              <li>
                <Check className="h-4 w-4" aria-hidden="true" />
                Questions? Email{" "}
                <a className="pd-link" href={`mailto:${s.contact_email}`}>
                  {s.contact_email}
                </a>{" "}
                or call{" "}
                <a className="pd-link" href={`tel:${s.contact_phone.replace(/[^+\d]/g, "")}`}>
                  {s.contact_phone}
                </a>
                , {s.support_hours}.
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Social proof ──────────────────────────────────────────────────────────────
/** "Someone in a real city just bought this", read from the store's own settled
 *  orders.
 *
 *  This is the one block on the page that would be easiest to fake and is
 *  therefore the one that refuses to: if the product has no settled order inside
 *  the window, `recentPurchases` returns nothing and this component renders
 *  nothing at all - no invented name, no invented city, no invented time. Only a
 *  first name and the destination city are ever shown, which is the same
 *  information a shopper would see standing in a shop.
 *
 *  It also gives up: after a few appearances it hides for good for that visit, so
 *  it nudges rather than nags. Position is fixed, so it adds nothing to the
 *  page's flow or layout. */
export function RecentPurchaseToast({ product }: { product: StoreProduct }) {
  const q = trpc.reviews.recentPurchases.useQuery(
    { productId: product.id, limit: 3 },
    { retry: false, staleTime: 5 * 60_000 },
  );
  const rows = useMemo(() => q.data ?? [], [q.data]);
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);
  const shown = useRef(0);

  // Wait a beat before the first nudge so it does not compete with the page
  // painting, then rotate through the real purchases and retire after three.
  useEffect(() => {
    if (rows.length === 0) {
      setVisible(false);
      return;
    }
    const open = window.setTimeout(() => setVisible(true), 6000);
    const cycle = window.setInterval(() => {
      setI((n) => n + 1);
      shown.current += 1;
      setVisible(shown.current % 2 === 0);
      if (shown.current >= 6) window.clearInterval(cycle);
    }, 9000);
    return () => {
      window.clearTimeout(open);
      window.clearInterval(cycle);
    };
  }, [rows.length]);

  if (rows.length === 0 || !visible) return null;
  const purchase = rows[i % rows.length];

  return (
    <div className="pd-toast" role="status" aria-live="polite">
      <span className="pd-toast-ic">
        <Check className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="pd-toast-text">
        <b>
          {purchase.firstName} in {purchase.city}
        </b>{" "}
        bought {product.name} - {timeAgo(purchase.purchasedAt)}.
      </span>
      <button
        type="button"
        className="pd-toast-x"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Related ───────────────────────────────────────────────────────────────────
/** The three things a new owner buys alongside a self-cleaning box. Used ONLY
 *  when the catalogue has no related product row to show, so a one-product store
 *  still gets a useful, honest section here instead of a bare gap. Every card is
 *  a real need for THIS product, and every card links into the shop - never to a
 *  category that would render an empty grid.
 *
 *  Keyed by CATEGORY, because the extras an owner needs differ per product: an
 *  automatic litter box wants liners and odour filters, a tent bed wants a spare
 *  cushion and a travel bag. A single fixed list put the litter-box cards on the
 *  tent-bed page - a real content error once a second product existed. An
 *  unrecognised category falls through to honest, product-neutral care cards
 *  rather than borrowing another product's supplies. */
const SETUP_CARDS: Record<string, { icon: typeof Package; title: string; body: string }[]> = {
  "Pet Furniture Tools": [
    {
      icon: Package,
      title: "Litter & liners",
      body: "Clumping litter and drawer liners sized for the box's waste drawer.",
    },
    {
      icon: Sparkles,
      title: "Odour control",
      body: "A litter-box deodoriser to keep the room fresh between drawer empties.",
    },
    {
      icon: ShieldCheck,
      title: "Care & cleaning",
      body: "Pet-safe wipes and an enzymatic spray for the regular wipe-down.",
    },
  ],
  "Pet Tents": [
    {
      icon: Sparkles,
      title: "Spare cushion covers",
      body: "Keep a second cover on hand, so a wash day never leaves the bed out of action.",
    },
    {
      icon: Package,
      title: "Cosy blankets",
      body: "A soft layer inside the tent, for pets who like to burrow before they settle.",
    },
    {
      icon: ShieldCheck,
      title: "Care & cleaning",
      body: "Gentle fabric wash and a lint brush to keep the cushion fresh between washes.",
    },
  ],
  "Pet Bags": [
    {
      icon: ShieldCheck,
      title: "Spare base pad",
      body: "A second soft base for the carrier, so one can be in the wash while the other is out on a walk.",
    },
    {
      icon: Package,
      title: "Waste bag holder",
      body: "A clip-on pouch that keeps bags and a few treats to hand without a second bag to carry.",
    },
    {
      icon: Sparkles,
      title: "Care & cleaning",
      body: "A gentle pet-safe spray and a soft brush to keep the mesh and straps fresh.",
    },
  ],
};

/** The neutral set for a category that has no tailored list yet - true of any
 *  pet, and never a specific product's supplies. */
const GENERAL_SETUP_CARDS = [
  {
    icon: ShieldCheck,
    title: "Care & cleaning",
    body: "Gentle, pet-safe cleaners and brushes to keep everyday essentials fresh.",
  },
  {
    icon: Package,
    title: "Everyday extras",
    body: "The small, useful things owners reach for again and again.",
  },
  {
    icon: Sparkles,
    title: "Comfort & bedding",
    body: "Soft layers and cosy spots your pet will actually choose to settle in.",
  },
];

/** The setup cards for a product, chosen by its category and falling back to the
 *  neutral set. Exported so the choice is testable without a browser. */
export function setupCardsFor(category: string | null | undefined) {
  return SETUP_CARDS[category ?? ""] ?? GENERAL_SETUP_CARDS;
}

/** The product page's cross-sell and close - the LAST, strongest block on the
 *  page, and what now fills the space the FAQ accordion used to occupy.
 *
 *  TWO SHAPES, one design. When the catalogue carries related products this is a
 *  full cross-sell: a heading tied to the product's own aisle with a live count,
 *  and the site's premium card grid (image, stars, price, quick add). That is the
 *  shape it grows into the moment a second product is added, and nothing here
 *  has to change for it to happen.
 *
 *  When there are NO related rows - the state of a one-product store - the
 *  section does not render empty. It becomes "Complete the setup": the three
 *  extras a new owner actually needs alongside the box, each a real need for
 *  this product, plus one clear way into the shop.
 *
 *  A benefit rail runs under both shapes, restating the page's four promises at
 *  the point the shopper is deciding on the extras. Shipping and returns quote
 *  the LIVE store settings, so the rail can never drift from real policy. */
export function RelatedProducts({
  product,
  related,
}: {
  product: StoreProduct;
  related: StoreProduct[];
}) {
  const s = useSite();
  const hasRelated = related.length > 0;
  const shippingPerk =
    s.free_shipping_threshold_cents > 0
      ? `Free tracked US shipping over ${formatMoney(s.free_shipping_threshold_cents)}`
      : `Flat ${formatMoney(s.shipping_flat_cents)} tracked US shipping`;

  const perks = [
    { icon: Truck, text: shippingPerk },
    { icon: RotateCcw, text: `${s.return_window_days}-day free returns` },
    { icon: ShieldCheck, text: "Secure checkout" },
    { icon: Package, text: "Packed with care" },
  ];

  return (
    <section className="pp-related" aria-labelledby="pd-related-title">
      <div className="pp-wrap">
        <div className="section-head pp-related-head">
          <div>
            <div className="eyebrow">{hasRelated ? "You may also like" : "Complete the setup"}</div>
            <h2 id="pd-related-title" className="section-title">
              {hasRelated ? `More from ${product.category}` : "Everything that goes with it"}
            </h2>
            <p className="pp-related-sub">
              {hasRelated
                ? `${related.length} more ${related.length === 1 ? "pick" : "picks"} to go with this one.`
                : `The extras that go with ${product.name.toLowerCase()}, shipped fast and tracked across the USA.`}
            </p>
          </div>
          <Link to="/shop" className="view-all">
            Shop all <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {hasRelated ? (
          <ProductGrid products={related} />
        ) : (
          <div className="pp-setup-grid">
            {setupCardsFor(product.category).map(({ icon: Icon, title, body }) => (
              <Link key={title} to="/shop" className="pp-setup-card">
                <span className="pp-setup-ic">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="pp-setup-title">{title}</h3>
                <p className="pp-setup-body">{body}</p>
                <span className="pp-setup-more">
                  Browse <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        )}

        <ul className="pp-related-perks">
          {perks.map(({ icon: Icon, text }) => (
            <li key={text}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The rating line under the product title, with the page's own empty state so a
 *  product with no approved reviews never shows a fake score. */
export function RatingLine({ rating, count }: { rating: number; count: number }) {
  if (count === 0) return null;
  return (
    <span className="pd-rating">
      <Stars rating={rating} size={16} showValue count={count} />
      <button
        type="button"
        className="pd-rating-link"
        onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}
      >
        Read {count} verified review{count === 1 ? "" : "s"}
      </button>
    </span>
  );
}

// ── Sticky add-to-cart bar ──────────────────────────────────────────────────
/** The buy box pinned to the bottom of the viewport once the shopper has
 *  scrolled past the real one.
 *
 *  It reads the SAME selected variant the buy box does, so the two can never
 *  disagree about size, colour, price or stock, and it stays entirely out of the
 *  page flow (position: fixed) so it adds no layout shift. It only appears after
 *  the buy box has left the top of the screen - before then the shopper can
 *  already see the real buttons, and a bar covering them would be noise. */
export function StickyAddBar({
  product,
  variant,
}: {
  product: StoreProduct;
  variant: StoreProduct["variants"][number] | null;
}) {
  const [show, setShow] = useState(false);
  const { addToCart, justAdded } = useAddToCart();
  const stock = variant ? variant.inventoryQty : totalStock(product);
  const soldOut = stock <= 0;
  const price = variant?.priceCents ?? product.priceCents;
  const thumb = product.images[0];
  // A tight, unclipped label for the bar. The option halves are read by their
  // MEANING, not their position, so the supplier's colour-first label
  // "BLUE-M . 100x50cm" reads as "Blue M . 100x50cm" rather than being printed
  // backwards as "100x50cm . BLUE-M".
  const variantLabel = variant ? compactVariantLabel(variant.name) : "Standard";

  useEffect(() => {
    const el = document.getElementById("pd-buybox");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [product.id]);

  if (!show) return null;

  return (
    <div className="sticky-addbar" role="region" aria-label="Add to cart">
      <div className="sticky-addbar-inner pp-wrap">
        {thumb && <img className="sticky-addbar-thumb" src={thumb} alt="" loading="lazy" />}
        <div className="sticky-addbar-text">
          <span className="sticky-addbar-name">{product.name}</span>
          <span className="sticky-addbar-sub">
            {variantLabel} · <b>{formatMoney(price)}</b>
          </span>
        </div>
        <button
          type="button"
          disabled={soldOut}
          onClick={() => addToCart({ product, variant })}
          className={cn(
            "btn sticky-addbar-btn",
            justAdded ? "btn-accent" : "btn-primary",
            "btn-md",
          )}
          aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          {soldOut ? "Sold out" : justAdded ? "Added" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}

export { totalStock };
