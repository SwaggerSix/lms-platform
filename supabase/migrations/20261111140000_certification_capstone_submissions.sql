-- Capstone hand-in for staff-awarded credentials (Mosaic Certified).
--
-- MOS-100 M10 tells learners to upload a two-page memo (gate G3) and a
-- recorded 10-12 minute briefing (G4), after which three pushback questions
-- drawn at random are shown and answered on camera (60 s to think, 2 min to
-- answer). None of that existed; this is the storage for it. The assessor
-- marks each piece Pass or Resubmit (one resubmission), and Award is offered
-- once both have passed (src/lib/certifications/capstone.ts).
--
--   certifications.capstone_key        -- which capstone a credential uses
--                                         (code holds the tasks and the
--                                         pushback bank). NULL: none.
--   certifications.notify_user_ids     -- staff emailed when work arrives
--                                         (the "Email me" box on Award).
--   certification_submissions          -- one row per piece per attempt.
--   certification_pushback_answers     -- the 3 questions drawn for a
--                                         briefing, when each was shown and
--                                         answered, and the recording.
--
-- Files live in the private bucket certification-submissions under
-- <user_id>/..., written through one-time signed upload URLs and read only
-- through short-lived signed links the app hands to the learner and to
-- admins. 50 MB per file: a long briefing is expected as a link (Loom,
-- unlisted YouTube, Drive...), which the hand-in page offers.
--
-- RLS: enabled with no policies; the app reads and writes through the
-- service role after its own checks, as for the other certification tables.

ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS capstone_key TEXT,
  ADD COLUMN IF NOT EXISTS notify_user_ids UUID[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.certification_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  certification_id UUID NOT NULL REFERENCES public.certifications(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('memo', 'briefing')),
  attempt SMALLINT NOT NULL CHECK (attempt BETWEEN 1 AND 2),
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'passed', 'resubmit', 'not_passed')),
  file_path TEXT,
  file_name TEXT,
  link_url TEXT,
  learner_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  feedback TEXT,
  CONSTRAINT certification_submissions_has_work
    CHECK (file_path IS NOT NULL OR link_url IS NOT NULL),
  CONSTRAINT certification_submissions_one_per_attempt
    UNIQUE (user_id, certification_id, kind, attempt)
);

CREATE INDEX IF NOT EXISTS idx_cert_submissions_cert_status
  ON public.certification_submissions (certification_id, status);
CREATE INDEX IF NOT EXISTS idx_cert_submissions_reviewed_by
  ON public.certification_submissions (reviewed_by);

CREATE TABLE IF NOT EXISTS public.certification_pushback_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.certification_submissions(id) ON DELETE CASCADE,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 3),
  prompt_index SMALLINT NOT NULL,
  revealed_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  file_path TEXT,
  recorded_in_browser BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT certification_pushback_one_per_position UNIQUE (submission_id, position)
);

ALTER TABLE public.certification_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certification_pushback_answers ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('certification-submissions', 'certification-submissions', false, 52428800)
ON CONFLICT (id) DO NOTHING;

UPDATE public.certifications
SET capstone_key = 'mosaic-practitioner'
WHERE name = 'Mosaic Certified — Mosaic Practitioner' AND capstone_key IS NULL;
