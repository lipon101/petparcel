// Site chrome. Mirrors the reference storefront's three-row header exactly:
//
//   Row 1  utility strip  - currency, free-shipping message, socials, quick links
//   Row 2  main bar       - burger · brand · search + category select · support/account/cart
//   Row 3  sticky nav     - "Browse Categories" panel · primary menu · login/register
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
import { PaymentMark, VerifiedByNowPayments } from "./PaymentIcons";
import { CartDrawer } from "./CartDrawer";
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
  Dog,
  Cat,
  LogOut,
  User,
  Search,
  Send,
  Check,
  Heart,
  Clock,
  ArrowUp,
  LayoutGrid,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useTopCategories } from "@/lib/useCatalog";
import { openConsentPreferences } from "@/lib/consent-ui";
import { ALL_CATEGORIES_ICON, categoryIcon } from "@/lib/category-icons";
import { useCart, scrollToTop } from "@/lib/petparcel";
import { cn } from "@/lib/utils";
import { SETTINGS_DEFAULTS, cleanAddress, cleanAnnouncement, formatMoney, type SettingsMap } from "@shared/store";

/** The search control's resting label.
 *
 *  "Select Category" rather than "All categories": the control is a chooser, so
 *  it should read as an empty prompt the shopper fills in, not as a filter that
 *  is already applied. The option inside the menu says "All categories" for the
 *  choice itself, which is unambiguous once the list is open. */
const SELECT_CATEGORY = "Select Category";

export function SocialIcon({ name, className }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
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
          <path d="M17.2 6.8h.01" />
        </svg>
      );
    case "TikTok":
      return (
        <svg {...common}>
          <path d="M15 3v9.5a4.5 4.5 0 1 1-4.5-4.5" />
          <path d="M15 3c.5 2.6 2.2 4.3 5 4.5" />
        </svg>
      );
    case "Pinterest":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.5" />
          <path d="M11 21l2.2-8" />
          <path d="M9.8 13.6c-.6-.9-.9-1.9-.9-3.1a3.9 3.9 0 0 1 4-3.9c2.2 0 3.8 1.5 3.8 3.7 0 2.6-1.4 4.4-3.3 4.4-.9 0-1.6-.5-1.8-1.2" />
        </svg>
      );
    case "Medium":
      return (
        <svg {...common}>
          <ellipse cx="6.6" cy="12" rx="4.2" ry="6" />
          <ellipse cx="15.2" cy="12" rx="1.9" ry="4.6" />
          <path d="M19.6 9.6v4.8" />
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

/** The store's REAL accounts. Only the platforms it actually has a presence on
 *  are listed - an icon for a platform with no account would promise a shopper a
 *  page that does not exist. */
const SOCIAL_LINKS: { name: string; url: string }[] = [
  { name: "Facebook", url: "https://www.facebook.com/petparcel" },
  { name: "TikTok", url: "https://www.tiktok.com/@getpetparcel" },
  { name: "Pinterest", url: "https://www.pinterest.com/petparcel" },
  { name: "Medium", url: "https://medium.com/@petparcel" },
];

/** The PetParcel mark: a dog and a cat sharing one rounded tile - the two
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

function CartAction() {
  const { count, subtotalCents, openDrawer } = useCart();
  const s = useSite();
  // The header badge carries the SAME server-driven threshold and the SAME maths
  // the cart page, the cart drawer and checkout use, so all four surfaces read
  // one number and can never disagree. It is a decorative meter drawn inside the
  // badge's own icon box, so the action keeps its exact hit area and the header
  // layout is untouched; the accessible message rides on the button's label.
  const threshold = s.free_shipping_threshold_cents;
  const showProgress = threshold > 0 && count > 0;
  const remaining = Math.max(0, threshold - subtotalCents);
  const freeProgress = showProgress
    ? Math.min(100, Math.round((subtotalCents / threshold) * 100))
    : 0;
  const unlocked = showProgress && remaining === 0;
  const shipLabel = showProgress
    ? unlocked
      ? "Free shipping unlocked"
      : `Add ${formatMoney(remaining)} more for free shipping`
    : "";
  return (
    <button
      type="button"
      onClick={openDrawer}
      className="hd-action"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}${shipLabel ? ` - ${shipLabel}` : ""}`}
    >
      <span className="relative">
        <ShoppingBag className="h-[21px] w-[21px]" />
        {count > 0 && <span className="hd-cart-count">{count}</span>}
        {showProgress && (
          <span className="hd-cart-progress" aria-hidden="true" title={shipLabel}>
            <span className="hd-cart-progress-fill" style={{ width: `${freeProgress}%` }} />
          </span>
        )}
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
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [, navigate] = useLocation();
  // Only the best handful of categories are offered here; the full list is one
  // click away at the foot of the menu. The control has no "all" selection of its
  // own: an empty `category` already means no filter, so the trigger falls back
  // to the grid mark until an aisle is chosen. That is also what keeps it honest,
  // because a real "All categories" state would render as a row with no name.
  const SelectedIcon = category ? categoryIcon(category) : ALL_CATEGORIES_ICON;

  // Click-away and Escape close the menu, the same contract as the header's
  // other panels.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <form
      role="search"
      className={cn("hd-search-wrap", className)}
      onSubmit={(e) => {
        e.preventDefault();
        setOpen(false);
        const q = value.trim();
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (category) params.set("category", category);
        const qs = params.toString();
        navigate(qs ? `/shop?${qs}` : "/shop");
      }}
    >
      <div className="hd-search">
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
            <button
              type="button"
              className="hd-cat-trigger"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={`Category: ${category || SELECT_CATEGORY}`}
              onClick={() => setOpen((v) => !v)}
            >
              <SelectedIcon className="hd-cat-ic" aria-hidden="true" />
              <span className="hd-cat-label">{category || SELECT_CATEGORY}</span>
              <ChevronDown className={cn("hd-cat-caret", open && "open")} aria-hidden="true" />
            </button>
          </div>
        )}
        <button type="submit" aria-label="Search">
          <Search className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Outside the pill on purpose: `.hd-search` clips to its rounded border,
          so a menu rendered inside it would be cut off. */}
      {withCategory && categories.length > 0 && open && (
        <div className="hd-cat-menu" ref={wrapRef}>
          {/* A two-column grid: the panel is as wide as the search pill, so a
              single column of nine rows would run past the bottom of the
              screen, while two columns keep every row at the same height and
              the whole list visible at once. */}
          <div role="listbox" aria-label="Categories" className="hd-cat-list">
            {/* This row LEADS to the full list rather than setting a filter, so
                it is not a selectable state. An empty `category` already means
                "no filter", and the trigger shows that as the placeholder; a
                real "all" selection would instead show a nameless row. */}
            <button
              type="button"
              role="option"
              aria-selected={false}
              className="hd-cat-opt hd-cat-all"
              onClick={() => {
                setCategory("");
                setOpen(false);
                navigate("/shop");
              }}
            >
              <ALL_CATEGORIES_ICON className="hd-cat-ic" aria-hidden="true" />
              <span>All categories</span>
            </button>
            {categories.map((c) => {
              const Icon = categoryIcon(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={category === c}
                  className={cn("hd-cat-opt", category === c && "is-active")}
                  onClick={() => {
                    setCategory(c);
                    setOpen(false);
                  }}
                >
                  <Icon className="hd-cat-ic" aria-hidden="true" />
                  <span>{c}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
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
  const { user, logout } = useAuth();
  // `top` feeds the condensed search control; `nav` is the CURATED browse menu
  // (a handful of aisles with the few subcategories worth naming), and
  // `hiddenAisles` is how many the cap is holding back - the menu says so out
  // loud and hands the full tree to the shop page, so nothing is unreachable.
  const { top: topCats, nav, hiddenAisles } = useTopCategories();
  const catRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDrawerOpen(false);
    setCatOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Any click outside the category dropdown closes it; Escape closes it too.
  useEffect(() => {
    if (!catOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (catRef.current && !catRef.current.contains(target)) setCatOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCatOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [catOpen]);

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
            <span className="hd-top-item hd-top-line">
              <Truck className="hd-top-ic" aria-hidden="true" />
              {cleanAnnouncement(announcement)}
            </span>
          </div>
          <div className="hd-top-right">
            <span className="hd-socials">
              {SOCIAL_LINKS.map(({ name, url }) => (
                <a
                  key={name}
                  href={url}
                  aria-label={name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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

          <SearchField className="hidden md:flex" withCategory categories={topCats} />

          <div className="hd-actions">
            <Link to="/wishlist" className="hd-action" aria-label="My Wishlist">
              <Heart className="h-[21px] w-[21px]" />
              <span className="hd-action-label">Wishlist</span>
            </Link>

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
              }}
              aria-expanded={catOpen}
              aria-haspopup="menu"
            >
              <Menu className="h-4 w-4" />
              <span className="hidden sm:inline">Browse categories</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {catOpen && (
              <div className="hd-dropdown hd-mega">
                {nav.length === 0 ? (
                  <p className="hd-mega-note">No categories yet</p>
                ) : (
                  <>
                    <div className="hd-mega-grid">
                      {nav.map((aisle) => (
                        <div key={aisle.name}>
                          <Link
                            className="hd-mega-head"
                            to={`/shop?category=${encodeURIComponent(aisle.name)}`}
                          >
                            <span>{aisle.name}</span>
                            <span className="hd-mega-count">{aisle.productCount}</span>
                          </Link>
                          {aisle.children.length > 0 && (
                            <div className="hd-mega-sub">
                              {aisle.children.map((child) => (
                                <Link
                                  key={child.name}
                                  to={`/shop?category=${encodeURIComponent(child.name)}`}
                                >
                                  {child.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="hd-mega-foot">
                      <Link className="hd-mega-all" to="/shop">
                        <LayoutGrid className="h-3.5 w-3.5" /> Shop all categories
                      </Link>
                      {hiddenAisles > 0 && (
                        <span className="hd-mega-note">
                          {hiddenAisles} more aisle{hiddenAisles === 1 ? "" : "s"} on the shop page
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <nav className="hd-menu" aria-label="Main">
            {navLink("/", "Home")}
            {navLink("/shop", "Shop")}
            {navLink("/shop?sort=newest", "New arrivals")}
            {navLink("/shop?sort=featured", "Featured")}
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
                { to: "/shop?sort=featured", label: "Featured" },
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
              {nav.map((aisle) => (
                <div key={aisle.name} className="border-b border-line-soft">
                  <Link
                    to={`/shop?category=${encodeURIComponent(aisle.name)}`}
                    className="flex items-center gap-2.5 py-3.5 text-[13.5px] font-semibold transition-colors hover:text-coral"
                  >
                    <LayoutGrid className="h-4 w-4 text-teal" /> {aisle.name}
                  </Link>
                  {aisle.children.length > 0 && (
                    <div className="flex flex-col pb-2 pl-7">
                      {aisle.children.map((child) => (
                        <Link
                          key={child.name}
                          to={`/shop?category=${encodeURIComponent(child.name)}`}
                          className="py-1.5 text-[12.5px] text-gray transition-colors hover:text-coral"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Link
                to="/shop"
                className="flex items-center gap-2.5 py-3.5 text-[13px] font-semibold uppercase tracking-[0.1em] text-teal"
              >
                <LayoutGrid className="h-4 w-4" /> Shop all categories
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
  const { footerNav } = useTopCategories();
  const cols: { heading: string; links: { label: string; to: string }[] }[] = [
    {
      heading: "Shop",
      // The curated aisles (stocked first, capped - see shared/nav-curation.ts)
      // plus one link to the full tree. Deliberately NOT all fifteen aisles: a
      // wall of category links beside three short columns reads as noise, and
      // every aisle is still one click away through the last link.
      links: [
        ...footerNav.map((a) => ({
          label: a.name,
          to: `/shop?category=${encodeURIComponent(a.name)}`,
        })),
        { label: "Shop all categories", to: "/shop" },
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

  // One click returns the reader to the top. The easing is chosen here rather
  // than in the stylesheet, because "smooth" is exactly the motion a
  // reduced-motion user has asked to be spared: they get an instant jump.
  const scrollToTop = () => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

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
              {SOCIAL_LINKS.map(({ name, url }) => (
                <a
                  key={name}
                  href={url}
                  aria-label={name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
              <span className="ft-addr-row">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                <span className="ft-addr">{cleanAddress(s.business_address)}</span>
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

            {/* The trust strip reads as ONE short line: "Fast, tracked US shipping
                - 30-day returns". The separators are real text (not CSS) so the
                sentence is identical when copied, read aloud or scraped.

                The support hours are deliberately NOT repeated here: they are
                already the last row of "Get in touch" directly above, so listing
                them again in the same column read as a duplicate. The global
                announcement bar carries the longer combined line once for the
                whole page; the footer's job is the short version. */}
            <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[12.5px] text-gray">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-teal" /> Fast, tracked US shipping
              </span>
              <span aria-hidden="true" className="text-gray/50">
                -
              </span>
              <span className="inline-flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-teal" /> 30-day returns
              </span>
            </div>
          </div>
        </div>

        <div className="divider-glow" />

        {/* Full-bleed below `sm` only. The band lives inside `.container-page`,
            which is 94% wide under 860px, so the horizontal inset it can pull
            back through is exactly 3% - pulling 4% made the band 101.5% of the
            viewport and clipped a few pixels off each edge. 3% spans the full
            width with nothing to spare. Above `sm` the negative margin is
            dropped entirely and the band becomes a normal rounded card. */}
        <div className="newsletter-band -mx-[3%] px-[3%] py-8 sm:mx-0 sm:rounded-2xl sm:px-8">
          <div className="newsletter-inner">
            <div className="newsletter-left">
              <span className="newsletter-ic">
                <Heart className="h-6 w-6" />
              </span>
              <div>
                <p className="newsletter-title">Join the PetParcel pack</p>
                <p className="newsletter-sub">
                  New arrivals, restock alerts and the occasional treat. No spam -
                  unsubscribe any time.
                </p>
              </div>
            </div>
            <NewsletterForm />
          </div>
        </div>

        <div className="ft-bottom mt-8">
          <div className="ft-bottom-inner">
            <div className="ft-bottom-left">
              <p>
                © {year} {s.brand_name}. All rights reserved. Prices in USD.
              </p>
              {/* Consent is a LIVE choice, not a one-off answer. This reopens the
                  consent banner (see lib/consent-ui.ts) with the visitor's current
                  preferences pre-filled, so consent can be reviewed or withdrawn
                  from any page - the GDPR right, and also the only way a US
                  visitor who accepted can later change their mind without
                  clearing site data. */}
              <button
                type="button"
                onClick={openConsentPreferences}
                className="ft-cookie-link"
              >
                Cookie settings
              </button>
            </div>
            <div className="ft-bottom-right">
              <div className="pay-icons">
                <span className="pay-label">We accept</span>
                <span className="pay-list">
                  <PaymentMark />
                </span>
                <VerifiedByNowPayments />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating back to top. It sits in the footer so it belongs to the page's
          last region, but `position: fixed` pins it to the bottom right of the
          VIEWPORT - reachable from any scroll position, and adding no height here
          because it is out of flow. */}
      <button type="button" className="to-top" onClick={scrollToTop} aria-label="Back to top">
        <ArrowUp aria-hidden="true" />
      </button>
    </footer>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const s = useSite();
  useEffect(() => {
    // SPA navigations should land at the top of the new page.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Skip link: the FIRST focusable element on every storefront page. It is
          visually hidden until it takes keyboard focus, then appears as a real
          button in the top-left corner, so a keyboard or screen-reader user can
          jump straight past the three-row header to the page body instead of
          tabbing through every nav link on every page. `#main-content` is the
          <main> below; it carries `tabIndex={-1}` so activating the link moves
          focus INTO the content region, not merely the scroll position. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
      <CartDrawer freeShippingThresholdCents={s.free_shipping_threshold_cents} />
    </div>
  );
}