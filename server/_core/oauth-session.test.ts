import { afterEach, describe, expect, it, vi } from "vitest";

// The Google OAuth completion path. The bug this pins: the exchange used to
// store the BARE `session.token` from the provider's response body, but the
// provider's `/token` (and therefore our JWKS verification) accepts ONLY the
// SIGNED `session_token` cookie value. So the session we minted could never be
// verified, `auth.me` stayed null, and the callback spun forever. These tests
// assert the exchange prefers the SIGNED cookie and that verification accepts
// the signed value while rejecting the bare one.
vi.mock("./env", () => ({
  env: {
    isProd: false,
    appSlug: "test",
    authProvider: "neon",
    neonAuth: { url: "https://auth.test/db/auth", jwksUrl: "" },
  },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// `jose` is ESM and its exports are not configurable, so it is mocked as a
// module rather than spied on. Only the JWKS path uses it.
const jwtVerifyMock = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: () => ({}),
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
}));

function jsonResponse(body: unknown, setCookies: string[] = [], status = 200) {
  return {
    status,
    headers: {
      get: (k: string) => (k.toLowerCase() === "set-cookie" ? setCookies.join(", ") : null),
      getSetCookie: () => setCookies,
    },
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  fetchMock.mockReset();
  jwtVerifyMock.mockReset();
});

describe("neonAuthSessionFromVerifier", () => {
  it("stores the SIGNED session_token cookie, not the bare body token", async () => {
    const { neonAuthSessionFromVerifier } = await import("./neon-auth");
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { user: { id: "u1", email: "a@b.com", name: "A", emailVerified: true }, token: "BARE_TOKEN" },
        ["__Secure-neon-auth.session_token=SIGNED.TOKEN; Path=/; HttpOnly; Secure"],
      ),
    );
    const out = await neonAuthSessionFromVerifier({
      verifier: "v".repeat(20),
      challengeCookie: "challenge",
      origin: "https://www.petparcel.store",
    });
    expect(out).not.toBeNull();
    expect(out!.token).toBe("SIGNED.TOKEN");
    expect(out!.token).not.toBe("BARE_TOKEN");
  });

  it("falls back to the body token only when the provider set no cookie", async () => {
    const { neonAuthSessionFromVerifier } = await import("./neon-auth");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ user: { id: "u1", email: "a@b.com", name: "A", emailVerified: true }, token: "BARE_TOKEN" }),
    );
    const out = await neonAuthSessionFromVerifier({
      verifier: "v".repeat(20),
      challengeCookie: "challenge",
      origin: "https://www.petparcel.store",
    });
    expect(out!.token).toBe("BARE_TOKEN");
  });

  it("returns null when the exchange is refused", async () => {
    const { neonAuthSessionFromVerifier } = await import("./neon-auth");
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "SESSION_CHALLENGE_COOKIE_NOT_FOUND" }, [], 400));
    const out = await neonAuthSessionFromVerifier({
      verifier: "v".repeat(20),
      challengeCookie: "challenge",
      origin: "https://www.petparcel.store",
    });
    expect(out).toBeNull();
  });

  it("reads the signed token from the Set-Cookie LIST when the joined header is ambiguous", async () => {
    const { neonAuthSessionFromVerifier } = await import("./neon-auth");
    // A response that sets several cookies: the joined `get("set-cookie")` is
    // ambiguous (an Expires date contains a comma), so the array is the source.
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: {
        get: () => null,
        getSetCookie: () => [
          "__Secure-neon-auth.session_data=DATA; Path=/; HttpOnly",
          "__Secure-neon-auth.session_token=SIGNED.FROM.ARRAY; Path=/; HttpOnly; Secure",
        ],
      },
      text: async () => JSON.stringify({ user: { id: "u1", email: "a@b.com", emailVerified: true }, token: "BARE" }),
    });
    const out = await neonAuthSessionFromVerifier({
      verifier: "v".repeat(20),
      challengeCookie: "challenge",
      origin: "https://www.petparcel.store",
    });
    expect(out!.token).toBe("SIGNED.FROM.ARRAY");
  });

  it("asks the provider NOT to follow redirects, so a 3xx Set-Cookie stays readable", async () => {
    const { neonAuthSessionFromVerifier } = await import("./neon-auth");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ user: { id: "u1", email: "a@b.com", emailVerified: true }, token: "BARE" }),
    );
    await neonAuthSessionFromVerifier({
      verifier: "v".repeat(20),
      challengeCookie: "challenge",
      origin: "https://www.petparcel.store",
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });
});

describe("neonAuthVerifiedIdentity", () => {
  it("verifies via the JWKS path when /token accepts the token", async () => {
    const { neonAuthVerifiedIdentity } = await import("./neon-auth");
    // /token returns a JWT; jwtVerify is mocked to accept it.
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "jwt" }));
    jwtVerifyMock.mockResolvedValueOnce({
      payload: { sub: "u1", email: "A@B.com", name: "A", emailVerified: true },
    });
    const id = await neonAuthVerifiedIdentity("SIGNED.TOKEN");
    expect(id).toMatchObject({ id: "u1", email: "a@b.com", emailVerified: true });
  });

  it("falls back to /get-session when /token rejects the token (the OAuth case)", async () => {
    const { neonAuthVerifiedIdentity } = await import("./neon-auth");
    // /token -> 401 (bare token), then /get-session -> a verified user.
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, [], 401))
      .mockResolvedValueOnce(
        jsonResponse({
          user: { id: "u2", email: "C@D.com", name: "C", emailVerified: true },
          session: { userId: "u2" },
        }),
      );
    const id = await neonAuthVerifiedIdentity("BARE_TOKEN");
    expect(id).toMatchObject({ id: "u2", email: "c@d.com", emailVerified: true });
  });

  it("rejects an unverified address on the fallback path", async () => {
    const { neonAuthVerifiedIdentity } = await import("./neon-auth");
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, [], 401))
      .mockResolvedValueOnce(
        jsonResponse({
          user: { id: "u3", email: "e@f.com", name: "E", emailVerified: false },
          session: { userId: "u3" },
        }),
      );
    expect(await neonAuthVerifiedIdentity("BARE_TOKEN")).toBeNull();
  });
});
