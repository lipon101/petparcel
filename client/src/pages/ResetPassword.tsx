// Reset password. The shopper arrives here from the emailed link, which carries
// a one-time token in the query string. They choose a new password; the token is
// handed to the server, which completes the reset at the auth provider.
//
// The token is a credential: it is read once and never echoed back into the page.
import { useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, LogIn } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { safeErrorMessage } from "@/lib/errors";
import { Section } from "@/components/site/Bits";
import { IconButton } from "@/components/site/AuthButtons";

const field =
  "mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useSeo({
    title: "Choose a new password",
    description: "Set a new password for your PetParcel account.",
    path: "/reset-password",
    noindex: true,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        safeErrorMessage(err, "That reset link is invalid or has expired. Please request a new one."),
      );
    } finally {
      setBusy(false);
    }
  }

  const missingToken = !token;

  return (
    <Section className="!pt-12">
      <div className="mx-auto max-w-md">
        <div className="card-soft p-8">
          {done ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
              <h1 className="mt-3 text-2xl font-medium">Password updated</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your password has been changed. You can now sign in with it.
              </p>
              <Link to="/login" className="btn btn-primary btn-md mt-6 w-full">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                Sign in
              </Link>
            </>
          ) : missingToken ? (
            <>
              <h1 className="text-2xl font-medium">Link not valid</h1>
              <p role="alert" className="mt-2 text-sm text-muted-foreground">
                This reset link is missing its token. Please request a new one.
              </p>
              <Link to="/forgot-password" className="btn btn-primary btn-md mt-6 w-full">
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Request a new link
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-medium">Choose a new password</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Pick something at least 8 characters long.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold" htmlFor="new-password">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="new-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      autoComplete="new-password"
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

                <IconButton type="submit" disabled={busy} icon={<Lock />}>
                  {busy ? "Saving\u2026" : "Set new password"}
                </IconButton>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
                  Request a new link
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
