-- Explicit, admin-controlled switch for whether a product appears in the public
-- online store. Separate from `status` (availability) so a bespoke/client
-- offering can be active for private or B2B sale while staying out of the public
-- catalog. LMS-owned, so an Ecwid re-sync won't change it.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS listed_in_storefront BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_products_listed
  ON public.products(storefront_id, listed_in_storefront);
