// Tests for the admin panel's client-side gate.
//
// The decision rule is a pure function (`adminGateDecision`) so it is tested
// directly, without a DOM - vitest runs `environment: "node"` here and jsdom is
// deliberately not a dependency (see vitest.config.ts). A second block reads
// AdminApp.tsx / AdminLogin.tsx as source text to pin the wiring: the switch is
// ON, the gate is applied, it uses the pure rule rather than an imperative
// navigate (which would race the auth cache and could flash admin content), a
// signed-out visitor gets the DEDICATED admin sign-in IN PLACE (never a redirect
// to the shared customer login), and signing out returns to the storefront home.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { adminGateDecision, adminLoginPath } from "./gate";

const ADMIN_ROOT = "/lostsec";
const ADMIN_LOGIN = `${ADMIN_ROOT}/login`;

describe("adminLoginPath", () => {
  it("builds the dedicated admin sign-in path under the admin root", () => {
    expect(adminLoginPath(ADMIN_ROOT)).toBe(ADMIN_LOGIN);
    expect(adminLoginPath("/somewhere-else")).toBe("/somewhere-else/login");
  });
});

describe("adminGateDecision", () => {
  it("allows everyone when the gate is switched off", () => {
    expect(adminGateDecision(false, false, null)).toEqual({ kind: "allow" });
    expect(adminGateDecision(false, true, null)).toEqual({ kind: "allow" });
  });

  it("shows a loading state while the session is still being determined", () => {
    // No flash of admin content: even a signed-out visitor gets "loading" first.
    expect(adminGateDecision(true, true, null)).toEqual({ kind: "loading" });
    expect(adminGateDecision(true, true, { role: "admin" })).toEqual({
      kind: "loading",
    });
  });

  it("shows the DEDICATED admin sign-in IN PLACE for a signed-out visitor", () => {
    // The admin root renders the admin login itself - it must NOT redirect to
    // the storefront's shared customer login.
    const decision = adminGateDecision(true, false, null);
    expect(decision).toEqual({ kind: "login" });
    expect(decision).not.toEqual({ kind: "redirect", to: "/login" });
    expect(decision).not.toEqual({ kind: "redirect", to: ADMIN_LOGIN });
  });

  it("redirects a signed-in non-admin to the storefront", () => {
    expect(adminGateDecision(true, false, { role: "customer" })).toEqual({
      kind: "redirect",
      to: "/",
    });
    // A missing/blank role is not admin either.
    expect(adminGateDecision(true, false, { role: null })).toEqual({
      kind: "redirect",
      to: "/",
    });
    expect(adminGateDecision(true, false, {})).toEqual({
      kind: "redirect",
      to: "/",
    });
  });

  it("allows an admin through", () => {
    expect(adminGateDecision(true, false, { role: "admin" })).toEqual({
      kind: "allow",
    });
  });
});

describe("AdminApp gate wiring", () => {
  const src = readFileSync(path.resolve(import.meta.dirname, "AdminApp.tsx"), "utf-8");

  it("has the client-side gate switched ON", () => {
    expect(src).toMatch(/export const ADMIN_REQUIRE_AUTH = true;/);
  });

  it("wraps the panel in RequireAdmin and uses the pure decision rule", () => {
    expect(src).toMatch(/<RequireAdmin>/);
    expect(src).toMatch(/adminGateDecision\(/);
  });

  it("does not navigate imperatively inside the gate (no flash / race)", () => {
    // The gate must render a <Redirect>, not call navigate() during render.
    const gateBody = src.slice(src.indexOf("function RequireAdmin"));
    expect(gateBody).not.toMatch(/navigate\(/);
    expect(gateBody).toMatch(/<Redirect to=\{decision\.to\}/);
  });

  it("renders the DEDICATED admin sign-in IN PLACE for the login decision", () => {
    // The signed-out branch renders <AdminLogin /> at the admin root itself.
    const gateBody = src.slice(src.indexOf("function RequireAdmin"));
    expect(gateBody).toMatch(/decision\.kind === "login"\) return <AdminLogin \/>/);
    expect(src).toMatch(/import \{ AdminLogin \} from "\.\/AdminLogin";/);
  });

  it("signs out to the STOREFRONT HOME, never the admin login", () => {
    // Logout must land on "/" - not the admin login, not a leftover admin page.
    expect(src).toMatch(/logout\(\)\.then\(\(\) => \{/);
    expect(src).toMatch(/window\.location\.href = "\/";/);
  });
});

describe("dedicated admin login page", () => {
  const src = readFileSync(path.resolve(import.meta.dirname, "AdminLogin.tsx"), "utf-8");

  it("uses the dedicated adminAuth login, not the customer auth one", () => {
    expect(src).toMatch(/trpc\.adminAuth\.login\.useMutation\(\)/);
    // It must never call the storefront's shared login mutation.
    expect(src).not.toMatch(/trpc\.auth\.login\.useMutation/);
  });

  it("reads the SAME session source the gate reads, so the two cannot disagree", () => {
    // The login page must guard on `useAuth()` (-> auth.me), the query the gate
    // uses; reading a different query would let it redirect to the panel while
    // the gate still saw a signed-out session (an infinite redirect loop).
    expect(src).toMatch(/useAuth\(\)/);
    expect(src).toMatch(/user\?\.role === "admin"/);
    // And it must refresh that session after a successful sign-in.
    expect(src).toMatch(/utils\.auth\.me\.invalidate\(\)/);
  });

  it("is kept out of search indexes", () => {
    expect(src).toMatch(/noindex:\s*true/);
  });

  it("does not link to or from the storefront", () => {
    // The admin door must not advertise the customer login (or any storefront
    // route) - nothing about the panel may be revealed to a normal user.
    expect(src).not.toMatch(/href="\/login"/);
    expect(src).not.toMatch(/<Link\b/);
  });

  it("renders the premium branded surface (scoped .al-* classes)", () => {
    // The redesign is a first-class brand surface, not a generic form: the
    // branded lockup, the framed card and the field/submit states.
    for (const cls of [
      "al-shell",
      "al-card",
      "al-mark",
      "al-wordmark",
      "al-input",
      "al-submit",
    ]) {
      expect(src, `missing ${cls}`).toMatch(new RegExp(`\\b${cls}\\b`));
    }
  });

  it("is a clean LIGHT surface - no dark glow/grid decoration", () => {
    // The page was moved from a dark gradient ground to a premium white one;
    // the drifting glow halos and the hairline grid are gone.
    expect(src).not.toMatch(/\bal-glow\b/);
    expect(src).not.toMatch(/\bal-grid\b/);
  });

  it("keeps autocomplete correct and never both fields the same", () => {
    expect(src).toMatch(/autoComplete="username"/);
    expect(src).toMatch(/autoComplete="current-password"/);
  });

  it("shows a pending state and prevents a double submit", () => {
    expect(src).toMatch(/disabled=\{pending\}/);
    expect(src).toMatch(/aria-busy=\{pending\}/);
    expect(src).toMatch(/Verifying/);
    // The guard must be in the handler too, not only in the disabled attribute.
    expect(src).toMatch(/if \(loginM\.isPending\) return;/);
  });

  it("shows an accessible inline error and surfaces the lockout distinctly", () => {
    expect(src).toMatch(/role="alert"/);
    // The lockout gets its own treatment rather than a generic failure.
    expect(src).toMatch(/is-locked/);
    expect(src).toMatch(/classifyAdminLoginError\(/);
  });

  it("never logs or prints a secret to the console", () => {
    // The password must never be autofilled into a log, and the raw error must
    // never be echoed (it could carry internal detail).
    expect(src).not.toMatch(/console\.(log|error|warn|info|debug)\(/);
  });

  it("toggles password visibility without a plaintext leak", () => {
    expect(src).toMatch(/type=\{showPassword \? "text" : "password"\}/);
  });
});

describe("the admin area is not framed by the storefront chrome", () => {
  const appSrc = readFileSync(path.resolve(import.meta.dirname, "../App.tsx"), "utf-8");
  const layoutSrc = readFileSync(
    path.resolve(import.meta.dirname, "../components/site/Layout.tsx"),
    "utf-8",
  );

  it("renders the storefront <Layout> only for non-admin paths", () => {
    // The panel is its own surface: framed by the shopper header/footer it would
    // offer a public way into (and out of) a private console.
    expect(appSrc).toMatch(/isAdminPath\(location\)/);
    expect(appSrc).toMatch(/<Shell>/);
    expect(appSrc).toMatch(/if \(isAdminPath\(location\)\) return <>\{children\}<\/>;/);
    expect(appSrc).toMatch(/return <Layout>\{children\}<\/Layout>;/);
  });

  it("does not mount the storefront cart drawer inside the admin surface", () => {
    // CartDrawer lives in Layout, so the admin surface must not render Layout.
    expect(layoutSrc).toMatch(/<CartDrawer/);
    expect(appSrc).not.toMatch(/<CartDrawer/);
  });

  it("never links the storefront to the admin area", () => {
    // The storefront chrome must not mention the admin root or build admin paths.
    expect(layoutSrc).not.toMatch(/ADMIN_ROOT|adminPath|isAdminPath/);
  });
});
