import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";

// Typed tRPC client. `AppRouter` is a TYPE-ONLY import from the server, so the
// whole API is end-to-end typed without shipping server code to the browser.
export const trpc = createTRPCReact<AppRouter>();

// ── Why this fetch wrapper exists ───────────────────────────────────────────
// The tRPC link parses whatever it is handed with `superjson.parse(...)`, which
// is a `JSON.parse` underneath. When the API answers with something that is NOT
// a tRPC payload - an HTML/plain-text error page from the host, a CDN 404, a
// proxy failure - the parser throws a raw SyntaxError and that string was shown
// to the shopper verbatim. The real report was:
//
//     Unexpected token 'T', "The page c"... is not valid JSON
//
// which was Vercel's plain-text 404 body ("The page could not be found") being
// fed to JSON.parse. Two things were wrong at once: the client trusted the
// body's type, and the resulting message named a JavaScript parser instead of
// the actual problem.
//
// This wrapper is the fix for the first half: it inspects the response before
// the link can parse it, and turns anything that is not a JSON response into a
// clear, human error naming the real condition. It is deliberately the ONLY
// place that inspects the wire format - every call in the app goes through it.
const SERVER_UNREACHABLE_MESSAGE =
  "PetParcel's server isn't responding right now. Please try again in a moment.";

/** Whether a response body can safely be handed to the tRPC parser.
 *
 *  A JSON content-type is the signal we require - the app's API always answers
 *  with one. The empty-content-type case is allowed through as well: some hosts
 *  omit it on a 204/no-content reply, and the link already handles an empty body
 *  without parsing it.
 */
function isJsonLike(res: Response): boolean {
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!type) return true;
  return type.includes("application/json") || type.includes("+json");
}

/** A fetch that never lets a non-JSON body reach the tRPC parser.
 *
 *  On a non-JSON response it throws a plain `Error` whose message is written for
 *  the shopper. The tRPC link catches a thrown fetch error and rethrows it as a
 *  `TRPCClientError`, so the page's `safeErrorMessage` shows this wording instead
 *  of a parser stack. `response.ok` is checked too, purely so the log records
 *  the status - an HTML error page is the interesting case and it is usually NOT
 *  4xx/5xx at the transport level once a proxy is involved.
 */
async function jsonOnlyFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (isJsonLike(res)) return res;

  // Not a tRPC payload. Read a short prefix for the console so an operator can
  // tell a stale deployment from a real outage, then fail with the safe copy.
  // The body never reaches the UI - only this fixed sentence does.
  let snippet = "";
  try {
    snippet = (await res.clone().text()).slice(0, 160);
  } catch {
    /* body already consumed or unreadable - the message below still applies */
  }
  // eslint-disable-next-line no-console
  console.error(
    `[trpc] non-JSON API response (status ${res.status}, ${res.headers.get("content-type") ?? "no content-type"}) - the API is not reachable at this origin.`,
    snippet,
  );
  throw new Error(SERVER_UNREACHABLE_MESSAGE);
}

export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/trpc",
        transformer: superjson,
        // Replaces the link's default `fetch`. Everything else - the batching,
        // the headers, the cookie policy - is unchanged.
        fetch: jsonOnlyFetch as typeof fetch,
      }),
    ],
  });
}
