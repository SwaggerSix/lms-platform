-- Workflow Automation Engine
-- Extends basic enrollment_rules into a full visual workflow builder

-- ── Workflows table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'schedule', 'webhook', 'manual')),
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_run_at TIMESTAMPTZ,
  run_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Workflow steps table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL CHECK (step_type IN ('condition', 'action', 'delay', 'branch', 'loop')),
  step_config JSONB NOT NULL DEFAULT '{}',
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  next_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  true_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  false_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  sequence_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Workflow runs table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
  trigger_data JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- ── Workflow step logs table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_sequence ON workflow_steps(workflow_id, sequence_order);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_run_id ON workflow_step_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_step_id ON workflow_step_logs(step_id);

-- ── RLS Policies ────────────────────────────────────────────────────────────
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access for all workflow tables
CREATE POLICY "Admin full access on workflows" ON workflows
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admin full access on workflow_steps" ON workflow_steps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admin full access on workflow_runs" ON workflow_runs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admin full access on workflow_step_logs" ON workflow_step_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── Updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_workflows_updated_at();
