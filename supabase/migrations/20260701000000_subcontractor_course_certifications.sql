-- Gotham Course Certifications
--
-- Tracks which gC / GGS courses a subcontractor (instructor) is certified to
-- deliver. Each row records one course a subcontractor is certified for, along
-- with the date the certification was granted. The mere presence of a row means
-- "certified"; removing the row un-certifies them for that course.
--
-- This backs the hidden "Gotham Course Certifications" page on a subcontractor
-- profile, which is visible only to admins/super admins and (project) managers.

CREATE TABLE IF NOT EXISTS public.subcontractor_course_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The subcontractor being certified.
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- The gC / GGS course they are certified to deliver.
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  -- Date the certification was granted (entered by the admin/PM).
  certified_date DATE,
  -- Who recorded the certification (admin / super_admin / manager).
  certified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One certification record per (subcontractor, course).
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_subcontractor_course_certs_user
  ON public.subcontractor_course_certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_course_certs_course
  ON public.subcontractor_course_certifications(course_id);

ALTER TABLE public.subcontractor_course_certifications ENABLE ROW LEVEL SECURITY;

-- Admins, super admins and (project) managers manage every certification.
-- No self-service: this is a staff-only record, so there is intentionally no
-- policy granting instructors access to their own rows.
CREATE POLICY "Staff manage subcontractor course certifications"
  ON public.subcontractor_course_certifications
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin', 'manager'));
