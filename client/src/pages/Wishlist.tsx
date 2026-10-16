// The saved-items page behind the header's "Wishlist" button. The wishlist is
// tied to the signed-in account and persisted in the database, so this page
// reads the SAME per-account store the product page and the grid hearts write
// to. A signed-out visitor is asked to sign in rather than shown an empty list.
import { Heart, LogIn, ShoppingBag } from "lucide-react";
import { useSeo } from "@/lib/petparcel";
import { useAuth } from "@/_core/useAuth";
import { useWishlist } from "@/lib/wishlist";
import { ProductGrid } from "@/components/site/ProductCard";
import {
  Breadcrumbs,
  CtaLink,
  EmptyState,
  LoadingState,
  Section,
  SectionHeading,
} from "@/components/site/Bits";

export default function Wishlist() {
  useSeo({
    title: "My Wishlist",
    description: "The PetParcel products you've saved for later.",
    path: "/wishlist",
    noindex: true,
  });

  const { user, isLoading: authLoading } = useAuth();
  const { products, isLoading } = useWishlist();

  return (
    <Section className="!pt-10">
      <Breadcrumbs trail={[{ label: "Home", to: "/" }, { label: "My Wishlist" }]} />
      <SectionHeading
        eyebrow="Saved for later"
        title="My Wishlist"
        subtitle={
          user && products.length > 0
            ? `${products.length} item${products.length === 1 ? "" : "s"} saved. Add them to your cart whenever you're ready.`
            : undefined
        }
      />

      <div className="mt-8">
        {authLoading ? (
          <LoadingState rows={3} />
        ) : !user ? (
          // Signed out: the wishlist is per account, so there is nothing to show
          // until the shopper signs in. Send them to sign in and back here.
          <EmptyState
            icon={<LogIn className="h-6 w-6" />}
            title="Sign in to see your wishlist"
            body="Your wishlist is saved to your account, so it follows you across devices. Sign in to view and manage the items you've saved."
            action={
              <CtaLink to="/login?next=%2Fwishlist" variant="primary">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Sign in
              </CtaLink>
            }
          />
        ) : isLoading ? (
          <LoadingState rows={3} />
        ) : products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Your wishlist is empty"
            body="Tap the heart on any product to save it here, then come back when you're ready to buy."
            action={
              <CtaLink to="/shop" variant="primary">
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Browse products
              </CtaLink>
            }
          />
        )}
      </div>
    </Section>
  );
}
