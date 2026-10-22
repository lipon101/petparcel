// GENERATED - do not hand-edit. Re-run `node scripts/build-option-schema-module.mjs`
// after `node scripts/fetch-cj-option-schema.mjs`, which reads the SUPPLIER'S OWN
// option dimensions from the live CJ product endpoint.
//
// This is the store's record of what the supplier states about each product's
// options: the dimension tokens ("COLOR", "SIZE", "QTY") and the storefront's
// heading for each ("Colour", "Size", "Pack"). It is what stops the buy box from
// heading a dimension with a word the supplier never used, and what lets a
// product whose real listing has a single option say so plainly instead of
// drawing a vague "Option" row.
//
// Fetched: 2026-10-13T11:05:37.173Z from cjdropshipping.com /product/query.

/** One supplier-stated option dimension for a product. */
export interface OptionDimension {
  /** The supplier's own token, e.g. "COLOR", "QTY", "Color-Size". */
  token: string;
  /** What it is, which decides how the storefront draws it. */
  kind: "color" | "size" | "pack" | "set" | "option";
  /** The heading drawn above the row; "" when the token is an internal code. */
  label: string;
}

/** One product's supplier-stated option schema. */
export interface OptionSchemaEntry {
  pid: string;
  productKey: string | null;
  productKeyEn: string | null;
  dimensions: OptionDimension[];
}

/** Keyed by the product's slug, which is the store's stable identity. */
export const OPTION_SCHEMA_BY_SLUG: Record<string, OptionSchemaEntry> = {
  "1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r": {
    pid: "1961255727572742145",
    productKey: "[\"Size\"]",
    productKeyEn: "Size",
    dimensions: [{"token":"Size","kind":"size","label":"Size"}],
  },
  "1pc-adjustable-bandana-leather-pet-collar-triangle-scarf": {
    pid: "1996493861430915074",
    productKey: "[\"Color and Size\"]",
    productKeyEn: "Color and Size",
    dimensions: [{"token":"Color and Size","kind":"option","label":"Color and Size"}],
  },
  "2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard": {
    pid: "2082396640891764738",
    productKey: "[\"Size\"]",
    productKeyEn: "Size",
    dimensions: [{"token":"Size","kind":"size","label":"Size"}],
  },
  "2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to": {
    pid: "2082221710648397825",
    productKey: "[\"CJCBYYDJ53HY\"]",
    productKeyEn: "CJCBYYDJ53HY",
    dimensions: [{"token":"CJCBYYDJ53HY","kind":"option","label":""}],
  },
  "2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil": {
    pid: "2102706478231511042",
    productKey: "[\"Set\"]",
    productKeyEn: "Set",
    dimensions: [{"token":"Set","kind":"set","label":"Set"}],
  },
  "2-tier-cat-condo-with-hammock": {
    pid: "2097113492712873985",
    productKey: "[\"Default\"]",
    productKeyEn: "Default",
    dimensions: [],
  },
  "2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness": {
    pid: "1925125360529211393",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration": {
    pid: "2105212766864125953",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water": {
    pid: "2105138981798735874",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling": {
    pid: "2034276978397466625",
    productKey: "[\"Color\",\"Size\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h": {
    pid: "2082183063620857857",
    productKey: "[\"CJFY2Q3ZDHHY\"]",
    productKeyEn: "CJFY2Q3ZDHHY",
    dimensions: [{"token":"CJFY2Q3ZDHHY","kind":"option","label":""}],
  },
  "5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats": {
    pid: "2104846016072171522",
    productKey: "[\"Set\"]",
    productKeyEn: "Set",
    dimensions: [{"token":"Set","kind":"set","label":"Set"}],
  },
  "650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99": {
    pid: "1966043508778242050",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip": {
    pid: "2091938725500452866",
    productKey: "[\"CJCFY9LC2J\"]",
    productKeyEn: "CJCFY9LC2J",
    dimensions: [{"token":"CJCFY9LC2J","kind":"option","label":""}],
  },
  "all-in-one-no-installation-cat-scratcher-tunnel-toy": {
    pid: "2606250325251608200",
    productKey: "[\"规格\"]",
    productKeyEn: "Specifications",
    dimensions: [{"token":"Specifications","kind":"option","label":"Specifications"}],
  },
  "tactical-service-dog-harness-vest-adjustable": {
    pid: "1935996841896681474",
    productKey: "[\"Color\",\"Size\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing": {
    pid: "2406270208541620400",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small": {
    pid: "1941393057446592513",
    productKey: "[\"Colour\"]",
    productKeyEn: "Colour",
    dimensions: [{"token":"Colour","kind":"color","label":"Colour"}],
  },
  "autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm": {
    pid: "2502170330091606200",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird": {
    pid: "2085855419489247233",
    productKey: "[\"CJ8RXV363JHY\"]",
    productKeyEn: "CJ8RXV363JHY",
    dimensions: [{"token":"CJ8RXV363JHY","kind":"option","label":""}],
  },
  "canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel": {
    pid: "1992918515617394690",
    productKey: "[\"color\"]",
    productKeyEn: "color",
    dimensions: [{"token":"color","kind":"color","label":"Colour"}],
  },
  "car-pet-mat-pet-seat-center-protective-net": {
    pid: "2609120047161637000",
    productKey: "[\"颜色\",\"规格\"]",
    productKeyEn: "Color-Specifications",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Specifications","kind":"option","label":"Specifications"}],
  },
  "cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f": {
    pid: "2082225432455663618",
    productKey: "[\"CJCH7TPB4RHY\"]",
    productKeyEn: "CJCH7TPB4RHY",
    dimensions: [{"token":"CJCH7TPB4RHY","kind":"option","label":""}],
  },
  "cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack": {
    pid: "2080714942724071426",
    productKey: "[\"CJ7NJ5SR5GHY\"]",
    productKeyEn: "CJ7NJ5SR5GHY",
    dimensions: [{"token":"CJ7NJ5SR5GHY","kind":"option","label":""}],
  },
  "ceramic-pet-hamster-bowl-brown": {
    pid: "2085834701740335105",
    productKey: "[\"CJ040B9NOYHY\"]",
    productKeyEn: "CJ040B9NOYHY",
    dimensions: [{"token":"CJ040B9NOYHY","kind":"option","label":""}],
  },
  "christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew": {
    pid: "2104522050033946626",
    productKey: "[\"Color\",\"Size\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "climbing-playing-bird-cage-accessory": {
    pid: "2412061027411625700",
    productKey: "[\"规格\"]",
    productKeyEn: "Specifications",
    dimensions: [{"token":"Specifications","kind":"option","label":"Specifications"}],
  },
  "comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb": {
    pid: "2081495460923068417",
    productKey: "[\"CJC85GCLLNHY\"]",
    productKeyEn: "CJC85GCLLNHY",
    dimensions: [{"token":"CJC85GCLLNHY","kind":"option","label":""}],
  },
  "convenient-outing-parrot-myna-bird-cage": {
    pid: "1470579871485923328",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "cooling-pet-water-bed-cushion": {
    pid: "2406120341111620600",
    productKey: "[\"款式\",\"数量\"]",
    productKeyEn: "Style-quantity",
    dimensions: [{"token":"Style","kind":"option","label":"Style"},{"token":"quantity","kind":"pack","label":"Pack"}],
  },
  "cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water": {
    pid: "2100408394892300290",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "cute-fruit-dog-hoodie-clothes": {
    pid: "1403920038016192512",
    productKey: "[\"款式\",\"尺寸\"]",
    productKeyEn: "style-Size",
    dimensions: [{"token":"style","kind":"option","label":"style"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "dog-accessories-photo-concave-shape-pumpkin-hat": {
    pid: "2503150220031613800",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar": {
    pid: "1751074410796163072",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar": {
    pid: "2082229584768839681",
    productKey: "[\"CJCYCK265QHY\"]",
    productKeyEn: "CJCYCK265QHY",
    dimensions: [{"token":"CJCYCK265QHY","kind":"option","label":""}],
  },
  "dog-dresses-for-outdoor-walks-with-a-leash": {
    pid: "2601120626281635800",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "dog-four-seasons-breathable-soft-bottom-jumpsuit": {
    pid: "2411270650521628600",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "dog-mouth-cover-golden-retrievergerman-shepherd-dedicated": {
    pid: "2509070828311601300",
    productKey: "[\"颜色\",\"规格\"]",
    productKeyEn: "Color-Specifications",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Specifications","kind":"option","label":"Specifications"}],
  },
  "dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform": {
    pid: "2013438747630202882",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy": {
    pid: "2604081253511623400",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo": {
    pid: "2086539679061921794",
    productKey: "[\"CJ7F6FTTM7HY\"]",
    productKeyEn: "CJ7F6FTTM7HY",
    dimensions: [{"token":"CJ7F6FTTM7HY","kind":"option","label":""}],
  },
  "electric-jumping-shrimp-cat-toy": {
    pid: "1448199534130892800",
    productKey: "[\"颜色\",\"尺寸\",\"电源\"]",
    productKeyEn: "Color-Size-Electrical outlet",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"},{"token":"Electrical outlet","kind":"option","label":"Electrical outlet"}],
  },
  "elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p": {
    pid: "2072258275553931266",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu": {
    pid: "1991063483994267649",
    productKey: "[\"Attribute\"]",
    productKeyEn: "Attribute",
    dimensions: [{"token":"Attribute","kind":"option","label":"Attribute"}],
  },
  "floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa": {
    pid: "2070783384532987905",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "floating-pet-water-bowl-1-5l": {
    pid: "1366573785234411520",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "foldable-dog-house-cat-bed": {
    pid: "1460790625321488384",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "foldable-pet-tent-bed-with-cooling-mat": {
    pid: "1643077881498701824",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "four-seasons-universal-cat-recliner-bed": {
    pid: "1389761927684689920",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely": {
    pid: "1996510667392868354",
    productKey: "[\"Color\",\"Size\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum": {
    pid: "2095039409988558850",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "intelligent-litter-box-automatic-self-cleaning-deodorant": {
    pid: "2504030718511602300",
    productKey: "[\"颜色\",\"规格\"]",
    productKeyEn: "Color-Specifications",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Specifications","kind":"option","label":"Specifications"}],
  },
  "interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set": {
    pid: "2083079011126984706",
    productKey: "[\"Materials\"]",
    productKeyEn: "Materials",
    dimensions: [{"token":"Materials","kind":"option","label":"Materials"}],
  },
  "interactive-cat-toy-ball-super-drive": {
    pid: "2409030737241626200",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d": {
    pid: "1993164615406215169",
    productKey: "[\"Size\"]",
    productKeyEn: "Size",
    dimensions: [{"token":"Size","kind":"size","label":"Size"}],
  },
  "large-dog-border-collie-pet-sweater": {
    pid: "2602010458501628500",
    productKey: "[\"尺寸\",\"颜色\"]",
    productKeyEn: "Size-Color",
    dimensions: [{"token":"Size","kind":"size","label":"Size"},{"token":"Color","kind":"color","label":"Colour"}],
  },
  "lavender-scented-disposable-pet-training-pads": {
    pid: "2080458038578536449",
    productKey: "[\"Specification\"]",
    productKeyEn: "Specification",
    dimensions: [{"token":"Specification","kind":"option","label":"Specification"}],
  },
  "multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area": {
    pid: "2102735860725415937",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel": {
    pid: "1903376265475391489",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac": {
    pid: "2102113626738282497",
    productKey: "[\"CJSACQ568P93\"]",
    productKeyEn: "CJSACQ568P93",
    dimensions: [{"token":"CJSACQ568P93","kind":"option","label":""}],
  },
  "nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover": {
    pid: "2411070834521602600",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w": {
    pid: "1990620139723874305",
    productKey: "[\"Type\"]",
    productKeyEn: "Type",
    dimensions: [{"token":"Type","kind":"option","label":"Type"}],
  },
  "parrot-bird-cage-with-feeder": {
    pid: "1610174941469618176",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "parrot-out-rope-towing-anti-loss-flight-suit": {
    pid: "2607130732231612100",
    productKey: "[\"规格\",\"尺寸\"]",
    productKeyEn: "Specification-Size",
    dimensions: [{"token":"Specification","kind":"option","label":"Specification"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play": {
    pid: "2095007330227707906",
    productKey: "[\"Q\"]",
    productKeyEn: "Q",
    dimensions: [{"token":"Q","kind":"option","label":"Q"}],
  },
  "pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal": {
    pid: "2082898128163672065",
    productKey: "[\"CJF994SHL2HY\"]",
    productKeyEn: "CJF994SHL2HY",
    dimensions: [{"token":"CJF994SHL2HY","kind":"option","label":""}],
  },
  "pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive": {
    pid: "2080726616541650946",
    productKey: "[\"CJ7YKRPYJHHY\"]",
    productKeyEn: "CJ7YKRPYJHHY",
    dimensions: [{"token":"CJ7YKRPYJHHY","kind":"option","label":""}],
  },
  "pet-clothes-dog-anxiety-jacket-warm-vest": {
    pid: "2407180220271601600",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "pet-clothes-round-neck-t-shirt": {
    pid: "2502140802471609200",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "pet-cooling-pad-bed": {
    pid: "1357289526732656640",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "pet-dog-carrier-bag-double-shoulder-travel-backpack": {
    pid: "FF10D3C0-679C-4C38-8F48-8961E85AE312",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "pet-dog-color-block-cardigan-sweater": {
    pid: "2512120903101607500",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki": {
    pid: "2097552582825844737",
    productKey: "[\"Title\"]",
    productKeyEn: "Title",
    dimensions: [],
  },
  "pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des": {
    pid: "2053070122767724546",
    productKey: "[\"Key pendant\"]",
    productKeyEn: "Key pendant",
    dimensions: [{"token":"Key pendant","kind":"option","label":"Key pendant"}],
  },
  "pet-nail-clippers": {
    pid: "1621435150108209152",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea": {
    pid: "2084490822904827906",
    productKey: "[\"QTY\"]",
    productKeyEn: "QTY",
    dimensions: [{"token":"QTY","kind":"pack","label":"Pack"}],
  },
  "pet-shoes-wear-dog-shoes": {
    pid: "E1AE8A64-6DA0-4FE6-8487-43F61733EE97",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"size","kind":"size","label":"Size"}],
  },
  "pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove": {
    pid: "1879079284534824962",
    productKey: "[\"COLOR\",\"SIZE\"]",
    productKeyEn: "COLOR-SIZE",
    dimensions: [{"token":"COLOR","kind":"color","label":"Colour"},{"token":"SIZE","kind":"size","label":"Size"}],
  },
  "pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable": {
    pid: "1961274945106653185",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca": {
    pid: "2097258828843417601",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo": {
    pid: "2091933790564667393",
    productKey: "[\"CJ9F5ZYV7M\"]",
    productKeyEn: "CJ9F5ZYV7M",
    dimensions: [{"token":"CJ9F5ZYV7M","kind":"option","label":""}],
  },
  "post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac": {
    pid: "2602240937331625600",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "puppy-soldier-hat-and-clothing-set": {
    pid: "2609150801291610000",
    productKey: "[\"款式\"]",
    productKeyEn: "Style",
    dimensions: [{"token":"Style","kind":"option","label":"Style"}],
  },
  "quick-drying-pet-absorbent-towel": {
    pid: "1475029850208210944",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "reflective-airtag-collar-holder": {
    pid: "1585221163377242112",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "retractable-dog-leash-with-collar": {
    pid: "1417723948015161344",
    productKey: "[\"颜色\",\"款式\",\"数量\"]",
    productKeyEn: "Color-style-quantity",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"style","kind":"option","label":"style"},{"token":"quantity","kind":"pack","label":"Pack"}],
  },
  "reusable-pet-hair-remover-brush": {
    pid: "1368888013161107456",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "round-long-hairy-autumn-and-winter-nest-pad-cat-mattress": {
    pid: "31E793E4-F497-4C75-B5D4-DAF0B695CCBF",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "silicone-pet-hair-remover-comb": {
    pid: "1767392629924311040",
    productKey: "[\"规格\"]",
    productKeyEn: "Specifications",
    dimensions: [{"token":"Specifications","kind":"option","label":"Specifications"}],
  },
  "small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha": {
    pid: "2080039753131929602",
    productKey: "[\"CJFRF4Q5HGHY\"]",
    productKeyEn: "CJFRF4Q5HGHY",
    dimensions: [{"token":"CJFRF4Q5HGHY","kind":"option","label":""}],
  },
  "smart-anti-barking-dog-collar-rechargeable": {
    pid: "1786012676196409344",
    productKey: "[\"颜色\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered": {
    pid: "1993023312350330882",
    productKey: "[\"color\"]",
    productKeyEn: "color",
    dimensions: [{"token":"color","kind":"color","label":"Colour"}],
  },
  "stainless-steel-automatic-circulating-water-fountain": {
    pid: "1651788214971146240",
    productKey: "[\"款式\",\"电源\"]",
    productKeyEn: "style-Electrical outlet",
    dimensions: [{"token":"style","kind":"option","label":"style"},{"token":"Electrical outlet","kind":"option","label":"Electrical outlet"}],
  },
  "summer-dog-cooling-vest": {
    pid: "1539929588468559872",
    productKey: "[\"颜色\",\"尺寸\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
  "trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani": {
    pid: "2077267173520543745",
    productKey: "[\"Set\"]",
    productKeyEn: "Set",
    dimensions: [{"token":"Set","kind":"set","label":"Set"}],
  },
  "traveler-bubble-backpack-pet-carriers-for-cats-and-dogs": {
    pid: "2093416983420723201",
    productKey: "[\"CJ7KHPLFMSHY\"]",
    productKeyEn: "CJ7KHPLFMSHY",
    dimensions: [{"token":"CJ7KHPLFMSHY","kind":"option","label":""}],
  },
  "weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with": {
    pid: "2008727317827907585",
    productKey: "[\"Color\"]",
    productKeyEn: "Color",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"}],
  },
  "winter-clothes-fleece-lined-warm-dog-cute-clothes": {
    pid: "1765013135812988928",
    productKey: "[\"颜色\",\"尺码\"]",
    productKeyEn: "Color-Size",
    dimensions: [{"token":"Color","kind":"color","label":"Colour"},{"token":"Size","kind":"size","label":"Size"}],
  },
};

/** The schema for a slug, or undefined when the supplier listing has not been
 *  fetched for it yet (a product an admin added by hand, for instance). */
export function optionSchemaFor(slug: string): OptionSchemaEntry | undefined {
  return OPTION_SCHEMA_BY_SLUG[slug];
}
