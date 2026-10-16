// The SHOPPING-POLICY word guard: no product title or description may carry a
// term that gets a Merchant Center item - or the whole account - flagged as
// restricted ADULT CONTENT or as targeting shoppers by SEXUAL INTEREST.
//
// WHY THIS EXISTS. One supplier title carried the word "Boobs"
// ("American Local Tactical Pet Boobs Service Dog Harness Vest ..."). It is a
// mistranslation of a body-measurement term - the product is an ordinary
// tactical service-dog vest - but to Google's automated review it read as adult
// content, and the SAME title produced BOTH diagnostics:
//
//   * "Restricted adult content"                          -> adult-content
//   * "Personalized advertising: Sexual interests"        -> sexual interests
//
// so a term may map to MORE THAN ONE policy. The catalogue is assembled from
// supplier copy, so the fix is not one manual edit: it is a GUARD that fails the
// build if such a term ever reaches the storefront or the feed again. It is
// applied the same way `shared/supplier-guard.ts` is - in TESTS over the whole
// bundled catalogue and the built feed - so the class of problem cannot come
// back through a later catalogue import.
//
// SCOPE AND HONESTY. This is a CURATED list of unambiguous sexual/adult terms,
// not a complete classifier. It deliberately EXCLUDES words that are legitimate
// in pet copy and would otherwise fail the build for no reason:
//   - "adult"      -> "for adult dogs and puppies" is a real, common phrase
//   - "breast"     -> "breast collar" is a real dog/horse harness term
//   - "anal"       -> "anal glands" is routine pet-health/grooming vocabulary
//   - "tit"        -> "Great Tit" / "Blue Tit" are real BIRD names, and this
//                     store stocks bird supplies
// Each exclusion is a deliberate trade: a curated guard that never cries wolf is
// worth more than an exhaustive one the owner learns to ignore. The real safety
// net remains Google's own review, which is why the fix report tells the owner
// to REQUEST A REVIEW once the renamed product is live.

/** The two policies a flagged term can trip. */
export type ShoppingPolicyReason = "adult-content" | "personalized-ads-sexual-interests";

/** The human label for each reason, used in the fix report. */
export const SHOPPING_POLICY_LABEL: Record<ShoppingPolicyReason, string> = {
  "adult-content": "Restricted adult content",
  "personalized-ads-sexual-interests": "Personalized advertising: Sexual interests",
};

/**
 * One banned term with the policies it trips. A term may trip BOTH: Google
 * flagged the "Boobs" title under adult content AND under sexual-interests
 * targeting, because a sexual term is simultaneously adult-looking and a signal
 * for interest-based ad targeting.
 */
interface BannedTerm {
  pattern: RegExp;
  policies: ShoppingPolicyReason[];
}

/** A repeating, case-insensitive whole-word pattern. */
function word(...alternatives: string[]): RegExp {
  return new RegExp(`\\b(?:${alternatives.join("|")})\\b`, "i");
}

/** Sexual anatomy and slang. Banned under BOTH policies. */
const SEXUAL_TERMS: BannedTerm[] = [
  { pattern: word("boob", "boobs", "booby", "boobies"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("tits", "titties"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("breasts"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("nipples?"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("genitals?", "genitalia"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("penis"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("vagina", "vaginal", "vulva"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("sex", "sexual", "sexuality"), policies: ["personalized-ads-sexual-interests", "adult-content"] },
  { pattern: word("erotic", "erotica"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("porn", "porno", "pornographic", "xxx"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("nude", "nudity"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("fetish", "bondage", "bdsm"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("lingerie"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("orgasm", "orgasmic"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  { pattern: word("masturbat\\w*"), policies: ["adult-content", "personalized-ads-sexual-interests"] },
  // The classic euphemisms used on SEX-TOY listings. Banned as whole PHRASES so
  // a real pet accessory cannot be caught by a partial match.
  { pattern: /\badult\s+(?:content|film|films|videos?|entertainment|toys?|products?)\b/i, policies: ["adult-content"] },
  { pattern: /\badults?\s+only\b/i, policies: ["adult-content"] },
];

/**
 * Every policy reason this text trips, de-duplicated. An empty array means the
 * text is clean. A single title can return MORE THAN ONE reason - that is
 * exactly what happened with "Boobs".
 */
export function shoppingPolicyViolations(text: string | null | undefined): ShoppingPolicyReason[] {
  const value = String(text ?? "");
  if (!value) return [];
  const reasons = new Set<ShoppingPolicyReason>();
  for (const term of SEXUAL_TERMS) {
    // A fresh test per call: these patterns carry no `g` flag, so `lastIndex` is
    // never mutated, but resetting anyway keeps the helper safe if one gains it.
    term.pattern.lastIndex = 0;
    if (term.pattern.test(value)) for (const policy of term.policies) reasons.add(policy);
  }
  return [...reasons];
}

/** Does this text carry a term that would trip an adult-content or
 *  sexual-interests policy flag? */
export function violatesShoppingPolicy(text: string | null | undefined): boolean {
  return shoppingPolicyViolations(text).length > 0;
}
