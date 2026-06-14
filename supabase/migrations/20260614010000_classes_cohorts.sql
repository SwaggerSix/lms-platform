-- Classes (cohorts / dated offerings of a course).
--
-- A "class" is a scheduled run of a course: one course can run as multiple
-- classes (e.g. "June 2026 Cohort", "September 2026 Cohort"), each with its own
-- roster, sessions, and invitations. This is the unit that ties together
-- everything a participant needs in one place — the "class card":
--   * ILT sessions          (ilt_sessions.class_id)
--   * course materials       (course_resources via course_id)
--   * exams / assessments    (assessments via course_id + quiz lessons)
--   * the roster             (class_participants)
--   * invitations            (class_invitations)

-- ============================================================================
-- classes
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  instructor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  max_capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  -- How learners join: by invitation (default), open self-join, or request+approval.
  enrollment_type TEXT NOT NULL DEFAULT 'invite'
    CHECK (enrollment_type IN ('open', 'invite', 'approval')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classes_course ON public.classes(course_id);
CREATE INDEX IF NOT EXISTS idx_classes_status ON public.classes(status);

-- Tie ILT sessions to a class (cohort). Nullable so existing course-level
-- sessions keep working; new scheduling attaches sessions to a class.
ALTER TABLE public.ilt_sessions
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ilt_sessions_class ON public.ilt_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_ilt_sessions_course_date ON public.ilt_sessions(course_id, session_date);

-- ============================================================================
-- class_participants (the roster)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.class_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'learner'
    CHECK (role IN ('learner', 'instructor', 'observer')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'removed', 'completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_class_participants_class ON public.class_participants(class_id);
CREATE INDEX IF NOT EXISTS idx_class_participants_user ON public.class_participants(user_id);

-- ============================================================================
-- class_invitations
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.class_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_role TEXT NOT NULL DEFAULT 'learner'
    CHECK (invited_role IN ('learner', 'instructor', 'observer')),
  token TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_invitations_class ON public.class_invitations(class_id);
CREATE INDEX IF NOT EXISTS idx_class_invitations_email ON public.class_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_class_invitations_token ON public.class_invitations(token);

-- ============================================================================
-- Row Level Security
-- API routes use the service client (bypasses RLS); these policies are
-- defense-in-depth and mirror the course_resources convention.
-- ============================================================================
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_invitations ENABLE ROW LEVEL SECURITY;

-- classes: staff manage; authenticated can read.
CREATE POLICY "Staff manage classes" ON public.classes
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin', 'instructor'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin', 'instructor'));

CREATE POLICY "Authenticated can read classes" ON public.classes
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- class_participants: staff manage; users can read their own membership.
CREATE POLICY "Staff manage class participants" ON public.class_participants
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin', 'instructor'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin', 'instructor'));

CREATE POLICY "Users read own class participation" ON public.class_participants
  FOR SELECT
  USING (user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin', 'instructor'));

-- class_invitations: staff only (the accept flow runs through the service client).
CREATE POLICY "Staff manage class invitations" ON public.class_invitations
  FOR ALL
  USING (current_user_role() IN ('admin', 'super_admin', 'instructor'))
  WITH CHECK (current_user_role() IN ('admin', 'super_admin', 'instructor'));
