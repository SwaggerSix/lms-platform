-- The Art of Presentation: $149 in each store, and no free self-enrolment.
--
-- Operator decision (2026-11-25): $149.00 for each version. A learner who
-- orders it themselves pays; it is free only when an admin assigns it.
--
-- - enrollment_type 'assigned' on both courses. The LMS now refuses a
--   learner's own free enrolment in an 'assigned' course (POST
--   /api/enrollments; src/lib/enrollments/assign-scope.ts) and shows the store
--   product instead. Buying and admin assignment still enrol. The courses stay
--   published and visible in the course catalog.
-- - One store product per version: gothamCulture's in the gothamCulture
--   store, the GGS one in the Gotham Government Services store.

UPDATE public.courses
SET enrollment_type = 'assigned'
WHERE id IN ('79b0065c-2145-471c-a68c-9a58dd4ae70f', '732c1d60-5c4e-4618-83fb-fd9f33eee4de');

INSERT INTO public.products
  (name, description, price, currency, status, storefront_id, course_id, listed_in_storefront, category)
SELECT c.title, v.description, 149.00, 'USD', 'active', s.id, c.id, true, 'Developing Others'
FROM (VALUES
  ('79b0065c-2145-471c-a68c-9a58dd4ae70f'::uuid, 'gothamculture',
   'A self-paced online course on planning and delivering a presentation. After the final exam you hand in a recorded presentation, your session plan, and a self-review and action plan; an assessor marks each with written feedback. Pass all three to earn your certificate.'),
  ('732c1d60-5c4e-4618-83fb-fd9f33eee4de'::uuid, 'gothamgovernment',
   'A self-paced online course on planning and delivering a presentation. After the final exam you hand in a recorded presentation, your session plan, and a self-review and action plan; an assessor marks each with written feedback. Pass all three to earn your certificate.')
) AS v(course_id, store_slug, description)
JOIN public.courses c ON c.id = v.course_id
JOIN public.storefronts s ON s.slug = v.store_slug
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.course_id = c.id);
