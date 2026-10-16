// Cloudflare Turnstile widget for the storefront's public forms.
//
// WHY A COMPONENT AND NOT A SCRIPT TAG. The widget must (a) only load when a
// site key is configured, (b) hand the token to the form that owns the submit,
// and (c) reset after a failed submit so the shopper can retry. A bare script
// tag in index.html can do none of those, and it would load Cloudflare's JS on
// every page for a control only two forms use.
//
// NO-OP WHEN UNCONFIGURED. With no `VITE_TURNSTILE_SITE_KEY` this renders
// nothing and reports an empty token, so the forms behave exactly as before
// until the key is set - matching the server's fail-open rule in
// `server/_core/turnstile.ts`. The site key is PUBLIC (it is meant to be in the
// page), so shipping it via Vite's `import.meta.env` is correct; the SECRET
// never leaves the server.
import { useEffect, useRef, useState } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** The public site key, or "" when Turnstile has not been configured. */
export function turnstileSiteKey(): string {
  return (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

/** Load Cloudflare's script once, shared by every widget on the page. */
let scriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({
  onToken,
  resetKey = 0,
}: {
  /** Called with the token, or "" when the widget is unconfigured/expired. */
  onToken: (token: string) => void;
  /** Change this to force a fresh challenge (e.g. after a failed submit). */
  resetKey?: number;
}) {
  const siteKey = turnstileSiteKey();
  const ref = useRef<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey) return; // unconfigured - render nothing, report nothing
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        if (widgetId.current) window.turnstile.remove(widgetId.current);
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (token) => onToken(token),
          "error-callback": () => {
            setFailed(true);
            onToken("");
          },
          "expired-callback": () => onToken(""),
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
    // `onToken` is intentionally not a dependency: it is a fresh closure each
    // render and re-rendering the widget on every keystroke would reset the
    // challenge. The widget is (re)built only when the key or resetKey changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, resetKey]);

  if (!siteKey) return null;
  return (
    <div className="mt-1">
      <div ref={ref} />
      {failed && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          The human check couldn't load. Refresh the page to try again.
        </p>
      )}
    </div>
  );
}
