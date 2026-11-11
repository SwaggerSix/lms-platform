-- Capstone-gated certifications.
--
-- A certification can now be earned by finishing a learning path AND passing
-- a capstone that an assessor marks by hand. The first one is the Mosaic
-- Practitioner Certification (operator decisions, 2026-11-11):
--
--   * the five Mosaic courses are sold as one bundle (a learning path, see
--     20261109192940_store_bundles.sql); each course ends in an auto-graded
--     final exam;
--   * once every course on the path is completed, one capstone opens;
--   * Dr. Chris Cancialosi marks it within 10 business days: Pass issues the
--     certificate (valid five years); "Not yet" returns written feedback and
--     allows one resubmission; a second "Not yet" means a call with him, after
--     which he may allow another attempt;
--   * on Pass the certified person is also invited to the partner portal and
--     given its badge (done by the app, not here).
--
-- Columns on certifications (all nullable / defaulted, so existing rows and
-- the admin API keep working):
--   learning_path_id       -- the path whose courses must all be completed.
--                             One certification per path.
--   requires_capstone      -- false: issued automatically when the path is
--                             completed. true: a passed capstone is required.
--   capstone_instructions  -- the learner-facing brief (Markdown). Readable by
--                             anyone, like the rest of the row: never put the
--                             assessor rubric or model answers here.
--   max_capstone_attempts  -- attempts allowed before a call is needed (2).
--   portal_certification   -- the key the partner portal knows this
--                             certification by ('mosaic-practitioner'); null
--                             means nothing is sent to the portal.
--
-- Note: certifications never had course_id or status columns, though some app
-- code read them; that code is fixed in the same change.
--
-- capstone_submissions: one row per attempt. Files live in the private
-- 'capstones' storage bucket under <user_id>/<certification_id>/…, written
-- through short-lived signed upload URLs issued by the API and read back only
-- through signed download URLs; there are no storage policies for end users,
-- so nobody reaches another person's files directly.
--
-- RLS: a learner reads their own submissions; admins read and manage all.
-- Every write goes through the service role in the API, which checks
-- eligibility and attempt limits.

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS learning_path_id UUID
    REFERENCES public.learning_paths(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS requires_capstone BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capstone_instructions TEXT,
  ADD COLUMN IF NOT EXISTS max_capstone_attempts INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS portal_certification TEXT;

ALTER TABLE public.certifications
  DROP CONSTRAINT IF EXISTS certifications_max_capstone_attempts_range;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_max_capstone_attempts_range
    CHECK (max_capstone_attempts BETWEEN 1 AND 5);

ALTER TABLE public.certifications
  DROP CONSTRAINT IF EXISTS certifications_capstone_needs_path;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_capstone_needs_path
    CHECK (NOT requires_capstone OR learning_path_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_learning_path_id
  ON public.certifications (learning_path_id)
  WHERE learning_path_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.capstone_submissions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id       UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  user_id                UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  attempt                INTEGER NOT NULL CHECK (attempt >= 1),
  status                 TEXT NOT NULL DEFAULT 'submitted'
                           CHECK (status IN ('submitted', 'passed', 'not_yet')),
  -- [{ "path": "...", "name": "...", "size": 123, "type": "application/pdf" }]
  files                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ "label": "...", "url": "https://..." }]
  links                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  learner_note           TEXT,
  submitted_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_by              UUID REFERENCES public.users(id) ON DELETE SET NULL,
  graded_at              TIMESTAMPTZ,
  feedback               TEXT,
  -- Set by an admin after the call that follows the last allowed "Not yet":
  -- the learner may submit once more.
  another_attempt_allowed BOOLEAN NOT NULL DEFAULT false,
  user_certification_id  UUID REFERENCES public.user_certifications(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (certification_id, user_id, attempt)
);

-- At most one attempt waiting to be marked per person and certification.
CREATE UNIQUE INDEX IF NOT EXISTS idx_capstone_submissions_one_open
  ON public.capstone_submissions (certification_id, user_id)
  WHERE status = 'submitted';

CREATE INDEX IF NOT EXISTS idx_capstone_submissions_status
  ON public.capstone_submissions (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_capstone_submissions_user
  ON public.capstone_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_capstone_submissions_graded_by
  ON public.capstone_submissions (graded_by);
CREATE INDEX IF NOT EXISTS idx_capstone_submissions_user_certification
  ON public.capstone_submissions (user_certification_id);

ALTER TABLE public.capstone_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Learners read own capstone submissions" ON public.capstone_submissions;
CREATE POLICY "Learners read own capstone submissions"
  ON public.capstone_submissions FOR SELECT TO authenticated
  USING (user_id = (SELECT public.current_user_id()));

DROP POLICY IF EXISTS "Admins manage capstone submissions" ON public.capstone_submissions;
CREATE POLICY "Admins manage capstone submissions"
  ON public.capstone_submissions FOR ALL TO authenticated
  USING ((SELECT public.current_user_role()) IN ('admin', 'super_admin'))
  WITH CHECK ((SELECT public.current_user_role()) IN ('admin', 'super_admin'));

-- Private bucket for capstone files. 50 MB per file; documents and slides
-- only (recordings are submitted as links). No storage.objects policies:
-- uploads use signed upload URLs and downloads signed URLs, both minted by
-- the API with the service role after its own checks.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'capstones', 'capstones', false, 52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
