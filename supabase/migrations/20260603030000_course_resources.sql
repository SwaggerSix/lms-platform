-- Course content artifacts attached to a course: presentation decks, videos,
-- learner guides, facilitator guides, and other materials. Distinct from
-- lessons (in-player content) and from learners' personal document copies.

CREATE TABLE IF NOT EXISTS public.course_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'course_material'
    CHECK (resource_type IN (
      'presentation_deck', 'video', 'learner_guide',
      'facilitator_guide', 'course_material', 'other'
    )),
  -- Who the artifact is for. Facilitator-only resources (e.g. facilitator
  -- guides) are hidden from learners.
  audience TEXT NOT NULL DEFAULT 'learner'
    CHECK (audience IN ('learner', 'facilitator')),
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_resources_course ON public.course_resources(course_id);

ALTER TABLE public.course_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and instructors manage course resources" ON public.course_resources
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin', 'instructor'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin', 'instructor'));

CREATE POLICY "Authenticated can read course resources" ON public.course_resources
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
