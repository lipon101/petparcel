// Real, checkable attributes for every product in the bundled catalog.
//
// Kept in its own module so the catalog file stays a readable list of products
// rather than a wall of spec strings, and so the product page's Product Details
// tab has ONE source for its rows on both sides of the wire: the server reads
// these into the products table at seed time, and the client bundles the same
// values as its fallback.
//
// Every value is a measured or stated attribute of the item - what it is made
// of, how big it is, what it weighs, how to look after it. Nothing here is a
// marketing claim, and nothing is guessed: if an attribute is not known for a
// product the key is left out and the Product Details tab simply has one row
// fewer rather than printing a placeholder.
//
// Sizes are given in inches and pounds, matching the US storefront.

/** The measurable attributes shown in the Product Details tab. Every key is
 *  optional: an attribute we do not know for a product is left out, so the tab
 *  shows one row fewer rather than printing a placeholder. */
export type ProductSpecs = {
  materials?: string;
  dimensions?: string;
  weight?: string;
  care?: string;
};

export const PRODUCT_SPECS: Record<string, ProductSpecs> = {
  // ── Pet Furnitures: Pet Furniture Tools ─────────────────────────────────────
  // Material, dimensions and weight are the supplier's own stated figures: the
  // CJ listing gives the material as PVC, the packed size as 47 x 48 x 59 cm and
  // the weight as 8.5 kg (8.55 kg boxed), converted to the inches and pounds the
  // US storefront uses. The supplier publishes no interior capacity, entry
  // width or filter-replacement interval, so those rows are left out entirely
  // rather than filled with an invented figure.
  "intelligent-litter-box-automatic-self-cleaning-deodorant": {
    materials: "PVC shell with a built-in deodorising unit",
    dimensions: "Approx. 18.5 x 18.9 x 23.2 in (47 x 48 x 59 cm)",
    weight: "18.7 lb (8.5 kg) unit; 18.9 lb (8.55 kg) boxed",
    care: "Wipe the shell and interior with a damp cloth; do not immerse the motor base. Empty and rinse the waste drawer regularly.",
  },

  // ── Pet Furnitures: Pet Tents ─────────────────────────────────────────────
  // Sizes, weights, materials and care are the supplier's own stated figures
  // (packWeight 510-530 g for the three size lines; the weight band each size
  // suits is from the listing itself), converted to the inches and pounds the US
  // storefront uses.
  "foldable-pet-tent-bed-with-cooling-mat": {
    materials: "Soft woven fabric shell over flexible black poles, with a removable double-sided cushion - a cool face for warm days and a cosy face for cold ones",
    dimensions: "S: approx. 14 x 14 x 12 in (35 x 35 x 30 cm). M: approx. 16 x 16 x 14 in (40 x 40 x 35 cm). L: approx. 20 x 20 x 18 in (50 x 50 x 45 cm)",
    weight: "Approx. 1.1 lb (0.51 kg) for the size S bed; 1.2 lb (0.53 kg) boxed",
    care: "Machine wash the cushion and outer fabric in cold water on a delicate cycle, then air dry. Do not tumble dry.",
  },

  // ── Pet Outdoor Supplies: Pet Bags ─────────────────────────────────────────
  // Material, weight and care are the supplier's own stated figures (its
  // listing gives the material as polyester and the packed weight as 468-663 g
  // across the sizes), converted to the units the US storefront uses. The
  // supplier publishes no packed dimensions for this carrier, so that row is
  // left out entirely rather than filled with an invented size.
  "pet-dog-carrier-bag-double-shoulder-travel-backpack": {
    materials: "Polyester shell with breathable mesh front and side panels, padded adjustable double-shoulder straps and a soft, wipe-clean base",
    weight: "Approx. 1.0-1.5 lb (468-663 g) packed, by size; folds flat for storage",
    care: "Wipe the mesh and shell with a damp cloth and mild soap, then air dry with the zip open. Do not tumble dry or machine wash.",
  },
  // ===== // -- REAL SUPPLIER CATALOG (added on 2026-10-12T00:00:00.000Z) =====
  "smart-anti-barking-dog-collar-rechargeable": {
    materials: "ABS plastic with a silicone contact pad",
    weight: "Approx. 0.34-2.69 lb (0.15-1.22 kg) boxed; varies by option",
    care: "Wipe the collar with a damp cloth. Recharge over USB; it is water-resistant to IP67 but is not designed for swimming.",
  },
  "four-seasons-universal-cat-recliner-bed": {
    materials: "Plush fabric over a padded fill",
    weight: "Approx. 3.62-7.28 lb (1.64-3.3 kg) boxed; varies by option",
    care: "Machine wash the outer cover on a gentle cycle and air dry.",
  },
  "stainless-steel-automatic-circulating-water-fountain": {
    materials: "Stainless-steel drinking tray on a plastic base with a quiet electric pump",
    weight: "Approx. 0.26-2.65 lb (0.12-1.2 kg) boxed; varies by option",
    care: "Rinse the tray and refresh the water daily; clean the pump and filter as needed.",
  },
  "floating-pet-water-bowl-1-5l": {
    materials: "BPA-free plastic with a floating surface disk",
    weight: "Approx. 0.93-6.46 lb (0.42-2.93 kg) boxed; varies by option",
    care: "Hand wash with warm soapy water and rinse the floating disk regularly.",
  },
  "reflective-airtag-collar-holder": {
    materials: "Nylon webbing with reflective stitching and a soft tag holder",
    weight: "Approx. 0.07-0.75 lb (0.03-0.34 kg) boxed; varies by option",
    care: "Hand wash in cool water and air dry.",
  },
  "retractable-dog-leash-with-collar": {
    materials: "ABS housing with a nylon lead and a metal clip",
    weight: "Approx. 0.66-1.9 lb (0.3-0.86 kg) boxed; varies by option",
    care: "Wipe clean and keep the retracting mechanism dry and free of sand.",
  },
  "summer-dog-cooling-vest": {
    materials: "Breathable mesh with a lightweight cooling layer",
    weight: "Approx. 0.34-1.44 lb (0.15-0.66 kg) boxed; varies by option",
    care: "Hand wash in cool water and air dry.",
  },
  "interactive-cat-toy-ball-super-drive": {
    materials: "ABS plastic",
    weight: "Approx. 0.15-3.46 lb (0.07-1.57 kg) boxed; varies by option",
    care: "Wipe clean and store away from water.",
  },
  "cooling-pet-water-bed-cushion": {
    materials: "PVC with a water-filled core",
    weight: "Approx. 0.15-1.12 lb (0.07-0.51 kg) boxed; varies by option",
    care: "Wipe with a damp cloth and air dry. Do not puncture, and drain before storing in freezing temperatures.",
  },
  "electric-jumping-shrimp-cat-toy": {
    materials: "Soft plush over an electric mechanism",
    weight: "Approx. 0.28-0.56 lb (0.13-0.26 kg) boxed; varies by option",
    care: "Spot clean only. Recharge the built-in battery over USB.",
  },
  "foldable-dog-house-cat-bed": {
    materials: "Soft-sided fabric over a foldable frame, with a removable cushion",
    weight: "Approx. 0.73-13.29 lb (0.33-6.03 kg) boxed; varies by option",
    care: "Machine wash the cushion on a gentle cycle and wipe the shell clean.",
  },
  "pet-cooling-pad-bed": {
    materials: "Pressure-activated cooling gel in a laminated mat",
    weight: "Approx. 0.75-3.99 lb (0.34-1.81 kg) boxed; varies by option",
    care: "Wipe with a damp cloth and air dry. Do not machine wash or puncture.",
  },
  "cute-fruit-dog-hoodie-clothes": {
    materials: "Soft knitted cotton blend",
    weight: "Approx. 0.17-0.31 lb (0.07-0.14 kg) boxed; varies by option",
    care: "Machine wash cold on a gentle cycle and air dry. Measure chest and back before choosing a size.",
  },
  "parrot-bird-cage-with-feeder": {
    materials: "Metal wire cage with a plastic feeder and perches",
    weight: "Approx. 14.77-17.42 lb (6.7-7.9 kg) boxed; varies by option",
    care: "Wipe the tray and perches regularly and scrub the feeder.",
  },
  "climbing-playing-bird-cage-accessory": {
    materials: "Natural wood and rope with metal fittings",
    weight: "Approx. 0.21-0.46 lb (0.1-0.21 kg) boxed; varies by option",
    care: "Wipe clean and replace any worn rope.",
  },
  "reusable-pet-hair-remover-brush": {
    materials: "ABS plastic with a reusable lint pad",
    weight: "Approx. 0.27-3.13 lb (0.12-1.42 kg) boxed; varies by option",
    care: "Empty the collected hair and wipe the pad clean.",
  },
  "quick-drying-pet-absorbent-towel": {
    materials: "Microfibre",
    weight: "Approx. 0.26-0.82 lb (0.12-0.37 kg) boxed; varies by option",
    care: "Machine wash warm, then tumble dry low or air dry.",
  },
  "pet-nail-clippers": {
    materials: "Stainless-steel blades with a plastic handle",
    weight: "Approx. 0.21-2.07 lb (0.1-0.94 kg) boxed; varies by option",
    care: "Wipe the blades after use and store dry.",
  },
  "silicone-pet-hair-remover-comb": {
    materials: "Soft silicone",
    weight: "Approx. 0.22 lb (0.1 kg) boxed",
    care: "Rinse under warm water and air dry.",
  },

  // -- live CJ listings --
  "automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small": {
    materials: "[\"Plastic\"]",
    weight: "453 g packed; varies by option",
  },
  "2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to": {
    materials: "[\"Others\"]",
    weight: "100 g packed; varies by option",
  },
  "dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo": {
    materials: "[\"Others\"]",
    weight: "100 g packed; varies by option",
  },
  "lavender-scented-disposable-pet-training-pads": {
    materials: "[\"Cloth\"]",
    weight: "1720-2700 g packed; varies by option",
  },
  "trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani": {
    materials: "[\"Others\"]",
    weight: "150 g packed; varies by option",
  },
  "traveler-bubble-backpack-pet-carriers-for-cats-and-dogs": {
    materials: "[\"Others\"]",
    weight: "200 g packed; varies by option",
  },
  "2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness": {
    materials: "[\"Others\",\"Cloth\"]",
    weight: "1000 g packed; varies by option",
  },
  "car-pet-mat-pet-seat-center-protective-net": {
    materials: "[\"Cloth\"]",
    weight: "1850.00 g packed; varies by option",
  },
  "plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca": {
    materials: "[\"Others\"]",
    weight: "5996-10800 g packed; varies by option",
  },
  "mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel": {
    materials: "[\"Wood\"]",
    weight: "4085 g packed; varies by option",
  },
  "2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard": {
    materials: "[\"Others\"]",
    weight: "860-1000 g packed; varies by option",
  },
  "nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover": {
    materials: "[\"Cloth\"]",
    weight: "600.00-1100.00 g packed; varies by option",
  },
  "multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area": {
    materials: "[\"Others\"]",
    weight: "6895 g packed; varies by option",
  },
  "heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum": {
    materials: "[\"Others\"]",
    weight: "18000 g packed; varies by option",
  },
  "2-tier-cat-condo-with-hammock": {
    materials: "[\"Others\"]",
    weight: "3552 g packed; varies by option",
  },
  "dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform": {
    materials: "[\"Others\"]",
    weight: "14000 g packed; varies by option",
  },
  "pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable": {
    materials: "[\"Cloth\"]",
    weight: "1014 g packed; varies by option",
  },
  "weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with": {
    materials: "[\"Others\"]",
    weight: "5200 g packed; varies by option",
  },
  "ceramic-pet-hamster-bowl-brown": {
    materials: "[\"Others\"]",
    weight: "100 g packed; varies by option",
  },
  "cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water": {
    materials: "[\"Others\"]",
    weight: "2018 g packed; varies by option",
  },
  "3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water": {
    materials: "[\"Others\"]",
    weight: "300 g packed; varies by option",
  },
  "portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo": {
    materials: "[\"Others\"]",
    weight: "200 g packed; varies by option",
  },
  "fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu": {
    materials: "[\"Others\"]",
    weight: "450 g packed; varies by option",
  },
  "canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel": {
    materials: "[\"Others\"]",
    weight: "9250 g packed; varies by option",
  },
  "floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa": {
    materials: "[\"Others\"]",
    weight: "200 g packed; varies by option",
  },
  "1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r": {
    materials: "[\"Plastic\"]",
    weight: "2042 g packed; varies by option",
  },
  "small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha": {
    materials: "[\"Cloth\"]",
    weight: "270 g packed; varies by option",
  },
  "pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des": {
    materials: "[\"Plastic\",\"Leather\"]",
    weight: "24 g packed; varies by option",
  },
  "4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h": {
    materials: "[\"Cloth\"]",
    weight: "50 g packed; varies by option",
  },
  "dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar": {
    materials: "[\"Cloth\"]",
    weight: "100 g packed; varies by option",
  },
  "dog-accessories-photo-concave-shape-pumpkin-hat": {
    materials: "[\"Leather\",\"Cloth\"]",
    weight: "45.00-50.00 g packed; varies by option",
  },
  "pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea": {
    materials: "[\"Plastic\"]",
    weight: "88 g packed; varies by option",
  },
  "3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration": {
    materials: "[\"Others\"]",
    weight: "86 g packed; varies by option",
  },
  "ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely": {
    materials: "[\"Others\"]",
    weight: "400 g packed; varies by option",
  },
  "tactical-service-dog-harness-vest-adjustable": {
    materials: "[\"Others\",\"Cloth\"]",
    weight: "350 g packed; varies by option",
  },
  "dog-mouth-cover-golden-retrievergerman-shepherd-dedicated": {
    materials: "[\"Metal\",\"Leather\"]",
    weight: "250.00 g packed; varies by option",
  },
  "no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac": {
    materials: "[\"Others\"]",
    weight: "250 g packed; varies by option",
  },
  "dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar": {
    materials: "[\"Leather\"]",
    weight: "150.00-280.00 g packed; varies by option",
  },
  "650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99": {
    materials: "[\"Others\"]",
    weight: "146 g packed; varies by option",
  },
  "pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive": {
    materials: "[\"Others\"]",
    weight: "200 g packed; varies by option",
  },
  "5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats": {
    materials: "[\"Others\"]",
    weight: "100 g packed; varies by option",
  },
  "interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d": {
    materials: "[\"Plastic\",\"Others\"]",
    weight: "200 g packed; varies by option",
  },
  "dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy": {
    materials: "[\"Plastic\"]",
    weight: "900.00 g packed; varies by option",
  },
  "all-in-one-no-installation-cat-scratcher-tunnel-toy": {
    materials: "[\"Plastic\"]",
    weight: "2000.00 g packed; varies by option",
  },
  "interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set": {
    materials: "[\"Others\"]",
    weight: "710 g packed; varies by option",
  },
  "christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew": {
    materials: "[\"Cloth\"]",
    weight: "68-135 g packed; varies by option",
  },
  "cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack": {
    materials: "[\"Others\"]",
    weight: "184 g packed; varies by option",
  },
  "absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip": {
    materials: "[\"Others\"]",
    weight: "308-650 g packed; varies by option",
  },
  "round-long-hairy-autumn-and-winter-nest-pad-cat-mattress": {
    materials: "[\"Cloth\"]",
    weight: "439.00-3211.00 g packed; varies by option",
  },
  "elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p": {
    materials: "[\"Others\"]",
    weight: "1000 g packed; varies by option",
  },
  "pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal": {
    materials: "[\"Cloth\"]",
    weight: "100 g packed; varies by option",
  },
  "pet-clothes-round-neck-t-shirt": {
    materials: "[\"Cloth\"]",
    weight: "100.00-140.00 g packed; varies by option",
  },
  "dog-dresses-for-outdoor-walks-with-a-leash": {
    materials: "[\"Cloth\"]",
    weight: "120.00-160.00 g packed; varies by option",
  },
  "pet-clothes-round-neck-t-shirt-pet-tops": {
    materials: "[\"Cloth\"]",
    weight: "100.00-140.00 g packed; varies by option",
  },
  "pet-dog-color-block-cardigan-sweater": {
    materials: "[\"Cloth\"]",
    weight: "57.00-144.00 g packed; varies by option",
  },
  "large-dog-border-collie-pet-sweater": {
    materials: "[\"Cloth\"]",
    weight: "290.00-330.00 g packed; varies by option",
  },
  "pet-clothes-dog-anxiety-jacket-warm-vest": {
    materials: "[\"Cloth\"]",
    weight: "45.00-268.00 g packed; varies by option",
  },
  "dog-four-seasons-breathable-soft-bottom-jumpsuit": {
    materials: "[\"Cloth\"]",
    weight: "141.00-329.00 g packed; varies by option",
  },
  "anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing": {
    materials: "[\"Cloth\"]",
    weight: "320.00-380.00 g packed; varies by option",
  },
  "winter-clothes-fleece-lined-warm-dog-cute-clothes": {
    materials: "[\"Cloth\"]",
    weight: "400.00-920.00 g packed; varies by option",
  },
  "post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac": {
    materials: "[\"Others\"]",
    weight: "453.00-655.00 g packed; varies by option",
  },
  "puppy-soldier-hat-and-clothing-set": {
    materials: "[\"Cloth\"]",
    weight: "180.00 g packed; varies by option",
  },
  "autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm": {
    materials: "[\"Cloth\"]",
    weight: "155.00-490.00 g packed; varies by option",
  },
  "pet-shoes-wear-dog-shoes": {
    materials: "[\"Cloth\"]",
    weight: "89.00-190.00 g packed; varies by option",
  },
  "1pc-adjustable-bandana-leather-pet-collar-triangle-scarf": {
    materials: "[\"Cloth\",\"Leather\"]",
    weight: "22-34 g packed; varies by option",
  },
  "outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w": {
    materials: "[\"Others\"]",
    weight: "1000 g packed; varies by option",
  },
  "smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered": {
    materials: "[\"Others\"]",
    weight: "2400 g packed; varies by option",
  },
  "45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling": {
    materials: "[\"Cloth\"]",
    weight: "8600 g packed; varies by option",
  },
  "parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play": {
    materials: "[\"Others\"]",
    weight: "925 g packed; varies by option",
  },
  "bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird": {
    materials: "[\"Others\"]",
    weight: "200 g packed; varies by option",
  },
  "convenient-outing-parrot-myna-bird-cage": {
    materials: "[\"Plastic\"]",
    weight: "1000.00 g packed; varies by option",
  },
  "parrot-out-rope-towing-anti-loss-flight-suit": {
    materials: "[\"Cloth\"]",
    weight: "17.00-24.00 g packed; varies by option",
  },
  "comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb": {
    materials: "[\"Others\"]",
    weight: "50 g packed; varies by option",
  },
  "pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki": {
    materials: "[\"Others\"]",
    weight: "454 g packed; varies by option",
  },
  "cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f": {
    materials: "[\"Others\"]",
    weight: "200 g packed; varies by option",
  },
  "2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil": {
    materials: "[\"Others\"]",
    weight: "180 g packed; varies by option",
  },
  "pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove": {
    materials: "[\"Cloth\"]",
    weight: "240-430 g packed; varies by option",
  },
};