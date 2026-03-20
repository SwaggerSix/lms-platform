-- Training Evaluations Module
-- Migration: 20260318100029_training_evaluations.sql

-- Reusable evaluation templates (survey definitions)
CREATE TABLE IF NOT EXISTS evaluation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- Kirkpatrick level: 1=reaction, 2=learning, 3=behavior, 4=results
  level INTEGER NOT NULL DEFAULT 1 CHECK (level IN (1, 2, 3, 4)),
  questions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rules: which template fires for which course, and when
CREATE TABLE IF NOT EXISTS evaluation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  -- delay_days: 0 = immediately on completion, 7 = 7 days later, etc.
  delay_days INTEGER NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(course_id, template_id)
);

-- Individual survey assignments (one per user per trigger)
CREATE TABLE IF NOT EXISTS evaluation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES evaluation_triggers(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES evaluation_templates(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trigger_id, user_id)
);

-- Submitted responses to an assignment
CREATE TABLE IF NOT EXISTS evaluation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES evaluation_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_eval_templates_active ON evaluation_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_eval_templates_level ON evaluation_templates(level);
CREATE INDEX IF NOT EXISTS idx_eval_triggers_course ON evaluation_triggers(course_id);
CREATE INDEX IF NOT EXISTS idx_eval_triggers_template ON evaluation_triggers(template_id);
CREATE INDEX IF NOT EXISTS idx_eval_triggers_active ON evaluation_triggers(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_eval_assignments_user ON evaluation_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_course ON evaluation_assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_status ON evaluation_assignments(status);
CREATE INDEX IF NOT EXISTS idx_eval_assignments_trigger ON evaluation_assignments(trigger_id);
CREATE INDEX IF NOT EXISTS idx_eval_responses_assignment ON evaluation_responses(assignment_id);
CREATE INDEX IF NOT EXISTS idx_eval_responses_user ON evaluation_responses(user_id);

-- Enable RLS
ALTER TABLE evaluation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: evaluation_templates
CREATE POLICY "Admins manage evaluation templates"
  ON evaluation_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "All authenticated users can view active templates"
  ON evaluation_templates
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies: evaluation_triggers
CREATE POLICY "Admins manage evaluation triggers"
  ON evaluation_triggers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Authenticated users can view active triggers"
  ON evaluation_triggers
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- RLS Policies: evaluation_assignments
CREATE POLICY "Users see their own assignments"
  ON evaluation_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins see all assignments"
  ON evaluation_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'manager')
    )
  );

CREATE POLICY "System can insert assignments"
  ON evaluation_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies: evaluation_responses
CREATE POLICY "Users manage their own responses"
  ON evaluation_responses
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all responses"
  ON evaluation_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'manager')
    )
  );

-- updated_at trigger for templates
CREATE OR REPLACE FUNCTION update_evaluation_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evaluation_templates_updated_at
  BEFORE UPDATE ON evaluation_templates
  FOR EACH ROW EXECUTE FUNCTION update_evaluation_templates_updated_at();
