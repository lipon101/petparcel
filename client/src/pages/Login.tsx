// Sign in. Uses the platform auth primitive via useAuth; redirects to the
// account dashboard (or back to where the shopper came from) once signed in.
import { useState, type FormEvent } from "react";
import { Link, Redirect, useSearch } from "wouter";
import { Lock, Mail } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { Section } from "@/components/site/Bits";

const field =
  "mt-1.5 h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function Login() {
  const { login, user } = useAuth();
  const search = useSearch();
  const next = new URLSearchParams(search).get("next") ?? "/account";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setError(err instanceof Error ? err.message : "We couldn't sign you in. Check your details.");
    } finally {
      setBusy(false);
    }
  }

  // Declarative redirect: the auth cache update and this render are not the same
  // tick, so an imperative navigate would hit the guard while user is still null.
  if (user) return <Redirect to={next} />;

  return (
    <Section className="!pt-12">
      <div className="mx-auto max-w-md">
        <div className="card-soft p-8">
          <h1 className="text-2xl font-extrabold">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to track orders and check out faster.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold" htmlFor="login-email">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${field} pl-9`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold" htmlFor="login-password">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${field} pl-9`}
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            New to PetParcel?{" "}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          You can also check out as a guest — no account needed.{" "}
          <Link to="/track" className="font-semibold text-primary hover:underline">
            Track an order instead
          </Link>
        </p>
      </div>
    </Section>
  );
}
