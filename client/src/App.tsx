// Route table. Every page here is DB-driven; the two <RequireAuth> branches keep
// the account surface behind a signed-in session (the server enforces ownership
// and admin on every query regardless of what renders). The management panel at
// ADMIN_ROOT is gated by its own <RequireAdmin> (see admin/AdminApp.tsx).
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useAuth } from "@/_core/useAuth";
import { Layout } from "@/components/site/Layout";
import { LoadingState, Section } from "@/components/site/Bits";
import { ADMIN_ROOT, isAdminPath } from "@/_core/admin-path";
import { readSessionVerifier, stripSessionVerifier } from "@shared/google-auth";

// ROUTE-LEVEL CODE SPLITTING. Each page below is its own chunk, fetched the
// first time a shopper navigates to it, so the initial download carries the
// shell plus the page actually being viewed instead of the entire storefront.
// A shopper who lands on a product never pays for the checkout bundle, and vice
// versa. Every lazy component is wrapped by the one <Suspense> boundary below,
// so the header/footer stay on screen while a chunk arrives.
//
// The management panel stays EAGER on purpose: it is a separate surface with its
// own runtime path, a shopper never loads it, and keeping it out of the lazy
// tree keeps the admin entry simple and independently verifiable.
import { AdminApp, type AdminPage } from "@/admin/AdminApp";

const Home = lazy(() => import("@/pages/Home"));
const Shop = lazy(() => import("@/pages/Shop"));
const ProductDetail = lazy(() => import("@/pages/ProductDetail"));
const Cart = lazy(() => import("@/pages/Cart"));
const Wishlist = lazy(() => import("@/pages/Wishlist"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const OrderConfirmation = lazy(() => import("@/pages/OrderConfirmation"));
const Track = lazy(() => import("@/pages/Track"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const GoogleCallback = lazy(() => import("@/pages/GoogleCallback"));

// A module that ships several pages is split per page, so each route still
// resolves to exactly the component it names.
const Account = lazy(() => import("@/pages/Account").then((m) => ({ default: m.Account })));
const AccountOrders = lazy(() => import("@/pages/Account").then((m) => ({ default: m.AccountOrders })));
const AccountAddresses = lazy(() =>
  import("@/pages/Account").then((m) => ({ default: m.AccountAddresses })),
);
const About = lazy(() => import("@/pages/Content").then((m) => ({ default: m.About })));
const Contact = lazy(() => import("@/pages/Content").then((m) => ({ default: m.Contact })));
const Faq = lazy(() => import("@/pages/Content").then((m) => ({ default: m.Faq })));
const NotFound = lazy(() => import("@/pages/Content").then((m) => ({ default: m.NotFound })));
const Privacy = lazy(() => import("@/pages/Content").then((m) => ({ default: m.Privacy })));
const ShippingReturns = lazy(() =>
  import("@/pages/Content").then((m) => ({ default: m.ShippingReturns })),
);
const Terms = lazy(() => import("@/pages/Content").then((m) => ({ default: m.Terms })));

/** Gate a route behind a session. The server is the real authority; this keeps
 *  signed-out visitors from landing on an empty dashboard. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <Section className="!pt-12">
        <LoadingState rows={3} />
      </Section>
    );
  }

  if (!user) return <Redirect to={`/login?next=${encodeURIComponent(location)}`} />;
  return <>{children}</>;
}

/** Map the management URL to an admin page. The panel is GATED (see
 *  AdminApp's ADMIN_REQUIRE_AUTH) - a signed-out visitor is shown the dedicated
 *  admin sign-in IN PLACE at the admin root and a non-admin is sent to the
 *  storefront before any admin page renders. */
function adminPageFor(pathname: string): AdminPage {
  const rest = pathname.slice(ADMIN_ROOT.length).replace(/^\/+/, "");
  const [head, id] = rest.split("/");
  switch (head) {
    case "login":
      return "login";
    case "products":
      return id ? "product-editor" : "products";
    case "promo":
      return "promo";
    case "featured-picks":
      return "featured-picks";
    case "inventory":
      return "inventory";
    case "categories":
      return "categories";
    case "orders":
      return id ? "order-detail" : "orders";
    case "customers":
      return "customers";
    case "reviews":
      return "reviews";
    case "messages":
      return "messages";
    case "newsletter":
      return "newsletter";
    case "settings":
      return "settings";
    default:
      return "dashboard";
  }
}

function AdminRoutes() {
  const [location] = useLocation();
  return <AdminApp page={adminPageFor(location)} />;
}

/** The outermost wrapper: the storefront chrome for shopper-facing routes, and a
 *  BARE surface for the management area. The panel is a separate surface - the
 *  storefront links to nothing in it, it links to nothing on the storefront, and
 *  its own door is answered by a dedicated endpoint - so it must not be framed by
 *  the storefront's header, footer or cart drawer. Matching the admin path here
 *  keeps both true: a shopper never sees the panel, and the panel never inherits
 *  the shopper chrome (nor offers a way back into it from the sign-in page). */
function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  if (isAdminPath(location)) return <>{children}</>;
  return <Layout>{children}</Layout>;
}

export default function App() {
  // A stray OAuth verifier must never linger in the address bar, on ANY route.
  // The callback page consumes it, but a provider that returns to the root (or a
  // bookmarked/shared link) would otherwise leave the credential visible. This
  // is a belt-and-braces strip: the callback page does the real work.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (readSessionVerifier(window.location.search)) {
      window.history.replaceState(null, "", stripSessionVerifier(window.location.href));
    }
  }, []);

  return (
    <Shell>
      {/* One boundary for every lazily-loaded route. While a page's chunk is in
          flight the storefront chrome (header, footer, cart drawer) stays on
          screen and only the page body shows a loader, so navigating never
          blanks the page. */}
      <Suspense
        fallback={
          <Section className="!pt-12">
            <LoadingState rows={3} />
          </Section>
        }
      >
        <Switch>
          {/* Storefront */}
        <Route path="/" component={Home} />
        <Route path="/shop" component={Shop} />
        <Route path="/product/:slug" component={ProductDetail} />
        <Route path="/cart" component={Cart} />
        <Route path="/wishlist" component={Wishlist} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/track" component={Track} />
        <Route path="/order/:orderNumber" component={OrderConfirmation} />

        {/* Auth */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/auth/callback" component={GoogleCallback} />

        {/* Customer account */}
        <Route path="/account">
          <RequireAuth>
            <Account />
          </RequireAuth>
        </Route>
        <Route path="/account/orders">
          <RequireAuth>
            <AccountOrders />
          </RequireAuth>
        </Route>
        <Route path="/account/addresses">
          <RequireAuth>
            <AccountAddresses />
          </RequireAuth>
        </Route>

        {/* Store management. The path is derived at runtime (see
            _core/admin-path.ts) so no readable management URL ships inside the
            public bundle. The panel is GATED (ADMIN_REQUIRE_AUTH=true in
            AdminApp): a signed-out visitor sees the DEDICATED admin sign-in in
            place here and a non-admin is sent to the storefront, and the server
            rejects every admin.* call from a non-admin regardless. These routes
            render OUTSIDE the storefront <Layout> (see <Shell>). */}
        {/* A bare `*` segment matches the REST of the path (including slashes),
            so `/lostsec/products/<id>` and `/lostsec/orders/<id>` reach the
            panel. `:rest*` would NOT: wouter's matcher treats `:rest*` as a
            single-segment param, so the editor/detail routes fell through to the
            404 catch-all. The bare ADMIN_ROOT route below covers the no-slash
            case (`*` requires a trailing slash). */}
        <Route path={`${ADMIN_ROOT}/*`} component={AdminRoutes} />
        <Route path={ADMIN_ROOT} component={AdminRoutes} />

        {/* Content */}
        <Route path="/about" component={About} />
        <Route path="/faq" component={Faq} />
        <Route path="/shipping-returns" component={ShippingReturns} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/contact" component={Contact} />

        <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Shell>
  );
}
