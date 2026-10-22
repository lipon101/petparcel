// ── The "last order" recovery store ──────────────────────────────────────────
//
// THE BUG THIS FILE FIXES. A shopper places an order, is handed to NOWPayments'
// hosted checkout, and then comes back to the store - via the browser back
// button, the provider's "return to store" link, or by reopening the tab. If
// they land on `/checkout` the page found an EMPTY cart and rendered
// "There's nothing to check out", with no order number, no status and no way to
// pay. The order was never lost on the server - it was simply unreachable from
// the page the shopper was looking at.
//
// WHY THE CART IS EMPTY, AND WHY THAT IS CORRECT. The basket is a server-owned
// resource that is cleared the moment the order is placed (the items now belong
// to the ORDER, not the cart). Clearing it is right; treating "empty cart" as
// "no order" is what was wrong. So the fix is not to keep the cart around - it
// is to remember WHICH ORDER was just placed, so the shopper can be returned to
// its real status page.
//
// WHAT IS STORED. Only the order number and the email it was placed with - the
// same two facts the order page already needs to identify the requester (see
// `orders.lookup`). No price, no address, no token: this is a convenience
// pointer, not a credential, and the server still authorises every read.
//
// WHY localStorage AND NOT THE URL. The order number must survive a redirect to
// a third-party host (NOWPayments) and back, which a query string on our own
// return URL cannot guarantee - the provider decides where it sends the browser.
// localStorage is the one place that survives that round trip, a full page
// reload, and a fresh tab.
//
// EXPIRY. A pointer is only useful for a short while after checkout, and a stale
// one would hijack a later, genuinely-empty visit to /checkout. It therefore
// expires (see LAST_ORDER_TTL_MS) and is ignored once past that.

/** The localStorage key. Kept identical to the value the checkout page has
 *  always written, so an order placed by an already-deployed client is still
 *  recoverable after this ships. */
export const LAST_ORDER_KEY = "petparcel_last_order";

/**
 * How long a remembered order stays recoverable. Long enough to cover a slow
 * crypto confirmation and a shopper who comes back the next day; short enough
 * that it cannot hijack an unrelated visit to /checkout a week later.
 */
export const LAST_ORDER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LastOrder {
  /** The order's public reference, e.g. `PP-5VJGT7AS`. */
  orderNumber: string;
  /** The email the order was placed with, so the order page can identify the
   *  requester without asking them to retype it. */
  email: string;
  /** When it was remembered, in epoch milliseconds. */
  at: number;
}

/** The subset of the Storage API this module needs, so a test can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The browser's localStorage, or null when it is unavailable.
 *
 * Access is wrapped because reading `window.localStorage` can THROW rather than
 * return null - Safari in private mode, and any browser with storage disabled,
 * both do. A recovery pointer is a convenience; it must never be able to break
 * the checkout page, so every failure here degrades to "no remembered order".
 */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Normalize an order number for storage and comparison. A non-string value is
 *  rejected outright rather than coerced - `String(123)` would otherwise turn a
 *  numeric id into a plausible-looking order reference. */
function normalizeOrderNumber(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

/**
 * Parse a stored value into a `LastOrder`, or null when it is missing,
 * malformed, or expired.
 *
 * Deliberately strict: anything that is not a well-formed, unexpired record is
 * treated as absent. A half-written or hand-edited value must not be able to
 * send the shopper to a bogus order URL.
 */
export function parseLastOrder(raw: string | null | undefined, now: number = Date.now()): LastOrder | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Partial<LastOrder>;
  const orderNumber = normalizeOrderNumber(record.orderNumber);
  if (!orderNumber) return null;
  const email = typeof record.email === "string" ? record.email.trim() : "";
  // `at` is required for expiry. A record without one (written by an older
  // client) is treated as just-now rather than discarded, so an order placed
  // moments before this shipped is still recoverable.
  const at = typeof record.at === "number" && Number.isFinite(record.at) ? record.at : now;
  if (now - at > LAST_ORDER_TTL_MS) return null;
  return { orderNumber, email, at };
}

/** Serialize a record for storage. */
export function serializeLastOrder(order: LastOrder): string {
  return JSON.stringify({
    orderNumber: normalizeOrderNumber(order.orderNumber),
    email: order.email,
    at: order.at,
  });
}

/** Read the remembered order, or null when there is none (or it has expired). */
export function readLastOrder(
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): LastOrder | null {
  if (!storage) return null;
  try {
    return parseLastOrder(storage.getItem(LAST_ORDER_KEY), now);
  } catch {
    return null;
  }
}

/**
 * Remember the order that was just placed. Called BEFORE the browser is handed
 * to the payment provider, so the reference is already durable by the time the
 * shopper can possibly come back.
 *
 * Returns the record that was written, or null when storage is unavailable -
 * the caller does not need to care, but a test can assert on it.
 */
export function rememberLastOrder(
  orderNumber: string,
  email: string,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): LastOrder | null {
  const normalized = normalizeOrderNumber(orderNumber);
  if (!normalized) return null;
  const record: LastOrder = { orderNumber: normalized, email: String(email ?? "").trim(), at: now };
  if (!storage) return record;
  try {
    storage.setItem(LAST_ORDER_KEY, serializeLastOrder(record));
  } catch {
    /* storage full or blocked - the order page can still ask for the email */
  }
  return record;
}

/** Forget the remembered order. */
export function clearLastOrder(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(LAST_ORDER_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The in-app path of an order's status page. */
export function lastOrderPath(orderNumber: string): string {
  return `/order/${encodeURIComponent(normalizeOrderNumber(orderNumber))}`;
}
