-- xAPI / Learning Record Store (LRS) integration tables
-- Supports xAPI 1.0.3 specification

-- xAPI Statements table
CREATE TABLE IF NOT EXISTS xapi_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id TEXT UNIQUE NOT NULL,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verb TEXT NOT NULL,
  verb_display TEXT,
  object_type TEXT NOT NULL CHECK (object_type IN ('activity', 'agent', 'group', 'statement_ref')),
  object_id TEXT NOT NULL,
  object_name TEXT,
  result_score_scaled NUMERIC(5,4),
  result_score_raw NUMERIC(10,2),
  result_score_min NUMERIC(10,2),
  result_score_max NUMERIC(10,2),
  result_success BOOLEAN,
  result_completion BOOLEAN,
  result_duration TEXT,
  context_registration UUID,
  context_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  context_extensions JSONB DEFAULT '{}',
  authority TEXT,
  stored_at TIMESTAMPTZ DEFAULT now(),
  "timestamp" TIMESTAMPTZ DEFAULT now(),
  voided BOOLEAN DEFAULT false,
  raw_statement JSONB
);

-- xAPI Activity State table
CREATE TABLE IF NOT EXISTS xapi_activity_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL,
  agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state_id TEXT NOT NULL,
  registration UUID,
  document JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_id, agent_id, state_id)
);

-- xAPI Activity Profile table
CREATE TABLE IF NOT EXISTS xapi_activity_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  document JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_id, profile_id)
);

-- LRS Configurations table
CREATE TABLE IF NOT EXISTS lrs_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  endpoint_url TEXT,
  auth_type TEXT CHECK (auth_type IN ('basic', 'oauth')),
  username TEXT,
  password_encrypted TEXT,
  token_encrypted TEXT,
  is_active BOOLEAN DEFAULT true,
  sync_direction TEXT CHECK (sync_direction IN ('push', 'pull', 'both')) DEFAULT 'push',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_xapi_statements_actor_id ON xapi_statements(actor_id);
CREATE INDEX idx_xapi_statements_verb ON xapi_statements(verb);
CREATE INDEX idx_xapi_statements_object_id ON xapi_statements(object_id);
CREATE INDEX idx_xapi_statements_stored_at ON xapi_statements(stored_at);
CREATE INDEX idx_xapi_statements_context_course_id ON xapi_statements(context_course_id);
CREATE INDEX idx_xapi_statements_timestamp ON xapi_statements("timestamp");
CREATE INDEX idx_xapi_activity_state_agent ON xapi_activity_state(agent_id);
CREATE INDEX idx_xapi_activity_state_activity ON xapi_activity_state(activity_id);

-- RLS policies
ALTER TABLE xapi_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE xapi_activity_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE xapi_activity_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE lrs_configurations ENABLE ROW LEVEL SECURITY;

-- Statements: users can read their own, admins can read all
CREATE POLICY "Users can view own xapi statements"
  ON xapi_statements FOR SELECT
  USING (actor_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Admins can view all xapi statements"
  ON xapi_statements FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service role can manage xapi statements"
  ON xapi_statements FOR ALL
  USING (auth.role() = 'service_role');

-- Activity State: users can manage their own
CREATE POLICY "Users can manage own activity state"
  ON xapi_activity_state FOR ALL
  USING (agent_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Service role can manage activity state"
  ON xapi_activity_state FOR ALL
  USING (auth.role() = 'service_role');

-- Activity Profile: readable by all authenticated, writable by service
CREATE POLICY "Authenticated users can read activity profiles"
  ON xapi_activity_profile FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage activity profiles"
  ON xapi_activity_profile FOR ALL
  USING (auth.role() = 'service_role');

-- LRS Configurations: admin only
CREATE POLICY "Admins can manage lrs configurations"
  ON lrs_configurations FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service role can manage lrs configurations"
  ON lrs_configurations FOR ALL
  USING (auth.role() = 'service_role');
