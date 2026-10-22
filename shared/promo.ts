// The home page's two promo cards are ADMIN-CONTROLLED and DATABASE-BACKED.
//
// The owner picks one product for each card in the admin panel; the storefront
// reads that choice from the database at request time, so changing the pick
// updates the live home page on the next load with no redeploy. This module
// holds the parts that are PURE and shared by both sides - the setting keys, the
// fallback rule, and the conversion copy - so the server resolves a slot and the
// client renders it from the SAME logic, and both are unit-testable without a
// database.
//
// NOTHING HERE IS HARDCODED TO A PRODUCT. The copy is derived from the real
// product's own data (name, price, markdown, rating), so it stays accurate as
// the catalogue changes and never names a product the store does not sell.

import type { SettingsMap } from "./store";

export type PromoKind = "new_arrivals" | "best_sellers";

export const PROMO_KINDS: PromoKind[] = ["new_arrivals", "best_sellers"];

/** The two `store_settings` keys that hold the owner's picks.
 *
 *  An EMPTY STRING means "no explicit pick" - the slot then falls back to the
 *  best available product rather than rendering an empty card. Storing the
 *  selection in the existing key/value settings table (rather than a new table)
 *  keeps it admin-editable and read on every request with no schema change.
 *
 *  Typed as `keyof SettingsMap` so a rename of either setting is a compile error
 *  here rather than a silent miss at runtime. */
export const PROMO_SETTING_KEYS: Record<PromoKind, keyof SettingsMap> = {
  new_arrivals: "promo_new_arrivals_product_id",
  best_sellers: "promo_best_sellers_product_id",
};

/** The minimum a product must expose for the copy engine to describe it. Kept
 *  structural (not the full StoreProduct) so the server and the client can both
 *  satisfy it without importing each other's types. */
export interface PromoProductLike {
  name: string;
  priceCents: number;
  compareAtCents?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  featured?: boolean;
}

export interface PromoCardCopy {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
}

/** Whole-percent discount, or null when there is no genuine markdown. A
 *  compare-at price at or below the live price is not a discount, so it is
 *  ignored rather than advertised. */
export function discountPercent(p: PromoProductLike): number | null {
  const was = p.compareAtCents;
  if (typeof was !== "number" || was <= p.priceCents) return null;
  return Math.round((1 - p.priceCents / was) * 100);
}

/** A real, non-zero rating backed by at least one review - the only case where
 *  quoting a rating is honest. A product with no reviews never gets a star
 *  claim. */
export function hasRating(p: PromoProductLike): boolean {
  return typeof p.rating === "number" && p.rating > 0 && (p.reviewCount ?? 0) > 0;
}

/** The eyebrow for a slot - the card's own label, independent of the product. */
export function promoEyebrow(kind: PromoKind): string {
  return kind === "new_arrivals" ? "Just landed" : "Featured";
}

/**
 * The card's conversion copy, derived from the REAL product.
 *
 * The heading is the product's own name (the strongest, most honest conversion
 * element - it is exactly what the shopper will see on the product page), and
 * the supporting line is chosen from the product's real signals in priority
 * order: a genuine markdown, then a real rating, then a plain, warm line. The
 * two slots therefore read differently even when the store carries a single
 * product, because each frames the same product for its own intent (new vs
 * proven) rather than repeating one boilerplate sentence.
 */
export function promoCardCopy(kind: PromoKind, p: PromoProductLike): PromoCardCopy {
  const off = discountPercent(p);
  const rated = hasRating(p);
  const rating = rated ? (p.rating as number).toFixed(1) : "";
  const count = p.reviewCount ?? 0;

  if (kind === "new_arrivals") {
    const body = off
      ? `New this week - now ${off}% off.`
      : rated
        ? `New this week - rated ${rating} out of 5 by ${count} shopper${count === 1 ? "" : "s"}.`
        : "New this week - the latest addition to the range.";
    return { eyebrow: promoEyebrow(kind), title: p.name, body, cta: "Shop now" };
  }

  const body = rated
    ? `Loved by ${count} shopper${count === 1 ? "" : "s"} - ${rating} out of 5.`
    : off
      ? `Now ${off}% off.`
      : "Handpicked by us - a solid everyday pick.";
  return { eyebrow: promoEyebrow(kind), title: p.name, body, cta: "Shop now" };
}

/** Where a resolved slot's product came from. `selected` = the owner's explicit
 *  pick; `fallback` = the pick was missing, deleted or unpublished, so the slot
 *  filled itself with the best available product instead of breaking. */
export type PromoSource = "selected" | "fallback";

/**
 * Choose the product for ONE slot.
 *
 * The owner's pick wins when it is present in `candidates` (which the caller
 * passes as ACTIVE products only, so a deleted or unpublished pick is simply
 * absent). Otherwise the first candidate is used - the caller orders that list
 * by the slot's own rule (newest for new arrivals, most-ordered for best
 * sellers). Returns null only when there is no candidate at all, which is the
 * one case the card is hidden rather than shown empty.
 *
 * `excludeId` keeps the FALLBACK from repeating the product a sibling slot
 * already took: two cards showing the identical product reads as a bug to a
 * shopper, and a store with several products should promote two of them. It is
 * deliberately NOT applied to an explicit pick - if the owner deliberately puts
 * the same product in both cards, that intent is honoured. A single-product
 * store still shows that product in both slots, because an excluded-to-nothing
 * fallback would otherwise empty the card.
 */
export function pickPromoProduct<T extends { id: string }>(
  selectedId: string | null | undefined,
  candidates: readonly T[],
  excludeId?: string | null,
): { product: T; source: PromoSource } | null {
  if (candidates.length === 0) return null;
  const wanted = (selectedId ?? "").trim();
  if (wanted) {
    const match = candidates.find((c) => c.id === wanted);
    if (match) return { product: match, source: "selected" };
  }
  const avoid = (excludeId ?? "").trim();
  const first = avoid ? (candidates.find((c) => c.id !== avoid) ?? candidates[0]) : candidates[0];
  return { product: first, source: "fallback" };
}
