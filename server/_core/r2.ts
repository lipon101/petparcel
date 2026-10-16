// Cloudflare R2 storage driver — DEPENDENCY-FREE.
//
// R2 speaks the S3 API, so a driver is "just" AWS Signature Version 4 over
// fetch. Rather than pull in `@aws-sdk/client-s3` (a large tree that the Vercel
// function would have to install and trace) this implements SigV4 directly with
// Web Crypto — both `crypto.subtle` and `fetch` are available in Node 24 and on
// Vercel, so there is nothing to add to package.json.
//
// Why a driver at all: the platform object store (APP_STORAGE_PRESIGN_URL /
// APP_STORAGE_TOKEN) is not configured on the production deployment, so every
// upload and every ingest "save" failed. R2 gives the store its own bucket with
// 10 GB free, 1M Class A + 10M Class B operations/month and $0 egress.
//
// The signing helpers are exported individually so they can be unit-tested
// without a network — including against the published AWS SigV4 test vector.
//
// Everything here reads credentials from the ENVIRONMENT ONLY. No value is ever
// logged: `describeR2()` reports which variables are SET, never what they hold.

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";

/** The five variables that switch this driver on. Names only, never values. */
export const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** The bucket's public base (an `r2.dev` subdomain or a custom domain), with
   *  NO trailing slash. Objects are served at `${publicBaseUrl}/${key}`. */
  publicBaseUrl: string;
}

/** The host that serves the S3 API for this account. */
export function r2EndpointHost(accountId: string): string {
  return `${accountId}.r2.cloudflarestorage.com`;
}

/** Read the R2 config, or null when it is not fully present. Partial config is
 *  treated as ABSENT (and reported), never as a half-working driver. */
export function r2ConfigFromEnv(get: (name: string) => string | undefined = (n) => process.env[n]): R2Config | null {
  const accountId = get("R2_ACCOUNT_ID")?.trim() ?? "";
  const accessKeyId = get("R2_ACCESS_KEY_ID")?.trim() ?? "";
  const secretAccessKey = get("R2_SECRET_ACCESS_KEY")?.trim() ?? "";
  const bucket = get("R2_BUCKET")?.trim() ?? "";
  const publicBaseUrl = (get("R2_PUBLIC_BASE_URL")?.trim() ?? "").replace(/\/+$/, "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

/** Which of the five variables are set. For a startup log line — NEVER values. */
export function describeR2(get: (name: string) => string | undefined = (n) => process.env[n]): string[] {
  return R2_ENV_KEYS.filter((k) => Boolean(get(k)?.trim()));
}

export function isR2Configured(get?: (name: string) => string | undefined): boolean {
  return r2ConfigFromEnv(get) !== null;
}

// ── primitives ────────────────────────────────────────────────────────────────

export function byteToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return byteToHex(new Uint8Array(digest));
}

export async function hmacSha256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

/** RFC 3986 encoding, as AWS requires. Unreserved characters are kept; `/` is
 *  kept only in the canonical URI, and each UTF-8 byte of anything else becomes
 *  `%XX` uppercase — a lowercase hex digit is a silent 403 from S3. */
export function awsUriEncode(input: string, encodeSlash: boolean): string {
  let out = "";
  for (const ch of input) {
    if (/[A-Za-z0-9\-._~]/.test(ch)) {
      out += ch;
    } else if (ch === "/") {
      out += encodeSlash ? "%2F" : "/";
    } else {
      for (const b of new TextEncoder().encode(ch)) out += "%" + b.toString(16).toUpperCase().padStart(2, "0");
    }
  }
  return out;
}

/** Canonical query string: sorted by key, then by value, each encoded. */
export function canonicalQueryString(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((k) => `${awsUriEncode(k, true)}=${awsUriEncode(params[k]!, true)}`)
    .join("&");
}

/** `YYYYMMDDTHHMMSSZ`. */
export function amzDate(now: Date): string {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

export function dateStamp(amz: string): string {
  return amz.slice(0, 8);
}

/** The SigV4 signing key: HMAC chain over date / region / service / terminator. */
export async function signingKey(secretAccessKey: string, date: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), date);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

export interface SignInput {
  method: string;
  host: string;
  /** Already URI-encoded path, no query, always starting with `/`. */
  canonicalUri: string;
  query?: Record<string, string>;
  /** Headers that participate in the signature. `host` must be present. */
  headers: Record<string, string>;
  /** Hex sha256 of the body, or `UNSIGNED-PAYLOAD` for a presigned URL. */
  payloadHash: string;
  accessKeyId: string;
  secretAccessKey: string;
  amzDate: string;
  region?: string;
  service?: string;
}

export interface SignedRequest {
  canonicalRequest: string;
  stringToSign: string;
  authorization: string;
  signedHeaders: string;
  signature: string;
}

/** Compute the Authorization header for a request. Pure given its inputs (the
 *  timestamp is passed in), which is what makes the AWS test vector usable. */
export async function signRequest(input: SignInput): Promise<SignedRequest> {
  const region = input.region ?? R2_REGION;
  const service = input.service ?? R2_SERVICE;
  const date = dateStamp(input.amzDate);

  // Headers are lower-cased and trimmed for signing; `host` is always included.
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.headers)) lower[k.toLowerCase()] = String(v).trim();
  lower["host"] = input.host;
  const signedHeaderNames = Object.keys(lower).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${lower[h]}\n`).join("");

  const canonicalRequest = [
    input.method.toUpperCase(),
    input.canonicalUri,
    canonicalQueryString(input.query ?? {}),
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const scope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = [ALGORITHM, input.amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");
  const key = await signingKey(input.secretAccessKey, date, region, service);
  const signature = byteToHex(await hmacSha256(key, stringToSign));

  const authorization =
    `${ALGORITHM} Credential=${input.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { canonicalRequest, stringToSign, authorization, signedHeaders, signature };
}

// ── the driver ────────────────────────────────────────────────────────────────

export class R2Error extends Error {
  constructor(message: string, readonly code: "not_configured" | "not_found" | "failed") {
    super(message);
    this.name = "R2Error";
  }
}

function requireConfig(cfg?: R2Config | null): R2Config {
  const c = cfg ?? r2ConfigFromEnv();
  if (!c) throw new R2Error("Cloudflare R2 is not configured on this deployment.", "not_configured");
  return c;
}

/** The same-origin-able public URL for a key. */
export function r2PublicUrl(key: string, cfg?: R2Config | null): string {
  const c = requireConfig(cfg);
  return `${c.publicBaseUrl}/${key.replace(/^\/+/, "")}`;
}

/** Canonical URI for a key: path-style addressing, slashes preserved. */
function objectPath(bucket: string, key: string): string {
  return `/${awsUriEncode(bucket, false)}/${awsUriEncode(key.replace(/^\/+/, ""), false)}`;
}

async function signedFetch(
  method: "GET" | "PUT" | "HEAD" | "DELETE",
  key: string,
  opts: { body?: Uint8Array; contentType?: string } = {},
  cfg?: R2Config | null,
): Promise<Response> {
  const c = requireConfig(cfg);
  const host = r2EndpointHost(c.accountId);
  const canonicalUri = objectPath(c.bucket, key);
  const amz = amzDate(new Date());
  const payloadHash = opts.body ? await sha256Hex(opts.body) : await sha256Hex("");

  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;

  const signed = await signRequest({
    method,
    host,
    canonicalUri,
    query: {},
    headers,
    payloadHash,
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    amzDate: amz,
  });

  const res = await fetch(`https://${host}${canonicalUri}`, {
    method,
    headers: { ...headers, authorization: signed.authorization },
    body: opts.body ? (opts.body as unknown as BodyInit) : undefined,
  });
  return res;
}

/** Upload bytes, overwriting any existing object at the key. */
export async function r2Put(
  key: string,
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
  cfg?: R2Config | null,
): Promise<{ url: string; size: number }> {
  const res = await signedFetch("PUT", key, { body: bytes, contentType }, cfg);
  if (!res.ok) throw new R2Error(`R2 upload failed: ${res.status}`, "failed");
  return { url: r2PublicUrl(key, cfg), size: bytes.byteLength };
}

/** Object metadata, or null when the key does not exist. */
export async function r2Head(key: string, cfg?: R2Config | null): Promise<{ size: number; contentType: string | null } | null> {
  const res = await signedFetch("HEAD", key, {}, cfg);
  if (res.status === 404) return null;
  if (!res.ok) throw new R2Error(`R2 head failed: ${res.status}`, "failed");
  const len = Number(res.headers.get("content-length") ?? "");
  return {
    size: Number.isFinite(len) ? len : 0,
    contentType: res.headers.get("content-type"),
  };
}

/** Delete a key. Returns false when it was already absent (not an error). */
export async function r2Delete(key: string, cfg?: R2Config | null): Promise<boolean> {
  const res = await signedFetch("DELETE", key, {}, cfg);
  if (res.status === 404) return false;
  if (!res.ok) throw new R2Error(`R2 delete failed: ${res.status}`, "failed");
  return true;
}

/**
 * A presigned GET URL. Used by the `/app-storage/*` route (see _core/storage.ts)
 * so a key can be served from OUR origin even when the bucket is private — which
 * is what keeps the bucket's own hostname out of the page.
 */
export async function r2PresignGet(
  key: string,
  expiresInSeconds = 900,
  cfg?: R2Config | null,
  now: Date = new Date(),
): Promise<string> {
  const c = requireConfig(cfg);
  const host = r2EndpointHost(c.accountId);
  const canonicalUri = objectPath(c.bucket, key);
  const amz = amzDate(now);
  const scope = `${dateStamp(amz)}/${R2_REGION}/${R2_SERVICE}/aws4_request`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${c.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const signed = await signRequest({
    method: "GET",
    host,
    canonicalUri,
    query,
    headers: { host },
    payloadHash: "UNSIGNED-PAYLOAD",
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    amzDate: amz,
  });
  return `https://${host}${canonicalUri}?${canonicalQueryString(query)}&X-Amz-Signature=${signed.signature}`;
}

/**
 * A presigned PUT URL, so the BROWSER can upload a product image straight to R2
 * without ever holding a credential and without the bytes passing through the
 * serverless function (which has a request-body limit). `X-Amz-SignedHeaders` is
 * just `host`, so the uploader may send its own `content-type` — R2 records that
 * as the object's type, exactly as the storefront needs.
 */
export async function r2PresignPut(
  key: string,
  contentType?: string,
  expiresInSeconds = 900,
  cfg?: R2Config | null,
  now: Date = new Date(),
): Promise<string> {
  const c = requireConfig(cfg);
  const host = r2EndpointHost(c.accountId);
  const canonicalUri = objectPath(c.bucket, key);
  const amz = amzDate(now);
  const scope = `${dateStamp(amz)}/${R2_REGION}/${R2_SERVICE}/aws4_request`;

  const query: Record<string, string> = {
    "X-Amz-Algorithm": ALGORITHM,
    "X-Amz-Credential": `${c.accessKeyId}/${scope}`,
    "X-Amz-Date": amz,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const signed = await signRequest({
    method: "PUT",
    host,
    canonicalUri,
    query,
    headers: { host },
    payloadHash: "UNSIGNED-PAYLOAD",
    accessKeyId: c.accessKeyId,
    secretAccessKey: c.secretAccessKey,
    amzDate: amz,
  });
  void contentType; // not signed: the uploader declares it on the request
  return `https://${host}${canonicalUri}?${canonicalQueryString(query)}&X-Amz-Signature=${signed.signature}`;
}
