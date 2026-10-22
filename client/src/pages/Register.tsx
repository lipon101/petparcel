// Create an account. Optional for shopping (guest checkout is supported), but
// it keeps order history and saved addresses in one place.
import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { Check, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { safeErrorMessage } from "@/lib/errors";
import { Section } from "@/components/site/Bits";
import { GoogleSignInButton, IconButton, OrDivider } from "@/components/site/AuthButtons";
import { Turnstile } from "@/components/site/Turnstile";
import { GOOGLE_FAILURE_MESSAGE } from "@shared/google-auth";

const field =
  "mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function Register() {
  const { signup, startGoogleSignIn, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // Cloudflare Turnstile: the token is empty until the widget solves (and stays
  // empty when no site key is configured, in which case the server check is a
  // no-op too). `turnstileReset` forces a fresh challenge after a failed submit.
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  useSeo({
    title: "Create an Account",
    description:
      "Create a PetParcel account to save addresses, track orders and reorder your pet's favorites faster.",
    path: "/register",
    noindex: true,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { signedIn } = await signup(email, password, name || undefined, turnstileToken);
      // The account was created. If the session could not be established (a
      // deployment missing JWT_SECRET, say) say so plainly and point at sign-in
      // rather than showing a misleading failure.
      if (!signedIn) {
        setNotice(
          "Your account was created, but we couldn't sign you in automatically. Please sign in to continue.",
        );
      }
    } catch (err) {
      setError(safeErrorMessage(err, "We couldn't create that account. Please try again."));
      // A Turnstile token is single-use: refresh the challenge so a retry is not
      // rejected for reusing a spent token.
      setTurnstileToken("");
      setTurnstileReset((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setNotice(null);
    setGoogleBusy(true);
    try {
      // A Google account is created on first sign-in, so this is genuinely a way
      // to create one; the shopper lands on their account either way.
      await startGoogleSignIn("/account");
    } catch {
      setError(GOOGLE_FAILURE_MESSAGE);
      setGoogleBusy(false);
    }
  }

  if (user) return <Redirect to="/account" />;

  return (
    <Section className="!pt-12">
      <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-2">
        <div className="card-soft p-8">
          <h1 className="text-2xl font-medium">Create your account</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">It takes about ten seconds.</p>

          <div className="mt-6">
            <GoogleSignInButton onClick={onGoogle} busy={googleBusy} disabled={busy} />
          </div>

          <OrDivider />

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold" htmlFor="reg-name">
                Name
              </label>
              <input
                id="reg-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold" htmlFor="reg-email">
                Email
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold" htmlFor="reg-password">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${field} pr-11`}
                  placeholder="At least 8 characters"
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

            {notice && (
              <p role="status" className="rounded-sm bg-secondary px-3 py-2 text-sm font-semibold text-foreground">
                {notice}{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            )}

            <Turnstile onToken={setTurnstileToken} resetKey={turnstileReset} />

            <IconButton type="submit" disabled={busy} icon={<UserPlus />}>
              {busy ? "Creating your account…" : "Create account"}
            </IconButton>
          </form>

          <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm text-muted-foreground">
            Already have an account?
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </Link>
          </p>
        </div>

        <div className="lg:pt-8">
          <h2 className="text-lg font-medium">Why make an account?</h2>
          <ul className="mt-4 space-y-3">
            {[
              "See every order and its live delivery status in one place.",
              "Save shipping addresses so checkout takes seconds.",
              "Re-order your pet's favorites without hunting through the catalog.",
              "Leave verified reviews on products you've bought.",
            ].map((line) => (
              <li key={line} className="flex items-center gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
                <span className="whitespace-nowrap text-muted-foreground">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
