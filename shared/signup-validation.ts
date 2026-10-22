// Signup input validation + normalisation, shared by the tRPC router and the
// auth layer and unit-tested on its own.
//
// WHY THIS EXISTS: the signup endpoint is the one public write that creates a
// row and (now) sends mail, so it is the store's most attractive abuse target.
// A bare `z.email()` accepts anything shaped like `a@b.c`, which lets a script
// register `x@x.x`, a throwaway inbox, or a 300-character local part. The rules
// here are deliberately conservative and, crucially, DETERMINISTIC: the same
// input always produces the same verdict, so the "already registered" answer is
// the same on the first attempt as on the second.

export const SIGNUP_NAME_MAX = 80;
export const SIGNUP_EMAIL_MAX = 254; // RFC 5321 maximum address length
export const SIGNUP_PASSWORD_MIN = 8;
export const SIGNUP_PASSWORD_MAX = 200;

/** A thrown validation failure whose message is written for the shopper and is
 *  safe to show verbatim. The router maps it to a 400. */
export class SignupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignupValidationError";
  }
}

/** Throwaway / temp-mail providers we refuse at signup.
 *
 *  Not exhaustive - a determined spammer can register a fresh domain faster than
 *  any list can grow - so this is a speed bump against the obvious throwaway
 *  inboxes, not a proof of humanity. The real gate is the emailed verification
 *  link (see server/_core/email-verification.ts): a temp inbox that cannot
 *  receive the link never becomes a verified account. */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamailblock.com", "sharklasers.com",
  "grr.la", "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org",
  "tempmail.net", "throwawaymail.com", "yopmail.com", "yopmail.fr", "trashmail.com",
  "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mintemail.com",
  "fakeinbox.com", "mailnesia.com", "spam4.me", "mohmal.com", "emailondeck.com",
  "moakt.com", "tempinbox.com", "mailcatch.com", "spamgourmet.com", "mytemp.email",
  "luxusmail.org", "inboxkitten.com", "mail-temp.com", "tempr.email", "discard.email",
  "mailforspam.com", "trbvm.com", "byom.de", "email-temp.com", "fakemail.net",
]);

// A conservative local part: starts and ends alphanumeric, with the common
// separators allowed in between. Rejects leading/trailing dots, doubled dots and
// the exotic quoted forms a script would use to smuggle a payload.
const LOCAL_PART = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?$/;
// One or more dot-separated labels, each starting/ending alphanumeric, ending in
// a real TLD of at least two letters. Rejects `a@b`, `a@b.`, `a@-b.com`.
const DOMAIN = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** Lower-case and trim - the canonical form stored in `users.email`. */
export function normalizeEmail(raw: string): string {
  return String(raw ?? "").trim().toLowerCase();
}

/** Validate and normalise an email, or throw a shopper-facing error. */
export function validateSignupEmail(raw: string): string {
  const email = normalizeEmail(raw);
  if (!email) throw new SignupValidationError("Enter your email address.");
  if (email.length > SIGNUP_EMAIL_MAX) {
    throw new SignupValidationError("That email address is too long.");
  }
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) {
    throw new SignupValidationError("Enter a valid email address.");
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!LOCAL_PART.test(local) || !DOMAIN.test(domain)) {
    throw new SignupValidationError("Enter a valid email address.");
  }
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    throw new SignupValidationError(
      "Please use a permanent email address - temporary inboxes aren't supported.",
    );
  }
  return email;
}

/** Validate a password, or throw a shopper-facing error. */
export function validateSignupPassword(raw: string): string {
  const password = String(raw ?? "");
  if (password.length < SIGNUP_PASSWORD_MIN) {
    throw new SignupValidationError(`Use at least ${SIGNUP_PASSWORD_MIN} characters.`);
  }
  if (password.length > SIGNUP_PASSWORD_MAX) {
    throw new SignupValidationError("That password is too long.");
  }
  // Reject control characters outright - they are never intentional in a typed
  // password and are a sign of a scripted payload.
  if (/[\u0000-\u001f\u007f]/.test(password)) {
    throw new SignupValidationError("That password contains characters we can't accept.");
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new SignupValidationError("Include at least one letter and one number.");
  }
  return password;
}

// ── Contact form + newsletter ─────────────────────────────────────────────
// The contact form and the newsletter are the store's other public writes, so
// they get the same treatment as signup: strip anything scriptable before it
// reaches the database, cap every field, and keep the verdict deterministic.

export const CONTACT_NAME_MAX = 120;
export const CONTACT_MESSAGE_MAX = 4000;

/** The reasons a shopper can pick, shared by the form and the server so the two
 *  can never drift apart. */
export const CONTACT_TOPICS = [
  "Order status or tracking",
  "Return or refund",
  "Product question",
  "Damaged or wrong item",
  "Something else",
] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** Strip control characters, collapse runs of whitespace and cap the length.
 *  Used for single-line fields (a name), where newlines are noise. */
export function sanitizePlainText(raw: string, max: number): string {
  return String(raw ?? "")
    // Drop every C0/C1 control character; a typed name never contains one and a
    // scripted payload often does.
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Like sanitizePlainText but preserves paragraph breaks, for a free-text
 *  message. Collapses spaces/tabs, caps consecutive newlines at two, and keeps
 *  the field to `max` characters so a message can never be a payload. */
export function sanitizeMessage(raw: string, max: number): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Strip control characters, collapse whitespace and cap the length. Returns
 *  null for a blank name so the column stays NULL rather than an empty string. */
export function sanitizeSignupName(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, SIGNUP_NAME_MAX);
}
