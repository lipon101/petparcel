import { createContext, useContext, useMemo, type ReactNode } from "react";
import { trpc } from "./trpc";
import type { SessionUser } from "@shared/types";
import { requestStorageAccessIfEmbedded } from "./storage-access";
import { currentOrigin } from "@/lib/petparcel";

// Frontend auth seam. Wraps the tRPC auth router so pages consume a single
// `useAuth()` - they never see the session mechanism (cookie/JWT/SSO). Mirrors
// the server AuthProvider abstraction (DESIGN §5.1).
interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string, turnstileToken?: string) => Promise<{ signedIn: boolean }>;
  /** Leave for Google. Resolves only if the journey could not be started - on
   *  success the browser is already navigating away. */
  startGoogleSignIn: (next?: string) => Promise<void>;
  /** Finish a Google sign-in, called by the callback page with the one-time
   *  verifier the provider appended to the URL. Returns where the shopper was
   *  originally headed. Throws with a shopper-safe message when the verifier
   *  could not be exchanged. */
  completeGoogleSignIn: (verifier: string) => Promise<string>;
  /** Ask for a password-reset email. Always resolves - the server never reveals
   *  whether the address has an account. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Complete a password reset with the token from the emailed link. */
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<{ email: string }>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Where the Google round trip is parked between leaving and coming back.
 *
 *  OAuth is a full-page navigation to the provider and back, so nothing in
 *  React survives the journey: this stash is what lets the callback page know
 *  WHICH provider to talk to and WHERE the shopper was originally headed.
 *  `sessionStorage` (not `localStorage`) so it dies with the tab, and it holds
 *  only public values - the provider's own base URL, which is the address the
 *  browser is about to visit anyway, and a destination path. */
const GOOGLE_JOURNEY_KEY = "petparcel.google.journey";

function stashGoogleJourney(next: string) {
  try {
    sessionStorage.setItem(GOOGLE_JOURNEY_KEY, JSON.stringify({ next }));
  } catch {
    // A browser that blocks sessionStorage still gets a working sign-in; the
    // callback just falls back to the account page.
  }
}

function takeGoogleJourney(): { next: string } {
  try {
    const raw = sessionStorage.getItem(GOOGLE_JOURNEY_KEY);
    if (raw) sessionStorage.removeItem(GOOGLE_JOURNEY_KEY);
    const parsed = raw ? (JSON.parse(raw) as { next?: unknown }) : null;
    return { next: typeof parsed?.next === "string" && parsed.next ? parsed.next : "/account" };
  } catch {
    return { next: "/account" };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const loginM = trpc.auth.login.useMutation();
  const signupM = trpc.auth.signup.useMutation();
  const verifyEmailM = trpc.auth.verifyEmail.useMutation();
  const resendM = trpc.auth.resendVerification.useMutation();
  const logoutM = trpc.auth.logout.useMutation();
  const googleStartM = trpc.auth.googleSignInStart.useMutation();
  const googleCompleteM = trpc.auth.googleSignInComplete.useMutation();
  const resetRequestM = trpc.auth.requestPasswordReset.useMutation();
  const resetCompleteM = trpc.auth.resetPassword.useMutation();

  const value = useMemo<AuthContextValue>(
    () => ({
      user: me.data ?? null,
      isLoading: me.isLoading,
      login: async (email, password) => {
        await requestStorageAccessIfEmbedded();
        await loginM.mutateAsync({ email, password });
        await utils.auth.me.invalidate();
      },
      signup: async (email, password, name, turnstileToken) => {
        await requestStorageAccessIfEmbedded();
        const res = await signupM.mutateAsync({ email, password, name, origin: currentOrigin(), turnstileToken });
        await utils.auth.me.invalidate();
        // The account is created even when the session could not be established
        // (e.g. the deployment is missing JWT_SECRET). Report that honestly so
        // the page can tell the shopper to sign in rather than implying failure.
        return { signedIn: res.signedIn !== false };
      },
      startGoogleSignIn: async (next = "/account") => {
        await requestStorageAccessIfEmbedded();
        const { url } = await googleStartM.mutateAsync();
        stashGoogleJourney(next);
        // Hand the browser to the provider. Google's own consent screen is the
        // next thing the shopper sees; nothing here inspects the URL.
        window.location.href = url;
      },
      completeGoogleSignIn: async (verifier) => {
        const journey = takeGoogleJourney();
        // The exchange happens on OUR server, with the challenge cookie it
        // parked on our own origin when the flow started. The browser could
        // never do this itself: the provider's challenge cookie is partitioned
        // to the provider's origin, so a cross-site request from here does not
        // carry it - which is exactly why the callback used to spin forever.
        await googleCompleteM.mutateAsync({ verifier });
        await utils.auth.me.invalidate();
        return journey.next;
      },
      requestPasswordReset: async (email) => {
        await resetRequestM.mutateAsync({ email, origin: currentOrigin() });
      },
      resetPassword: async (token, newPassword) => {
        await resetCompleteM.mutateAsync({ token, newPassword });
      },
      verifyEmail: async (token) => {
        const res = await verifyEmailM.mutateAsync({ token });
        await utils.auth.me.invalidate();
        return { email: res.email };
      },
      resendVerification: async (email) => {
        await resendM.mutateAsync({ email, origin: currentOrigin() });
      },
      logout: async () => {
        await requestStorageAccessIfEmbedded();
        await logoutM.mutateAsync();
        await utils.auth.me.invalidate();
        // Drop the cached basket with the session. The provider's own effect
        // handles this too, but resetting here means the admin surface (which
        // does not mount CartProvider) is covered as well.
        utils.cart.get.reset();
      },
    }),
    [
      me.data,
      me.isLoading,
      loginM,
      signupM,
      verifyEmailM,
      resendM,
      logoutM,
      googleStartM,
      googleCompleteM,
      resetRequestM,
      resetCompleteM,
      utils,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
