import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, makeTrpcClient } from "./_core/trpc";
import { AuthProvider } from "./_core/useAuth";
import { WishlistProvider } from "./lib/wishlist";
import { CartProvider, purgeLegacyCartStorage } from "./lib/petparcel";
import { SiteProvider } from "./components/site/Layout";
import { ConsentBanner } from "./components/site/ConsentBanner";
import { restoreConsent } from "./lib/analytics";
import App from "./App";
import "./index.css";

function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => makeTrpcClient());
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* WishlistProvider needs the session (the wishlist is per account), so
              it sits inside AuthProvider and outside the pages that read it. */}
          <WishlistProvider>
            {/* SiteProvider feeds DB-backed store settings (brand, shipping rates,
                contact details) to every page; CartProvider owns the basket. Both
                must wrap the whole tree - the header alone reads from each. */}
            <SiteProvider>
              <CartProvider>
                <App />
                {/* The consent banner sits OUTSIDE <App> so it renders on every
                    route - including the bare admin surface, which is not framed
                    by the storefront Layout. */}
                <ConsentBanner />
              </CartProvider>
            </SiteProvider>
          </WishlistProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// One-time sweep of the pre-server-owned basket left in an existing visitor's
// browser, BEFORE the first render so it can never race the guest-basket merge
// inside CartProvider. Sentinel-guarded, so it runs on exactly one load. See
// `purgeLegacyCartStorage`.
purgeLegacyCartStorage();

// Re-apply a returning visitor's stored consent choice BEFORE the first render,
// so the Consent Mode v2 default in index.html is upgraded to their real choice
// before any hit can fire. A visitor who has not chosen keeps the denied default
// and the banner below asks them.
restoreConsent();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
