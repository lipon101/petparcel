// Forgot password. One field, one button, one calm confirmation.
//
// The store never reveals whether an address has an account: the server answers
// the same way either way, and so does this page. The reset link itself is sent
// by the auth provider (Neon Auth), which owns the credential.
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { safeErrorMessage } from "@/lib/errors";
import { Section } from "@/components/site/Bits";
import { IconButton } from "@/components/site/AuthButtons";

const field =
  "mt-1.5 h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useSeo({
    title: "Reset your password",
    description: "Request a password reset link for your PetParcel account.",
    path: "/forgot-password",
    noindex: true,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(safeErrorMessage(err, "We couldn't send that just now. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section className="!pt-12">
      <div className="mx-auto max-w-md">
        <div className="card-soft p-8">
          {sent ? (
            <>
              <h1 className="text-2xl font-medium">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for <span className="font-semibold text-foreground">{email}</span>,
                we&apos;ve sent a link to reset your password. It may take a minute to arrive - check
                your spam folder if you don&apos;t see it.
              </p>
              <Link to="/login" className="btn btn-outline btn-md mt-6 w-full">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-medium">Reset your password</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter the email you signed up with and we&apos;ll send you a link to choose a new
                password.
              </p>

              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold" htmlFor="reset-email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 mt-[3px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="reset-email"
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

                {error && (
                  <p role="alert" className="rounded-sm bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                    {error}
                  </p>
                )}

                <IconButton type="submit" disabled={busy} icon={<KeyRound />}>
                  {busy ? "Sending\u2026" : "Send reset link"}
                </IconButton>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Remembered it?{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
