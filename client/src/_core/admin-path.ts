// Where this store's management surface lives.
//
// The requirement is that the path is not discoverable by anyone who downloads
// the public JavaScript bundle and greps it - which is the classic way a
// "secret" admin URL leaks. A plain string literal fails that immediately, and
// so does a `String.fromCharCode(108, 111, ...)` literal: the minifier folds
// that constant back into a readable string during the production build. So the
// segment is stored as XOR-obfuscated hex and decoded at runtime, which no
// bundler can fold away.
//
// HOW TO CHANGE THE PATH
//   1. pick the new segment, e.g. "mysecret"
//   2. for each character, XOR its char code with KEY below, then hex-encode the
//      result, and paste the concatenated hex into ENCODED_SEGMENT
//   3. nothing else needs to change - every admin route and link reads the value
//      from here (see ADMIN_ROOT / adminPath), so this file is the single source
//      of truth for the panel's location.
//
// Nothing here is a security control on its own: the panel is protected by the
// server-side `admin` role check on every management procedure. Obscurity only
// keeps the door off the map; the lock is the role check.
const KEY = 0x5a;

// Each byte below is one character of the segment XOR 0x5a, hex-encoded.
const ENCODED_SEGMENT = "3635292e293f39";

const ADMIN_SEGMENT = ENCODED_SEGMENT.replace(/../g, (byte) =>
  String.fromCharCode(parseInt(byte, 16) ^ KEY),
);

/** The admin root path: "/" followed by the decoded segment. */
export const ADMIN_ROOT = "/" + ADMIN_SEGMENT;

/** Build a child path under the admin root: adminPath("products/42"). */
export function adminPath(child = ""): string {
  const tail = child.replace(/^\/+/, "");
  return tail ? `${ADMIN_ROOT}/${tail}` : ADMIN_ROOT;
}

/** True when `pathname` sits inside the admin surface. Used to keep the panel
 *  from ever being linked or announced by the public storefront. */
export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_ROOT || pathname.startsWith(`${ADMIN_ROOT}/`);
}
