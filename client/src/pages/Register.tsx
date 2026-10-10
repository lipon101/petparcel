// Create an account. Optional for shopping (guest checkout is supported), but
// it keeps order history and saved addresses in one place.
import { useState, type FormEvent } from "react";
import { Link, Redirect } from "wouter";
import { Check } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { Section } from "@/components/site/Bits";

const field =
  "mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function Register() {
  const { signup, user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      await signup(email, password, name || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't create that account.");
    } finally {
      setBusy(false);
    }
  }

  if (user) return <Redirect to="/account" />;

  return (
    <Section className="!pt-12">
      <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-2">
        <div className="card-soft p-8">
          <h1 className="text-2xl font-medium">Create your account</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">It takes about ten seconds.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold" htmlFor="reg-name">
                Name
              </label>
              <input
                id="reg-name"
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
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
                placeholder="At least 8 characters"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-sm bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary btn-md w-full"
            >
              {busy ? "Creating your account…" : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
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
              <li key={line} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-muted-foreground">{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-lg bg-secondary/60 p-4 text-xs leading-relaxed text-muted-foreground">
            You don't have to register to shop. Guest checkout is fully supported — you'll still get an order
            number you can track any time.
          </p>
        </div>
      </div>
    </Section>
  );
}
