-- Five-star ratings for courses and instructors, captured in the context of a
-- delivery so performance can be tracked by class/session, by instructor, by
-- client (tenant), and over time. A single row holds a learner's course and/or
-- instructor stars for one delivery, plus an optional comment.

CREATE TABLE IF NOT EXISTS public.course_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.ilt_sessions(id) ON DELETE SET NULL,
  instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  course_rating SMALLINT CHECK (course_rating BETWEEN 1 AND 5),
  instructor_rating SMALLINT CHECK (instructor_rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (course_rating IS NOT NULL OR instructor_rating IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_course_ratings_course ON public.course_ratings(course_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_instructor ON public.course_ratings(instructor_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_class ON public.course_ratings(class_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_tenant ON public.course_ratings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_course_ratings_created ON public.course_ratings(created_at);

ALTER TABLE public.course_ratings ENABLE ROW LEVEL SECURITY;

-- Learners manage their own ratings.
CREATE POLICY "Users manage own ratings" ON public.course_ratings
  FOR ALL
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- Staff can read all ratings for reporting.
CREATE POLICY "Staff read ratings" ON public.course_ratings
  FOR SELECT
  USING (current_user_role() IN ('admin', 'super_admin', 'instructor', 'manager'));
