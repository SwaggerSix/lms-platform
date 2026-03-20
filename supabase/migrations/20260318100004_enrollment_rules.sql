-- Enrollment automation rules
CREATE TABLE IF NOT EXISTS enrollment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('user_created', 'role_changed', 'org_changed', 'hire_date', 'manual', 'course_completed', 'schedule')),
  conditions JSONB NOT NULL DEFAULT '{}',
  -- conditions format: { "role": ["learner"], "organization_id": ["uuid"], "hire_date_within_days": 30, "completed_course_id": "uuid" }
  actions JSONB NOT NULL DEFAULT '[]',
  -- actions format: [{ "type": "enroll_course", "course_id": "uuid", "due_days": 30 }, { "type": "enroll_path", "path_id": "uuid" }, { "type": "assign_badge", "badge_id": "uuid" }]
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log of rule executions
CREATE TABLE IF NOT EXISTS enrollment_rule_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES enrollment_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_target_id TEXT, -- course_id or path_id
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_enrollment_rules_active ON enrollment_rules(is_active);
CREATE INDEX idx_enrollment_rules_trigger ON enrollment_rules(trigger_type);
CREATE INDEX idx_rule_logs_rule ON enrollment_rule_logs(rule_id);
CREATE INDEX idx_rule_logs_user ON enrollment_rule_logs(user_id);
