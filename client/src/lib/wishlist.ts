// Wishlist state, tied to the signed-in ACCOUNT and persisted in the database
// (the `wishlist_items` table, one row per user+product). It used to live in
// localStorage, which meant a saved item vanished on another device and an
// anonymous visitor could "save" things that were never really theirs. Now the
// server is the source of truth: `wishlist.list` returns the account's saved
// products and `wishlist.toggle` adds/removes one, both behind a session.
//
// One provider means the product page's heart, the grid card's heart and the
// /wishlist page can never disagree about what is saved. A signed-out shopper
// gets `toggle` returning null, which the caller turns into a sign-in prompt.
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import type { StoreProduct } from "@/lib/types";

interface WishlistContextValue {
  /** The signed-in account's saved products (full rows, from the catalog read). */
  products: StoreProduct[];
  /** Just the ids, for a cheap `isWished` check on every card. */
  ids: string[];
  isLoading: boolean;
  isSignedIn: boolean;
  isWished: (productId: string) => boolean;
  /** Toggle a product for the signed-in account. Returns the NEW saved state, or
   *  null when signed out - the caller should then prompt sign-in. */
  toggle: (productId: string) => Promise<boolean | null>;
  /** Send a signed-out shopper to sign in, returning them to where they were. */
  promptSignIn: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Only fetch when there is a session; a signed-out visitor has no wishlist.
  const listQ = trpc.wishlist.list.useQuery(undefined, { enabled: Boolean(user) });
  const toggleM = trpc.wishlist.toggle.useMutation({
    onSuccess: () => utils.wishlist.list.invalidate(),
  });

  const products = (listQ.data ?? []) as StoreProduct[];
  const ids = useMemo(() => products.map((p) => p.id), [products]);

  const isWished = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback(
    async (productId: string): Promise<boolean | null> => {
      if (!user) return null;
      const res = await toggleM.mutateAsync({ productId });
      return res.saved;
    },
    [user, toggleM],
  );

  const promptSignIn = useCallback(() => {
    navigate(`/login?next=${encodeURIComponent(location)}`);
  }, [navigate, location]);

  const value = useMemo<WishlistContextValue>(
    () => ({
      products,
      ids,
      isLoading: Boolean(user) && listQ.isLoading,
      isSignedIn: Boolean(user),
      isWished,
      toggle,
      promptSignIn,
    }),
    [products, ids, user, listQ.isLoading, isWished, toggle, promptSignIn],
  );

  return createElement(WishlistContext.Provider, { value }, children);
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within <WishlistProvider>");
  return ctx;
}
