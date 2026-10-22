// The return leg of the Google sign-in.
//
// The shopper authorised on Google, the provider completed the exchange and sent
// them back here with a ONE-TIME verifier in the query string. This page's only
// job is to hand that verifier to our server (which exchanges it, with the
// challenge cookie parked when the flow started, and verifies the result) and
// then move the shopper on to where they were originally headed.
//
// Two things this page must get right, both of which were broken before:
//
//  1. The verifier is a CREDENTIAL. It is stripped from the address bar the
//     instant the page mounts - before the exchange is even attempted - so it
//     can never be bookmarked, shared, or left in the browser's history.
//
//  2. It must never spin forever. The exchange is raced against a hard timeout,
//     and every failure (expired verifier, missing challenge, transport) lands
//     on a calm message with a retry, not an endless spinner.
//
// Deliberately a full-page route rather than a popup: a popup is blocked by
// default in most browsers and breaks entirely on mobile.
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Redirect } from "wouter";
import { Loader2, RotateCw, LogIn } from "lucide-react";
import { useAuth } from "@/_core/useAuth";
import { useSeo } from "@/lib/petparcel";
import { Section } from "@/components/site/Bits";
import {
  GOOGLE_EXPIRED_MESSAGE,
  GOOGLE_FAILURE_MESSAGE,
  readSessionVerifier,
  stripSessionVerifier,
} from "@shared/google-auth";

/** How long the exchange may take before we stop waiting and offer a retry. The
 *  server's own provider call is capped at 10s, so this sits just above it. */
const EXCHANGE_TIMEOUT_MS = 12_000;

/** After the exchange hands us a destination the session cookie is set, but
 *  `auth.me` is a SEPARATE query that has to settle before we can trust it. If
 *  it is still null this long after, the session did not take - show the retry
 *  rather than spinning forever. */
const SESSION_SETTLE_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export default function GoogleCallback() {
  const { completeGoogleSignIn, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [, setAttempt] = useState(0);
  // StrictMode mounts effects twice in development; the handshake must happen
  // once per attempt, or the second run finds the stashed journey already
  // consumed and reports a failure that never happened.
  const started = useRef(false);

  useSeo({
    title: "Signing you in",
    description: "Completing your Google sign-in.",
    path: "/auth/callback",
    noindex: true,
  });

  // Strip the verifier from the URL IMMEDIATELY - synchronously, before the
  // exchange - so the credential never lingers in the address bar or history.
  // The value is captured first, then removed.
  const verifierRef = useRef<string | null>(null);
  if (verifierRef.current === null && typeof window !== "undefined") {
    verifierRef.current = readSessionVerifier(window.location.search);
    if (verifierRef.current) {
      window.history.replaceState(null, "", stripSessionVerifier(window.location.href));
    }
  }

  const run = useCallback(async () => {
    const verifier = verifierRef.current;
    if (!verifier) {
      setError(GOOGLE_EXPIRED_MESSAGE);
      return;
    }
    setError(null);
    try {
      const next = await withTimeout(completeGoogleSignIn(verifier), EXCHANGE_TIMEOUT_MS);
      setDestination(next);
    } catch {
      // Every failure collapses to one calm sentence. The reason is never shown:
      // a provider or transport message can name internals, and the shopper
      // cannot act on it anyway.
      setError(GOOGLE_FAILURE_MESSAGE);
    }
  }, [completeGoogleSignIn]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  // The exchange succeeded (we have a destination) but the session query has not
  // confirmed a user yet. Give it a moment; if it never settles, the session did
  // not take, so surface the retry instead of an endless spinner.
  useEffect(() => {
    if (!destination || user) return;
    const timer = setTimeout(() => setError(GOOGLE_FAILURE_MESSAGE), SESSION_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [destination, user]);

  // The session is established by the time we have a destination.
  if (destination && user) return <Redirect to={destination} />;

  function retry() {
    started.current = false;
    setDestination(null);
    setAttempt((n) => n + 1);
  }

  return (
    <Section className="!pt-12">
      <div className="mx-auto max-w-md">
        <div className="card-soft p-8 text-center">
          {error ? (
            <>
              <h1 className="text-2xl font-medium">Sign-in not completed</h1>
              <p role="alert" className="mt-3 text-sm text-muted-foreground">
                {error}
              </p>
              <div className="mt-6 space-y-2">
                <button type="button" onClick={retry} className="btn btn-primary btn-md w-full">
                  <RotateCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
                <Link to="/login" className="btn btn-outline btn-md w-full">
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Back to sign in
                </Link>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-hidden="true" />
              <h1 className="mt-4 text-2xl font-medium">Signing you in</h1>
              <p className="mt-2 text-sm text-muted-foreground" role="status">
                Just a moment while we finish up.
              </p>
            </>
          )}
        </div>
      </div>
    </Section>
  );
}
