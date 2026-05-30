-- Course-level instructor assignments.
--
-- Pairs an instructor with a course so they can manage that course's classes,
-- materials, participants, and evaluations from the instructor portal.
-- Session-level assignment continues to use ilt_sessions.instructor_id; an
-- instructor's portal surfaces the union of course-level assignments, courses
-- they created, and courses they teach scheduled sessions for.

CREATE TABLE IF NOT EXISTS public.course_instructors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, instructor_id)
);

CREATE INDEX IF NOT EXISTS idx_course_instructors_course
  ON public.course_instructors(course_id);
CREATE INDEX IF NOT EXISTS idx_course_instructors_instructor
  ON public.course_instructors(instructor_id);

ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;

-- Admins and super admins manage all assignments.
CREATE POLICY "Admins manage course instructors" ON public.course_instructors
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin'));

-- Instructors can read their own assignments.
CREATE POLICY "Instructors view own course assignments" ON public.course_instructors
  FOR SELECT
  USING (instructor_id = current_user_id());
