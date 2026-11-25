-- The Art of Presentation: the certificate's name, and where its course is.
--
-- - Passing all three capstone pieces now awards the certificate by itself
--   (CapstoneConfig.autoAward, src/lib/certifications/capstone.ts), so its
--   name is what the learner's certificate says. It was a working title,
--   "... Capstone (gothamCulture)"; it is now the course's own name.
-- - The two SCORM packages were imported as new courses (2026-11-25) rather
--   than into the draft shells migration 20261125120000 made. The capstones
--   were re-pointed to those courses and the empty shells deleted by hand the
--   same day; this records that, and is a no-op where it has been done.

UPDATE public.certifications
SET name = 'The Art of Presentation',
    description = 'Awarded by gothamCulture when the learner has passed the course''s final exam and the assessor has passed their recorded presentation, session plan, and self-review and action plan.',
    award_requires_course_ids = ARRAY['79b0065c-2145-471c-a68c-9a58dd4ae70f'::uuid]
WHERE capstone_key = 'art-of-presentation-gc'
  AND EXISTS (SELECT 1 FROM public.courses WHERE id = '79b0065c-2145-471c-a68c-9a58dd4ae70f');

UPDATE public.certifications
SET name = 'The Art of Presentation (GGS)',
    description = 'Awarded by Gotham Government Services when the learner has passed the course''s final exam and the assessor has passed their recorded presentation, session plan, and self-review and action plan.',
    award_requires_course_ids = ARRAY['732c1d60-5c4e-4618-83fb-fd9f33eee4de'::uuid]
WHERE capstone_key = 'art-of-presentation-ggs'
  AND EXISTS (SELECT 1 FROM public.courses WHERE id = '732c1d60-5c4e-4618-83fb-fd9f33eee4de');

DELETE FROM public.courses c
WHERE c.id IN ('c223309f-4500-4f54-a4d0-0ade3633e61c', 'd8c9adf1-1180-48c4-af1a-4ca71a45b88a')
  AND c.status = 'draft'
  AND NOT EXISTS (SELECT 1 FROM public.modules m WHERE m.course_id = c.id)
  AND NOT EXISTS (SELECT 1 FROM public.enrollments e WHERE e.course_id = c.id);
