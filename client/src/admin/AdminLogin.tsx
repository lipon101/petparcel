// The DEDICATED admin sign-in, rendered IN PLACE at the admin root.
//
// This is deliberately NOT the storefront's customer login (`/login`). The admin
// door is:
//   * visually and functionally its own surface - a clean, light, brand-graded
//     console with none of the shopper chrome, so it can never be mistaken for
//     a customer page,
//   * at a path the storefront never links to and search engines are told to
//     ignore (`noindex`),
//   * answered by `adminAuth.login` on the server, which refuses ANY account
//     that is not the store's single designated admin - so a normal shopper's
//     correct password is still rejected here, and no session is ever minted
//     for it.
//
// It renders no panel data, no panel chrome and no link to (or from) the
// storefront. A visitor only reaches it by opening the admin root while signed
// out (the gate renders it) or by typing the URL - and it reveals nothing about
// the panel beyond the fact that a management door exists.
import { useState, type FormEvent } from "react";
import { Redirect } from "wouter";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  Fingerprint,
  LoaderCircle,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { adminPath } from "@/_core/admin-path";
import { trpc } from "@/_core/trpc";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import {
  ADMIN_LOGIN_REFUSED,
  attemptsRemaining,
  classifyAdminLoginError,
} from "./login-message";

export function AdminLogin() {
  const utils = trpc.useUtils();
  // The SAME session source the panel's gate reads (`useAuth` -> `auth.me`), so
  // the two can never disagree: once this reports an admin, the gate lets the
  // panel render. Reading a different query here would let the login page send
  // the admin to the panel while the gate still saw a signed-out session - an
  // infinite redirect loop.
  const { user } = useAuth();
  const loginM = trpc.adminAuth.login.useMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [failures, setFailures] = useState(0);
  const [error, setError] = useState<{ locked: boolean; message: string } | null>(null);

  useSeo({
    title: "Admin sign in",
    description: "Store management sign in.",
    path: adminPath("login"),
    noindex: true,
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loginM.isPending) return; // never double-submit
    setError(null);
    try {
      await loginM.mutateAsync({ email: email.trim(), password });
      // Refresh the session the GATE reads, not just the admin one - otherwise
      // the gate would still see a signed-out session and bounce us back here.
      await utils.auth.me.invalidate();
      await utils.adminAuth.me.invalidate();
    } catch (err) {
      // One non-revealing sentence for every rejection; a tripped lockout is
      // shown as a warning rather than as a credential mistake. The raw error is
      // never printed to the page (or the console).
      const info = classifyAdminLoginError(err, ADMIN_LOGIN_REFUSED);
      setFailures((n) => n + 1);
      setError({ locked: info.locked, message: info.message });
    }
  }

  // Only the ONE designated admin is ever sent on to the panel; a signed-in
  // non-admin has nothing to do here and is left on the form (with the server's
  // refusal shown if they try).
  if (user?.role === "admin") return <Redirect to={adminPath()} />;

  const pending = loginM.isPending;

  return (
    <div className="al-shell">
      <div className="al-card-wrap">
        <div className="al-card">
          <div className="al-lockup">
            <span className="al-mark" aria-hidden="true">
              <ShieldCheck className="h-6 w-6" strokeWidth={1.9} />
            </span>
            <span className="al-wordmark">
              Pet<span className="brand-accent">Parcel</span>
            </span>
            <span className="al-kicker">
              <Fingerprint className="h-3 w-3" aria-hidden="true" /> Store management
            </span>
            <h1 className="al-heading">Sign in to management</h1>
            <p className="al-sub">
              The owner's private console. Authorised personnel only.
            </p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="al-field">
              <label className="al-label" htmlFor="admin-email">
                Email
              </label>
              <div className="al-control">
                <Mail className="al-control-ic" aria-hidden="true" />
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  spellCheck={false}
                  autoCapitalize="none"
                  disabled={pending}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="al-input"
                />
              </div>
            </div>

            <div className="al-field">
              <label className="al-label" htmlFor="admin-password">
                Password
              </label>
              <div className="al-control">
                <Lock className="al-control-ic" aria-hidden="true" />
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  disabled={pending}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="al-input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  className="al-reveal"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className={`al-error${error.locked ? " is-locked" : ""}`}
              >
                {error.locked ? (
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{error.message}</span>
              </div>
            )}

            <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary btn-md al-submit">
              {pending ? (
                <>
                  <LoaderCircle className="al-spin h-4 w-4" aria-hidden="true" /> Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Sign in to management
                </>
              )}
            </button>
          </form>

          <div className="al-foot">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {error?.locked ? (
              <span>
                Locked for a few minutes · {attemptsRemaining(failures)} attempt
                {attemptsRemaining(failures) === 1 ? "" : "s"} left in this window
              </span>
            ) : attemptsRemaining(failures) < 5 ? (
              <span>
                {attemptsRemaining(failures)} attempt
                {attemptsRemaining(failures) === 1 ? "" : "s"} left before lockout
              </span>
            ) : (
              <span>Encrypted session · single-owner access</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
