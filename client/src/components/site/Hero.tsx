// The storefront hero: one static photograph with a slow, deliberate motion so
// the above-the-fold panel feels alive without anything moving the content.
//
// Why a single hero and not a rotating deck: the image is the page's anchor and
// nothing should compete with the two calls to action beside it. The motion
// carries the premium feel instead of a changing slide, which also means there
// are no controls to decorate and no timer deciding when the message changes
// under the reader.
//
// The panel leads with one short headline, then the two calls to action. The
// photograph carries the mood; the headline carries the message.
//
// The motion is three small, cheap things:
//   * a slow Ken Burns drift on the photo (26s there and back), so it breathes;
//   * the panel's soft fade-and-rise on mount, which the design system already
//     uses across the page;
//   * a shallow scroll parallax, so the photo lags the page slightly.
// All three are pure decoration on top of a plain <img>: the photograph is
// eager, high priority and preloaded from index.html, so it is painted with the
// first frame instead of fading in late, and the frame reserves its aspect ratio
// so nothing shifts when the bytes land. Every effect is switched off for anyone
// whose system asks for reduced motion.
import { useEffect, useRef } from "react";
import { ShoppingBag, Package, Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { CtaLink } from "./Bits";
import { useSite } from "./Layout";

// How far the photo lags the page between the hero's top entering and its bottom
// leaving the viewport, as a percentage of the frame height. Deliberately small:
// enough to feel connected to the scroll, never enough to read as movement.
const PARALLAX_PCT = 6;

export function Hero() {
  const s = useSite();
  const frameRef = useRef<HTMLDivElement | null>(null);

  // Scroll parallax. One requestAnimationFrame at a time, so a fast trackpad
  // flick cannot queue a pile of layout reads, and the listener is only ever
  // attached when the visitor has NOT asked for reduced motion.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;

    const paint = () => {
      frame = 0;
      const el = frameRef.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      // 0 while the hero still fills the viewport, 1 once it has scrolled fully
      // past. Clamped, so an overscroll bounce cannot push the photo out of frame.
      const progress = Math.min(1, Math.max(0, -box.top / Math.max(1, box.height)));
      el.style.setProperty("--hero-parallax", `${(progress * PARALLAX_PCT).toFixed(2)}%`);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(paint);
    };

    // Applied and re-applied on the fly: turning reduced motion on mid-session
    // stops the parallax immediately rather than at the next navigation.
    const sync = () => {
      if (reduced.matches) {
        frameRef.current?.style.removeProperty("--hero-parallax");
        window.removeEventListener("scroll", onScroll);
      } else {
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
      }
    };

    sync();
    reduced.addEventListener("change", sync);
    return () => {
      window.removeEventListener("scroll", onScroll);
      reduced.removeEventListener("change", sync);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section className="surface-mesh relative overflow-hidden border-b border-line">
      <div className="container-page grid items-center gap-12 py-14 lg:grid-cols-2 lg:py-20">
        <div className="animate-in-up">
          <div className="eyebrow">Dogs, cats &amp; more &middot; shipped across the USA</div>
          <h1 className="mt-4 text-[30px] leading-[1.18] sm:text-[38px] lg:text-[46px]">
            Everything your pet needs, all in one place
          </h1>
          <p className="mt-4 max-w-[46ch] text-[15.5px] leading-relaxed text-gray">
            Food and treats, beds and crates, harnesses, toys, grooming and more - the everyday pet
            supplies dog, cat, bird, fish and small-pet owners reach for. Fast, tracked shipping
            across the USA, and 30-day returns if it is not a fit.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {/* One clear hierarchy: a solid primary that leads, and a quiet
                secondary beside it. Both are 52px tall, so neither is a small
                tap target on a phone. Each carries one line icon that nudges on
                hover, so the pair reads as a matched set. */}
            <CtaLink
              to="/shop"
              variant="accent"
              size="lg"
              className="btn-hero btn-hero-primary"
            >
              <ShoppingBag className="h-[18px] w-[18px]" aria-hidden="true" />
              Shop pet supplies
            </CtaLink>
            <CtaLink
              to="/track"
              variant="outline"
              size="lg"
              className="btn-hero btn-hero-secondary"
            >
              <Package className="h-[18px] w-[18px]" aria-hidden="true" />
              Track your order
            </CtaLink>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-[13.5px] text-gray">
            <span className="inline-flex items-center gap-2">
              <Truck className="h-4 w-4 text-teal" /> Fast, tracked shipping
            </span>
            <span className="inline-flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-teal" /> {s.return_window_days}-day returns
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal" /> Secure checkout
            </span>
          </div>
        </div>

        <div className="relative animate-in-up" style={{ animationDelay: "120ms" }}>
          {/* The frame reserves the 16:9 box, so the photograph cannot cause a
              layout shift when it decodes. The two nested elements split the
              motion: the wrapper carries the scroll parallax, the image carries
              its own drift, so neither overwrites the other's transform. */}
          <div
            ref={frameRef}
            className="hero-frame relative aspect-[16/9] overflow-hidden rounded-[22px] border border-line bg-white shadow-[var(--shadow-lg)]"
          >
            <div className="hero-photo-wrap absolute inset-0">
              <img
                src="/hero-704.webp"
                srcSet="/hero-704.webp 704w, /hero.webp 1408w"
                sizes="(min-width: 1024px) 620px, 100vw"
                alt="A retriever and a cat resting together on a rug at home"
                width={1408}
                height={768}
                fetchPriority="high"
                decoding="async"
                loading="eager"
                className="hero-photo absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
