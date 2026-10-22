// The slide-in cart panel.
//
// It opens the moment something is added, so the shopper sees the basket fill
// instead of having to hunt for the header counter, and it hides itself again
// the instant the last line is removed - an empty panel left hanging open reads
// as a bug, not a feature.
//
// Accessibility is first class here because this is a modal surface:
// role="dialog" + aria-modal, Escape and click-outside to dismiss, a real focus
// trap inside the panel, focus handed back to whatever opened it, and `inert`
// while closed so nothing inside it can be reached by Tab from the page behind.
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { Link, useLocation } from "wouter";
import { Check, CreditCard, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/lib/petparcel";
import { cn } from "@/lib/utils";
import { formatMoney } from "@shared/store";
import { productImageSrcSet } from "@shared/product-media";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function CartDrawer({
  freeShippingThresholdCents,
}: {
  freeShippingThresholdCents: number;
}) {
  const { lines, subtotalCents, count, setQty, remove, drawerOpen, closeDrawer, cartLoading, signInRequired, signedIn } = useCart();
  const [location] = useLocation();
  const panelRef = useRef<HTMLElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // A route change dismisses the panel, so following a link from inside it never
  // leaves the drawer sitting over the page the shopper just moved to.
  useEffect(() => {
    closeDrawer();
  }, [location, closeDrawer]);

  // Open: remember the trigger, move focus into the panel, and freeze the page
  // behind it (compensating for the scrollbar so nothing jumps sideways).
  // Close: hand focus back to the trigger and unfreeze.
  useEffect(() => {
    if (!drawerOpen) return;
    const panel = panelRef.current;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    panel?.focus();
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      restoreRef.current?.focus?.();
    };
  }, [drawerOpen]);

  // Escape closes; Tab stays inside the panel while it is open.
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape") {
        closeDrawer();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [closeDrawer],
  );

  const remaining = Math.max(0, freeShippingThresholdCents - subtotalCents);
  const showBand = freeShippingThresholdCents > 0 && lines.length > 0;
  // The identical progress maths the cart and checkout pages use, so all three
  // surfaces read the same percentage for the same basket. The threshold itself
  // is never duplicated here - it arrives as a prop from the server setting.
  const freeProgress =
    freeShippingThresholdCents > 0
      ? Math.min(100, Math.round((subtotalCents / freeShippingThresholdCents) * 100))
      : 0;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[70] bg-ink/40 transition-opacity duration-300",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        inert={!drawerOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        aria-hidden={!drawerOpen}
        onKeyDown={onKeyDown}
        className={cn(
          "fixed right-0 top-0 z-[71] flex h-full w-[min(400px,100vw)] flex-col bg-white shadow-[var(--shadow-xl)] outline-none transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          drawerOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em]">
            Your cart{" "}
            {count > 0 && (
              <span className="text-coral">
                ({count} item{count === 1 ? "" : "s"})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close cart"
            className="text-ink transition-colors hover:text-coral"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {showBand && (
          <div className="border-b border-line bg-teal-soft px-5 py-3 text-[12.5px] text-teal-deep">
            {remaining > 0 ? (
              <>
                You're <b>{formatMoney(remaining)}</b> away from free shipping.
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <Check className="h-4 w-4" /> Free shipping unlocked
              </span>
            )}
            {remaining > 0 && (
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={freeProgress}
                aria-label="Progress to free shipping"
              >
                <div
                  className="h-full rounded-full bg-teal transition-all duration-500"
                  style={{ width: `${freeProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-teal/30" />
            {/* Three distinct states, never conflated with "empty":
                  - still loading: a placeholder, so a signed-in shopper does not
                    see "empty" flash before their saved basket arrives;
                  - signed out (or a mutation was attempted signed out): the
                    SIGN-IN prompt, because a basket needs an account to own it;
                  - genuinely empty and signed in: the normal nudge to shop. */}
            {cartLoading ? (
              <p className="text-sm text-gray">Loading your cart\u2026</p>
            ) : signInRequired || !signedIn ? (
              <>
                <p className="text-sm text-gray">
                  Sign in to use your saved cart \u2014 it follows you between devices.
                </p>
                <Link to="/login" onClick={closeDrawer} className="btn btn-primary btn-md">
                  Sign in
                </Link>
                <Link to="/shop" onClick={closeDrawer} className="text-[12.5px] text-gray underline">
                  Keep browsing
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-gray">Your cart is empty.</p>
                <Link to="/shop" onClick={closeDrawer} className="btn btn-primary btn-md">
                  Start shopping
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              {lines.map((l) => (
                <div
                  key={`${l.slug}-${l.variantId ?? "base"}`}
                  className="flex min-w-0 gap-3 overflow-hidden border-b border-line-soft py-4 last:border-0"
                >
                  <Link
                    to={`/product/${l.slug}`}
                    onClick={closeDrawer}
                    className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-blush"
                  >
                    {l.image ? (
                      <img
                        src={l.image}
                        srcSet={productImageSrcSet(l.image)}
                        sizes="72px"
                        alt={l.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl">
                        🐾
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/product/${l.slug}`}
                      onClick={closeDrawer}
                      className="line-clamp-2 break-words text-[13.5px] font-medium leading-snug transition-colors hover:text-teal [overflow-wrap:anywhere]"
                    >
                      {l.name}
                    </Link>
                    {l.variantName && (
                      <p className="mt-0.5 text-[11.5px] text-gray">{l.variantName}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-line">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${l.name}`}
                          onClick={() => setQty(l.slug, l.variantId, l.qty - 1)}
                          className="px-2 py-1 text-ink transition-colors hover:text-coral"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-[22px] text-center text-[12.5px] font-medium">
                          {l.qty}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${l.name}`}
                          disabled={l.qty >= (l.maxQty || 99)}
                          onClick={() => setQty(l.slug, l.variantId, l.qty + 1)}
                          className="px-2 py-1 text-ink transition-colors hover:text-coral disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-[13.5px] font-semibold text-coral">
                        {formatMoney(l.priceCents * l.qty)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${l.name} from cart`}
                        onClick={() => remove(l.slug, l.variantId)}
                        className="text-gray-2 transition-colors hover:text-coral"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-line px-5 py-5">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-gray">Subtotal</span>
                <span className="text-[17px] font-semibold text-coral">
                  {formatMoney(subtotalCents)}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-gray">
                Shipping and any tax are calculated at checkout.
              </p>
              <Link
                to="/checkout"
                onClick={closeDrawer}
                className="btn btn-accent btn-lg mt-4 w-full"
              >
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Checkout
              </Link>
              <Link
                to="/cart"
                onClick={closeDrawer}
                className="btn btn-outline btn-md mt-2 w-full"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                View full cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
