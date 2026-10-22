// Store settings loader. Settings live in the `store_settings` key/value table
// (admin-editable), and each one falls back to an optional env override and then
// to the shipped default - so the storefront renders in any environment, and a
// missing key is never a crash.
import { inArray, sql } from "drizzle-orm";
import { db } from "./_core/db";
import { storeSettings } from "../drizzle/schema";
import { SETTINGS_DEFAULTS, SETTINGS_KEYS, cleanAnnouncement, normalizeLowStockThreshold, type SettingsMap } from "../shared/store";

/** Coerce a stored JSON value to the type of its default (number vs string). */
function coerce<K extends keyof SettingsMap>(key: K, raw: unknown): SettingsMap[K] {
  const fallback = SETTINGS_DEFAULTS[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof fallback === "number") {
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(/[^0-9.-]/g, ""));
    return (Number.isFinite(n) ? n : fallback) as SettingsMap[K];
  }
  return String(raw) as SettingsMap[K];
}

// A short-lived in-process cache in front of the settings row read.
//
// WHY. Nearly every page read goes through `settings.public` - the header,
// footer, announcement bar and shipping/pricing copy all need it - so a shopper
// browsing the store pays one extra `store_settings` round trip per request even
// though those rows change only when an admin presses Save. This cache absorbs
// that read.
//
// It is deliberately small and conservative:
//  - TTL-bounded, so a write that lands in a DIFFERENT process still appears
//    within CACHE_TTL_MS - there is no cross-instance invalidation to get wrong.
//  - Explicitly cleared by `updateSettings` in THIS process, so an admin sees
//    their own save at once rather than after the TTL.
//  - Populated ONLY from a successful read. A database error serves defaults for
//    that request and is never cached, so a transient outage cannot pin the
//    wrong settings (or hide a recovery) for the whole TTL.
const CACHE_TTL_MS = 15_000;
let cache: { value: SettingsMap; expiresAt: number } | null = null;

/** Drop the cached settings. Called on every write in this process. */
export function invalidateSettingsCache(): void {
  cache = null;
}

export async function getSettings(): Promise<SettingsMap> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  // The storefront reads settings on EVERY page (settings.public), so a database
  // that is unreachable or not yet migrated must NOT take the whole site down.
  // Fall back to the shipped defaults (+ any PETPARCEL_* env overrides) so the
  // header, footer and pricing copy still render; real rows always win when the
  // read succeeds. This mirrors the catalog fallback in routers.ts.
  let rows: { key: string; value: unknown }[] = [];
  let readSucceeded = false;
  try {
    rows = await db
      .select()
      .from(storeSettings)
      .where(inArray(storeSettings.key, SETTINGS_KEYS as unknown as string[]));
    readSucceeded = true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[settings] database unavailable - serving default settings", err);
  }
  const stored: Record<string, unknown> = {};
  for (const row of rows) stored[row.key] = row.value;

  const out = { ...SETTINGS_DEFAULTS } as SettingsMap;
  const target = out as unknown as Record<string, unknown>;
  for (const key of SETTINGS_KEYS) {
    // Precedence: DB value → PETPARCEL_* env override → shipped default.
    const envOverride = process.env[`PETPARCEL_${key.toUpperCase()}`];
    target[key] = coerce(key, stored[key] ?? envOverride);
  }
  // Normalise the announcement at the source: a settings row written before the
  // copy change can still hold the retired support wording, and the header
  // renders the stored value verbatim. Rewriting it here means the API itself
  // can only ever hand the client the current single line.
  out.announcement = cleanAnnouncement(out.announcement);
  // Clamp the low-stock threshold here, not only at the form: a row written by
  // hand (or an older value) must never flag the whole catalogue as low. Every
  // consumer - dashboard, products list, storefront - reads this one value.
  out.low_stock_threshold = normalizeLowStockThreshold(out.low_stock_threshold);

  // Only a genuinely-successful read is remembered (see the cache note above).
  if (readSucceeded) cache = { value: out, expiresAt: Date.now() + CACHE_TTL_MS };
  return out;
}

/** Upsert a partial patch of settings in ONE statement and return the result. */
export async function updateSettings(
  patch: Partial<Record<keyof SettingsMap, unknown>>,
): Promise<SettingsMap> {
  const valid = new Set<string>(SETTINGS_KEYS as unknown as string[]);
  const rows = Object.entries(patch)
    .filter(([key]) => valid.has(key))
    .map(([key, value]) => ({ key, value: value as unknown }));

  if (rows.length > 0) {
    await db
      .insert(storeSettings)
      .values(rows)
      .onConflictDoUpdate({
        target: storeSettings.key,
        set: { value: sql`excluded.value`, updatedAt: sql`now()` },
      });
    // A save must be visible immediately in this process - do not serve the
    // admin their previous values for the rest of the TTL.
    invalidateSettingsCache();
  }
  return getSettings();
}
