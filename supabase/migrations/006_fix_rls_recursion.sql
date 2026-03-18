-- ============================================
-- Fix RLS Recursion on users table
-- ============================================
-- The original RLS policies on the users table query the users table
-- itself to check roles, causing infinite recursion. This migration
-- creates SECURITY DEFINER helper functions that bypass RLS, then
-- replaces the recursive policies with ones that use these functions.

-- Helper: get the current user's role without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$;

-- Helper: get the current user's internal UUID without triggering RLS
CREATE OR REPLACE FUNCTION public.get_my_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$;

-- ============================================
-- Replace users table policies
-- ============================================

DROP POLICY IF EXISTS users_select ON users;
DROP POLICY IF EXISTS users_update ON users;

CREATE POLICY users_select ON users FOR SELECT USING (
  auth.uid() = auth_id
  OR public.get_my_role() IN ('admin', 'super_admin')
  OR (public.get_my_role() = 'manager' AND manager_id = public.get_my_id())
);

CREATE POLICY users_update ON users FOR UPDATE USING (
  auth.uid() = auth_id
  OR public.get_my_role() IN ('admin', 'super_admin')
);

-- ============================================
-- Replace enrollments policies
-- ============================================

DROP POLICY IF EXISTS enrollments_select ON enrollments;
DROP POLICY IF EXISTS enrollments_insert ON enrollments;

CREATE POLICY enrollments_select ON enrollments FOR SELECT USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
  OR (public.get_my_role() = 'manager' AND user_id IN (
    SELECT id FROM users WHERE manager_id = public.get_my_id()
  ))
);

CREATE POLICY enrollments_insert ON enrollments FOR INSERT WITH CHECK (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin', 'manager')
);

-- ============================================
-- Replace lesson_progress policies
-- ============================================

DROP POLICY IF EXISTS lesson_progress_select ON lesson_progress;
DROP POLICY IF EXISTS lesson_progress_upsert ON lesson_progress;

CREATE POLICY lesson_progress_select ON lesson_progress FOR SELECT USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

CREATE POLICY lesson_progress_upsert ON lesson_progress FOR INSERT WITH CHECK (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

-- ============================================
-- Replace notifications policies
-- ============================================

DROP POLICY IF EXISTS notifications_select ON notifications;
DROP POLICY IF EXISTS notifications_update ON notifications;

CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

-- ============================================
-- Replace user_certifications policies
-- ============================================

DROP POLICY IF EXISTS user_certifications_select ON user_certifications;

CREATE POLICY user_certifications_select ON user_certifications FOR SELECT USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

-- ============================================
-- Replace user_skills policies
-- ============================================

DROP POLICY IF EXISTS user_skills_select ON user_skills;
DROP POLICY IF EXISTS user_skills_upsert ON user_skills;

CREATE POLICY user_skills_select ON user_skills FOR SELECT USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
  OR (public.get_my_role() = 'manager' AND user_id IN (
    SELECT id FROM users WHERE manager_id = public.get_my_id()
  ))
);

CREATE POLICY user_skills_upsert ON user_skills FOR ALL USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

-- ============================================
-- Replace user_badges policies
-- ============================================

DROP POLICY IF EXISTS user_badges_select ON user_badges;

CREATE POLICY user_badges_select ON user_badges FOR SELECT USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

-- ============================================
-- Replace points_ledger policies
-- ============================================

DROP POLICY IF EXISTS points_ledger_select ON points_ledger;

CREATE POLICY points_ledger_select ON points_ledger FOR SELECT USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

-- ============================================
-- Replace assessment_attempts policies
-- ============================================

DROP POLICY IF EXISTS assessment_attempts_select ON assessment_attempts;
DROP POLICY IF EXISTS assessment_attempts_insert ON assessment_attempts;

CREATE POLICY assessment_attempts_select ON assessment_attempts FOR SELECT USING (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

CREATE POLICY assessment_attempts_insert ON assessment_attempts FOR INSERT WITH CHECK (
  user_id = public.get_my_id()
  OR public.get_my_role() IN ('admin', 'super_admin')
);

-- ============================================
-- Replace discussions policies
-- ============================================

DROP POLICY IF EXISTS discussions_select ON discussions;

CREATE POLICY discussions_select ON discussions FOR SELECT USING (
  public.get_my_role() IS NOT NULL
);
