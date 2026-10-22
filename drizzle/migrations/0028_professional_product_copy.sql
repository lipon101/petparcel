-- Professional, high-converting product copy for every product.
--
-- WHY THIS EXISTS. Every description was rewritten as real ad copy - a benefit
-- lead, a short feature list, a specs line and a closing - built from the
-- product's own real CJ data (materials, weight, features). No supplier is named
-- and no markdown or decorative bracket survives.
--
-- WHY A MIGRATION. The catalogue sync only ever INSERTs; it never rewrites an
-- existing row (an admin's edit must outrank the bundle), so a database seeded
-- before this revision keeps the old copy forever.
--
-- SOURCE OF TRUTH. THIS FILE IS GENERATED from the database by
-- scripts/sync-copy-to-catalog.mjs, which itself is fed by
-- scripts/generate-product-copy.mjs - so the catalogue, the database and this
-- migration cannot disagree.
--
-- IDEMPOTENT. Every statement is guarded on the row actually differing, so a
-- re-run reports UPDATE 0.

-- 1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r
UPDATE "products" SET
  "description" = $c$1Pc 3-Stage External Canister Filter For Aquarium Fish Tank With 600L-H Flow Rate 35.4in Max Height 6W Easy Installation Silent is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 2042 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r$c$
    AND "description" IS DISTINCT FROM $c$1Pc 3-Stage External Canister Filter For Aquarium Fish Tank With 600L-H Flow Rate 35.4in Max Height 6W Easy Installation Silent is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 2042 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- 1pc-adjustable-bandana-leather-pet-collar-triangle-scarf
UPDATE "products" SET
  "description" = $c$1Pc Adjustable Bandana Leather Pet Collar Triangle Scarf is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth and leather, and it weighs around 22 g.

Choose the option that suits your pet - Red L, Blue L, Pink M, Blue M.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$1pc-adjustable-bandana-leather-pet-collar-triangle-scarf$c$
    AND "description" IS DISTINCT FROM $c$1Pc Adjustable Bandana Leather Pet Collar Triangle Scarf is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth and leather, and it weighs around 22 g.

Choose the option that suits your pet - Red L, Blue L, Pink M, Blue M.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- 2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard
UPDATE "products" SET
  "description" = $c$2-in-1 Cat Rocking Scratcher Chair Wooden Cat Bed Lounge Corrugated Cardboard Scratching Pad For Indoor Cats is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 860 g.

Choose the option that suits your pet - S, L.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard$c$
    AND "description" IS DISTINCT FROM $c$2-in-1 Cat Rocking Scratcher Chair Wooden Cat Bed Lounge Corrugated Cardboard Scratching Pad For Indoor Cats is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 860 g.

Choose the option that suits your pet - S, L.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- 2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to
UPDATE "products" SET
  "description" = $c$A Gift for Your Puppy: Teaching dog to ring a bell to go out out or go to the toilet, instead of bark or scratching on the door to get your attention.

Lightweight and easy to handle at around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Ideal training gadget to treats game, toilet training, feed training and order training for your pets.
- It can improve the feelings and communication with you lovely pet.
- Adjustable Length: The training bell has a strong buckle that can hang from nearly any doorknobs or handles.
- You can easily adjust the length between 33'' and 35'' and make it suitable for your dog friends to ring the bell.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to$c$
    AND "description" IS DISTINCT FROM $c$A Gift for Your Puppy: Teaching dog to ring a bell to go out out or go to the toilet, instead of bark or scratching on the door to get your attention.

Lightweight and easy to handle at around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Ideal training gadget to treats game, toilet training, feed training and order training for your pets.
- It can improve the feelings and communication with you lovely pet.
- Adjustable Length: The training bell has a strong buckle that can hang from nearly any doorknobs or handles.
- You can easily adjust the length between 33'' and 35'' and make it suitable for your dog friends to ring the bell.$c$;

-- 2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil
UPDATE "products" SET
  "description" = $c$Includes long-handle brush and compact handheld brush, meet different grooming needs for dogs, cats and other pets.

Lightweight and easy to handle at around 180 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- One-Press Liquid Dispensing Design.
- Fill shampoo inside the transparent container, press the button to release soap easily during bathing.
- Gentle on pet skin, deep clean fur while offering soothing massage, no scratch to sensitive skin.
- Comfortable handle for stable holding when washing pets, easy to operate and rinse clean after use.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil$c$
    AND "description" IS DISTINCT FROM $c$Includes long-handle brush and compact handheld brush, meet different grooming needs for dogs, cats and other pets.

Lightweight and easy to handle at around 180 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- One-Press Liquid Dispensing Design.
- Fill shampoo inside the transparent container, press the button to release soap easily during bathing.
- Gentle on pet skin, deep clean fur while offering soothing massage, no scratch to sensitive skin.
- Comfortable handle for stable holding when washing pets, easy to operate and rinse clean after use.$c$;

-- 2-tier-cat-condo-with-hammock
UPDATE "products" SET
  "description" = $c$Cat Condo to Hammock: The 2-layer felt cat house can be seamlessly transformed from a semi-enclosed condo to a spacious hammock.

Lightweight and easy to handle at around 3552 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The convertible design corresponds to various feline preferences, accommodating both the desire for snug enclosures and the penchant for open resting areas.
- Solid Bamboo Construction: The frame of the modern cat house is crafted from bamboo, which is celebrated for its robustness, easy maintenance and environmental sustainability.
- Moreover, the natural finish exudes warm tone, which is dedicated to enhance the aesthetic appeal to your space.
- All Season Felt Clothes: Crafted from premium felt cloth, the wood cat house offers exceptional breathability, maintaining a all-season comfortable environment for felines.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2-tier-cat-condo-with-hammock$c$
    AND "description" IS DISTINCT FROM $c$Cat Condo to Hammock: The 2-layer felt cat house can be seamlessly transformed from a semi-enclosed condo to a spacious hammock.

Lightweight and easy to handle at around 3552 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The convertible design corresponds to various feline preferences, accommodating both the desire for snug enclosures and the penchant for open resting areas.
- Solid Bamboo Construction: The frame of the modern cat house is crafted from bamboo, which is celebrated for its robustness, easy maintenance and environmental sustainability.
- Moreover, the natural finish exudes warm tone, which is dedicated to enhance the aesthetic appeal to your space.
- All Season Felt Clothes: Crafted from premium felt cloth, the wood cat house offers exceptional breathability, maintaining a all-season comfortable environment for felines.$c$;

-- 2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness
UPDATE "products" SET
  "description" = $c$Prevents pet from distracting you or blocking your vision for safe drive.

Built to last: made from cloth, and it weighs around 1000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Belt tap clips directly into seatbelt buckle.
- Easy and quick to buckle and unbuckle pet.
- Work as a pet leash when 2 belts are connected together.
- Swivel carabiner attaches to pet's body harness and allows pet to spin around without tangling.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness$c$
    AND "description" IS DISTINCT FROM $c$Prevents pet from distracting you or blocking your vision for safe drive.

Built to last: made from cloth, and it weighs around 1000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Belt tap clips directly into seatbelt buckle.
- Easy and quick to buckle and unbuckle pet.
- Work as a pet leash when 2 belts are connected together.
- Swivel carabiner attaches to pet's body harness and allows pet to spin around without tangling.$c$;

-- 3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration
UPDATE "products" SET
  "description" = $c$Anti Bark Dog Collar with Beep and Vibration, 7 Sensitivity Levels, Adjustable Reflective Nylon Strap for Dogs, 20-55 cm Progressive Beep and Vibration Training: The collar uses a step-by-step response system.

Lightweight and easy to handle at around 86 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The first activations provide warning beeps, followed by combinations of sound and vibration if barking continues.
- 7 Sensitivity Levels: Features seven manually adjustable sensitivity settings, allowing you to select a suitable response level according to your dog and environment.
- Automatic Safety Pause: After repeated activation, the collar enters a 1-minute sleep mode before becoming active again, helping prevent continuous stimulation.
- Adjustable Reflective Collar: Includes an adjustable nylon strap measuring approximately 20 to 55 cm, suitable for different dog sizes.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration$c$
    AND "description" IS DISTINCT FROM $c$Anti Bark Dog Collar with Beep and Vibration, 7 Sensitivity Levels, Adjustable Reflective Nylon Strap for Dogs, 20-55 cm Progressive Beep and Vibration Training: The collar uses a step-by-step response system.

Lightweight and easy to handle at around 86 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The first activations provide warning beeps, followed by combinations of sound and vibration if barking continues.
- 7 Sensitivity Levels: Features seven manually adjustable sensitivity settings, allowing you to select a suitable response level according to your dog and environment.
- Automatic Safety Pause: After repeated activation, the collar enters a 1-minute sleep mode before becoming active again, helping prevent continuous stimulation.
- Adjustable Reflective Collar: Includes an adjustable nylon strap measuring approximately 20 to 55 cm, suitable for different dog sizes.$c$;

-- 3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water
UPDATE "products" SET
  "description" = $c$Cut down your pet gear for walks, camping and road trips.

Lightweight and easy to handle at around 300 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- ONE-BUTTON WATER DISPENSER: Easily release fresh water into the wide drinking trough.
- Dirty water won't flow back into the clean water tank for safe hydration.
- FOLD-OUT DRINKING TROUGH: Extended drinking tray fits different dog & cat muzzles.
- Fold flat after use to save space in backpacks or car storage.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water$c$
    AND "description" IS DISTINCT FROM $c$Cut down your pet gear for walks, camping and road trips.

Lightweight and easy to handle at around 300 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- ONE-BUTTON WATER DISPENSER: Easily release fresh water into the wide drinking trough.
- Dirty water won't flow back into the clean water tank for safe hydration.
- FOLD-OUT DRINKING TROUGH: Extended drinking tray fits different dog & cat muzzles.
- Fold flat after use to save space in backpacks or car storage.$c$;

-- 45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling
UPDATE "products" SET
  "description" = $c$45-inch Metal Indoor Bird Cage, Parrot Cage, Bird Aviary with Detachable Rolling Stand, Storage Basket, and Accessories - Black is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 8600 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling$c$
    AND "description" IS DISTINCT FROM $c$45-inch Metal Indoor Bird Cage, Parrot Cage, Bird Aviary with Detachable Rolling Stand, Storage Basket, and Accessories - Black is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 8600 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- 4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h
UPDATE "products" SET
  "description" = $c$Novel and Adorable Design: The package comes with 4 pieces of dog bow headbands.

Built to last: made from cloth, and it weighs around 50 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Add a touch of cuteness to your furry friend's day with this set of 4 soft, plush dog headbands.
- Each one features a classic bow in vibrant blue,black, red, and pink.
- Perfect for everyday wear, photo,also in Christmas, Halloween, Thansgiving, Valentine's Day.
- Suitable Size: The size of dog hair bow headband is 3.15*4.53 inch.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h$c$
    AND "description" IS DISTINCT FROM $c$Novel and Adorable Design: The package comes with 4 pieces of dog bow headbands.

Built to last: made from cloth, and it weighs around 50 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Add a touch of cuteness to your furry friend's day with this set of 4 soft, plush dog headbands.
- Each one features a classic bow in vibrant blue,black, red, and pink.
- Perfect for everyday wear, photo,also in Christmas, Halloween, Thansgiving, Valentine's Day.
- Suitable Size: The size of dog hair bow headband is 3.15*4.53 inch.$c$;

-- 5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats
UPDATE "products" SET
  "description" = $c$Adorable smiling faces attract your cat's interest instantly.

Lightweight and easy to handle at around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Filled with Catnip: Built-in natural catnip inside each toy to stimulate cats' playful instinct, great for kicking, biting, wrestling and relieving boredom.
- Soft & Durable Fabric: Made of premium plush material, safe for cats to chew.
- Stitched firmly for long-time daily play.
- Stress Relief for Indoor Cats: Perfect kicker toy satisfies cats' hunting instinct, helps reduce anxiety and destructive behavior.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats$c$
    AND "description" IS DISTINCT FROM $c$Adorable smiling faces attract your cat's interest instantly.

Lightweight and easy to handle at around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Filled with Catnip: Built-in natural catnip inside each toy to stimulate cats' playful instinct, great for kicking, biting, wrestling and relieving boredom.
- Soft & Durable Fabric: Made of premium plush material, safe for cats to chew.
- Stitched firmly for long-time daily play.
- Stress Relief for Indoor Cats: Perfect kicker toy satisfies cats' hunting instinct, helps reduce anxiety and destructive behavior.$c$;

-- 650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99
UPDATE "products" SET
  "description" = $c$Features 650nm Red Ray Red Laser Pointer Pen Utilization of the latest crystal technology and optics creates this high quality;pen-sized laser pointer.

Lightweight and easy to handle at around 146 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It emits an intense,brilliant laser beam,Use your Laser Pointer to aim at any desired targets on projection screens,video monitors,presentation.
- Press the push button to turn it on,release the push button to shut if off automatically.
- Laser radiation is potentially harmful!
- Keep out of reach of children Package Includes 10x Red Laser Pen.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99$c$
    AND "description" IS DISTINCT FROM $c$Features 650nm Red Ray Red Laser Pointer Pen Utilization of the latest crystal technology and optics creates this high quality;pen-sized laser pointer.

Lightweight and easy to handle at around 146 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It emits an intense,brilliant laser beam,Use your Laser Pointer to aim at any desired targets on projection screens,video monitors,presentation.
- Press the push button to turn it on,release the push button to shut if off automatically.
- Laser radiation is potentially harmful!
- Keep out of reach of children Package Includes 10x Red Laser Pen.$c$;

-- absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip
UPDATE "products" SET
  "description" = $c$Strong Absorbent & Stain-Resistant Our dog food mat boasts exceptional absorbency, quickly soaking up any spilled water & milk and leaving no traces behind.

Lightweight and easy to handle at around 308 g.

Choose the option that suits your pet - Dark Gray, Size 24L x 16W, Size 27L x 17W.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It effectively prevents wet paws and keeps your pet's eating area clean.
- Anti-Slip & Leak-Proof Our dog bowl mat features a non-slip rubber backing that securely maintains its position.
- The waterproof rubber bottom provides excellent leak protection, preventing water from seeping into the floor and causing damage.
- Easy to Clean The surface of our pet food mat is made of a special material that resists pet hair and dust.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip$c$
    AND "description" IS DISTINCT FROM $c$Strong Absorbent & Stain-Resistant Our dog food mat boasts exceptional absorbency, quickly soaking up any spilled water & milk and leaving no traces behind.

Lightweight and easy to handle at around 308 g.

Choose the option that suits your pet - Dark Gray, Size 24L x 16W, Size 27L x 17W.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It effectively prevents wet paws and keeps your pet's eating area clean.
- Anti-Slip & Leak-Proof Our dog bowl mat features a non-slip rubber backing that securely maintains its position.
- The waterproof rubber bottom provides excellent leak protection, preventing water from seeping into the floor and causing damage.
- Easy to Clean The surface of our pet food mat is made of a special material that resists pet hair and dust.$c$;

-- all-in-one-no-installation-cat-scratcher-tunnel-toy
UPDATE "products" SET
  "description" = $c$All-in-one No-installation Cat Scratcher Tunnel Toy is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 2000.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$all-in-one-no-installation-cat-scratcher-tunnel-toy$c$
    AND "description" IS DISTINCT FROM $c$All-in-one No-installation Cat Scratcher Tunnel Toy is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 2000.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- american-local-tactical-pet-boobs-service-dog-harness-vest-adjustable-reflecti
UPDATE "products" SET
  "description" = $c$Comfortable, adjustable, durable, breathable.

Built to last: made from cloth, and it weighs around 350 g.

Choose the option that suits your pet - Pink-S, Pink-M, Pink-L, Pink-XL, Black-S, Black-M, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Packaging and shipping information.
- Gross weight of a single product.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$american-local-tactical-pet-boobs-service-dog-harness-vest-adjustable-reflecti$c$
    AND "description" IS DISTINCT FROM $c$Comfortable, adjustable, durable, breathable.

Built to last: made from cloth, and it weighs around 350 g.

Choose the option that suits your pet - Pink-S, Pink-M, Pink-L, Pink-XL, Black-S, Black-M, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Packaging and shipping information.
- Gross weight of a single product.$c$;

-- anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing
UPDATE "products" SET
  "description" = $c$Anti-fur Pajamas Bow Decoration Big Dog Four-legged Pet Clothing is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 320.00 g.

Choose the option that suits your pet - Navy Blue Bow 26, Navy Blue Bow 28 Yards, Navy Blue Bow 30, Navy Blue Bow 32 Yards, Navy Blue Bow 34 Yards, Navy Blue Bow 36 Yards, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing$c$
    AND "description" IS DISTINCT FROM $c$Anti-fur Pajamas Bow Decoration Big Dog Four-legged Pet Clothing is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 320.00 g.

Choose the option that suits your pet - Navy Blue Bow 26, Navy Blue Bow 28 Yards, Navy Blue Bow 30, Navy Blue Bow 32 Yards, Navy Blue Bow 34 Yards, Navy Blue Bow 36 Yards, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small
UPDATE "products" SET
  "description" = $c$Automatic Anti Bark Barking Dog Shock Control Collar Device Large Medium Small is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 453 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small$c$
    AND "description" IS DISTINCT FROM $c$Automatic Anti Bark Barking Dog Shock Control Collar Device Large Medium Small is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 453 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm
UPDATE "products" SET
  "description" = $c$Autumn And Winter Pet Clothes Small Dog Waterproof Thickened Warm is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 155.00 g.

Choose the option that suits your pet - Melon Red S, Melon Red M, Melon Red XL, Melon Red 2XL, Melon Red 3XL, Khaki S, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm$c$
    AND "description" IS DISTINCT FROM $c$Autumn And Winter Pet Clothes Small Dog Waterproof Thickened Warm is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 155.00 g.

Choose the option that suits your pet - Melon Red S, Melon Red M, Melon Red XL, Melon Red 2XL, Melon Red 3XL, Khaki S, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird
UPDATE "products" SET
  "description" = $c$11 PIECES BIRD TOYS: The bird toys include 11Pieces parrot toys to meet most bird's needs.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It's the perfect gift for your bird friends.
- SAFE: These small interesting Bird toys are made of natural wood that dyed with edible color,which ensure the health and safety of your pet birds.
- They are completely handmade, very durable and bite-resistant.
- They can easily draw the attention of your pet parrots in a short time,climbbing and exploring.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird$c$
    AND "description" IS DISTINCT FROM $c$11 PIECES BIRD TOYS: The bird toys include 11Pieces parrot toys to meet most bird's needs.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It's the perfect gift for your bird friends.
- SAFE: These small interesting Bird toys are made of natural wood that dyed with edible color,which ensure the health and safety of your pet birds.
- They are completely handmade, very durable and bite-resistant.
- They can easily draw the attention of your pet parrots in a short time,climbbing and exploring.$c$;

-- canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel
UPDATE "products" SET
  "description" = $c$High-Quality Materials: Made with reinforced 0.9 mm triple-layer PVC scraper cloth and 1.2 mm high-transparency PVC, this canvas fish pond is durable, sun-resistant, and tear-resistant.

Lightweight and easy to handle at around 9250 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It offers clear visibility and is wear-resistant and scratch-resistant, with a seamless design to avoid leaks.
- Sturdy Structure: The above-ground fish pond features high-strength stainless steel pipes that are rust-resistant and corrosion-resistant.
- Its strong, stable frame ensures that it remains intact and holds its shape, even when full of water, ensuring long-term durability.
- Quick Drainage: With a large drainage valve, this fish pond allows quick water release with a simple turn, saving time and making maintenance more convenient.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel$c$
    AND "description" IS DISTINCT FROM $c$High-Quality Materials: Made with reinforced 0.9 mm triple-layer PVC scraper cloth and 1.2 mm high-transparency PVC, this canvas fish pond is durable, sun-resistant, and tear-resistant.

Lightweight and easy to handle at around 9250 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It offers clear visibility and is wear-resistant and scratch-resistant, with a seamless design to avoid leaks.
- Sturdy Structure: The above-ground fish pond features high-strength stainless steel pipes that are rust-resistant and corrosion-resistant.
- Its strong, stable frame ensures that it remains intact and holds its shape, even when full of water, ensuring long-term durability.
- Quick Drainage: With a large drainage valve, this fish pond allows quick water release with a simple turn, saving time and making maintenance more convenient.$c$;

-- car-pet-mat-pet-seat-center-protective-net
UPDATE "products" SET
  "description" = $c$Car Pet Mat Pet Seat Center Protective Net is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 1850.00 g.

Choose the option that suits your pet - Black 137x147, Orange Red 137x147.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$car-pet-mat-pet-seat-center-protective-net$c$
    AND "description" IS DISTINCT FROM $c$Car Pet Mat Pet Seat Center Protective Net is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 1850.00 g.

Choose the option that suits your pet - Black 137x147, Orange Red 137x147.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f
UPDATE "products" SET
  "description" = $c$Grooming Hammock The PatiencET dog grooming hammock can be used for grooming your dog easily at home, such as trimming nails, grooming, bathing, eye & ear health care.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Comfortable and Safe It adopts a double-layer design and has been upgraded at the front and rear ends, making it more soft and comfortable.
- Mesh design for better breathability.
- It is equipped with a seat belt to prevent pets from running around, making it safer.
- It is suitable for kittens and small to medium-sized dogs.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f$c$
    AND "description" IS DISTINCT FROM $c$Grooming Hammock The PatiencET dog grooming hammock can be used for grooming your dog easily at home, such as trimming nails, grooming, bathing, eye & ear health care.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Comfortable and Safe It adopts a double-layer design and has been upgraded at the front and rear ends, making it more soft and comfortable.
- Mesh design for better breathability.
- It is equipped with a seat belt to prevent pets from running around, making it safer.
- It is suitable for kittens and small to medium-sized dogs.$c$;

-- cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack
UPDATE "products" SET
  "description" = $c$Anti Tracking EZ Open Edge Litter Mat: Double-layer honeycomb design helps you gather the litter.

Lightweight and easy to handle at around 184 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- You just pick up the mat and all the litter falls through and then dump it back in the litter box make it recycling.
- No more getting litter stuck to my feet on a daily basis!
- Large holes is large enough to catch and trap litter.
- Suitable for lots of type of litter, and kitty litter boxes,hooded,self cleaning litter box.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack$c$
    AND "description" IS DISTINCT FROM $c$Anti Tracking EZ Open Edge Litter Mat: Double-layer honeycomb design helps you gather the litter.

Lightweight and easy to handle at around 184 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- You just pick up the mat and all the litter falls through and then dump it back in the litter box make it recycling.
- No more getting litter stuck to my feet on a daily basis!
- Large holes is large enough to catch and trap litter.
- Suitable for lots of type of litter, and kitty litter boxes,hooded,self cleaning litter box.$c$;

-- ceramic-pet-hamster-bowl-brown
UPDATE "products" SET
  "description" = $c$Ceramic Pet Hamster Bowl, Brown is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$ceramic-pet-hamster-bowl-brown$c$
    AND "description" IS DISTINCT FROM $c$Ceramic Pet Hamster Bowl, Brown is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew
UPDATE "products" SET
  "description" = $c$Squeaky & Crinkle Dog Toys: Our plush dog toys are equipped with a squeaker within the body and crinkle paper sounds in the tails and ears.

Built to last: made from cloth, and it weighs around 68 g.

Choose the option that suits your pet - Red-L, Red-S, Khaki-L, Khaki-S, White-L, White-S.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- These multi-sensory toys are designed to captivate your dog's attention instantly.
- Our interactive plush toy features strategically placed squeakers and crinkle paper, making it highly appealing to dogs.
- These adorable toys provide hours of entertainment and various play modes for extended fun, helping to reduce stress and boredom while keeping your pet healthy.
- Ensure it's dry before giving it back to your dog.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew$c$
    AND "description" IS DISTINCT FROM $c$Squeaky & Crinkle Dog Toys: Our plush dog toys are equipped with a squeaker within the body and crinkle paper sounds in the tails and ears.

Built to last: made from cloth, and it weighs around 68 g.

Choose the option that suits your pet - Red-L, Red-S, Khaki-L, Khaki-S, White-L, White-S.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- These multi-sensory toys are designed to captivate your dog's attention instantly.
- Our interactive plush toy features strategically placed squeakers and crinkle paper, making it highly appealing to dogs.
- These adorable toys provide hours of entertainment and various play modes for extended fun, helping to reduce stress and boredom while keeping your pet healthy.
- Ensure it's dry before giving it back to your dog.$c$;

-- climbing-playing-bird-cage-accessory
UPDATE "products" SET
  "description" = $c$Climbing And Playing Bird Cage Accessories Toy Solid Wood Jumping Platform Standing Board is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from wood, and it weighs around 85.00 g.

Choose the option that suits your pet - Square 12 x 12, Small 15 x 8 cm, Large 19 x 10 cm, Large Fan, Semicircle Large, Semicircle Small, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$climbing-playing-bird-cage-accessory$c$
    AND "description" IS DISTINCT FROM $c$Climbing And Playing Bird Cage Accessories Toy Solid Wood Jumping Platform Standing Board is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from wood, and it weighs around 85.00 g.

Choose the option that suits your pet - Square 12 x 12, Small 15 x 8 cm, Large 19 x 10 cm, Large Fan, Semicircle Large, Semicircle Small, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb
UPDATE "products" SET
  "description" = $c$Comb With Rubber Handle, Flea And Tick Combs For Dogs Cats, Fine Tooth Dog Comb For Grooming is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 50 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb$c$
    AND "description" IS DISTINCT FROM $c$Comb With Rubber Handle, Flea And Tick Combs For Dogs Cats, Fine Tooth Dog Comb For Grooming is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 50 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- convenient-outing-parrot-myna-bird-cage
UPDATE "products" SET
  "description" = $c$Bag internal structure: zipper pocket.

Built to last: made from plastic, and it weighs around 1000.00 g.

Choose the option that suits your pet - Yellow, Red, Purple, Green, Black, Dark Blue, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Applicable gender: neutral/male and female.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$convenient-outing-parrot-myna-bird-cage$c$
    AND "description" IS DISTINCT FROM $c$Bag internal structure: zipper pocket.

Built to last: made from plastic, and it weighs around 1000.00 g.

Choose the option that suits your pet - Yellow, Red, Purple, Green, Black, Dark Blue, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Applicable gender: neutral/male and female.$c$;

-- cooling-pet-water-bed-cushion
UPDATE "products" SET
  "description" = $c$This water playmat features a fish design that captures the attention of pets and children.

Built to last: made from plastic, and it weighs around 18.00 g.

Choose the option that suits your pet - Shark Pirate Ship 65cm, Pond World 65cm, Undersea World 65cm, Shark Pirate Ship 100cm, Seal Dolphin 100cm, Ice pad large, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- This water playmat for cats provides a cool and comfortable sensory experience for pets.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cooling-pet-water-bed-cushion$c$
    AND "description" IS DISTINCT FROM $c$This water playmat features a fish design that captures the attention of pets and children.

Built to last: made from plastic, and it weighs around 18.00 g.

Choose the option that suits your pet - Shark Pirate Ship 65cm, Pond World 65cm, Undersea World 65cm, Shark Pirate Ship 100cm, Seal Dolphin 100cm, Ice pad large, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- This water playmat for cats provides a cool and comfortable sensory experience for pets.$c$;

-- cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water
UPDATE "products" SET
  "description" = $c$Description & Features Description & Features Dual-Tank Filtration System: This automatic pet water dispenser features separate clean water and wastewater tanks with a self-refilling ceramic bowl.

Lightweight and easy to handle at around 2018 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The innovative circulation system continuously provides fresh, hygienic drinking water for your pets, ensuring they always have access to clean hydration.
- Smart Automation Features: Utilizing advanced intelligent timing technology, this pet fountain offers customizable drainage cycles at 3/6/9-hour intervals.
- User-Friendly Operation: Featuring simple button controls, this water station activates with a 3-5 second press and hold of the power button.
- The intuitive interface allows easy water volume and refill timing adjustments through icon buttons, complemented by convenient remote control access for effortless settings management.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water$c$
    AND "description" IS DISTINCT FROM $c$Description & Features Description & Features Dual-Tank Filtration System: This automatic pet water dispenser features separate clean water and wastewater tanks with a self-refilling ceramic bowl.

Lightweight and easy to handle at around 2018 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The innovative circulation system continuously provides fresh, hygienic drinking water for your pets, ensuring they always have access to clean hydration.
- Smart Automation Features: Utilizing advanced intelligent timing technology, this pet fountain offers customizable drainage cycles at 3/6/9-hour intervals.
- User-Friendly Operation: Featuring simple button controls, this water station activates with a 3-5 second press and hold of the power button.
- The intuitive interface allows easy water volume and refill timing adjustments through icon buttons, complemented by convenient remote control access for effortless settings management.$c$;

-- cute-fruit-dog-hoodie-clothes
UPDATE "products" SET
  "description" = $c$Fruit design to make your puppy more cute, which will help reduce hair loss in the house, and avoid polluting the grass or other dust to walk your pet.

Built to last: made from cloth, and it weighs around 49.00 g.

Choose the option that suits your pet - Style 1 XS, Style 1 S, Style 1 M, Style 1 L, Style 1 XL, Style 1 2XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Breathable, lightweight, soft fabric, so that your dog in the cold autumn and winter feel more comfortable and warm.
- Suitable for walking, outdoor, sports, family, winter tours and parties, photos and daily wear for holidays.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cute-fruit-dog-hoodie-clothes$c$
    AND "description" IS DISTINCT FROM $c$Fruit design to make your puppy more cute, which will help reduce hair loss in the house, and avoid polluting the grass or other dust to walk your pet.

Built to last: made from cloth, and it weighs around 49.00 g.

Choose the option that suits your pet - Style 1 XS, Style 1 S, Style 1 M, Style 1 L, Style 1 XL, Style 1 2XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Breathable, lightweight, soft fabric, so that your dog in the cold autumn and winter feel more comfortable and warm.
- Suitable for walking, outdoor, sports, family, winter tours and parties, photos and daily wear for holidays.$c$;

-- dog-accessories-photo-concave-shape-pumpkin-hat
UPDATE "products" SET
  "description" = $c$Dog Accessories Photo Concave Shape Pumpkin Hat is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from leather and cloth, and it weighs around 45.00 g.

Choose the option that suits your pet - Black S 12.5cm, Black M 14cm, Beige S 12.5cm, Beige M 14cm, Red S 12.5cm, Red M 14cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-accessories-photo-concave-shape-pumpkin-hat$c$
    AND "description" IS DISTINCT FROM $c$Dog Accessories Photo Concave Shape Pumpkin Hat is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from leather and cloth, and it weighs around 45.00 g.

Choose the option that suits your pet - Black S 12.5cm, Black M 14cm, Beige S 12.5cm, Beige M 14cm, Red S 12.5cm, Red M 14cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar
UPDATE "products" SET
  "description" = $c$Dog Collar Engraved With Lettering To Prevent Loss Of Neck Collar is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from leather, and it weighs around 150.00 g.

Choose the option that suits your pet - Red XS, Red S, Red M, Red L, Red XL, Grey XS, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar$c$
    AND "description" IS DISTINCT FROM $c$Dog Collar Engraved With Lettering To Prevent Loss Of Neck Collar is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from leather, and it weighs around 150.00 g.

Choose the option that suits your pet - Red XS, Red S, Red M, Red L, Red XL, Grey XS, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar
UPDATE "products" SET
  "description" = $c$We have a choice of large, medium and small sizes for adult dogs and puppies or growing dogs.

Built to last: made from cloth, and it weighs around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar$c$
    AND "description" IS DISTINCT FROM $c$We have a choice of large, medium and small sizes for adult dogs and puppies or growing dogs.

Built to last: made from cloth, and it weighs around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- dog-dresses-for-outdoor-walks-with-a-leash
UPDATE "products" SET
  "description" = $c$Body length 21 inches, chest circumference 27 inches, approximately 2 jin; M.

Built to last: made from cloth, and it weighs around 120.00 g.

Choose the option that suits your pet - Round neck gray plaid S, Round neck gray plaid M, Round neck gray plaid L, Round neck gray plaid XL, Round neck gray plaid XXL.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Body length 25 inches, chest circumference 33 inches, approximately 3.
- Body length 30 inches, chest circumference 38 inches, approximately 5.
- Body length 34 inches, chest circumference 44 inches, approximately 7.
- Body length 40 inches, chest circumference 50 inches, approximately 10.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-dresses-for-outdoor-walks-with-a-leash$c$
    AND "description" IS DISTINCT FROM $c$Body length 21 inches, chest circumference 27 inches, approximately 2 jin; M.

Built to last: made from cloth, and it weighs around 120.00 g.

Choose the option that suits your pet - Round neck gray plaid S, Round neck gray plaid M, Round neck gray plaid L, Round neck gray plaid XL, Round neck gray plaid XXL.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Body length 25 inches, chest circumference 33 inches, approximately 3.
- Body length 30 inches, chest circumference 38 inches, approximately 5.
- Body length 34 inches, chest circumference 44 inches, approximately 7.
- Body length 40 inches, chest circumference 50 inches, approximately 10.$c$;

-- dog-four-seasons-breathable-soft-bottom-jumpsuit
UPDATE "products" SET
  "description" = $c$Dog Four Seasons Breathable Soft Bottom Jumpsuit is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 141.00 g.

Choose the option that suits your pet - Color Mixing XS, Color Mixing S, Color Mixing M, Color Mixing L, Color Mixing XL, Dark Blue XS, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-four-seasons-breathable-soft-bottom-jumpsuit$c$
    AND "description" IS DISTINCT FROM $c$Dog Four Seasons Breathable Soft Bottom Jumpsuit is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 141.00 g.

Choose the option that suits your pet - Color Mixing XS, Color Mixing S, Color Mixing M, Color Mixing L, Color Mixing XL, Dark Blue XS, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- dog-mouth-cover-golden-retrievergerman-shepherd-dedicated
UPDATE "products" SET
  "description" = $c$Dog Mouth Cover Golden RetrieverGerman Shepherd Dedicated is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from metal and leather, and it weighs around 250.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-mouth-cover-golden-retrievergerman-shepherd-dedicated$c$
    AND "description" IS DISTINCT FROM $c$Dog Mouth Cover Golden RetrieverGerman Shepherd Dedicated is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from metal and leather, and it weighs around 250.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform
UPDATE "products" SET
  "description" = $c$Dog Ramp For Bed, Pet Ramp For Dogs With Non-Slip Carpet And Top Platform is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 14000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform$c$
    AND "description" IS DISTINCT FROM $c$Dog Ramp For Bed, Pet Ramp For Dogs With Non-Slip Carpet And Top Platform is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 14000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy
UPDATE "products" SET
  "description" = $c$Dog Toy For Entertainment And Self-Amusement Sounding Pet Food-Dispensing Toy Sniffing Mat is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 900.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy$c$
    AND "description" IS DISTINCT FROM $c$Dog Toy For Entertainment And Self-Amusement Sounding Pet Food-Dispensing Toy Sniffing Mat is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 900.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo
UPDATE "products" SET
  "description" = $c$New communication tool about you and your puppy.

Lightweight and easy to handle at around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Pet Dog Training Clickers for Puppy, Cat, Potty, Bird, Horse, Pet, Trainer Training Tools, Behavior Aids Just press to mark desired behavior, then reward for faster learning.
- The spring wrist length: 16cm/6.3inches and can strength to 25cm/9.84inches.
- Package include: Black + Blue,each color 1 pcs.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo$c$
    AND "description" IS DISTINCT FROM $c$New communication tool about you and your puppy.

Lightweight and easy to handle at around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Pet Dog Training Clickers for Puppy, Cat, Potty, Bird, Horse, Pet, Trainer Training Tools, Behavior Aids Just press to mark desired behavior, then reward for faster learning.
- The spring wrist length: 16cm/6.3inches and can strength to 25cm/9.84inches.
- Package include: Black + Blue,each color 1 pcs.$c$;

-- electric-jumping-shrimp-cat-toy
UPDATE "products" SET
  "description" = $c$The lobster can be activated by tapping the tail of the lobster, and there are three modes of tail swinging.

Built to last: made from cloth, and it weighs around 126.00 g.

Choose the option that suits your pet - Jumping shrimp random colour 35cm USB, Soft sewn on eyes 32cm USB.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The movement adopts pom material to make the lobster more resistant to falling and knocking.
- USB Rechargeable Cat Toy: Built-in sensor, can automatically flip or move.
- It moves in a swinging manner, attracting your child to play, the chargeable motor is detachable, and you can unzip the zipper to take out it and clean it easily.
- Child Good Choice: The toys adopt excellent materials and exquisite design concepts so that children can enjoy the joy of childhood toys.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$electric-jumping-shrimp-cat-toy$c$
    AND "description" IS DISTINCT FROM $c$The lobster can be activated by tapping the tail of the lobster, and there are three modes of tail swinging.

Built to last: made from cloth, and it weighs around 126.00 g.

Choose the option that suits your pet - Jumping shrimp random colour 35cm USB, Soft sewn on eyes 32cm USB.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The movement adopts pom material to make the lobster more resistant to falling and knocking.
- USB Rechargeable Cat Toy: Built-in sensor, can automatically flip or move.
- It moves in a swinging manner, attracting your child to play, the chargeable motor is detachable, and you can unzip the zipper to take out it and clean it easily.
- Child Good Choice: The toys adopt excellent materials and exquisite design concepts so that children can enjoy the joy of childhood toys.$c$;

-- elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p
UPDATE "products" SET
  "description" = $c$Our ultra-breathable mesh fabric promotes constant air circulation, making it the perfect solution for hot summer days across the US, where overheating is a top concern for pet parents.

Lightweight and easy to handle at around 1000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The waterproof, stain-resistant mesh is easy to wipe clean, while the sturdy four-leg frame ensures long-lasting stability.
- The low-profile height is gentle on senior pets or those with joint issues, and the lightweight design (1.0KG for L/XL/XXL, 1.6KG for XXXL) makes it effortless to take on trips or visit friends.
- Invest in your pet's comfort with a premium bed that blends style, durability, and functionality-your furry friend deserves the best.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p$c$
    AND "description" IS DISTINCT FROM $c$Our ultra-breathable mesh fabric promotes constant air circulation, making it the perfect solution for hot summer days across the US, where overheating is a top concern for pet parents.

Lightweight and easy to handle at around 1000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The waterproof, stain-resistant mesh is easy to wipe clean, while the sturdy four-leg frame ensures long-lasting stability.
- The low-profile height is gentle on senior pets or those with joint issues, and the lightweight design (1.0KG for L/XL/XXL, 1.6KG for XXXL) makes it effortless to take on trips or visit friends.
- Invest in your pet's comfort with a premium bed that blends style, durability, and functionality-your furry friend deserves the best.$c$;

-- fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu
UPDATE "products" SET
  "description" = $c$Algae removal, green/yellow water treatment,.

Lightweight and easy to handle at around 450 g.

Choose the option that suits your pet - US ZY 0Z, European ZY OZ.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu$c$
    AND "description" IS DISTINCT FROM $c$Algae removal, green/yellow water treatment,.

Lightweight and easy to handle at around 450 g.

Choose the option that suits your pet - US ZY 0Z, European ZY OZ.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa
UPDATE "products" SET
  "description" = $c$Floating Frog On Swim Ring Resin Aquarium Ornament, Fish Tank Decor, Water Surface Accessory is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa$c$
    AND "description" IS DISTINCT FROM $c$Floating Frog On Swim Ring Resin Aquarium Ornament, Fish Tank Decor, Water Surface Accessory is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- floating-pet-water-bowl-1-5l
UPDATE "products" SET
  "description" = $c$Waterproof and easy to clean: The dual design of a waterproof frame and floating plate effectively prevents overflow.

Built to last: made from plastic, and it weighs around 400.00 g.

Choose the option that suits your pet - Pink, Blue, Grey, White, Pink 2L, White 2L, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Pet drinking fountains keep the floor clean and tidy.
- The pet water basin is easy to disassemble and assemble, suitable for weekly cleaning, and absolutely clean, to ensure the health of the pet.
- Slow water intake: The design of the automatic adjustment floating plate can reduce the pet's drinking water speed.
- Floating cat water basins can prevent pets from suffocating and vomiting.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$floating-pet-water-bowl-1-5l$c$
    AND "description" IS DISTINCT FROM $c$Waterproof and easy to clean: The dual design of a waterproof frame and floating plate effectively prevents overflow.

Built to last: made from plastic, and it weighs around 400.00 g.

Choose the option that suits your pet - Pink, Blue, Grey, White, Pink 2L, White 2L, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Pet drinking fountains keep the floor clean and tidy.
- The pet water basin is easy to disassemble and assemble, suitable for weekly cleaning, and absolutely clean, to ensure the health of the pet.
- Slow water intake: The design of the automatic adjustment floating plate can reduce the pet's drinking water speed.
- Floating cat water basins can prevent pets from suffocating and vomiting.$c$;

-- foldable-dog-house-cat-bed
UPDATE "products" SET
  "description" = $c$Can be placed in a balcony corridor or other places without worrying about sliding, providing a warm and dry shelter for pets.

Built to last: made from cloth, and it weighs around 55.00 g.

Choose the option that suits your pet - Green bear den Large, Green bear den Medium, Green bear den Small, Grey stars Blue Large, Grey stars Blue Medium, Grey stars Blue Small, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$foldable-dog-house-cat-bed$c$
    AND "description" IS DISTINCT FROM $c$Can be placed in a balcony corridor or other places without worrying about sliding, providing a warm and dry shelter for pets.

Built to last: made from cloth, and it weighs around 55.00 g.

Choose the option that suits your pet - Green bear den Large, Green bear den Medium, Green bear den Small, Grey stars Blue Large, Grey stars Blue Medium, Grey stars Blue Small, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- foldable-pet-tent-bed-with-cooling-mat
UPDATE "products" SET
  "description" = $c$High-quality comfort for your pets, keeps your pet cozy and warm.

Built to last: made from cloth, and it weighs around 464.00 g.

Choose the option that suits your pet - S Military Green, M Military Green, L Military Green, S Green Grey, M Green Grey, L Green Grey.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It spends cool even in summer.
- Machine wash the inner cushion and outer microfiber fabric in cold water only.
- This comfortable bed is lightweight and portable, suitable for travel.
- This pet keeps your pet comfortable while camping and traveling in the wild.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$foldable-pet-tent-bed-with-cooling-mat$c$
    AND "description" IS DISTINCT FROM $c$High-quality comfort for your pets, keeps your pet cozy and warm.

Built to last: made from cloth, and it weighs around 464.00 g.

Choose the option that suits your pet - S Military Green, M Military Green, L Military Green, S Green Grey, M Green Grey, L Green Grey.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It spends cool even in summer.
- Machine wash the inner cushion and outer microfiber fabric in cold water only.
- This comfortable bed is lightweight and portable, suitable for travel.
- This pet keeps your pet comfortable while camping and traveling in the wild.$c$;

-- four-seasons-universal-cat-recliner-bed
UPDATE "products" SET
  "description" = $c$Whether the source of patented goods: No.

Built to last: made from metal, and it weighs around 1544.00 g.

Choose the option that suits your pet - Grey 45 x 45 x 35, Pink 45 x 45 x 35, Sandwich cloth pink 45 x 45 x 35.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$four-seasons-universal-cat-recliner-bed$c$
    AND "description" IS DISTINCT FROM $c$Whether the source of patented goods: No.

Built to last: made from metal, and it weighs around 1544.00 g.

Choose the option that suits your pet - Grey 45 x 45 x 35, Pink 45 x 45 x 35, Sandwich cloth pink 45 x 45 x 35.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely
UPDATE "products" SET
  "description" = $c$In outdoor scenarios such as lawns and campsites, simply drive the accompanying ground stake firmly into the ground to quickly secure the leash, without relying on fixed objects like trees or railings.

Lightweight and easy to handle at around 400 g.

Choose the option that suits your pet - Fluorescent green-9M, Navy blue-9M, Purple-9M, Bright yellow-9M, Orange-9M.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The installation is convenient and stable.
- Once fixed, your dog can move freely within the designated safe range, avoiding the trouble of the leash getting tangled and freeing the owner from holding the leash at all times, providing more peace of mind while.
- The leash features an extended design of 30 feet (approximately 9.14 meters), providing ample space for your dog to move around.
- Whether running, playing, or strolling leisurely, your dog can stretch freely, completely getting rid of the sense of constraint caused by a small activity range.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely$c$
    AND "description" IS DISTINCT FROM $c$In outdoor scenarios such as lawns and campsites, simply drive the accompanying ground stake firmly into the ground to quickly secure the leash, without relying on fixed objects like trees or railings.

Lightweight and easy to handle at around 400 g.

Choose the option that suits your pet - Fluorescent green-9M, Navy blue-9M, Purple-9M, Bright yellow-9M, Orange-9M.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The installation is convenient and stable.
- Once fixed, your dog can move freely within the designated safe range, avoiding the trouble of the leash getting tangled and freeing the owner from holding the leash at all times, providing more peace of mind while.
- The leash features an extended design of 30 feet (approximately 9.14 meters), providing ample space for your dog to move around.
- Whether running, playing, or strolling leisurely, your dog can stretch freely, completely getting rid of the sense of constraint caused by a small activity range.$c$;

-- heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum
UPDATE "products" SET
  "description" = $c$Stable structure with multi-column support 50 lbs per level, multi-column and thickened base reduce tipping risk, giving you peace of mind.

Lightweight and easy to handle at around 18000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- No-drill design protects walls Freestanding structure requires no drilling, letting you use it safely in homes and rentals.
- Neutral wood appearance fits home decor Natural wood finish matches various interior styles, saving you the trouble of mismatching.
- Independent spaces for multi-cat households Open condo, capsules and perches reduce cat conflicts, letting you avoid mediating fights.
- 360° viewing keeps cats calm Elevated perches and transparent capsules keep cats relaxed, preventing anxious destruction.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum$c$
    AND "description" IS DISTINCT FROM $c$Stable structure with multi-column support 50 lbs per level, multi-column and thickened base reduce tipping risk, giving you peace of mind.

Lightweight and easy to handle at around 18000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- No-drill design protects walls Freestanding structure requires no drilling, letting you use it safely in homes and rentals.
- Neutral wood appearance fits home decor Natural wood finish matches various interior styles, saving you the trouble of mismatching.
- Independent spaces for multi-cat households Open condo, capsules and perches reduce cat conflicts, letting you avoid mediating fights.
- 360° viewing keeps cats calm Elevated perches and transparent capsules keep cats relaxed, preventing anxious destruction.$c$;

-- intelligent-litter-box-automatic-self-cleaning-deodorant
UPDATE "products" SET
  "description" = $c$Intelligent Litter Box Fully Enclosed Anti-splash Automatic Cleaning Deodorant is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 8500.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$intelligent-litter-box-automatic-self-cleaning-deodorant$c$
    AND "description" IS DISTINCT FROM $c$Intelligent Litter Box Fully Enclosed Anti-splash Automatic Cleaning Deodorant is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 8500.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set
UPDATE "products" SET
  "description" = $c$Encourages playfulness and exercise: This interactive toy stimulates your cat's natural hunting instinct, promoting both physical and mental activity.

Lightweight and easy to handle at around 710 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Simple and safe design: Designed for hassle-free play.
- The moving parts are securely attached to prevent accidental swallowing.
- Includes replacement parts: The set includes the main toy plus two additional spring elements to extend playtime and provide variety.
- Easy to use: Easy for you to operate to keep your cat entertained.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set$c$
    AND "description" IS DISTINCT FROM $c$Encourages playfulness and exercise: This interactive toy stimulates your cat's natural hunting instinct, promoting both physical and mental activity.

Lightweight and easy to handle at around 710 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Simple and safe design: Designed for hassle-free play.
- The moving parts are securely attached to prevent accidental swallowing.
- Includes replacement parts: The set includes the main toy plus two additional spring elements to extend playtime and provide variety.
- Easy to use: Easy for you to operate to keep your cat entertained.$c$;

-- interactive-cat-toy-ball-super-drive
UPDATE "products" SET
  "description" = $c$Auto shut off-Works 5 minutes and goes into sleep mode if cats aren't playing with it and wakes up once (after 2h) in a while to see if they are now interested.

Built to last: made from plastic, and it weighs around 57.00 g.

Choose the option that suits your pet - Magic Tail Style Red, Magic Tail Style Green, Magic Tail Gray, With Rope Style Red, With Rope Style Green, With Rope Style Gray, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Wake-up features-pets could make toys activate by paw's touch, and motion cat toys will help interact with cats when you are out.
- Working modes-Fast speed or slow speed, interactive mode will only react when the pet pats it.
- Definitely recommend it for outgoing cats. (Blue lights-fast mode, purple lighs-slow mode, yellow lights-interactive mode).
- Chirping cat toys-realistic bird song could attract cats interested in this game, voice could be turned off by quickly pressing a button twice.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$interactive-cat-toy-ball-super-drive$c$
    AND "description" IS DISTINCT FROM $c$Auto shut off-Works 5 minutes and goes into sleep mode if cats aren't playing with it and wakes up once (after 2h) in a while to see if they are now interested.

Built to last: made from plastic, and it weighs around 57.00 g.

Choose the option that suits your pet - Magic Tail Style Red, Magic Tail Style Green, Magic Tail Gray, With Rope Style Red, With Rope Style Green, With Rope Style Gray, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Wake-up features-pets could make toys activate by paw's touch, and motion cat toys will help interact with cats when you are out.
- Working modes-Fast speed or slow speed, interactive mode will only react when the pet pats it.
- Definitely recommend it for outgoing cats. (Blue lights-fast mode, purple lighs-slow mode, yellow lights-interactive mode).
- Chirping cat toys-realistic bird song could attract cats interested in this game, voice could be turned off by quickly pressing a button twice.$c$;

-- interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d
UPDATE "products" SET
  "description" = $c$Dog Treat Ball Introducing the Dog Treat Ball-an interactive chew toydesigned for small and medium dogs.

Built to last: made from plastic, and it weighs around 200 g.

Choose the option that suits your pet - S, L.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- This unique ballcombines fun with functionality, making it perfect forboredom relief, lQ training, and slow feeding.lt's adurable teething toy that's safe for your furry friend.
- Interactive Design: Engages your dog in playtime.
- Treat Dispensing: Encourages natural foraginginstincts.
- Bite-Resistant: Built to withstand tough chewing.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d$c$
    AND "description" IS DISTINCT FROM $c$Dog Treat Ball Introducing the Dog Treat Ball-an interactive chew toydesigned for small and medium dogs.

Built to last: made from plastic, and it weighs around 200 g.

Choose the option that suits your pet - S, L.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- This unique ballcombines fun with functionality, making it perfect forboredom relief, lQ training, and slow feeding.lt's adurable teething toy that's safe for your furry friend.
- Interactive Design: Engages your dog in playtime.
- Treat Dispensing: Encourages natural foraginginstincts.
- Bite-Resistant: Built to withstand tough chewing.$c$;

-- large-dog-border-collie-pet-sweater
UPDATE "products" SET
  "description" = $c$Chest circumference 70 cm (recommended for pets weighing 10.

Built to last: made from cloth, and it weighs around 290.00 g.

Choose the option that suits your pet - 3XL Blue, 3XL Coffee Color, 4XL Blue, 4XL Coffee Color, 5XL Blue, 5XL Coffee Color, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Chest circumference 75 cm (recommended for pets weighing 15.
- Chest circumference 80 cm (recommended for pets weighing 20.
- Chest circumference 85 cm (recommended for pets weighing 25.
- Chest circumference 90 cm (recommended for pets weighing 30.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$large-dog-border-collie-pet-sweater$c$
    AND "description" IS DISTINCT FROM $c$Chest circumference 70 cm (recommended for pets weighing 10.

Built to last: made from cloth, and it weighs around 290.00 g.

Choose the option that suits your pet - 3XL Blue, 3XL Coffee Color, 4XL Blue, 4XL Coffee Color, 5XL Blue, 5XL Coffee Color, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Chest circumference 75 cm (recommended for pets weighing 15.
- Chest circumference 80 cm (recommended for pets weighing 20.
- Chest circumference 85 cm (recommended for pets weighing 25.
- Chest circumference 90 cm (recommended for pets weighing 30.$c$;

-- lavender-scented-disposable-pet-training-pads
UPDATE "products" SET
  "description" = $c$Overview Soft, quick-absorbing pet training pads with natural lavender scent effectively lock in liquid and neutralize unpleasant odors, equipped with leak-proof back film to safeguard floors and carpets.

Built to last: made from cloth, packed at Carton,Plastic bags, and it weighs around 1720 g.

Choose the option that suits your pet - 565, 786.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Perfect for puppy housebreaking, dog litter training, pet travel, in-crate use, sick pet nursing and daily household pet care scenarios.
- Product information Material: All cotton.
- 3 cm error is normal for manual measurement.
- Check the detailed size chart prior to purchase.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$lavender-scented-disposable-pet-training-pads$c$
    AND "description" IS DISTINCT FROM $c$Overview Soft, quick-absorbing pet training pads with natural lavender scent effectively lock in liquid and neutralize unpleasant odors, equipped with leak-proof back film to safeguard floors and carpets.

Built to last: made from cloth, packed at Carton,Plastic bags, and it weighs around 1720 g.

Choose the option that suits your pet - 565, 786.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Perfect for puppy housebreaking, dog litter training, pet travel, in-crate use, sick pet nursing and daily household pet care scenarios.
- Product information Material: All cotton.
- 3 cm error is normal for manual measurement.
- Check the detailed size chart prior to purchase.$c$;

-- multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area
UPDATE "products" SET
  "description" = $c$Multi-functional cat tree house cat climbing frame, lounge and recreation area detachable toy, 54in is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 6895 g.

Choose the option that suits your pet - Beige, dark blue.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area$c$
    AND "description" IS DISTINCT FROM $c$Multi-functional cat tree house cat climbing frame, lounge and recreation area detachable toy, 54in is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Lightweight and easy to handle at around 6895 g.

Choose the option that suits your pet - Beige, dark blue.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel
UPDATE "products" SET
  "description" = $c$Additionally, it also features a swinging spring ball to provide your cat with endless fun and relaxation options.

Built to last: made from wood, and it weighs around 4085 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Comfortable Headrest: Equipped with a soft PP cotton-wrapped headrest, this cat bed offers optimal support to your cat's head, ensuring a cozy sleeping experience and relieving cervical pressure.
- Quick and Easy Installation: This cat scratching post is designed with a simple structure and detailed instructions, allowing you to set up effortlessly in no time.
- Just insert the 2 mushroom panels inside the base and fixed them with screws, and then assemble the swinging ball, your cat will get a wonderful leisure place immediately!
- Cute Appearance and Stable Frame: With soft faux fabric and adorable mushroom decorations, this cat bed adds a touch of charm to your room space.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel$c$
    AND "description" IS DISTINCT FROM $c$Additionally, it also features a swinging spring ball to provide your cat with endless fun and relaxation options.

Built to last: made from wood, and it weighs around 4085 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Comfortable Headrest: Equipped with a soft PP cotton-wrapped headrest, this cat bed offers optimal support to your cat's head, ensuring a cozy sleeping experience and relieving cervical pressure.
- Quick and Easy Installation: This cat scratching post is designed with a simple structure and detailed instructions, allowing you to set up effortlessly in no time.
- Just insert the 2 mushroom panels inside the base and fixed them with screws, and then assemble the swinging ball, your cat will get a wonderful leisure place immediately!
- Cute Appearance and Stable Frame: With soft faux fabric and adorable mushroom decorations, this cat bed adds a touch of charm to your room space.$c$;

-- no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac
UPDATE "products" SET
  "description" = $c$Make everyday walks and outdoor adventures more convenient with this no-pull dog harness, collar, and leash set.

Lightweight and easy to handle at around 250 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Designed as a practical walking solution, the set includes essential accessories to help keep your dog comfortably equipped while you're out for walks, trips, and other activities.
- The adjustable harness and collar allow for a more personalized fit, while the matching leash provides convenient control during outdoor walks.
- The coordinated design also makes it easy to keep your pet's walking essentials together.
- This set is suitable for daily walks, neighborhood outings, park visits, travel, training sessions, and outdoor adventures.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac$c$
    AND "description" IS DISTINCT FROM $c$Make everyday walks and outdoor adventures more convenient with this no-pull dog harness, collar, and leash set.

Lightweight and easy to handle at around 250 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Designed as a practical walking solution, the set includes essential accessories to help keep your dog comfortably equipped while you're out for walks, trips, and other activities.
- The adjustable harness and collar allow for a more personalized fit, while the matching leash provides convenient control during outdoor walks.
- The coordinated design also makes it easy to keep your pet's walking essentials together.
- This set is suitable for daily walks, neighborhood outings, park visits, travel, training sessions, and outdoor adventures.$c$;

-- nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover
UPDATE "products" SET
  "description" = $c$Fabric principal component content: 95.

Built to last: made from cloth, and it weighs around 600.00 g.

Choose the option that suits your pet - Bright Red Single 90x140cm, Bright Red Double 145x185cm, Bright Red Three People 190x230cm, Bright Red 235x300cm For Four People, Advanced Yellow Single 90x140cm, Advanced Yellow Double 145x185cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover$c$
    AND "description" IS DISTINCT FROM $c$Fabric principal component content: 95.

Built to last: made from cloth, and it weighs around 600.00 g.

Choose the option that suits your pet - Bright Red Single 90x140cm, Bright Red Double 145x185cm, Bright Red Three People 190x230cm, Bright Red 235x300cm For Four People, Advanced Yellow Single 90x140cm, Advanced Yellow Double 145x185cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w
UPDATE "products" SET
  "description" = $c$Highlights Effectively prevent annoyed unwanted guest, like squirrels or larger birds from overtaking the food.

Lightweight and easy to handle at around 1000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- 4 Feeding ports let your kids observe 4 birds feeding simultaneously.
- Withstand different weather conditions, like rain, wind, snow, heat, frost,.
- The top lid is easy to open and refill food.
- Enjoy the leisure time of bird watching.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w$c$
    AND "description" IS DISTINCT FROM $c$Highlights Effectively prevent annoyed unwanted guest, like squirrels or larger birds from overtaking the food.

Lightweight and easy to handle at around 1000 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- 4 Feeding ports let your kids observe 4 birds feeding simultaneously.
- Withstand different weather conditions, like rain, wind, snow, heat, frost,.
- The top lid is easy to open and refill food.
- Enjoy the leisure time of bird watching.$c$;

-- parrot-bird-cage-with-feeder
UPDATE "products" SET
  "description" = $c$Parrot Xuanfeng Bird Cage With Feeder Toy Grass Nest Breeding Box is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from metal, and it weighs around 6600.00 g.

Choose the option that suits your pet - Black Standard Meal, Black Swing Package, Black Grass Nest Package, Black Boutique Package, Black Deluxe Package, White Standard Meal, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$parrot-bird-cage-with-feeder$c$
    AND "description" IS DISTINCT FROM $c$Parrot Xuanfeng Bird Cage With Feeder Toy Grass Nest Breeding Box is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from metal, and it weighs around 6600.00 g.

Choose the option that suits your pet - Black Standard Meal, Black Swing Package, Black Grass Nest Package, Black Boutique Package, Black Deluxe Package, White Standard Meal, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- parrot-out-rope-towing-anti-loss-flight-suit
UPDATE "products" SET
  "description" = $c$Parrot Out Rope Towing Anti Loss Flight Suit is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 17.00 g.

Choose the option that suits your pet - 1 Meter Purple 4x8cm, 1 Meter Purple 5x8.5cm, 1 Meter Purple 5.5x10cm, 1 Meter Purple 6x10.5cm, 1 Meter Purple 12x7cm, 1 Meter Purple 13x7.5cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$parrot-out-rope-towing-anti-loss-flight-suit$c$
    AND "description" IS DISTINCT FROM $c$Parrot Out Rope Towing Anti Loss Flight Suit is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 17.00 g.

Choose the option that suits your pet - 1 Meter Purple 4x8cm, 1 Meter Purple 5x8.5cm, 1 Meter Purple 5.5x10cm, 1 Meter Purple 6x10.5cm, 1 Meter Purple 12x7cm, 1 Meter Purple 13x7.5cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play
UPDATE "products" SET
  "description" = $c$Made of wood material, safe and non-toxic.

Lightweight and easy to handle at around 925 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Portable Parrot Stand is easy to move throughout your home.
- You can put it in the bird cage as a bird cage rack.
- Keep your pet bird entertained for hours, a great gift for your bird.
- Multifunctional ladder toy, suitable for cockatiel, parrot, bird Package: 1* swing toy.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play$c$
    AND "description" IS DISTINCT FROM $c$Made of wood material, safe and non-toxic.

Lightweight and easy to handle at around 925 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Portable Parrot Stand is easy to move throughout your home.
- You can put it in the bird cage as a bird cage rack.
- Keep your pet bird entertained for hours, a great gift for your bird.
- Multifunctional ladder toy, suitable for cockatiel, parrot, bird Package: 1* swing toy.$c$;

-- pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal
UPDATE "products" SET
  "description" = $c$Cloud-Like Comfort: This blanket is made with premium 300GSM coral fleece that feels way more expensive than it is.

Built to last: made from cloth, and it weighs around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It's lightweight but plush enough for year-round snuggles.
- Perfect for small dogs, cats, puppies, and kittens who demand maximum cozy Protects Your Furniture Without the Fuss: Fur, dander, muddy paws.
- This blanket catches it all so your couch, bed, and car seats stay clean.
- Just toss it on and let your pet lounge anywhere without stressing about the mess.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal$c$
    AND "description" IS DISTINCT FROM $c$Cloud-Like Comfort: This blanket is made with premium 300GSM coral fleece that feels way more expensive than it is.

Built to last: made from cloth, and it weighs around 100 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It's lightweight but plush enough for year-round snuggles.
- Perfect for small dogs, cats, puppies, and kittens who demand maximum cozy Protects Your Furniture Without the Fuss: Fur, dander, muddy paws.
- This blanket catches it all so your couch, bed, and car seats stay clean.
- Just toss it on and let your pet lounge anywhere without stressing about the mess.$c$;

-- pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive
UPDATE "products" SET
  "description" = $c$Best Ways to Play: Our cat tunnel with 3 spacious tunnels, peephole & ball toy, this popular cat toy gives your kitty more ways to have fun.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Provides hours of exercise & self-amusement.
- This cat tunnel is more suitable for kittens and is made of polyester material.
- Durable Construction: This cat tunnels for indoor cats use polyester fabric material design, not easy to scratch, sturdy spring steel frame, with protective end, Can play hide and seek game.
- Collapsible & portable: Our cat tunnel folds down small in seconds for easy travel and storage.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive$c$
    AND "description" IS DISTINCT FROM $c$Best Ways to Play: Our cat tunnel with 3 spacious tunnels, peephole & ball toy, this popular cat toy gives your kitty more ways to have fun.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Provides hours of exercise & self-amusement.
- This cat tunnel is more suitable for kittens and is made of polyester material.
- Durable Construction: This cat tunnels for indoor cats use polyester fabric material design, not easy to scratch, sturdy spring steel frame, with protective end, Can play hide and seek game.
- Collapsible & portable: Our cat tunnel folds down small in seconds for easy travel and storage.$c$;

-- pet-clothes-dog-anxiety-jacket-warm-vest
UPDATE "products" SET
  "description" = $c$Pet Clothes Dog Anxiety Jacket Warm Vest is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 45.00 g.

Choose the option that suits your pet - Heather Gray XXS, Heather Gray XS, Heather Gray S, Heather Gray M, Heather Gray L, Heather Gray XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-clothes-dog-anxiety-jacket-warm-vest$c$
    AND "description" IS DISTINCT FROM $c$Pet Clothes Dog Anxiety Jacket Warm Vest is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 45.00 g.

Choose the option that suits your pet - Heather Gray XXS, Heather Gray XS, Heather Gray S, Heather Gray M, Heather Gray L, Heather Gray XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- pet-clothes-round-neck-t-shirt
UPDATE "products" SET
  "description" = $c$Pet Clothes Round Neck T-shirt is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 100.00 g.

Choose the option that suits your pet - Red S, Red M, Red L, Red XL, Red XXL, Blue S, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-clothes-round-neck-t-shirt$c$
    AND "description" IS DISTINCT FROM $c$Pet Clothes Round Neck T-shirt is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 100.00 g.

Choose the option that suits your pet - Red S, Red M, Red L, Red XL, Red XXL, Blue S, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- pet-cooling-pad-bed
UPDATE "products" SET
  "description" = $c$Cooling Material: The cooling mat is made of high-tech cooling cloth, which makes your pet enjoy a better cooling effect in summer.

Built to last: made from cloth, and it weighs around 200.00 g.

Choose the option that suits your pet - Blue S, Blue M, Red S, Red M, Blue L, Red L.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Multi-function: Portable and easy to fold, can be used on sleeping beds, kennel mats, cover car seats, lawns, beaches, indoors, or outdoors anywhere you want.
- Improve Sleep: Cooling dog bed mat uses no electricity and contains no toxic gels.
- It wicks heat out and releases it into the air, keeping the dog/cat feeling cool, have your pet in deep sleep and relax.
- Washable: The mat is lightweight, easy to machine wash, and quick to dry.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-cooling-pad-bed$c$
    AND "description" IS DISTINCT FROM $c$Cooling Material: The cooling mat is made of high-tech cooling cloth, which makes your pet enjoy a better cooling effect in summer.

Built to last: made from cloth, and it weighs around 200.00 g.

Choose the option that suits your pet - Blue S, Blue M, Red S, Red M, Blue L, Red L.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Multi-function: Portable and easy to fold, can be used on sleeping beds, kennel mats, cover car seats, lawns, beaches, indoors, or outdoors anywhere you want.
- Improve Sleep: Cooling dog bed mat uses no electricity and contains no toxic gels.
- It wicks heat out and releases it into the air, keeping the dog/cat feeling cool, have your pet in deep sleep and relax.
- Washable: The mat is lightweight, easy to machine wash, and quick to dry.$c$;

-- pet-dog-carrier-bag-double-shoulder-travel-backpack
UPDATE "products" SET
  "description" = $c$Multiple size options for all fits.

Built to last: made from cloth, and it weighs around 440.00 g.

Choose the option that suits your pet - S Black, M Black, L Black, XL Black, S Red, M Red, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-dog-carrier-bag-double-shoulder-travel-backpack$c$
    AND "description" IS DISTINCT FROM $c$Multiple size options for all fits.

Built to last: made from cloth, and it weighs around 440.00 g.

Choose the option that suits your pet - S Black, M Black, L Black, XL Black, S Red, M Red, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- pet-dog-color-block-cardigan-sweater
UPDATE "products" SET
  "description" = $c$Green collar, sky-blue collar; Mohair style.

Built to last: made from cloth, and it weighs around 57.00 g.

Choose the option that suits your pet - Chrysanthemum XS, Chrysanthemum S, Chrysanthemum M, Chrysanthemum L, Chrysanthemum XL, Chrysanthemum 2XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-dog-color-block-cardigan-sweater$c$
    AND "description" IS DISTINCT FROM $c$Green collar, sky-blue collar; Mohair style.

Built to last: made from cloth, and it weighs around 57.00 g.

Choose the option that suits your pet - Chrysanthemum XS, Chrysanthemum S, Chrysanthemum M, Chrysanthemum L, Chrysanthemum XL, Chrysanthemum 2XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki
UPDATE "products" SET
  "description" = $c$Comes with 7-inch cutting scissors, thinning shear, curved scissors, a grooming comb for removes tangles, mats, loose hair and dirt, Stimulates skin and hair follicles.

Lightweight and easy to handle at around 454 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Heavy Duty Stainless Steel Construction.
- All Shears and grooming combs are made with heavy duty Stainless Steel, Coated Titanium and Cold treatment for hardness, durability and style; The blade of scissors is very smooth, sharp and durable without rusting.
- This process reduces the friction to shear pet hair breezily.
- Complete Dog & Cat Grooming Kits.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki$c$
    AND "description" IS DISTINCT FROM $c$Comes with 7-inch cutting scissors, thinning shear, curved scissors, a grooming comb for removes tangles, mats, loose hair and dirt, Stimulates skin and hair follicles.

Lightweight and easy to handle at around 454 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Heavy Duty Stainless Steel Construction.
- All Shears and grooming combs are made with heavy duty Stainless Steel, Coated Titanium and Cold treatment for hardness, durability and style; The blade of scissors is very smooth, sharp and durable without rusting.
- This process reduces the friction to shear pet hair breezily.
- Complete Dog & Cat Grooming Kits.$c$;

-- pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des
UPDATE "products" SET
  "description" = $c$Pet Fur Memory Charm Leather Keychain Keepsake For Dog Cat Hair Paw-Shaped Design Memorial Sympathy Gift For Grieving Owners is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic and leather, and it weighs around 24 g.

Choose the option that suits your pet - Pink, Yellow, Brown, Black, Red.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des$c$
    AND "description" IS DISTINCT FROM $c$Pet Fur Memory Charm Leather Keychain Keepsake For Dog Cat Hair Paw-Shaped Design Memorial Sympathy Gift For Grieving Owners is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic and leather, and it weighs around 24 g.

Choose the option that suits your pet - Pink, Yellow, Brown, Black, Red.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- pet-nail-clippers
UPDATE "products" SET
  "description" = $c$Professional pet nail clippersDesigned to safely trim the claws of small and medium pets such as kitty cats, puppy, Teddy dog, rabbits and so on.

Built to last: made from plastic, and it weighs around 89.00 g.

Choose the option that suits your pet - Pink, Light coffee, Light Blue.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Built-in LED light, can clearly illuminate the bleeding line, prevent nail bleeding.
- Easy to useErgonomically designed non-slip handles are easy and comfortable to use.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-nail-clippers$c$
    AND "description" IS DISTINCT FROM $c$Professional pet nail clippersDesigned to safely trim the claws of small and medium pets such as kitty cats, puppy, Teddy dog, rabbits and so on.

Built to last: made from plastic, and it weighs around 89.00 g.

Choose the option that suits your pet - Pink, Light coffee, Light Blue.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Built-in LED light, can clearly illuminate the bleeding line, prevent nail bleeding.
- Easy to useErgonomically designed non-slip handles are easy and comfortable to use.$c$;

-- pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea
UPDATE "products" SET
  "description" = $c$Features Material Made of premium PC and plastic, sturdy and durable to use.

Built to last: made from plastic, and it weighs around 88 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Adjustable Foldable Frame Eyeglasses frame is made of elastic band, adjustable and foldable, easy to wear and storage, for your pet's comfy wearing.
- Soft pad on the goggles rim back, mild touch on your pet's hair and skin.
- UV Proof,Wind Proof & Dust Proof Not only a decorative pet glasses but also filter out harmful UV rays, protect your pet's eyes from hurtful sunlight, wind, dust and dirt.
- Fit for Small and Medium Pets Kindly know that this pet glasses is fit for small size pets like puppies or kittens, please check the size for your cutie pet before purchase.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea$c$
    AND "description" IS DISTINCT FROM $c$Features Material Made of premium PC and plastic, sturdy and durable to use.

Built to last: made from plastic, and it weighs around 88 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Adjustable Foldable Frame Eyeglasses frame is made of elastic band, adjustable and foldable, easy to wear and storage, for your pet's comfy wearing.
- Soft pad on the goggles rim back, mild touch on your pet's hair and skin.
- UV Proof,Wind Proof & Dust Proof Not only a decorative pet glasses but also filter out harmful UV rays, protect your pet's eyes from hurtful sunlight, wind, dust and dirt.
- Fit for Small and Medium Pets Kindly know that this pet glasses is fit for small size pets like puppies or kittens, please check the size for your cutie pet before purchase.$c$;

-- pet-shoes-wear-dog-shoes
UPDATE "products" SET
  "description" = $c$Waterproof PVC sole helps keep your feet dry, so dogs can wear them on light snow or muddy and wet streets.

Built to last: made from cloth, and it weighs around 89.00 g.

Choose the option that suits your pet - Black No1, Black No7, Black No8, black 4, black 5, black 2, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The non-slip sturdy sole provides a protective layer to withstand hot and cold surfaces such as ice and snow.
- Adjustable fuzzy belt, easy to put on and take off.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-shoes-wear-dog-shoes$c$
    AND "description" IS DISTINCT FROM $c$Waterproof PVC sole helps keep your feet dry, so dogs can wear them on light snow or muddy and wet streets.

Built to last: made from cloth, and it weighs around 89.00 g.

Choose the option that suits your pet - Black No1, Black No7, Black No8, black 4, black 5, black 2, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The non-slip sturdy sole provides a protective layer to withstand hot and cold surfaces such as ice and snow.
- Adjustable fuzzy belt, easy to put on and take off.$c$;

-- pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove
UPDATE "products" SET
  "description" = $c$Pet Towel Dog Bathrobe Water Absorbent And Quick Drying Cleaning Beauty Glove Style Pocket Dog Bath Towel Accessori Cani is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 240 g.

Choose the option that suits your pet - BLUE-M 100x50cm, BLUE-L 130x70cm, GREEN-M 100x50cm, GREEN-L 130x70cm, Brown-M 100x50cm, Brown-L 130x70cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove$c$
    AND "description" IS DISTINCT FROM $c$Pet Towel Dog Bathrobe Water Absorbent And Quick Drying Cleaning Beauty Glove Style Pocket Dog Bath Towel Accessori Cani is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 240 g.

Choose the option that suits your pet - BLUE-M 100x50cm, BLUE-L 130x70cm, GREEN-M 100x50cm, GREEN-L 130x70cm, Brown-M 100x50cm, Brown-L 130x70cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable
UPDATE "products" SET
  "description" = $c$Features*: * Spacious & Comfort - Roomy 8-Panel design with protected seams and reinforced corners.

Built to last: made from cloth, and it weighs around 1014 g.

Choose the option that suits your pet - Blue, Pink.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Petluv dog playpen keeps your pet stay in this pet tent secure,spacious interior take more fun for your pet.
- Premium Quality - Waterproof Oxford cloth is selected as the material,which is conducive to cleaning;All 9 surfaces are covered with mesh gauze,which effectively blocks direct sunlight and is comfortable and breathable.
- Portable & Lightweight - It takes just seconds to Open from Folded.
- It is great for indoors,outdoors,traveling,camping,and more!Ideal for travel purpose.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable$c$
    AND "description" IS DISTINCT FROM $c$Features*: * Spacious & Comfort - Roomy 8-Panel design with protected seams and reinforced corners.

Built to last: made from cloth, and it weighs around 1014 g.

Choose the option that suits your pet - Blue, Pink.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Petluv dog playpen keeps your pet stay in this pet tent secure,spacious interior take more fun for your pet.
- Premium Quality - Waterproof Oxford cloth is selected as the material,which is conducive to cleaning;All 9 surfaces are covered with mesh gauze,which effectively blocks direct sunlight and is comfortable and breathable.
- Portable & Lightweight - It takes just seconds to Open from Folded.
- It is great for indoors,outdoors,traveling,camping,and more!Ideal for travel purpose.$c$;

-- plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca
UPDATE "products" SET
  "description" = $c$Thickened PP material, safe and durable.

Lightweight and easy to handle at around 5996 g.

Choose the option that suits your pet - Black 4p, White 4p, Black 6p, White 6p, Black 8p, White 8p.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Select high-quality thickened PP plastic and combine with reinforced steel hardware.
- It is sturdy and durable, avoiding problems such as rusting, peeling paint, and sharp scratches on metal fences.
- The edges of the panel are rounded without burrs, and it is resistant to scratching and biting.
- Modular connection, suitable for multiple scenarios.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca$c$
    AND "description" IS DISTINCT FROM $c$Thickened PP material, safe and durable.

Lightweight and easy to handle at around 5996 g.

Choose the option that suits your pet - Black 4p, White 4p, Black 6p, White 6p, Black 8p, White 8p.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Select high-quality thickened PP plastic and combine with reinforced steel hardware.
- It is sturdy and durable, avoiding problems such as rusting, peeling paint, and sharp scratches on metal fences.
- The edges of the panel are rounded without burrs, and it is resistant to scratching and biting.
- Modular connection, suitable for multiple scenarios.$c$;

-- portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo
UPDATE "products" SET
  "description" = $c$Dog Water Bottle & Treat Container: Compare with the common dog water bottle, there is a 100g food container closely attach to the bowl of water bottle.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- ALWAYS REMEMBER to turn the lock to right after use.
- All operations can be finished by one hand, easy to use Safe and Heat Resistant Material & Widely Uses: The dog water bottle is made of food grade ABS+PC, BPA free material.
- 250℉/121℃ affordable and dishwasher safe.
- It's suitable for walking, travelling, picnic, camping, hiking, training with your pets.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo$c$
    AND "description" IS DISTINCT FROM $c$Dog Water Bottle & Treat Container: Compare with the common dog water bottle, there is a 100g food container closely attach to the bowl of water bottle.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- ALWAYS REMEMBER to turn the lock to right after use.
- All operations can be finished by one hand, easy to use Safe and Heat Resistant Material & Widely Uses: The dog water bottle is made of food grade ABS+PC, BPA free material.
- 250℉/121℃ affordable and dishwasher safe.
- It's suitable for walking, travelling, picnic, camping, hiking, training with your pets.$c$;

-- post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac
UPDATE "products" SET
  "description" = $c$Leash not included), Black (HT5 model.

Lightweight and easy to handle at around 453.00 g.

Choose the option that suits your pet - Black L, Black M, Black XL, Black With 1.5m Leash L, Black With 1.5m Leash M, Black With 1.5m Leash XL.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Asian sizes are 1 to 2 sizes smaller than European and American people.
- Choose the larger size if your size between two sizes.
- Please allow 2-3cm differences due to manual measurement.
- Please check the size chart carefully before you buy the item, if you don't know how to choose size, please contact our customer service.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac$c$
    AND "description" IS DISTINCT FROM $c$Leash not included), Black (HT5 model.

Lightweight and easy to handle at around 453.00 g.

Choose the option that suits your pet - Black L, Black M, Black XL, Black With 1.5m Leash L, Black With 1.5m Leash M, Black With 1.5m Leash XL.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Asian sizes are 1 to 2 sizes smaller than European and American people.
- Choose the larger size if your size between two sizes.
- Please allow 2-3cm differences due to manual measurement.
- Please check the size chart carefully before you buy the item, if you don't know how to choose size, please contact our customer service.$c$;

-- puppy-soldier-hat-and-clothing-set
UPDATE "products" SET
  "description" = $c$Puppy Soldier Hat And Clothing Set is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 180.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$puppy-soldier-hat-and-clothing-set$c$
    AND "description" IS DISTINCT FROM $c$Puppy Soldier Hat And Clothing Set is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 180.00 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- quick-drying-pet-absorbent-towel
UPDATE "products" SET
  "description" = $c$This bathrobe can cover your pet's whole body, if your pets take a shower or get wet in the rain, help them wear this bathrobe to dry the moisture quickly from their hair.

Built to last: made from cloth, and it weighs around 100.00 g.

Choose the option that suits your pet - Blue XS, Blue S, Blue M, Pink XS, Pink S, Pink M, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- This bathrobe also can be used as a warm coat in winter, if you choose the right size for your pets (how to choose please see size chart), they will walk or run freely, just like wearing a coat.
- If you worry your pets catch a cold in the winter night, this bathrobe also can be used as a pajama.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$quick-drying-pet-absorbent-towel$c$
    AND "description" IS DISTINCT FROM $c$This bathrobe can cover your pet's whole body, if your pets take a shower or get wet in the rain, help them wear this bathrobe to dry the moisture quickly from their hair.

Built to last: made from cloth, and it weighs around 100.00 g.

Choose the option that suits your pet - Blue XS, Blue S, Blue M, Pink XS, Pink S, Pink M, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- This bathrobe also can be used as a warm coat in winter, if you choose the right size for your pets (how to choose please see size chart), they will walk or run freely, just like wearing a coat.
- If you worry your pets catch a cold in the winter night, this bathrobe also can be used as a pajama.$c$;

-- reflective-airtag-collar-holder
UPDATE "products" SET
  "description" = $c$Gifts: advertising gifts, promotional gifts, welfare gifts, public relations gifts.

Built to last: made from cloth, and it weighs around 12.00 g.

Choose the option that suits your pet - Red, Yellow, Purple, Black, Pink, Orange, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Suitable season: Four Seasons Universal.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$reflective-airtag-collar-holder$c$
    AND "description" IS DISTINCT FROM $c$Gifts: advertising gifts, promotional gifts, welfare gifts, public relations gifts.

Built to last: made from cloth, and it weighs around 12.00 g.

Choose the option that suits your pet - Red, Yellow, Purple, Black, Pink, Orange, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Suitable season: Four Seasons Universal.$c$;

-- retractable-dog-leash-with-collar
UPDATE "products" SET
  "description" = $c$Give your dog good reach and freedom of movement.

Built to last: made from plastic, and it weighs around 282.00 g.

Choose the option that suits your pet - Purple 3M Retractable lead, Purple 3M Lead and collar, Orange 3M Retractable lead, Orange 3M Lead and collar, Green 3M Retractable lead, Green 3M Lead and collar, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- This belt is suitable for Small medium / large Pets.
- One-handed braking and locking system keeps pets from moving forward.
- Telescopic design, the belt can automatically stretch and pull out.
- The large handles are easy to grip.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$retractable-dog-leash-with-collar$c$
    AND "description" IS DISTINCT FROM $c$Give your dog good reach and freedom of movement.

Built to last: made from plastic, and it weighs around 282.00 g.

Choose the option that suits your pet - Purple 3M Retractable lead, Purple 3M Lead and collar, Orange 3M Retractable lead, Orange 3M Lead and collar, Green 3M Retractable lead, Green 3M Lead and collar, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- This belt is suitable for Small medium / large Pets.
- One-handed braking and locking system keeps pets from moving forward.
- Telescopic design, the belt can automatically stretch and pull out.
- The large handles are easy to grip.$c$;

-- reusable-pet-hair-remover-brush
UPDATE "products" SET
  "description" = $c$2-1 Reusable Pet Hair Remover Brush Lint Roller Portable Effective Self Cleaning Tool for Cat Dog Fur Hair Dust Removal Brush is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 104.00 g.

Choose the option that suits your pet - White, Green, Pink, Blue.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$reusable-pet-hair-remover-brush$c$
    AND "description" IS DISTINCT FROM $c$2-1 Reusable Pet Hair Remover Brush Lint Roller Portable Effective Self Cleaning Tool for Cat Dog Fur Hair Dust Removal Brush is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 104.00 g.

Choose the option that suits your pet - White, Green, Pink, Blue.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- round-long-hairy-autumn-and-winter-nest-pad-cat-mattress
UPDATE "products" SET
  "description" = $c$The bed can be machine-washed or hand-washed for easy care.

Built to last: made from cloth, and it weighs around 439.00 g.

Choose the option that suits your pet - Pink 110cm, Green 60cm, A green 60cm, Red 120cm, Light coffee 50cm, Apricot 60cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- In addition, in order to keep the plush soft, smooth and fluffy, you can often dry it on sunny days.
- The anti-slip bottom is designed with glue spots, which is anti-slip and durable.
- Made of super soft and super warm plush, it really brings soft care to your pet.
- High-quality PP cotton allows your pet to have a good and deep sleep.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$round-long-hairy-autumn-and-winter-nest-pad-cat-mattress$c$
    AND "description" IS DISTINCT FROM $c$The bed can be machine-washed or hand-washed for easy care.

Built to last: made from cloth, and it weighs around 439.00 g.

Choose the option that suits your pet - Pink 110cm, Green 60cm, A green 60cm, Red 120cm, Light coffee 50cm, Apricot 60cm, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- In addition, in order to keep the plush soft, smooth and fluffy, you can often dry it on sunny days.
- The anti-slip bottom is designed with glue spots, which is anti-slip and durable.
- Made of super soft and super warm plush, it really brings soft care to your pet.
- High-quality PP cotton allows your pet to have a good and deep sleep.$c$;

-- silicone-pet-hair-remover-comb
UPDATE "products" SET
  "description" = $c$Soft Silicone Pets Hair Remover Comb Handheld Bath Shower Hair Shampoo Massage Brush For Dogs Cats Cleaning Tools Pet Products is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 78.00 g.

Choose the option that suits your pet - White, Light Blue, Green, Dark Blue.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$silicone-pet-hair-remover-comb$c$
    AND "description" IS DISTINCT FROM $c$Soft Silicone Pets Hair Remover Comb Handheld Bath Shower Hair Shampoo Massage Brush For Dogs Cats Cleaning Tools Pet Products is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 78.00 g.

Choose the option that suits your pet - White, Light Blue, Green, Dark Blue.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha
UPDATE "products" SET
  "description" = $c$Premium Breathable Cotton Material Made of soft, lightweight cotton fabric with excellent air permeability, this dog harness and leash set keeps your pet cool and dry during extended wear.

Built to last: made from cloth, and it weighs around 270 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The skin-friendly, gentle material ensures comfort for daily use, making our dog collars, harnesses & leashes not only durable but also ideal for long-time outdoor activities without skin irritation.
- Thoughtful Dual Sizes with Adjustable Fit Designed in S and M sizes to fit most small and medium breeds, both the dog harness and collar come with fully adjustable straps for a secure, personalized fit.
- 22.3 in, Leash 59.1 inYou can easily adjust the tightness for comfort without slipping or constriction.
- No-Pull, Comfortable & Safe Design Featuring a dog harness no pull and easy walk dog harness structure, the step-in design evenly distributes pulling force across the chest to avoid neck strain and choking.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha$c$
    AND "description" IS DISTINCT FROM $c$Premium Breathable Cotton Material Made of soft, lightweight cotton fabric with excellent air permeability, this dog harness and leash set keeps your pet cool and dry during extended wear.

Built to last: made from cloth, and it weighs around 270 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The skin-friendly, gentle material ensures comfort for daily use, making our dog collars, harnesses & leashes not only durable but also ideal for long-time outdoor activities without skin irritation.
- Thoughtful Dual Sizes with Adjustable Fit Designed in S and M sizes to fit most small and medium breeds, both the dog harness and collar come with fully adjustable straps for a secure, personalized fit.
- 22.3 in, Leash 59.1 inYou can easily adjust the tightness for comfort without slipping or constriction.
- No-Pull, Comfortable & Safe Design Featuring a dog harness no pull and easy walk dog harness structure, the step-in design evenly distributes pulling force across the chest to avoid neck strain and choking.$c$;

-- smart-anti-barking-dog-collar-rechargeable
UPDATE "products" SET
  "description" = $c$Smart Automatic Anti Barking Dog Collar Rechargeable Bark Stopper Stop Barking HD Digital Display IP67 Waterproof Collar For Dogs Pet Products is a practical, hard-wearing pick built for calmer, quieter training - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 131.00 g.

Choose the option that suits your pet - Black, White.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$smart-anti-barking-dog-collar-rechargeable$c$
    AND "description" IS DISTINCT FROM $c$Smart Automatic Anti Barking Dog Collar Rechargeable Bark Stopper Stop Barking HD Digital Display IP67 Waterproof Collar For Dogs Pet Products is a practical, hard-wearing pick built for calmer, quieter training - one your pet will reach for every day.

Built to last: made from plastic, and it weighs around 131.00 g.

Choose the option that suits your pet - Black, White.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered
UPDATE "products" SET
  "description" = $c$AI Identify 10,000+ Bird Species: VEVOR smart bird feeder with camera features an advanced AI recognition system (30-day free) that can identify 10,000+ bird species.

Lightweight and easy to handle at around 2400 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It automatically captures and identifies every visiting bird, while notifying you instantly via the phone app.
- Stable 2.4GHz Wi-Fi connectivity and convenient app control allow you to enjoy real-time birdwatching on your phone.
- Watch, Talk, and Enjoy: Enjoy 100+ bird videos every day with our lifetime free cloud (3 days) and cloud storage (30-day trial).
- Our smart bird house includes audible alarm and two-way audio, allowing you to scare away squirrels while talking with birds and hearing their sounds.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered$c$
    AND "description" IS DISTINCT FROM $c$AI Identify 10,000+ Bird Species: VEVOR smart bird feeder with camera features an advanced AI recognition system (30-day free) that can identify 10,000+ bird species.

Lightweight and easy to handle at around 2400 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- It automatically captures and identifies every visiting bird, while notifying you instantly via the phone app.
- Stable 2.4GHz Wi-Fi connectivity and convenient app control allow you to enjoy real-time birdwatching on your phone.
- Watch, Talk, and Enjoy: Enjoy 100+ bird videos every day with our lifetime free cloud (3 days) and cloud storage (30-day trial).
- Our smart bird house includes audible alarm and two-way audio, allowing you to scare away squirrels while talking with birds and hearing their sounds.$c$;

-- stainless-steel-automatic-circulating-water-fountain
UPDATE "products" SET
  "description" = $c$Pet Cat Dog Stainless Steel Automatic Circulation Water Dispenser Intelligent Fountain Pets Accessories is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from metal, and it weighs around 75.00 g.

Choose the option that suits your pet - Basic pump 220V US, Basic pump US, Basic pump EU, Basic pump UK, Basic pump AU, Induction pump 220V US, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$stainless-steel-automatic-circulating-water-fountain$c$
    AND "description" IS DISTINCT FROM $c$Pet Cat Dog Stainless Steel Automatic Circulation Water Dispenser Intelligent Fountain Pets Accessories is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from metal, and it weighs around 75.00 g.

Choose the option that suits your pet - Basic pump 220V US, Basic pump US, Basic pump EU, Basic pump UK, Basic pump AU, Induction pump 220V US, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- summer-dog-cooling-vest
UPDATE "products" SET
  "description" = $c$Stay Cool: The layered construction is designed to keep your dog cool when the temperature rises.

Built to last: made from cloth, and it weighs around 130.00 g.

Choose the option that suits your pet - Orange S, Orange M, Orange L, Orange XL, Orange 2XL, Orange 3XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The outer layer reflects heat and facilitates evaporation while the middle layer absorbs and stores water for evaporation.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$summer-dog-cooling-vest$c$
    AND "description" IS DISTINCT FROM $c$Stay Cool: The layered construction is designed to keep your dog cool when the temperature rises.

Built to last: made from cloth, and it weighs around 130.00 g.

Choose the option that suits your pet - Orange S, Orange M, Orange L, Orange XL, Orange 2XL, Orange 3XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- The outer layer reflects heat and facilitates evaporation while the middle layer absorbs and stores water for evaporation.$c$;

-- trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani
UPDATE "products" SET
  "description" = $c$Boost Coat & Vitality: Enhances fur shine, restores youthful vitality, and improves dull coats common in senior dogs.

Lightweight and easy to handle at around 150 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Gentle Digestive Care: Optimizes gastrointestinal function and eases digestive strain of elderly pups.
- Strong Bone Support: Raises bone mineral density, effectively prevents osteoporosis in aging dogs.
- Anti-Stress Formula: Alleviates stress and relieves environmental stress reactions for sensitive senior canines.
- Easy Feeding: 80 chewable tablets total; feed 4.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani$c$
    AND "description" IS DISTINCT FROM $c$Boost Coat & Vitality: Enhances fur shine, restores youthful vitality, and improves dull coats common in senior dogs.

Lightweight and easy to handle at around 150 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Gentle Digestive Care: Optimizes gastrointestinal function and eases digestive strain of elderly pups.
- Strong Bone Support: Raises bone mineral density, effectively prevents osteoporosis in aging dogs.
- Anti-Stress Formula: Alleviates stress and relieves environmental stress reactions for sensitive senior canines.
- Easy Feeding: 80 chewable tablets total; feed 4.$c$;

-- traveler-bubble-backpack-pet-carriers-for-cats-and-dogs
UPDATE "products" SET
  "description" = $c$Perfect for dogs up to 15-pounds, or cats up to 18-pounds.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Easily fits cats, small dogs, and most other small/medium-sized pets!
- Please make sure your pet sits within 14.5 inches overall height and 12 inches wide Breathable & Perspective: Three side was made of PVC mesh for the carriers.
- You can also rest assured that it is strong enough to stand up to the scratches or gnawing of your pets.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$traveler-bubble-backpack-pet-carriers-for-cats-and-dogs$c$
    AND "description" IS DISTINCT FROM $c$Perfect for dogs up to 15-pounds, or cats up to 18-pounds.

Lightweight and easy to handle at around 200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.

- Easily fits cats, small dogs, and most other small/medium-sized pets!
- Please make sure your pet sits within 14.5 inches overall height and 12 inches wide Breathable & Perspective: Three side was made of PVC mesh for the carriers.
- You can also rest assured that it is strong enough to stand up to the scratches or gnawing of your pets.$c$;

-- weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with
UPDATE "products" SET
  "description" = $c$Weaved Cat Bed, Elevated Hand-woven Braided Banana Leaf Kitten House Condo With Cushion, Beige is a practical, hard-wearing pick built for restful downtime - one your pet will reach for every day.

Lightweight and easy to handle at around 5200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with$c$
    AND "description" IS DISTINCT FROM $c$Weaved Cat Bed, Elevated Hand-woven Braided Banana Leaf Kitten House Condo With Cushion, Beige is a practical, hard-wearing pick built for restful downtime - one your pet will reach for every day.

Lightweight and easy to handle at around 5200 g.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;

-- winter-clothes-fleece-lined-warm-dog-cute-clothes
UPDATE "products" SET
  "description" = $c$Winter Clothes Fleece-lined Warm Dog Cute Clothes is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 400.00 g.

Choose the option that suits your pet - Brown XS, Brown S, Brown M, Brown L, Brown XL, Brown 2XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$winter-clothes-fleece-lined-warm-dog-cute-clothes$c$
    AND "description" IS DISTINCT FROM $c$Winter Clothes Fleece-lined Warm Dog Cute Clothes is a practical, hard-wearing pick built for everyday use - one your pet will reach for every day.

Built to last: made from cloth, and it weighs around 400.00 g.

Choose the option that suits your pet - Brown XS, Brown S, Brown M, Brown L, Brown XL, Brown 2XL, and more.

Ships fast and tracked from our US warehouse, with a 30-day returns window if it is not the right fit.$c$;
