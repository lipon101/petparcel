// Site chrome: settings context, utility bar, announcement bar, a search-forward
// header with category nav, a mobile drawer, and a premium ink footer with
// newsletter signup, contact + policy links and payment badges.
//
// The structure follows a classic DTC storefront: a thin utility strip, a
// search-forward header, a category nav row, then a multi-column footer.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  LogOut,
  User,
  Search,
  Send,
  Check,
  Globe,
  AtSign,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useCart, scrollToTop } from "@/lib/petparcel";
import { cn } from "@/lib/utils";
import { SETTINGS_DEFAULTS, sortCategories, type SettingsMap } from "@shared/store";

// ── Settings context ─────────────────────────────────────────────────────────
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

// ── Cart badge ───────────────────────────────────────────────────────────────
function CartButton({ className }: { className?: string }) {
  const { count } = useCart();
  return (
    <Link
      to="/cart"
      className={cn(
        "relative inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-secondary",
        className,
      )}
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <ShoppingBag className="h-5 w-5" />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground shadow-sm">
          {count}
        </span>
      )}
    </Link>
  );
}

// ── Search field ─────────────────────────────────────────────────────────────
function SearchField({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const [, navigate] = useLocation();
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
      }}
    >
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search beds, harnesses, toys…"
        aria-label="Search products"
        className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-24 text-sm shadow-xs outline-none transition-all duration-300 placeholder:text-muted-foreground/70 focus:border-primary/50 focus:shadow-[var(--shadow-sm)] focus:ring-4 focus:ring-primary/12"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Search
      </button>
    </form>
  );
}

// ── Utility bar (thin strip above the header) ────────────────────────────────
function UtilityBar() {
  const s = useSite();
  const freeShip = (s.free_shipping_threshold_cents / 100).toFixed(0);
  return (
    <div className="hidden bg-[#062621] text-white/90 lg:block">
      <div className="container-page flex h-9 items-center justify-between text-xs font-semibold">
        <p className="inline-flex items-center gap-2">
          <Truck className="h-3.5 w-3.5 text-white/70" /> Free US shipping over ${freeShip} · ships in 1
          business day
        </p>
        <div className="flex items-center gap-5">
          <Link to="/track" className="transition-colors hover:text-white hover:underline">
            Track order
          </Link>
          <Link to="/faq" className="transition-colors hover:text-white hover:underline">
            Help &amp; FAQ
          </Link>
          <Link to="/contact" className="transition-colors hover:text-white hover:underline">
            Contact
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Announcement bar ─────────────────────────────────────────────────────────
function AnnouncementBar() {
  const { announcement } = useSite();
  if (!announcement) return null;
  return (
    <div className="bg-gradient-to-r from-accent via-accent to-[color-mix(in_oklab,var(--accent)_78%,var(--primary))] text-accent-foreground">
      <div className="container-page flex items-center justify-center gap-2 py-2 text-center text-xs font-bold tracking-tight sm:text-[13px]">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span>{announcement}</span>
      </div>
    </div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
function Header() {
  const { brand_name } = useSite();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const { data: categories } = trpc.catalog.categories.useQuery(undefined, { staleTime: 60_000 });
  const { user, logout } = useAuth();
  const s = useSite();

  // Close the drawer on navigation, and start each new page at the top.
  useEffect(() => {
    setMobileOpen(false);
    setCatOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const cats = sortCategories(categories ?? []);
  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={cn(
        "rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-secondary",
        location === to && "bg-secondary text-secondary-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 glass">
      <div className="container-page flex h-16 items-center gap-3 sm:h-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link to="/" className="group flex shrink-0 items-center gap-2.5" onClick={scrollToTop}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-md)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-6 group-hover:scale-105">
              <PawPrint className="h-5 w-5" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-[1.05rem] font-extrabold tracking-tight">{brand_name}</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Pet supplies
              </span>
            </span>
          </Link>
        </div>

        {/* Prominent search — the centrepiece of the header on desktop */}
        <SearchField className="mx-auto hidden max-w-xl flex-1 md:block" />

        <div className="ml-auto flex items-center gap-1">
          <Link
            to={user ? "/account" : "/login"}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors hover:bg-secondary"
            aria-label={user ? "Your account" : "Sign in"}
          >
            <User className="h-5 w-5" />
            <span className="hidden sm:inline">{user ? "Account" : "Sign in"}</span>
          </Link>
          {user && (
            <button
              type="button"
              onClick={() => {
                void logout().then(() => {
                  window.location.href = "/";
                });
              }}
              className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          )}
          <CartButton />
        </div>
      </div>

      {/* Category nav row */}
      <div className="hidden border-t border-border/60 lg:block">
        <nav className="container-page flex h-12 items-center gap-1" aria-label="Main">
          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-2 text-sm font-bold text-secondary-foreground transition-colors hover:bg-secondary/80"
              aria-expanded={catOpen}
            >
              <Menu className="h-4 w-4" /> All categories <ChevronDown className="h-4 w-4" />
            </button>
            {catOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-[var(--shadow-xl)]">
                {cats.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No categories yet</p>
                )}
                {cats.map((c) => (
                  <Link
                    key={c}
                    to={`/shop?category=${encodeURIComponent(c)}`}
                    className="block rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {navLink("/shop", "Shop all")}
          {cats.slice(0, 5).map((c) => (
            <Link
              key={c}
              to={`/shop?category=${encodeURIComponent(c)}`}
              className="rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              {c}
            </Link>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-accent">
            <Truck className="h-4 w-4" /> Free shipping over $
            {(s.free_shipping_threshold_cents / 100).toFixed(0)}
          </span>
        </nav>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="animate-in-up border-t border-border bg-background lg:hidden">
          <div className="container-page py-4">
            <SearchField className="mb-4" autoFocus />
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <Link
                to="/shop"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Shop all
              </Link>
              <p className="px-3 pt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Categories
              </p>
              {cats.map((c) => (
                <Link
                  key={c}
                  to={`/shop?category=${encodeURIComponent(c)}`}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  {c}
                </Link>
              ))}
              <div className="divider-glow my-2" />
              <Link
                to="/track"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Track order
              </Link>
              <Link
                to="/faq"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Help &amp; FAQ
              </Link>
              <Link
                to="/account/orders"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-secondary"
              >
                Your orders
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Newsletter signup (footer) ───────────────────────────────────────────────
function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const subscribe = trpc.newsletter.subscribe.useMutation({
    onSuccess: () => {
      setDone(true);
      setEmail("");
    },
  });

  return (
    <div className="lg:max-w-md">
      <h3 className="text-base font-bold text-white">Join the pack</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/65">
        New arrivals, seasonal deals and pet-care tips. No spam, unsubscribe any time.
      </p>
      {done ? (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-400/15 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-400/30">
          <Check className="h-4 w-4" /> You're on the list — welcome!
        </p>
      ) : (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) subscribe.mutate({ email: email.trim(), source: "footer" });
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email address"
            className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-white/40 focus:ring-2 focus:ring-white/20"
          />
          <button
            type="submit"
            disabled={subscribe.isPending}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground shadow-[var(--shadow-md)] transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{subscribe.isPending ? "Joining…" : "Join"}</span>
          </button>
        </form>
      )}
      {subscribe.isError && (
        <p className="mt-2 text-xs font-semibold text-rose-300">{subscribe.error.message}</p>
      )}
    </div>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────
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
        { label: "Travel & Outdoors", to: "/shop?category=Travel%20%26%20Outdoors" },
      ],
    },
    {
      heading: "Help",
      links: [
        { label: "Track your order", to: "/track" },
        { label: "FAQ", to: "/faq" },
        { label: "Contact us", to: "/contact" },
        { label: "Shipping & returns", to: "/shipping-returns" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About us", to: "/about" },
        { label: "Privacy policy", to: "/privacy" },
        { label: "Terms of service", to: "/terms" },
      ],
    },
  ];

  return (
    <footer className="surface-ink mt-auto text-white">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/15">
                <PawPrint className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold tracking-tight">{s.brand_name}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/65">{s.tagline}</p>

            <ul className="mt-6 space-y-2.5 text-sm text-white/65">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
                <span>{s.business_address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-white/45" />
                <a
                  className="transition-colors hover:text-white hover:underline"
                  href={`mailto:${s.contact_email}`}
                >
                  {s.contact_email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-white/45" />
                <span>
                  {s.contact_phone} · {s.support_hours}
                </span>
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-2">
              {[Globe, AtSign, MessageCircle].map((Icon, i) => (
                <span
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/70 ring-1 ring-inset ring-white/12 transition-colors hover:text-white"
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-bold text-white">{col.heading}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.to + l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-white/65 transition-colors hover:text-white hover:underline"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="my-10 h-px bg-white/10" />

        <NewsletterForm />

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/55">
            © {year} {s.brand_name}. All rights reserved. Prices in USD.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-white/65">
            <li className="inline-flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-white/45" /> Free US shipping over $
              {(s.free_shipping_threshold_cents / 100).toFixed(0)}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4 text-white/45" /> {s.return_window_days}-day returns
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-white/45" /> Secure checkout
            </li>
          </ul>
        </div>

        {/* Payment badges */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-white/55">We accept</span>
          {["VISA", "Mastercard", "AMEX", "Discover"].map((brand) => (
            <span
              key={brand}
              className="rounded-md border border-white/15 bg-white/8 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/75"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  useEffect(() => {
    // SPA navigations should land at the top of the new page.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location]);

  return (
    <div className="flex min-h-screen flex-col">
      <UtilityBar />
      <AnnouncementBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
