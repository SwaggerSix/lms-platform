-- NASBA CPE certification fields for courses and storefront products.
-- Applied per offering ("if applicable" via nasba_certified). Mirrored on both
-- courses (so classes/cohorts inherit and can be sorted by certification) and
-- products (for the sellable catalog).

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['courses', 'products'] LOOP
    EXECUTE format($f$
      ALTER TABLE public.%I
        ADD COLUMN IF NOT EXISTS nasba_certified BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS nasba_cpe_credits NUMERIC(5,1),
        ADD COLUMN IF NOT EXISTS nasba_field_of_study TEXT,
        ADD COLUMN IF NOT EXISTS nasba_knowledge_level TEXT,
        ADD COLUMN IF NOT EXISTS nasba_prerequisites TEXT,
        ADD COLUMN IF NOT EXISTS nasba_advance_prep TEXT,
        ADD COLUMN IF NOT EXISTS nasba_delivery_method TEXT
    $f$, t);
  END LOOP;
END $$;

ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS courses_nasba_knowledge_level_check,
  ADD CONSTRAINT courses_nasba_knowledge_level_check
    CHECK (nasba_knowledge_level IS NULL OR nasba_knowledge_level IN
      ('Basic', 'Overview', 'Intermediate', 'Advanced', 'Update'));

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_nasba_knowledge_level_check,
  ADD CONSTRAINT products_nasba_knowledge_level_check
    CHECK (nasba_knowledge_level IS NULL OR nasba_knowledge_level IN
      ('Basic', 'Overview', 'Intermediate', 'Advanced', 'Update'));

CREATE INDEX IF NOT EXISTS idx_courses_nasba ON public.courses(nasba_certified) WHERE nasba_certified;
CREATE INDEX IF NOT EXISTS idx_products_nasba ON public.products(nasba_certified) WHERE nasba_certified;
