-- ============================================
-- LearnHub LMS - Initial Database Schema
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- ORGANIZATIONS
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'department' CHECK (type IN ('company', 'department', 'team', 'location')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_parent ON organizations(parent_id);

-- ============================================
-- USERS
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('super_admin', 'admin', 'manager', 'instructor', 'learner')),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  job_title TEXT,
  hire_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
CREATE INDEX idx_users_name_trgm ON users USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- ============================================
-- CATEGORIES
-- ============================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- COURSES
-- ============================================

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  thumbnail_url TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  course_type TEXT NOT NULL DEFAULT 'self_paced' CHECK (course_type IN ('self_paced', 'instructor_led', 'blended', 'scorm', 'external')),
  difficulty_level TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  estimated_duration INTEGER,
  passing_score INTEGER DEFAULT 70,
  max_attempts INTEGER,
  enrollment_type TEXT NOT NULL DEFAULT 'open' CHECK (enrollment_type IN ('open', 'approval', 'assigned')),
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_category ON courses(category_id);
CREATE INDEX idx_courses_type ON courses(course_type);
CREATE INDEX idx_courses_created_by ON courses(created_by);
CREATE INDEX idx_courses_title_trgm ON courses USING gin (title gin_trgm_ops);

-- ============================================
-- MODULES & LESSONS
-- ============================================

CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_modules_course ON modules(course_id);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('video', 'document', 'scorm', 'html', 'quiz', 'assignment')),
  content_url TEXT,
  content_data JSONB,
  duration INTEGER,
  sequence_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lessons_module ON lessons(module_id);

-- ============================================
-- ENROLLMENTS & PROGRESS
-- ============================================

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'failed', 'expired')),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  score NUMERIC(5,2),
  time_spent INTEGER DEFAULT 0,
  certificate_issued BOOLEAN DEFAULT false,
  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_enrollments_due ON enrollments(due_date);

CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  score NUMERIC(5,2),
  time_spent INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  bookmark_data JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_enrollment ON lesson_progress(enrollment_id);

-- ============================================
-- LEARNING PATHS
-- ============================================

CREATE TABLE learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  estimated_duration INTEGER,
  is_sequential BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE learning_path_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true
);

CREATE INDEX idx_lp_items_path ON learning_path_items(path_id);

CREATE TABLE learning_path_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'failed', 'expired')),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  UNIQUE(user_id, path_id)
);

-- ============================================
-- ASSESSMENTS
-- ============================================

CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,
  time_limit INTEGER,
  max_attempts INTEGER DEFAULT 3,
  randomize_questions BOOLEAN DEFAULT false,
  show_correct_answers BOOLEAN DEFAULT true,
  question_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_assessments_course ON assessments(course_id);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'multi_select', 'true_false', 'fill_blank', 'matching', 'ordering', 'essay')),
  points INTEGER DEFAULT 1,
  explanation TEXT,
  sequence_order INTEGER,
  options JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_questions_assessment ON questions(assessment_id);

CREATE TABLE assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  score NUMERIC(5,2),
  passed BOOLEAN,
  answers JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  time_spent INTEGER
);

CREATE INDEX idx_attempts_user ON assessment_attempts(user_id);
CREATE INDEX idx_attempts_assessment ON assessment_attempts(assessment_id);

-- ============================================
-- CERTIFICATIONS & COMPLIANCE
-- ============================================

CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB,
  validity_months INTEGER,
  recertification_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  recertification_path_id UUID REFERENCES learning_paths(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  certificate_url TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_user_certs_user ON user_certifications(user_id);
CREATE INDEX idx_user_certs_expires ON user_certifications(expires_at);
CREATE INDEX idx_user_certs_status ON user_certifications(status);

CREATE TABLE compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  regulation TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  path_id UUID REFERENCES learning_paths(id) ON DELETE SET NULL,
  frequency_months INTEGER,
  applicable_roles TEXT[] DEFAULT '{}',
  applicable_org_ids UUID[] DEFAULT '{}',
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SKILLS & COMPETENCIES
-- ============================================

CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  parent_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skills_category ON skills(category);

CREATE TABLE user_skills (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
  source TEXT DEFAULT 'assessment' CHECK (source IN ('assessment', 'self_reported', 'manager', 'course_completion')),
  assessed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE course_skills (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency_gained INTEGER CHECK (proficiency_gained BETWEEN 1 AND 5),
  PRIMARY KEY (course_id, skill_id)
);

CREATE TABLE competency_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  applicable_roles TEXT[] DEFAULT '{}',
  applicable_org_ids UUID[] DEFAULT '{}',
  skills JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- GAMIFICATION
-- ============================================

CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_points_user ON points_ledger(user_id);
CREATE INDEX idx_points_created ON points_ledger(created_at);

CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  criteria JSONB NOT NULL DEFAULT '{}',
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- ============================================
-- SOCIAL LEARNING
-- ============================================

CREATE TABLE discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES discussions(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_answer BOOLEAN DEFAULT false,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_discussions_course ON discussions(course_id);
CREATE INDEX idx_discussions_user ON discussions(user_id);
CREATE INDEX idx_discussions_parent ON discussions(parent_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('enrollment', 'reminder', 'completion', 'certification', 'announcement', 'mention')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  channel TEXT DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'push')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ============================================
-- AUDIT & ANALYTICS
-- ============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_created ON analytics_events(created_at);

-- ============================================
-- PLATFORM SETTINGS
-- ============================================

CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings
INSERT INTO platform_settings (key, value) VALUES
  ('general', '{"company_name": "LearnHub", "timezone": "America/New_York", "language": "en"}'),
  ('branding', '{"primary_color": "#4f46e5", "accent_color": "#06b6d4", "logo_url": null}'),
  ('features', '{"gamification": true, "social_learning": true, "skills_tracking": true, "self_registration": true, "course_ratings": true}'),
  ('notifications', '{"enrollment_email": true, "reminder_email": true, "completion_email": true, "digest_enabled": false, "digest_frequency": "weekly"}');

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER learning_paths_updated_at BEFORE UPDATE ON learning_paths FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER discussions_updated_at BEFORE UPDATE ON discussions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to calculate user points total
CREATE OR REPLACE FUNCTION get_user_points(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(points), 0)::INTEGER
  FROM points_ledger
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- Function to check course completion
CREATE OR REPLACE FUNCTION check_course_completion()
RETURNS TRIGGER AS $$
DECLARE
  total_required INTEGER;
  completed_required INTEGER;
BEGIN
  IF NEW.status = 'completed' THEN
    SELECT COUNT(*) INTO total_required
    FROM lessons l
    JOIN modules m ON l.module_id = m.id
    JOIN enrollments e ON e.course_id = m.course_id
    WHERE e.id = NEW.enrollment_id AND l.is_required = true;

    SELECT COUNT(*) INTO completed_required
    FROM lesson_progress lp
    JOIN lessons l ON lp.lesson_id = l.id
    JOIN modules m ON l.module_id = m.id
    JOIN enrollments e ON e.course_id = m.course_id
    WHERE e.id = NEW.enrollment_id AND l.is_required = true AND lp.status = 'completed';

    IF completed_required >= total_required AND total_required > 0 THEN
      UPDATE enrollments
      SET status = 'completed', completed_at = now()
      WHERE id = NEW.enrollment_id AND status != 'completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_completion_check
AFTER INSERT OR UPDATE ON lesson_progress
FOR EACH ROW EXECUTE FUNCTION check_course_completion();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;

-- Users can read their own data; admins can read all
CREATE POLICY users_select ON users FOR SELECT USING (
  auth.uid() = auth_id
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role = 'manager' AND u.id = users.manager_id)
);

CREATE POLICY users_update ON users FOR UPDATE USING (
  auth.uid() = auth_id
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin'))
);

-- Enrollments: users see own, managers see team, admins see all
CREATE POLICY enrollments_select ON enrollments FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin'))
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_id = auth.uid() AND u.role = 'manager'
    AND enrollments.user_id IN (SELECT id FROM users WHERE manager_id = u.id)
  )
);

CREATE POLICY enrollments_insert ON enrollments FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin', 'manager'))
);

-- Lesson progress: users see own
CREATE POLICY lesson_progress_select ON lesson_progress FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin'))
);

CREATE POLICY lesson_progress_all ON lesson_progress FOR ALL USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Notifications: users see own
CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY notifications_update ON notifications FOR UPDATE USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- User certifications
CREATE POLICY user_certs_select ON user_certifications FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin'))
);

-- User skills
CREATE POLICY user_skills_select ON user_skills FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin', 'manager'))
);

-- Points and badges
CREATE POLICY points_select ON points_ledger FOR SELECT USING (true);
CREATE POLICY badges_select ON user_badges FOR SELECT USING (true);

-- Assessment attempts
CREATE POLICY attempts_select ON assessment_attempts FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin'))
);

CREATE POLICY attempts_insert ON assessment_attempts FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- Discussions: all can read, own can write
CREATE POLICY discussions_select ON discussions FOR SELECT USING (true);
CREATE POLICY discussions_insert ON discussions FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY discussions_update ON discussions FOR UPDATE USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR EXISTS (SELECT 1 FROM users u WHERE u.auth_id = auth.uid() AND u.role IN ('admin', 'super_admin'))
);

-- Public read tables (no RLS needed for read)
-- courses, categories, modules, lessons, learning_paths, learning_path_items,
-- assessments, questions, certifications, compliance_requirements, skills,
-- competency_frameworks, badges, platform_settings are readable by all authenticated users
