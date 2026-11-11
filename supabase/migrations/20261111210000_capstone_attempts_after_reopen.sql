-- A reopened capstone piece needs a third (or later) attempt.
--
-- certification_submissions.attempt was checked to 1..2 when every piece had
-- exactly one resubmission. Since "Reopen for another attempt" (migration
-- 20261111200000) the assessor can open a piece again after the call, so the
-- learner's next hand-in is attempt 3, which the old check refused (the
-- hand-in failed with a server error). Attempts are still limited in code
-- (src/lib/certifications/capstone.ts, nextAttempt): a third or later one
-- exists only if the assessor reopened the piece.

ALTER TABLE public.certification_submissions
  DROP CONSTRAINT IF EXISTS certification_submissions_attempt_check;
ALTER TABLE public.certification_submissions
  ADD CONSTRAINT certification_submissions_attempt_check CHECK (attempt >= 1);
