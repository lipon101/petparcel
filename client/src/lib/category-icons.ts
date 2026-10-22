// One line icon per category, so the category control reads as a set of real
// aisles rather than a wall of identical paws.
//
// WHY THE FIRST VERSION SHOWED A GENERIC DOT. This map was keyed by the store's
// ORIGINAL pet-niche names ("Crates & Carriers", "Collars, Leashes & Harnesses",
// ...). The browse taxonomy was later replaced by the supplier catalogue's own
// aisles ("Pet Outdoor Supplies", "Pet Collars, Harnesses & Accessories", ...),
// and NONE of the new names were keys here - so every aisle fell through to the
// `CircleDot` fallback and the roundel rail rendered five identical dots.
//
// The fix is to key the map by the REAL aisle names (shared/category-tree.ts),
// each with an icon that actually describes it, and to keep the original
// niceties as LEGACY aliases so any older row still gets a sensible mark. A name
// the map has not seen still falls back to `CircleDot` rather than rendering
// nothing, so a brand-new supplier aisle is never a blank tile.
//
// Every icon is a lucide glyph at the SAME stroke weight and box, drawn with
// `currentColor`, so a row of them stays optically even and the caller decides
// the tone.
import {
  Anchor,
  Backpack,
  BedDouble,
  Bird,
  Bone,
  Box,
  Cat,
  CircleDot,
  Container,
  Dog,
  Fish,
  GraduationCap,
  HeartPulse,
  LayoutGrid,
  Link,
  Luggage,
  Rabbit,
  Scissors,
  Shirt,
  Sofa,
  Soup,
  Utensils,
  Volleyball,
  type LucideIcon,
} from "lucide-react";

/** Icons for the store's CURRENT taxonomy (the supplier aisles the browse tree
 *  and the roundel rail actually render). Each is chosen to describe the aisle
 *  it marks, and no two VISIBLE aisles share a glyph. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // ── Current supplier aisles ─────────────────────────────────────────────────
  "Pet Furnitures": Sofa,
  "Pet Outdoor Supplies": Backpack,
  "Pet Bedding": BedDouble,
  "Pet Toys": Volleyball,
  "Pet Drinking & Feeding": Utensils,
  "Pet Collars, Harnesses & Accessories": Link,
  "Pet Groomings": Scissors,
  "Pet Apparels": Shirt,
  "Bird Supplies": Bird,
  "Fish & Aquatic Pets": Fish,

  // ── Legacy / reference taxonomy ─────────────────────────────────────────────
  // Kept so a row seeded under an earlier name still gets a real mark instead of
  // the fallback dot.
  Dogs: Dog,
  Cats: Cat,
  "Food & Treats": Bone,
  "Beds & Furniture": BedDouble,
  "Crates & Carriers": Box,
  "Collars, Leashes & Harnesses": Anchor,
  Apparel: Shirt,
  Grooming: Scissors,
  "Health & Supplements": HeartPulse,
  "Feeders & Fountains": Soup,
  "Litter & Litter Boxes": Container,
  Toys: Volleyball,
  Training: GraduationCap,
  Travel: Luggage,
  Aquatics: Fish,
  "Small Pets": Rabbit,
  Birds: Bird,
  Feeding: Soup,
  "Travel & Outdoors": Luggage,
};

/** The icon for a category name. Never returns null - an unknown category gets a
 *  neutral dot so the control can always draw something. */
export function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] ?? CircleDot;
}

/** The icon used for the "All categories" affordance - the whole catalog at a
 *  glance. A grid of tiles, matching the home rail's own "All categories" tile,
 *  so both surfaces mark the same action with the same mark. */
export const ALL_CATEGORIES_ICON: LucideIcon = LayoutGrid;

export { CATEGORY_ICONS };
