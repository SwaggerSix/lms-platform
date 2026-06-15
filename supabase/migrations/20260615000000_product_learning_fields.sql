-- LMS-owned content fields for storefront products, populated from the catalog
-- audit. Kept separate from the Ecwid-synced fields so a re-sync won't clobber
-- them. learning_objectives is a list; methodology is free text.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS learning_objectives TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS methodology TEXT;
