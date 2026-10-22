// A tiny async-data hook for the admin panel. Every page loads its list through
// this, so loading / error / refetch behave identically everywhere without
// pulling in a data-fetching library for what is a handful of in-memory (or
// tRPC) calls.
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Run `fn` on mount and whenever `deps` change; expose data/loading/error and a
 *  manual refetch. Late results from a superseded run are discarded, so a fast
 *  refetch can never be overwritten by a slow earlier one. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const runId = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoFn = useCallback(fn, deps);

  useEffect(() => {
    const id = ++runId.current;
    let alive = true;
    setIsLoading(true);
    setError(null);
    memoFn()
      .then((result) => {
        if (!alive || id !== runId.current) return;
        setData(result);
      })
      .catch((e: unknown) => {
        if (!alive || id !== runId.current) return;
        setError(e instanceof Error ? e.message : "Something went wrong.");
      })
      .finally(() => {
        if (!alive || id !== runId.current) return;
        setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [memoFn, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data, isLoading, error, refetch };
}
