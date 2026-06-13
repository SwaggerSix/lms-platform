-- Track who assigned a learning path enrollment (manager/admin assignment).
-- Mirrors enrollments.assigned_by. NULL means the learner self-enrolled.

ALTER TABLE public.learning_path_enrollments
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lp_enrollments_assigned_by
  ON public.learning_path_enrollments(assigned_by);
