// Upstream supplier API client (api2.0 / v1).
//
// WHAT THIS IS. A thin, honest wrapper over CJ's own REST API - the ONLY route
// that fits a custom React + Node storefront. CJ's ready-made plugins (Shopify,
// WooCommerce, Wix, Shoplazza, Temu, TikTok, eBay, Etsy, the ERP platforms) all
// need a platform underneath to attach to, and this store has none. The "API /
// Others" option is the correct one, and this module is that integration.
//
// EVERY ENDPOINT AND FIELD HERE IS TAKEN FROM CJ'S OWN DOCUMENTATION
// (the supplier's own developer documentation). Nothing is guessed:
//   - base URL            https://developers.cjdropshipping.com/api2.0/v1
//   - auth                POST /authentication/getAccessToken  { apiKey }
//   - refresh             POST /authentication/refreshAccessToken { refreshToken }
//   - create order        POST /shopping/order/createOrderV2
//   - order detail        GET  /shopping/order/getOrderDetail?orderId=
//   - logistics/tracking  GET  /shopping/order/getOrderLogisticsInfo?orderCode=
//   - variant stock       GET  /product/stock/queryByVid?vid=
//
// THREE PROPERTIES CJ IMPOSES, HANDLED HERE SO CALLERS DO NOT HAVE TO:
//   1. QPS = 1. CJ rate-limits to ONE request per second per account. Every call
//      goes through a serial queue that spaces requests at least 1000ms apart,
//      so a burst of stock lookups cannot trip the limit and get the account
//      throttled.
//   2. 180-day tokens. The access token lives 180 days; the refresh token longer.
//      The token is cached in-process with its real expiry and refreshed
//      proactively, so a long-lived process never calls with a dead token.
//   3. Sandbox by default. Orders are created with `isSandbox: 1` unless
//      CJ_LIVE_MODE is explicitly set, so a misconfiguration cannot place a real
//      supplier order. Sandbox orders use simulated payment and are never
//      fulfilled (CJ's own wording).
//
// FAIL-SAFE. With no CJ_API_KEY the client throws CjNotConfiguredError from
// every method. Callers (order forwarding, the sync jobs) catch that and log a
// clear "not configured" line - they never crash checkout and never pretend a
// forward succeeded.
import { env } from "../_core/env";
import { outboundFetch } from "../_core/fetch";

/** CJ's single API host. There is no separate sandbox HOST - sandbox is a flag
 *  on the order (`isSandbox`), not a different base URL. */
export const CJ_API_BASE = "https://developers.cjdropshipping.com/api2.0/v1";

/** Thrown when the integration is not configured (no API key). Callers treat
 *  this as "do nothing, log clearly", never as a hard failure. */
export class CjNotConfiguredError extends Error {
  constructor() {
    super("Upstream supplier API is not configured (CJ_API_KEY is unset).");
    this.name = "CjNotConfiguredError";
  }
}

/** Thrown when CJ answers with a non-2xx HTTP status or `code !== 200`. */
export class CjApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "CjApiError";
  }
}

/** The envelope every CJ endpoint returns. */
interface CjEnvelope<T> {
  code: number;
  result: boolean;
  message: string;
  data: T;
  requestId?: string;
  success?: boolean;
}

export interface CjToken {
  accessToken: string;
  /** ISO timestamp the access token expires (CJ: default 180 days). */
  accessTokenExpiryDate: string;
  refreshToken: string;
  refreshTokenExpiryDate: string;
}

export interface CjOrderLine {
  /** CJ variant id - the exact option to fulfil. */
  vid: string;
  quantity: number;
  /** The store's own line id, echoed back by CJ for reconciliation. */
  storeLineItemId?: string;
}

export interface CjCreateOrderInput {
  /** Our order number - CJ stores it as the platform order id. */
  orderNumber: string;
  shippingCountryCode: string;
  shippingCountry: string;
  shippingProvince: string;
  shippingCity: string;
  shippingCustomerName: string;
  shippingAddress: string;
  shippingAddress2?: string;
  shippingZip?: string;
  shippingPhone?: string;
  email?: string;
  /** CJ logistics route name (e.g. "CJPacket Ordinary"). Required by CJ. */
  logisticName: string;
  /** Origin country code, two letters. */
  fromCountryCode: string;
  products: CjOrderLine[];
  remark?: string;
  /** Override the sandbox default for this one call. */
  isSandbox?: boolean;
}

export interface CjCreateOrderResult {
  orderId: string;
  orderNumber: string;
  cjOrderId?: string;
  orderStatus?: string;
  orderAmount?: string;
  postageAmount?: string;
  productAmount?: string;
  raw: unknown;
}

export interface CjOrderDetail {
  orderId: string;
  orderNum?: string;
  cjOrderId?: string | null;
  orderStatus?: string;
  trackNumber?: string | null;
  trackingProvider?: string | null;
  logisticName?: string | null;
  raw: unknown;
}

export interface CjStockRow {
  vid: string;
  areaEn?: string;
  countryCode?: string;
  totalInventoryNum?: number;
  cjInventoryNum?: number;
  factoryInventoryNum?: number;
}

/** One variant of a supplier product, as `/product/query` returns it.
 *
 *  `variantSellPrice` is the REAL supplier cost for that exact option (the
 *  carrier bag's Dark-grey-M is $10.75 while Dark-grey-XL is $11.65), which is
 *  what per-variant pricing is derived from. `variantSugSellPrice` is CJ's own
 *  suggested retail, kept for reference only - the store applies its own
 *  documented rule (shared/pricing.ts). */
export interface CjProductVariant {
  vid: string;
  variantSku?: string;
  /** The supplier's own option value for this variant (e.g. "S", "Black"). */
  variantKey?: string;
  /** The real supplier cost, USD. */
  variantSellPrice?: number | string;
  /** CJ's suggested retail, USD. Reference only. */
  variantSugSellPrice?: number | string;
  variantImage?: string | null;
  variantStandard?: string | null;
}

/** A supplier product, as `/product/query?pid=` returns it. */
export interface CjProductDetail {
  pid: string;
  productNameEn?: string;
  productSku?: string;
  /** The supplier's own option-dimension token(s), e.g. `["Size"]`. */
  productKeyEn?: string;
  variants: CjProductVariant[];
  raw: unknown;
}

/** A fetch-shaped function, injectable so tests can mock the HTTP boundary. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

// ── QPS = 1 serial queue ─────────────────────────────────────────────────────
// CJ allows one request per second. Rather than sprinkle sleeps at call sites,
// every request funnels through this queue, which guarantees at least
// MIN_INTERVAL_MS between the START of consecutive requests. A promise chain
// serialises them; the timestamp is read at dispatch, not at enqueue, so a slow
// request does not let the next one fire early.
//
// The interval is overridable ONLY so the test suite does not spend a real
// second per call; production always uses CJ's 1000ms. Read lazily (not at
// module load) so a test can set the env var after imports have hoisted.
function minIntervalMs(): number {
  const raw = Number(process.env.CJ_MIN_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 1000;
}
let queueTail: Promise<unknown> = Promise.resolve();
let lastDispatchAt = 0;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = minIntervalMs() - (Date.now() - lastDispatchAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastDispatchAt = Date.now();
    return task();
  });
  // Keep the chain alive even if a task rejects, so one failure does not wedge
  // every later request.
  queueTail = run.catch(() => undefined);
  return run;
}

// ── Token cache ──────────────────────────────────────────────────────────────
// In-process, keyed by nothing (one account per deployment). CJ itself caches
// the token server-side for 24h, so a cold start re-fetching is cheap and
// correct. We refresh 24h before the real expiry to leave a wide margin.
let cachedToken: CjToken | null = null;

function tokenIsFresh(token: CjToken | null): boolean {
  if (!token) return false;
  const expiry = Date.parse(token.accessTokenExpiryDate);
  if (Number.isNaN(expiry)) return false;
  return expiry - Date.now() > 24 * 60 * 60 * 1000;
}

/** Test seam: drop the cached token. */
export function resetCjTokenCache(): void {
  cachedToken = null;
}

export interface CjClientOptions {
  /** Override the fetch implementation (tests). */
  fetchImpl?: FetchLike;
  /** Override the API key (tests). Defaults to env. */
  apiKey?: string;
  /** Override sandbox mode (tests). Defaults to env. */
  liveMode?: boolean;
}

export class CjClient {
  private readonly fetchImpl: FetchLike;
  private readonly apiKey: string;
  private readonly liveMode: boolean;

  constructor(opts: CjClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((url, init) => outboundFetch(url, { ...init, timeoutMs: 30_000 }));
    // Read env defensively: some tests mock `_core/env` with a partial object,
    // and a module-level client must not throw at import time just because the
    // mock has no `cj` key. A missing key simply means "not configured".
    this.apiKey = opts.apiKey ?? env.cj?.apiKey ?? "";
    this.liveMode = opts.liveMode ?? env.cj?.liveMode ?? false;
  }

  /** Is the integration configured? Callers check this to decide whether to
   *  attempt a forward at all, so an unconfigured store logs one clear line
   *  instead of throwing per order. */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Sandbox unless live mode is explicitly on. */
  get sandbox(): boolean {
    return !this.liveMode;
  }

  private requireKey(): string {
    if (!this.apiKey) throw new CjNotConfiguredError();
    return this.apiKey;
  }

  /** How many times a rate-limited (429) or transient (5xx) response is retried
   *  before the call is reported as failed. CJ enforces its QPS window server
   *  side, so a burst that is spaced perfectly from our side can still draw a
   *  429; retrying with exponential backoff turns that into a short pause rather
   *  than a lost stock/tracking update. */
  private static readonly MAX_RETRIES = 4;

  /** Low-level request: enqueued (QPS=1), envelope-checked, error-normalised.
   *  A 429 or 5xx is retried with exponential backoff (1s, 2s, 4s, 8s). */
  private async request<T>(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; token?: string },
  ): Promise<T> {
    const url = `${CJ_API_BASE}${path}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (init.token) headers["CJ-Access-Token"] = init.token;

    for (let attempt = 0; ; attempt += 1) {
      const res = await enqueue(() =>
        this.fetchImpl(url, {
          method: init.method,
          headers,
          ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        }),
      );

      let json: CjEnvelope<T> | null = null;
      try {
        json = (await res.json()) as CjEnvelope<T>;
      } catch {
        json = null;
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < CjClient.MAX_RETRIES) {
        const backoff = 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        throw new CjApiError(`CJ ${path} failed with HTTP ${res.status}`, res.status, json);
      }
      if (!json || json.code !== 200 || json.result === false) {
        throw new CjApiError(
          `CJ ${path} returned code ${json?.code ?? "?"}: ${json?.message ?? "no message"}`,
          res.status,
          json,
        );
      }
      return json.data;
    }
  }

  /** Fetch (or reuse) an access token. Refreshes when the cached one is near
   *  expiry, falling back to a full re-auth if the refresh itself fails. */
  async getToken(): Promise<string> {
    const key = this.requireKey();
    if (tokenIsFresh(cachedToken)) return cachedToken!.accessToken;

    // Try the refresh token first when we have one - it is the cheaper call and
    // is what CJ intends for a long-lived integration.
    if (cachedToken?.refreshToken) {
      try {
        const refreshed = await this.request<CjToken>("/authentication/refreshAccessToken", {
          method: "POST",
          body: { refreshToken: cachedToken.refreshToken },
        });
        cachedToken = refreshed;
        return refreshed.accessToken;
      } catch {
        // Fall through to a full re-auth - a dead refresh token must not wedge
        // the integration.
      }
    }

    const fresh = await this.request<CjToken>("/authentication/getAccessToken", {
      method: "POST",
      body: { apiKey: key },
    });
    cachedToken = fresh;
    return fresh.accessToken;
  }

  /** Push a paid order to CJ. Sandbox unless live mode is on. */
  async createOrder(input: CjCreateOrderInput): Promise<CjCreateOrderResult> {
    const token = await this.getToken();
    const isSandbox = input.isSandbox ?? this.sandbox;
    const body = {
      orderNumber: input.orderNumber,
      shippingZip: input.shippingZip ?? "",
      shippingCountry: input.shippingCountry,
      shippingCountryCode: input.shippingCountryCode,
      shippingProvince: input.shippingProvince,
      shippingCity: input.shippingCity,
      shippingPhone: input.shippingPhone ?? "",
      shippingCustomerName: input.shippingCustomerName,
      shippingAddress: input.shippingAddress,
      shippingAddress2: input.shippingAddress2 ?? "",
      email: input.email ?? "",
      remark: input.remark ?? "",
      // 3 = create the order only; do NOT return a payment page. The store pays
      // from its CJ wallet balance, which is the dropshipping model.
      payType: 3,
      isSandbox: isSandbox ? 1 : 0,
      logisticName: input.logisticName,
      fromCountryCode: input.fromCountryCode,
      platform: "Api",
      products: input.products.map((p) => ({
        vid: p.vid,
        quantity: p.quantity,
        ...(p.storeLineItemId ? { storeLineItemId: p.storeLineItemId } : {}),
      })),
    };

    const data = await this.request<{
      orderId: string;
      orderNumber: string;
      cjOrderId?: string;
      orderStatus?: string;
      orderAmount?: string;
      postageAmount?: string;
      productAmount?: string;
    }>("/shopping/order/createOrderV2", { method: "POST", body, token });

    return {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      cjOrderId: data.cjOrderId,
      orderStatus: data.orderStatus,
      orderAmount: data.orderAmount,
      postageAmount: data.postageAmount,
      productAmount: data.productAmount,
      raw: data,
    };
  }

  /** Order detail - carries `trackNumber` and `trackingProvider` once shipped. */
  async getOrderDetail(orderId: string): Promise<CjOrderDetail> {
    const token = await this.getToken();
    const data = await this.request<{
      orderId: string;
      orderNum?: string;
      cjOrderId?: string | null;
      orderStatus?: string;
      trackNumber?: string | null;
      trackingProvider?: string | null;
      logisticName?: string | null;
    }>(`/shopping/order/getOrderDetail?orderId=${encodeURIComponent(orderId)}`, {
      method: "GET",
      token,
    });
    return {
      orderId: data.orderId,
      orderNum: data.orderNum,
      cjOrderId: data.cjOrderId,
      orderStatus: data.orderStatus,
      trackNumber: data.trackNumber,
      trackingProvider: data.trackingProvider,
      logisticName: data.logisticName,
      raw: data,
    };
  }

  /** Optional logistics for an order, keyed by the CJ order code (DP…/SD…). */
  async getOrderLogisticsInfo(orderCode: string): Promise<unknown[]> {
    const token = await this.getToken();
    return this.request<unknown[]>(
      `/shopping/order/getOrderLogisticsInfo?orderCode=${encodeURIComponent(orderCode)}`,
      { method: "GET", token },
    );
  }

  /** Per-warehouse stock for one variant. */
  async queryStockByVid(vid: string): Promise<CjStockRow[]> {
    const token = await this.getToken();
    return this.request<CjStockRow[]>(
      `/product/stock/queryByVid?vid=${encodeURIComponent(vid)}`,
      { method: "GET", token },
    );
  }

  /** The supplier's own product detail, including every variant's REAL cost.
   *
   *  This is the source of per-variant pricing: `variants[].variantSellPrice` is
   *  the live supplier cost for that exact option, matched to a store row by
   *  `vid`. Read-only - it never mutates anything on CJ's side. */
  async getProductDetail(pid: string): Promise<CjProductDetail> {
    const token = await this.getToken();
    const data = await this.request<{
      pid: string;
      productNameEn?: string;
      productSku?: string;
      productKeyEn?: string;
      variants?: CjProductVariant[];
    }>(`/product/query?pid=${encodeURIComponent(pid)}`, { method: "GET", token });
    return {
      pid: data.pid,
      productNameEn: data.productNameEn,
      productSku: data.productSku,
      productKeyEn: data.productKeyEn,
      variants: Array.isArray(data.variants) ? data.variants : [],
      raw: data,
    };
  }
}

/** The process-wide client. Tests construct their own with an injected fetch.
 *  Constructed LAZILY so importing this module never reads env at load time -
 *  a test that mocks `_core/env` with a partial object must not blow up on
 *  import. */
let _cjClient: CjClient | null = null;
export function getCjClient(): CjClient {
  if (!_cjClient) _cjClient = new CjClient();
  return _cjClient;
}
/** Back-compat alias: a proxy so `cjClient.method()` still works while the
 *  instance is created on first use. */
export const cjClient: CjClient = new Proxy({} as CjClient, {
  get(_t, prop) {
    const inst = getCjClient() as unknown as Record<string | symbol, unknown>;
    const value = inst[prop];
    return typeof value === "function" ? value.bind(inst) : value;
  },
});