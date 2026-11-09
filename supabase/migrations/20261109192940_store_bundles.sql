-- Store bundles: one storefront product that sells a whole learning path.
--
-- Until now a store product mapped to at most ONE course (products.course_id),
-- and paying for it enrolled the buyer in that course. A bundle product points
-- at a learning path instead: buying it enrolls the buyer in the path and in
-- every course on it (learning_path_items), skipping courses they already have.
--
-- Why a path and not a new product<->course join table: learning paths already
-- are "an ordered list of courses" with admin UI (Admin -> Learning Paths), so
-- reusing them needs two columns, no new table and no new RLS surface.
--
--   products.learning_path_id     -- set => the product is a bundle
--   order_items.learning_path_id  -- snapshot on the order line, so fulfilment
--                                    and order history know what was bought
--
-- A product is either a single course (course_id), a bundle (learning_path_id)
-- or a catalog-only item (neither) -- never both.
--
-- ON DELETE RESTRICT on the product side: deleting a path that is on sale must
-- fail rather than silently turn the bundle into a product that enrolls nobody.
-- Order history uses SET NULL so old orders never block a path cleanup once
-- its bundle product is gone.
--
-- RLS: both tables already have RLS enabled with their existing policies
-- (products: public read of active rows, admin manage; order_items: as
-- before). New columns are covered by those row policies; storefront reads and
-- fulfilment go through the service role, as for every other store column.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS learning_path_id UUID
    REFERENCES public.learning_paths(id) ON DELETE RESTRICT;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_course_or_bundle;
ALTER TABLE public.products
  ADD CONSTRAINT products_course_or_bundle
    CHECK (course_id IS NULL OR learning_path_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_products_learning_path_id
  ON public.products (learning_path_id);

COMMENT ON COLUMN public.products.learning_path_id IS
  'Bundle product: buying it enrolls the buyer in this learning path and every course on it. Mutually exclusive with course_id.';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS learning_path_id UUID
    REFERENCES public.learning_paths(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_learning_path_id
  ON public.order_items (learning_path_id);

COMMENT ON COLUMN public.order_items.learning_path_id IS
  'Set when the line was a bundle product: the learning path whose courses the buyer is enrolled in at fulfilment.';
