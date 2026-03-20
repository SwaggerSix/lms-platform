-- ============================================================
-- HRIS / CRM External Integrations
-- ============================================================

-- External integrations table
CREATE TABLE IF NOT EXISTS external_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hris', 'crm', 'hr_system')),
  provider TEXT NOT NULL CHECK (provider IN ('bamboohr', 'workday', 'adp', 'salesforce', 'hubspot', 'custom_webhook')),
  is_active BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  sync_direction TEXT CHECK (sync_direction IN ('import', 'export', 'both')) DEFAULT 'import',
  sync_frequency TEXT CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'manual')) DEFAULT 'daily',
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Integration sync logs
CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES external_integrations(id) ON DELETE CASCADE,
  sync_type TEXT CHECK (sync_type IN ('full', 'incremental')),
  status TEXT CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Integration field mappings
CREATE TABLE IF NOT EXISTS integration_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES external_integrations(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  transform TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_external_integrations_type ON external_integrations(type);
CREATE INDEX IF NOT EXISTS idx_external_integrations_provider ON external_integrations(provider);
CREATE INDEX IF NOT EXISTS idx_external_integrations_is_active ON external_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_external_integrations_created_by ON external_integrations(created_by);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_integration_id ON integration_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_status ON integration_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_started_at ON integration_sync_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_field_mappings_integration_id ON integration_field_mappings(integration_id);

-- Updated_at trigger
CREATE OR REPLACE TRIGGER set_external_integrations_updated_at
  BEFORE UPDATE ON external_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage external integrations"
  ON external_integrations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admins can view sync logs"
  ON integration_sync_logs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admins can manage field mappings"
  ON integration_field_mappings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin')
  );
