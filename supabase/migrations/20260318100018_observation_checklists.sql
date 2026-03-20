-- ============================================================
-- Observation Checklists
-- ============================================================

-- Observation templates
CREATE TABLE IF NOT EXISTS observation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  passing_score NUMERIC(5,2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Observations
CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES observation_templates(id),
  observer_id UUID NOT NULL REFERENCES users(id),
  subject_id UUID NOT NULL REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  status TEXT CHECK (status IN ('draft', 'in_progress', 'completed', 'signed_off')) DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  overall_score NUMERIC(5,2),
  responses JSONB DEFAULT '{}',
  sign_off_by UUID REFERENCES users(id),
  signed_off_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Observation attachments
CREATE TABLE IF NOT EXISTS observation_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_observation_templates_category ON observation_templates(category);
CREATE INDEX IF NOT EXISTS idx_observation_templates_is_active ON observation_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_observation_templates_created_by ON observation_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_observations_template_id ON observations(template_id);
CREATE INDEX IF NOT EXISTS idx_observations_observer_id ON observations(observer_id);
CREATE INDEX IF NOT EXISTS idx_observations_subject_id ON observations(subject_id);
CREATE INDEX IF NOT EXISTS idx_observations_course_id ON observations(course_id);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(status);
CREATE INDEX IF NOT EXISTS idx_observations_scheduled_at ON observations(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_observation_attachments_observation_id ON observation_attachments(observation_id);

-- Updated_at triggers
CREATE OR REPLACE TRIGGER set_observation_templates_updated_at
  BEFORE UPDATE ON observation_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER set_observations_updated_at
  BEFORE UPDATE ON observations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE observation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage observation templates"
  ON observation_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager', 'instructor'))
  );

CREATE POLICY "Users can view active observation templates"
  ON observation_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Observers can manage their observations"
  ON observations FOR ALL
  USING (
    observer_id = auth.uid()
    OR subject_id = auth.uid()
    OR sign_off_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

CREATE POLICY "Users can manage observation attachments"
  ON observation_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_attachments.observation_id
      AND (observations.observer_id = auth.uid() OR observations.subject_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );
