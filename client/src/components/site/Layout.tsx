// Site chrome: settings context, utility bar, announcement bar, header with a
// prominent search field and category nav, mobile drawer, and a footer with
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
        "relative inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold hover:bg-secondary",
        className,
      )}
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <ShoppingBag className="h-5 w-5" />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
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
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search beds, harnesses, toys…"
        aria-label="Search products"
        className="h-11 w-full rounded-full border border-input bg-card pl-10 pr-24 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
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
    <div className="hidden bg-primary text-primary-foreground lg:block">
      <div className="container-page flex h-9 items-center justify-between text-xs font-semibold">
        <p className="inline-flex items-center gap-2">
          <Truck className="h-3.5 w-3.5" /> Free US shipping over ${freeShip} · ships in 1 business day
        </p>
        <div className="flex items-center gap-5">
          <Link to="/track" className="hover:underline">
            Track order
          </Link>
          <Link to="/faq" className="hover:underline">
            Help &amp; FAQ
          </Link>
          <Link to="/contact" className="hover:underline">
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
    <div className="bg-accent text-accent-foreground">
      <div className="container-page flex items-center justify-center gap-2 py-2 text-center text-xs font-bold sm:text-sm">
        <PawPrint className="h-4 w-4 shrink-0" />
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
        "rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-secondary",
        location === to && "bg-secondary text-secondary-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container-page flex h-16 items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-2" onClick={scrollToTop}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <PawPrint className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">{brand_name}</span>
          </Link>
        </div>

        {/* Prominent search — the centrepiece of the header on desktop */}
        <SearchField className="mx-auto hidden max-w-xl flex-1 md:block" />

        <div className="ml-auto flex items-center gap-1">
          <Link
            to={user ? "/account" : "/login"}
            className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold hover:bg-secondary"
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
              className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground sm:inline-flex"
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
      <div className="hidden border-t border-border lg:block">
        <nav className="container-page flex h-11 items-center gap-1" aria-label="Main">
          <div className="relative">
            <button
              type="button"
              onClick={() => setCatOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3.5 py-1.5 text-sm font-bold text-secondary-foreground"
              aria-expanded={catOpen}
            >
              <Menu className="h-4 w-4" /> All categories <ChevronDown className="h-4 w-4" />
            </button>
            {catOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-lg">
                {cats.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">No categories yet</p>
                )}
                {cats.map((c) => (
                  <Link
                    key={c}
                    to={`/shop?category=${encodeURIComponent(c)}`}
                    className="block rounded-xl px-3 py-2 text-sm font-medium hover:bg-secondary"
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
              className="rounded-full px-3 py-2 text-sm font-semibold transition hover:bg-secondary"
            >
              {c}
            </Link>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-accent">
            <Truck className="h-4 w-4" /> Free shipping over $
            {(useSite().free_shipping_threshold_cents / 100).toFixed(0)}
          </span>
        </nav>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-border bg-background lg:hidden">
          <div className="container-page py-3">
            <SearchField className="mb-3" />
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <Link to="/shop" className="rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-secondary">
                Shop all
              </Link>
              <p className="px-3 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Categories
              </p>
              {cats.map((c) => (
                <Link
                  key={c}
                  to={`/shop?category=${encodeURIComponent(c)}`}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                >
                  {c}
                </Link>
              ))}
              <div className="my-2 h-px bg-border" />
              <Link to="/track" className="rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-secondary">
                Track order
              </Link>
              <Link to="/faq" className="rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-secondary">
                Help &amp; FAQ
              </Link>
              <Link
                to="/account/orders"
                className="rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-secondary"
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
    <div>
      <h3 className="text-sm font-bold">Join the pack</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">
        New arrivals, seasonal deals and pet-care tips. No spam, unsubscribe any time.
      </p>
      {done ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
          <Check className="h-4 w-4" /> You're on the list — welcome!
        </p>
      ) : (
        <form
          className="mt-3 flex gap-2"
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
            className="h-11 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={subscribe.isPending}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">{subscribe.isPending ? "Joining…" : "Join"}</span>
          </button>
        </form>
      )}
      {subscribe.isError && (
        <p className="mt-2 text-xs font-semibold text-destructive">{subscribe.error.message}</p>
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
    <footer className="mt-auto border-t border-border bg-secondary/40">
      <div className="container-page py-12">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <PawPrint className="h-5 w-5" />
              </span>
              <span className="text-lg font-extrabold">{s.brand_name}</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{s.tagline}</p>

            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{s.business_address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <a className="hover:text-foreground hover:underline" href={`mailto:${s.contact_email}`}>
                  {s.contact_email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <span>
                  {s.contact_phone} · {s.support_hours}
                </span>
              </li>
            </ul>

            <div className="mt-5 flex items-center gap-2">
              {[Globe, AtSign, MessageCircle].map((Icon, i) => (
                <span
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-inset ring-border"
                  aria-hidden="true"
                >
                  <Icon className="h-4 w-4" />
                </span>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.heading}>
              <h3 className="text-sm font-bold">{col.heading}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.to + l.label}>
                    <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-8">
          <NewsletterForm />
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {year} {s.brand_name}. All rights reserved. Prices in USD.
          </p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-primary" /> Free US shipping over $
              {(s.free_shipping_threshold_cents / 100).toFixed(0)}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <RotateCcw className="h-4 w-4 text-primary" /> {s.return_window_days}-day returns
            </li>
            <li className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Secure checkout
            </li>
          </ul>
        </div>

        {/* Payment badges */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">We accept</span>
          {["VISA", "Mastercard", "AMEX", "Discover"].map((brand) => (
            <span
              key={brand}
              className="rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-bold tracking-wide text-muted-foreground"
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
