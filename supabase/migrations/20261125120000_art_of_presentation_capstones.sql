-- The Art of Presentation: two course shells and their capstones.
--
-- A new SCORM 1.2 course in two versions, gothamCulture and Gotham Government
-- Services. After passing the course's final exam the learner hands in three
-- files on the LMS: a recorded presentation (MP4 or MOV) and two Word
-- documents. Assessors mark each Pass or Not yet with written feedback, one
-- resubmission (src/lib/certifications/capstone.ts, keys
-- 'art-of-presentation-gc' and 'art-of-presentation-ggs').
--
-- - Two DRAFT courses with fixed ids, so the capstone pages' addresses are
--   known before the packages are uploaded (the package links to its hand-in
--   page). They have no lesson yet: the package is added on the course's
--   SCORM page (Admin -> Courses -> ... -> SCORM Packages -> Add a SCORM
--   package). Draft, assigned-only, not in the storefronts: a test area until
--   someone presses Publish.
-- - Two certifications that carry the capstones. award_requires_course_ids
--   (not _id) so the hand-in page opens only once the course is finished,
--   final exam passed. The hand-in pages are /learn/capstone/<certification id>.
-- - Three new kinds of hand-in.
-- - The hand-in bucket's per-file limit goes from 50 MB to 5 GB for the
--   recorded presentation (MAX_VIDEO_BYTES). Documents stay at 50 MB, checked
--   by the app when a piece is handed in. Storage's GLOBAL file size limit
--   (Supabase -> Storage -> Settings) must also be 5 GB or more; a bucket
--   can't exceed it.

ALTER TABLE public.certification_submissions
  DROP CONSTRAINT IF EXISTS certification_submissions_kind_check;
ALTER TABLE public.certification_submissions
  ADD CONSTRAINT certification_submissions_kind_check
  CHECK (kind IN ('memo', 'dig', 'signal', 'briefing', 'practical',
                  'presentation', 'document_1', 'document_2'));

INSERT INTO public.courses
  (id, title, slug, course_type, status, enrollment_type, listed_in_storefronts, partner_code_eligible)
VALUES
  ('c223309f-4500-4f54-a4d0-0ade3633e61c', 'The Art of Presentation (gothamCulture)',
   'the-art-of-presentation-gc', 'scorm', 'draft', 'assigned', false, false),
  ('d8c9adf1-1180-48c4-af1a-4ca71a45b88a', 'The Art of Presentation (GGS)',
   'the-art-of-presentation-ggs', 'scorm', 'draft', 'assigned', false, false)
ON CONFLICT DO NOTHING;

INSERT INTO public.certifications
  (id, name, description, course_id, award_requires_course_ids, capstone_key, status, validity_months)
SELECT v.id, v.name, v.description, NULL, ARRAY[v.course_id], v.capstone_key, 'active', NULL
FROM (VALUES
  ('b693d8fb-51a4-43cf-9caa-23693dcb97c9'::uuid,
   'c223309f-4500-4f54-a4d0-0ade3633e61c'::uuid,
   'The Art of Presentation Capstone (gothamCulture)',
   'Awarded by gothamCulture when the learner has passed the course''s final exam and the assessor has passed their recorded presentation and both documents.',
   'art-of-presentation-gc'),
  ('acca3456-be3e-4979-ad3b-f1f4d8ece0eb'::uuid,
   'd8c9adf1-1180-48c4-af1a-4ca71a45b88a'::uuid,
   'The Art of Presentation Capstone (GGS)',
   'Awarded by Gotham Government Services when the learner has passed the course''s final exam and the assessor has passed their recorded presentation and both documents.',
   'art-of-presentation-ggs')
) AS v(id, course_id, name, description, capstone_key)
WHERE EXISTS (SELECT 1 FROM public.courses c WHERE c.id = v.course_id)
  AND NOT EXISTS (SELECT 1 FROM public.certifications x WHERE x.id = v.id OR x.capstone_key = v.capstone_key);

UPDATE storage.buckets
SET file_size_limit = 5368709120
WHERE id = 'certification-submissions';
