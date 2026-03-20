-- =============================================================
-- Security: Enable RLS on all tables missing it
-- =============================================================

-- course_prerequisites (admin-managed, read by learners)
ALTER TABLE course_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view prerequisites" ON course_prerequisites FOR SELECT USING (true);
CREATE POLICY "Admins manage prerequisites" ON course_prerequisites FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- sso_providers (admin-only)
ALTER TABLE sso_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage SSO" ON sso_providers FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- learning_events (user owns their own events)
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own learning events" ON learning_events FOR ALL USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- user_learning_preferences (user owns their own preferences)
ALTER TABLE user_learning_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON user_learning_preferences FOR ALL USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- course_similarity (read-only for all authenticated, managed by system/cron)
ALTER TABLE course_similarity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view course similarity" ON course_similarity FOR SELECT USING (true);

-- enrollment_rules (admin-only)
ALTER TABLE enrollment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage enrollment rules" ON enrollment_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- enrollment_rule_logs (admin-only read)
ALTER TABLE enrollment_rule_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view enrollment rule logs" ON enrollment_rule_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- vc_integrations (admin-only)
ALTER TABLE vc_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage VC integrations" ON vc_integrations FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- calendar_events (users see their own events)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calendar events" ON calendar_events FOR ALL USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);
CREATE POLICY "Admins manage calendar events" ON calendar_events FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- certificate_templates (admin-managed, read by authenticated users)
ALTER TABLE certificate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view certificate templates" ON certificate_templates FOR SELECT USING (true);
CREATE POLICY "Admins manage certificate templates" ON certificate_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- microlearning_nuggets (admin-managed, read by learners)
ALTER TABLE microlearning_nuggets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active nuggets" ON microlearning_nuggets FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins manage nuggets" ON microlearning_nuggets FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- microlearning_progress (user owns their own)
ALTER TABLE microlearning_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own microlearning progress" ON microlearning_progress FOR ALL USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- microlearning_schedules (user owns their own)
ALTER TABLE microlearning_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own microlearning schedules" ON microlearning_schedules FOR ALL USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- embed_widgets (admin-managed)
ALTER TABLE embed_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage embed widgets" ON embed_widgets FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);
CREATE POLICY "Anyone can view active widgets" ON embed_widgets FOR SELECT USING (is_active = true);

-- xr_content (admin-managed, read by learners)
ALTER TABLE xr_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view XR content" ON xr_content FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage XR content" ON xr_content FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- xr_sessions (user owns their own)
ALTER TABLE xr_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own XR sessions" ON xr_sessions FOR ALL USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);

-- marketplace_providers (admin-managed)
ALTER TABLE marketplace_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active providers" ON marketplace_providers FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin')));
CREATE POLICY "Admins manage marketplace providers" ON marketplace_providers FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- marketplace_courses (read by all, managed by admins)
ALTER TABLE marketplace_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view synced marketplace courses" ON marketplace_courses FOR SELECT USING (true);
CREATE POLICY "Admins manage marketplace courses" ON marketplace_courses FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- marketplace_enrollments (user owns their own)
ALTER TABLE marketplace_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own marketplace enrollments" ON marketplace_enrollments FOR ALL USING (
  user_id = (SELECT id FROM users WHERE auth_id = auth.uid())
);
