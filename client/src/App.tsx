// Route table. Every page here is DB-driven; the two <RequireAuth> branches keep
// the account surface behind a signed-in session (the server enforces ownership
// and admin on every query regardless of what renders).
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useAuth } from "@/_core/useAuth";
import { Layout } from "@/components/site/Layout";
import { LoadingState, Section } from "@/components/site/Bits";

import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import ProductDetail from "@/pages/ProductDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import Track from "@/pages/Track";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { Account, AccountAddresses, AccountOrders } from "@/pages/Account";
import {
  AdminCustomers,
  AdminDashboard,
  AdminInventory,
  AdminOrderDetail,
  AdminOrders,
  AdminProductEditor,
  AdminProducts,
  AdminSettings,
} from "@/pages/Admin";
import { About, Contact, Faq, NotFound, Privacy, ShippingReturns, Terms } from "@/pages/Content";

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

export default function App() {
  return (
    <Layout>
      <Switch>
        {/* Storefront */}
        <Route path="/" component={Home} />
        <Route path="/shop" component={Shop} />
        <Route path="/product/:slug" component={ProductDetail} />
        <Route path="/cart" component={Cart} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/track" component={Track} />
        <Route path="/order/:orderNumber" component={OrderConfirmation} />

        {/* Auth */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />

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

        {/* Admin */}
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/products" component={AdminProducts} />
        <Route path="/admin/products/:id" component={AdminProductEditor} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/orders/:id" component={AdminOrderDetail} />
        <Route path="/admin/customers" component={AdminCustomers} />
        <Route path="/admin/inventory" component={AdminInventory} />
        <Route path="/admin/settings" component={AdminSettings} />

        {/* Content */}
        <Route path="/about" component={About} />
        <Route path="/faq" component={Faq} />
        <Route path="/shipping-returns" component={ShippingReturns} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/contact" component={Contact} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}
