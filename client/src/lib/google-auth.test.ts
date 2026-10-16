import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_EXPIRED_MESSAGE,
  GOOGLE_FAILURE_MESSAGE,
  GOOGLE_SESSION_VERIFIER_PARAM,
  googleCallbackUrl,
  googleReturnedError,
  readSessionVerifier,
  stripSessionVerifier,
} from "./google-auth";

describe("googleCallbackUrl", () => {
  it("builds the fixed callback path for the site origin", () => {
    expect(googleCallbackUrl("https://www.petparcel.store")).toBe(
      "https://www.petparcel.store/auth/callback",
    );
    expect(GOOGLE_CALLBACK_PATH).toBe("/auth/callback");
  });

  it("does not double a trailing slash", () => {
    expect(googleCallbackUrl("https://www.petparcel.store/")).toBe(
      "https://www.petparcel.store/auth/callback",
    );
  });

  it("keeps a local development origin working", () => {
    expect(googleCallbackUrl("http://localhost:5173")).toBe("http://localhost:5173/auth/callback");
  });
});

describe("readSessionVerifier", () => {
  it("reads the one-time verifier out of the callback query string", () => {
    expect(readSessionVerifier(`?${GOOGLE_SESSION_VERIFIER_PARAM}=abc123`)).toBe("abc123");
  });

  it("reads it alongside other parameters", () => {
    expect(readSessionVerifier(`?next=%2Faccount&${GOOGLE_SESSION_VERIFIER_PARAM}=xyz`)).toBe("xyz");
  });

  it("returns null when absent or blank", () => {
    expect(readSessionVerifier("?next=%2Faccount")).toBeNull();
    expect(readSessionVerifier("")).toBeNull();
    expect(readSessionVerifier(`?${GOOGLE_SESSION_VERIFIER_PARAM}=`)).toBeNull();
    expect(readSessionVerifier(`?${GOOGLE_SESSION_VERIFIER_PARAM}=%20`)).toBeNull();
  });
});

describe("stripSessionVerifier", () => {
  it("removes the credential and keeps the path", () => {
    expect(
      stripSessionVerifier(`https://www.petparcel.store/auth/callback?${GOOGLE_SESSION_VERIFIER_PARAM}=abc`),
    ).toBe("/auth/callback");
  });

  it("keeps every other parameter and the hash", () => {
    expect(
      stripSessionVerifier(
        `https://www.petparcel.store/auth/callback?next=%2Faccount&${GOOGLE_SESSION_VERIFIER_PARAM}=abc#top`,
      ),
    ).toBe("/auth/callback?next=%2Faccount#top");
  });

  it("leaves a URL with no verifier untouched", () => {
    expect(stripSessionVerifier("https://www.petparcel.store/shop?q=harness")).toBe("/shop?q=harness");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    expect(stripSessionVerifier("not a url")).toBe("not a url");
  });
});

describe("googleReturnedError", () => {
  it("spots a declined or refused authorisation", () => {
    expect(googleReturnedError("?error=access_denied&error_description=nope")).toBe(true);
    expect(googleReturnedError("?error=server_error")).toBe(true);
  });

  it("is false on a normal return", () => {
    expect(googleReturnedError("")).toBe(false);
    expect(googleReturnedError("?state=x")).toBe(false);
  });
});

describe("the failure messages", () => {
  it("tell the shopper what to do without naming anything internal", () => {
    expect(GOOGLE_FAILURE_MESSAGE).toMatch(/try again/i);
    expect(GOOGLE_FAILURE_MESSAGE).toMatch(/password/i);
    // No provider internals, no stack-shaped text.
    expect(GOOGLE_FAILURE_MESSAGE).not.toMatch(/neon|http|error code|stack/i);
  });

  it("explain an expired verifier as something to start again", () => {
    expect(GOOGLE_EXPIRED_MESSAGE).toMatch(/expired|already used/i);
    expect(GOOGLE_EXPIRED_MESSAGE).toMatch(/start again/i);
    expect(GOOGLE_EXPIRED_MESSAGE).not.toMatch(/neon|http|error code|stack/i);
  });
});
