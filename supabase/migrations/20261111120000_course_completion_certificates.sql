-- Course-completion certificates, and a "Mosaic Certified" credential that
-- staff award by hand.
--
-- Until now the course-completion step looked up
--   certifications WHERE course_id = <course> AND status = 'active'
-- but certifications had neither column, so the lookup always failed and
-- nobody who finished a course ever received a certificate. The admin API
-- (/api/certifications) also writes both columns. This adds them.
--
--   certifications.course_id   -- set => finishing that course issues this
--                                 certificate automatically. NULL => never
--                                 issued automatically (awarded by staff).
--   certifications.status      -- 'active' | 'inactive'. Only active ones are
--                                 issued.
--   certifications.award_requires_course_id
--                              -- for a staff-awarded credential: the learner
--                                 must already have completed this course, so
--                                 it can't be awarded to someone who never
--                                 passed the exam.
--
-- user_certifications gets one row per learner per certification. Re-awarding
-- after a revoke updates that row instead of adding a second. The table is
-- empty in prod when this ships, so the unique index cannot fail.
--
-- Mosaic certification courses: passing the final exam completes the course
-- and issues "<course> — Course completed". Passing the exam does NOT make
-- anyone Mosaic Certified; that needs the memo (G3) and the briefing (G4),
-- marked by the assessor (operator decision 2026-11-11). Valid five years
-- (decided 2026-11-08, mosaic-certification/01-course-architecture.md).
--
-- RLS: certifications / user_certifications keep their existing policies; the
-- app reads and writes them through the service role.

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS course_id UUID
    REFERENCES public.courses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS award_requires_course_id UUID
    REFERENCES public.courses(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certifications_status_check'
  ) THEN
    ALTER TABLE public.certifications
      ADD CONSTRAINT certifications_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_certifications_course_id
  ON public.certifications (course_id);
CREATE INDEX IF NOT EXISTS idx_certifications_award_requires_course_id
  ON public.certifications (award_requires_course_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_certifications_user_cert
  ON public.user_certifications (user_id, certification_id);

COMMENT ON COLUMN public.certifications.course_id IS
  'When set, completing this course issues this certificate automatically. NULL: awarded by staff only.';
COMMENT ON COLUMN public.certifications.status IS
  'active | inactive. Only active certifications are issued or awarded.';
COMMENT ON COLUMN public.certifications.award_requires_course_id IS
  'Staff-awarded credential: the learner must have completed this course first.';

-- The certificates themselves. Guarded on the course existing so this is a
-- no-op on a database without these courses, and on the name so a re-run adds
-- nothing.
INSERT INTO public.certifications (name, description, course_id, status, validity_months)
SELECT v.name, v.description, c.id, 'active', NULL
FROM (VALUES
  ('01b26601-1e82-4ede-ac22-3a41bcfef7cf'::uuid,
   'MOS-100 Mosaic Practitioner — Course completed',
   'Completed the MOS-100 Mosaic Practitioner course and passed its final exam. This is a course-completion certificate, not the Mosaic Certified credential.'),
  ('6aec94da-f201-49bc-94c8-93cb37301dc4'::uuid,
   'MOS-210 Coaching Studio — Course completed',
   'Completed the MOS-210 Coaching Studio course and passed its final exam.'),
  ('19fdd7b3-df49-467a-9b3e-71b105148cae'::uuid,
   'MOS-220 SurveyCraft — Course completed',
   'Completed the MOS-220 SurveyCraft course and passed its final exam.'),
  ('e96e014f-5145-4f8e-a0d2-c71ac6f4aa39'::uuid,
   'MOS-230 Culture Dig — Course completed',
   'Completed the MOS-230 Culture Dig course and passed its final exam.'),
  ('5a2bb58b-68db-4c96-afd6-b9cb6c4d3fa9'::uuid,
   'MOS-240 Mosaic Signal — Course completed',
   'Completed the MOS-240 Mosaic Signal course and passed its final exam.')
) AS v(course_id, name, description)
JOIN public.courses c ON c.id = v.course_id
WHERE NOT EXISTS (SELECT 1 FROM public.certifications x WHERE x.name = v.name);

INSERT INTO public.certifications (name, description, course_id, award_requires_course_id, status, validity_months)
SELECT
  'Mosaic Certified — Mosaic Practitioner',
  'Awarded by gothamCulture when the learner has passed the MOS-100 exam and the assessor has marked their interpretation memo and executive briefing as passing. Valid for five years.',
  NULL, c.id, 'active', 60
FROM public.courses c
WHERE c.id = '01b26601-1e82-4ede-ac22-3a41bcfef7cf'
  AND NOT EXISTS (
    SELECT 1 FROM public.certifications x
    WHERE x.name = 'Mosaic Certified — Mosaic Practitioner'
  );
