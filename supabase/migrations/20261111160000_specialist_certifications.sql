-- The four Specialist credentials (MOS-210 to MOS-240).
--
-- Each of those courses is a certification with the same shape as MOS-100:
-- module checks, the exam, then a practical task (gate G3) the assessor marks,
-- one resubmission, five years' validity (surveycraft
-- docs/training/<course>/01-course-architecture.md §6, decided 2026-11-08).
-- Passing the exam already gives "<course> — Course completed"; these are the
-- credentials awarded by hand once the practical has passed, using the same
-- hand-in and Award screen as Mosaic Certified. Their tasks live in code
-- (src/lib/certifications/capstone.ts, keyed by capstone_key).
--
-- A practical is a new kind of hand-in, so the kind check is widened.

ALTER TABLE public.certification_submissions
  DROP CONSTRAINT IF EXISTS certification_submissions_kind_check;
ALTER TABLE public.certification_submissions
  ADD CONSTRAINT certification_submissions_kind_check
  CHECK (kind IN ('memo', 'briefing', 'practical'));

INSERT INTO public.certifications
  (name, description, course_id, award_requires_course_id, capstone_key, status, validity_months)
SELECT v.name, v.description, NULL, c.id, v.capstone_key, 'active', 60
FROM (VALUES
  ('6aec94da-f201-49bc-94c8-93cb37301dc4'::uuid,
   'Certified · Coaching Studio Specialist',
   'Awarded by gothamCulture when the learner has passed the MOS-210 exam and the assessor has marked their practical task as passing. Valid for five years.',
   'coaching-studio-specialist'),
  ('19fdd7b3-df49-467a-9b3e-71b105148cae'::uuid,
   'Certified · SurveyCraft Specialist',
   'Awarded by gothamCulture when the learner has passed the MOS-220 exam and the assessor has marked their practical survey build as passing. Valid for five years.',
   'surveycraft-specialist'),
  ('e96e014f-5145-4f8e-a0d2-c71ac6f4aa39'::uuid,
   'Certified · Culture Dig Specialist',
   'Awarded by gothamCulture when the learner has passed the MOS-230 exam and the assessor has marked their practical task as passing. Valid for five years.',
   'culture-dig-specialist'),
  ('5a2bb58b-68db-4c96-afd6-b9cb6c4d3fa9'::uuid,
   'Certified · Mosaic Signal Specialist',
   'Awarded by gothamCulture when the learner has passed the MOS-240 exam and the assessor has marked their analysis memo as passing. Valid for five years.',
   'mosaic-signal-specialist')
) AS v(course_id, name, description, capstone_key)
JOIN public.courses c ON c.id = v.course_id
WHERE NOT EXISTS (SELECT 1 FROM public.certifications x WHERE x.name = v.name);
