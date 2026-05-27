-- Product-level display overrides so shop items can differ from their course.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT;
