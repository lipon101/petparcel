// Product card + the reusable "add to cart" behavior shared by the grid and the
// product detail page.
import { useState } from "react";
import { Link } from "wouter";
import { Check, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/petparcel";
import { Chip, PriceTag, Stars } from "./Bits";
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
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:pointer-events-none disabled:opacity-55",
        justAdded ? "bg-emerald-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90",
        size === "sm" ? "h-9 px-3.5 text-sm" : size === "lg" ? "h-12 px-7 text-base" : "h-11 px-5 text-sm",
        className,
      )}
      aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to cart`}
    >
      {justAdded ? <Check className="h-4 w-4" /> : withIcon ? <ShoppingBag className="h-4 w-4" /> : null}
      {soldOut ? "Sold out" : justAdded ? "Added" : "Add to cart"}
    </button>
  );
}

export function ProductCard({ product }: { product: StoreProduct }) {
  const stock = totalStock(product);
  const onSale =
    typeof product.compareAtCents === "number" && product.compareAtCents > product.priceCents;
  const discountPct = onSale
    ? Math.round((1 - product.priceCents / (product.compareAtCents as number)) * 100)
    : 0;

  return (
    <article className="group card-soft flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/product/${product.slug}`} className="relative block overflow-hidden bg-muted">
        <div className="aspect-square w-full">
          {product.images[0] ? (
            <img
              src={product.images[0]}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl">🐾</div>
          )}
        </div>
        <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {onSale && <Chip tone="coral">Save {discountPct}%</Chip>}
          {product.featured && !onSale && <Chip tone="teal">Best seller</Chip>}
          {stock > 0 && stock <= 5 && <Chip tone="amber">Only {stock} left</Chip>}
          {stock <= 0 && <Chip tone="slate">Sold out</Chip>}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {product.category}
        </p>
        <h3 className="mt-1 text-sm font-bold leading-snug">
          <Link to={`/product/${product.slug}`} className="hover:text-primary hover:underline">
            {product.name}
          </Link>
        </h3>

        <div className="mt-2">
          <Stars rating={product.featured ? 4.8 : 4.6} />
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <PriceTag priceCents={product.priceCents} compareAtCents={product.compareAtCents} />
        </div>

        <div className="mt-4 flex-1" />
        <AddToCartButton product={product} variant={null} size="sm" className="w-full" />
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: StoreProduct[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
