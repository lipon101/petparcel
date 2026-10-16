-- Buyer photos on a review. An empty array (the default) means the review
-- carries no photos, so the product page renders no gallery rather than a blank
-- one. Stored as jsonb to match every other image-list column in this schema.
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "images" jsonb DEFAULT '[]'::jsonb NOT NULL;
