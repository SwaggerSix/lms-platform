-- Manual grading for written exam questions (essay).
--
-- When an attempt contains essay answers, it is flagged needs_grading=true and
-- the provisional score reflects only the auto-graded portion. An instructor
-- awards points from the grading queue, which recomputes the final score and
-- clears the flag.

ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS needs_grading BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS graded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_needs_grading
  ON public.assessment_attempts(needs_grading) WHERE needs_grading = true;
