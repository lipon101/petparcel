// Shared harness for the browser gates: boot the REAL production server behind
// REAL TLS.
//
// WHY TLS, NOT PLAIN HTTP. The app's production session cookie is
// `Secure; Partitioned; SameSite=None` (see `sessionCookieOptions` in
// server/_core/session-cookie.ts), which is correct for the HTTPS deployment -
// but a real browser REFUSES to store a Secure cookie over http://. On plain
// HTTP the sign-in appears to succeed and every following request is anonymous,
// so a gate would measure a signed-OUT page and its own session assertions
// would fail for a transport reason rather than a defect.
//
// So the gates terminate real TLS (a self-signed certificate generated into a
// temp directory at run time) in front of the real server, and drive Chromium
// with `ignoreHTTPSErrors`. This exercises the PRODUCTION cookie flags exactly,
// which is the point: it is the configuration that ships.
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:https";
import { request as httpRequest } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

/**
 * Boot `node dist/index.js` (the process Vercel runs) with NODE_ENV=production,
 * capturing its output into a buffer that is printed only on failure.
 *
 * The harness's own TLS opt-out is stripped from the child's environment, so
 * the app's outbound requests keep full certificate verification.
 */
export function startServer({ port, cwd = process.cwd() }) {
  const { NODE_TLS_REJECT_UNAUTHORIZED: _drop, ...inherited } = process.env;
  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd,
    env: { ...inherited, NODE_ENV: "production", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const log = { text: "" };
  const capture = (d) => {
    log.text += d.toString();
    if (log.text.length > 200_000) log.text = log.text.slice(-100_000);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);
  return { child, log };
}

/** Start a self-signed HTTPS terminator in front of `port`. Returns { server, base }. */
export function startTlsProxy({ port, tlsPort }) {
  const dir = mkdtempSync(join(tmpdir(), "petparcel-gate-"));
  execFileSync(
    "openssl",
    [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", join(dir, "key.pem"),
      "-out", join(dir, "cert.pem"),
      "-days", "1", "-subj", "/CN=127.0.0.1",
      "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost",
    ],
    { stdio: "ignore" },
  );
  const server = createServer(
    { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) },
    (req, res) => {
      const up = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: req.url,
          method: req.method,
          headers: {
            ...req.headers,
            // A TLS terminator MUST tell the app that the ORIGINAL request was
            // HTTPS. Every real one does - Vercel sends `x-forwarded-proto`,
            // nginx and Cloudflare send it too - because otherwise the app
            // cannot know it is on a secure origin. That matters for behaviour,
            // not just headers: the production session cookie is `Secure`, and
            // Strict-Transport-Security is only meaningful over HTTPS, so a
            // proxy that stays silent makes the harness exercise a DIFFERENT
            // configuration from production (this is exactly how the search gate
            // first reported "HSTS missing" - a harness artefact, not a defect).
            "x-forwarded-proto": "https",
            "x-forwarded-ssl": "on",
            "x-forwarded-for": req.socket?.remoteAddress ?? "127.0.0.1",
          },
        },
        (u) => {
          res.writeHead(u.statusCode ?? 502, u.headers);
          u.pipe(res);
        },
      );
      up.on("error", () => {
        res.writeHead(502);
        res.end("upstream error");
      });
      req.pipe(up);
    },
  );
  return new Promise((resolve) => {
    server.listen(tlsPort, "127.0.0.1", () =>
      resolve({ server, base: `https://127.0.0.1:${tlsPort}` }),
    );
  });
}

/** Poll /api/health until it reports ok:true (or give up). */
export async function waitForHealth(base, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok && /"ok"\s*:\s*true/.test(await res.text())) return true;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  return false;
}
