// Product card + the reusable "add to cart" behavior shared by the grid and the
// product detail page.
//
// The card mirrors the reference storefront exactly: a square image well that
// zooms on hover, a corner badge, a wishlist heart, then the body — a small
// gold tracked category label, the product name, a star rating, the price line
// (coral now-price over a struck-through was-price) and a round coral
// add-to-cart button pinned bottom-right.
import { useState } from "react";
import { Link } from "wouter";
import { Check, Heart, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/petparcel";
import { Badge, Stars } from "./Bits";
import { formatMoney } from "@shared/store";
import type { StoreProduct } from "@/lib/types";

export type { StoreProduct } from "@/lib/types";

export function totalStock(product: StoreProduct): number {
  return product.variants.reduce((sum, v) => sum + (v.active ? v.inventoryQty : 0), 0);
}

interface AddToCartArgs {
  product: StoreProduct;
  variant: StoreProduct["variants"][number] | null;
  qty?: number;
}

/** Adds a product (optionally a specific variant) to the local cart. Returns the
 *  handler plus a short-lived "added" flag for the button's success state. */
export function useAddToCart() {
  const { add } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const addToCart = ({ product, variant, qty = 1 }: AddToCartArgs) => {
    add(
      {
        slug: product.slug,
        variantId: variant?.id ?? null,
        name: product.name,
        variantName: variant?.name ?? null,
        priceCents: variant?.priceCents ?? product.priceCents,
        image: product.images[0] ?? null,
        maxQty: variant ? variant.inventoryQty : totalStock(product),
      },
      qty,
    );
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  };

  return { addToCart, justAdded };
}

export function AddToCartButton({
  product,
  variant,
  size = "md",
  className,
  withIcon = true,
}: AddToCartArgs & { size?: "sm" | "md" | "lg"; className?: string; withIcon?: boolean }) {
  const { addToCart, justAdded } = useAddToCart();
  const stock = variant ? variant.inventoryQty : totalStock(product);
  const soldOut = stock <= 0;

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart({ product, variant });
      }}
      className={cn(
        "btn",
        justAdded ? "btn-accent" : "btn-primary",
        size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "btn-md",
        className,
      )}
      aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
    >
      {justAdded ? <Check className="h-4 w-4" /> : withIcon ? <ShoppingCart className="h-4 w-4" /> : null}
      {soldOut ? "Sold out" : justAdded ? "Added to cart" : "Add to cart"}
    </button>
  );
}

/** The round quick-add button that sits in the corner of a grid card. Always
 *  rendered (never hover-gated) so touch and keyboard users can reach it. */
function QuickAdd({ product }: { product: StoreProduct }) {
  const { addToCart, justAdded } = useAddToCart();
  const soldOut = totalStock(product) <= 0;

  return (
    <button
      type="button"
      disabled={soldOut}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart({ product, variant: null });
      }}
      className={cn("p-cartbtn", soldOut && "cursor-not-allowed opacity-45")}
      aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
      title={soldOut ? "Sold out" : "Add to cart"}
    >
      {justAdded ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
    </button>
  );
}

export function ProductCard({ product, index = 0 }: { product: StoreProduct; index?: number }) {
  const stock = totalStock(product);
  const onSale =
    typeof product.compareAtCents === "number" && product.compareAtCents > product.priceCents;
  const [wished, setWished] = useState(false);

  return (
    <article className="p-card animate-in-up" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
      <div className="p-media">
        <Link to={`/product/${product.slug}`} aria-label={product.name}>
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} loading="lazy" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-4xl">🐾</span>
          )}
        </Link>

        {onSale ? (
          <Badge variant="sale">
            −{Math.round((1 - product.priceCents / (product.compareAtCents as number)) * 100)}%
          </Badge>
        ) : product.featured ? (
          <Badge variant="best">Best seller</Badge>
        ) : stock <= 0 ? (
          <Badge variant="out">Sold out</Badge>
        ) : null}

        <button
          type="button"
          className="heart-btn"
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={wished}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setWished((v) => !v);
          }}
        >
          <Heart className={cn("h-4 w-4", wished && "fill-coral text-coral")} />
        </button>
      </div>

      <div className="p-body">
        <Link to={`/shop?category=${encodeURIComponent(product.category)}`} className="p-cat">
          {product.category}
        </Link>
        <h3 className="p-name">
          <Link to={`/product/${product.slug}`}>{product.name}</Link>
        </h3>

        {(product.reviewCount ?? 0) > 0 && (
          <div className="pb-1">
            <Stars rating={product.rating ?? 0} count={product.reviewCount} />
          </div>
        )}

        <div className="p-bottom">
          <div className="p-price">
            <span className="price-now">{formatMoney(product.priceCents)}</span>
            {onSale && <span className="price-was">{formatMoney(product.compareAtCents)}</span>}
          </div>
          <QuickAdd product={product} />
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: StoreProduct[] }) {
  return (
    <div className="grid-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} />
      ))}
    </div>
  );
}
