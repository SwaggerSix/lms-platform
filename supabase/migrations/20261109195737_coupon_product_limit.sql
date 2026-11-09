-- Coupons that only work on one store product.
--
-- Until now a coupon (Admin -> eCommerce -> Coupons) applied to the whole
-- order in any store. To give someone the Mosaic Certification bundle free, the
-- operator needs a code that takes 100% off THAT product and nothing else, so
-- the same code can't empty a cart of other courses.
--
--   coupons.product_id  -- set => the code only works when that product is in
--                          the cart, and its discount is taken from that
--                          product's line(s) only. NULL => whole order, as
--                          before.
--
-- ON DELETE CASCADE: if the product is deleted, a code limited to it goes too.
-- SET NULL would silently turn a "free bundle" code into a code that takes
-- 100% off any order.
--
-- RLS: coupons already has RLS with its existing policies (public read of
-- active rows, admin manage); the new column is covered by those row
-- policies. Checkout reads coupons through the service role.

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS product_id UUID
    REFERENCES public.products(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_coupons_product_id
  ON public.coupons (product_id);

COMMENT ON COLUMN public.coupons.product_id IS
  'When set, the coupon only applies to this store product (its discount is taken from that product''s line only). NULL applies to the whole order.';
