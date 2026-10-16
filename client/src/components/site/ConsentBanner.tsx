// ─────────────────────────────────────────────────────────────────────────────
// Cookie consent banner (EEA / GDPR) - the UI half of Consent Mode v2.
//
// The `default` consent state lives in client/index.html (storage denied in the
// EEA/UK/CH, granted elsewhere, with `wait_for_update: 500`). This banner is what
// turns that default into a real choice: it shows once, to a visitor who has not
// chosen yet, and on a choice it calls `saveConsent(...)` - which persists the
// decision AND pushes `gtag('consent', 'update', ...)` so GA4 and Google Ads
// switch from cookieless to full measurement (or stay denied) immediately,
// without a reload.
//
// NON-MODAL BY DESIGN. It does not trap focus or block the page, so a visitor can
// read the store before deciding. It is a `role="dialog"` with an accessible name
// and description, every control is a real button or checkbox, the first action
// receives focus when it appears, and Escape dismisses it for the session (the
// choice itself is never implied by closing - only a button records one).
//
// REACHABLE AFTER THE FACT. The footer's "Cookie settings" link dispatches
// `CONSENT_OPEN_EVENT` (see lib/consent-ui.ts) and this component reopens in
// response, with the visitor's CURRENT choice pre-filled - so withdrawing consent
// is always one click away, on any page.
//
// LAYOUT. Compact and horizontal on desktop (copy left, actions right) so it does
// not cover the shop, stacked and full-width on mobile where thumbs are. The
// three actions keep one visual hierarchy - primary, outline, ghost - at a
// uniform height, so the choice is legible at a glance rather than a wall of
// equally-weighted buttons.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { Cookie } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONSENT_OPEN_EVENT } from "@/lib/consent-ui";
import {
  DENY_ALL,
  GRANT_ALL,
  readStoredConsent,
  saveConsent,
  type ConsentState,
  type ConsentValue,
} from "@/lib/analytics";

/** One toggle row in the preferences view. */
function ConsentToggle({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--primary)]"
      />
      <label htmlFor={id} className="cursor-pointer text-xs leading-snug">
        <span className="block font-semibold text-foreground">{label}</span>
        <span className="mt-0.5 block text-muted-foreground">{description}</span>
      </label>
    </div>
  );
}

export function ConsentBanner() {
  // `visible` is driven by TWO things: no stored choice on mount (ask them), or an
  // explicit reopen request from the footer (let them change their mind).
  const [visible, setVisible] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [draft, setDraft] = useState<ConsentState>(DENY_ALL);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  // Decide on mount (localStorage is unavailable during SSR/first paint), so a
  // returning visitor never sees a flash of the banner they already answered.
  useEffect(() => {
    const stored = readStoredConsent();
    if (stored) setDraft(stored);
    setVisible(stored === null);
  }, []);

  // Reopen on request, pre-filled with what the visitor already chose. Opening
  // straight into the preferences panel matches the intent of a "Cookie settings"
  // click - they came to change something, not to be asked again.
  useEffect(() => {
    const onOpen = () => {
      setDraft(readStoredConsent() ?? DENY_ALL);
      setShowPrefs(true);
      setVisible(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
  }, []);

  // Move focus to the first action once the banner is actually on screen, so a
  // keyboard user lands on it instead of tabbing in from the top of the page.
  useEffect(() => {
    if (visible) firstActionRef.current?.focus();
  }, [visible]);

  const choose = useCallback((state: ConsentState) => {
    saveConsent(state);
    setVisible(false);
    setShowPrefs(false);
  }, []);

  // Escape hides the banner for this session WITHOUT recording a choice - only a
  // button decides. Nothing is stored, so the tag keeps its region default and the
  // banner asks again on the next visit.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible) return null;

  const setField = (key: keyof ConsentState) => (next: boolean) =>
    setDraft((d) => ({ ...d, [key]: (next ? "granted" : "denied") as ConsentValue }));

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
      className="consent-in fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4"
    >
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        {/* Copy left, actions right on desktop; stacked on mobile. */}
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground sm:flex"
              aria-hidden="true"
            >
              <Cookie className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 id="consent-title" className="text-sm font-semibold text-foreground sm:text-[15px]">
                We value your privacy
              </h2>
              <p
                id="consent-desc"
                className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-[13px]"
              >
                We use cookies to run the store and, with your consent, to measure traffic and
                personalise ads. You can accept all, reject everything that is not essential, or
                choose what to allow. See our{" "}
                <a
                  href="/privacy"
                  className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>

          <div
            className={cn(
              "flex shrink-0 flex-col gap-2",
              "sm:flex-row sm:flex-wrap sm:items-center",
              "lg:flex-nowrap lg:justify-end",
            )}
          >
            <button
              ref={firstActionRef}
              type="button"
              onClick={() => choose(GRANT_ALL)}
              className="btn btn-primary btn-md w-full sm:w-auto"
            >
              Accept all
            </button>
            <button
              type="button"
              onClick={() => choose(DENY_ALL)}
              className="btn btn-outline btn-md w-full sm:w-auto"
            >
              Reject non-essential
            </button>
            {!showPrefs && (
              <button
                type="button"
                onClick={() => setShowPrefs(true)}
                aria-expanded={showPrefs}
                aria-controls="consent-preferences"
                className="btn btn-ghost btn-md w-full sm:w-auto"
              >
                Preferences
              </button>
            )}
          </div>
        </div>

        {/* Preferences - a tidy two-column panel, revealed only on request so the
            first thing a visitor sees stays three choices of one line each. */}
        {showPrefs && (
          <div id="consent-preferences" className="border-t border-border bg-secondary/40 px-4 py-3 sm:px-5">
            <div className="grid gap-x-6 sm:grid-cols-2">
              <ConsentToggle
                id="consent-analytics"
                label="Analytics"
                description="Helps us understand how the store is used so we can improve it."
                checked={draft.analytics_storage === "granted"}
                onChange={setField("analytics_storage")}
              />
              <ConsentToggle
                id="consent-ads"
                label="Advertising"
                description="Lets us measure ad performance and show more relevant ads."
                checked={draft.ad_storage === "granted"}
                onChange={setField("ad_storage")}
              />
              <ConsentToggle
                id="consent-ad-user-data"
                label="Ad personalisation data"
                description="Allows your activity to inform the ads you see on other sites."
                checked={draft.ad_user_data === "granted"}
                onChange={setField("ad_user_data")}
              />
              <ConsentToggle
                id="consent-ad-personalization"
                label="Personalised advertising"
                description="Uses your activity to tailor advertising to your interests."
                checked={draft.ad_personalization === "granted"}
                onChange={setField("ad_personalization")}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => choose(draft)}
                className="btn btn-primary btn-md w-full sm:w-auto"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConsentBanner;
