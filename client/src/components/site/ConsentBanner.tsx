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
// CLOSING IS NOT CONSENTING. The banner can be closed - with the X, or with
// Escape - and closing records NOTHING: no choice is stored, the tag keeps the
// region default it was given, and the banner asks again on the next visit. Only
// a button records a choice. That is why the dismiss control is a separate
// handler that never touches `saveConsent`, and why the copy says plainly what
// the choices are rather than implying that dismissing the banner is one of them.
//
// ONE COMPACT BAR. The banner is a single row, so it never eats the shop: the
// copy on the left, the three answers on the right, all on the same line. The
// copy is written to break into exactly TWO lines at the width it is given, so
// the bar's height is fixed no matter what the window is.
//
// THE COLOURS ARE THE BRAND'S. The banner is drawn in the same deep rose as the
// store's top bar, with a soft sheen across it, so it reads as part of the shop
// rather than a system popup dropped on it. Everything on it is white: the
// title, the copy, the icon and all three button labels.
//
// THE BUTTONS. One weight, one height, one radius, a word each, and a clear
// hierarchy: the affirmative choice is filled with the brand's brighter rose,
// the conservative choice is outlined in white, and "Customise" is the quiet
// one. Every label is white, and the short visible label is backed by a full
// accessible name, so nothing is left ambiguous for a screen reader.
//
// NON-MODAL BY DESIGN. It does not trap focus or block the page, so a visitor can
// read the store before deciding. It is a `role="dialog"` with an accessible name
// and description, every control is a real button or checkbox, the first action
// receives focus when it appears, and Escape dismisses it for the session.
//
// REACHABLE AFTER THE FACT. The footer's "Cookie settings" link dispatches
// `CONSENT_OPEN_EVENT` (see lib/consent-ui.ts) and this component reopens in
// response, with the visitor's CURRENT choice pre-filled - so withdrawing consent
// is always one click away, on any page.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from "react";
import { Cookie, X } from "lucide-react";
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
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-white"
      />
      <label htmlFor={id} className="cursor-pointer text-xs leading-snug">
        <span className="block font-semibold text-white">{label}</span>
        <span className="mt-0.5 block text-white/70">{description}</span>
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

  // A RECORDED choice: it is stored and pushed to the tag, and the banner goes.
  const choose = useCallback((state: ConsentState) => {
    saveConsent(state);
    setVisible(false);
    setShowPrefs(false);
  }, []);

  // CLOSING. Nothing is stored and nothing is pushed, so the tag keeps the
  // default it was given (in the EEA: storage denied, cookieless measurement
  // only) and the banner asks again on the next visit. Closing is not a choice,
  // and it must never look like one.
  const dismiss = useCallback(() => {
    setVisible(false);
    setShowPrefs(false);
  }, []);

  // Escape hides the banner for this session WITHOUT recording a choice - only a
  // button decides. Nothing is stored, so the tag keeps its region default and the
  // banner asks again on the next visit.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dismiss]);

  if (!visible) return null;

  const setField = (key: keyof ConsentState) => (next: boolean) =>
    setDraft((d) => ({ ...d, [key]: (next ? "granted" : "denied") as ConsentValue }));

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      aria-describedby="consent-desc"
      className="consent-in fixed inset-x-0 bottom-0 z-[100] sm:p-4"
    >
      {/* FULL BLEED ON A PHONE, a centred card on a bigger screen. A banner that
          runs edge to edge on the device it was designed for feels native; on a
          desktop it steps back and sits over the shop. */}
      <div className="mx-auto w-full sm:max-w-5xl">
        <div className="relative overflow-hidden bg-[linear-gradient(118deg,#6d1e46_0%,#8f2557_55%,#a52c66_100%)] shadow-[0_24px_60px_-24px_rgba(109,30,70,0.7)] sm:rounded-2xl">
          {/* A sheen across the top edge, and a fine light line where the card
              meets the page - the two details that make a block of colour read
              as finished rather than flat. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.10] to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25"
          />

          {/* THE CLOSE CONTROL. It dismisses the banner WITHOUT recording a
              choice - no consent is stored, so the banner asks again next visit
              and the tag keeps the default it was given.

              `z-20` is not decoration: the card's content block is positioned
              and comes later in the DOM, so without a z-index of its own this
              button sat UNDER it - visible through its transparent padding, and
              every click landed on the content instead of the button. */}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close without choosing"
            title="Close without choosing"
            className={cn(
              "absolute right-2 top-2 z-20 grid h-7 w-7 place-items-center rounded-full",
              "text-white/80 transition-colors duration-200",
              "hover:bg-white/15 hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            )}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {/* ONE ROW. The copy on the left, the three answers on the right, both
              centred against each other, so the banner is one line tall whatever
              the window does.

              The copy keeps a FIXED width, so it breaks into exactly two lines
              instead of growing a third line when the window narrows - and it is
              allowed to SHRINK below that, because a copy that cannot fit is a
              row that overflows the card. The answers wrap to their own row
              rather than pushing past the edge, and they keep their own width
              so a label never spills out of its button. */}
          <div className="relative flex flex-col gap-3 p-4 pr-10 sm:flex-row sm:items-center sm:gap-5 sm:p-4 sm:pr-11">
            <div className="flex min-w-0 items-start gap-3">
              {/* The mark: the cookie itself, in a glassy disc, so the banner says
                  what it is about before a word is read. */}
              <span
                className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-inset ring-white/25"
                aria-hidden="true"
              >
                <Cookie className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2
                  id="consent-title"
                  className="text-[15px] font-bold leading-snug text-white sm:text-base"
                >
                  We value your privacy
                </h2>
                <p
                  id="consent-desc"
                  className="mt-1 w-[27rem] max-w-full text-[13px] leading-[1.5] text-white/75"
                >
                  We use cookies to run the store. With your consent, we also measure traffic and
                  personalise ads. See our{" "}
                  <a
                    href="/privacy"
                    className="font-semibold text-white underline underline-offset-2 hover:text-white/80"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* The three answers to one question. The LABELS are short - a word
                each, so the row stays tight and scannable - and the accessible
                name carries the full meaning, so nothing is left ambiguous for
                a screen reader. Filled, outlined, quiet: one hierarchy, and white
                text on all three. */}
            <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
              <button
                ref={firstActionRef}
                type="button"
                onClick={() => choose(GRANT_ALL)}
                aria-label="Accept all cookies"
                className="btn h-9 flex-1 border border-white/25 bg-[#d0337f] px-2 text-[10px] tracking-[0.06em] text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all duration-200 hover:-translate-y-px hover:bg-[#e04490] hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.6)] sm:flex-none sm:px-4 sm:text-[11px] sm:tracking-[0.08em]"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => choose(DENY_ALL)}
                aria-label="Reject all cookies that are not essential"
                className="btn h-9 flex-1 border border-white/45 bg-transparent px-2 text-[10px] tracking-[0.06em] text-white transition-all duration-200 hover:-translate-y-px hover:bg-white/10 sm:flex-none sm:px-4 sm:text-[11px] sm:tracking-[0.08em]"
              >
                Reject
              </button>
              {!showPrefs && (
                <button
                  type="button"
                  onClick={() => setShowPrefs(true)}
                  aria-label="Choose which cookies to allow"
                  aria-expanded={showPrefs}
                  aria-controls="consent-preferences"
                  className="btn h-9 flex-1 border border-transparent bg-transparent px-2 text-[10px] tracking-[0.06em] text-white/80 transition-all duration-200 hover:-translate-y-px hover:bg-white/10 hover:text-white sm:flex-none sm:px-4 sm:text-[11px] sm:tracking-[0.08em]"
                >
                  Customise
                </button>
              )}
            </div>
          </div>

          {/* Preferences - a tidy two-column panel, revealed only on request so the
              first thing a visitor sees stays three choices of one line each. */}
          {showPrefs && (
            <div
              id="consent-preferences"
              className="relative border-t border-white/15 bg-black/15 px-4 py-3 sm:px-5"
            >
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
                  aria-label="Save the cookie choices you made"
                  className="btn h-9 border border-white/25 bg-[#d0337f] px-4 text-[11px] tracking-[0.08em] text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all duration-200 hover:-translate-y-px hover:bg-[#e04490]"
                >
                  Save choices
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConsentBanner;
