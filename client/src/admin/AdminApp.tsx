// The admin panel shell: sidebar navigation, responsive layout, and the page
// switch. Mounted at the store's management route (see _core/admin-path.ts).
//
// AUTH GATE: the panel is GATED. Every page is wrapped in `RequireAdmin`, so a
// signed-out visitor is shown the DEDICATED admin sign-in IN PLACE at the admin
// root (never redirected to the storefront's shared customer login) and a
// signed-in non-admin is redirected to the storefront - no public visitor ever
// sees the panel's layout, navigation or data. The gate is controlled by
// `ADMIN_REQUIRE_AUTH` below (the single documented switch).
//
// The SERVER is the real gate regardless: every `admin.*` procedure is an
// `adminProcedure`, so an anonymous caller gets UNAUTHORIZED and a non-admin
// gets FORBIDDEN no matter what the client renders. This gate is defence in
// depth, not the authority.
import { Link, Redirect } from "wouter";
import {
  BarChart3,
  Boxes,
  Inbox,
  LayoutGrid,
  Mail,
  MessageSquare,
  Package,
  LogOut,
  Settings as SettingsIcon,
  ShoppingCart,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { ADMIN_ROOT, adminPath } from "@/_core/admin-path";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { cn } from "@/lib/utils";
import { adminGateDecision } from "./gate";
import { AdminLogin } from "./AdminLogin";
import { AdminDataProvider } from "./data-source";
import { ToastProvider } from "./ui";
import { DashboardPage } from "./pages/Dashboard";
import { ProductsPage } from "./pages/Products";
import { ProductEditorPage } from "./pages/ProductEditor";
import { PromoPage } from "./pages/Promo";
import { FeaturedPicksPage } from "./pages/FeaturedPicks";
import { InventoryPage } from "./pages/Inventory";
import { CategoriesPage } from "./pages/Categories";
import { OrdersPage } from "./pages/Orders";
import { OrderDetailPage } from "./pages/OrderDetail";
import { CustomersPage } from "./pages/Customers";
import { ReviewsPage } from "./pages/Reviews";
import { MessagesPage } from "./pages/Messages";
import { NewsletterPage } from "./pages/Newsletter";
import { SettingsPage } from "./pages/Settings";

/**
 * THE SINGLE SWITCH for the admin panel's client-side auth gate.
 *
 * `true`: every admin page wraps in `RequireAdmin`, which renders the DEDICATED
 * admin sign-in IN PLACE at the admin root for a signed-out visitor (never a
 * redirect to the storefront's shared customer login) and sends a signed-in
 * non-admin to the storefront. Set it to `false` only to deliberately expose the
 * panel UI again - the server still rejects every `admin.*` call from a
 * non-admin either way, so this switch only controls the client-side UX.
 */
export const ADMIN_REQUIRE_AUTH = true;

export type AdminPage =
  | "login"
  | "dashboard"
  | "products"
  | "product-editor"
  | "promo"
  | "featured-picks"
  | "inventory"
  | "categories"
  | "orders"
  | "order-detail"
  | "customers"
  | "reviews"
  | "messages"
  | "newsletter"
  | "settings";

interface NavItem {
  page: AdminPage;
  to: string;
  label: string;
  icon: React.ElementType;
}

const NAV: NavItem[] = [
  { page: "dashboard", to: adminPath(), label: "Dashboard", icon: BarChart3 },
  { page: "products", to: adminPath("products"), label: "Products", icon: Package },
  { page: "promo", to: adminPath("promo"), label: "Home promo", icon: Sparkles },
  { page: "featured-picks", to: adminPath("featured-picks"), label: "Featured picks", icon: Sparkles },
  { page: "inventory", to: adminPath("inventory"), label: "Inventory", icon: Boxes },
  { page: "categories", to: adminPath("categories"), label: "Categories", icon: LayoutGrid },
  { page: "orders", to: adminPath("orders"), label: "Orders", icon: ShoppingCart },
  { page: "customers", to: adminPath("customers"), label: "Customers", icon: Users },
  { page: "reviews", to: adminPath("reviews"), label: "Reviews", icon: MessageSquare },
  { page: "messages", to: adminPath("messages"), label: "Messages", icon: Inbox },
  { page: "newsletter", to: adminPath("newsletter"), label: "Newsletter", icon: Mail },
  { page: "settings", to: adminPath("settings"), label: "Settings", icon: SettingsIcon },
];

/** The active nav item for a page (editor/detail fold into their list). */
function activeNav(page: AdminPage): AdminPage {
  if (page === "product-editor") return "products";
  if (page === "order-detail") return "orders";
  return page;
}

/** The panel's top bar: the PetParcel brand lockup, a subtle divider, and the
 *  two action controls. On a phone the labels collapse to icons (see `.ah-*` in
 *  index.css) so the bar never overflows; each control keeps an accessible
 *  label and a comfortable 40px tap target. */
function AdminHeader() {
  const { logout } = useAuth();
  return (
    <header className="ah-bar">
      <div className="ah-brand">
        <span className="ah-mark" aria-hidden="true">
          <Store className="h-5 w-5" />
        </span>
        <span className="ah-lockup">
          <span className="ah-wordmark">
            Pet<span className="brand-accent">Parcel</span>
          </span>
          <span className="ah-kicker">Store management</span>
        </span>
      </div>
      <span className="ah-divider" aria-hidden="true" />
      <div className="ah-actions">
        <Link to="/" className="ah-btn ah-btn--outline" aria-label="Back to storefront">
          <Boxes className="h-4 w-4" aria-hidden="true" />
          <span className="ah-label">Back to storefront</span>
        </Link>
        {/* Signing out of the panel returns to the STOREFRONT HOME - never the
            admin login, and never a leftover admin surface. A full reload drops
            any cached admin state. */}
        <button
          type="button"
          onClick={() => {
            void logout().then(() => {
              window.location.href = "/";
            });
          }}
          className="ah-btn ah-btn--signout"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="ah-label">Sign out</span>
        </button>
      </div>
    </header>
  );
}

function Sidebar({ page }: { page: AdminPage }) {
  const active = activeNav(page);
  return (
    <aside className="lg:sticky lg:top-6 lg:h-fit">
      {/* Wraps on small screens (every item fully visible, nothing clipped) and
          becomes a vertical sidebar from lg up. A wrapping row beats a
          sideways-scrolling one here: a scrolling row shows the next item
          half-cut at the edge, which reads as broken rather than scrollable. */}
      <nav className="flex flex-wrap gap-2 lg:flex-col" aria-label="Admin sections">
        {NAV.map(({ page: p, to, label, icon: Icon }) => (
          <Link
            key={p}
            to={to}
            className={cn(
              "inline-flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              active === p
                ? "bg-secondary text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            aria-current={active === p ? "page" : undefined}
          >
            <Icon className="h-4 w-4" /> {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

/** The auth gate. `ADMIN_REQUIRE_AUTH` is ON, so every admin page is wrapped:
 *  a signed-out visitor is shown the DEDICATED admin sign-in IN PLACE at the
 *  admin root, a signed-in non-admin is sent to the storefront, and only an
 *  admin sees the panel. While the session is still being determined it renders
 *  a neutral loading state, so admin content never flashes before the check
 *  resolves.
 *
 *  The decision itself is the pure `adminGateDecision` (see ./gate), so the rule
 *  is unit-tested without a DOM. This is defence in depth - the SERVER rejects
 *  every `admin.*` call from a non-admin regardless of what renders here. */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const decision = adminGateDecision(ADMIN_REQUIRE_AUTH, isLoading, user);

  // Keep the panel out of search indexes even while it is gated.
  useSeo({
    title: "Store management",
    description: "PetParcel store management.",
    path: ADMIN_ROOT,
    noindex: true,
  });

  if (decision.kind === "loading") {
    return (
      <div className="container-page py-24 text-center text-sm text-muted-foreground" role="status">
        Checking access…
      </div>
    );
  }
  // A signed-out visitor sees the DEDICATED admin sign-in IN PLACE, at the admin
  // root itself - never a redirect to the storefront's shared customer login.
  if (decision.kind === "login") return <AdminLogin />;
  if (decision.kind === "redirect") return <Redirect to={decision.to} />;
  return <>{children}</>;
}

function renderPage(page: AdminPage) {
  switch (page) {
    case "dashboard":
      return <DashboardPage />;
    case "products":
      return <ProductsPage />;
    case "product-editor":
      return <ProductEditorPage />;
    case "promo":
      return <PromoPage />;
    case "featured-picks":
      return <FeaturedPicksPage />;
    case "inventory":
      return <InventoryPage />;
    case "categories":
      return <CategoriesPage />;
    case "orders":
      return <OrdersPage />;
    case "order-detail":
      return <OrderDetailPage />;
    case "customers":
      return <CustomersPage />;
    case "reviews":
      return <ReviewsPage />;
    case "messages":
      return <MessagesPage />;
    case "newsletter":
      return <NewsletterPage />;
    case "settings":
      return <SettingsPage />;
  }
}

export function AdminApp({ page }: { page: AdminPage }) {
  // The dedicated admin sign-in is the ONE admin route rendered WITHOUT the
  // gate - it is the public page a signed-out visitor is redirected to. It
  // loads no panel data and renders no panel chrome, and the server refuses
  // every account that is not the single designated admin.
  if (page === "login") return <AdminLogin />;

  return (
    <AdminDataProvider>
      <ToastProvider>
        <RequireAdmin>
          <div className="container-page min-h-screen py-8">
            <AdminHeader />
            {/* The content column is `minmax(0, 1fr)`, NOT an implicit auto
                track: an auto track sizes to the widest child (a wide data
                table), which would stretch the column past the viewport and
                get clipped by the page's `overflow-x: hidden` instead of
                scrolling inside the table's own container. minmax(0, 1fr)
                lets the column shrink so `overflow-x-auto` on the table does
                the scrolling. */}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[236px_minmax(0,1fr)]">
              <Sidebar page={page} />
              <main className="min-w-0">
                {renderPage(page)}
              </main>
            </div>
          </div>
        </RequireAdmin>
      </ToastProvider>
    </AdminDataProvider>
  );
}
