-- ============================================
-- LearnHub LMS - Missing Tables & RLS Policies
-- ============================================
-- All tables referenced in API routes already exist in migrations 001 and 003.
-- This migration adds missing RLS policies for tables that were created
-- without them, using CREATE TABLE IF NOT EXISTS to be safe against
-- any edge cases where a table might not have been applied.

-- ============================================
-- SAFE TABLE CREATION (all already exist, but IF NOT EXISTS for safety)
-- ============================================

CREATE TABLE IF NOT EXISTS kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  parent_id UUID REFERENCES kb_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_faq BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('completion', 'compliance', 'enrollment', 'skills_gap', 'engagement', 'learner_progress', 'ilt_attendance', 'custom')),
  filters JSONB DEFAULT '{}',
  schedule_frequency TEXT NOT NULL CHECK (schedule_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  schedule_day INTEGER,
  schedule_time TIME NOT NULL DEFAULT '09:00',
  schedule_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  delivery_method TEXT NOT NULL DEFAULT 'email' CHECK (delivery_method IN ('email', 'download', 'both')),
  recipients TEXT[] DEFAULT '{}',
  format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'xlsx')),
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES (IF NOT EXISTS not supported for indexes, so wrap in DO blocks)
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analytics_events_user') THEN
    CREATE INDEX idx_analytics_events_user ON analytics_events(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analytics_events_type') THEN
    CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_analytics_events_created') THEN
    CREATE INDEX idx_analytics_events_created ON analytics_events(created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kb_articles_category') THEN
    CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kb_articles_status') THEN
    CREATE INDEX idx_kb_articles_status ON kb_articles(status);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_kb_articles_slug') THEN
    CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_scheduled_reports_active') THEN
    CREATE INDEX idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_scheduled_reports_next_run') THEN
    CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY - Tables from 003_portal_features
-- ============================================

-- ── Knowledge Base Categories ──
ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON kb_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "authenticated_read" ON kb_categories FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- ── Knowledge Base Articles ──
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON kb_articles FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "authenticated_read_published" ON kb_articles FOR SELECT USING (
  status = 'published' AND auth.uid() IS NOT NULL
);

CREATE POLICY "author_manage_own" ON kb_articles FOR ALL USING (
  author_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- ── Scheduled Reports ──
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON scheduled_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "creator_manage_own" ON scheduled_reports FOR ALL USING (
  created_by IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "manager_read_own" ON scheduled_reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.auth_id = auth.uid()
    AND users.role = 'manager'
    AND users.id = scheduled_reports.created_by
  )
);

-- ── Enrollment Approvals ──
ALTER TABLE enrollment_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON enrollment_approvals FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "learner_read_own" ON enrollment_approvals FOR SELECT USING (
  learner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "learner_insert_own" ON enrollment_approvals FOR INSERT WITH CHECK (
  learner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "approver_manage" ON enrollment_approvals FOR ALL USING (
  approver_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "manager_read_team" ON enrollment_approvals FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users mgr
    WHERE mgr.auth_id = auth.uid()
    AND mgr.role = 'manager'
    AND enrollment_approvals.learner_id IN (SELECT id FROM users WHERE manager_id = mgr.id)
  )
);

-- ── ILT Sessions ──
ALTER TABLE ilt_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON ilt_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "authenticated_read" ON ilt_sessions FOR SELECT USING (
  auth.uid() IS NOT NULL
);

CREATE POLICY "instructor_manage_own" ON ilt_sessions FOR ALL USING (
  instructor_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- ── ILT Attendance ──
ALTER TABLE ilt_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON ilt_attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "user_read_own" ON ilt_attendance FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "user_register_self" ON ilt_attendance FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "manager_read_team" ON ilt_attendance FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users mgr
    WHERE mgr.auth_id = auth.uid()
    AND mgr.role = 'manager'
    AND ilt_attendance.user_id IN (SELECT id FROM users WHERE manager_id = mgr.id)
  )
);

CREATE POLICY "instructor_manage_session" ON ilt_attendance FOR ALL USING (
  EXISTS (
    SELECT 1 FROM ilt_sessions s
    JOIN users u ON u.auth_id = auth.uid()
    WHERE s.id = ilt_attendance.session_id
    AND s.instructor_id = u.id
  )
);

-- ── Conversations ──
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON conversations FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "participant_access" ON conversations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    JOIN users u ON u.auth_id = auth.uid()
    WHERE cp.conversation_id = conversations.id AND cp.user_id = u.id
  )
);

CREATE POLICY "creator_manage" ON conversations FOR ALL USING (
  created_by IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- ── Conversation Participants ──
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON conversation_participants FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "participant_read" ON conversation_participants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp2
    JOIN users u ON u.auth_id = auth.uid()
    WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = u.id
  )
);

-- ── Messages ──
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "participant_read" ON messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    JOIN users u ON u.auth_id = auth.uid()
    WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = u.id
  )
);

CREATE POLICY "sender_insert" ON messages FOR INSERT WITH CHECK (
  sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "sender_update_own" ON messages FOR UPDATE USING (
  sender_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- ── Documents ──
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON documents FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "all_read_visible" ON documents FOR SELECT USING (
  visibility = 'all' AND auth.uid() IS NOT NULL
);

CREATE POLICY "managers_read_manager_docs" ON documents FOR SELECT USING (
  visibility = 'managers'
  AND EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('manager', 'admin', 'super_admin'))
);

-- ── Document Folders ──
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON document_folders FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "all_read_visible" ON document_folders FOR SELECT USING (
  visibility = 'all' AND auth.uid() IS NOT NULL
);

CREATE POLICY "managers_read_manager_folders" ON document_folders FOR SELECT USING (
  visibility = 'managers'
  AND EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('manager', 'admin', 'super_admin'))
);

-- ── Document Acknowledgments ──
ALTER TABLE document_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON document_acknowledgments FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "user_read_own" ON document_acknowledgments FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "user_insert_own" ON document_acknowledgments FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- ── Transcript Exports ──
ALTER TABLE transcript_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON transcript_exports FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "user_read_own" ON transcript_exports FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "manager_read_team" ON transcript_exports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users mgr
    WHERE mgr.auth_id = auth.uid()
    AND mgr.role = 'manager'
    AND transcript_exports.user_id IN (SELECT id FROM users WHERE manager_id = mgr.id)
  )
);

-- ============================================
-- ROW LEVEL SECURITY - Tables from 001 missing RLS
-- ============================================

-- ── Analytics Events ──
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON analytics_events FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "user_insert_own" ON analytics_events FOR INSERT WITH CHECK (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
  OR user_id IS NULL
);

CREATE POLICY "user_read_own" ON analytics_events FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

CREATE POLICY "manager_read_team" ON analytics_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users mgr
    WHERE mgr.auth_id = auth.uid()
    AND mgr.role = 'manager'
    AND analytics_events.user_id IN (SELECT id FROM users WHERE manager_id = mgr.id)
  )
);

-- ── Platform Settings ──
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON platform_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "authenticated_read" ON platform_settings FOR SELECT USING (
  auth.uid() IS NOT NULL
);

-- ── Audit Logs ──
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON audit_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role IN ('admin', 'super_admin'))
);

CREATE POLICY "user_read_own" ON audit_logs FOR SELECT USING (
  user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- ============================================
-- UPDATED_AT TRIGGERS for portal feature tables
-- ============================================

CREATE TRIGGER kb_categories_updated_at BEFORE UPDATE ON kb_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER kb_articles_updated_at BEFORE UPDATE ON kb_articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER scheduled_reports_updated_at BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER enrollment_approvals_updated_at BEFORE UPDATE ON enrollment_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ilt_sessions_updated_at BEFORE UPDATE ON ilt_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER ilt_attendance_updated_at BEFORE UPDATE ON ilt_attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER document_folders_updated_at BEFORE UPDATE ON document_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
