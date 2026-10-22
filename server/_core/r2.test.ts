// SigV4 correctness. The critical test is the PUBLISHED AWS Signature Version 4
// test vector — a hand-rolled signer that is subtly wrong (a lowercase hex digit,
// an unsorted query key, a missing trailing newline) produces a 403 from S3 with
// no hint about which byte was wrong. Pinning the signer to AWS's own documented
// output is the only way to know it is right without a live bucket.
import { describe, it, expect } from "vitest";
import {
  awsUriEncode,
  canonicalQueryString,
  amzDate,
  dateStamp,
  sha256Hex,
  signRequest,
  r2ConfigFromEnv,
  describeR2,
  isR2Configured,
  r2EndpointHost,
  r2PublicUrl,
  R2_ENV_KEYS,
} from "./r2";

describe("awsUriEncode (RFC 3986 as AWS requires)", () => {
  it("keeps unreserved characters", () => {
    expect(awsUriEncode("AZaz09-._~", true)).toBe("AZaz09-._~");
  });

  it("keeps '/' only when encodeSlash is false", () => {
    expect(awsUriEncode("a/b/c", false)).toBe("a/b/c");
    expect(awsUriEncode("a/b/c", true)).toBe("a%2Fb%2Fc");
  });

  it("upper-cases the hex and encodes a space as %20", () => {
    expect(awsUriEncode("a b", true)).toBe("a%20b");
    // lowercase hex would be a silent 403 from S3
    expect(awsUriEncode("/", true)).toBe("%2F");
  });

  it("encodes non-ASCII by UTF-8 byte", () => {
    // 'é' = C3 A9
    expect(awsUriEncode("é", true)).toBe("%C3%A9");
  });
});

describe("canonicalQueryString", () => {
  it("sorts by key and encodes both sides", () => {
    expect(canonicalQueryString({ b: "2", a: "1" })).toBe("a=1&b=2");
    expect(canonicalQueryString({ "X-Amz-Date": "20150830T123600Z" })).toBe("X-Amz-Date=20150830T123600Z");
    expect(canonicalQueryString({ k: "a b" })).toBe("k=a%20b");
  });
});

describe("timestamps", () => {
  it("formats the amz date and its date stamp", () => {
    const now = new Date(Date.UTC(2015, 7, 30, 12, 36, 0));
    expect(amzDate(now)).toBe("20150830T123600Z");
    expect(dateStamp(amzDate(now))).toBe("20150830");
  });
});

describe("sha256Hex", () => {
  it("hashes the empty string to the well-known digest", async () => {
    expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

// The documented AWS example: GET https://example.amazonaws.com/ with the
// credential scope 20150830/us-east-1/service/aws4_request.
const AWS_VECTOR = {
  method: "GET",
  host: "example.amazonaws.com",
  canonicalUri: "/",
  headers: { host: "example.amazonaws.com", "x-amz-date": "20150830T123600Z" },
  amzDate: "20150830T123600Z",
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  service: "service",
  payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
};

describe("signRequest — AWS SigV4 documented test vector", () => {
  it("builds the canonical request AWS documents", async () => {
    const signed = await signRequest(AWS_VECTOR);
    expect(signed.canonicalRequest).toBe(
      [
        "GET",
        "/",
        "",
        "host:example.amazonaws.com",
        "x-amz-date:20150830T123600Z",
        "",
        "host;x-amz-date",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ].join("\n"),
    );
  });

  it("builds the string to sign AWS documents", async () => {
    const signed = await signRequest(AWS_VECTOR);
    const lines = signed.stringToSign.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("AWS4-HMAC-SHA256");
    expect(lines[1]).toBe("20150830T123600Z");
    expect(lines[2]).toBe("20150830/us-east-1/service/aws4_request");
    // The final line is sha256(canonical request) - derived from the canonical
    // request rather than restated, so the two can never drift apart.
    expect(lines[3]).toBe(await sha256Hex(signed.canonicalRequest));
  });

  it("produces AWS's documented signature and Authorization header", async () => {
    const signed = await signRequest(AWS_VECTOR);
    expect(signed.signature).toBe("5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
    expect(signed.authorization).toBe(
      "AWS4-HMAC-SHA256 " +
        "Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
        "SignedHeaders=host;x-amz-date, " +
        "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
  });
});

describe("signRequest — signing-header selection", () => {
  it("signs every supplied header, sorted and lower-cased, and always host", async () => {
    const signed = await signRequest({
      ...AWS_VECTOR,
      headers: { host: "example.amazonaws.com", "x-amz-date": "20150830T123600Z", "content-type": "image/png" },
      region: "auto",
      service: "s3",
    });
    expect(signed.signedHeaders).toBe("content-type;host;x-amz-date");
    // host must participate even when the caller omits it
    const withoutHost = await signRequest({ ...AWS_VECTOR, headers: { "x-amz-date": "20150830T123600Z" } });
    expect(withoutHost.signedHeaders).toContain("host");
  });

  it("changes the signature when the body hash changes", async () => {
    const a = await signRequest(AWS_VECTOR);
    const b = await signRequest({ ...AWS_VECTOR, payloadHash: await sha256Hex("different") });
    expect(a.signature).not.toBe(b.signature);
  });
});

describe("r2 config resolution (names only, never values)", () => {
  const full: Record<string, string> = {
    R2_ACCOUNT_ID: "acct",
    R2_ACCESS_KEY_ID: "key",
    R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "bucket",
    R2_PUBLIC_BASE_URL: "https://media.example.com/",
  };
  const get = (m: Record<string, string>) => (n: string) => m[n];

  it("returns null when any variable is missing", () => {
    expect(r2ConfigFromEnv(get({}))).toBeNull();
    for (const k of R2_ENV_KEYS) {
      const partial = { ...full };
      delete partial[k];
      expect(r2ConfigFromEnv(get(partial)), `missing ${k}`).toBeNull();
    }
  });

  it("treats a blank value as absent", () => {
    expect(r2ConfigFromEnv(get({ ...full, R2_BUCKET: "   " }))).toBeNull();
  });

  it("strips a trailing slash from the public base", () => {
    expect(r2ConfigFromEnv(get(full))?.publicBaseUrl).toBe("https://media.example.com");
  });

  it("isR2Configured follows the same rule", () => {
    expect(isR2Configured(get(full))).toBe(true);
    expect(isR2Configured(get({ R2_ACCOUNT_ID: "acct" }))).toBe(false);
  });

  it("describeR2 lists only the names that are set", () => {
    expect(describeR2(get({ R2_ACCOUNT_ID: "acct", R2_BUCKET: "bucket" }))).toEqual(["R2_ACCOUNT_ID", "R2_BUCKET"]);
    expect(describeR2(get(full))).toHaveLength(R2_ENV_KEYS.length);
  });
});

describe("endpoint + public url", () => {
  it("builds the R2 S3 host and the public object URL", () => {
    expect(r2EndpointHost("abc123")).toBe("abc123.r2.cloudflarestorage.com");
    const cfg = r2ConfigFromEnv((n) =>
      ({
        R2_ACCOUNT_ID: "abc123",
        R2_ACCESS_KEY_ID: "k",
        R2_SECRET_ACCESS_KEY: "s",
        R2_BUCKET: "media",
        R2_PUBLIC_BASE_URL: "https://media.example.com",
      })[n],
    );
    expect(r2PublicUrl("products/x.jpg", cfg)).toBe("https://media.example.com/products/x.jpg");
    expect(r2PublicUrl("/products/x.jpg", cfg)).toBe("https://media.example.com/products/x.jpg");
  });
});
