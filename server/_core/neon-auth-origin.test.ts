import { afterEach, describe, expect, it, vi } from "vitest";

// The bug this pins: Neon Auth refuses a credential request whose `Origin` is
// missing (400 MISSING_ORIGIN) or not on its trusted-origin allowlist (403
// INVALID_ORIGIN). That is the CALLER's request being unusable, not a server
// fault - but the sign-up path rethrew it as an unknown error and tRPC turned it
// into an opaque 500. These tests assert the provider's origin rejection is
// classified as its own type (so a router can answer 400) while every OTHER
// provider error keeps its existing meaning.
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

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    headers: {
      get: () => null,
      getSetCookie: () => [],
    },
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("neonAuthSignUp origin rejection", () => {
  it("classifies a missing Origin (400 MISSING_ORIGIN) as NeonAuthOriginError", async () => {
    const { neonAuthSignUp, NeonAuthOriginError } = await import("./neon-auth");
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { code: "MISSING_ORIGIN", message: "Origin header is required when callbackURL is not an absolute URL" },
        400,
      ),
    );
    await expect(
      neonAuthSignUp({ email: "a@b.com", password: "Str0ngPass234" }),
    ).rejects.toBeInstanceOf(NeonAuthOriginError);
  });

  it("classifies an untrusted Origin (403 INVALID_ORIGIN) as NeonAuthOriginError", async () => {
    const { neonAuthSignUp, NeonAuthOriginError } = await import("./neon-auth");
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: "INVALID_ORIGIN", message: "Invalid origin" }, 403));
    await expect(
      neonAuthSignUp({ email: "a@b.com", password: "Str0ngPass234" }),
    ).rejects.toBeInstanceOf(NeonAuthOriginError);
  });

  it("still classifies a duplicate address as NeonAuthEmailTakenError", async () => {
    const { neonAuthSignUp, NeonAuthEmailTakenError } = await import("./neon-auth");
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists" }, 422),
    );
    await expect(
      neonAuthSignUp({ email: "a@b.com", password: "Str0ngPass234" }),
    ).rejects.toBeInstanceOf(NeonAuthEmailTakenError);
  });

  it("leaves an unrelated provider error as a plain NeonAuthError (not an origin error)", async () => {
    const { neonAuthSignUp, NeonAuthError, NeonAuthOriginError } = await import("./neon-auth");
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: "SOMETHING_ELSE", message: "Nope" }, 400));
    const err = await neonAuthSignUp({ email: "a@b.com", password: "Str0ngPass234" }).catch((e) => e);
    expect(err).toBeInstanceOf(NeonAuthError);
    expect(err).not.toBeInstanceOf(NeonAuthOriginError);
  });
});
