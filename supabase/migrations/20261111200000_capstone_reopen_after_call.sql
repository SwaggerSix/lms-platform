-- Reopen a capstone piece after the call (operator decision 2026-11-11).
--
-- A piece gets one resubmission; a second fail ("not_passed") tells the
-- learner Dr. Chris Cancialosi will set up a call. After that call the
-- assessor can press "Reopen for another attempt" on the Award screen, which
-- stamps the not-passed hand-in here and lets the learner hand that piece in
-- once more (src/lib/certifications/capstone.ts, nextAttempt). It can be
-- reopened again after a later fail; each reopening is recorded on the
-- hand-in it reopened.

ALTER TABLE public.certification_submissions
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cert_submissions_reopened_by
  ON public.certification_submissions (reopened_by);
