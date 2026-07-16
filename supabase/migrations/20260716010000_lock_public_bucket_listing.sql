-- S4 (multi-role QA audit): the public 'course-images' and 'nudge-images'
-- buckets each had a broad SELECT policy on storage.objects granted to the
-- anonymous/public role. On top of public-URL access (which does not need a
-- SELECT policy for a public bucket), that policy also allowed anyone to LIST
-- every object in the bucket via the storage API — exposing filenames, volume,
-- and potentially unreleased assets.
--
-- Dropping these SELECT policies removes anonymous listing. Reading individual
-- objects by their public URL is unaffected: both buckets are public=true, so
-- objects are served through /storage/v1/object/public/... without consulting
-- RLS. Uploads/updates/deletes remain governed by their existing
-- authenticated-only policies.

DROP POLICY IF EXISTS "Anyone can view course images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view nudge images" ON storage.objects;
