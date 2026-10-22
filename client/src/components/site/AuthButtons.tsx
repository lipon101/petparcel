// The auth surfaces' shared controls.
//
// Centralised so the sign-in and create-account pages cannot drift apart in
// spacing, icon size or label wording - the two pages sit side by side in the
// shopper's mind, and a mismatched pair reads as unfinished.
import type { ReactNode } from "react";
import { GoogleMark } from "@/lib/google-icons";

/** The Google sign-in affordance.
 *
 *  Uses the real four-colour mark (Google's brand terms require it on a
 *  "Continue with Google" control) and keeps the label as the accessible name -
 *  the mark itself is `aria-hidden`. `aria-busy` is set while the provider is
 *  being asked for a URL, so a screen reader announces the wait. */
export function GoogleSignInButton({
  onClick,
  busy,
  disabled,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy ? true : undefined}
      className="btn btn-outline btn-md auth-google w-full"
    >
      <GoogleMark className="auth-google-mark" />
      <span>{busy ? "Connecting to Google…" : "Continue with Google"}</span>
    </button>
  );
}

/** The "or" rule between the two ways in. A plain hairline with a centred word -
 *  decorative, so the whole thing is hidden from assistive technology. */
export function OrDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="auth-or" aria-hidden="true">
      <span className="auth-or-line" />
      <span className="auth-or-text">{label}</span>
      <span className="auth-or-line" />
    </div>
  );
}

/** A button holding an icon and a label, with the icon kept out of the
 *  accessible name so the label is announced once. */
export function IconButton({
  icon,
  children,
  className = "btn btn-primary btn-md w-full",
  ...rest
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={className} {...rest}>
      <span className="auth-btn-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </button>
  );
}
