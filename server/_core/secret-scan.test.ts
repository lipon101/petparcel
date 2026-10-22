import { describe, expect, it } from "vitest";
import {
  SECRET_PATTERNS,
  isRealEnvFile,
  scanRepo,
  scanText,
  trackedFiles,
} from "@shared/secret-scan";

// The committed-secret guard is only useful if it (a) catches a real secret and
// (b) does NOT fire on the placeholders and documentation the repo legitimately
// contains. Both directions are pinned here, because a guard that fails the
// build on a false positive gets disabled, and a guard that misses a real key
// is worse than none.

describe("scanText - catches real secrets", () => {
  it("flags a GitHub token", () => {
    const token = "ghp_" + "A".repeat(36);
    expect(scanText(`const t = "${token}";`)).toHaveLength(1);
  });

  it("flags a Brevo SMTP key and a Brevo API key", () => {
    expect(scanText("BREVO_SMTP_PASS=xsmtpsib-" + "a".repeat(40))).not.toHaveLength(0);
    expect(scanText("key=xkeysib-" + "b".repeat(40))).not.toHaveLength(0);
  });

  it("flags a Resend key and a generic sk- secret", () => {
    expect(scanText("RESEND_API_KEY=re_" + "c".repeat(30))).not.toHaveLength(0);
    expect(scanText("token=sk-" + "d".repeat(30))).not.toHaveLength(0);
  });

  it("flags a webhook signing secret wherever it is committed", () => {
    // Both providers that sign their callbacks use this prefix: Svix (Resend)
    // and Bachs. It must be caught in a script, a comment or a fixture - not
    // only when it happens to sit in an assignment to a known variable name.
    const secret = "whsec_" + "e".repeat(32);
    expect(scanText(`const s = "${secret}";`)).not.toHaveLength(0);
    expect(scanText(`// the secret is ${secret} - do not commit`)).not.toHaveLength(0);
    expect(scanText(`curl -H "x-bachs-signature: ${secret}"`)).not.toHaveLength(0);
  });

  it("flags a remote Postgres DSN that carries a password", () => {
    // Assembled from fragments so this fixture's SOURCE text is not itself a
    // matchable DSN - otherwise the guard would (correctly) flag this very test
    // file, which is exactly what happened the first time. The host is generic,
    // never the real one.
    const dsn = "postgresql://dbuser:" + "supersecretpw" + "@" + "db.example.com:5432/appdb";
    const found = scanText(`DATABASE_URL=${dsn}`);
    expect(found.some((f) => f.includes("remote host"))).toBe(true);
  });

  it("flags a non-empty assignment to a secret variable", () => {
    const found = scanText("BREVO_SMTP_PASS=realkeyvalue123456");
    expect(found.some((f) => f.includes("BREVO_SMTP_PASS"))).toBe(true);
  });
});

describe("scanText - does NOT fire on placeholders and documentation", () => {
  it("ignores a localhost/CI DSN", () => {
    expect(scanText("DATABASE_URL=postgres://petparcel:petparcel@localhost:5432/petparcel_test")).toHaveLength(0);
    expect(scanText("DATABASE_URL=postgres://user:password@localhost:5432/petparcel")).toHaveLength(0);
  });

  it("ignores an empty template entry", () => {
    expect(scanText("BREVO_SMTP_PASS=\nR2_SECRET_ACCESS_KEY=\nCJ_API_KEY=")).toHaveLength(0);
  });

  it("ignores a documentation comment", () => {
    expect(scanText("//   DATABASE_URL='...' node scripts/assign-category-taxonomy.mjs")).toHaveLength(0);
    expect(scanText("# BREVO_SMTP_PASS=... node scripts/show-email-routing.mjs")).toHaveLength(0);
  });

  it("ignores an interpolation and a short placeholder", () => {
    expect(scanText("`BREVO_SMTP_PASS = ${PASS ? `set` : \"(MISSING)\"}`")).toHaveLength(0);
    expect(scanText("JWT_SECRET=j")).toHaveLength(0);
    expect(scanText("JWT_SECRET=change-me-to-a-long-random-string")).toHaveLength(0);
  });
});

describe("the guard's own source does not trip the guard", () => {
  it("every pattern's source text does not match itself", () => {
    for (const { name, re } of SECRET_PATTERNS) {
      expect(re.test(re.source), `${name} pattern matches its own source`).toBe(false);
    }
  });
});

describe("isRealEnvFile", () => {
  it("allows the names-only templates", () => {
    expect(isRealEnvFile(".env.example")).toBe(false);
    expect(isRealEnvFile("config/.env.sample")).toBe(false);
  });

  it("flags a real env file", () => {
    expect(isRealEnvFile(".env")).toBe(true);
    expect(isRealEnvFile(".env.production")).toBe(true);
    expect(isRealEnvFile("apps/web/.env.local")).toBe(true);
  });
});

describe("scanRepo - the real repository is clean", () => {
  it(
    "finds no committed secret in any tracked file",
    () => {
      // This is the same assertion CI makes. If it fails, a real credential is in
      // the tree and must be removed and rotated.
      expect(scanRepo()).toEqual([]);
    },
    // This test reads EVERY tracked file - including the 1.5 MB server bundle -
    // and runs a set of regexes over each. On its own it takes about a second;
    // run alongside the rest of the suite, with every worker competing for the
    // same disk, it can take several. The default 5s timeout is not a property
    // of the scan, it is just vitest's default, and a timeout here would be
    // reported as "the repository contains a secret" - a false alarm about the
    // one thing this test exists to be sure about.
    60_000,
  );

  it("scans a non-trivial number of tracked files", () => {
    expect(trackedFiles().length).toBeGreaterThan(100);
  });
});
