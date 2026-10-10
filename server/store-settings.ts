// Store settings loader. Settings live in the `store_settings` key/value table
// (admin-editable), and each one falls back to an optional env override and then
// to the shipped default — so the storefront renders in any environment, and a
// missing key is never a crash.
import { inArray, sql } from "drizzle-orm";
import { db } from "./_core/db";
import { storeSettings } from "../drizzle/schema";
import { SETTINGS_DEFAULTS, SETTINGS_KEYS, type SettingsMap } from "../shared/store";

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

export async function getSettings(): Promise<SettingsMap> {
  const rows = await db
    .select()
    .from(storeSettings)
    .where(inArray(storeSettings.key, SETTINGS_KEYS as unknown as string[]));
  const stored: Record<string, unknown> = {};
  for (const row of rows) stored[row.key] = row.value;

  const out = { ...SETTINGS_DEFAULTS } as SettingsMap;
  const target = out as unknown as Record<string, unknown>;
  for (const key of SETTINGS_KEYS) {
    // Precedence: DB value → PETPARCEL_* env override → shipped default.
    const envOverride = process.env[`PETPARCEL_${key.toUpperCase()}`];
    target[key] = coerce(key, stored[key] ?? envOverride);
  }
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
  }
  return getSettings();
}
