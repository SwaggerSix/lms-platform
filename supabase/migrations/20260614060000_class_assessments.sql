-- Per-class exam deployment.
--
-- By default a class (cohort) surfaces all of its course's assessments. When
-- rows exist here, the class instead surfaces only the deployed subset — letting
-- staff choose which exams apply to a specific delivery.

CREATE TABLE IF NOT EXISTS public.class_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS idx_class_assessments_class ON public.class_assessments(class_id);

ALTER TABLE public.class_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage class assessments" ON public.class_assessments
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin', 'instructor'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin', 'instructor'));

CREATE POLICY "Authenticated read class assessments" ON public.class_assessments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
