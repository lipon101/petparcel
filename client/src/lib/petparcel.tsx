// Client-side storefront plumbing: cart state, SEO head management, and small
// formatting helpers. Everything the pages need that isn't a component.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { STORE_URL } from "@shared/store";

// ─────────────────────────────────────────────────────────────────────────────
// Cart — persisted in localStorage so a refresh (or a return from the payment
// gateway) never loses the basket. Prices are only a DISPLAY copy; the server
// re-resolves every price from the catalog at checkout.
// ─────────────────────────────────────────────────────────────────────────────
export interface CartLine {
  slug: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  priceCents: number;
  image: string | null;
  qty: number;
  maxQty: number;
}

const CART_KEY = "petparcel_cart_v1";

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotalCents: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (slug: string, variantId: string | null, qty: number) => void;
  remove: (slug: string, variantId: string | null) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        Boolean(l) && typeof l === "object" && typeof (l as CartLine).slug === "string",
    );
  } catch {
    return [];
  }
}

const sameLine = (l: CartLine, slug: string, variantId: string | null) =>
  l.slug === slug && (l.variantId ?? null) === (variantId ?? null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => readStoredCart());

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      /* quota or private mode — the cart simply won't persist */
    }
  }, [lines]);

  // Keep two tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_KEY) setLines(readStoredCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => sameLine(l, line.slug, line.variantId));
      if (idx === -1) {
        return [...prev, { ...line, qty: Math.min(qty, line.maxQty || 99) }];
      }
      const next = [...prev];
      const merged = Math.min(next[idx].qty + qty, line.maxQty || 99);
      next[idx] = { ...next[idx], ...line, qty: merged };
      return next;
    });
  }, []);

  const setQty = useCallback((slug: string, variantId: string | null, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (sameLine(l, slug, variantId) ? { ...l, qty: Math.max(0, qty) } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const remove = useCallback((slug: string, variantId: string | null) => {
    setLines((prev) => prev.filter((l) => !sameLine(l, slug, variantId)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((sum, l) => sum + l.qty, 0);
    const subtotalCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0);
    return { lines, count, subtotalCents, add, setQty, remove, clear };
  }, [lines, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEO — sets the document title, meta description, canonical, Open Graph and
// Twitter tags, plus an optional schema.org JSON-LD block. Restores the
// previous tags on unmount so a client-side route change never leaves two
// conflicting canonical URLs behind.
// ─────────────────────────────────────────────────────────────────────────────
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
    upsertMeta('meta[name="robots"]', {
      name: "robots",
      content: noindex ? "noindex,nofollow" : "index,follow",
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
      script.textContent = JSON.stringify(jsonLd);
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
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

/** Ratings are stored as an integer 1–5 on each review. */
export function averageRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
