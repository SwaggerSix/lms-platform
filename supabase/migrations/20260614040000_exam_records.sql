-- Examination records: deploy control + per-class context for attempts.
--
-- Builds on the existing assessments/questions/assessment_attempts engine.
--   * assessments.status — draft/published/archived so exams can be authored
--     before being deployed to learners.
--   * assessment_attempts.class_id — records which class (cohort) a learner sat
--     the exam in, so scores can be tracked and reported per delivery.

ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived'));

ALTER TABLE public.assessment_attempts
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_user ON public.assessment_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON public.assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_class ON public.assessment_attempts(class_id);
