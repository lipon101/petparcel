// Email verification landing page. The signup flow emails a link to
// /verify-email?token=…; this page redeems it once and reports the outcome.
import { useEffect, useRef, useState } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2, MailCheck, Send, UserRound, XCircle } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { Section } from "@/components/site/Bits";

type State =
  | { kind: "verifying" }
  | { kind: "verified"; email: string }
  | { kind: "error"; message: string };

export default function VerifyEmail() {
  const { verifyEmail, resendVerification } = useAuth();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "verifying" });
  const [resendEmail, setResendEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  // Guard against React 19's double-invoked effects in dev: the token is
  // single-use, so a second redeem would report "already used".
  const started = useRef(false);

  useSeo({
    title: "Verify your email",
    description: "Confirm your email address to finish setting up your PetParcel account.",
    path: "/verify-email",
    noindex: true,
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState({ kind: "error", message: "This link is missing its verification token." });
      return;
    }
    verifyEmail(token)
      .then((res) => setState({ kind: "verified", email: res.email }))
      .catch((err) =>
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "We couldn't verify that link.",
        }),
      );
  }, [token, verifyEmail]);

  async function onResend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await resendVerification(resendEmail);
      setResent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section className="!pt-12">
      <div className="mx-auto max-w-md">
        <div className="card-soft p-8 text-center">
          {state.kind === "verifying" && (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-primary">
                <MailCheck className="h-6 w-6" />
              </span>
              <h1 className="mt-4 text-2xl font-medium">Verifying your email…</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">One moment.</p>
            </>
          )}

          {state.kind === "verified" && (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h1 className="mt-4 text-2xl font-medium">Email verified</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Thanks - <span className="font-semibold text-foreground">{state.email}</span> is now
                confirmed. Your account is fully set up.
              </p>
              <Link to="/account" className="btn btn-primary btn-md mt-6 inline-flex items-center gap-2">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Go to your account
              </Link>
            </>
          )}

          {state.kind === "error" && (
            <>
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <XCircle className="h-7 w-7" />
              </span>
              <h1 className="mt-4 text-2xl font-medium">We couldn't verify that link</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{state.message}</p>

              {resent ? (
                <p className="mt-6 rounded-sm bg-secondary/60 px-3 py-2 text-sm font-semibold text-foreground">
                  If that address has an unverified account, a fresh link is on its way.
                </p>
              ) : (
                <form onSubmit={onResend} className="mt-6 space-y-3 text-left">
                  <label className="block text-sm font-semibold" htmlFor="verify-email">
                    Send me a new link
                  </label>
                  <input
                    id="verify-email"
                    type="email"
                    required
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11 w-full rounded-sm border border-input bg-card px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button type="submit" disabled={busy} className="btn btn-primary btn-md w-full">
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {busy ? "Sending…" : "Resend verification email"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
