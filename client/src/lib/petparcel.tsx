// Client-side storefront plumbing: cart state, SEO head management, and small
// formatting helpers. Everything the pages need that isn't a component.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { STORE_URL } from "@shared/store";
import { isProductionHost } from "@shared/production-host";
import { trpc } from "@/_core/trpc";
import { safeErrorMessage } from "./errors";
import { MAX_ORDER_QTY, MIN_ORDER_QTY, clampQuantity } from "./quantity";

// ─────────────────────────────────────────────────────────────────────────────
// Cart - persisted in localStorage so a refresh (or a return from the payment
// gateway) never loses the basket. Prices are only a DISPLAY copy; the server
// re-resolves every price from the catalog at checkout.
// ─────────────────────────────────────────────────────────────────────────────
export interface CartLine {
  slug: string;
  variantId: string | null;
  /** The catalog product's row id, as the server sends it. Kept so analytics can
   *  report the SAME `item_id` for a product at every funnel step - the slug is
   *  the cart's own key and would split a product's GA4 report in two. Optional
   *  because a basket cached by an older build predates the field. */
  productId?: string | null;
  name: string;
  variantName: string | null;
  priceCents: number;
  image: string | null;
  qty: number;
  maxQty: number;
}

/** Identity of a line, for the server cart API. The server resolves names and
 *  prices itself from the catalog, so it only ever needs to be told WHICH line
 *  and how many - never a price. */
export interface CartLineRef {
  slug: string;
  variantId: string | null;
}

// The basket used to be a localStorage-only array of display lines. It is now a
// SERVER-OWNED resource, and this provider is the seam that makes that
// invisible to every page that reads it.
//
// WHAT CHANGED AND WHY. Because the basket lived in the browser, the server had
// nothing to authorise and the UI had nothing to scope it to. The concrete
// leak: after signing out, the previous account's items were still in
// localStorage and kept rendering in the cart panel, and no mutation could be
// refused for want of a session.
//
// The rules now:
//   * SIGNED IN - `lines` is the server cart (`cart.get`). Every mutation is a
//     tRPC call; the server resolves names, prices and stock ceilings. The
//     browser only ever says WHICH line and how many.
//   * SIGNED OUT - the basket is EMPTY, by construction. The guest store is
//     wiped on sign-out, so nothing from the previous account can render.
//   * A guest cannot add or modify: the mutation opens the sign-in prompt
//     instead of quietly writing to a local array. The server refuses the call
//     regardless, so this is convenience, not the control.
//   * SIGNING IN MERGES a guest basket into the saved cart (additive only),
//     so a basket built before signing in is not lost - and the saved cart is
//     restored for free, straight from the database.
const CART_KEY = "petparcel_cart_v1";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (slug: string, variantId: string | null, qty: number) => void;
  remove: (slug: string, variantId: string | null) => void;
  clear: () => void;
  /** Whether the slide-in cart panel is showing. It lives here, beside the basket
   *  it mirrors, so "open on add" and "hide when empty" are one piece of state
   *  rather than two components trying to stay in step with each other. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** True while the basket is loading, or while the session is still resolving.
   *  The drawer shows a placeholder rather than an empty state, so a signed-in
   *  shopper never sees "your cart is empty" flash before their items arrive. */
  cartLoading: boolean;
  /** Set when a signed-out visitor tried to change the basket. The drawer reads
   *  this and offers a sign-in link instead of pretending the action worked. */
  signInRequired: boolean;
  /** True when there is at least one signed-in account to restore. */
  signedIn: boolean;
  /** The last cart failure, as a short shopper-written sentence, or null. Cart
   *  mutations are react-query calls whose errors are otherwise NEVER rendered,
   *  so a rejected add or quantity change used to look like nothing happened.
   *  Every message here has already been through `safeErrorMessage`, so it
   *  carries no raw error text and no internal detail. */
  cartError: string | null;
  /** Clear `cartError` once the shopper has seen it. */
  dismissCartError: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** The guest basket - the only thing left in localStorage, and only ever read
 *  to be MERGED into a signed-in cart. It is wiped on sign-in and on sign-out. */
function readStoredCart(): Array<CartLineRef & { qty: number }> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLineRef =>
          Boolean(l) && typeof l === "object" && typeof (l as CartLineRef).slug === "string",
      )
      .map((l) => ({
        slug: l.slug,
        variantId: l.variantId ?? null,
        qty: clampQuantity((l as unknown as CartLine).qty ?? 1),
      }));
  } catch {
    return [];
  }
}

function clearStoredCart() {
  try {
    window.localStorage.removeItem(CART_KEY);
  } catch {
    /* nothing to clear */
  }
}

// ── One-time cleanup of the PRE-SERVER-OWNED basket ──────────────────────────
// The basket is server-owned now, but a browser that visited the store before
// that change still holds a `petparcel_cart_v1` value written by the OLD code.
// That value is a full array of DISPLAY lines (each with name, priceCents and
// image) rather than the `{ slug, variantId, qty }` references the guest basket
// uses today, so it is stale data nothing should ever read again.
//
// It is dropped once, on the first load after this shipped. A sentinel key
// makes it a genuine one-shot: the sweep cannot run again, so it can never race
// the guest-basket merge or wipe a basket a shopper builds afterwards.
//
// ONLY the cart key is touched. The auth/session, wishlist, last-order and every
// other key are left exactly as they are.
const LS_CLEANUP_KEY = "petparcel_ls_cleanup_v1";

/** True when a stored cart value was written by the pre-server-owned code.
 *  Those lines carry display fields (`name`/`priceCents`/`image`) that today's
 *  guest basket never stores, which is what makes them safely identifiable. A
 *  value already in the new shape is left alone, so this never discards a basket
 *  the shopper built with the current code. */
function isLegacyStoredCart(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    return parsed.some(
      (l) =>
        Boolean(l) &&
        typeof l === "object" &&
        (typeof (l as Record<string, unknown>).name === "string" ||
          "priceCents" in (l as Record<string, unknown>) ||
          "image" in (l as Record<string, unknown>)),
    );
  } catch {
    // Unparseable is not usable either, but it is also not provably legacy -
    // leave it for `readStoredCart` to ignore.
    return false;
  }
}

/** Remove the leftover pre-server-owned basket from an existing visitor's
 *  browser. Idempotent by construction (sentinel-guarded), so it is safe to
 *  call at app start on every load. */
export function purgeLegacyCartStorage(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(LS_CLEANUP_KEY) === "1") return;
    if (isLegacyStoredCart(window.localStorage.getItem(CART_KEY))) clearStoredCart();
    window.localStorage.setItem(LS_CLEANUP_KEY, "1");
  } catch {
    /* private mode / storage disabled - nothing to sweep */
  }
}

const sameLine = (l: CartLine, slug: string, variantId: string | null) =>
  l.slug === slug && (l.variantId ?? null) === (variantId ?? null);

/**
 * Add a line, clamped to what the line's own ceiling allows.
 *
 * Retained as a pure helper because the arithmetic is unit-tested without a
 * DOM, and the guest basket uses the same rules the server applies.
 */
export function addCartLine(
  prev: CartLine[],
  line: Omit<CartLine, "qty">,
  qty: number = 1,
): CartLine[] {
  const ceiling = line.maxQty ?? MAX_ORDER_QTY;
  const wanted = qty > 0 ? qty : MIN_ORDER_QTY;
  const idx = prev.findIndex((l) => sameLine(l, line.slug, line.variantId));
  if (idx === -1) {
    return [...prev, { ...line, qty: clampQuantity(wanted, ceiling) }];
  }
  const next = [...prev];
  next[idx] = { ...next[idx], ...line, qty: clampQuantity(next[idx].qty + wanted, ceiling) };
  return next;
}

/**
 * Set one line's quantity. Zero (or below) REMOVES the line rather than leaving
 * an empty row behind.
 */
export function setCartLineQty(
  prev: CartLine[],
  slug: string,
  variantId: string | null,
  qty: number,
): CartLine[] {
  if (!(qty > 0)) {
    return prev.filter((l) => !sameLine(l, slug, variantId));
  }
  return prev.map((l) =>
    sameLine(l, slug, variantId) ? { ...l, qty: clampQuantity(qty, l.maxQty ?? MAX_ORDER_QTY) } : l,
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  // The session comes straight from the auth query rather than from `useAuth`:
  // `useAuth` imports this module for `currentOrigin`, so depending on it here
  // would create an import cycle. `auth.me` is the same source `useAuth` reads.
  const me = trpc.auth.me.useQuery();
  const signedIn = Boolean(me.data);
  const utils = trpc.useUtils();

  // The server cart. `enabled` is what keeps this from firing for a guest, so
  // an anonymous browser never even asks the server for a basket.
  const serverCart = trpc.cart.get.useQuery(undefined, { enabled: signedIn });

  const addM = trpc.cart.add.useMutation();
  const setQtyM = trpc.cart.setQty.useMutation();
  const removeM = trpc.cart.remove.useMutation();
  const clearM = trpc.cart.clear.useMutation();
  const mergeM = trpc.cart.merge.useMutation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signInRequired, setSignInRequired] = useState(false);

  // The last cart failure, already reduced to a short shopper-written sentence.
  // Cart mutations go through react-query, whose error is NOT rendered by
  // default - so a rejected add/setQty/remove used to look like the button simply
  // did nothing. This carries it to the panel instead, and `safeErrorMessage`
  // guarantees no raw error text or internal detail can appear.
  const [cartError, setCartError] = useState<string | null>(null);

  const dismissCartError = useCallback(() => setCartError(null), []);

  // Sign-OUT must leave nothing of the previous account behind. The guest store
  // is wiped the moment the session disappears, the sign-in prompt is cleared
  // with it, and - critically - the CACHED basket is dropped. Without that last
  // step the react-query cache still held the previous account's lines, so a
  // second shopper signing in on the same browser could be shown them. The saved
  // cart itself stays in the database, attached to the account, so signing back
  // in restores it.
  const prevSignedIn = useRef(signedIn);
  useEffect(() => {
    if (prevSignedIn.current && !signedIn) {
      clearStoredCart();
      setSignInRequired(false);
      setDrawerOpen(false);
      mergedFor.current = null;
      utils.cart.get.reset();
      utils.auth.me.reset();
    }
    prevSignedIn.current = signedIn;
    // `utils` is stable per provider instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  // Sign-IN restore: anything the shopper put in the basket while signed out is
  // merged into their saved cart, then the guest copy is dropped so it cannot be
  // merged twice. Additive on the server, so this can never empty a saved cart.
  const mergedFor = useRef<string | null>(null);
  const userId = me.data?.id ?? null;
  useEffect(() => {
    if (!userId || mergedFor.current === userId) return;
    mergedFor.current = userId;
    const guest = readStoredCart();
    if (guest.length === 0) return;
    mergeM.mutateAsync({ lines: guest }).then(
      (cart) => {
        clearStoredCart();
        utils.cart.get.setData(undefined, cart);
      },
      () => {
        /* the saved cart still loads; the guest lines were a bonus */
      },
    );
    // `mergeM`/`utils` are stable per provider instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const prevCount = useRef(0);

  // The lines the UI renders. For a guest this is ALWAYS empty: there is no
  // basket to show until there is an account to own it.
  const lines: CartLine[] = signedIn ? (serverCart.data?.lines ?? []) : [];
  const count = signedIn ? (serverCart.data?.count ?? 0) : 0;
  const subtotalCents = signedIn ? (serverCart.data?.subtotalCents ?? 0) : 0;
  const cartLoading = me.isLoading || (signedIn && serverCart.isLoading);

  // An emptied basket must never leave the panel hanging open.
  useEffect(() => {
    if (count === 0 && prevCount.current > 0) setDrawerOpen(false);
    prevCount.current = count;
  }, [count]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  /** A mutation from a signed-out visitor: never silently succeed - surface the
   *  sign-in prompt instead. The server would refuse the call anyway. */
  const requireSignIn = useCallback(() => {
    setSignInRequired(true);
    setDrawerOpen(true);
  }, []);

  const add = useCallback(
    (line: Omit<CartLine, "qty">, qty = 1) => {
      if (!signedIn) {
        requireSignIn();
        return;
      }
      setSignInRequired(false);
      const wanted = Math.max(MIN_ORDER_QTY, clampQuantity(qty));
      addM.mutate(
        { slug: line.slug, variantId: line.variantId, qty: wanted },
        {
          onSuccess: (cart) => utils.cart.get.setData(undefined, cart),
          onError: (err) =>
            setCartError(safeErrorMessage(err, "We couldn't add that to your cart. Please try again.")),
        },
      );
    },
    // The line's own name/price/image are ignored on purpose: the server owns
    // them, and `maxQty` is re-derived there from live stock.
    [signedIn, requireSignIn, addM, utils],
  );

  const setQty = useCallback(
    (slug: string, variantId: string | null, qty: number) => {
      if (!signedIn) {
        requireSignIn();
        return;
      }
      setQtyM.mutate(
        { slug, variantId, qty: Math.max(0, qty) },
        {
          onSuccess: (cart) => utils.cart.get.setData(undefined, cart),
          onError: (err) =>
            setCartError(safeErrorMessage(err, "We couldn't update that quantity. Please try again.")),
        },
      );
    },
    [signedIn, requireSignIn, setQtyM, utils],
  );

  const remove = useCallback(
    (slug: string, variantId: string | null) => {
      if (!signedIn) {
        requireSignIn();
        return;
      }
      removeM.mutate(
        { slug, variantId },
        {
          onSuccess: (cart) => utils.cart.get.setData(undefined, cart),
          onError: (err) =>
            setCartError(safeErrorMessage(err, "We couldn't remove that item. Please try again.")),
        },
      );
    },
    [signedIn, requireSignIn, removeM, utils],
  );

  const clear = useCallback(() => {
    if (!signedIn) {
      clearStoredCart();
      return;
    }
    clearM.mutate(undefined, {
      onSuccess: (cart) => utils.cart.get.setData(undefined, cart),
      onError: (err) =>
        setCartError(safeErrorMessage(err, "We couldn't empty your cart. Please try again.")),
    });
  }, [signedIn, clearM, utils]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      count,
      subtotalCents,
      add,
      setQty,
      remove,
      clear,
      drawerOpen,
      openDrawer,
      closeDrawer,
      cartLoading,
      signInRequired,
      signedIn,
      cartError,
      dismissCartError,
    }),
    [
      lines,
      count,
      subtotalCents,
      add,
      setQty,
      remove,
      clear,
      drawerOpen,
      openDrawer,
      closeDrawer,
      cartLoading,
      signInRequired,
      signedIn,
      cartError,
      dismissCartError,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEO - sets the document title, meta description, canonical, Open Graph and
// Twitter tags, plus an optional schema.org JSON-LD block. Restores the
// previous tags on unmount so a client-side route change never leaves two
// conflicting canonical URLs behind.
// ─────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// Reflected-input safety
//
// Two helpers guard the only places user input reaches a NON-React context:
//
//  * `serializeJsonLd` writes JSON-LD into a <script> element. Assigning `.textContent`
//    is inert at runtime, but the HTML spec ends a script element at the first
//    `</script>` in its TEXT, so a query of `</script><script>…` survives today
//    only by luck of the setter and would break out the moment the page is
//    serialized (SSR, prerender, a view-source read, an innerHTML clone). The
//    standard hardening is to escape every `<` to `\u003c`, which keeps the JSON
//    byte-identical when parsed and makes an early close impossible.
//
//  * `sanitizeSearchTerm` normalises a URL query before it is echoed (heading,
//    JSON-LD name, empty state, chip) or sent to the API: control characters and
//    the two markup delimiters a search box can never legitimately need are
//    dropped, whitespace is collapsed, and the whole thing is length-capped.
// ────────────────────────────────────────────────────────────────────────────

/** JSON for a `<script type="application/ld+json">` body: the value still
 *  round-trips through JSON.parse, while every `<` is escaped so the script
 *  element can never be terminated early by reflected content. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value ?? null)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** A URL-supplied search query, made safe to echo and to filter on. */
// Search-term normalisation now lives in ONE place, shared with the server
// (`shared/search-term.ts`), and is re-exported here so every existing import
// keeps working.
//
// WHY IT MOVED. The shop page ECHOES the term it searched for and the server
// FILTERS on it. These used to be two independent implementations with the same
// intent - two places to drift, and the drift is invisible until a term is
// reflected where the other side would have cleaned it. A single definition
// means the page cannot display anything other than what was actually queried.
//
// The shared module also makes a term LIKE-safe (`%` and `_` are escaped before
// they reach a pattern), which is the fix for "50%" matching the whole
// catalogue.
export { sanitizeSearchTerm, searchEcho, escapeLike, searchTokens } from "@shared/search-term";

/** Kept for callers that pass an explicit cap - the shared sanitizer's default
 *  is the page's own ceiling. */
import { sanitizeSearchTerm as sharedSanitize } from "@shared/search-term";
export function sanitizeSearchTermTo(raw: string | null | undefined, max: number): string {
  return sharedSanitize(raw, max);
}

/** The search term to ECHO back to the shopper, or "" when the query is not
 *  something worth showing. A term that had to be sanitised - it carried markup
 *  - still filters (it simply returns nothing), but it is never repeated as page
 *  copy, so a reflected-input attempt cannot turn into a heading, a chip or an
 *  empty-state message. */


export interface SeoOptions {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "product" | "article";
  jsonLd?: Record<string, unknown> | null;
  noindex?: boolean;
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  const created = !el;
  if (!el) {
    el = document.createElement("meta");
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el!.setAttribute(k, v));
  return created ? el : null;
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  const created = !el;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  return created ? el : null;
}

export function useSeo({
  title,
  description,
  path,
  image,
  type = "website",
  jsonLd = null,
  noindex = false,
}: SeoOptions) {
  useEffect(() => {
    const canonical = `${STORE_URL}${path === "/" ? "/" : path}`;
    const imageUrl = image
      ? image.startsWith("http")
        ? image
        : `${STORE_URL}${image}`
      : `${STORE_URL}/hero.png`;

    const fullTitle = title.includes("PetParcel") ? title : `${title} | PetParcel`;
    document.title = fullTitle;

    upsertMeta('meta[name="description"]', { name: "description", content: description });
    // A non-production host (a preview deployment, a local run) must never be
    // indexed, whatever the route's own directive says - the same rule the
    // client tag gate and the X-Robots-Tag header enforce. With no host to judge
    // (SSR, a test) the route's own directive stands.
    const onProductionHost =
      typeof window === "undefined" || !window.location?.hostname
        ? true
        : isProductionHost(window.location.hostname);
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      // The rich-preview directive from client/index.html is PRESERVED rather than
      // replaced. This hook used to write a plain "index,follow", which silently
      // dropped `max-image-preview:large` on every route the moment it ran - so the
      // static head advertised large image previews (Google's Discover and social
      // cards rely on it) and every client-rendered page quietly withdrew them.
      // A noindex page still gets the strict form, since it has nothing to preview.
      content:
        noindex || !onProductionHost
          ? "noindex,nofollow"
          : "index,follow,max-image-preview:large",
    });
    const created = [
      upsertLink("canonical", canonical),
      upsertMeta('meta[property="og:title"]', { property: "og:title", content: fullTitle }),
      upsertMeta('meta[property="og:description"]', {
        property: "og:description",
        content: description,
      }),
      upsertMeta('meta[property="og:type"]', { property: "og:type", content: type }),
      upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical }),
      upsertMeta('meta[property="og:image"]', { property: "og:image", content: imageUrl }),
      upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: "PetParcel" }),
      upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "en_US" }),
      upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" }),
      upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: fullTitle }),
      upsertMeta('meta[name="twitter:description"]', {
        name: "twitter:description",
        content: description,
      }),
      upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: imageUrl }),
    ].filter(Boolean) as HTMLElement[];

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = serializeJsonLd(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      created.forEach((el) => el.remove());
      script?.remove();
    };
  }, [title, description, path, image, type, jsonLd, noindex]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────
/** The site origin to hand a payment gateway so it can return the shopper here.
 *  Uses the live origin in the browser; falls back to the canonical domain. */
export function currentOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return STORE_URL;
}

export function scrollToTop() {
  if (typeof window === "undefined") return;
  // "smooth" is exactly the motion a reduced-motion user asked to be spared, so
  // they get an instant jump instead of an animated scroll.
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
}

/** Ratings are stored as an integer 1-5 on each review. */
export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
