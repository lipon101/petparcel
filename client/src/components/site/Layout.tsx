// Site chrome. Mirrors the reference storefront's three-row header exactly:
//
//   Row 1  utility strip  — currency, free-shipping message, socials, quick links
//   Row 2  main bar       — burger · brand · search + category select · support/account/cart
//   Row 3  sticky nav     — "Browse Categories" panel · primary menu · login/register
//
// plus a mini-cart slide-out and a mobile drawer. Below that, a five-column
// footer with the newsletter form and payment badges. Brand, rates and contact
// details all come from the database so the admin panel can change them without
// a redeploy.
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "wouter";
import {
  Menu,
  X,
  ShoppingBag,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  Truck,
  RotateCcw,
  ShieldCheck,
  PawPrint,
  Dog,
  Cat,
  LogOut,
  User,
  Search,
  Send,
  Check,
  Heart,
  Plus,
  Minus,
  Trash2,
  Clock,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useCart, scrollToTop } from "@/lib/petparcel";
import { cn } from "@/lib/utils";
import { formatMoney } from "@shared/store";
import { SETTINGS_DEFAULTS, sortCategories, type SettingsMap } from "@shared/store";

export function SocialIcon({ name, className }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "Facebook":
      return (
        <svg {...common}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case "TikTok":
      return (
        <svg {...common}>
          <path d="M15 3v9.5a4.5 4.5 0 1 1-4.5-4.5" />
          <path d="M15 3c.5 2.6 2.2 4.3 5 4.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="4" />
          <path d="M10 9l5 3-5 3z" />
        </svg>
      );
  }
}

const SOCIAL_LINKS = ["Facebook", "Instagram", "TikTok", "YouTube"] as const;

/** The PetParcel mark: a dog and a cat sharing one rounded tile — the two
 *  animals the store is built around, drawn in the brand navy. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("brand-mark", className)} aria-hidden="true">
      <Dog className="h-[17px] w-[17px]" strokeWidth={1.9} />
      <Cat className="h-[17px] w-[17px]" strokeWidth={1.9} />
    </span>
  );
}

// ── Settings context ────────────────────────────────────────────────────────
// Brand name, shipping rates and contact details come from the DB so the admin
// panel can change them without a redeploy. Defaults render instantly, then the
// live values replace them.
const SiteContext = createContext<SettingsMap>(SETTINGS_DEFAULTS);

export function useSite(): SettingsMap {
  return useContext(SiteContext);
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const { data } = trpc.settings.public.useQuery(undefined, { staleTime: 60_000 });
  const settings = (data as SettingsMap | undefined) ?? SETTINGS_DEFAULTS;
  return <SiteContext.Provider value={settings}>{children}</SiteContext.Provider>;
}

// ── Mini-cart ───────────────────────────────────────────────────────────────
// rupanjali-style slide-out showing the current lines. It is purely additive:
// the full /cart page remains the checkout path, so a broken drawer can never
// block a purchase.
const MiniCartContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function MiniCartProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <MiniCartContext.Provider value={{ open, setOpen }}>{children}</MiniCartContext.Provider>
  );
}

function MiniCart() {
  const { open, setOpen } = useContext(MiniCartContext);
  const { lines, subtotalCents, count, setQty, remove } = useCart();
  const s = useSite();
  const freeShip = s.free_shipping_threshold_cents;
  const remaining = Math.max(0, freeShip - subtotalCents);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[70] bg-ink/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[71] flex h-full w-[min(400px,92vw)] flex-col bg-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-label="Cart"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em]">
            Your cart {count > 0 && <span className="text-coral">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close cart"
            className="text-ink transition-colors hover:text-coral"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-teal/30" />
            <p className="text-sm text-gray">Your cart is empty.</p>
            <Link to="/shop" onClick={() => setOpen(false)} className="btn btn-primary btn-md">
              Start shopping
            </Link>
          </div>
        ) : (
          <>
            {freeShip > 0 && (
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
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5">
              {lines.map((l) => (
                <div
                  key={`${l.slug}-${l.variantId ?? "base"}`}
                  className="flex gap-3 border-b border-line-soft py-4 last:border-0"
                >
                  <Link
                    to={`/product/${l.slug}`}
                    onClick={() => setOpen(false)}
                    className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-lg bg-blush"
                  >
                    {l.image ? (
                      <img src={l.image} alt={l.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-2xl">
                        🐾
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/product/${l.slug}`}
                      onClick={() => setOpen(false)}
                      className="line-clamp-2 text-[13.5px] font-medium leading-snug transition-colors hover:text-teal"
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
                          aria-label="Decrease quantity"
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
                          aria-label="Increase quantity"
                          onClick={() => setQty(l.slug, l.variantId, l.qty + 1)}
                          className="px-2 py-1 text-ink transition-colors hover:text-coral"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-[13.5px] font-semibold text-coral">
                        {formatMoney(l.priceCents * l.qty)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${l.name}`}
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
                onClick={() => setOpen(false)}
                className="btn btn-accent btn-lg mt-4 w-full"
              >
                Checkout
              </Link>
              <Link
                to="/cart"
                onClick={() => setOpen(false)}
                className="btn btn-outline btn-md mt-2 w-full"
              >
                View full cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

// ── Cart action ─────────────────────────────────────────────────────────────
function CartAction() {
  const { count } = useCart();
  const { setOpen } = useContext(MiniCartContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="hd-action"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <span className="relative">
        <ShoppingBag className="h-[21px] w-[21px]" />
        {count > 0 && <span className="hd-cart-count">{count}</span>}
      </span>
      <span className="hd-action-label">Cart</span>
    </button>
  );
}

// ── Search ──────────────────────────────────────────────────────────────────
function SearchField({
  className,
  autoFocus = false,
  withCategory = false,
  categories = [],
}: {
  className?: string;
  autoFocus?: boolean;
  withCategory?: boolean;
  categories?: string[];
}) {
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("");
  const [, navigate] = useLocation();

  return (
    <form
      role="search"
      className={cn("hd-search", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (category) params.set("category", category);
        const qs = params.toString();
        navigate(qs ? `/shop?${qs}` : "/shop");
      }}
    >
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search for products"
        aria-label="Search products"
      />
      {withCategory && categories.length > 0 && (
        <div className="hd-search-cat">
          <select
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">SELECT CATEGORY</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" aria-label="Search">
        <Search className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────
function Header() {
  const { brand_name, contact_phone, announcement } = useSite();
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"menu" | "cats">("menu");
  const [catOpen, setCatOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const { data: categories } = trpc.catalog.categories.useQuery(undefined, { staleTime: 60_000 });
  const { user, logout } = useAuth();
  const catRef = useRef<HTMLDivElement | null>(null);
  const supportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDrawerOpen(false);
    setCatOpen(false);
    setSupportOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Any click outside a header dropdown closes it; Escape closes whichever is
  // open. Both panels share one effect so their document listeners can never
  // fight over the same event.
  useEffect(() => {
    if (!catOpen && !supportOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (catOpen && catRef.current && !catRef.current.contains(target)) setCatOpen(false);
      if (supportOpen && supportRef.current && !supportRef.current.contains(target))
        setSupportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCatOpen(false);
        setSupportOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [catOpen, supportOpen]);

  const cats = sortCategories(categories ?? []);
  const on = (to: string) => (to === "/" ? location === "/" : location.startsWith(to));
  const navLink = (to: string, label: string) => (
    <Link key={to + label} to={to} className={cn("hd-link", on(to) && "active")}>
      {label}
    </Link>
  );

  return (
    <header>
      {/* ── Row 1: utility strip ─────────────────────────────────────────── */}
      <div className="hd-top">
        <div className="container-page hd-top-in">
          <div className="hd-top-left">
            <span className="hd-top-item hidden sm:inline">USD $</span>
            {announcement && <span className="hd-top-item">{announcement}</span>}
          </div>
          <div className="hd-top-right">
            <span className="hd-socials">
              {SOCIAL_LINKS.map((name) => (
                <a key={name} href="#" aria-label={name}>
                  <SocialIcon name={name} className="h-3.5 w-3.5" />
                </a>
              ))}
            </span>
            <a className="hd-top-item hidden lg:inline" href="#newsletter">
              Newsletter
            </a>
            <Link className="hd-top-item hidden lg:inline" to="/contact">
              Contact us
            </Link>
            <Link className="hd-top-item hidden lg:inline" to="/faq">
              FAQs
            </Link>
            <Link className="hd-top-item" to="/track">
              Track order
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 2: brand, search, actions ────────────────────────────────── */}
      <div className="hd-main">
        <div className="container-page hd-main-in">
          <button
            type="button"
            className="hd-burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-[22px] w-[22px]" />
          </button>

          <Link to="/" className="brand" onClick={scrollToTop} aria-label={brand_name}>
            <BrandMark />
            <span className="brand-text">
              <span className="brand-name">{brand_name}</span>
              <span className="brand-sub">Pet supplies</span>
            </span>
          </Link>

          <SearchField className="hidden md:flex" withCategory categories={cats} />

          <div className="hd-actions">
            <div className="relative hidden items-center lg:flex" ref={supportRef}>
              <button
                type="button"
                className="hd-action"
                onClick={() => {
                  setSupportOpen((v) => !v);
                  setCatOpen(false);
                }}
                aria-expanded={supportOpen}
                aria-haspopup="menu"
              >
                {/* The caret is pinned to the icon, not stacked under the label —
                    that third row was what pushed Support off the row baseline. */}
                <span className="hd-action-ic">
                  <Phone className="h-[21px] w-[21px]" />
                  <ChevronDown className="hd-action-caret" aria-hidden="true" />
                </span>
                <span className="hd-action-label">Support</span>
              </button>
              {supportOpen && (
                <div className="hd-dropdown absolute right-0 top-full mt-2 w-64 rounded-xl border border-line bg-white p-4 shadow-[var(--shadow-lg)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray">
                    Customer care
                  </p>
                  <a
                    href={`tel:${contact_phone.replace(/[^+\d]/g, "")}`}
                    className="mt-3 flex items-center gap-2 text-[13.5px] transition-colors hover:text-coral"
                  >
                    <Phone className="h-4 w-4 text-teal" /> {contact_phone}
                  </a>
                  <Link
                    to="/contact"
                    className="mt-2 flex items-center gap-2 text-[13.5px] transition-colors hover:text-coral"
                  >
                    <Mail className="h-4 w-4 text-teal" /> Send us a message
                  </Link>
                  <Link
                    to="/track"
                    className="mt-2 flex items-center gap-2 text-[13.5px] transition-colors hover:text-coral"
                  >
                    <Truck className="h-4 w-4 text-teal" /> Track an order
                  </Link>
                </div>
              )}
            </div>

            <Link to={user ? "/account" : "/login"} className="hd-action">
              <User className="h-[21px] w-[21px]" />
              <span className="hd-action-label">{user ? "Account" : "Sign in"}</span>
            </Link>

            {user && (
              <button
                type="button"
                onClick={() => {
                  void logout().then(() => {
                    window.location.href = "/";
                  });
                }}
                className="hd-action hidden lg:inline-flex"
                aria-label="Sign out"
              >
                <LogOut className="h-[21px] w-[21px]" />
                <span className="hd-action-label">Sign out</span>
              </button>
            )}

            <CartAction />
          </div>
        </div>
      </div>

      {/* ── Row 3: sticky category nav ───────────────────────────────────── */}
      <div className="hd-nav hd-sticky glass">
        <div className="container-page hd-nav-in">
          <div className="relative" ref={catRef}>
            <button
              type="button"
              className="hd-cats"
              onClick={() => {
                setCatOpen((v) => !v);
                setSupportOpen(false);
              }}
              aria-expanded={catOpen}
              aria-haspopup="menu"
            >
              <Menu className="h-4 w-4" />
              <span className="hidden sm:inline">Browse categories</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {catOpen && (
              <div className="hd-dropdown absolute left-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-xl border border-line bg-white py-1.5 shadow-[var(--shadow-lg)]">
                {cats.length === 0 && (
                  <p className="px-4 py-2 text-sm text-gray">No categories yet</p>
                )}
                {cats.map((c) => (
                  <Link
                    key={c}
                    to={`/shop?category=${encodeURIComponent(c)}`}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-[13.5px] transition-colors hover:bg-teal-soft hover:text-teal-deep"
                  >
                    <PawPrint className="h-3.5 w-3.5 text-teal" /> {c}
                  </Link>
                ))}
                <Link
                  to="/shop"
                  className="mt-1 flex items-center gap-2.5 border-t border-line-soft px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-teal transition-colors hover:bg-teal-soft"
                >
                  <ShoppingBag className="h-3.5 w-3.5" /> All products
                </Link>
              </div>
            )}
          </div>

          <nav className="hd-menu" aria-label="Main">
            {navLink("/", "Home")}
            {navLink("/shop", "Shop")}
            {navLink("/shop?sort=newest", "New arrivals")}
            {navLink("/shop?sort=featured", "Best sellers")}
            {navLink("/about", "About us")}
            {navLink("/contact", "Contact us")}
          </nav>

          <div className="hd-nav-right">
            {user ? (
              <Link to="/account" className="hd-link">
                My account
              </Link>
            ) : (
              <Link to="/login" className="hd-link">
                Login / Register
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile drawer ──────────────────────────────────────────────────── */}
      <div
        className={cn(
          "fixed inset-0 z-[80] bg-ink/40 transition-opacity duration-300 lg:hidden",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-[81] flex h-full w-[min(360px,90vw)] flex-col bg-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Menu"
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="brand">
            <BrandMark className="h-9 w-9" />
            <span className="brand-text">
              <span className="brand-name text-[26px]">{brand_name}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="text-ink transition-colors hover:text-coral"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <SearchField />
        </div>

        <div className="mt-4 grid grid-cols-2 border-y border-line">
          {(["menu", "cats"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setDrawerTab(tab)}
              className={cn(
                "py-3 text-[12px] font-semibold uppercase tracking-[0.16em] transition-colors",
                drawerTab === tab
                  ? "border-b-2 border-coral text-coral"
                  : "text-gray hover:text-ink",
              )}
            >
              {tab === "menu" ? "Menu" : "Categories"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {drawerTab === "menu" ? (
            <nav className="flex flex-col" aria-label="Mobile">
              {[
                { to: "/", label: "Home" },
                { to: "/shop", label: "Shop" },
                { to: "/shop?sort=newest", label: "New arrivals" },
                { to: "/shop?sort=featured", label: "Best sellers" },
                { to: "/about", label: "About us" },
                { to: "/contact", label: "Contact us" },
                { to: "/track", label: "Track order" },
                { to: user ? "/account" : "/login", label: user ? "My account" : "Login / Register" },
              ].map((l) => (
                <Link
                  key={l.to + l.label}
                  to={l.to}
                  className="border-b border-line-soft py-3.5 text-[13px] font-medium uppercase tracking-[0.1em] transition-colors hover:text-coral"
                >
                  {l.label}
                </Link>
              ))}

              <button
                type="button"
                onClick={() => setPagesOpen((v) => !v)}
                className="flex items-center justify-between border-b border-line-soft py-3.5 text-[13px] font-medium uppercase tracking-[0.1em] transition-colors hover:text-coral"
                aria-expanded={pagesOpen}
              >
                Pages <span className="text-lg leading-none">{pagesOpen ? "−" : "›"}</span>
              </button>
              {pagesOpen && (
                <div className="flex flex-col border-b border-line-soft py-1 pl-3">
                  {[
                    { to: "/faq", label: "FAQs" },
                    { to: "/shipping-returns", label: "Shipping & returns" },
                    { to: "/privacy", label: "Privacy policy" },
                    { to: "/terms", label: "Terms & conditions" },
                  ].map((l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      className="py-2.5 text-[12.5px] text-gray transition-colors hover:text-coral"
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              )}

              {user && (
                <button
                  type="button"
                  onClick={() => {
                    void logout().then(() => {
                      window.location.href = "/";
                    });
                  }}
                  className="py-3.5 text-left text-[13px] font-medium uppercase tracking-[0.1em] text-coral"
                >
                  Sign out
                </button>
              )}
            </nav>
          ) : (
            <div className="flex flex-col">
              {cats.map((c) => (
                <Link
                  key={c}
                  to={`/shop?category=${encodeURIComponent(c)}`}
                  className="flex items-center gap-2.5 border-b border-line-soft py-3.5 text-[13.5px] transition-colors hover:text-coral"
                >
                  <PawPrint className="h-4 w-4 text-teal" /> {c}
                </Link>
              ))}
              <Link
                to="/shop"
                className="py-3.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-teal"
              >
                All products
              </Link>
            </div>
          )}
        </div>

        <div className="border-t border-line bg-teal-soft px-5 py-4 text-[12.5px] text-teal-deep">
          <a
            href={`tel:${contact_phone.replace(/[^+\d]/g, "")}`}
            className="flex items-center gap-2 font-medium"
          >
            <Phone className="h-4 w-4" /> {contact_phone}
          </a>
          <p className="mt-1.5 flex items-center gap-2 text-teal-deep/70">
            <Clock className="h-4 w-4" /> Questions? We answer every one.
          </p>
        </div>
      </aside>

      <MiniCart />
    </header>
  );
}

// ── Newsletter ──────────────────────────────────────────────────────────────
function NewsletterForm() {
  const [email, setEmail] = useState("");
  const subscribe = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => setEmail(""),
  });
  const done = subscribe.isSuccess;

  if (done) {
    return (
      <div id="newsletter" className="flex items-center gap-3 text-[14px] text-teal-deep">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-teal">
          <Check className="h-5 w-5" />
        </span>
        <p>
          <b>You're on the list.</b> Watch your inbox for new arrivals and the occasional
          treat.
        </p>
      </div>
    );
  }

  return (
    <div id="newsletter" className="newsletter-form">
      <form
        className="flex w-full gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          subscribe.mutate({ email: email.trim() });
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          aria-label="Email address"
        />
        <button
          type="submit"
          disabled={subscribe.isPending}
          className="btn btn-primary btn-lg shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {subscribe.isPending ? "Joining…" : "Subscribe"}
          </span>
        </button>
      </form>
      {subscribe.isError && (
        <p className="mt-2 w-full text-[12.5px] font-medium text-red-600">
          {subscribe.error.message}
        </p>
      )}
    </div>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────
function Footer() {
  const s = useSite();
  const year = new Date().getFullYear();
  const cols: { heading: string; links: { label: string; to: string }[] }[] = [
    {
      heading: "Shop",
      links: [
        { label: "All products", to: "/shop" },
        { label: "Dogs", to: "/shop?category=Dogs" },
        { label: "Cats", to: "/shop?category=Cats" },
        { label: "Feeding", to: "/shop?category=Feeding" },
        { label: "Grooming", to: "/shop?category=Grooming" },
        { label: "Travel & outdoors", to: "/shop?category=Travel%20%26%20Outdoors" },
      ],
    },
    {
      heading: "Help",
      links: [
        { label: "Contact us", to: "/contact" },
        { label: "FAQs", to: "/faq" },
        { label: "Shipping policy", to: "/shipping-returns" },
        { label: "Returns & refunds", to: "/shipping-returns" },
        { label: "Track your order", to: "/track" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "Our story", to: "/about" },
        { label: "Why buy from us", to: "/about" },
        { label: "Privacy policy", to: "/privacy" },
        { label: "Terms & conditions", to: "/terms" },
      ],
    },
  ];

  return (
    <footer className="ft">
      <div className="container-page">
        <div className="ft-grid">
          <div>
            <Link to="/" className="brand">
              <BrandMark />
              <span className="brand-text">
                <span className="brand-name">{s.brand_name}</span>
                <span className="brand-sub">Pet supplies</span>
              </span>
            </Link>
            <p className="ft-tagline">{s.tagline}</p>

            <div className="ft-socials">
              {SOCIAL_LINKS.map((name) => (
                <a key={name} href="#" aria-label={name}>
                  <SocialIcon name={name} className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.heading}>
              <h3 className="ft-head">{col.heading}</h3>
              <div className="ft-col">
                {col.links.map((l) => (
                  <Link key={l.to + l.label} to={l.to}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <div>
            <h3 className="ft-head">Get in touch</h3>
            <div className="ft-col">
              <span className="items-start">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                <span>{s.business_address}</span>
              </span>
              <a href={`mailto:${s.contact_email}`}>
                <Mail className="h-4 w-4 shrink-0 text-teal" />
                {s.contact_email}
              </a>
              <a href={`tel:${s.contact_phone.replace(/[^+\d]/g, "")}`}>
                <Phone className="h-4 w-4 shrink-0 text-teal" />
                {s.contact_phone}
              </a>
              <span>
                <Clock className="h-4 w-4 shrink-0 text-teal" />
                {s.support_hours}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-gray">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-teal" /> Fast, tracked shipping
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-teal" /> {s.return_window_days}-day returns
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-teal" /> Real support
              </span>
            </div>
          </div>
        </div>

        <div className="divider-glow" />

        <div className="newsletter-band -mx-[4%] px-[4%] py-8 sm:mx-0 sm:rounded-2xl sm:px-8">
          <div className="newsletter-inner">
            <div className="newsletter-left">
              <span className="newsletter-ic">
                <Heart className="h-6 w-6" />
              </span>
              <div>
                <p className="newsletter-title">Join the PetParcel pack</p>
                <p className="newsletter-sub">
                  New arrivals, restock alerts and the occasional treat. No spam —
                  unsubscribe any time.
                </p>
              </div>
            </div>
            <NewsletterForm />
          </div>
        </div>

        <div className="ft-bottom mt-8">
          <div className="ft-bottom-inner">
            <p>
              © {year} {s.brand_name}. All rights reserved. Prices in USD.
            </p>
            <div className="pay-icons">
              <span className="text-[11px] uppercase tracking-[0.1em] text-gray">
                We accept
              </span>
              {["Visa", "Mastercard", "Amex", "Discover"].map((brand) => (
                <span key={brand} className="pay">
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => {
    // SPA navigations should land at the top of the new page.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location]);

  return (
    <MiniCartProvider>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </MiniCartProvider>
  );
}
