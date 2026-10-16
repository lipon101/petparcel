// Resolve the home page's two promo cards from the DATABASE at request time.
//
// The owner picks a product for each card in the admin panel; that pick is a
// product id in `store_settings`. This module turns the stored picks into the
// two fully-resolved cards the storefront renders - the real product plus its
// derived conversion copy - and applies the FALLBACK rule so a card is never
// empty or broken:
//
//   * the owner's pick wins when it is an ACTIVE product;
//   * a pick that was deleted or unpublished is simply absent, so the slot fills
//     itself with the best available product (newest for "Just landed",
//     most-ordered for "Most reordered");
//   * with no products at all the slot is null and the card is hidden.
//
// Nothing is hardcoded: the product, its image, price and link all come from the
// row, and the copy is derived from the row's own signals (see shared/promo.ts).
import { getSettings } from "./store-settings";
import { getActiveProductsByIds, listProducts, mostOrderedProducts, type ProductWithVariants } from "./db";
import {
  PROMO_SETTING_KEYS,
  pickPromoProduct,
  promoCardCopy,
  type PromoCardCopy,
  type PromoKind,
  type PromoSource,
} from "../shared/promo";

export interface PromoSlot {
  kind: PromoKind;
  product: ProductWithVariants;
  copy: PromoCardCopy;
  source: PromoSource;
}

export type PromoSlots = Record<PromoKind, PromoSlot | null>;

/** Resolve ONE slot: the owner's pick if it is live, else the first fallback
 *  candidate. The selected product is fetched explicitly and PREPENDED to the
 *  candidates, so an owner can feature a product that is not in the default
 *  newest / most-ordered list and it still wins.
 *
 *  `excludeId` is the product a sibling slot already took, and it only steers the
 *  FALLBACK - an explicit pick is always honoured. */
async function resolveSlot(
  kind: PromoKind,
  selectedId: string | null | undefined,
  fallbackCandidates: readonly ProductWithVariants[],
  excludeId?: string | null,
): Promise<PromoSlot | null> {
  const wanted = (selectedId ?? "").trim();
  let candidates: ProductWithVariants[] = [...fallbackCandidates];
  if (wanted) {
    const [picked] = await getActiveProductsByIds([wanted]);
    if (picked) candidates = [picked, ...candidates.filter((c) => c.id !== picked.id)];
  }
  const chosen = pickPromoProduct(wanted, candidates, excludeId);
  if (!chosen) return null;
  return {
    kind,
    product: chosen.product,
    copy: promoCardCopy(kind, chosen.product),
    source: chosen.source,
  };
}

/** The two resolved promo cards for the home page. */
export async function resolvePromoSlots(): Promise<PromoSlots> {
  const settings = await getSettings();
  // The fallback pools: newest active products for "Just landed", most-ordered
  // (topped up with newest) for "Most reordered". Both are real catalogue reads.
  const [newest, best] = await Promise.all([
    listProducts({ sort: "newest", limit: 8 }),
    mostOrderedProducts(8),
  ]);
  // Settings values are `string | number`; a product id is always a string, so
  // coerce defensively rather than trusting the stored type.
  const asId = (v: string | number | undefined) => (v == null ? "" : String(v));
  // Resolve "Just landed" first, then let "Most reordered" avoid whatever it
  // took. Sequential rather than parallel on purpose: the second slot's fallback
  // needs the first slot's RESULT to avoid showing the same product twice.
  const newArrivals = await resolveSlot(
    "new_arrivals",
    asId(settings[PROMO_SETTING_KEYS.new_arrivals]),
    newest,
  );
  const bestSellers = await resolveSlot(
    "best_sellers",
    asId(settings[PROMO_SETTING_KEYS.best_sellers]),
    best,
    newArrivals?.product.id,
  );
  return { new_arrivals: newArrivals, best_sellers: bestSellers };
}
