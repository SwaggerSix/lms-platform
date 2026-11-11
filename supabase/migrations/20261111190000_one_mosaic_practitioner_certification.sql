-- One Mosaic Practitioner certification (operator decision 2026-11-11).
--
-- The $599 Mosaic Certification Bundle is MOS-100 + MOS-230 + MOS-240 and
-- earns ONE certification: finish all three courses, then hand in ONE
-- capstone on the Northwind Health case (the Culture Mosaic memo, the Culture
-- Dig plan and synthesis, the Mosaic Signal memo and a recorded board
-- briefing), marked by hand. Valid five years. The capstone's pieces live in
-- code (src/lib/certifications/capstone.ts, key 'mosaic-practitioner').
--
-- - certifications.award_requires_course_ids: a credential that needs several
--   courses finished. The capstone opens, and Award is allowed, only once all
--   are (src/lib/certifications/requirements.ts). award_requires_course_id
--   stays for the one-course Specialists (MOS-210, MOS-220).
-- - The Culture Dig and Mosaic Signal Specialist certifications are retired:
--   their practicals are pieces of the one capstone now. Nobody holds either
--   and nothing has been handed in for them (checked 2026-11-11).
-- - Two new kinds of hand-in, 'dig' and 'signal'.

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS award_requires_course_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.certification_submissions
  DROP CONSTRAINT IF EXISTS certification_submissions_kind_check;
ALTER TABLE public.certification_submissions
  ADD CONSTRAINT certification_submissions_kind_check
  CHECK (kind IN ('memo', 'dig', 'signal', 'briefing', 'practical'));

UPDATE public.certifications
SET name = 'Mosaic Practitioner Certified',
    description = 'Awarded by gothamCulture when the learner has finished MOS-100, MOS-230 and MOS-240 and the assessor has passed every piece of their Northwind Health capstone: the Culture Mosaic memo, the Culture Dig plan and synthesis, the Mosaic Signal memo and the recorded board briefing. Valid for five years.',
    award_requires_course_ids = ARRAY[
      '01b26601-1e82-4ede-ac22-3a41bcfef7cf'::uuid,  -- MOS-100 Mosaic Practitioner
      'e96e014f-5145-4f8e-a0d2-c71ac6f4aa39'::uuid,  -- MOS-230 Culture Dig
      '5a2bb58b-68db-4c96-afd6-b9cb6c4d3fa9'::uuid   -- MOS-240 Mosaic Signal
    ],
    award_requires_course_id = NULL,
    validity_months = 60
WHERE capstone_key = 'mosaic-practitioner';

UPDATE public.certifications
SET status = 'inactive'
WHERE capstone_key IN ('culture-dig-specialist', 'mosaic-signal-specialist');
