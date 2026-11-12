-- Courses a gC partner code (GCP-...) does not discount.
--
-- Operator decision 2026-11-12: the partner code does NOT apply to the two
-- specialist courses, MOS-210 Coaching Studio and MOS-220 SurveyCraft —
-- partners pay full price for them. It still applies to everything else it
-- applied to before (the Mosaic Practitioner courses MOS-100 / MOS-230 /
-- MOS-240, the Mosaic Certification bundle, other courses).
--
--   courses.partner_code_eligible  -- false => a store product selling this
--                                     course, or a bundle whose learning path
--                                     includes it, is left out of a partner
--                                     code's discount (and out of the price
--                                     the partner portal is asked to evaluate).
--                                     A cart with nothing eligible refuses the
--                                     code. Default true: every other course,
--                                     and any course added later, behaves as
--                                     before.
--
-- On the course rather than the store product: the same course can be sold by
-- more than one storefront (gC and GGS) and as part of a bundle, and one flag
-- on the course covers all of them. Local coupons are unaffected.
--
-- The two course ids are the ones the certification migrations use
-- (20261111120000, 20261111160000). Guarded by id, so this is a no-op on a
-- database without those courses; idempotent on re-run.
--
-- RLS: courses keeps its existing policies; the new column is covered by them.
-- Checkout reads it through the service role.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS partner_code_eligible BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.courses.partner_code_eligible IS
  'false: a gC partner code (GCP-...) does not discount this course, alone or in a bundle (operator decision 2026-11-12: MOS-210, MOS-220). Local coupons are unaffected.';

UPDATE public.courses
SET partner_code_eligible = false
WHERE id IN (
  '6aec94da-f201-49bc-94c8-93cb37301dc4',  -- MOS-210 Coaching Studio
  '19fdd7b3-df49-467a-9b3e-71b105148cae'   -- MOS-220 SurveyCraft
);
