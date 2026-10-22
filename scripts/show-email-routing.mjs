// Demonstrate the REAL email provider routing, end to end.
//
// It imports the actual routing module and the actual send path (no
// reimplementation), prints the routing decision for every email kind, then
// exercises the real `sendEmail` for one critical and one non-critical kind and
// prints the status the store actually records. That proves the
// graceful-degradation contract: a missing provider never throws and never
// blocks a purchase.
//
// `env.ts` reads process.env ONCE at module load, so the "configured" state is
// measured by setting the variables BEFORE the dynamic import below - which is
// exactly how a real deployment behaves (Vercel sets them before the process
// starts).

// ── Phase 1: the pre-setup state (no credentials) ────────────────────────────
const { providerForKind, CRITICAL_EMAIL_KINDS } = await import(
  "../server/_core/email-routing.ts"
);
const { sendEmail } = await import("../server/_core/email.ts");

const KINDS = [
  "order_confirmation",
  "payment_confirmation",
  "shipping_notification",
  "admin_new_order",
  "auth_verification",
  "auth_password_reset",
  "auth_magic_link",
  "contact_message",
  "welcome",
];

console.log("=== ROUTING TABLE (real, from server/_core/email-routing.ts) ===");
console.log("kind".padEnd(24), "provider");
for (const kind of KINDS) {
  const provider = providerForKind(kind);
  const label = provider === "resend" ? "Resend (critical)" : "Brevo (secondary)";
  console.log(kind.padEnd(24), label);
}
console.log("\ncritical set:", JSON.stringify([...CRITICAL_EMAIL_KINDS]));

console.log("\n=== REAL SEND PATH, no credentials configured (the pre-setup state) ===");
for (const kind of ["order_confirmation", "auth_magic_link"]) {
  const r = await sendEmail({
    to: "customer@example.com",
    subject: "routing probe",
    html: "<p>probe</p>",
    kind,
  });
  console.log(
    `${kind.padEnd(24)} provider=${providerForKind(kind).padEnd(7)} status=${r.status}  reason=${r.reason ?? "-"}`,
  );
}

// ── Phase 2: the configured state ────────────────────────────────────────────
// `env.ts` reads process.env ONCE at module load, so the configured state is
// measured by running this script with the BREVO_* variables already set (which
// is exactly how a real deployment behaves - Vercel sets them before the process
// starts). Run it both ways to see both states:
//   node scripts/show-email-routing.mjs
//   BREVO_SMTP_HOST=... BREVO_SMTP_USER=... BREVO_SMTP_PASS=... node scripts/show-email-routing.mjs
const { smtpConfigured } = await import("../server/_core/smtp.ts");
const { env } = await import("../server/_core/env.ts");
console.log("\n=== CONFIGURED STATE (as this process was started) ===");
console.log("secondary provider configured:", smtpConfigured());
console.log("secondary host:", env.email.smtpHost || "(unset)");
console.log("secondary from:", env.email.secondaryFrom || "(falls back to EMAIL_FROM)");
console.log("non-critical kind routes to:", providerForKind("auth_magic_link"));
console.log("critical kind routes to:", providerForKind("order_confirmation"));
