// Fail the build if a SECRET is committed to the repository.
//
// WHY THIS EXISTS. Every credential this store needs - the production Postgres
// DSN, the Resend key, the Brevo SMTP key, the R2 secret, the CJ API key, the
// GitHub token - is supplied through the environment (Vercel / the platform),
// never through a file. `.gitignore` keeps `.env` out, but `.gitignore` only
// protects a file that is not ALREADY tracked, and it says nothing about a
// credential pasted inline into a script, a workflow, a test fixture or a
// config. A single `git add -f`, a `.env.production` that slipped past the
// pattern, or a hardcoded DSN in a helper script would publish the secret to
// GitHub permanently - and a leaked production database password is not
// something a later commit can undo.
//
// This module is the pure half of that guard: it takes text (or a whole tracked
// tree) and returns findings. It does no I/O of its own beyond reading the files
// it is asked to scan, so the test suite can drive it with fixtures. The CLI
// wrapper is `scripts/check-secrets.ts`; the CI step runs it as the FIRST job
// step, before anything is built.
//
// It is deliberately a pure text scan: no network, no database, no environment
// read.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// ── The patterns ────────────────────────────────────────────────────────────
// Each entry is a regex whose SOURCE text never matches itself: the quantifier
// brace (`{…}`) or a group paren follows the literal prefix, and neither is a
// character the prefix's own character class accepts. That is what lets this
// file (and `check-vercel-config.mjs`, which carries the same kind of source)
// live in the repository without tripping the scan - and the test suite pins
// that property so a future edit cannot quietly break it.
export const SECRET_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "GitHub token", re: /ghp_[A-Za-z0-9]{30,}/ },
  { name: "GitHub fine-grained token", re: /github_pat_[A-Za-z0-9_]{30,}/ },
  { name: "Brevo SMTP key", re: /xsmtpsib-[A-Za-z0-9]{16,}/ },
  { name: "Brevo API key", re: /xkeysib-[A-Za-z0-9]{16,}/ },
  { name: "Resend API key", re: /re_[A-Za-z0-9]{20,}/ },
  { name: "generic API secret", re: /\bsk-[A-Za-z0-9]{20,}/ },
  { name: "supplier API key", re: /@api@[A-Za-z0-9]{16,}/ },
  // A Telegram bot token: `<bot id>:<secret>`. The bot id is 8-12 digits as
  // Telegram issues them, and the secret is 35 base64url characters. The
  // quantifier brace follows the digit class, so this line cannot match itself.
  { name: "Telegram bot token", re: /\d{8,12}:[A-Za-z0-9_-]{35}/ },
];

// A Postgres DSN is only a leak when it carries a password AND the host is not a
// local/CI placeholder. `postgres://user:password@localhost:5432/db` and
// `postgres://petparcel:petparcel@localhost:5432/petparcel_test` are the
// documented placeholders; the real Neon DSN is not.
const DSN_RE = /postgres(?:ql)?:\/\/[^\s"'`]+:[^\s"'@/]+@([^\s"'/:]+)/gi;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host", "db", "h"]);

// Variable names whose VALUE is a secret. A non-empty assignment to one of these
// in a tracked file is a leak unless the value is a known placeholder.
export const SECRET_VARS: readonly string[] = [
  "DATABASE_URL",
  "JWT_SECRET",
  "RESEND_API_KEY",
  "RESEND_WEBHOOK_SECRET",
  "RESEND_SMTP_PASS",
  "BREVO_SMTP_PASS",
  "SMTP_PASS",
  "R2_SECRET_ACCESS_KEY",
  "CJ_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "NOWPAYMENTS_API_KEY",
  "NOWPAYMENTS_IPN_SECRET",
  "CRON_SECRET",
  "ADMIN_PASSWORD",
];

// Values that are documented placeholders, not secrets.
const PLACEHOLDER_VALUES = new Set([
  "",
  "j",
  "test",
  "changeme",
  "change-me",
  "change-me-to-a-long-random-string",
  "a-strong-password",
  "ci-placeholder-not-a-secret",
  "test-jwt-secret-not-for-production",
  "your-password",
  "password",
  "pass",
  "p",
]);

/** True when a tracked path is a real `.env` file (not the names-only template). */
export function isRealEnvFile(p: string): boolean {
  const base = path.basename(p);
  if (base === ".env.example" || base === ".env.sample" || base === ".env.template") {
    return false;
  }
  return base === ".env" || base.startsWith(".env.");
}

/**
 * Scan one file's text. Returns a list of human-readable findings (empty when
 * clean). `p` is only used to label the finding.
 */
export function scanText(text: string, p = "<text>"): string[] {
  const findings: string[] = [];

  for (const { name, re } of SECRET_PATTERNS) {
    const m = text.match(re);
    if (m) findings.push(`${p}: ${name} (matched ${m[0].slice(0, 12)}…)`);
  }

  // Remote Postgres DSN with a password.
  DSN_RE.lastIndex = 0;
  let dsn: RegExpExecArray | null;
  while ((dsn = DSN_RE.exec(text)) !== null) {
    const host = dsn[1].toLowerCase();
    if (!LOCAL_HOSTS.has(host)) {
      findings.push(`${p}: Postgres connection string with a password to a remote host (${host})`);
    }
  }

  // Non-empty assignment to a known secret variable. Scanned LINE BY LINE so a
  // documentation comment (`# DATABASE_URL=...`) or an empty template entry
  // (`.env.example`'s `BREVO_SMTP_PASS=`) is never mistaken for a real value.
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // A comment is documentation, not a value.
    if (/^(\/\/|#|\*|\/\*)/.test(line.trimStart())) continue;
    for (const name of SECRET_VARS) {
      const re = new RegExp(`(?:^|[\\s;])(?:export\\s+)?${name}\\s*=\\s*(.*)$`);
      const m = line.match(re);
      if (!m) continue;
      const value = m[1].trim().replace(/^["']|["']$/g, "").trim();
      if (PLACEHOLDER_VALUES.has(value)) continue;
      // A documentation placeholder (`...`) or an interpolation (`${VAR}`) is
      // not a literal secret.
      if (value.includes("...") || value.includes("${")) continue;
      // A DSN value is judged by the DSN rule above, not by "non-empty".
      if (name === "DATABASE_URL" && /^postgres(?:ql)?:\/\//i.test(value)) continue;
      // A real secret is a single opaque token: no whitespace, and long enough
      // that it cannot be a short placeholder word.
      if (/\s/.test(value) || value.length < 8) continue;
      findings.push(`${p}:${i + 1}: non-empty ${name} assignment (value looks like a real secret)`);
    }
  }

  return findings;
}

/** True when the buffer looks binary (a NUL byte in the first 8 KiB). */
function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true;
  return false;
}

/** Every tracked file, relative to the repo root. */
export function trackedFiles(cwd: string = process.cwd()): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" });
  return out.split("\0").filter(Boolean);
}

/** Scan the whole tracked tree. Returns a list of findings. */
export function scanRepo(cwd: string = process.cwd()): string[] {
  const findings: string[] = [];
  for (const rel of trackedFiles(cwd)) {
    if (isRealEnvFile(rel)) {
      findings.push(`${rel}: a real .env file is TRACKED (only .env.example may be committed)`);
      continue;
    }
    const abs = path.join(cwd, rel);
    let buf: Buffer;
    try {
      buf = fs.readFileSync(abs);
    } catch {
      continue; // a tracked path that is not on disk (e.g. a submodule) - skip
    }
    if (looksBinary(buf)) continue;
    findings.push(...scanText(buf.toString("utf8"), rel));
  }
  return findings;
}
