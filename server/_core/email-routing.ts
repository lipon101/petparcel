// ── Email provider routing ───────────────────────────────────────────────────
//
// TWO providers, one policy. Resend's free tier has a HARD daily cap, and when
// it is reached every send fails - including a customer's order receipt. So the
// cap is spent only on the mail that must not be lost, and everything else goes
// out through a second, independent provider with its own separate allowance.
//
//   CRITICAL  -> Resend        order confirmation, payment confirmation, the
//                              shipping notification, the admin's new-order
//                              alert. These are the messages a customer or the
//                              owner is actively waiting for, and losing one is a
//                              support incident.
//   STANDARD  -> secondary     signup verification, password reset, magic-link
//                              sign-in, contact-form replies, welcome mail and
//                              any other notification. Important, but a retry or
//                              a short delay is survivable, and they are the
//                              bulk of the volume.
//
// WHY THIS SPLIT. The two providers have SEPARATE quotas, so a burst of signups
// can no longer exhaust the allowance that a customer's receipt depends on. The
// routing is a pure function of the email kind, so it is testable and there is
// no hidden state deciding where a message goes.
//
// The secondary provider is Brevo: a real SMTP relay
// with our own custom domain and DKIM/SPF that does NOT stamp its own branding on
// transactional mail sent through the relay, so the customer sees only PetParcel.
// It carries a ~9,000/month free allowance, well above this store's non-critical
// volume.
//
// This module is deliberately SELF-CONTAINED (it does not import the EmailKind
// union from services/email.ts) so the low-level transport can consult it
// without a circular import.

/** Every kind of email the store sends. Mirrors `EmailKind` in services/email.ts. */
export type EmailKind =
  | "order_confirmation"
  | "payment_confirmation"
  | "shipping_notification"
  | "contact_message"
  | "welcome"
  | "admin_new_order"
  | "unpaid_alert"
  | "auth_verification"
  | "auth_password_reset"
  | "auth_magic_link";

/** Which transport a message goes out through. */
export type EmailProvider = "resend" | "smtp";

/**
 * The kinds that MUST go through Resend.
 *
 * Deliberately small: the whole point of the split is to keep Resend's daily
 * allowance for the mail whose loss is a real incident. Everything not listed
 * here is STANDARD and goes to the secondary provider.
 */
export const CRITICAL_EMAIL_KINDS: readonly EmailKind[] = [
  "order_confirmation",
  "payment_confirmation",
  "shipping_notification",
  "admin_new_order",
  // The unpaid-order alert is an OWNER alert about money that has not arrived -
  // losing it means an order is never chased, so it belongs on the critical
  // transport alongside the other order mail.
  "unpaid_alert",
];

/** True when this kind must use the critical (Resend) transport. */
export function isCriticalEmail(kind: string): boolean {
  return (CRITICAL_EMAIL_KINDS as readonly string[]).includes(kind);
}

/**
 * The transport for a kind. Critical -> Resend, everything else -> the secondary
 * SMTP provider. Pure and total: every kind resolves to exactly one provider.
 *
 * An UNKNOWN kind (a future kind added without updating this list) routes to the
 * secondary provider on purpose: the critical allowance is the scarce resource,
 * so an unrecognised message must not be able to spend it.
 */
export function providerForKind(kind: string): EmailProvider {
  return isCriticalEmail(kind) ? "resend" : "smtp";
}
