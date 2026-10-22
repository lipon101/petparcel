-- Clean, customer-facing product copy and variant labels.
--
-- WHY THIS EXISTS.
--   1. Every description had a dropshipping disclosure paragraph appended -
--      "Ships from CJdropshipping's US warehouse. Supplied by CJdropshipping
--      under SKU CJxxxx; ...". The storefront must never name its supplier or
--      expose a supplier SKU. Removed.
--   2. Inline markup (**Feature**: detail) rendered as raw asterisks. Removed.
--   3. Variant labels were CJ's own variantNameEn - the full product title plus
--      the attribute, e.g. "Autumn And Winter Pet Clothes Small Dog Waterproof
--      Thickened Warm Khaki 2XL". Now a short "Colour - Size" option.
--
-- WHY A MIGRATION. The catalogue sync only ever INSERTs; it never rewrites an
-- existing row (an admin's edit must outrank the bundle), so a database seeded
-- before this revision keeps the old copy forever.
--
-- SOURCE OF TRUTH. THIS FILE IS GENERATED from shared/catalog-data.ts by
-- scripts/gen-copy-fix-migration.ts, so the two cannot disagree.
--
-- IDEMPOTENT. Every statement is guarded on the row actually differing, so a
-- re-run reports UPDATE 0 / DELETE 0.

-- intelligent-litter-box-automatic-self-cleaning-deodorant
UPDATE "products" SET
  "description" = $c$The last litter box you scoop by hand. It sifts and seals waste on its own, so the room stays clean and you get your time back.

- Self-cleaning cycle rakes clumps into a sealed waste drawer automatically.
- Fully enclosed, anti-splash body keeps litter and odour inside.
- Built-in deodorant system keeps the tray smelling fresh between changes.
- Suits cats of different sizes with a low entry step.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$intelligent-litter-box-automatic-self-cleaning-deodorant$c$
    AND "description" IS DISTINCT FROM $c$The last litter box you scoop by hand. It sifts and seals waste on its own, so the room stays clean and you get your time back.

- Self-cleaning cycle rakes clumps into a sealed waste drawer automatically.
- Fully enclosed, anti-splash body keeps litter and odour inside.
- Built-in deodorant system keeps the tray smelling fresh between changes.
- Suits cats of different sizes with a low entry step.$c$;

-- foldable-pet-tent-bed-with-cooling-mat
UPDATE "products" SET
  "description" = $c$A cosy hideaway your cat or small dog can call their own, wherever the day takes you.

This dome tent bed sets up in seconds. Two flexible poles slot through the fabric loops and it holds its shape, giving your pet a warm, enclosed nook that feels safe the way a cardboard box does, only softer. The padded cushion inside is double sided, flip it to the cool face on a warm afternoon and back to the cosy face when the evenings turn chilly, so one bed covers every season.

The whole thing is lightweight enough to carry one handed, which makes it as useful in a camper or a tent as it is beside the sofa. When it needs a refresh, the cushion and the outer fabric both go in the machine on a cold, delicate cycle, so keeping it fresh takes no effort at all.

Available in three sizes: Small for pets under 3 lb, Medium under 5 lb and Large under 10 lb. Shipped fast and tracked, with a 30-day returns window.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$foldable-pet-tent-bed-with-cooling-mat$c$
    AND "description" IS DISTINCT FROM $c$A cosy hideaway your cat or small dog can call their own, wherever the day takes you.

This dome tent bed sets up in seconds. Two flexible poles slot through the fabric loops and it holds its shape, giving your pet a warm, enclosed nook that feels safe the way a cardboard box does, only softer. The padded cushion inside is double sided, flip it to the cool face on a warm afternoon and back to the cosy face when the evenings turn chilly, so one bed covers every season.

The whole thing is lightweight enough to carry one handed, which makes it as useful in a camper or a tent as it is beside the sofa. When it needs a refresh, the cushion and the outer fabric both go in the machine on a cold, delicate cycle, so keeping it fresh takes no effort at all.

Available in three sizes: Small for pets under 3 lb, Medium under 5 lb and Large under 10 lb. Shipped fast and tracked, with a 30-day returns window.$c$;

-- pet-dog-carrier-bag-double-shoulder-travel-backpack
UPDATE "products" SET
  "description" = $c$Carry your dog the way you would carry a good camera bag. This double-shoulder carrier rides high and close against your chest, so both hands stay free for the lead, the coffee and the car keys, and your dog travels up where they can see and settle instead of being left behind.

The front and sides are built from breathable mesh, so air keeps moving on a warm walk, and the wide padded straps spread the weight across both shoulders rather than dragging on one. The zip top opens wide for easy loading, and the soft base gives small paws something level to stand on.

Four sizes run from S to XL, so there is a fit for a young puppy through to a medium dog, and six colours keep it looking smart long after the first muddy walk. It folds flat and weighs barely anything, which is why it lives in the car boot and comes out the moment you need it.

Shipped fast and tracked, with a 30-day returns window.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-dog-carrier-bag-double-shoulder-travel-backpack$c$
    AND "description" IS DISTINCT FROM $c$Carry your dog the way you would carry a good camera bag. This double-shoulder carrier rides high and close against your chest, so both hands stay free for the lead, the coffee and the car keys, and your dog travels up where they can see and settle instead of being left behind.

The front and sides are built from breathable mesh, so air keeps moving on a warm walk, and the wide padded straps spread the weight across both shoulders rather than dragging on one. The zip top opens wide for easy loading, and the soft base gives small paws something level to stand on.

Four sizes run from S to XL, so there is a fit for a young puppy through to a medium dog, and six colours keep it looking smart long after the first muddy walk. It folds flat and weighs barely anything, which is why it lives in the car boot and comes out the moment you need it.

Shipped fast and tracked, with a 30-day returns window.$c$;

-- smart-anti-barking-dog-collar-rechargeable
UPDATE "products" SET
  "description" = $c$A rechargeable collar that detects the vibration of your dog's bark and answers it with a warning tone and vibration, so you can calm excessive barking without a hand-held remote.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$smart-anti-barking-dog-collar-rechargeable$c$
    AND "description" IS DISTINCT FROM $c$A rechargeable collar that detects the vibration of your dog's bark and answers it with a warning tone and vibration, so you can calm excessive barking without a hand-held remote.$c$;

-- four-seasons-universal-cat-recliner-bed
UPDATE "products" SET
  "description" = $c$A deep, plush cat bed with a raised rim your cat can lean against and burrow into, sized for cats and small dogs.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$four-seasons-universal-cat-recliner-bed$c$
    AND "description" IS DISTINCT FROM $c$A deep, plush cat bed with a raised rim your cat can lean against and burrow into, sized for cats and small dogs.$c$;

-- stainless-steel-automatic-circulating-water-fountain
UPDATE "products" SET
  "description" = $c$A quiet electric fountain that keeps water moving so your pet drinks more through the day, with a stainless-steel drinking surface that rinses clean.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$stainless-steel-automatic-circulating-water-fountain$c$
    AND "description" IS DISTINCT FROM $c$A quiet electric fountain that keeps water moving so your pet drinks more through the day, with a stainless-steel drinking surface that rinses clean.$c$;

-- floating-pet-water-bowl-1-5l
UPDATE "products" SET
  "description" = $c$A 1.5 L water bowl with a floating disk that lets your pet drink from the surface while keeping their ears and muzzle dry and the water free of dust and hair.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$floating-pet-water-bowl-1-5l$c$
    AND "description" IS DISTINCT FROM $c$A 1.5 L water bowl with a floating disk that lets your pet drink from the surface while keeping their ears and muzzle dry and the water free of dust and hair.$c$;

-- reflective-airtag-collar-holder
UPDATE "products" SET
  "description" = $c$A reflective collar with a built-in holder for a tracker tag, so your dog stays visible on an evening walk and easy to find if they slip the lead.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$reflective-airtag-collar-holder$c$
    AND "description" IS DISTINCT FROM $c$A reflective collar with a built-in holder for a tracker tag, so your dog stays visible on an evening walk and easy to find if they slip the lead.$c$;

-- retractable-dog-leash-with-collar
UPDATE "products" SET
  "description" = $c$A retractable lead that gives your dog more room on an open path and pulls them back to heel at the press of a button.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$retractable-dog-leash-with-collar$c$
    AND "description" IS DISTINCT FROM $c$A retractable lead that gives your dog more room on an open path and pulls them back to heel at the press of a button.$c$;

-- summer-dog-cooling-vest
UPDATE "products" SET
  "description" = $c$A lightweight mesh vest that keeps air moving across your dog's back on hot walks, cut to sit comfortably over the chest and shoulders.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$summer-dog-cooling-vest$c$
    AND "description" IS DISTINCT FROM $c$A lightweight mesh vest that keeps air moving across your dog's back on hot walks, cut to sit comfortably over the chest and shoulders.$c$;

-- interactive-cat-toy-ball-super-drive
UPDATE "products" SET
  "description" = $c$A rolling ball that moves on its own to trigger your cat's chase instinct, giving them real exercise when you are not there to play.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$interactive-cat-toy-ball-super-drive$c$
    AND "description" IS DISTINCT FROM $c$A rolling ball that moves on its own to trigger your cat's chase instinct, giving them real exercise when you are not there to play.$c$;

-- cooling-pet-water-bed-cushion
UPDATE "products" SET
  "description" = $c$A water-filled mat that stays noticeably cooler than the floor, giving your pet a cool spot to lie on through a warm afternoon.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cooling-pet-water-bed-cushion$c$
    AND "description" IS DISTINCT FROM $c$A water-filled mat that stays noticeably cooler than the floor, giving your pet a cool spot to lie on through a warm afternoon.$c$;

-- electric-jumping-shrimp-cat-toy
UPDATE "products" SET
  "description" = $c$A small rechargeable toy that flips and jumps under its own power, giving a cat something unpredictable to pounce on.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$electric-jumping-shrimp-cat-toy$c$
    AND "description" IS DISTINCT FROM $c$A small rechargeable toy that flips and jumps under its own power, giving a cat something unpredictable to pounce on.$c$;

-- foldable-dog-house-cat-bed
UPDATE "products" SET
  "description" = $c$A soft-sided indoor house that folds flat when you need the space back, with a cushion inside for a cat or small dog to curl up in.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$foldable-dog-house-cat-bed$c$
    AND "description" IS DISTINCT FROM $c$A soft-sided indoor house that folds flat when you need the space back, with a cushion inside for a cat or small dog to curl up in.$c$;

-- pet-cooling-pad-bed
UPDATE "products" SET
  "description" = $c$A pressure-activated cooling mat that draws heat away from your pet as soon as they lie down, with no water, power or refrigeration needed.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-cooling-pad-bed$c$
    AND "description" IS DISTINCT FROM $c$A pressure-activated cooling mat that draws heat away from your pet as soon as they lie down, with no water, power or refrigeration needed.$c$;

-- cute-fruit-dog-hoodie-clothes
UPDATE "products" SET
  "description" = $c$A soft hooded sweatshirt for small dogs, with a fruit print and a cut that covers the back while leaving room to walk and toilet comfortably.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cute-fruit-dog-hoodie-clothes$c$
    AND "description" IS DISTINCT FROM $c$A soft hooded sweatshirt for small dogs, with a fruit print and a cut that covers the back while leaving room to walk and toilet comfortably.$c$;

-- parrot-bird-cage-with-feeder
UPDATE "products" SET
  "description" = $c$A bird cage supplied with a feeder and perches, giving a small parrot or similar bird a complete place to live, feed and climb.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$parrot-bird-cage-with-feeder$c$
    AND "description" IS DISTINCT FROM $c$A bird cage supplied with a feeder and perches, giving a small parrot or similar bird a complete place to live, feed and climb.$c$;

-- climbing-playing-bird-cage-accessory
UPDATE "products" SET
  "description" = $c$A climbing and play set that fixes inside a bird cage to add perches, ladders and toys, so a caged bird has something to climb and work at.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$climbing-playing-bird-cage-accessory$c$
    AND "description" IS DISTINCT FROM $c$A climbing and play set that fixes inside a bird cage to add perches, ladders and toys, so a caged bird has something to climb and work at.$c$;

-- reusable-pet-hair-remover-brush
UPDATE "products" SET
  "description" = $c$A reusable double-sided brush that lifts shed hair and lint off furniture, bedding and clothing, and empties in one pass instead of needing to be picked clean.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$reusable-pet-hair-remover-brush$c$
    AND "description" IS DISTINCT FROM $c$A reusable double-sided brush that lifts shed hair and lint off furniture, bedding and clothing, and empties in one pass instead of needing to be picked clean.$c$;

-- quick-drying-pet-absorbent-towel
UPDATE "products" SET
  "description" = $c$A fast-drying microfibre towel that soaks up far more water than a cotton towel of the same size, so you can dry a wet dog quickly after a bath or a walk.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$quick-drying-pet-absorbent-towel$c$
    AND "description" IS DISTINCT FROM $c$A fast-drying microfibre towel that soaks up far more water than a cotton towel of the same size, so you can dry a wet dog quickly after a bath or a walk.$c$;

-- pet-nail-clippers
UPDATE "products" SET
  "description" = $c$A stainless-steel clipper shaped for a clean, controlled cut through a pet's nail, with a safety guard that keeps you from taking too much off at once.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-nail-clippers$c$
    AND "description" IS DISTINCT FROM $c$A stainless-steel clipper shaped for a clean, controlled cut through a pet's nail, with a safety guard that keeps you from taking too much off at once.$c$;

-- silicone-pet-hair-remover-comb
UPDATE "products" SET
  "description" = $c$A soft silicone comb that gathers loose hair, dander and dust in one pass, and rinses clean under the tap.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$silicone-pet-hair-remover-comb$c$
    AND "description" IS DISTINCT FROM $c$A soft silicone comb that gathers loose hair, dander and dust in one pass, and rinses clean under the tap.$c$;

-- automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small
UPDATE "products" SET
  "description" = $c$A bark-control collar with adjustable levels and a rechargeable battery, to calm a dog that barks at everything.

- Adjustable correction levels suit a range of dogs and temperaments.
- Rechargeable battery, so no regular battery changes.
- Adjustable strap to suit large, medium and small necks.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$automatic-anti-bark-barking-dog-shock-control-collar-device-large-medium-small$c$
    AND "description" IS DISTINCT FROM $c$A bark-control collar with adjustable levels and a rechargeable battery, to calm a dog that barks at everything.

- Adjustable correction levels suit a range of dogs and temperaments.
- Rechargeable battery, so no regular battery changes.
- Adjustable strap to suit large, medium and small necks.$c$;

-- 2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to
UPDATE "products" SET
  "description" = $c$A pair of door bells that teaches a puppy to ring to go out, instead of barking or scratching at the door.

- Hangs from the door handle at a height your dog can reach with a nose or paw.
- Two bells, so one can live on the front door and one on the back.
- A simple prompt for house-training, feed times and toilet breaks.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2-pack-dog-door-bells-dog-doorbell-to-go-outside-puppy-train-bell-for-dogs-to$c$
    AND "description" IS DISTINCT FROM $c$A pair of door bells that teaches a puppy to ring to go out, instead of barking or scratching at the door.

- Hangs from the door handle at a height your dog can reach with a nose or paw.
- Two bells, so one can live on the front door and one on the back.
- A simple prompt for house-training, feed times and toilet breaks.$c$;

-- dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo
UPDATE "products" SET
  "description" = $c$A clicker with a wrist strap and keyring, so you can mark a behaviour at the exact moment it happens.

- Press to mark the behaviour, then reward - the standard way to speed up training.
- Spring wrist strap keeps it on your hand and a keyring keeps it on your keys.
- Suitable for dogs, cats and other training work.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-training-clicker-with-sring-wrist-and-keyring-pet-dog-training-clickers-fo$c$
    AND "description" IS DISTINCT FROM $c$A clicker with a wrist strap and keyring, so you can mark a behaviour at the exact moment it happens.

- Press to mark the behaviour, then reward - the standard way to speed up training.
- Spring wrist strap keeps it on your hand and a keyring keeps it on your keys.
- Suitable for dogs, cats and other training work.$c$;

-- lavender-scented-disposable-pet-training-pads
UPDATE "products" SET
  "description" = $c$Quick-absorbing training pads with a natural lavender scent that lock in liquid and neutralise odours.

- Leak-proof back film protects floors, carpets and crates.
- Suited to puppy housebreaking, litter training, travel, crates and nursing a sick pet.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$lavender-scented-disposable-pet-training-pads$c$
    AND "description" IS DISTINCT FROM $c$Quick-absorbing training pads with a natural lavender scent that lock in liquid and neutralise odours.

- Leak-proof back film protects floors, carpets and crates.
- Suited to puppy housebreaking, litter training, travel, crates and nursing a sick pet.$c$;

-- trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani
UPDATE "products" SET
  "description" = $c$A chewable multimineral supplement for older dogs, built around the nutrients aging joints and coats need.

- Trace minerals and meat extracts to top up what an older dog's diet can miss.
- Supports coat condition and general vitality.
- 80 chewable tablets, with a daily feeding guide on the pack.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$trace-element-tablets-for-senior-dogs-multimineral-supplement-for-elderly-cani$c$
    AND "description" IS DISTINCT FROM $c$A chewable multimineral supplement for older dogs, built around the nutrients aging joints and coats need.

- Trace minerals and meat extracts to top up what an older dog's diet can miss.
- Supports coat condition and general vitality.
- 80 chewable tablets, with a daily feeding guide on the pack.$c$;

-- traveler-bubble-backpack-pet-carriers-for-cats-and-dogs
UPDATE "products" SET
  "description" = $c$A bubble-window backpack carrier that lets a small pet watch the world while staying securely on your back.

- 12.6 by 11.4 by 16.5 inch interior suits cats and dogs up to about 15 lb.
- Clear bubble window gives your pet a view and lets you check on them.
- Padded shoulder straps and ventilation panels keep the carry comfortable.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$traveler-bubble-backpack-pet-carriers-for-cats-and-dogs$c$
    AND "description" IS DISTINCT FROM $c$A bubble-window backpack carrier that lets a small pet watch the world while staying securely on your back.

- 12.6 by 11.4 by 16.5 inch interior suits cats and dogs up to about 15 lb.
- Clear bubble window gives your pet a view and lets you check on them.
- Padded shoulder straps and ventilation panels keep the carry comfortable.$c$;

-- 2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness
UPDATE "products" SET
  "description" = $c$A two-piece seat-belt leash that keeps a dog or cat settled in the car instead of climbing into the front.

- Twin pack so both back seats can be secured.
- Adjustable length to suit the seat and the size of your pet.
- Clips to a harness and into the seat-belt socket.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2pcs-pet-dog-seat-belt-leash-adjustable-pet-dog-cat-safety-leads-harness$c$
    AND "description" IS DISTINCT FROM $c$A two-piece seat-belt leash that keeps a dog or cat settled in the car instead of climbing into the front.

- Twin pack so both back seats can be secured.
- Adjustable length to suit the seat and the size of your pet.
- Clips to a harness and into the seat-belt socket.$c$;

-- car-pet-mat-pet-seat-center-protective-net
UPDATE "products" SET
  "description" = $c$A centre-seat barrier that keeps a pet in the back and off the front seats.

- Oxford cloth panel with a mesh window so air still moves through the cabin.
- Fits between the front seats and secures without tools.
- Protects the centre console and the seat backs from claws and dirt.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$car-pet-mat-pet-seat-center-protective-net$c$
    AND "description" IS DISTINCT FROM $c$A centre-seat barrier that keeps a pet in the back and off the front seats.

- Oxford cloth panel with a mesh window so air still moves through the cabin.
- Fits between the front seats and secures without tools.
- Protects the centre console and the seat backs from claws and dirt.$c$;

-- plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca
UPDATE "products" SET
  "description" = $c$A modular plastic dog enclosure that gives a small or medium dog its own safe space, indoors or in the yard.

- Interlocking panels let you build the shape and size that suits the room.
- Thickened PP plastic with reinforced steel hardware resists rust, peeling and scratching.
- Rounded, burr-free panel edges are safe for a dog that leans or chews.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$plastic-dog-with-movable-enclosure-suitable-for-small-and-medium-sized-dogs-ca$c$
    AND "description" IS DISTINCT FROM $c$A modular plastic dog enclosure that gives a small or medium dog its own safe space, indoors or in the yard.

- Interlocking panels let you build the shape and size that suits the room.
- Thickened PP plastic with reinforced steel hardware resists rust, peeling and scratching.
- Rounded, burr-free panel edges are safe for a dog that leans or chews.$c$;

-- mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel
UPDATE "products" SET
  "description" = $c$A mushroom-shaped cat bed with a sisal scratch panel, so it is somewhere to sleep and somewhere to scratch.

- Wide bed gives a cat room to curl up properly.
- Sisal scratch panel takes the clawing instead of the sofa.
- Engineered wood and fabric build that suits the living room.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$mushroom-cat-bed-cat-claw-scratcher-with-wide-bed-and-sisal-scratch-panel$c$
    AND "description" IS DISTINCT FROM $c$A mushroom-shaped cat bed with a sisal scratch panel, so it is somewhere to sleep and somewhere to scratch.

- Wide bed gives a cat room to curl up properly.
- Sisal scratch panel takes the clawing instead of the sofa.
- Engineered wood and fabric build that suits the living room.$c$;

-- 2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard
UPDATE "products" SET
  "description" = $c$A wooden chair that doubles as a cat bed and a corrugated scratching pad, so it earns its space in the room.

- Rocking base gives a gentle motion cats settle into for a nap.
- Replaceable corrugated cardboard panel takes the scratching instead of your sofa.
- Sturdy wooden frame looks like furniture rather than a pet accessory.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2-in-1-cat-rocking-scratcher-chair-wooden-cat-bed-lounge-corrugated-cardboard$c$
    AND "description" IS DISTINCT FROM $c$A wooden chair that doubles as a cat bed and a corrugated scratching pad, so it earns its space in the room.

- Rocking base gives a gentle motion cats settle into for a nap.
- Replaceable corrugated cardboard panel takes the scratching instead of your sofa.
- Sturdy wooden frame looks like furniture rather than a pet accessory.$c$;

-- nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover
UPDATE "products" SET
  "description" = $c$A stretch sofa cover that shields the couch from fur, claws and muddy paws.

- Elastic fit wraps most sofa shapes without slipping into a puddle.
- Solid-colour fabric that suits the room rather than shouting about it.
- Machine washable, so it is easy to refresh after a shedding season.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$nordic-imperial-concubine-sofa-cover-four-seasons-universal-elastic-sofa-cover$c$
    AND "description" IS DISTINCT FROM $c$A stretch sofa cover that shields the couch from fur, claws and muddy paws.

- Elastic fit wraps most sofa shapes without slipping into a puddle.
- Solid-colour fabric that suits the room rather than shouting about it.
- Machine washable, so it is easy to refresh after a shedding season.$c$;

-- multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area
UPDATE "products" SET
  "description" = $c$A 54 in climbing frame with lounging platforms and a detachable toy, giving an indoor cat vertical space to explore.

- Multiple levels and perches let several cats share the tree without crowding.
- Detachable toy keeps a playful cat busy on the frame rather than on your curtains.
- Tall, stable build suits a corner of the living room.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$multi-functional-cat-tree-house-cat-climbing-frame-lounge-and-recreation-area$c$
    AND "description" IS DISTINCT FROM $c$A 54 in climbing frame with lounging platforms and a detachable toy, giving an indoor cat vertical space to explore.

- Multiple levels and perches let several cats share the tree without crowding.
- Detachable toy keeps a playful cat busy on the frame rather than on your curtains.
- Tall, stable build suits a corner of the living room.$c$;

-- heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum
UPDATE "products" SET
  "description" = $c$A four-storey solid-wood cat tree with no drilling, so a rental or a rented wall is never damaged.

- Multi-column support rated to hold 50 lb per level, with a thickened base to resist tipping.
- Freestanding structure needs no wall fixings.
- Neutral wood finish that sits with the room's furniture.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$heavy-duty-no-drill-4-story-cat-tree-solid-wood-multi-story-boards-multi-colum$c$
    AND "description" IS DISTINCT FROM $c$A four-storey solid-wood cat tree with no drilling, so a rental or a rented wall is never damaged.

- Multi-column support rated to hold 50 lb per level, with a thickened base to resist tipping.
- Freestanding structure needs no wall fixings.
- Neutral wood finish that sits with the room's furniture.$c$;

-- 2-tier-cat-condo-with-hammock
UPDATE "products" SET
  "description" = $c$A two-tier felt cat house that converts from a semi-enclosed condo into an open hammock.

- Convertible design suits a cat that wants a snug den some days and an open bed on others.
- Solid build with a hammock level above a covered retreat below.
- Felt finish that is soft, quiet and easy to keep clean.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2-tier-cat-condo-with-hammock$c$
    AND "description" IS DISTINCT FROM $c$A two-tier felt cat house that converts from a semi-enclosed condo into an open hammock.

- Convertible design suits a cat that wants a snug den some days and an open bed on others.
- Solid build with a hammock level above a covered retreat below.
- Felt finish that is soft, quiet and easy to keep clean.$c$;

-- dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform
UPDATE "products" SET
  "description" = $c$A gentle ramp that lets an older or small dog get onto the bed or sofa without jumping.

- Low slope leads to a flat top platform for a confident step on and off.
- Non-slip carpet surface gives paws grip in both directions.
- Folds away when it is not in use.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-ramp-for-bed-pet-ramp-for-dogs-with-non-slip-carpet-and-top-platform$c$
    AND "description" IS DISTINCT FROM $c$A gentle ramp that lets an older or small dog get onto the bed or sofa without jumping.

- Low slope leads to a flat top platform for a confident step on and off.
- Non-slip carpet surface gives paws grip in both directions.
- Folds away when it is not in use.$c$;

-- pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable
UPDATE "products" SET
  "description" = $c$A foldable eight-panel pet playpen that gives a small pet a safe, roomy space indoors or out.

- Eight panels with protected seams and reinforced corners, with a waterproof Oxford cloth cover supplied.
- Folds flat to carry and store between uses.
- Suits a puppy, kitten or small pet that needs containing without a crate.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pink-blue-options-1pc-portable-foldable-pet-tent-exercise-pen-kennel-removable$c$
    AND "description" IS DISTINCT FROM $c$A foldable eight-panel pet playpen that gives a small pet a safe, roomy space indoors or out.

- Eight panels with protected seams and reinforced corners, with a waterproof Oxford cloth cover supplied.
- Folds flat to carry and store between uses.
- Suits a puppy, kitten or small pet that needs containing without a crate.$c$;

-- weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with
UPDATE "products" SET
  "description" = $c$A hand-woven banana-leaf cat house on a raised stand, giving a cat a cosy nook that also looks good in the room.

- Hand-woven braided banana leaf with a soft cushion inside.
- Elevated so the cat can relax above the draught and watch the room.
- Beige finish that sits naturally among your furniture.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$weaved-cat-bed-elevated-hand-woven-braided-banana-leaf-kitten-house-condo-with$c$
    AND "description" IS DISTINCT FROM $c$A hand-woven banana-leaf cat house on a raised stand, giving a cat a cosy nook that also looks good in the room.

- Hand-woven braided banana leaf with a soft cushion inside.
- Elevated so the cat can relax above the draught and watch the room.
- Beige finish that sits naturally among your furniture.$c$;

-- ceramic-pet-hamster-bowl-brown
UPDATE "products" SET
  "description" = $c$A heavy stoneware bowl for a small pet's food or water, shaped so it cannot be tipped or chewed.

- Weighted base makes it tip-resistant even for a determined hamster or rabbit.
- Wide profile gives stability and keeps the dish in one place.
- Dishwasher safe, lead free and easy to keep sanitary.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$ceramic-pet-hamster-bowl-brown$c$
    AND "description" IS DISTINCT FROM $c$A heavy stoneware bowl for a small pet's food or water, shaped so it cannot be tipped or chewed.

- Weighted base makes it tip-resistant even for a determined hamster or rabbit.
- Wide profile gives stability and keeps the dish in one place.
- Dishwasher safe, lead free and easy to keep sanitary.$c$;

-- cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water
UPDATE "products" SET
  "description" = $c$A cordless 4.5 L water fountain with dual-tank filtration, so fresh water keeps moving without a cable across the floor.

- Dual-tank filtration keeps the water clean between refills.
- Cordless design means it can sit anywhere, not just beside an outlet.
- Comes apart for straightforward cleaning.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cordless-dog-cat-water-fountain-4-5l-dual-tank-filtration-automatic-pet-water$c$
    AND "description" IS DISTINCT FROM $c$A cordless 4.5 L water fountain with dual-tank filtration, so fresh water keeps moving without a cable across the floor.

- Dual-tank filtration keeps the water clean between refills.
- Cordless design means it can sit anywhere, not just beside an outlet.
- Comes apart for straightforward cleaning.$c$;

-- 3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water
UPDATE "products" SET
  "description" = $c$A three-in-one travel bottle that carries water, a food portion and a fine mist sprayer in one unit.

- Integrated dispenser, food container and sprayer cut down what you carry on a walk or a trip.
- Mist sprayer helps cool a dog on a warm day.
- One-handed design for use while you are holding the lead.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$3in1-dog-water-bottle-with-mist-sprayer-food-storage-portable-pet-travel-water$c$
    AND "description" IS DISTINCT FROM $c$A three-in-one travel bottle that carries water, a food portion and a fine mist sprayer in one unit.

- Integrated dispenser, food container and sprayer cut down what you carry on a walk or a trip.
- Mist sprayer helps cool a dog on a warm day.
- One-handed design for use while you are holding the lead.$c$;

-- portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo
UPDATE "products" SET
  "description" = $c$A travel bottle that carries both water and a portion of food, with a filter, for walks and long drives.

- Combined water bottle and treat container, so one bottle covers a whole outing.
- Built-in filter catches grit and crumbs from the drinking spout.
- One-handed drinking spout that returns unused water to the bottle.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$portable-dog-water-bottle-with-food-container-filter-travel-drinking-bottle-fo$c$
    AND "description" IS DISTINCT FROM $c$A travel bottle that carries both water and a portion of food, with a filter, for walks and long drives.

- Combined water bottle and treat container, so one bottle covers a whole outing.
- Built-in filter catches grit and crumbs from the drinking spout.
- One-handed drinking spout that returns unused water to the bottle.$c$;

-- fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu
UPDATE "products" SET
  "description" = $c$An ozone generator for aquariums and ponds that clears green and yellow water and cuts odours.

- Treats algae and cloudy water without a full teardown.
- Compact unit sits alongside the rest of your filtration.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$fish-tank-ozone-machine-fish-pond-ozone-generator-sterilization-device-for-aqu$c$
    AND "description" IS DISTINCT FROM $c$An ozone generator for aquariums and ponds that clears green and yellow water and cuts odours.

- Treats algae and cloudy water without a full teardown.
- Compact unit sits alongside the rest of your filtration.$c$;

-- canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel
UPDATE "products" SET
  "description" = $c$A 126.8 gallon above-ground koi tank in reinforced triple-layer PVC, with a clear panel for watching the fish.

- Scratch-resistant triple-layer PVC holds its shape season after season.
- Clear viewing panel lets you enjoy the fish without lifting the lid.
- Sets up above ground, so no digging is needed.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$canvas-fish-pond-above-ground-koi-tank-126-8-gal-with-clear-viewing-panel$c$
    AND "description" IS DISTINCT FROM $c$A 126.8 gallon above-ground koi tank in reinforced triple-layer PVC, with a clear panel for watching the fish.

- Scratch-resistant triple-layer PVC holds its shape season after season.
- Clear viewing panel lets you enjoy the fish without lifting the lid.
- Sets up above ground, so no digging is needed.$c$;

-- floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa
UPDATE "products" SET
  "description" = $c$A resin frog on a swim ring that floats on the water surface, adding a moving detail to the tank.

- Measures 5.3 by 4.2 by 2.1 inches and weighs 0.23 lb, so it fits smaller tanks without crowding the fish.
- Pet-safe resin that will not fade or leach into the water.
- Floats upright at the surface as a focal point.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$floating-frog-on-swim-ring-resin-aquarium-ornament-fish-tank-decor-water-surfa$c$
    AND "description" IS DISTINCT FROM $c$A resin frog on a swim ring that floats on the water surface, adding a moving detail to the tank.

- Measures 5.3 by 4.2 by 2.1 inches and weighs 0.23 lb, so it fits smaller tanks without crowding the fish.
- Pet-safe resin that will not fade or leach into the water.
- Floats upright at the surface as a focal point.$c$;

-- 1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r
UPDATE "products" SET
  "description" = $c$A three-stage external canister filter that keeps aquarium water clear with a 600 L/H flow rate.

- Layered biological and mechanical filtration from coarse sponge through to fine media.
- Handles up to a 35.4 inch head height for a taller tank setup.
- Quiet 6W pump that installs without disturbing the tank.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$1pc-3-stage-external-canister-filter-for-aquarium-fish-tank-with-600l-h-flow-r$c$
    AND "description" IS DISTINCT FROM $c$A three-stage external canister filter that keeps aquarium water clear with a 600 L/H flow rate.

- Layered biological and mechanical filtration from coarse sponge through to fine media.
- Handles up to a 35.4 inch head height for a taller tank setup.
- Quiet 6W pump that installs without disturbing the tank.$c$;

-- small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha
UPDATE "products" SET
  "description" = $c$A matching three-piece walking set for a small dog: a breathable cotton harness, an adjustable bowtie collar and a leash.

- No-pull harness spreads the lead's pressure across the chest rather than the throat.
- Soft, lightweight cotton with good airflow keeps your dog cool on a walk.
- A coordinated set that covers daily walks, parties and photos.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$small-dog-collar-harness-and-leash-set-dog-harness-no-pull-with-bowtie-breatha$c$
    AND "description" IS DISTINCT FROM $c$A matching three-piece walking set for a small dog: a breathable cotton harness, an adjustable bowtie collar and a leash.

- No-pull harness spreads the lead's pressure across the chest rather than the throat.
- Soft, lightweight cotton with good airflow keeps your dog cool on a walk.
- A coordinated set that covers daily walks, parties and photos.$c$;

-- pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des
UPDATE "products" SET
  "description" = $c$A paw-shaped leather keychain that holds a lock of your pet's fur as a keepsake.

- Small compartment keeps a few strands of fur safe.
- Paw-shaped pendant on a leather keyring.
- A quiet, lasting memorial for a grieving owner.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-fur-memory-charm-leather-keychain-keepsake-for-dog-cat-hair-paw-shaped-des$c$
    AND "description" IS DISTINCT FROM $c$A paw-shaped leather keychain that holds a lock of your pet's fur as a keepsake.

- Small compartment keeps a few strands of fur safe.
- Paw-shaped pendant on a leather keyring.
- A quiet, lasting memorial for a grieving owner.$c$;

-- 4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h
UPDATE "products" SET
  "description" = $c$A four-piece set of adjustable bow headbands that finishes a small dog's groom in seconds.

- Adjustable band fits small and medium dogs and puppies.
- Four bows let you match the band to the day, or keep a spare in the wash.
- A quick way to tidy the hair away from the eyes.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$4pcs-dog-hair-bow-headband-for-small-medium-dogs-adjustable-pet-dog-hair-bow-h$c$
    AND "description" IS DISTINCT FROM $c$A four-piece set of adjustable bow headbands that finishes a small dog's groom in seconds.

- Adjustable band fits small and medium dogs and puppies.
- Four bows let you match the band to the day, or keep a spare in the wash.
- A quick way to tidy the hair away from the eyes.$c$;

-- dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar
UPDATE "products" SET
  "description" = $c$A soft double-layer cotton collar with a small heart pendant, for an everyday look.

- Gentle cotton that is kind to the neck on daily walks.
- Small heart pendant adds a little detail without bulk.
- Adjustable buckle for a snug fit.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-collar-white-and-pink-love-heart-with-pendant-cute-dog-collar$c$
    AND "description" IS DISTINCT FROM $c$A soft double-layer cotton collar with a small heart pendant, for an everyday look.

- Gentle cotton that is kind to the neck on daily walks.
- Small heart pendant adds a little detail without bulk.
- Adjustable buckle for a snug fit.$c$;

-- dog-accessories-photo-concave-shape-pumpkin-hat
UPDATE "products" SET
  "description" = $c$A pumpkin-shaped hat for dressing a dog up for a photo or a party.

- Lightweight, so it sits on the head without weighing your dog down.
- Available in black, beige, red and brown.
- A quick, fun photo prop that stores flat.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-accessories-photo-concave-shape-pumpkin-hat$c$
    AND "description" IS DISTINCT FROM $c$A pumpkin-shaped hat for dressing a dog up for a photo or a party.

- Lightweight, so it sits on the head without weighing your dog down.
- Available in black, beige, red and brown.
- A quick, fun photo prop that stores flat.$c$;

-- pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea
UPDATE "products" SET
  "description" = $c$UV dog goggles that protect a small dog's eyes from sun, wind and grit on a ride or a beach day.

- UV lenses shield the eyes on bright days.
- Adjustable head strap sits securely over a range of head sizes.
- Available in black, pink and blue.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-protection-small-doggles-dog-sunglasses-pet-goggles-uv-sun-glasses-eye-wea$c$
    AND "description" IS DISTINCT FROM $c$UV dog goggles that protect a small dog's eyes from sun, wind and grit on a ride or a beach day.

- UV lenses shield the eyes on bright days.
- Adjustable head strap sits securely over a range of head sizes.
- Available in black, pink and blue.$c$;

-- 3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration
UPDATE "products" SET
  "description" = $c$A training collar with beep and vibration that discourages nuisance barking without a hand-held remote.

- Seven sensitivity levels to suit a calm or a stubborn dog.
- Reflective strap keeps your dog visible on evening walks.
- Adjustable fit with a soft contact area.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$3-in-1-anti-bark-dog-collar-dog-training-collar-with-vibration$c$
    AND "description" IS DISTINCT FROM $c$A training collar with beep and vibration that discourages nuisance barking without a hand-held remote.

- Seven sensitivity levels to suit a calm or a stubborn dog.
- Reflective strap keeps your dog visible on evening walks.
- Adjustable fit with a soft contact area.$c$;

-- ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely
UPDATE "products" SET
  "description" = $c$A ground stake and tether that lets a dog roam a lawn or campsite while staying safely anchored.

- Twists into the ground to hold firm on grass and soft ground.
- Gives a dog freedom to move without a fence.
- Suits the garden, a campsite or a day out.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$ground-stake-fixed-dog-leash-allows-your-beloved-dog-to-play-more-freely$c$
    AND "description" IS DISTINCT FROM $c$A ground stake and tether that lets a dog roam a lawn or campsite while staying safely anchored.

- Twists into the ground to hold firm on grass and soft ground.
- Gives a dog freedom to move without a fence.
- Suits the garden, a campsite or a day out.$c$;

-- american-local-tactical-pet-boobs-service-dog-harness-vest-adjustable-reflecti
UPDATE "products" SET
  "description" = $c$A tactical harness vest for a service or working dog, with adjustable straps and reflective trim.

- Padded, breathable body panel keeps a working dog comfortable over long shifts.
- Adjustable buckles fit a range of chest sizes and stay put in the field.
- Reflective detailing keeps you and your dog visible after dark.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$american-local-tactical-pet-boobs-service-dog-harness-vest-adjustable-reflecti$c$
    AND "description" IS DISTINCT FROM $c$A tactical harness vest for a service or working dog, with adjustable straps and reflective trim.

- Padded, breathable body panel keeps a working dog comfortable over long shifts.
- Adjustable buckles fit a range of chest sizes and stay put in the field.
- Reflective detailing keeps you and your dog visible after dark.$c$;

-- dog-mouth-cover-golden-retrievergerman-shepherd-dedicated
UPDATE "products" SET
  "description" = $c$A basket muzzle sized for a golden retriever or German shepherd, for safe handling at the vet or in company.

- Sized for larger breeds rather than a one-size compromise.
- Basket design lets your dog pant and drink while it is on.
- Adjustable straps hold it steady on the muzzle.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-mouth-cover-golden-retrievergerman-shepherd-dedicated$c$
    AND "description" IS DISTINCT FROM $c$A basket muzzle sized for a golden retriever or German shepherd, for safe handling at the vet or in company.

- Sized for larger breeds rather than a one-size compromise.
- Basket design lets your dog pant and drink while it is on.
- Adjustable straps hold it steady on the muzzle.$c$;

-- no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac
UPDATE "products" SET
  "description" = $c$A no-pull harness, collar and leash set that makes everyday walks easier to manage.

- No-pull front attachment turns a dog that pulls back toward you instead of into the lead.
- Adjustable straps fit a range of chest sizes.
- Travel accessories included for trips and outings.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$no-pull-dog-harness-collar-leash-set-adjustable-pet-walking-set-with-travel-ac$c$
    AND "description" IS DISTINCT FROM $c$A no-pull harness, collar and leash set that makes everyday walks easier to manage.

- No-pull front attachment turns a dog that pulls back toward you instead of into the lead.
- Adjustable straps fit a range of chest sizes.
- Travel accessories included for trips and outings.$c$;

-- dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar
UPDATE "products" SET
  "description" = $c$A PU collar engraved with your pet's name or your phone number, so a lost pet can be brought home.

- Custom engraving means the contact details never rub off or fall away.
- High-quality microfiber PU with zinc-alloy hardware that stands up to daily wear.
- Available in grey, brown, green and red.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-collar-engraved-with-lettering-to-prevent-loss-of-neck-collar$c$
    AND "description" IS DISTINCT FROM $c$A PU collar engraved with your pet's name or your phone number, so a lost pet can be brought home.

- Custom engraving means the contact details never rub off or fall away.
- High-quality microfiber PU with zinc-alloy hardware that stands up to daily wear.
- Available in grey, brown, green and red.$c$;

-- 650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99
UPDATE "products" SET
  "description" = $c$A red laser pointer that gives a cat a fast-moving target to chase.

- Single-beam red light that cats track easily.
- Fits the hand like a pen, powered by AAA batteries.
- Ten-piece pack, so spares live in different rooms.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$650nm-red-laser-pointer-pen-light-visible-single-beam-aaa-lazer-torch-10pcs-99$c$
    AND "description" IS DISTINCT FROM $c$A red laser pointer that gives a cat a fast-moving target to chase.

- Single-beam red light that cats track easily.
- Fits the hand like a pen, powered by AAA batteries.
- Ten-piece pack, so spares live in different rooms.$c$;

-- pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive
UPDATE "products" SET
  "description" = $c$A three-way collapsible cat tunnel with peek holes and a hanging ball, for indoor cats that need to play.

- Three connected tunnels with peek holes for ambush games.
- Hanging ball toy adds a moving target.
- Collapses flat when playtime is over.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-cat-tunnel-tube-toys-3-way-collapsible-tunnels-for-indoor-cats-interactive$c$
    AND "description" IS DISTINCT FROM $c$A three-way collapsible cat tunnel with peek holes and a hanging ball, for indoor cats that need to play.

- Three connected tunnels with peek holes for ambush games.
- Hanging ball toy adds a moving target.
- Collapses flat when playtime is over.$c$;

-- 5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats
UPDATE "products" SET
  "description" = $c$Five vegetable-shaped plush kickers your cat can bat, bite and wrestle, in one value pack.

- Includes a carrot, an eggplant, an okra, a chili and a corn, each with a friendly stitched face.
- Every toy is filled with natural catnip to spark play and ease boredom.
- Soft, durable plush with reinforced stitching for daily use.
- Five toys means one can be in the wash while the rest stay in rotation.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$5-pack-vegetable-catnip-plush-toys-cute-kicker-chew-toys-for-indoor-cats$c$
    AND "description" IS DISTINCT FROM $c$Five vegetable-shaped plush kickers your cat can bat, bite and wrestle, in one value pack.

- Includes a carrot, an eggplant, an okra, a chili and a corn, each with a friendly stitched face.
- Every toy is filled with natural catnip to spark play and ease boredom.
- Soft, durable plush with reinforced stitching for daily use.
- Five toys means one can be in the wash while the rest stay in rotation.$c$;

-- interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d
UPDATE "products" SET
  "description" = $c$A treat ball that rolls and releases kibble, keeping a dog busy and fed at the same time.

- Rolling action turns a meal into a game.
- Rewards play with a treat, which suits dogs that eat too fast.
- Sturdy enough for small and medium dogs to chew.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$interactive-dog-treat-ball-a-chewing-toy-suitable-for-small-and-medium-sized-d$c$
    AND "description" IS DISTINCT FROM $c$A treat ball that rolls and releases kibble, keeping a dog busy and fed at the same time.

- Rolling action turns a meal into a game.
- Rewards play with a treat, which suits dogs that eat too fast.
- Sturdy enough for small and medium dogs to chew.$c$;

-- dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy
UPDATE "products" SET
  "description" = $c$A dispenser toy that makes a dog work for its treats, turning boredom into a puzzle.

- Holds kibble or treats and releases them as the dog plays.
- Sound feedback keeps a dog engaged while you are out.
- Adjustable difficulty for beginners through to practised noses.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-toy-for-entertainment-and-self-amusement-sounding-pet-food-dispensing-toy$c$
    AND "description" IS DISTINCT FROM $c$A dispenser toy that makes a dog work for its treats, turning boredom into a puzzle.

- Holds kibble or treats and releases them as the dog plays.
- Sound feedback keeps a dog engaged while you are out.
- Adjustable difficulty for beginners through to practised noses.$c$;

-- all-in-one-no-installation-cat-scratcher-tunnel-toy
UPDATE "products" SET
  "description" = $c$A no-assembly tunnel and scratcher that gives a cat somewhere to hide, pounce and sharpen its claws.

- Sets up straight out of the box, with no tools.
- Scratch surface takes the clawing instead of the sofa.
- Tunnel shape suits ambush games and somewhere to settle.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$all-in-one-no-installation-cat-scratcher-tunnel-toy$c$
    AND "description" IS DISTINCT FROM $c$A no-assembly tunnel and scratcher that gives a cat somewhere to hide, pounce and sharpen its claws.

- Sets up straight out of the box, with no tools.
- Scratch surface takes the clawing instead of the sofa.
- Tunnel shape suits ambush games and somewhere to settle.$c$;

-- interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set
UPDATE "products" SET
  "description" = $c$An interactive cat toy supplied with two replacement parts, to keep play going for longer.

- Stimulates the hunting instinct and gives a cat real physical and mental exercise.
- Moving parts are securely attached so they cannot be swallowed.
- Two replacement parts in the box.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$interactive-cat-toy-1-toy-with-2-replacement-parts-party-accessory-set$c$
    AND "description" IS DISTINCT FROM $c$An interactive cat toy supplied with two replacement parts, to keep play going for longer.

- Stimulates the hunting instinct and gives a cat real physical and mental exercise.
- Moving parts are securely attached so they cannot be swallowed.
- Two replacement parts in the box.$c$;

-- christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew
UPDATE "products" SET
  "description" = $c$A plush Christmas dog toy with a squeaker and crinkle paper, for indoor play when the weather keeps you in.

- Squeaker and crinkle layers keep a dog interested.
- Soft plush that is gentle on teeth and jaws.
- Suits small and medium dogs.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$christmas-squeaky-dog-toys-plush-dog-toys-with-crinkle-paper-interactive-chew$c$
    AND "description" IS DISTINCT FROM $c$A plush Christmas dog toy with a squeaker and crinkle paper, for indoor play when the weather keeps you in.

- Squeaker and crinkle layers keep a dog interested.
- Soft plush that is gentle on teeth and jaws.
- Suits small and medium dogs.$c$;

-- cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack
UPDATE "products" SET
  "description" = $c$A double-layer litter mat that traps tracked grit and holds spills so the trail stops at the box.

- Honeycomb top layer catches granules from the paws as the cat steps out.
- Waterproof lower layer keeps urine off the floor.
- EZ-open edge empties back into the litter box in one movement.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cat-litter-mat-double-layer-waterproof-urine-proof-trapping-mat-1-pack$c$
    AND "description" IS DISTINCT FROM $c$A double-layer litter mat that traps tracked grit and holds spills so the trail stops at the box.

- Honeycomb top layer catches granules from the paws as the cat steps out.
- Waterproof lower layer keeps urine off the floor.
- EZ-open edge empties back into the litter box in one movement.$c$;

-- absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip
UPDATE "products" SET
  "description" = $c$A 20 by 12 inch feeding mat with a strong absorbent top and waterproof rubber backing to catch spills.

- Soaks up spilt water and milk and keeps the floor under the bowls dry.
- Non-slip rubber backing holds the mat in place while your pet eats.
- Dark grey finish that hides everyday marks.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$absorbent-pet-feeding-mat-20x12-inch-waterproof-rubber-backing-dark-gray-strip$c$
    AND "description" IS DISTINCT FROM $c$A 20 by 12 inch feeding mat with a strong absorbent top and waterproof rubber backing to catch spills.

- Soaks up spilt water and milk and keeps the floor under the bowls dry.
- Non-slip rubber backing holds the mat in place while your pet eats.
- Dark grey finish that hides everyday marks.$c$;

-- round-long-hairy-autumn-and-winter-nest-pad-cat-mattress
UPDATE "products" SET
  "description" = $c$A round, long-pile nest mattress that gives a cat a warm spot to curl into through winter.

- Deep plush surface holds warmth and feels soft underfoot.
- Machine or hand washable, so it stays fresh.
- Round shape that suits a cat that likes to curl.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$round-long-hairy-autumn-and-winter-nest-pad-cat-mattress$c$
    AND "description" IS DISTINCT FROM $c$A round, long-pile nest mattress that gives a cat a warm spot to curl into through winter.

- Deep plush surface holds warmth and feels soft underfoot.
- Machine or hand washable, so it stays fresh.
- Round shape that suits a cat that likes to curl.$c$;

-- elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p
UPDATE "products" SET
  "description" = $c$An elevated mesh bed that lifts your pet off the floor for airflow, indoors or out.

- Cools by letting air move under the sleeping surface.
- Raised off the ground, it stays dry and free of dust and damp.
- Sizes for small through XL pets, and it folds for travel.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$elevated-breathable-mesh-pet-bed-indoor-or-outdoor-use-sizes-for-small-to-xl-p$c$
    AND "description" IS DISTINCT FROM $c$An elevated mesh bed that lifts your pet off the floor for airflow, indoors or out.

- Cools by letting air move under the sleeping surface.
- Raised off the ground, it stays dry and free of dust and damp.
- Sizes for small through XL pets, and it folds for travel.$c$;

-- pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal
UPDATE "products" SET
  "description" = $c$A 300GSM coral-fleece blanket that gives a small dog or cat a soft, warm place to settle.

- Plush coral fleece that is light enough for year-round use.
- Lays over a couch, bed or car seat to catch fur, dander and muddy paws.
- Machine washable and holds its softness wash after wash.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-blanket-for-dogs-cats-300gsm-ultra-soft-coral-fleece-blanket-washable-smal$c$
    AND "description" IS DISTINCT FROM $c$A 300GSM coral-fleece blanket that gives a small dog or cat a soft, warm place to settle.

- Plush coral fleece that is light enough for year-round use.
- Lays over a couch, bed or car seat to catch fur, dander and muddy paws.
- Machine washable and holds its softness wash after wash.$c$;

-- pet-clothes-round-neck-t-shirt
UPDATE "products" SET
  "description" = $c$A soft round-neck pet T-shirt in a plain, everyday cut.

- Polyester knit keeps its shape and washes clean.
- Sizes S to XXL in red, blue, black and khaki.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-clothes-round-neck-t-shirt$c$
    AND "description" IS DISTINCT FROM $c$A soft round-neck pet T-shirt in a plain, everyday cut.

- Polyester knit keeps its shape and washes clean.
- Sizes S to XXL in red, blue, black and khaki.$c$;

-- dog-dresses-for-outdoor-walks-with-a-leash
UPDATE "products" SET
  "description" = $c$A dog dress with a leash attachment, so the outfit is walk-ready rather than just for photos.

- Built-in leash point means you do not need a separate harness.
- Soft fabric cut to leave the legs free to walk.
- Two designs, in black plaid and grey plaid.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-dresses-for-outdoor-walks-with-a-leash$c$
    AND "description" IS DISTINCT FROM $c$A dog dress with a leash attachment, so the outfit is walk-ready rather than just for photos.

- Built-in leash point means you do not need a separate harness.
- Soft fabric cut to leave the legs free to walk.
- Two designs, in black plaid and grey plaid.$c$;

-- pet-dog-color-block-cardigan-sweater
UPDATE "products" SET
  "description" = $c$A colour-block dog cardigan that keeps a small dog warm and looks tidy on a walk.

- Knitted cardigan that sits comfortably over the chest and back.
- Colour-block design in a choice of colourways.
- Sizes for small to medium dogs.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-dog-color-block-cardigan-sweater$c$
    AND "description" IS DISTINCT FROM $c$A colour-block dog cardigan that keeps a small dog warm and looks tidy on a walk.

- Knitted cardigan that sits comfortably over the chest and back.
- Colour-block design in a choice of colourways.
- Sizes for small to medium dogs.$c$;

-- large-dog-border-collie-pet-sweater
UPDATE "products" SET
  "description" = $c$A warm sweater sized for a large dog, cut to fit a longer, deeper chest.

- Sized for bigger breeds rather than scaled up from a small pattern.
- Warm knit for cold walks and evenings.
- Colourways and a size guide for chest and back length.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$large-dog-border-collie-pet-sweater$c$
    AND "description" IS DISTINCT FROM $c$A warm sweater sized for a large dog, cut to fit a longer, deeper chest.

- Sized for bigger breeds rather than scaled up from a small pattern.
- Warm knit for cold walks and evenings.
- Colourways and a size guide for chest and back length.$c$;

-- pet-clothes-dog-anxiety-jacket-warm-vest
UPDATE "products" SET
  "description" = $c$A snug body wrap that calms anxious dogs and doubles as a warm vest on cold days.

- Gentle, even pressure across the chest helps settle a nervous dog.
- Warm layered fabric suits winter walks and evenings indoors.
- Sizes XXS upward for small breeds.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-clothes-dog-anxiety-jacket-warm-vest$c$
    AND "description" IS DISTINCT FROM $c$A snug body wrap that calms anxious dogs and doubles as a warm vest on cold days.

- Gentle, even pressure across the chest helps settle a nervous dog.
- Warm layered fabric suits winter walks and evenings indoors.
- Sizes XXS upward for small breeds.$c$;

-- dog-four-seasons-breathable-soft-bottom-jumpsuit
UPDATE "products" SET
  "description" = $c$A breathable four-seasons jumpsuit that keeps a dog covered without overheating.

- Airy fabric suits warmer days as well as a layer underneath.
- Soft bottom cut for comfort when sitting and lying down.
- Sizes XS through XL, in mixed, dark blue and yellow.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$dog-four-seasons-breathable-soft-bottom-jumpsuit$c$
    AND "description" IS DISTINCT FROM $c$A breathable four-seasons jumpsuit that keeps a dog covered without overheating.

- Airy fabric suits warmer days as well as a layer underneath.
- Soft bottom cut for comfort when sitting and lying down.
- Sizes XS through XL, in mixed, dark blue and yellow.$c$;

-- anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing
UPDATE "products" SET
  "description" = $c$Four-legged pyjamas that keep fur off the sofa and give a big dog something soft to wear indoors.

- Full four-legged cut covers more of the coat and catches shedding fur.
- Bow decoration for a little detail on the collar.
- Sizes for larger dogs, in navy blue, orange and leopard print.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$anti-fur-pajamas-bow-decoration-big-dog-four-legged-pet-clothing$c$
    AND "description" IS DISTINCT FROM $c$Four-legged pyjamas that keep fur off the sofa and give a big dog something soft to wear indoors.

- Full four-legged cut covers more of the coat and catches shedding fur.
- Bow decoration for a little detail on the collar.
- Sizes for larger dogs, in navy blue, orange and leopard print.$c$;

-- winter-clothes-fleece-lined-warm-dog-cute-clothes
UPDATE "products" SET
  "description" = $c$A fleece-lined dog coat that keeps a small dog warm on cold walks.

- Fleece lining holds warmth without bulk.
- Sizes XS upward, with the chest and back measurements listed so you can pick right.
- Available in brown and apricot.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$winter-clothes-fleece-lined-warm-dog-cute-clothes$c$
    AND "description" IS DISTINCT FROM $c$A fleece-lined dog coat that keeps a small dog warm on cold walks.

- Fleece lining holds warmth without bulk.
- Sizes XS upward, with the chest and back measurements listed so you can pick right.
- Available in brown and apricot.$c$;

-- post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac
UPDATE "products" SET
  "description" = $c$A knee support brace that stabilises a pet's joint after surgery or during recovery.

- Wraps the knee to limit the movement that slows healing.
- Adjustable straps hold the support in place on the leg.
- Suits post-surgical rehabilitation and joint protection.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$post-surgical-rehabilitation-joint-protection-support-strap-for-pets-knee-brac$c$
    AND "description" IS DISTINCT FROM $c$A knee support brace that stabilises a pet's joint after surgery or during recovery.

- Wraps the knee to limit the movement that slows healing.
- Adjustable straps hold the support in place on the leg.
- Suits post-surgical rehabilitation and joint protection.$c$;

-- puppy-soldier-hat-and-clothing-set
UPDATE "products" SET
  "description" = $c$A soldier-themed hat and clothing set for dressing a puppy up for a photo or a party.

- Two-piece set pairs the hat with the matching outfit.
- Adjustable straps give a comfortable fit on small dogs.
- Soft fabric that is kind to a puppy's skin.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$puppy-soldier-hat-and-clothing-set$c$
    AND "description" IS DISTINCT FROM $c$A soldier-themed hat and clothing set for dressing a puppy up for a photo or a party.

- Two-piece set pairs the hat with the matching outfit.
- Adjustable straps give a comfortable fit on small dogs.
- Soft fabric that is kind to a puppy's skin.$c$;

-- autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm
UPDATE "products" SET
  "description" = $c$A waterproof, thickened winter coat for a small dog facing wet and cold walks.

- Waterproof outer layer sheds rain and mud.
- Thickened lining holds warmth on a long walk.
- Sizes S through 3XL.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$autumn-and-winter-pet-clothes-small-dog-waterproof-thickened-warm$c$
    AND "description" IS DISTINCT FROM $c$A waterproof, thickened winter coat for a small dog facing wet and cold walks.

- Waterproof outer layer sheds rain and mud.
- Thickened lining holds warmth on a long walk.
- Sizes S through 3XL.$c$;

-- pet-shoes-wear-dog-shoes
UPDATE "products" SET
  "description" = $c$Dog boots with a waterproof sole that protect paws from hot pavement, salt and mud.

- Waterproof PVC sole keeps paws dry on wet ground.
- Secure fastening so the boots stay on a lively walk.
- Sets of four, in a range of sizes.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-shoes-wear-dog-shoes$c$
    AND "description" IS DISTINCT FROM $c$Dog boots with a waterproof sole that protect paws from hot pavement, salt and mud.

- Waterproof PVC sole keeps paws dry on wet ground.
- Secure fastening so the boots stay on a lively walk.
- Sets of four, in a range of sizes.$c$;

-- 1pc-adjustable-bandana-leather-pet-collar-triangle-scarf
UPDATE "products" SET
  "description" = $c$A leather collar with a sewn-on triangle bandana, to dress a pet up without a separate accessory.

- Bandana is stitched to the collar so it stays in place on a walk.
- Adjustable buckle fits a range of neck sizes.
- Leather collar that suits everyday wear as well as an occasion.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$1pc-adjustable-bandana-leather-pet-collar-triangle-scarf$c$
    AND "description" IS DISTINCT FROM $c$A leather collar with a sewn-on triangle bandana, to dress a pet up without a separate accessory.

- Bandana is stitched to the collar so it stays in place on a walk.
- Adjustable buckle fits a range of neck sizes.
- Leather collar that suits everyday wear as well as an occasion.$c$;

-- outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w
UPDATE "products" SET
  "description" = $c$A metal hanging seed feeder that keeps squirrels and larger birds off the seed so small songbirds get their share.

- Four feeding ports let several birds feed at once without squabbling.
- Chew-proof metal body stands up to weather and to determined squirrels.
- Hangs from a branch or hook and refills from the top.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$outdoor-wild-bird-feeder-squirrel-proof-chew-proof-metal-hanging-seed-feeder-w$c$
    AND "description" IS DISTINCT FROM $c$A metal hanging seed feeder that keeps squirrels and larger birds off the seed so small songbirds get their share.

- Four feeding ports let several birds feed at once without squabbling.
- Chew-proof metal body stands up to weather and to determined squirrels.
- Hangs from a branch or hook and refills from the top.$c$;

-- smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered
UPDATE "products" SET
  "description" = $c$A solar-powered bird feeder with a camera that identifies the visiting species and sends the photo to your phone.

- AI recognition covers 10,000+ bird species and notifies you as each visitor arrives.
- High-definition camera captures a clear still of every bird.
- Solar powered, so it does not need regular charging.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$smart-bird-feeder-with-camera-ai-identify-10000-bird-specie-solar-powered$c$
    AND "description" IS DISTINCT FROM $c$A solar-powered bird feeder with a camera that identifies the visiting species and sends the photo to your phone.

- AI recognition covers 10,000+ bird species and notifies you as each visitor arrives.
- High-definition camera captures a clear still of every bird.
- Solar powered, so it does not need regular charging.$c$;

-- 45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling
UPDATE "products" SET
  "description" = $c$A tall metal bird cage on a rolling stand that gives a parrot room to climb, with a storage shelf and accessories built in.

- Detachable rolling stand makes the whole cage easy to move for cleaning or a change of room.
- Storage basket under the cage keeps food, seed and cleaning supplies together.
- Powder-coated metal bars and a slide-out tray for straightforward day-to-day cleaning.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$45-inch-metal-indoor-bird-cage-parrot-cage-bird-aviary-with-detachable-rolling$c$
    AND "description" IS DISTINCT FROM $c$A tall metal bird cage on a rolling stand that gives a parrot room to climb, with a storage shelf and accessories built in.

- Detachable rolling stand makes the whole cage easy to move for cleaning or a change of room.
- Storage basket under the cage keeps food, seed and cleaning supplies together.
- Powder-coated metal bars and a slide-out tray for straightforward day-to-day cleaning.$c$;

-- parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play
UPDATE "products" SET
  "description" = $c$A solid-wood play stand that gives a cockatiel or small parrot a perch, a ladder and somewhere out of the cage to play.

- Solid wood build that is safe and non-toxic for a bird.
- Portable, so it moves between rooms.
- Suits use as a stand or fitted inside a cage as a rack.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$parrot-playstand-bird-plays-stand-cockatiel-playground-wooden-perch-gym-play$c$
    AND "description" IS DISTINCT FROM $c$A solid-wood play stand that gives a cockatiel or small parrot a perch, a ladder and somewhere out of the cage to play.

- Solid wood build that is safe and non-toxic for a bird.
- Portable, so it moves between rooms.
- Suits use as a stand or fitted inside a cage as a rack.$c$;

-- bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird
UPDATE "products" SET
  "description" = $c$An eleven-piece bird toy set with swings, hammocks and ladders, to keep a parakeet busy in the cage.

- Eleven pieces cover climbing, swinging, chewing and resting in one box.
- Brightly coloured wooden parts and bells catch a bird's attention.
- Fits budgerigar-sized birds.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$bird-parakeet-toys-swing-hanging-standing-chewing-hammock-climbing-ladder-bird$c$
    AND "description" IS DISTINCT FROM $c$An eleven-piece bird toy set with swings, hammocks and ladders, to keep a parakeet busy in the cage.

- Eleven pieces cover climbing, swinging, chewing and resting in one box.
- Brightly coloured wooden parts and bells catch a bird's attention.
- Fits budgerigar-sized birds.$c$;

-- convenient-outing-parrot-myna-bird-cage
UPDATE "products" SET
  "description" = $c$A compact carry cage for taking a parrot or myna out to the vet, on a trip or into the garden.

- 20-35 L capacity with a zipped side pocket for treats and small accessories.
- Easy-access opening makes it quick to settle your bird in and lift it out.
- Light enough to carry in one hand with a shoulder strap.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$convenient-outing-parrot-myna-bird-cage$c$
    AND "description" IS DISTINCT FROM $c$A compact carry cage for taking a parrot or myna out to the vet, on a trip or into the garden.

- 20-35 L capacity with a zipped side pocket for treats and small accessories.
- Easy-access opening makes it quick to settle your bird in and lift it out.
- Light enough to carry in one hand with a shoulder strap.$c$;

-- parrot-out-rope-towing-anti-loss-flight-suit
UPDATE "products" SET
  "description" = $c$A soft flight suit with a tether, so a parrot can be out of the cage and safely on your shoulder or in the yard.

- Made from lightweight cloth that stays comfortable for short outings.
- Comes with a traction rope you clip on to keep control of your bird.
- Padded shoulder panel protects your clothes from droppings and claws.
- Adjustable fit for small to medium parrots.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$parrot-out-rope-towing-anti-loss-flight-suit$c$
    AND "description" IS DISTINCT FROM $c$A soft flight suit with a tether, so a parrot can be out of the cage and safely on your shoulder or in the yard.

- Made from lightweight cloth that stays comfortable for short outings.
- Comes with a traction rope you clip on to keep control of your bird.
- Padded shoulder panel protects your clothes from droppings and claws.
- Adjustable fit for small to medium parrots.$c$;

-- comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb
UPDATE "products" SET
  "description" = $c$A fine-tooth flea and tick comb with a rubber handle for a secure grip while you work through the coat.

- Fine teeth lift fleas, ticks and their eggs out of the fur.
- Rubber handle stays steady even when your hands are wet.
- Suits dogs and cats, in purple.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$comb-with-rubber-handle-flea-and-tick-combs-for-dogs-cats-fine-tooth-dog-comb$c$
    AND "description" IS DISTINCT FROM $c$A fine-tooth flea and tick comb with a rubber handle for a secure grip while you work through the coat.

- Fine teeth lift fleas, ticks and their eggs out of the fur.
- Rubber handle stays steady even when your hands are wet.
- Suits dogs and cats, in purple.$c$;

-- pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki
UPDATE "products" SET
  "description" = $c$A stainless-steel grooming kit with straight, curved and thinning shears for tidying a dog's coat at home.

- Three blade types cover trimming, shaping and blending.
- Stainless steel that keeps its edge and wipes clean.
- Suitable for dogs of most coat types.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-dog-grooming-scissors-stainless-straight-curved-thinning-shears-trimmer-ki$c$
    AND "description" IS DISTINCT FROM $c$A stainless-steel grooming kit with straight, curved and thinning shears for tidying a dog's coat at home.

- Three blade types cover trimming, shaping and blending.
- Stainless steel that keeps its edge and wipes clean.
- Suitable for dogs of most coat types.$c$;

-- cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f
UPDATE "products" SET
  "description" = $c$A grooming hammock that suspends a pet paws-up so you can trim nails and clean ears at home without a second pair of hands.

- Holds cats and dogs up to 12 lb securely while you work.
- Double-layer sling with mesh for breathability.
- Takes the struggle out of nail trimming, bathing and eye and ear care.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$cat-grooming-hammock-kit-for-cats-dogs-up-to-12-lb-hanging-harness-and-sling-f$c$
    AND "description" IS DISTINCT FROM $c$A grooming hammock that suspends a pet paws-up so you can trim nails and clean ears at home without a second pair of hands.

- Holds cats and dogs up to 12 lb securely while you work.
- Double-layer sling with mesh for breathability.
- Takes the struggle out of nail trimming, bathing and eye and ear care.$c$;

-- 2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil
UPDATE "products" SET
  "description" = $c$A two-piece grooming brush set that dispenses shampoo as you wash, so bath time is quicker for you and calmer for your pet.

- Pairs a long-handled brush for reaching along the back with a compact handheld brush for the face, paws and close work.
- Fill the clear reservoir with shampoo and press the button to release soap straight into the bristles.
- Soft silicone bristles clean and massage sensitive skin without scratching.
- A non-slip grip that holds steady in a wet hand, and the set rinses clean in seconds.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$2-pack-long-short-handheld-dog-cat-shower-brush-with-liquid-dispenser-soft-sil$c$
    AND "description" IS DISTINCT FROM $c$A two-piece grooming brush set that dispenses shampoo as you wash, so bath time is quicker for you and calmer for your pet.

- Pairs a long-handled brush for reaching along the back with a compact handheld brush for the face, paws and close work.
- Fill the clear reservoir with shampoo and press the button to release soap straight into the bristles.
- Soft silicone bristles clean and massage sensitive skin without scratching.
- A non-slip grip that holds steady in a wet hand, and the set rinses clean in seconds.$c$;

-- pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove
UPDATE "products" SET
  "description" = $c$A microfibre dog bathrobe that soaks up water fast and keeps a wet dog from shaking it across the room.

- Absorbent microfibre that dries far more water than a cotton towel.
- Pocket and glove-style finish make the rub-down quicker.
- Machine washable, so it is ready for the next bath.$c$,
  "updated_at" = now()
  WHERE "slug" = $c$pet-towel-dog-bathrobe-water-absorbent-and-quick-drying-cleaning-beauty-glove$c$
    AND "description" IS DISTINCT FROM $c$A microfibre dog bathrobe that soaks up water fast and keeps a wet dog from shaking it across the room.

- Absorbent microfibre that dries far more water than a cotton towel.
- Pocket and glove-style finish make the rub-down quicker.
- Machine washable, so it is ready for the next bath.$c$;

UPDATE "product_variants" SET "name" = $c$White$c$ WHERE "sku" = $c$CJYD234462301AZ$c$ AND "name" IS DISTINCT FROM $c$White$c$;
UPDATE "product_variants" SET "name" = $c$S · Military Green$c$ WHERE "sku" = $c$CJMY172457401AZ$c$ AND "name" IS DISTINCT FROM $c$S · Military Green$c$;
UPDATE "product_variants" SET "name" = $c$M · Military Green$c$ WHERE "sku" = $c$CJMY172457402BY$c$ AND "name" IS DISTINCT FROM $c$M · Military Green$c$;
UPDATE "product_variants" SET "name" = $c$L · Military Green$c$ WHERE "sku" = $c$CJMY172457403CX$c$ AND "name" IS DISTINCT FROM $c$L · Military Green$c$;
UPDATE "product_variants" SET "name" = $c$S · Green Grey$c$ WHERE "sku" = $c$CJMY172457404DW$c$ AND "name" IS DISTINCT FROM $c$S · Green Grey$c$;
UPDATE "product_variants" SET "name" = $c$M · Green Grey$c$ WHERE "sku" = $c$CJMY172457405EV$c$ AND "name" IS DISTINCT FROM $c$M · Green Grey$c$;
UPDATE "product_variants" SET "name" = $c$L · Green Grey$c$ WHERE "sku" = $c$CJMY172457406FU$c$ AND "name" IS DISTINCT FROM $c$L · Green Grey$c$;
UPDATE "product_variants" SET "name" = $c$S · Black$c$ WHERE "sku" = $c$CJJJCWGY02426-Black-S$c$ AND "name" IS DISTINCT FROM $c$S · Black$c$;
UPDATE "product_variants" SET "name" = $c$M · Black$c$ WHERE "sku" = $c$CJJJCWGY02426-Black-M$c$ AND "name" IS DISTINCT FROM $c$M · Black$c$;
UPDATE "product_variants" SET "name" = $c$L · Black$c$ WHERE "sku" = $c$CJJJCWGY02426-Black-L$c$ AND "name" IS DISTINCT FROM $c$L · Black$c$;
UPDATE "product_variants" SET "name" = $c$XL · Black$c$ WHERE "sku" = $c$CJJJCWGY02426-Black-XL$c$ AND "name" IS DISTINCT FROM $c$XL · Black$c$;
UPDATE "product_variants" SET "name" = $c$S · Red$c$ WHERE "sku" = $c$CJJJCWGY02426-Red-S$c$ AND "name" IS DISTINCT FROM $c$S · Red$c$;
UPDATE "product_variants" SET "name" = $c$M · Red$c$ WHERE "sku" = $c$CJJJCWGY02426-Red-M$c$ AND "name" IS DISTINCT FROM $c$M · Red$c$;
UPDATE "product_variants" SET "name" = $c$L · Red$c$ WHERE "sku" = $c$CJJJCWGY02426-Red-L$c$ AND "name" IS DISTINCT FROM $c$L · Red$c$;
UPDATE "product_variants" SET "name" = $c$XL · Red$c$ WHERE "sku" = $c$CJJJCWGY02426-Red-XL$c$ AND "name" IS DISTINCT FROM $c$XL · Red$c$;
UPDATE "product_variants" SET "name" = $c$S · Blue$c$ WHERE "sku" = $c$CJJJCWGY02426-Blue-S$c$ AND "name" IS DISTINCT FROM $c$S · Blue$c$;
UPDATE "product_variants" SET "name" = $c$M · Blue$c$ WHERE "sku" = $c$CJJJCWGY02426-Blue-M$c$ AND "name" IS DISTINCT FROM $c$M · Blue$c$;
UPDATE "product_variants" SET "name" = $c$L · Blue$c$ WHERE "sku" = $c$CJJJCWGY02426-Blue-L$c$ AND "name" IS DISTINCT FROM $c$L · Blue$c$;
UPDATE "product_variants" SET "name" = $c$XL · Blue$c$ WHERE "sku" = $c$CJJJCWGY02426-Blue-XL$c$ AND "name" IS DISTINCT FROM $c$XL · Blue$c$;
UPDATE "product_variants" SET "name" = $c$S · Grey$c$ WHERE "sku" = $c$CJJJCWGY02426-Grey-S$c$ AND "name" IS DISTINCT FROM $c$S · Grey$c$;
UPDATE "product_variants" SET "name" = $c$M · Grey$c$ WHERE "sku" = $c$CJJJCWGY02426-Grey-M$c$ AND "name" IS DISTINCT FROM $c$M · Grey$c$;
UPDATE "product_variants" SET "name" = $c$L · Grey$c$ WHERE "sku" = $c$CJJJCWGY02426-Grey-L$c$ AND "name" IS DISTINCT FROM $c$L · Grey$c$;
UPDATE "product_variants" SET "name" = $c$XL · Grey$c$ WHERE "sku" = $c$CJJJCWGY02426-Grey-XL$c$ AND "name" IS DISTINCT FROM $c$XL · Grey$c$;
UPDATE "product_variants" SET "name" = $c$M · Dark grey$c$ WHERE "sku" = $c$CJJJCWGY02426-Dark grey-M$c$ AND "name" IS DISTINCT FROM $c$M · Dark grey$c$;
UPDATE "product_variants" SET "name" = $c$L · Dark grey$c$ WHERE "sku" = $c$CJJJCWGY02426-Dark grey-L$c$ AND "name" IS DISTINCT FROM $c$L · Dark grey$c$;
UPDATE "product_variants" SET "name" = $c$XL · Dark grey$c$ WHERE "sku" = $c$CJJJCWGY02426-Dark grey-XL$c$ AND "name" IS DISTINCT FROM $c$XL · Dark grey$c$;
UPDATE "product_variants" SET "name" = $c$L · Orange$c$ WHERE "sku" = $c$CJJJCWGY02426-Orange-L$c$ AND "name" IS DISTINCT FROM $c$L · Orange$c$;
UPDATE "product_variants" SET "name" = $c$XL · Orange$c$ WHERE "sku" = $c$CJJJCWGY02426-Orange-XL$c$ AND "name" IS DISTINCT FROM $c$XL · Orange$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJYD202627001AZ$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$White$c$ WHERE "sku" = $c$CJYD202627002BY$c$ AND "name" IS DISTINCT FROM $c$White$c$;
UPDATE "product_variants" SET "name" = $c$Grey · 45 x 45 x 35$c$ WHERE "sku" = $c$CJMY111278601AZ$c$ AND "name" IS DISTINCT FROM $c$Grey · 45 x 45 x 35$c$;
UPDATE "product_variants" SET "name" = $c$Pink · 45 x 45 x 35$c$ WHERE "sku" = $c$CJMY111278602BY$c$ AND "name" IS DISTINCT FROM $c$Pink · 45 x 45 x 35$c$;
UPDATE "product_variants" SET "name" = $c$Sandwich cloth pink · 45 x 45 x 35$c$ WHERE "sku" = $c$CJMY111278603CX$c$ AND "name" IS DISTINCT FROM $c$Sandwich cloth pink · 45 x 45 x 35$c$;
UPDATE "product_variants" SET "name" = $c$Basic pump · 220V US$c$ WHERE "sku" = $c$CJMY174605301AZ$c$ AND "name" IS DISTINCT FROM $c$Basic pump · 220V US$c$;
UPDATE "product_variants" SET "name" = $c$Basic pump · US$c$ WHERE "sku" = $c$CJMY174605302BY$c$ AND "name" IS DISTINCT FROM $c$Basic pump · US$c$;
UPDATE "product_variants" SET "name" = $c$Basic pump · EU$c$ WHERE "sku" = $c$CJMY174605303CX$c$ AND "name" IS DISTINCT FROM $c$Basic pump · EU$c$;
UPDATE "product_variants" SET "name" = $c$Basic pump · UK$c$ WHERE "sku" = $c$CJMY174605304DW$c$ AND "name" IS DISTINCT FROM $c$Basic pump · UK$c$;
UPDATE "product_variants" SET "name" = $c$Basic pump · AU$c$ WHERE "sku" = $c$CJMY174605305EV$c$ AND "name" IS DISTINCT FROM $c$Basic pump · AU$c$;
UPDATE "product_variants" SET "name" = $c$Induction pump · 220V US$c$ WHERE "sku" = $c$CJMY174605306FU$c$ AND "name" IS DISTINCT FROM $c$Induction pump · 220V US$c$;
UPDATE "product_variants" SET "name" = $c$Induction pump · US$c$ WHERE "sku" = $c$CJMY174605307GT$c$ AND "name" IS DISTINCT FROM $c$Induction pump · US$c$;
UPDATE "product_variants" SET "name" = $c$Induction pump · EU$c$ WHERE "sku" = $c$CJMY174605308HS$c$ AND "name" IS DISTINCT FROM $c$Induction pump · EU$c$;
UPDATE "product_variants" SET "name" = $c$Induction pump · UK$c$ WHERE "sku" = $c$CJMY174605309IR$c$ AND "name" IS DISTINCT FROM $c$Induction pump · UK$c$;
UPDATE "product_variants" SET "name" = $c$Induction pump · AU$c$ WHERE "sku" = $c$CJMY174605310JQ$c$ AND "name" IS DISTINCT FROM $c$Induction pump · AU$c$;
UPDATE "product_variants" SET "name" = $c$Pink$c$ WHERE "sku" = $c$CJGY102545401AZ$c$ AND "name" IS DISTINCT FROM $c$Pink$c$;
UPDATE "product_variants" SET "name" = $c$Blue$c$ WHERE "sku" = $c$CJGY102545402BY$c$ AND "name" IS DISTINCT FROM $c$Blue$c$;
UPDATE "product_variants" SET "name" = $c$Grey$c$ WHERE "sku" = $c$CJGY102545403CX$c$ AND "name" IS DISTINCT FROM $c$Grey$c$;
UPDATE "product_variants" SET "name" = $c$White$c$ WHERE "sku" = $c$CJGY102545404DW$c$ AND "name" IS DISTINCT FROM $c$White$c$;
UPDATE "product_variants" SET "name" = $c$Pink 2L$c$ WHERE "sku" = $c$CJGY102545423WD$c$ AND "name" IS DISTINCT FROM $c$Pink 2L$c$;
UPDATE "product_variants" SET "name" = $c$White 2L$c$ WHERE "sku" = $c$CJGY102545424XC$c$ AND "name" IS DISTINCT FROM $c$White 2L$c$;
UPDATE "product_variants" SET "name" = $c$Grey 2L$c$ WHERE "sku" = $c$CJGY102545425YB$c$ AND "name" IS DISTINCT FROM $c$Grey 2L$c$;
UPDATE "product_variants" SET "name" = $c$Blue 2L$c$ WHERE "sku" = $c$CJGY102545426ZA$c$ AND "name" IS DISTINCT FROM $c$Blue 2L$c$;
UPDATE "product_variants" SET "name" = $c$Red$c$ WHERE "sku" = $c$CJGX159744101AZ$c$ AND "name" IS DISTINCT FROM $c$Red$c$;
UPDATE "product_variants" SET "name" = $c$Yellow$c$ WHERE "sku" = $c$CJGX159744102BY$c$ AND "name" IS DISTINCT FROM $c$Yellow$c$;
UPDATE "product_variants" SET "name" = $c$Purple$c$ WHERE "sku" = $c$CJGX159744103CX$c$ AND "name" IS DISTINCT FROM $c$Purple$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJGX159744104DW$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$Pink$c$ WHERE "sku" = $c$CJGX159744105EV$c$ AND "name" IS DISTINCT FROM $c$Pink$c$;
UPDATE "product_variants" SET "name" = $c$Orange$c$ WHERE "sku" = $c$CJGX159744106FU$c$ AND "name" IS DISTINCT FROM $c$Orange$c$;
UPDATE "product_variants" SET "name" = $c$Sky Blue$c$ WHERE "sku" = $c$CJGX159744107GT$c$ AND "name" IS DISTINCT FROM $c$Sky Blue$c$;
UPDATE "product_variants" SET "name" = $c$Purple 3M · Retractable lead$c$ WHERE "sku" = $c$CJGX122193001AZ$c$ AND "name" IS DISTINCT FROM $c$Purple 3M · Retractable lead$c$;
UPDATE "product_variants" SET "name" = $c$Purple 3M · Lead and collar$c$ WHERE "sku" = $c$CJGX122193002BY$c$ AND "name" IS DISTINCT FROM $c$Purple 3M · Lead and collar$c$;
UPDATE "product_variants" SET "name" = $c$Orange 3M · Retractable lead$c$ WHERE "sku" = $c$CJGX122193005EV$c$ AND "name" IS DISTINCT FROM $c$Orange 3M · Retractable lead$c$;
UPDATE "product_variants" SET "name" = $c$Orange 3M · Lead and collar$c$ WHERE "sku" = $c$CJGX122193006FU$c$ AND "name" IS DISTINCT FROM $c$Orange 3M · Lead and collar$c$;
UPDATE "product_variants" SET "name" = $c$Green 3M · Retractable lead$c$ WHERE "sku" = $c$CJGX122193009IR$c$ AND "name" IS DISTINCT FROM $c$Green 3M · Retractable lead$c$;
UPDATE "product_variants" SET "name" = $c$Green 3M · Lead and collar$c$ WHERE "sku" = $c$CJGX122193010JQ$c$ AND "name" IS DISTINCT FROM $c$Green 3M · Lead and collar$c$;
UPDATE "product_variants" SET "name" = $c$Purple 5M · Retractable lead$c$ WHERE "sku" = $c$CJGX122193013MN$c$ AND "name" IS DISTINCT FROM $c$Purple 5M · Retractable lead$c$;
UPDATE "product_variants" SET "name" = $c$Purple 5M · Lead and collar$c$ WHERE "sku" = $c$CJGX122193014NM$c$ AND "name" IS DISTINCT FROM $c$Purple 5M · Lead and collar$c$;
UPDATE "product_variants" SET "name" = $c$Orange 5M · Retractable lead$c$ WHERE "sku" = $c$CJGX122193017QJ$c$ AND "name" IS DISTINCT FROM $c$Orange 5M · Retractable lead$c$;
UPDATE "product_variants" SET "name" = $c$Orange 5M · Lead and collar$c$ WHERE "sku" = $c$CJGX122193018RI$c$ AND "name" IS DISTINCT FROM $c$Orange 5M · Lead and collar$c$;
UPDATE "product_variants" SET "name" = $c$Green 5M · Retractable lead$c$ WHERE "sku" = $c$CJGX122193021UF$c$ AND "name" IS DISTINCT FROM $c$Green 5M · Retractable lead$c$;
UPDATE "product_variants" SET "name" = $c$Green 5M · Lead and collar$c$ WHERE "sku" = $c$CJGX122193022VE$c$ AND "name" IS DISTINCT FROM $c$Green 5M · Lead and collar$c$;
UPDATE "product_variants" SET "name" = $c$Orange · S$c$ WHERE "sku" = $c$CJJT150843701AZ$c$ AND "name" IS DISTINCT FROM $c$Orange · S$c$;
UPDATE "product_variants" SET "name" = $c$Orange · M$c$ WHERE "sku" = $c$CJJT150843702BY$c$ AND "name" IS DISTINCT FROM $c$Orange · M$c$;
UPDATE "product_variants" SET "name" = $c$Orange · L$c$ WHERE "sku" = $c$CJJT150843703CX$c$ AND "name" IS DISTINCT FROM $c$Orange · L$c$;
UPDATE "product_variants" SET "name" = $c$Orange · XL$c$ WHERE "sku" = $c$CJJT150843704DW$c$ AND "name" IS DISTINCT FROM $c$Orange · XL$c$;
UPDATE "product_variants" SET "name" = $c$Orange · 2XL$c$ WHERE "sku" = $c$CJJT150843705EV$c$ AND "name" IS DISTINCT FROM $c$Orange · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Orange · 3XL$c$ WHERE "sku" = $c$CJJT150843706FU$c$ AND "name" IS DISTINCT FROM $c$Orange · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Green · S$c$ WHERE "sku" = $c$CJJT150843707GT$c$ AND "name" IS DISTINCT FROM $c$Green · S$c$;
UPDATE "product_variants" SET "name" = $c$Green · M$c$ WHERE "sku" = $c$CJJT150843708HS$c$ AND "name" IS DISTINCT FROM $c$Green · M$c$;
UPDATE "product_variants" SET "name" = $c$Green · L$c$ WHERE "sku" = $c$CJJT150843709IR$c$ AND "name" IS DISTINCT FROM $c$Green · L$c$;
UPDATE "product_variants" SET "name" = $c$Green · XL$c$ WHERE "sku" = $c$CJJT150843710JQ$c$ AND "name" IS DISTINCT FROM $c$Green · XL$c$;
UPDATE "product_variants" SET "name" = $c$Green · 2XL$c$ WHERE "sku" = $c$CJJT150843711KP$c$ AND "name" IS DISTINCT FROM $c$Green · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Green · 3XL$c$ WHERE "sku" = $c$CJJT150843712LO$c$ AND "name" IS DISTINCT FROM $c$Green · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Blue · S$c$ WHERE "sku" = $c$CJJT150843713MN$c$ AND "name" IS DISTINCT FROM $c$Blue · S$c$;
UPDATE "product_variants" SET "name" = $c$Blue · M$c$ WHERE "sku" = $c$CJJT150843714NM$c$ AND "name" IS DISTINCT FROM $c$Blue · M$c$;
UPDATE "product_variants" SET "name" = $c$Blue · L$c$ WHERE "sku" = $c$CJJT150843715OL$c$ AND "name" IS DISTINCT FROM $c$Blue · L$c$;
UPDATE "product_variants" SET "name" = $c$Blue · XL$c$ WHERE "sku" = $c$CJJT150843716PK$c$ AND "name" IS DISTINCT FROM $c$Blue · XL$c$;
UPDATE "product_variants" SET "name" = $c$Blue · 2XL$c$ WHERE "sku" = $c$CJJT150843717QJ$c$ AND "name" IS DISTINCT FROM $c$Blue · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Blue · 3XL$c$ WHERE "sku" = $c$CJJT150843718RI$c$ AND "name" IS DISTINCT FROM $c$Blue · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Pink · S$c$ WHERE "sku" = $c$CJJT150843719SH$c$ AND "name" IS DISTINCT FROM $c$Pink · S$c$;
UPDATE "product_variants" SET "name" = $c$Pink · M$c$ WHERE "sku" = $c$CJJT150843720TG$c$ AND "name" IS DISTINCT FROM $c$Pink · M$c$;
UPDATE "product_variants" SET "name" = $c$Magic Tail Style Red$c$ WHERE "sku" = $c$CJMY212708201AZ$c$ AND "name" IS DISTINCT FROM $c$Magic Tail Style Red$c$;
UPDATE "product_variants" SET "name" = $c$Magic Tail Style Green$c$ WHERE "sku" = $c$CJMY212708202BY$c$ AND "name" IS DISTINCT FROM $c$Magic Tail Style Green$c$;
UPDATE "product_variants" SET "name" = $c$Magic Tail Gray$c$ WHERE "sku" = $c$CJMY212708203CX$c$ AND "name" IS DISTINCT FROM $c$Magic Tail Gray$c$;
UPDATE "product_variants" SET "name" = $c$With Rope Style Red$c$ WHERE "sku" = $c$CJMY212708204DW$c$ AND "name" IS DISTINCT FROM $c$With Rope Style Red$c$;
UPDATE "product_variants" SET "name" = $c$With Rope Style Green$c$ WHERE "sku" = $c$CJMY212708205EV$c$ AND "name" IS DISTINCT FROM $c$With Rope Style Green$c$;
UPDATE "product_variants" SET "name" = $c$With Rope Style Gray$c$ WHERE "sku" = $c$CJMY212708206FU$c$ AND "name" IS DISTINCT FROM $c$With Rope Style Gray$c$;
UPDATE "product_variants" SET "name" = $c$Bird call · red$c$ WHERE "sku" = $c$CJMY212708207GT$c$ AND "name" IS DISTINCT FROM $c$Bird call · red$c$;
UPDATE "product_variants" SET "name" = $c$Bird call · Blue$c$ WHERE "sku" = $c$CJMY212708208HS$c$ AND "name" IS DISTINCT FROM $c$Bird call · Blue$c$;
UPDATE "product_variants" SET "name" = $c$Dragonfly · Red$c$ WHERE "sku" = $c$CJMY212708210JQ$c$ AND "name" IS DISTINCT FROM $c$Dragonfly · Red$c$;
UPDATE "product_variants" SET "name" = $c$P02 Red Long Rope Wake Up$c$ WHERE "sku" = $c$CJMY212708211KP$c$ AND "name" IS DISTINCT FROM $c$P02 Red Long Rope Wake Up$c$;
UPDATE "product_variants" SET "name" = $c$Shark Pirate Ship · 65cm$c$ WHERE "sku" = $c$CJYD205849601AZ$c$ AND "name" IS DISTINCT FROM $c$Shark Pirate Ship · 65cm$c$;
UPDATE "product_variants" SET "name" = $c$Pond World · 65cm$c$ WHERE "sku" = $c$CJYD205849602BY$c$ AND "name" IS DISTINCT FROM $c$Pond World · 65cm$c$;
UPDATE "product_variants" SET "name" = $c$Undersea World · 65cm$c$ WHERE "sku" = $c$CJYD205849603CX$c$ AND "name" IS DISTINCT FROM $c$Undersea World · 65cm$c$;
UPDATE "product_variants" SET "name" = $c$Shark Pirate Ship · 100cm$c$ WHERE "sku" = $c$CJYD205849604DW$c$ AND "name" IS DISTINCT FROM $c$Shark Pirate Ship · 100cm$c$;
UPDATE "product_variants" SET "name" = $c$Seal Dolphin · 100cm$c$ WHERE "sku" = $c$CJYD205849605EV$c$ AND "name" IS DISTINCT FROM $c$Seal Dolphin · 100cm$c$;
UPDATE "product_variants" SET "name" = $c$Ice pad large$c$ WHERE "sku" = $c$CJYD205849606FU$c$ AND "name" IS DISTINCT FROM $c$Ice pad large$c$;
UPDATE "product_variants" SET "name" = $c$Pump (random colour)$c$ WHERE "sku" = $c$CJYD205849607GT$c$ AND "name" IS DISTINCT FROM $c$Pump (random colour)$c$;
UPDATE "product_variants" SET "name" = $c$Ocean World · 65cm$c$ WHERE "sku" = $c$CJYD205849608HS$c$ AND "name" IS DISTINCT FROM $c$Ocean World · 65cm$c$;
UPDATE "product_variants" SET "name" = $c$Ocean World · 100cm$c$ WHERE "sku" = $c$CJYD205849609IR$c$ AND "name" IS DISTINCT FROM $c$Ocean World · 100cm$c$;
UPDATE "product_variants" SET "name" = $c$Ice pad small$c$ WHERE "sku" = $c$CJYD205849610JQ$c$ AND "name" IS DISTINCT FROM $c$Ice pad small$c$;
UPDATE "product_variants" SET "name" = $c$Jumping shrimp random colour · 35cm USB$c$ WHERE "sku" = $c$CJJT131737102BY$c$ AND "name" IS DISTINCT FROM $c$Jumping shrimp random colour · 35cm USB$c$;
UPDATE "product_variants" SET "name" = $c$Soft sewn on eyes · 32cm USB$c$ WHERE "sku" = $c$CJJT131737106FU$c$ AND "name" IS DISTINCT FROM $c$Soft sewn on eyes · 32cm USB$c$;
UPDATE "product_variants" SET "name" = $c$Green bear den · Large$c$ WHERE "sku" = $c$CJGY135452710JQ$c$ AND "name" IS DISTINCT FROM $c$Green bear den · Large$c$;
UPDATE "product_variants" SET "name" = $c$Green bear den · Medium$c$ WHERE "sku" = $c$CJGY135452711KP$c$ AND "name" IS DISTINCT FROM $c$Green bear den · Medium$c$;
UPDATE "product_variants" SET "name" = $c$Green bear den · Small$c$ WHERE "sku" = $c$CJGY135452712LO$c$ AND "name" IS DISTINCT FROM $c$Green bear den · Small$c$;
UPDATE "product_variants" SET "name" = $c$Grey stars Blue · Large$c$ WHERE "sku" = $c$CJGY135452716PK$c$ AND "name" IS DISTINCT FROM $c$Grey stars Blue · Large$c$;
UPDATE "product_variants" SET "name" = $c$Grey stars Blue · Medium$c$ WHERE "sku" = $c$CJGY135452717QJ$c$ AND "name" IS DISTINCT FROM $c$Grey stars Blue · Medium$c$;
UPDATE "product_variants" SET "name" = $c$Grey stars Blue · Small$c$ WHERE "sku" = $c$CJGY135452718RI$c$ AND "name" IS DISTINCT FROM $c$Grey stars Blue · Small$c$;
UPDATE "product_variants" SET "name" = $c$Brown bear · Large$c$ WHERE "sku" = $c$CJGY135452734HS$c$ AND "name" IS DISTINCT FROM $c$Brown bear · Large$c$;
UPDATE "product_variants" SET "name" = $c$Brown bear · Medium$c$ WHERE "sku" = $c$CJGY135452735IR$c$ AND "name" IS DISTINCT FROM $c$Brown bear · Medium$c$;
UPDATE "product_variants" SET "name" = $c$Brown bear · Small$c$ WHERE "sku" = $c$CJGY135452736JQ$c$ AND "name" IS DISTINCT FROM $c$Brown bear · Small$c$;
UPDATE "product_variants" SET "name" = $c$Rabbit door curtain · Large$c$ WHERE "sku" = $c$CJGY135452737KP$c$ AND "name" IS DISTINCT FROM $c$Rabbit door curtain · Large$c$;
UPDATE "product_variants" SET "name" = $c$Rabbit door curtain · Medium$c$ WHERE "sku" = $c$CJGY135452738LO$c$ AND "name" IS DISTINCT FROM $c$Rabbit door curtain · Medium$c$;
UPDATE "product_variants" SET "name" = $c$Rabbit door curtain · Small$c$ WHERE "sku" = $c$CJGY135452739MN$c$ AND "name" IS DISTINCT FROM $c$Rabbit door curtain · Small$c$;
UPDATE "product_variants" SET "name" = $c$Brown Snow House · Large$c$ WHERE "sku" = $c$CJGY135452743QJ$c$ AND "name" IS DISTINCT FROM $c$Brown Snow House · Large$c$;
UPDATE "product_variants" SET "name" = $c$Brown Snow House · Medium$c$ WHERE "sku" = $c$CJGY135452744RI$c$ AND "name" IS DISTINCT FROM $c$Brown Snow House · Medium$c$;
UPDATE "product_variants" SET "name" = $c$Brown Snow House · Small$c$ WHERE "sku" = $c$CJGY135452745SH$c$ AND "name" IS DISTINCT FROM $c$Brown Snow House · Small$c$;
UPDATE "product_variants" SET "name" = $c$Grey cat · Large$c$ WHERE "sku" = $c$CJGY135452746TG$c$ AND "name" IS DISTINCT FROM $c$Grey cat · Large$c$;
UPDATE "product_variants" SET "name" = $c$Grey cat · Medium$c$ WHERE "sku" = $c$CJGY135452747UF$c$ AND "name" IS DISTINCT FROM $c$Grey cat · Medium$c$;
UPDATE "product_variants" SET "name" = $c$Grey cat · Small$c$ WHERE "sku" = $c$CJGY135452748VE$c$ AND "name" IS DISTINCT FROM $c$Grey cat · Small$c$;
UPDATE "product_variants" SET "name" = $c$Grey Snow House · Large$c$ WHERE "sku" = $c$CJGY135452752ZA$c$ AND "name" IS DISTINCT FROM $c$Grey Snow House · Large$c$;
UPDATE "product_variants" SET "name" = $c$Grey Snow House · Medium$c$ WHERE "sku" = $c$CJGY135452753AZ$c$ AND "name" IS DISTINCT FROM $c$Grey Snow House · Medium$c$;
UPDATE "product_variants" SET "name" = $c$Blue · S$c$ WHERE "sku" = $c$CJJT100652101AZ$c$ AND "name" IS DISTINCT FROM $c$Blue · S$c$;
UPDATE "product_variants" SET "name" = $c$Blue · M$c$ WHERE "sku" = $c$CJJT100652102BY$c$ AND "name" IS DISTINCT FROM $c$Blue · M$c$;
UPDATE "product_variants" SET "name" = $c$Red · S$c$ WHERE "sku" = $c$CJJT100652103CX$c$ AND "name" IS DISTINCT FROM $c$Red · S$c$;
UPDATE "product_variants" SET "name" = $c$Red · M$c$ WHERE "sku" = $c$CJJT100652104DW$c$ AND "name" IS DISTINCT FROM $c$Red · M$c$;
UPDATE "product_variants" SET "name" = $c$Blue · L$c$ WHERE "sku" = $c$CJJT100652105EV$c$ AND "name" IS DISTINCT FROM $c$Blue · L$c$;
UPDATE "product_variants" SET "name" = $c$Red · L$c$ WHERE "sku" = $c$CJJT100652106FU$c$ AND "name" IS DISTINCT FROM $c$Red · L$c$;
UPDATE "product_variants" SET "name" = $c$Style 1 · XS$c$ WHERE "sku" = $c$CJGD117239401AZ$c$ AND "name" IS DISTINCT FROM $c$Style 1 · XS$c$;
UPDATE "product_variants" SET "name" = $c$Style 1 · S$c$ WHERE "sku" = $c$CJGD117239402BY$c$ AND "name" IS DISTINCT FROM $c$Style 1 · S$c$;
UPDATE "product_variants" SET "name" = $c$Style 1 · M$c$ WHERE "sku" = $c$CJGD117239403CX$c$ AND "name" IS DISTINCT FROM $c$Style 1 · M$c$;
UPDATE "product_variants" SET "name" = $c$Style 1 · L$c$ WHERE "sku" = $c$CJGD117239404DW$c$ AND "name" IS DISTINCT FROM $c$Style 1 · L$c$;
UPDATE "product_variants" SET "name" = $c$Style 1 · XL$c$ WHERE "sku" = $c$CJGD117239405EV$c$ AND "name" IS DISTINCT FROM $c$Style 1 · XL$c$;
UPDATE "product_variants" SET "name" = $c$Style 1 · 2XL$c$ WHERE "sku" = $c$CJGD117239406FU$c$ AND "name" IS DISTINCT FROM $c$Style 1 · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Style 2 · XS$c$ WHERE "sku" = $c$CJGD117239407GT$c$ AND "name" IS DISTINCT FROM $c$Style 2 · XS$c$;
UPDATE "product_variants" SET "name" = $c$Style 2 · S$c$ WHERE "sku" = $c$CJGD117239408HS$c$ AND "name" IS DISTINCT FROM $c$Style 2 · S$c$;
UPDATE "product_variants" SET "name" = $c$Style 2 · M$c$ WHERE "sku" = $c$CJGD117239409IR$c$ AND "name" IS DISTINCT FROM $c$Style 2 · M$c$;
UPDATE "product_variants" SET "name" = $c$Style 2 · L$c$ WHERE "sku" = $c$CJGD117239410JQ$c$ AND "name" IS DISTINCT FROM $c$Style 2 · L$c$;
UPDATE "product_variants" SET "name" = $c$Style 2 · XL$c$ WHERE "sku" = $c$CJGD117239411KP$c$ AND "name" IS DISTINCT FROM $c$Style 2 · XL$c$;
UPDATE "product_variants" SET "name" = $c$Style 2 · 2XL$c$ WHERE "sku" = $c$CJGD117239412LO$c$ AND "name" IS DISTINCT FROM $c$Style 2 · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Style 3 · XS$c$ WHERE "sku" = $c$CJGD117239413MN$c$ AND "name" IS DISTINCT FROM $c$Style 3 · XS$c$;
UPDATE "product_variants" SET "name" = $c$Style 3 · S$c$ WHERE "sku" = $c$CJGD117239414NM$c$ AND "name" IS DISTINCT FROM $c$Style 3 · S$c$;
UPDATE "product_variants" SET "name" = $c$Style 3 · M$c$ WHERE "sku" = $c$CJGD117239415OL$c$ AND "name" IS DISTINCT FROM $c$Style 3 · M$c$;
UPDATE "product_variants" SET "name" = $c$Style 3 · L$c$ WHERE "sku" = $c$CJGD117239416PK$c$ AND "name" IS DISTINCT FROM $c$Style 3 · L$c$;
UPDATE "product_variants" SET "name" = $c$Style 3 · XL$c$ WHERE "sku" = $c$CJGD117239417QJ$c$ AND "name" IS DISTINCT FROM $c$Style 3 · XL$c$;
UPDATE "product_variants" SET "name" = $c$Style 3 · 2XL$c$ WHERE "sku" = $c$CJGD117239418RI$c$ AND "name" IS DISTINCT FROM $c$Style 3 · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Style 4 · XS$c$ WHERE "sku" = $c$CJGD117239419SH$c$ AND "name" IS DISTINCT FROM $c$Style 4 · XS$c$;
UPDATE "product_variants" SET "name" = $c$Style 4 · S$c$ WHERE "sku" = $c$CJGD117239420TG$c$ AND "name" IS DISTINCT FROM $c$Style 4 · S$c$;
UPDATE "product_variants" SET "name" = $c$Black Standard Meal$c$ WHERE "sku" = $c$CJNY165489801AZ$c$ AND "name" IS DISTINCT FROM $c$Black Standard Meal$c$;
UPDATE "product_variants" SET "name" = $c$Black Swing Package$c$ WHERE "sku" = $c$CJNY165489802BY$c$ AND "name" IS DISTINCT FROM $c$Black Swing Package$c$;
UPDATE "product_variants" SET "name" = $c$Black Grass Nest Package$c$ WHERE "sku" = $c$CJNY165489803CX$c$ AND "name" IS DISTINCT FROM $c$Black Grass Nest Package$c$;
UPDATE "product_variants" SET "name" = $c$Black Boutique Package$c$ WHERE "sku" = $c$CJNY165489804DW$c$ AND "name" IS DISTINCT FROM $c$Black Boutique Package$c$;
UPDATE "product_variants" SET "name" = $c$Black Deluxe Package$c$ WHERE "sku" = $c$CJNY165489805EV$c$ AND "name" IS DISTINCT FROM $c$Black Deluxe Package$c$;
UPDATE "product_variants" SET "name" = $c$White Standard Meal$c$ WHERE "sku" = $c$CJNY165489806FU$c$ AND "name" IS DISTINCT FROM $c$White Standard Meal$c$;
UPDATE "product_variants" SET "name" = $c$White Swing Package$c$ WHERE "sku" = $c$CJNY165489807GT$c$ AND "name" IS DISTINCT FROM $c$White Swing Package$c$;
UPDATE "product_variants" SET "name" = $c$White Grass Nest Package$c$ WHERE "sku" = $c$CJNY165489808HS$c$ AND "name" IS DISTINCT FROM $c$White Grass Nest Package$c$;
UPDATE "product_variants" SET "name" = $c$White Boutique Package$c$ WHERE "sku" = $c$CJNY165489809IR$c$ AND "name" IS DISTINCT FROM $c$White Boutique Package$c$;
UPDATE "product_variants" SET "name" = $c$White Deluxe Package$c$ WHERE "sku" = $c$CJNY165489810JQ$c$ AND "name" IS DISTINCT FROM $c$White Deluxe Package$c$;
UPDATE "product_variants" SET "name" = $c$Square · 12 x 12$c$ WHERE "sku" = $c$CJYD223545102BY$c$ AND "name" IS DISTINCT FROM $c$Square · 12 x 12$c$;
UPDATE "product_variants" SET "name" = $c$Small · 15 x 8 cm$c$ WHERE "sku" = $c$CJYD223545103CX$c$ AND "name" IS DISTINCT FROM $c$Small · 15 x 8 cm$c$;
UPDATE "product_variants" SET "name" = $c$Large · 19 x 10 cm$c$ WHERE "sku" = $c$CJYD223545104DW$c$ AND "name" IS DISTINCT FROM $c$Large · 19 x 10 cm$c$;
UPDATE "product_variants" SET "name" = $c$Large Fan$c$ WHERE "sku" = $c$CJYD223545105EV$c$ AND "name" IS DISTINCT FROM $c$Large Fan$c$;
UPDATE "product_variants" SET "name" = $c$Semicircle Large$c$ WHERE "sku" = $c$CJYD223545106FU$c$ AND "name" IS DISTINCT FROM $c$Semicircle Large$c$;
UPDATE "product_variants" SET "name" = $c$Semicircle Small$c$ WHERE "sku" = $c$CJYD223545107GT$c$ AND "name" IS DISTINCT FROM $c$Semicircle Small$c$;
UPDATE "product_variants" SET "name" = $c$Small Fan$c$ WHERE "sku" = $c$CJYD223545108HS$c$ AND "name" IS DISTINCT FROM $c$Small Fan$c$;
UPDATE "product_variants" SET "name" = $c$Triangular Wood$c$ WHERE "sku" = $c$CJYD223545109IR$c$ AND "name" IS DISTINCT FROM $c$Triangular Wood$c$;
UPDATE "product_variants" SET "name" = $c$Standard$c$ WHERE "sku" = $c$CJYD223545110JQ$c$ AND "name" IS DISTINCT FROM $c$Standard$c$;
UPDATE "product_variants" SET "name" = $c$White$c$ WHERE "sku" = $c$CJGY103503901AZ$c$ AND "name" IS DISTINCT FROM $c$White$c$;
UPDATE "product_variants" SET "name" = $c$Green$c$ WHERE "sku" = $c$CJGY103503902BY$c$ AND "name" IS DISTINCT FROM $c$Green$c$;
UPDATE "product_variants" SET "name" = $c$Pink$c$ WHERE "sku" = $c$CJGY103503903CX$c$ AND "name" IS DISTINCT FROM $c$Pink$c$;
UPDATE "product_variants" SET "name" = $c$Blue$c$ WHERE "sku" = $c$CJGY103503904DW$c$ AND "name" IS DISTINCT FROM $c$Blue$c$;
UPDATE "product_variants" SET "name" = $c$Blue · XS$c$ WHERE "sku" = $c$CJGY138841301AZ$c$ AND "name" IS DISTINCT FROM $c$Blue · XS$c$;
UPDATE "product_variants" SET "name" = $c$Blue · S$c$ WHERE "sku" = $c$CJGY138841302BY$c$ AND "name" IS DISTINCT FROM $c$Blue · S$c$;
UPDATE "product_variants" SET "name" = $c$Blue · M$c$ WHERE "sku" = $c$CJGY138841303CX$c$ AND "name" IS DISTINCT FROM $c$Blue · M$c$;
UPDATE "product_variants" SET "name" = $c$Pink · XS$c$ WHERE "sku" = $c$CJGY138841304DW$c$ AND "name" IS DISTINCT FROM $c$Pink · XS$c$;
UPDATE "product_variants" SET "name" = $c$Pink · S$c$ WHERE "sku" = $c$CJGY138841305EV$c$ AND "name" IS DISTINCT FROM $c$Pink · S$c$;
UPDATE "product_variants" SET "name" = $c$Pink · M$c$ WHERE "sku" = $c$CJGY138841306FU$c$ AND "name" IS DISTINCT FROM $c$Pink · M$c$;
UPDATE "product_variants" SET "name" = $c$Green · XS$c$ WHERE "sku" = $c$CJGY138841307GT$c$ AND "name" IS DISTINCT FROM $c$Green · XS$c$;
UPDATE "product_variants" SET "name" = $c$Green · S$c$ WHERE "sku" = $c$CJGY138841308HS$c$ AND "name" IS DISTINCT FROM $c$Green · S$c$;
UPDATE "product_variants" SET "name" = $c$Green · M$c$ WHERE "sku" = $c$CJGY138841309IR$c$ AND "name" IS DISTINCT FROM $c$Green · M$c$;
UPDATE "product_variants" SET "name" = $c$Pink$c$ WHERE "sku" = $c$CJGY167570101AZ$c$ AND "name" IS DISTINCT FROM $c$Pink$c$;
UPDATE "product_variants" SET "name" = $c$Light coffee$c$ WHERE "sku" = $c$CJGY167570102BY$c$ AND "name" IS DISTINCT FROM $c$Light coffee$c$;
UPDATE "product_variants" SET "name" = $c$Light Blue$c$ WHERE "sku" = $c$CJGY167570103CX$c$ AND "name" IS DISTINCT FROM $c$Light Blue$c$;
UPDATE "product_variants" SET "name" = $c$White$c$ WHERE "sku" = $c$CJGY198668701AZ$c$ AND "name" IS DISTINCT FROM $c$White$c$;
UPDATE "product_variants" SET "name" = $c$Light Blue$c$ WHERE "sku" = $c$CJGY198668702BY$c$ AND "name" IS DISTINCT FROM $c$Light Blue$c$;
UPDATE "product_variants" SET "name" = $c$Green$c$ WHERE "sku" = $c$CJGY198668703CX$c$ AND "name" IS DISTINCT FROM $c$Green$c$;
UPDATE "product_variants" SET "name" = $c$Dark Blue$c$ WHERE "sku" = $c$CJGY198668704DW$c$ AND "name" IS DISTINCT FROM $c$Dark Blue$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJBC242168501AZ$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$PINK$c$ WHERE "sku" = $c$CJBC301533301AZ$c$ AND "name" IS DISTINCT FROM $c$PINK$c$;
UPDATE "product_variants" SET "name" = $c$BLUE$c$ WHERE "sku" = $c$CJTR304737301AZ$c$ AND "name" IS DISTINCT FROM $c$BLUE$c$;
UPDATE "product_variants" SET "name" = $c$565$c$ WHERE "sku" = $c$CJTD300306801AZ$c$ AND "name" IS DISTINCT FROM $c$565$c$;
UPDATE "product_variants" SET "name" = $c$786$c$ WHERE "sku" = $c$CJTD300306802BY$c$ AND "name" IS DISTINCT FROM $c$786$c$;
UPDATE "product_variants" SET "name" = $c$1 box$c$ WHERE "sku" = $c$CJPS298540101AZ$c$ AND "name" IS DISTINCT FROM $c$1 box$c$;
UPDATE "product_variants" SET "name" = $c$BLACK$c$ WHERE "sku" = $c$CJPB310636101AZ$c$ AND "name" IS DISTINCT FROM $c$BLACK$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJSB238208601AZ$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$Black · 137x147$c$ WHERE "sku" = $c$CJYD315671501AZ$c$ AND "name" IS DISTINCT FROM $c$Black · 137x147$c$;
UPDATE "product_variants" SET "name" = $c$Orange Red · 137x147$c$ WHERE "sku" = $c$CJYD315671502BY$c$ AND "name" IS DISTINCT FROM $c$Orange Red · 137x147$c$;
UPDATE "product_variants" SET "name" = $c$Black 4p$c$ WHERE "sku" = $c$CJPG314458601AZ$c$ AND "name" IS DISTINCT FROM $c$Black 4p$c$;
UPDATE "product_variants" SET "name" = $c$White 4p$c$ WHERE "sku" = $c$CJPG314458602BY$c$ AND "name" IS DISTINCT FROM $c$White 4p$c$;
UPDATE "product_variants" SET "name" = $c$Black 6p$c$ WHERE "sku" = $c$CJPG314458603CX$c$ AND "name" IS DISTINCT FROM $c$Black 6p$c$;
UPDATE "product_variants" SET "name" = $c$White 6p$c$ WHERE "sku" = $c$CJPG314458604DW$c$ AND "name" IS DISTINCT FROM $c$White 6p$c$;
UPDATE "product_variants" SET "name" = $c$Black 8p$c$ WHERE "sku" = $c$CJPG314458605EV$c$ AND "name" IS DISTINCT FROM $c$Black 8p$c$;
UPDATE "product_variants" SET "name" = $c$White 8p$c$ WHERE "sku" = $c$CJPG314458606FU$c$ AND "name" IS DISTINCT FROM $c$White 8p$c$;
UPDATE "product_variants" SET "name" = $c$Multicolor$c$ WHERE "sku" = $c$CJSP233464401AZ$c$ AND "name" IS DISTINCT FROM $c$Multicolor$c$;
UPDATE "product_variants" SET "name" = $c$S$c$ WHERE "sku" = $c$CJSP301757001AZ$c$ AND "name" IS DISTINCT FROM $c$S$c$;
UPDATE "product_variants" SET "name" = $c$L$c$ WHERE "sku" = $c$CJSP301757002BY$c$ AND "name" IS DISTINCT FROM $c$L$c$;
UPDATE "product_variants" SET "name" = $c$Bright Red Single · 90x140cm$c$ WHERE "sku" = $c$CJYD218581801AZ$c$ AND "name" IS DISTINCT FROM $c$Bright Red Single · 90x140cm$c$;
UPDATE "product_variants" SET "name" = $c$Bright Red Double · 145x185cm$c$ WHERE "sku" = $c$CJYD218581802BY$c$ AND "name" IS DISTINCT FROM $c$Bright Red Double · 145x185cm$c$;
UPDATE "product_variants" SET "name" = $c$Bright Red Three People · 190x230cm$c$ WHERE "sku" = $c$CJYD218581803CX$c$ AND "name" IS DISTINCT FROM $c$Bright Red Three People · 190x230cm$c$;
UPDATE "product_variants" SET "name" = $c$Bright Red · 235x300cm For Four People$c$ WHERE "sku" = $c$CJYD218581804DW$c$ AND "name" IS DISTINCT FROM $c$Bright Red · 235x300cm For Four People$c$;
UPDATE "product_variants" SET "name" = $c$Advanced Yellow Single · 90x140cm$c$ WHERE "sku" = $c$CJYD218581805EV$c$ AND "name" IS DISTINCT FROM $c$Advanced Yellow Single · 90x140cm$c$;
UPDATE "product_variants" SET "name" = $c$Advanced Yellow Double · 145x185cm$c$ WHERE "sku" = $c$CJYD218581806FU$c$ AND "name" IS DISTINCT FROM $c$Advanced Yellow Double · 145x185cm$c$;
UPDATE "product_variants" SET "name" = $c$Advanced Yellow Three People · 190x230cm$c$ WHERE "sku" = $c$CJYD218581807GT$c$ AND "name" IS DISTINCT FROM $c$Advanced Yellow Three People · 190x230cm$c$;
UPDATE "product_variants" SET "name" = $c$Advanced Yellow · 235x300cm For Four People$c$ WHERE "sku" = $c$CJYD218581808HS$c$ AND "name" IS DISTINCT FROM $c$Advanced Yellow · 235x300cm For Four People$c$;
UPDATE "product_variants" SET "name" = $c$Black Single · 90x140cm$c$ WHERE "sku" = $c$CJYD218581809IR$c$ AND "name" IS DISTINCT FROM $c$Black Single · 90x140cm$c$;
UPDATE "product_variants" SET "name" = $c$Black Double · 145x185cm$c$ WHERE "sku" = $c$CJYD218581810JQ$c$ AND "name" IS DISTINCT FROM $c$Black Double · 145x185cm$c$;
UPDATE "product_variants" SET "name" = $c$Black Three People · 190x230cm$c$ WHERE "sku" = $c$CJYD218581811KP$c$ AND "name" IS DISTINCT FROM $c$Black Three People · 190x230cm$c$;
UPDATE "product_variants" SET "name" = $c$Black · 235x300cm For Four People$c$ WHERE "sku" = $c$CJYD218581812LO$c$ AND "name" IS DISTINCT FROM $c$Black · 235x300cm For Four People$c$;
UPDATE "product_variants" SET "name" = $c$Lake Blue Single · 90x140cm$c$ WHERE "sku" = $c$CJYD218581813MN$c$ AND "name" IS DISTINCT FROM $c$Lake Blue Single · 90x140cm$c$;
UPDATE "product_variants" SET "name" = $c$Lake Blue Double · 145x185cm$c$ WHERE "sku" = $c$CJYD218581814NM$c$ AND "name" IS DISTINCT FROM $c$Lake Blue Double · 145x185cm$c$;
UPDATE "product_variants" SET "name" = $c$Lake Blue Three People · 190x230cm$c$ WHERE "sku" = $c$CJYD218581815OL$c$ AND "name" IS DISTINCT FROM $c$Lake Blue Three People · 190x230cm$c$;
UPDATE "product_variants" SET "name" = $c$Lake Blue · 235x300cm For Four People$c$ WHERE "sku" = $c$CJYD218581816PK$c$ AND "name" IS DISTINCT FROM $c$Lake Blue · 235x300cm For Four People$c$;
UPDATE "product_variants" SET "name" = $c$Wine Red Single · 90x140cm$c$ WHERE "sku" = $c$CJYD218581817QJ$c$ AND "name" IS DISTINCT FROM $c$Wine Red Single · 90x140cm$c$;
UPDATE "product_variants" SET "name" = $c$Wine Red Double · 145x185cm$c$ WHERE "sku" = $c$CJYD218581818RI$c$ AND "name" IS DISTINCT FROM $c$Wine Red Double · 145x185cm$c$;
UPDATE "product_variants" SET "name" = $c$Wine Red Three People · 190x230cm$c$ WHERE "sku" = $c$CJYD218581819SH$c$ AND "name" IS DISTINCT FROM $c$Wine Red Three People · 190x230cm$c$;
UPDATE "product_variants" SET "name" = $c$Wine Red · 235x300cm For Four People$c$ WHERE "sku" = $c$CJYD218581820TG$c$ AND "name" IS DISTINCT FROM $c$Wine Red · 235x300cm For Four People$c$;
UPDATE "product_variants" SET "name" = $c$Beige$c$ WHERE "sku" = $c$CJTC31912980001$c$ AND "name" IS DISTINCT FROM $c$Beige$c$;
UPDATE "product_variants" SET "name" = $c$dark blue$c$ WHERE "sku" = $c$CJTC31912980002$c$ AND "name" IS DISTINCT FROM $c$dark blue$c$;
UPDATE "product_variants" SET "name" = $c$7018NATURAL$c$ WHERE "sku" = $c$CJFT31202950001$c$ AND "name" IS DISTINCT FROM $c$7018NATURAL$c$;
UPDATE "product_variants" SET "name" = $c$Standard$c$ WHERE "sku" = $c$CJHC31412920001$c$ AND "name" IS DISTINCT FROM $c$Standard$c$;
UPDATE "product_variants" SET "name" = $c$Natural Black$c$ WHERE "sku" = $c$CJDS273542501AZ$c$ AND "name" IS DISTINCT FROM $c$Natural Black$c$;
UPDATE "product_variants" SET "name" = $c$Blue$c$ WHERE "sku" = $c$CJPT247168501AZ$c$ AND "name" IS DISTINCT FROM $c$Blue$c$;
UPDATE "product_variants" SET "name" = $c$Pink$c$ WHERE "sku" = $c$CJPT247168502BY$c$ AND "name" IS DISTINCT FROM $c$Pink$c$;
UPDATE "product_variants" SET "name" = $c$Natural$c$ WHERE "sku" = $c$CJPH271603401AZ$c$ AND "name" IS DISTINCT FROM $c$Natural$c$;
UPDATE "product_variants" SET "name" = $c$BROWN$c$ WHERE "sku" = $c$CJPB304475101AZ$c$ AND "name" IS DISTINCT FROM $c$BROWN$c$;
UPDATE "product_variants" SET "name" = $c$as pic$c$ WHERE "sku" = $c$CJPB31718460001$c$ AND "name" IS DISTINCT FROM $c$as pic$c$;
UPDATE "product_variants" SET "name" = $c$Green$c$ WHERE "sku" = $c$CJDT321128801AZ$c$ AND "name" IS DISTINCT FROM $c$Green$c$;
UPDATE "product_variants" SET "name" = $c$Blue$c$ WHERE "sku" = $c$CJFT309227401AZ$c$ AND "name" IS DISTINCT FROM $c$Blue$c$;
UPDATE "product_variants" SET "name" = $c$US ZY 0Z$c$ WHERE "sku" = $c$CJFT260737401AZ$c$ AND "name" IS DISTINCT FROM $c$US ZY 0Z$c$;
UPDATE "product_variants" SET "name" = $c$European ZY OZ$c$ WHERE "sku" = $c$CJFT260737402BY$c$ AND "name" IS DISTINCT FROM $c$European ZY OZ$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJFT26169730001$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$Green$c$ WHERE "sku" = $c$CJTD295796801AZ$c$ AND "name" IS DISTINCT FROM $c$Green$c$;
UPDATE "product_variants" SET "name" = $c$L$c$ WHERE "sku" = $c$CJTC247155801AZ$c$ AND "name" IS DISTINCT FROM $c$L$c$;
UPDATE "product_variants" SET "name" = $c$PINK$c$ WHERE "sku" = $c$CJBT299981801AZ$c$ AND "name" IS DISTINCT FROM $c$PINK$c$;
UPDATE "product_variants" SET "name" = $c$Pink$c$ WHERE "sku" = $c$CJHA287579201AZ$c$ AND "name" IS DISTINCT FROM $c$Pink$c$;
UPDATE "product_variants" SET "name" = $c$Yellow$c$ WHERE "sku" = $c$CJHA287579202BY$c$ AND "name" IS DISTINCT FROM $c$Yellow$c$;
UPDATE "product_variants" SET "name" = $c$Brown$c$ WHERE "sku" = $c$CJHA287579203CX$c$ AND "name" IS DISTINCT FROM $c$Brown$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJHA287579204DW$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$Red$c$ WHERE "sku" = $c$CJHA287579205EV$c$ AND "name" IS DISTINCT FROM $c$Red$c$;
UPDATE "product_variants" SET "name" = $c$MULTICOLOR$c$ WHERE "sku" = $c$CJBT301531901AZ$c$ AND "name" IS DISTINCT FROM $c$MULTICOLOR$c$;
UPDATE "product_variants" SET "name" = $c$MULTICOLOR$c$ WHERE "sku" = $c$CJPN301534401AZ$c$ AND "name" IS DISTINCT FROM $c$MULTICOLOR$c$;
UPDATE "product_variants" SET "name" = $c$Black · S 12.5cm$c$ WHERE "sku" = $c$CJYD232813501AZ$c$ AND "name" IS DISTINCT FROM $c$Black · S 12.5cm$c$;
UPDATE "product_variants" SET "name" = $c$Black · M 14cm$c$ WHERE "sku" = $c$CJYD232813502BY$c$ AND "name" IS DISTINCT FROM $c$Black · M 14cm$c$;
UPDATE "product_variants" SET "name" = $c$Beige · S 12.5cm$c$ WHERE "sku" = $c$CJYD232813503CX$c$ AND "name" IS DISTINCT FROM $c$Beige · S 12.5cm$c$;
UPDATE "product_variants" SET "name" = $c$Beige · M 14cm$c$ WHERE "sku" = $c$CJYD232813504DW$c$ AND "name" IS DISTINCT FROM $c$Beige · M 14cm$c$;
UPDATE "product_variants" SET "name" = $c$Red · S 12.5cm$c$ WHERE "sku" = $c$CJYD232813505EV$c$ AND "name" IS DISTINCT FROM $c$Red · S 12.5cm$c$;
UPDATE "product_variants" SET "name" = $c$Red · M 14cm$c$ WHERE "sku" = $c$CJYD232813506FU$c$ AND "name" IS DISTINCT FROM $c$Red · M 14cm$c$;
UPDATE "product_variants" SET "name" = $c$Brown · S 12.5cm$c$ WHERE "sku" = $c$CJYD232813507GT$c$ AND "name" IS DISTINCT FROM $c$Brown · S 12.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 pack$c$ WHERE "sku" = $c$CJPG303385101AZ$c$ AND "name" IS DISTINCT FROM $c$1 pack$c$;
UPDATE "product_variants" SET "name" = $c$As shown$c$ WHERE "sku" = $c$CJPC32123670001$c$ AND "name" IS DISTINCT FROM $c$As shown$c$;
UPDATE "product_variants" SET "name" = $c$Fluorescent green-9M$c$ WHERE "sku" = $c$CJPL263165401AZ$c$ AND "name" IS DISTINCT FROM $c$Fluorescent green-9M$c$;
UPDATE "product_variants" SET "name" = $c$Navy blue-9M$c$ WHERE "sku" = $c$CJPL263165402BY$c$ AND "name" IS DISTINCT FROM $c$Navy blue-9M$c$;
UPDATE "product_variants" SET "name" = $c$Purple-9M$c$ WHERE "sku" = $c$CJPL263165403CX$c$ AND "name" IS DISTINCT FROM $c$Purple-9M$c$;
UPDATE "product_variants" SET "name" = $c$Bright yellow-9M$c$ WHERE "sku" = $c$CJPL263165404DW$c$ AND "name" IS DISTINCT FROM $c$Bright yellow-9M$c$;
UPDATE "product_variants" SET "name" = $c$Orange-9M$c$ WHERE "sku" = $c$CJPL263165405EV$c$ AND "name" IS DISTINCT FROM $c$Orange-9M$c$;
UPDATE "product_variants" SET "name" = $c$Pink-S$c$ WHERE "sku" = $c$CJPH240713901AZ$c$ AND "name" IS DISTINCT FROM $c$Pink-S$c$;
UPDATE "product_variants" SET "name" = $c$Pink-M$c$ WHERE "sku" = $c$CJPH240713902BY$c$ AND "name" IS DISTINCT FROM $c$Pink-M$c$;
UPDATE "product_variants" SET "name" = $c$Pink-L$c$ WHERE "sku" = $c$CJPH240713903CX$c$ AND "name" IS DISTINCT FROM $c$Pink-L$c$;
UPDATE "product_variants" SET "name" = $c$Pink-XL$c$ WHERE "sku" = $c$CJPH240713904DW$c$ AND "name" IS DISTINCT FROM $c$Pink-XL$c$;
UPDATE "product_variants" SET "name" = $c$Black-S$c$ WHERE "sku" = $c$CJPH240713905EV$c$ AND "name" IS DISTINCT FROM $c$Black-S$c$;
UPDATE "product_variants" SET "name" = $c$Black-M$c$ WHERE "sku" = $c$CJPH240713906FU$c$ AND "name" IS DISTINCT FROM $c$Black-M$c$;
UPDATE "product_variants" SET "name" = $c$Black-L$c$ WHERE "sku" = $c$CJPH240713907GT$c$ AND "name" IS DISTINCT FROM $c$Black-L$c$;
UPDATE "product_variants" SET "name" = $c$Black-XL$c$ WHERE "sku" = $c$CJPH240713908HS$c$ AND "name" IS DISTINCT FROM $c$Black-XL$c$;
UPDATE "product_variants" SET "name" = $c$Tan-S$c$ WHERE "sku" = $c$CJPH240713909IR$c$ AND "name" IS DISTINCT FROM $c$Tan-S$c$;
UPDATE "product_variants" SET "name" = $c$Tan-M$c$ WHERE "sku" = $c$CJPH240713910JQ$c$ AND "name" IS DISTINCT FROM $c$Tan-M$c$;
UPDATE "product_variants" SET "name" = $c$Tan-XL$c$ WHERE "sku" = $c$CJPH240713912LO$c$ AND "name" IS DISTINCT FROM $c$Tan-XL$c$;
UPDATE "product_variants" SET "name" = $c$GrayCamo-S$c$ WHERE "sku" = $c$CJPH240713913MN$c$ AND "name" IS DISTINCT FROM $c$GrayCamo-S$c$;
UPDATE "product_variants" SET "name" = $c$GrayCamo-M$c$ WHERE "sku" = $c$CJPH240713914NM$c$ AND "name" IS DISTINCT FROM $c$GrayCamo-M$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJYD249098601AZ$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$BLACK$c$ WHERE "sku" = $c$CJPC318500801AZ$c$ AND "name" IS DISTINCT FROM $c$BLACK$c$;
UPDATE "product_variants" SET "name" = $c$Red · XS$c$ WHERE "sku" = $c$CJGX195782401AZ$c$ AND "name" IS DISTINCT FROM $c$Red · XS$c$;
UPDATE "product_variants" SET "name" = $c$Red · S$c$ WHERE "sku" = $c$CJGX195782402BY$c$ AND "name" IS DISTINCT FROM $c$Red · S$c$;
UPDATE "product_variants" SET "name" = $c$Red · M$c$ WHERE "sku" = $c$CJGX195782403CX$c$ AND "name" IS DISTINCT FROM $c$Red · M$c$;
UPDATE "product_variants" SET "name" = $c$Red · L$c$ WHERE "sku" = $c$CJGX195782404DW$c$ AND "name" IS DISTINCT FROM $c$Red · L$c$;
UPDATE "product_variants" SET "name" = $c$Red · XL$c$ WHERE "sku" = $c$CJGX195782405EV$c$ AND "name" IS DISTINCT FROM $c$Red · XL$c$;
UPDATE "product_variants" SET "name" = $c$Grey · XS$c$ WHERE "sku" = $c$CJGX195782406FU$c$ AND "name" IS DISTINCT FROM $c$Grey · XS$c$;
UPDATE "product_variants" SET "name" = $c$Grey · S$c$ WHERE "sku" = $c$CJGX195782407GT$c$ AND "name" IS DISTINCT FROM $c$Grey · S$c$;
UPDATE "product_variants" SET "name" = $c$Grey · M$c$ WHERE "sku" = $c$CJGX195782408HS$c$ AND "name" IS DISTINCT FROM $c$Grey · M$c$;
UPDATE "product_variants" SET "name" = $c$Grey · L$c$ WHERE "sku" = $c$CJGX195782409IR$c$ AND "name" IS DISTINCT FROM $c$Grey · L$c$;
UPDATE "product_variants" SET "name" = $c$Grey · XL$c$ WHERE "sku" = $c$CJGX195782410JQ$c$ AND "name" IS DISTINCT FROM $c$Grey · XL$c$;
UPDATE "product_variants" SET "name" = $c$Green · XS$c$ WHERE "sku" = $c$CJGX195782411KP$c$ AND "name" IS DISTINCT FROM $c$Green · XS$c$;
UPDATE "product_variants" SET "name" = $c$Green · S$c$ WHERE "sku" = $c$CJGX195782412LO$c$ AND "name" IS DISTINCT FROM $c$Green · S$c$;
UPDATE "product_variants" SET "name" = $c$Green · M$c$ WHERE "sku" = $c$CJGX195782413MN$c$ AND "name" IS DISTINCT FROM $c$Green · M$c$;
UPDATE "product_variants" SET "name" = $c$Green · L$c$ WHERE "sku" = $c$CJGX195782414NM$c$ AND "name" IS DISTINCT FROM $c$Green · L$c$;
UPDATE "product_variants" SET "name" = $c$Green · XL$c$ WHERE "sku" = $c$CJGX195782415OL$c$ AND "name" IS DISTINCT FROM $c$Green · XL$c$;
UPDATE "product_variants" SET "name" = $c$Brown · XS$c$ WHERE "sku" = $c$CJGX195782416PK$c$ AND "name" IS DISTINCT FROM $c$Brown · XS$c$;
UPDATE "product_variants" SET "name" = $c$Brown · S$c$ WHERE "sku" = $c$CJGX195782417QJ$c$ AND "name" IS DISTINCT FROM $c$Brown · S$c$;
UPDATE "product_variants" SET "name" = $c$Brown · M$c$ WHERE "sku" = $c$CJGX195782418RI$c$ AND "name" IS DISTINCT FROM $c$Brown · M$c$;
UPDATE "product_variants" SET "name" = $c$Brown · L$c$ WHERE "sku" = $c$CJGX195782419SH$c$ AND "name" IS DISTINCT FROM $c$Brown · L$c$;
UPDATE "product_variants" SET "name" = $c$Brown · XL$c$ WHERE "sku" = $c$CJGX195782420TG$c$ AND "name" IS DISTINCT FROM $c$Brown · XL$c$;
UPDATE "product_variants" SET "name" = $c$Red$c$ WHERE "sku" = $c$CJCT252740101AZ$c$ AND "name" IS DISTINCT FROM $c$Red$c$;
UPDATE "product_variants" SET "name" = $c$BLACK$c$ WHERE "sku" = $c$CJCT300596201AZ$c$ AND "name" IS DISTINCT FROM $c$BLACK$c$;
UPDATE "product_variants" SET "name" = $c$5 pcs$c$ WHERE "sku" = $c$CJCT320907201AZ$c$ AND "name" IS DISTINCT FROM $c$5 pcs$c$;
UPDATE "product_variants" SET "name" = $c$S$c$ WHERE "sku" = $c$CJTE261992301AZ$c$ AND "name" IS DISTINCT FROM $c$S$c$;
UPDATE "product_variants" SET "name" = $c$L$c$ WHERE "sku" = $c$CJTE261992302BY$c$ AND "name" IS DISTINCT FROM $c$L$c$;
UPDATE "product_variants" SET "name" = $c$Blue$c$ WHERE "sku" = $c$CJYD282452201AZ$c$ AND "name" IS DISTINCT FROM $c$Blue$c$;
UPDATE "product_variants" SET "name" = $c$Oval PLUS$c$ WHERE "sku" = $c$CJYD295379201AZ$c$ AND "name" IS DISTINCT FROM $c$Oval PLUS$c$;
UPDATE "product_variants" SET "name" = $c$Other$c$ WHERE "sku" = $c$CJTS30243070001$c$ AND "name" IS DISTINCT FROM $c$Other$c$;
UPDATE "product_variants" SET "name" = $c$Red-L$c$ WHERE "sku" = $c$CJPT320622901AZ$c$ AND "name" IS DISTINCT FROM $c$Red-L$c$;
UPDATE "product_variants" SET "name" = $c$Red-S$c$ WHERE "sku" = $c$CJPT320622902BY$c$ AND "name" IS DISTINCT FROM $c$Red-S$c$;
UPDATE "product_variants" SET "name" = $c$Khaki-L$c$ WHERE "sku" = $c$CJPT320622903CX$c$ AND "name" IS DISTINCT FROM $c$Khaki-L$c$;
UPDATE "product_variants" SET "name" = $c$Khaki-S$c$ WHERE "sku" = $c$CJPT320622904DW$c$ AND "name" IS DISTINCT FROM $c$Khaki-S$c$;
UPDATE "product_variants" SET "name" = $c$White-L$c$ WHERE "sku" = $c$CJPT320622905EV$c$ AND "name" IS DISTINCT FROM $c$White-L$c$;
UPDATE "product_variants" SET "name" = $c$White-S$c$ WHERE "sku" = $c$CJPT320622906FU$c$ AND "name" IS DISTINCT FROM $c$White-S$c$;
UPDATE "product_variants" SET "name" = $c$GREY$c$ WHERE "sku" = $c$CJPM300595201AZ$c$ AND "name" IS DISTINCT FROM $c$GREY$c$;
UPDATE "product_variants" SET "name" = $c$Dark Gray$c$ WHERE "sku" = $c$CJPM309228001AZ$c$ AND "name" IS DISTINCT FROM $c$Dark Gray$c$;
UPDATE "product_variants" SET "name" = $c$Size 24L x 16W$c$ WHERE "sku" = $c$CJPM309228002BY$c$ AND "name" IS DISTINCT FROM $c$Size 24L x 16W$c$;
UPDATE "product_variants" SET "name" = $c$Size 27L x 17W$c$ WHERE "sku" = $c$CJPM309228003CX$c$ AND "name" IS DISTINCT FROM $c$Size 27L x 17W$c$;
UPDATE "product_variants" SET "name" = $c$Pink · 110cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Pink-110cm$c$ AND "name" IS DISTINCT FROM $c$Pink · 110cm$c$;
UPDATE "product_variants" SET "name" = $c$Green · 60cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Green-60cm$c$ AND "name" IS DISTINCT FROM $c$Green · 60cm$c$;
UPDATE "product_variants" SET "name" = $c$A green · 60cm$c$ WHERE "sku" = $c$CJJJCWMY00276-A green-60cm$c$ AND "name" IS DISTINCT FROM $c$A green · 60cm$c$;
UPDATE "product_variants" SET "name" = $c$Red · 120cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Red-120cm$c$ AND "name" IS DISTINCT FROM $c$Red · 120cm$c$;
UPDATE "product_variants" SET "name" = $c$Light coffee · 50cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Light coffee-50cm$c$ AND "name" IS DISTINCT FROM $c$Light coffee · 50cm$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · 60cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Apricot-60cm$c$ AND "name" IS DISTINCT FROM $c$Apricot · 60cm$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · 70cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Apricot-70cm$c$ AND "name" IS DISTINCT FROM $c$Apricot · 70cm$c$;
UPDATE "product_variants" SET "name" = $c$Rice pink · 60cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Rice pink-60cm$c$ AND "name" IS DISTINCT FROM $c$Rice pink · 60cm$c$;
UPDATE "product_variants" SET "name" = $c$Green · 100cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Green-100cm$c$ AND "name" IS DISTINCT FROM $c$Green · 100cm$c$;
UPDATE "product_variants" SET "name" = $c$Beige brown · 60cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Beige brown-60cm$c$ AND "name" IS DISTINCT FROM $c$Beige brown · 60cm$c$;
UPDATE "product_variants" SET "name" = $c$A green · 70cm$c$ WHERE "sku" = $c$CJJJCWMY00276-A green-70cm$c$ AND "name" IS DISTINCT FROM $c$A green · 70cm$c$;
UPDATE "product_variants" SET "name" = $c$Light coffee · 80cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Light coffee-80cm$c$ AND "name" IS DISTINCT FROM $c$Light coffee · 80cm$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · 120cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Apricot-120cm$c$ AND "name" IS DISTINCT FROM $c$Apricot · 120cm$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · 50cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Apricot-50cm$c$ AND "name" IS DISTINCT FROM $c$Apricot · 50cm$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · 100cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Apricot-100cm$c$ AND "name" IS DISTINCT FROM $c$Apricot · 100cm$c$;
UPDATE "product_variants" SET "name" = $c$Rubber color · 70cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Rubber color-70cm$c$ AND "name" IS DISTINCT FROM $c$Rubber color · 70cm$c$;
UPDATE "product_variants" SET "name" = $c$Red · 70cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Red-70cm$c$ AND "name" IS DISTINCT FROM $c$Red · 70cm$c$;
UPDATE "product_variants" SET "name" = $c$Beige brown · 80cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Beige brown-80cm$c$ AND "name" IS DISTINCT FROM $c$Beige brown · 80cm$c$;
UPDATE "product_variants" SET "name" = $c$Gradient coffee · 100cm$c$ WHERE "sku" = $c$CJJJCWMY00276-Gradient coffee-100cm$c$ AND "name" IS DISTINCT FROM $c$Gradient coffee · 100cm$c$;
UPDATE "product_variants" SET "name" = $c$DarkBrown · 80cm$c$ WHERE "sku" = $c$CJJJCWMY00276-DarkBrown-80cm$c$ AND "name" IS DISTINCT FROM $c$DarkBrown · 80cm$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJPB296312301AZ$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$White$c$ WHERE "sku" = $c$CJBQ302242701AZ$c$ AND "name" IS DISTINCT FROM $c$White$c$;
UPDATE "product_variants" SET "name" = $c$Red · S$c$ WHERE "sku" = $c$CJYD229170401AZ$c$ AND "name" IS DISTINCT FROM $c$Red · S$c$;
UPDATE "product_variants" SET "name" = $c$Red · M$c$ WHERE "sku" = $c$CJYD229170402BY$c$ AND "name" IS DISTINCT FROM $c$Red · M$c$;
UPDATE "product_variants" SET "name" = $c$Red · L$c$ WHERE "sku" = $c$CJYD229170403CX$c$ AND "name" IS DISTINCT FROM $c$Red · L$c$;
UPDATE "product_variants" SET "name" = $c$Red · XL$c$ WHERE "sku" = $c$CJYD229170404DW$c$ AND "name" IS DISTINCT FROM $c$Red · XL$c$;
UPDATE "product_variants" SET "name" = $c$Red · XXL$c$ WHERE "sku" = $c$CJYD229170405EV$c$ AND "name" IS DISTINCT FROM $c$Red · XXL$c$;
UPDATE "product_variants" SET "name" = $c$Blue · S$c$ WHERE "sku" = $c$CJYD229170406FU$c$ AND "name" IS DISTINCT FROM $c$Blue · S$c$;
UPDATE "product_variants" SET "name" = $c$Blue · M$c$ WHERE "sku" = $c$CJYD229170407GT$c$ AND "name" IS DISTINCT FROM $c$Blue · M$c$;
UPDATE "product_variants" SET "name" = $c$Blue · L$c$ WHERE "sku" = $c$CJYD229170408HS$c$ AND "name" IS DISTINCT FROM $c$Blue · L$c$;
UPDATE "product_variants" SET "name" = $c$Blue · XL$c$ WHERE "sku" = $c$CJYD229170409IR$c$ AND "name" IS DISTINCT FROM $c$Blue · XL$c$;
UPDATE "product_variants" SET "name" = $c$Blue · XXL$c$ WHERE "sku" = $c$CJYD229170410JQ$c$ AND "name" IS DISTINCT FROM $c$Blue · XXL$c$;
UPDATE "product_variants" SET "name" = $c$Black · S$c$ WHERE "sku" = $c$CJYD229170411KP$c$ AND "name" IS DISTINCT FROM $c$Black · S$c$;
UPDATE "product_variants" SET "name" = $c$Black · M$c$ WHERE "sku" = $c$CJYD229170412LO$c$ AND "name" IS DISTINCT FROM $c$Black · M$c$;
UPDATE "product_variants" SET "name" = $c$Black · L$c$ WHERE "sku" = $c$CJYD229170413MN$c$ AND "name" IS DISTINCT FROM $c$Black · L$c$;
UPDATE "product_variants" SET "name" = $c$Black · XL$c$ WHERE "sku" = $c$CJYD229170414NM$c$ AND "name" IS DISTINCT FROM $c$Black · XL$c$;
UPDATE "product_variants" SET "name" = $c$Black · XXL$c$ WHERE "sku" = $c$CJYD229170415OL$c$ AND "name" IS DISTINCT FROM $c$Black · XXL$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · S$c$ WHERE "sku" = $c$CJYD229170416PK$c$ AND "name" IS DISTINCT FROM $c$Khaki · S$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · M$c$ WHERE "sku" = $c$CJYD229170417QJ$c$ AND "name" IS DISTINCT FROM $c$Khaki · M$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · L$c$ WHERE "sku" = $c$CJYD229170418RI$c$ AND "name" IS DISTINCT FROM $c$Khaki · L$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · XL$c$ WHERE "sku" = $c$CJYD229170419SH$c$ AND "name" IS DISTINCT FROM $c$Khaki · XL$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · XXL$c$ WHERE "sku" = $c$CJYD229170420TG$c$ AND "name" IS DISTINCT FROM $c$Khaki · XXL$c$;
UPDATE "product_variants" SET "name" = $c$Round neck gray plaid · S$c$ WHERE "sku" = $c$CJYD272572906FU$c$ AND "name" IS DISTINCT FROM $c$Round neck gray plaid · S$c$;
UPDATE "product_variants" SET "name" = $c$Round neck gray plaid · M$c$ WHERE "sku" = $c$CJYD272572907GT$c$ AND "name" IS DISTINCT FROM $c$Round neck gray plaid · M$c$;
UPDATE "product_variants" SET "name" = $c$Round neck gray plaid · L$c$ WHERE "sku" = $c$CJYD272572908HS$c$ AND "name" IS DISTINCT FROM $c$Round neck gray plaid · L$c$;
UPDATE "product_variants" SET "name" = $c$Round neck gray plaid · XL$c$ WHERE "sku" = $c$CJYD272572909IR$c$ AND "name" IS DISTINCT FROM $c$Round neck gray plaid · XL$c$;
UPDATE "product_variants" SET "name" = $c$Round neck gray plaid · XXL$c$ WHERE "sku" = $c$CJYD272572910JQ$c$ AND "name" IS DISTINCT FROM $c$Round neck gray plaid · XXL$c$;
UPDATE "product_variants" SET "name" = $c$Chrysanthemum · XS$c$ WHERE "sku" = $c$CJYD264166601AZ$c$ AND "name" IS DISTINCT FROM $c$Chrysanthemum · XS$c$;
UPDATE "product_variants" SET "name" = $c$Chrysanthemum · S$c$ WHERE "sku" = $c$CJYD264166602BY$c$ AND "name" IS DISTINCT FROM $c$Chrysanthemum · S$c$;
UPDATE "product_variants" SET "name" = $c$Chrysanthemum · M$c$ WHERE "sku" = $c$CJYD264166603CX$c$ AND "name" IS DISTINCT FROM $c$Chrysanthemum · M$c$;
UPDATE "product_variants" SET "name" = $c$Chrysanthemum · L$c$ WHERE "sku" = $c$CJYD264166604DW$c$ AND "name" IS DISTINCT FROM $c$Chrysanthemum · L$c$;
UPDATE "product_variants" SET "name" = $c$Chrysanthemum · XL$c$ WHERE "sku" = $c$CJYD264166605EV$c$ AND "name" IS DISTINCT FROM $c$Chrysanthemum · XL$c$;
UPDATE "product_variants" SET "name" = $c$Chrysanthemum · 2XL$c$ WHERE "sku" = $c$CJYD264166606FU$c$ AND "name" IS DISTINCT FROM $c$Chrysanthemum · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Sky Blue Collar · XS$c$ WHERE "sku" = $c$CJYD264166607GT$c$ AND "name" IS DISTINCT FROM $c$Sky Blue Collar · XS$c$;
UPDATE "product_variants" SET "name" = $c$Sky Blue Collar · S$c$ WHERE "sku" = $c$CJYD264166608HS$c$ AND "name" IS DISTINCT FROM $c$Sky Blue Collar · S$c$;
UPDATE "product_variants" SET "name" = $c$Sky Blue Collar · M$c$ WHERE "sku" = $c$CJYD264166609IR$c$ AND "name" IS DISTINCT FROM $c$Sky Blue Collar · M$c$;
UPDATE "product_variants" SET "name" = $c$Sky Blue Collar · L$c$ WHERE "sku" = $c$CJYD264166610JQ$c$ AND "name" IS DISTINCT FROM $c$Sky Blue Collar · L$c$;
UPDATE "product_variants" SET "name" = $c$Sky Blue Collar · XL$c$ WHERE "sku" = $c$CJYD264166611KP$c$ AND "name" IS DISTINCT FROM $c$Sky Blue Collar · XL$c$;
UPDATE "product_variants" SET "name" = $c$Sky Blue Collar · 2XL$c$ WHERE "sku" = $c$CJYD264166612LO$c$ AND "name" IS DISTINCT FROM $c$Sky Blue Collar · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Mohair · XS$c$ WHERE "sku" = $c$CJYD264166613MN$c$ AND "name" IS DISTINCT FROM $c$Mohair · XS$c$;
UPDATE "product_variants" SET "name" = $c$Mohair · S$c$ WHERE "sku" = $c$CJYD264166614NM$c$ AND "name" IS DISTINCT FROM $c$Mohair · S$c$;
UPDATE "product_variants" SET "name" = $c$Mohair · M$c$ WHERE "sku" = $c$CJYD264166615OL$c$ AND "name" IS DISTINCT FROM $c$Mohair · M$c$;
UPDATE "product_variants" SET "name" = $c$Mohair · L$c$ WHERE "sku" = $c$CJYD264166616PK$c$ AND "name" IS DISTINCT FROM $c$Mohair · L$c$;
UPDATE "product_variants" SET "name" = $c$Mohair · XL$c$ WHERE "sku" = $c$CJYD264166617QJ$c$ AND "name" IS DISTINCT FROM $c$Mohair · XL$c$;
UPDATE "product_variants" SET "name" = $c$Mohair · 2XL$c$ WHERE "sku" = $c$CJYD264166618RI$c$ AND "name" IS DISTINCT FROM $c$Mohair · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$3XL Blue$c$ WHERE "sku" = $c$CJYD275073101AZ$c$ AND "name" IS DISTINCT FROM $c$3XL Blue$c$;
UPDATE "product_variants" SET "name" = $c$3XL Coffee Color$c$ WHERE "sku" = $c$CJYD275073102BY$c$ AND "name" IS DISTINCT FROM $c$3XL Coffee Color$c$;
UPDATE "product_variants" SET "name" = $c$4XL Blue$c$ WHERE "sku" = $c$CJYD275073103CX$c$ AND "name" IS DISTINCT FROM $c$4XL Blue$c$;
UPDATE "product_variants" SET "name" = $c$4XL Coffee Color$c$ WHERE "sku" = $c$CJYD275073104DW$c$ AND "name" IS DISTINCT FROM $c$4XL Coffee Color$c$;
UPDATE "product_variants" SET "name" = $c$5XL Blue$c$ WHERE "sku" = $c$CJYD275073105EV$c$ AND "name" IS DISTINCT FROM $c$5XL Blue$c$;
UPDATE "product_variants" SET "name" = $c$5XL Coffee Color$c$ WHERE "sku" = $c$CJYD275073106FU$c$ AND "name" IS DISTINCT FROM $c$5XL Coffee Color$c$;
UPDATE "product_variants" SET "name" = $c$6XL Blue$c$ WHERE "sku" = $c$CJYD275073107GT$c$ AND "name" IS DISTINCT FROM $c$6XL Blue$c$;
UPDATE "product_variants" SET "name" = $c$6XL Coffee Color$c$ WHERE "sku" = $c$CJYD275073108HS$c$ AND "name" IS DISTINCT FROM $c$6XL Coffee Color$c$;
UPDATE "product_variants" SET "name" = $c$7XL Blue$c$ WHERE "sku" = $c$CJYD275073109IR$c$ AND "name" IS DISTINCT FROM $c$7XL Blue$c$;
UPDATE "product_variants" SET "name" = $c$7XL Coffee Color$c$ WHERE "sku" = $c$CJYD275073110JQ$c$ AND "name" IS DISTINCT FROM $c$7XL Coffee Color$c$;
UPDATE "product_variants" SET "name" = $c$Heather Gray · XXS$c$ WHERE "sku" = $c$CJGD208667401AZ$c$ AND "name" IS DISTINCT FROM $c$Heather Gray · XXS$c$;
UPDATE "product_variants" SET "name" = $c$Heather Gray · XS$c$ WHERE "sku" = $c$CJGD208667402BY$c$ AND "name" IS DISTINCT FROM $c$Heather Gray · XS$c$;
UPDATE "product_variants" SET "name" = $c$Heather Gray · S$c$ WHERE "sku" = $c$CJGD208667403CX$c$ AND "name" IS DISTINCT FROM $c$Heather Gray · S$c$;
UPDATE "product_variants" SET "name" = $c$Heather Gray · M$c$ WHERE "sku" = $c$CJGD208667404DW$c$ AND "name" IS DISTINCT FROM $c$Heather Gray · M$c$;
UPDATE "product_variants" SET "name" = $c$Heather Gray · L$c$ WHERE "sku" = $c$CJGD208667405EV$c$ AND "name" IS DISTINCT FROM $c$Heather Gray · L$c$;
UPDATE "product_variants" SET "name" = $c$Heather Gray · XL$c$ WHERE "sku" = $c$CJGD208667406FU$c$ AND "name" IS DISTINCT FROM $c$Heather Gray · XL$c$;
UPDATE "product_variants" SET "name" = $c$Heather Gray · XXL$c$ WHERE "sku" = $c$CJGD208667407GT$c$ AND "name" IS DISTINCT FROM $c$Heather Gray · XXL$c$;
UPDATE "product_variants" SET "name" = $c$Color Mixing · XS$c$ WHERE "sku" = $c$CJYD222568001AZ$c$ AND "name" IS DISTINCT FROM $c$Color Mixing · XS$c$;
UPDATE "product_variants" SET "name" = $c$Color Mixing · S$c$ WHERE "sku" = $c$CJYD222568002BY$c$ AND "name" IS DISTINCT FROM $c$Color Mixing · S$c$;
UPDATE "product_variants" SET "name" = $c$Color Mixing · M$c$ WHERE "sku" = $c$CJYD222568003CX$c$ AND "name" IS DISTINCT FROM $c$Color Mixing · M$c$;
UPDATE "product_variants" SET "name" = $c$Color Mixing · L$c$ WHERE "sku" = $c$CJYD222568004DW$c$ AND "name" IS DISTINCT FROM $c$Color Mixing · L$c$;
UPDATE "product_variants" SET "name" = $c$Color Mixing · XL$c$ WHERE "sku" = $c$CJYD222568005EV$c$ AND "name" IS DISTINCT FROM $c$Color Mixing · XL$c$;
UPDATE "product_variants" SET "name" = $c$Dark Blue · XS$c$ WHERE "sku" = $c$CJYD222568006FU$c$ AND "name" IS DISTINCT FROM $c$Dark Blue · XS$c$;
UPDATE "product_variants" SET "name" = $c$Dark Blue · S$c$ WHERE "sku" = $c$CJYD222568007GT$c$ AND "name" IS DISTINCT FROM $c$Dark Blue · S$c$;
UPDATE "product_variants" SET "name" = $c$Dark Blue · M$c$ WHERE "sku" = $c$CJYD222568008HS$c$ AND "name" IS DISTINCT FROM $c$Dark Blue · M$c$;
UPDATE "product_variants" SET "name" = $c$Dark Blue · L$c$ WHERE "sku" = $c$CJYD222568009IR$c$ AND "name" IS DISTINCT FROM $c$Dark Blue · L$c$;
UPDATE "product_variants" SET "name" = $c$Dark Blue · XL$c$ WHERE "sku" = $c$CJYD222568010JQ$c$ AND "name" IS DISTINCT FROM $c$Dark Blue · XL$c$;
UPDATE "product_variants" SET "name" = $c$Yellow · XS$c$ WHERE "sku" = $c$CJYD222568011KP$c$ AND "name" IS DISTINCT FROM $c$Yellow · XS$c$;
UPDATE "product_variants" SET "name" = $c$Yellow · S$c$ WHERE "sku" = $c$CJYD222568012LO$c$ AND "name" IS DISTINCT FROM $c$Yellow · S$c$;
UPDATE "product_variants" SET "name" = $c$Yellow · M$c$ WHERE "sku" = $c$CJYD222568013MN$c$ AND "name" IS DISTINCT FROM $c$Yellow · M$c$;
UPDATE "product_variants" SET "name" = $c$Yellow · L$c$ WHERE "sku" = $c$CJYD222568014NM$c$ AND "name" IS DISTINCT FROM $c$Yellow · L$c$;
UPDATE "product_variants" SET "name" = $c$Yellow · XL$c$ WHERE "sku" = $c$CJYD222568015OL$c$ AND "name" IS DISTINCT FROM $c$Yellow · XL$c$;
UPDATE "product_variants" SET "name" = $c$Navy Blue Bow · 26$c$ WHERE "sku" = $c$CJGD206972801AZ$c$ AND "name" IS DISTINCT FROM $c$Navy Blue Bow · 26$c$;
UPDATE "product_variants" SET "name" = $c$Navy Blue Bow · 28 Yards$c$ WHERE "sku" = $c$CJGD206972802BY$c$ AND "name" IS DISTINCT FROM $c$Navy Blue Bow · 28 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Navy Blue Bow · 30$c$ WHERE "sku" = $c$CJGD206972803CX$c$ AND "name" IS DISTINCT FROM $c$Navy Blue Bow · 30$c$;
UPDATE "product_variants" SET "name" = $c$Navy Blue Bow · 32 Yards$c$ WHERE "sku" = $c$CJGD206972804DW$c$ AND "name" IS DISTINCT FROM $c$Navy Blue Bow · 32 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Navy Blue Bow · 34 Yards$c$ WHERE "sku" = $c$CJGD206972805EV$c$ AND "name" IS DISTINCT FROM $c$Navy Blue Bow · 34 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Navy Blue Bow · 36 Yards$c$ WHERE "sku" = $c$CJGD206972806FU$c$ AND "name" IS DISTINCT FROM $c$Navy Blue Bow · 36 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Navy Blue Bow · 38 Yards$c$ WHERE "sku" = $c$CJGD206972807GT$c$ AND "name" IS DISTINCT FROM $c$Navy Blue Bow · 38 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Orange Bow · 26$c$ WHERE "sku" = $c$CJGD206972808HS$c$ AND "name" IS DISTINCT FROM $c$Orange Bow · 26$c$;
UPDATE "product_variants" SET "name" = $c$Orange Bow · 28 Yards$c$ WHERE "sku" = $c$CJGD206972809IR$c$ AND "name" IS DISTINCT FROM $c$Orange Bow · 28 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Orange Bow · 30$c$ WHERE "sku" = $c$CJGD206972810JQ$c$ AND "name" IS DISTINCT FROM $c$Orange Bow · 30$c$;
UPDATE "product_variants" SET "name" = $c$Orange Bow · 32 Yards$c$ WHERE "sku" = $c$CJGD206972811KP$c$ AND "name" IS DISTINCT FROM $c$Orange Bow · 32 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Orange Bow · 34 Yards$c$ WHERE "sku" = $c$CJGD206972812LO$c$ AND "name" IS DISTINCT FROM $c$Orange Bow · 34 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Orange Bow · 36 Yards$c$ WHERE "sku" = $c$CJGD206972813MN$c$ AND "name" IS DISTINCT FROM $c$Orange Bow · 36 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Orange Bow · 38 Yards$c$ WHERE "sku" = $c$CJGD206972814NM$c$ AND "name" IS DISTINCT FROM $c$Orange Bow · 38 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Leopard Bow · 26$c$ WHERE "sku" = $c$CJGD206972815OL$c$ AND "name" IS DISTINCT FROM $c$Leopard Bow · 26$c$;
UPDATE "product_variants" SET "name" = $c$Leopard Bow · 28 Yards$c$ WHERE "sku" = $c$CJGD206972816PK$c$ AND "name" IS DISTINCT FROM $c$Leopard Bow · 28 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Leopard Bow · 30$c$ WHERE "sku" = $c$CJGD206972817QJ$c$ AND "name" IS DISTINCT FROM $c$Leopard Bow · 30$c$;
UPDATE "product_variants" SET "name" = $c$Leopard Bow · 32 Yards$c$ WHERE "sku" = $c$CJGD206972818RI$c$ AND "name" IS DISTINCT FROM $c$Leopard Bow · 32 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Leopard Bow · 34 Yards$c$ WHERE "sku" = $c$CJGD206972819SH$c$ AND "name" IS DISTINCT FROM $c$Leopard Bow · 34 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Leopard Bow · 36 Yards$c$ WHERE "sku" = $c$CJGD206972820TG$c$ AND "name" IS DISTINCT FROM $c$Leopard Bow · 36 Yards$c$;
UPDATE "product_variants" SET "name" = $c$Brown · XS$c$ WHERE "sku" = $c$CJGD198241201AZ$c$ AND "name" IS DISTINCT FROM $c$Brown · XS$c$;
UPDATE "product_variants" SET "name" = $c$Brown · S$c$ WHERE "sku" = $c$CJGD198241202BY$c$ AND "name" IS DISTINCT FROM $c$Brown · S$c$;
UPDATE "product_variants" SET "name" = $c$Brown · M$c$ WHERE "sku" = $c$CJGD198241203CX$c$ AND "name" IS DISTINCT FROM $c$Brown · M$c$;
UPDATE "product_variants" SET "name" = $c$Brown · L$c$ WHERE "sku" = $c$CJGD198241204DW$c$ AND "name" IS DISTINCT FROM $c$Brown · L$c$;
UPDATE "product_variants" SET "name" = $c$Brown · XL$c$ WHERE "sku" = $c$CJGD198241205EV$c$ AND "name" IS DISTINCT FROM $c$Brown · XL$c$;
UPDATE "product_variants" SET "name" = $c$Brown · 2XL$c$ WHERE "sku" = $c$CJGD198241206FU$c$ AND "name" IS DISTINCT FROM $c$Brown · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Brown · 3XL$c$ WHERE "sku" = $c$CJGD198241207GT$c$ AND "name" IS DISTINCT FROM $c$Brown · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · XS$c$ WHERE "sku" = $c$CJGD198241208HS$c$ AND "name" IS DISTINCT FROM $c$Apricot · XS$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · S$c$ WHERE "sku" = $c$CJGD198241209IR$c$ AND "name" IS DISTINCT FROM $c$Apricot · S$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · M$c$ WHERE "sku" = $c$CJGD198241210JQ$c$ AND "name" IS DISTINCT FROM $c$Apricot · M$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · L$c$ WHERE "sku" = $c$CJGD198241211KP$c$ AND "name" IS DISTINCT FROM $c$Apricot · L$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · XL$c$ WHERE "sku" = $c$CJGD198241212LO$c$ AND "name" IS DISTINCT FROM $c$Apricot · XL$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · 2XL$c$ WHERE "sku" = $c$CJGD198241213MN$c$ AND "name" IS DISTINCT FROM $c$Apricot · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Apricot · 3XL$c$ WHERE "sku" = $c$CJGD198241214NM$c$ AND "name" IS DISTINCT FROM $c$Apricot · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Suit · 2XL$c$ WHERE "sku" = $c$CJGD198241215OL$c$ AND "name" IS DISTINCT FROM $c$Suit · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Suit · 3XL$c$ WHERE "sku" = $c$CJGD198241216PK$c$ AND "name" IS DISTINCT FROM $c$Suit · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Suit · L$c$ WHERE "sku" = $c$CJGD198241217QJ$c$ AND "name" IS DISTINCT FROM $c$Suit · L$c$;
UPDATE "product_variants" SET "name" = $c$Suit · M$c$ WHERE "sku" = $c$CJGD198241218RI$c$ AND "name" IS DISTINCT FROM $c$Suit · M$c$;
UPDATE "product_variants" SET "name" = $c$Suit · S$c$ WHERE "sku" = $c$CJGD198241219SH$c$ AND "name" IS DISTINCT FROM $c$Suit · S$c$;
UPDATE "product_variants" SET "name" = $c$Suit · XL$c$ WHERE "sku" = $c$CJGD198241220TG$c$ AND "name" IS DISTINCT FROM $c$Suit · XL$c$;
UPDATE "product_variants" SET "name" = $c$Black · L$c$ WHERE "sku" = $c$CJYD276638802BY$c$ AND "name" IS DISTINCT FROM $c$Black · L$c$;
UPDATE "product_variants" SET "name" = $c$Black · M$c$ WHERE "sku" = $c$CJYD276638803CX$c$ AND "name" IS DISTINCT FROM $c$Black · M$c$;
UPDATE "product_variants" SET "name" = $c$Black · XL$c$ WHERE "sku" = $c$CJYD276638804DW$c$ AND "name" IS DISTINCT FROM $c$Black · XL$c$;
UPDATE "product_variants" SET "name" = $c$Black With 1.5m Leash · L$c$ WHERE "sku" = $c$CJYD276638805EV$c$ AND "name" IS DISTINCT FROM $c$Black With 1.5m Leash · L$c$;
UPDATE "product_variants" SET "name" = $c$Black With 1.5m Leash · M$c$ WHERE "sku" = $c$CJYD276638806FU$c$ AND "name" IS DISTINCT FROM $c$Black With 1.5m Leash · M$c$;
UPDATE "product_variants" SET "name" = $c$Black With 1.5m Leash · XL$c$ WHERE "sku" = $c$CJYD276638807GT$c$ AND "name" IS DISTINCT FROM $c$Black With 1.5m Leash · XL$c$;
UPDATE "product_variants" SET "name" = $c$Clothes Suit$c$ WHERE "sku" = $c$CJYD316565101AZ$c$ AND "name" IS DISTINCT FROM $c$Clothes Suit$c$;
UPDATE "product_variants" SET "name" = $c$Melon Red · S$c$ WHERE "sku" = $c$CJYD229333301AZ$c$ AND "name" IS DISTINCT FROM $c$Melon Red · S$c$;
UPDATE "product_variants" SET "name" = $c$Melon Red · M$c$ WHERE "sku" = $c$CJYD229333302BY$c$ AND "name" IS DISTINCT FROM $c$Melon Red · M$c$;
UPDATE "product_variants" SET "name" = $c$Melon Red · XL$c$ WHERE "sku" = $c$CJYD229333303CX$c$ AND "name" IS DISTINCT FROM $c$Melon Red · XL$c$;
UPDATE "product_variants" SET "name" = $c$Melon Red · 2XL$c$ WHERE "sku" = $c$CJYD229333304DW$c$ AND "name" IS DISTINCT FROM $c$Melon Red · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Melon Red · 3XL$c$ WHERE "sku" = $c$CJYD229333305EV$c$ AND "name" IS DISTINCT FROM $c$Melon Red · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · S$c$ WHERE "sku" = $c$CJYD229333306FU$c$ AND "name" IS DISTINCT FROM $c$Khaki · S$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · M$c$ WHERE "sku" = $c$CJYD229333307GT$c$ AND "name" IS DISTINCT FROM $c$Khaki · M$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · L$c$ WHERE "sku" = $c$CJYD229333308HS$c$ AND "name" IS DISTINCT FROM $c$Khaki · L$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · XL$c$ WHERE "sku" = $c$CJYD229333309IR$c$ AND "name" IS DISTINCT FROM $c$Khaki · XL$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · 2XL$c$ WHERE "sku" = $c$CJYD229333310JQ$c$ AND "name" IS DISTINCT FROM $c$Khaki · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Khaki · 3XL$c$ WHERE "sku" = $c$CJYD229333311KP$c$ AND "name" IS DISTINCT FROM $c$Khaki · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Mustard Green · S$c$ WHERE "sku" = $c$CJYD229333312LO$c$ AND "name" IS DISTINCT FROM $c$Mustard Green · S$c$;
UPDATE "product_variants" SET "name" = $c$Mustard Green · M$c$ WHERE "sku" = $c$CJYD229333313MN$c$ AND "name" IS DISTINCT FROM $c$Mustard Green · M$c$;
UPDATE "product_variants" SET "name" = $c$Mustard Green · L$c$ WHERE "sku" = $c$CJYD229333314NM$c$ AND "name" IS DISTINCT FROM $c$Mustard Green · L$c$;
UPDATE "product_variants" SET "name" = $c$Mustard Green · XL$c$ WHERE "sku" = $c$CJYD229333315OL$c$ AND "name" IS DISTINCT FROM $c$Mustard Green · XL$c$;
UPDATE "product_variants" SET "name" = $c$Mustard Green · 2XL$c$ WHERE "sku" = $c$CJYD229333316PK$c$ AND "name" IS DISTINCT FROM $c$Mustard Green · 2XL$c$;
UPDATE "product_variants" SET "name" = $c$Mustard Green · 3XL$c$ WHERE "sku" = $c$CJYD229333317QJ$c$ AND "name" IS DISTINCT FROM $c$Mustard Green · 3XL$c$;
UPDATE "product_variants" SET "name" = $c$Black No1$c$ WHERE "sku" = $c$CJJJCWGD00138-Black-No1$c$ AND "name" IS DISTINCT FROM $c$Black No1$c$;
UPDATE "product_variants" SET "name" = $c$Black No7$c$ WHERE "sku" = $c$CJJJCWGD00138-Black-No7$c$ AND "name" IS DISTINCT FROM $c$Black No7$c$;
UPDATE "product_variants" SET "name" = $c$Black No8$c$ WHERE "sku" = $c$CJJJCWGD00138-Black-No8$c$ AND "name" IS DISTINCT FROM $c$Black No8$c$;
UPDATE "product_variants" SET "name" = $c$black · 4$c$ WHERE "sku" = $c$CJJJCWGD00138-black-4$c$ AND "name" IS DISTINCT FROM $c$black · 4$c$;
UPDATE "product_variants" SET "name" = $c$black · 5$c$ WHERE "sku" = $c$CJJJCWGD00138-black-5$c$ AND "name" IS DISTINCT FROM $c$black · 5$c$;
UPDATE "product_variants" SET "name" = $c$black · 2$c$ WHERE "sku" = $c$CJJJCWGD00138-black-2$c$ AND "name" IS DISTINCT FROM $c$black · 2$c$;
UPDATE "product_variants" SET "name" = $c$black · 6$c$ WHERE "sku" = $c$CJJJCWGD00138-black-6$c$ AND "name" IS DISTINCT FROM $c$black · 6$c$;
UPDATE "product_variants" SET "name" = $c$black · 3$c$ WHERE "sku" = $c$CJJJCWGD00138-black-3$c$ AND "name" IS DISTINCT FROM $c$black · 3$c$;
UPDATE "product_variants" SET "name" = $c$Red L$c$ WHERE "sku" = $c$CJPS263153801AZ$c$ AND "name" IS DISTINCT FROM $c$Red L$c$;
UPDATE "product_variants" SET "name" = $c$Blue L$c$ WHERE "sku" = $c$CJPS263153802BY$c$ AND "name" IS DISTINCT FROM $c$Blue L$c$;
UPDATE "product_variants" SET "name" = $c$Pink M$c$ WHERE "sku" = $c$CJPS263153803CX$c$ AND "name" IS DISTINCT FROM $c$Pink M$c$;
UPDATE "product_variants" SET "name" = $c$Blue M$c$ WHERE "sku" = $c$CJPS263153804DW$c$ AND "name" IS DISTINCT FROM $c$Blue M$c$;
UPDATE "product_variants" SET "name" = $c$BirdFeeder$c$ WHERE "sku" = $c$CJBF26009380001$c$ AND "name" IS DISTINCT FROM $c$BirdFeeder$c$;
UPDATE "product_variants" SET "name" = $c$Multicolor$c$ WHERE "sku" = $c$CJBF26191950001$c$ AND "name" IS DISTINCT FROM $c$Multicolor$c$;
UPDATE "product_variants" SET "name" = $c$BLACK-850x480x230 mm$c$ WHERE "sku" = $c$CJBC27936410001$c$ AND "name" IS DISTINCT FROM $c$BLACK-850x480x230 mm$c$;
UPDATE "product_variants" SET "name" = $c$A$c$ WHERE "sku" = $c$CJBS311947501AZ$c$ AND "name" IS DISTINCT FROM $c$A$c$;
UPDATE "product_variants" SET "name" = $c$MULTICOLOR$c$ WHERE "sku" = $c$CJBT304475401AZ$c$ AND "name" IS DISTINCT FROM $c$MULTICOLOR$c$;
UPDATE "product_variants" SET "name" = $c$Yellow$c$ WHERE "sku" = $c$CJNY137958601AZ$c$ AND "name" IS DISTINCT FROM $c$Yellow$c$;
UPDATE "product_variants" SET "name" = $c$Red$c$ WHERE "sku" = $c$CJNY137958602BY$c$ AND "name" IS DISTINCT FROM $c$Red$c$;
UPDATE "product_variants" SET "name" = $c$Purple$c$ WHERE "sku" = $c$CJNY137958603CX$c$ AND "name" IS DISTINCT FROM $c$Purple$c$;
UPDATE "product_variants" SET "name" = $c$Green$c$ WHERE "sku" = $c$CJNY137958604DW$c$ AND "name" IS DISTINCT FROM $c$Green$c$;
UPDATE "product_variants" SET "name" = $c$Black$c$ WHERE "sku" = $c$CJNY137958605EV$c$ AND "name" IS DISTINCT FROM $c$Black$c$;
UPDATE "product_variants" SET "name" = $c$Dark Blue$c$ WHERE "sku" = $c$CJNY137958606FU$c$ AND "name" IS DISTINCT FROM $c$Dark Blue$c$;
UPDATE "product_variants" SET "name" = $c$Pink$c$ WHERE "sku" = $c$CJNY137958607GT$c$ AND "name" IS DISTINCT FROM $c$Pink$c$;
UPDATE "product_variants" SET "name" = $c$Grey$c$ WHERE "sku" = $c$CJNY137958608HS$c$ AND "name" IS DISTINCT FROM $c$Grey$c$;
UPDATE "product_variants" SET "name" = $c$Light Blue$c$ WHERE "sku" = $c$CJNY137958609IR$c$ AND "name" IS DISTINCT FROM $c$Light Blue$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Purple · 4x8cm$c$ WHERE "sku" = $c$CJYD298207101AZ$c$ AND "name" IS DISTINCT FROM $c$1 Meter Purple · 4x8cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Purple · 5x8.5cm$c$ WHERE "sku" = $c$CJYD298207102BY$c$ AND "name" IS DISTINCT FROM $c$1 Meter Purple · 5x8.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Purple · 5.5x10cm$c$ WHERE "sku" = $c$CJYD298207103CX$c$ AND "name" IS DISTINCT FROM $c$1 Meter Purple · 5.5x10cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Purple · 6x10.5cm$c$ WHERE "sku" = $c$CJYD298207104DW$c$ AND "name" IS DISTINCT FROM $c$1 Meter Purple · 6x10.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Purple · 12x7cm$c$ WHERE "sku" = $c$CJYD298207105EV$c$ AND "name" IS DISTINCT FROM $c$1 Meter Purple · 12x7cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Purple · 13x7.5cm$c$ WHERE "sku" = $c$CJYD298207106FU$c$ AND "name" IS DISTINCT FROM $c$1 Meter Purple · 13x7.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Blue · 4x8cm$c$ WHERE "sku" = $c$CJYD298207108HS$c$ AND "name" IS DISTINCT FROM $c$1 Meter Blue · 4x8cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Blue · 5x8.5cm$c$ WHERE "sku" = $c$CJYD298207109IR$c$ AND "name" IS DISTINCT FROM $c$1 Meter Blue · 5x8.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Blue · 5.5x10cm$c$ WHERE "sku" = $c$CJYD298207110JQ$c$ AND "name" IS DISTINCT FROM $c$1 Meter Blue · 5.5x10cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Blue · 6x10.5cm$c$ WHERE "sku" = $c$CJYD298207111KP$c$ AND "name" IS DISTINCT FROM $c$1 Meter Blue · 6x10.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Blue · 12x7cm$c$ WHERE "sku" = $c$CJYD298207112LO$c$ AND "name" IS DISTINCT FROM $c$1 Meter Blue · 12x7cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Blue · 13x7.5cm$c$ WHERE "sku" = $c$CJYD298207113MN$c$ AND "name" IS DISTINCT FROM $c$1 Meter Blue · 13x7.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Green · 4x8cm$c$ WHERE "sku" = $c$CJYD298207116PK$c$ AND "name" IS DISTINCT FROM $c$1 Meter Green · 4x8cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Green · 5x8.5cm$c$ WHERE "sku" = $c$CJYD298207117QJ$c$ AND "name" IS DISTINCT FROM $c$1 Meter Green · 5x8.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Green · 5.5x10cm$c$ WHERE "sku" = $c$CJYD298207118RI$c$ AND "name" IS DISTINCT FROM $c$1 Meter Green · 5.5x10cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Green · 6x10.5cm$c$ WHERE "sku" = $c$CJYD298207119SH$c$ AND "name" IS DISTINCT FROM $c$1 Meter Green · 6x10.5cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Green · 12x7cm$c$ WHERE "sku" = $c$CJYD298207120TG$c$ AND "name" IS DISTINCT FROM $c$1 Meter Green · 12x7cm$c$;
UPDATE "product_variants" SET "name" = $c$1 Meter Green · 13x7.5cm$c$ WHERE "sku" = $c$CJYD298207121UF$c$ AND "name" IS DISTINCT FROM $c$1 Meter Green · 13x7.5cm$c$;
UPDATE "product_variants" SET "name" = $c$2 Meters Purple · 4x8cm$c$ WHERE "sku" = $c$CJYD298207125YB$c$ AND "name" IS DISTINCT FROM $c$2 Meters Purple · 4x8cm$c$;
UPDATE "product_variants" SET "name" = $c$2 Meters Purple · 5x8.5cm$c$ WHERE "sku" = $c$CJYD298207126ZA$c$ AND "name" IS DISTINCT FROM $c$2 Meters Purple · 5x8.5cm$c$;
UPDATE "product_variants" SET "name" = $c$PURPLE$c$ WHERE "sku" = $c$CJHR300962201AZ$c$ AND "name" IS DISTINCT FROM $c$PURPLE$c$;
UPDATE "product_variants" SET "name" = $c$Standard$c$ WHERE "sku" = $c$CJHR31478480001$c$ AND "name" IS DISTINCT FROM $c$Standard$c$;
UPDATE "product_variants" SET "name" = $c$BLACK$c$ WHERE "sku" = $c$CJNP301533801AZ$c$ AND "name" IS DISTINCT FROM $c$BLACK$c$;
UPDATE "product_variants" SET "name" = $c$2 pcs$c$ WHERE "sku" = $c$CJSP319096001AZ$c$ AND "name" IS DISTINCT FROM $c$2 pcs$c$;
UPDATE "product_variants" SET "name" = $c$BLUE-M · 100x50cm$c$ WHERE "sku" = $c$CJPT227044601AZ$c$ AND "name" IS DISTINCT FROM $c$BLUE-M · 100x50cm$c$;
UPDATE "product_variants" SET "name" = $c$BLUE-L · 130x70cm$c$ WHERE "sku" = $c$CJPT227044602BY$c$ AND "name" IS DISTINCT FROM $c$BLUE-L · 130x70cm$c$;
UPDATE "product_variants" SET "name" = $c$GREEN-M · 100x50cm$c$ WHERE "sku" = $c$CJPT227044603CX$c$ AND "name" IS DISTINCT FROM $c$GREEN-M · 100x50cm$c$;
UPDATE "product_variants" SET "name" = $c$GREEN-L · 130x70cm$c$ WHERE "sku" = $c$CJPT227044604DW$c$ AND "name" IS DISTINCT FROM $c$GREEN-L · 130x70cm$c$;
UPDATE "product_variants" SET "name" = $c$Brown-M · 100x50cm$c$ WHERE "sku" = $c$CJPT227044605EV$c$ AND "name" IS DISTINCT FROM $c$Brown-M · 100x50cm$c$;
UPDATE "product_variants" SET "name" = $c$Brown-L · 130x70cm$c$ WHERE "sku" = $c$CJPT227044606FU$c$ AND "name" IS DISTINCT FROM $c$Brown-L · 130x70cm$c$;
UPDATE "product_variants" SET "name" = $c$PINK-M · 100x50cm$c$ WHERE "sku" = $c$CJPT227044607GT$c$ AND "name" IS DISTINCT FROM $c$PINK-M · 100x50cm$c$;
UPDATE "product_variants" SET "name" = $c$PINK-L · 130x70cm$c$ WHERE "sku" = $c$CJPT227044608HS$c$ AND "name" IS DISTINCT FROM $c$PINK-L · 130x70cm$c$;
UPDATE "product_variants" SET "name" = $c$GRAY-M · 100x50cm$c$ WHERE "sku" = $c$CJPT227044609IR$c$ AND "name" IS DISTINCT FROM $c$GRAY-M · 100x50cm$c$;
UPDATE "product_variants" SET "name" = $c$GRAY-L · 130x70cm$c$ WHERE "sku" = $c$CJPT227044610JQ$c$ AND "name" IS DISTINCT FROM $c$GRAY-L · 130x70cm$c$;

-- Retire the duplicate listing: pet-clothes-round-neck-t-shirt-pet-tops
DELETE FROM "wishlist_items" WHERE "product_id" IN (SELECT "id" FROM "products" WHERE "slug" = $c$pet-clothes-round-neck-t-shirt-pet-tops$c$);
DELETE FROM "reviews" WHERE "product_id" IN (SELECT "id" FROM "products" WHERE "slug" = $c$pet-clothes-round-neck-t-shirt-pet-tops$c$);
DELETE FROM "product_variants" WHERE "product_id" IN (SELECT "id" FROM "products" WHERE "slug" = $c$pet-clothes-round-neck-t-shirt-pet-tops$c$);
DELETE FROM "products"
  WHERE "slug" = $c$pet-clothes-round-neck-t-shirt-pet-tops$c$
    AND NOT EXISTS (SELECT 1 FROM "order_items" oi WHERE oi."product_id" = "products"."id");
