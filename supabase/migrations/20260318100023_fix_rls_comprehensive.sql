-- =============================================================
-- Comprehensive RLS fix for all remaining tables
-- =============================================================

-- Helper: reusable function to get current user's app-level ID
CREATE OR REPLACE FUNCTION public.current_user_id() RETURNS UUID AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================
-- SECTION 1: Original schema tables missing RLS
-- =============================================================

-- organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view organizations" ON organizations FOR SELECT USING (true);
CREATE POLICY "Admins manage organizations" ON organizations FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON categories FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published courses" ON courses FOR SELECT USING (status = 'published' OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Admins manage courses" ON courses FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- modules
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view modules" ON modules FOR SELECT USING (true);
CREATE POLICY "Admins manage modules" ON modules FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- lessons
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view lessons" ON lessons FOR SELECT USING (true);
CREATE POLICY "Admins manage lessons" ON lessons FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- learning_paths
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view learning paths" ON learning_paths FOR SELECT USING (true);
CREATE POLICY "Admins manage learning paths" ON learning_paths FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- learning_path_items
ALTER TABLE learning_path_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view learning path items" ON learning_path_items FOR SELECT USING (true);
CREATE POLICY "Admins manage learning path items" ON learning_path_items FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- learning_path_enrollments
ALTER TABLE learning_path_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own path enrollments" ON learning_path_enrollments FOR SELECT USING (user_id = current_user_id());
CREATE POLICY "Admins manage path enrollments" ON learning_path_enrollments FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- assessments
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view assessments" ON assessments FOR SELECT USING (true);
CREATE POLICY "Admins manage assessments" ON assessments FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- questions
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Admins manage questions" ON questions FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- certifications
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view certifications" ON certifications FOR SELECT USING (true);
CREATE POLICY "Admins manage certifications" ON certifications FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- compliance_requirements
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view compliance requirements" ON compliance_requirements FOR SELECT USING (true);
CREATE POLICY "Admins manage compliance" ON compliance_requirements FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- skills
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view skills" ON skills FOR SELECT USING (true);
CREATE POLICY "Admins manage skills" ON skills FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- course_skills
ALTER TABLE course_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view course skills" ON course_skills FOR SELECT USING (true);
CREATE POLICY "Admins manage course skills" ON course_skills FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- competency_frameworks
ALTER TABLE competency_frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view frameworks" ON competency_frameworks FOR SELECT USING (true);
CREATE POLICY "Admins manage frameworks" ON competency_frameworks FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- badges
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON badges FOR SELECT USING (true);
CREATE POLICY "Admins manage badges" ON badges FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- =============================================================
-- SECTION 2: Tables with RLS but no policies (add policies)
-- =============================================================

-- ecommerce tables
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (status = 'active' OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Admins manage products" ON products FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (user_id = current_user_id());
CREATE POLICY "Users create orders" ON orders FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY "Admins manage orders" ON orders FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Users view own order items" ON order_items FOR SELECT USING (
  order_id IN (SELECT id FROM orders WHERE user_id = current_user_id())
);
CREATE POLICY "Admins manage order items" ON order_items FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Anyone can view active coupons" ON coupons FOR SELECT USING (is_active = true OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Admins manage coupons" ON coupons FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Users manage own cart" ON cart_items FOR ALL USING (user_id = current_user_id());
CREATE POLICY "Admins view all carts" ON cart_items FOR SELECT USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins manage instructor payouts" ON instructor_payouts FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Instructors view own payouts" ON instructor_payouts FOR SELECT USING (instructor_id = current_user_id());

-- 360 feedback tables
CREATE POLICY "Admins manage feedback cycles" ON feedback_cycles FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Users view active cycles" ON feedback_cycles FOR SELECT USING (status IN ('active', 'completed'));

CREATE POLICY "Admins manage feedback templates" ON feedback_templates FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Users view feedback templates" ON feedback_templates FOR SELECT USING (true);

CREATE POLICY "Users view own nominations" ON feedback_nominations FOR SELECT USING (
  subject_id = current_user_id() OR reviewer_id = current_user_id() OR nominated_by = current_user_id()
);
CREATE POLICY "Users create nominations" ON feedback_nominations FOR INSERT WITH CHECK (nominated_by = current_user_id());
CREATE POLICY "Admins manage nominations" ON feedback_nominations FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Users manage own responses" ON feedback_responses FOR ALL USING (
  nomination_id IN (SELECT id FROM feedback_nominations WHERE reviewer_id = current_user_id())
);
CREATE POLICY "Admins manage all responses" ON feedback_responses FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Admins manage feedback competencies" ON feedback_competencies FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Users view competencies" ON feedback_competencies FOR SELECT USING (true);

-- AI chatbot tables
CREATE POLICY "Users manage own chat sessions" ON chat_sessions FOR ALL USING (user_id = current_user_id());

CREATE POLICY "Users manage own chat messages" ON chat_messages FOR ALL USING (
  session_id IN (SELECT id FROM chat_sessions WHERE user_id = current_user_id())
);

-- =============================================================
-- SECTION 3: Fix broken auth.uid() policies
-- Replace user_id = auth.uid() with user_id = current_user_id()
-- Replace users.id = auth.uid() with users.auth_id = auth.uid()
-- =============================================================

-- Mentorship policies (20260318100015)
-- Drop old broken auth.uid() policies
DROP POLICY IF EXISTS "Users can view active mentor profiles" ON mentor_profiles;
DROP POLICY IF EXISTS "Users can manage own mentor profile" ON mentor_profiles;
DROP POLICY IF EXISTS "Users can view own mentorship requests" ON mentorship_requests;
DROP POLICY IF EXISTS "Users can create mentorship requests" ON mentorship_requests;
DROP POLICY IF EXISTS "Users can view sessions for their requests" ON mentorship_sessions;
DROP POLICY IF EXISTS "Users can view reviews" ON mentor_reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON mentor_reviews;

CREATE POLICY "Users view mentor profiles" ON mentor_profiles FOR SELECT USING (is_active = true OR user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Users manage own mentor profile" ON mentor_profiles FOR ALL USING (user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Users view own mentorship requests" ON mentorship_requests FOR SELECT USING (
  mentee_id = current_user_id() OR mentor_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin')
);
CREATE POLICY "Mentees create requests" ON mentorship_requests FOR INSERT WITH CHECK (mentee_id = current_user_id());
CREATE POLICY "Request participants update" ON mentorship_requests FOR UPDATE USING (
  mentee_id = current_user_id() OR mentor_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin')
);

CREATE POLICY "Users view own mentorship sessions" ON mentorship_sessions FOR SELECT USING (
  request_id IN (SELECT id FROM mentorship_requests WHERE mentee_id = current_user_id() OR mentor_id = current_user_id())
  OR current_user_role() IN ('admin', 'super_admin')
);
CREATE POLICY "Session participants manage" ON mentorship_sessions FOR ALL USING (
  request_id IN (SELECT id FROM mentorship_requests WHERE mentee_id = current_user_id() OR mentor_id = current_user_id())
  OR current_user_role() IN ('admin', 'super_admin')
);

CREATE POLICY "Anyone view reviews" ON mentor_reviews FOR SELECT USING (true);
CREATE POLICY "Users write reviews" ON mentor_reviews FOR INSERT WITH CHECK (reviewer_id = current_user_id());

-- Predictive analytics policies (20260318100016)
DROP POLICY IF EXISTS "Users can view their own risk predictions" ON risk_predictions;
DROP POLICY IF EXISTS "Users can view their own snapshots" ON learning_analytics_snapshots;
DROP POLICY IF EXISTS "Users can view their own alerts" ON analytics_alerts;
DROP POLICY IF EXISTS "Users can update their own alerts" ON analytics_alerts;

CREATE POLICY "Users view own risk predictions" ON risk_predictions FOR SELECT USING (
  user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin', 'manager')
);

CREATE POLICY "Users view own snapshots" ON learning_analytics_snapshots FOR SELECT USING (
  user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin', 'manager')
);

CREATE POLICY "Users view own alerts" ON analytics_alerts FOR SELECT USING (
  user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin', 'manager')
);
CREATE POLICY "Users update own alerts" ON analytics_alerts FOR UPDATE USING (
  user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin')
);

-- HRIS integration policies (20260318100017)
DROP POLICY IF EXISTS "Admins can manage external integrations" ON external_integrations;
DROP POLICY IF EXISTS "Admins can manage sync logs" ON integration_sync_logs;
DROP POLICY IF EXISTS "Admins can manage field mappings" ON integration_field_mappings;

CREATE POLICY "Admins manage external integrations" ON external_integrations FOR ALL USING (
  current_user_role() IN ('admin', 'super_admin')
);

CREATE POLICY "Admins manage sync logs" ON integration_sync_logs FOR ALL USING (
  current_user_role() IN ('admin', 'super_admin')
);

CREATE POLICY "Admins manage field mappings" ON integration_field_mappings FOR ALL USING (
  current_user_role() IN ('admin', 'super_admin')
);

-- Observation checklists policies (20260318100018)
-- Drop old broken auth.uid() policies
DROP POLICY IF EXISTS "Admins and managers can manage observation templates" ON observation_templates;
DROP POLICY IF EXISTS "Users can view active observation templates" ON observation_templates;
DROP POLICY IF EXISTS "Observers can manage their observations" ON observations;
DROP POLICY IF EXISTS "Users can manage observation attachments" ON observation_attachments;

CREATE POLICY "Admins managers manage templates" ON observation_templates FOR ALL USING (
  current_user_role() IN ('admin', 'super_admin', 'manager', 'instructor')
);
CREATE POLICY "Anyone view active templates" ON observation_templates FOR SELECT USING (is_active = true);

CREATE POLICY "Observers manage observations" ON observations FOR ALL USING (
  observer_id = current_user_id() OR subject_id = current_user_id() OR sign_off_by = current_user_id()
  OR current_user_role() IN ('admin', 'super_admin', 'manager')
);

CREATE POLICY "Users manage observation attachments" ON observation_attachments FOR ALL USING (
  EXISTS (SELECT 1 FROM observations WHERE observations.id = observation_attachments.observation_id
    AND (observations.observer_id = current_user_id() OR observations.subject_id = current_user_id()))
  OR current_user_role() IN ('admin', 'super_admin', 'manager')
);

-- =============================================================
-- SECTION 4: Fix overly permissive content authoring policies
-- =============================================================

DROP POLICY IF EXISTS "Authenticated users can read content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Authenticated users can write content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Authenticated users can read content templates" ON content_templates;
DROP POLICY IF EXISTS "Authenticated users can write content templates" ON content_templates;

CREATE POLICY "Anyone can read content blocks" ON content_blocks FOR SELECT USING (true);
CREATE POLICY "Admins manage content blocks" ON content_blocks FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

CREATE POLICY "Anyone can read content templates" ON content_templates FOR SELECT USING (true);
CREATE POLICY "Admins manage content templates" ON content_templates FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- =============================================================
-- SECTION 5: Fix workflow/xapi policies missing super_admin
-- =============================================================

-- Add super_admin to workflow policies
DROP POLICY IF EXISTS "Admins can manage workflows" ON workflows;
DROP POLICY IF EXISTS "Admins can manage workflow steps" ON workflow_steps;
DROP POLICY IF EXISTS "Admins can view workflow runs" ON workflow_runs;
DROP POLICY IF EXISTS "Admins can view workflow step logs" ON workflow_step_logs;

CREATE POLICY "Admins manage workflows" ON workflows FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Admins manage workflow steps" ON workflow_steps FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Admins view workflow runs" ON workflow_runs FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Admins view workflow step logs" ON workflow_step_logs FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- =============================================================
-- SECTION 6: Remaining tables missing RLS entirely
-- =============================================================

-- analytics_events
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own analytics events" ON analytics_events FOR SELECT USING (user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Users create own analytics events" ON analytics_events FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY "Admins manage analytics events" ON analytics_events FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON audit_logs FOR SELECT USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "System insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);

-- platform_settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read platform settings" ON platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage platform settings" ON platform_settings FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own conversations" ON conversations FOR SELECT USING (
  created_by = current_user_id()
  OR id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = current_user_id())
  OR current_user_role() IN ('admin', 'super_admin')
);
CREATE POLICY "Users create conversations" ON conversations FOR INSERT WITH CHECK (created_by = current_user_id());
CREATE POLICY "Admins manage conversations" ON conversations FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- conversation_participants
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own participation" ON conversation_participants FOR SELECT USING (user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Users manage own participation" ON conversation_participants FOR ALL USING (user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));

-- messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view messages in own conversations" ON messages FOR SELECT USING (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = current_user_id())
  OR current_user_role() IN ('admin', 'super_admin')
);
CREATE POLICY "Users send messages" ON messages FOR INSERT WITH CHECK (sender_id = current_user_id());
CREATE POLICY "Users edit own messages" ON messages FOR UPDATE USING (sender_id = current_user_id());

-- document_folders
ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view document folders" ON document_folders FOR SELECT USING (true);
CREATE POLICY "Admins manage document folders" ON document_folders FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view documents" ON documents FOR SELECT USING (true);
CREATE POLICY "Admins manage documents" ON documents FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- document_acknowledgments
ALTER TABLE document_acknowledgments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own acknowledgments" ON document_acknowledgments FOR SELECT USING (user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Users create own acknowledgments" ON document_acknowledgments FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY "Admins manage acknowledgments" ON document_acknowledgments FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- enrollment_approvals
ALTER TABLE enrollment_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own enrollment approvals" ON enrollment_approvals FOR SELECT USING (
  learner_id = current_user_id() OR approver_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin', 'manager')
);
CREATE POLICY "Users create enrollment approvals" ON enrollment_approvals FOR INSERT WITH CHECK (learner_id = current_user_id());
CREATE POLICY "Approvers update approvals" ON enrollment_approvals FOR UPDATE USING (
  approver_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin', 'manager')
);

-- ilt_sessions
ALTER TABLE ilt_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ILT sessions" ON ilt_sessions FOR SELECT USING (true);
CREATE POLICY "Instructors manage own sessions" ON ilt_sessions FOR ALL USING (instructor_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));

-- ilt_attendance
ALTER TABLE ilt_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own attendance" ON ilt_attendance FOR SELECT USING (user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin', 'manager'));
CREATE POLICY "Admins manage attendance" ON ilt_attendance FOR ALL USING (current_user_role() IN ('admin', 'super_admin', 'manager'));

-- kb_categories
ALTER TABLE kb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view KB categories" ON kb_categories FOR SELECT USING (true);
CREATE POLICY "Admins manage KB categories" ON kb_categories FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));

-- kb_articles
ALTER TABLE kb_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published KB articles" ON kb_articles FOR SELECT USING (status = 'published' OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Authors manage own articles" ON kb_articles FOR ALL USING (author_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));

-- scheduled_reports
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage scheduled reports" ON scheduled_reports FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Creators view own reports" ON scheduled_reports FOR SELECT USING (created_by = current_user_id());

-- transcript_exports
ALTER TABLE transcript_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transcript exports" ON transcript_exports FOR SELECT USING (user_id = current_user_id() OR current_user_role() IN ('admin', 'super_admin'));
CREATE POLICY "Users create own transcript exports" ON transcript_exports FOR INSERT WITH CHECK (user_id = current_user_id());
CREATE POLICY "Admins manage transcript exports" ON transcript_exports FOR ALL USING (current_user_role() IN ('admin', 'super_admin'));
