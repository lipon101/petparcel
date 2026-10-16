import { describe, expect, it } from "vitest";
import {
  GOOGLE_CALLBACK_PATH,
  GOOGLE_SESSION_VERIFIER_PARAM,
  googleCallbackUrl,
  googleReturnedError,
  readSessionVerifier,
  stripSessionVerifier,
} from "./google-auth";

describe("googleCallbackUrl", () => {
  it("appends the fixed callback path to an origin", () => {
    expect(googleCallbackUrl("https://www.petparcel.store")).toBe(
      `https://www.petparcel.store${GOOGLE_CALLBACK_PATH}`,
    );
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(googleCallbackUrl("https://www.petparcel.store/")).toBe(
      "https://www.petparcel.store/auth/callback",
    );
  });
});

describe("readSessionVerifier", () => {
  it("reads the verifier out of a query string", () => {
    expect(readSessionVerifier(`?${GOOGLE_SESSION_VERIFIER_PARAM}=abc123`)).toBe("abc123");
  });

  it("reads it when other parameters are present", () => {
    expect(readSessionVerifier(`?next=%2Faccount&${GOOGLE_SESSION_VERIFIER_PARAM}=xyz`)).toBe("xyz");
  });

  it("returns null when the parameter is absent", () => {
    expect(readSessionVerifier("?next=%2Faccount")).toBeNull();
    expect(readSessionVerifier("")).toBeNull();
  });

  it("returns null for a blank value rather than an empty string", () => {
    expect(readSessionVerifier(`?${GOOGLE_SESSION_VERIFIER_PARAM}=`)).toBeNull();
    expect(readSessionVerifier(`?${GOOGLE_SESSION_VERIFIER_PARAM}=%20`)).toBeNull();
  });
});

describe("stripSessionVerifier", () => {
  it("removes the verifier and keeps the path", () => {
    expect(
      stripSessionVerifier(`https://www.petparcel.store/auth/callback?${GOOGLE_SESSION_VERIFIER_PARAM}=abc`),
    ).toBe("/auth/callback");
  });

  it("keeps every other parameter", () => {
    expect(
      stripSessionVerifier(
        `https://www.petparcel.store/auth/callback?next=%2Faccount&${GOOGLE_SESSION_VERIFIER_PARAM}=abc`,
      ),
    ).toBe("/auth/callback?next=%2Faccount");
  });

  it("keeps the hash", () => {
    expect(
      stripSessionVerifier(`https://www.petparcel.store/?${GOOGLE_SESSION_VERIFIER_PARAM}=abc#top`),
    ).toBe("/#top");
  });

  it("leaves a URL with no verifier untouched (path + query)", () => {
    expect(stripSessionVerifier("https://www.petparcel.store/shop?q=harness")).toBe("/shop?q=harness");
  });

  it("returns the input unchanged when it cannot be parsed", () => {
    expect(stripSessionVerifier("not a url")).toBe("not a url");
  });
});

describe("googleReturnedError", () => {
  it("is true when the provider appended an error", () => {
    expect(googleReturnedError("?error=access_denied")).toBe(true);
  });

  it("is false on a clean return", () => {
    expect(googleReturnedError(`?${GOOGLE_SESSION_VERIFIER_PARAM}=abc`)).toBe(false);
  });
});
