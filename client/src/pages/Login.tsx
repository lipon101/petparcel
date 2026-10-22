// Sign in. Uses the platform auth primitive via useAuth; redirects to the
// account dashboard (or back to where the shopper came from) once signed in.
//
// Two ways in, both first-class: a password, and Google. Google is the one we
// steer people toward when they have forgotten their password - it costs the
// store nothing to send and gets the shopper straight to their orders.
import { useState, type FormEvent } from "react";
import { Link, Redirect, useSearch } from "wouter";
import { Eye, EyeOff, Lock, LogIn, Mail, UserPlus } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { safeErrorMessage } from "@/lib/errors";
import { Section } from "@/components/site/Bits";
import { GoogleSignInButton, IconButton, OrDivider } from "@/components/site/AuthButtons";
import { GOOGLE_FAILURE_MESSAGE } from "@shared/google-auth";

const field =
  "mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

/** Only same-site, shopper-facing destinations may be carried through sign-in.
 *  A strict allow-list beats a denylist here: it rules out an open redirect and
 *  makes it impossible to use this parameter to probe for a non-public surface.
 *
 *  The store's management area is DELIBERATELY NOT on the list (and is not
 *  allowed through any other branch): the admin panel has its own dedicated
 *  sign-in, so the customer login can never be used to bounce anyone - shopper or
 *  admin - into an admin route. Anything else falls back to the account page. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/account";
  const path = raw.split(/[?#]/)[0];
  const allowed = [
    "/account",
    "/order",
    "/track",
    "/cart",
    "/checkout",
    "/wishlist",
    "/contact",
    "/product",
    "/shop",
  ];
  return allowed.some((p) => path === p || path.startsWith(`${p}/`)) ? raw : "/account";
}

export default function Login() {
  const { login, startGoogleSignIn, user } = useAuth();
  const search = useSearch();
  const next = safeNext(new URLSearchParams(search).get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useSeo({
    title: "Sign In",
    description: "Sign in to your PetParcel account to see your orders, tracking and saved addresses.",
    path: "/login",
    noindex: true,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(safeErrorMessage(err, "We couldn't sign you in. Check your details and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setGoogleBusy(true);
    try {
      // On success the browser is already leaving for Google, so this only
      // returns on a failure.
      await startGoogleSignIn(next);
    } catch {
      setError(GOOGLE_FAILURE_MESSAGE);
      setGoogleBusy(false);
    }
  }

  // Declarative redirect: the auth cache update and this render are not the same
  // tick, so an imperative navigate would hit the guard while user is still null.
  if (user) return <Redirect to={next} />;

  return (
    <Section className="!pt-12">
      <div className="mx-auto max-w-md">
        <div className="card-soft p-8">
          <h1 className="text-2xl font-medium">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to track orders and check out faster.
          </p>

          <div className="mt-6">
            <GoogleSignInButton onClick={onGoogle} busy={googleBusy} disabled={busy} />
          </div>

          <OrDivider />

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold" htmlFor="login-email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${field} pl-9`}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold" htmlFor="login-password">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${field} pl-9 pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 mt-[3px] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-sm bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <IconButton type="submit" disabled={busy} icon={<LogIn />}>
              {busy ? "Signing in…" : "Sign in"}
            </IconButton>
          </form>

          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-muted-foreground">
            New to PetParcel?
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your account keeps every order, its tracking and your addresses in one
          place. Already ordered?{" "}
          <Link to="/track" className="font-semibold text-primary hover:underline">
            Track it by number
          </Link>
        </p>
      </div>
    </Section>
  );
}
