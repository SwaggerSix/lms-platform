-- Add video conferencing fields to ilt_sessions
ALTER TABLE ilt_sessions ADD COLUMN IF NOT EXISTS meeting_provider TEXT CHECK (meeting_provider IN ('zoom', 'teams', 'google_meet', 'custom'));
ALTER TABLE ilt_sessions ADD COLUMN IF NOT EXISTS meeting_id TEXT;
ALTER TABLE ilt_sessions ADD COLUMN IF NOT EXISTS meeting_password TEXT;
ALTER TABLE ilt_sessions ADD COLUMN IF NOT EXISTS meeting_settings JSONB DEFAULT '{}';
ALTER TABLE ilt_sessions ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

-- Video conferencing provider configurations
CREATE TABLE IF NOT EXISTS vc_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE CHECK (provider IN ('zoom', 'teams', 'google_meet')),
  is_active BOOLEAN DEFAULT false,
  client_id TEXT,
  client_secret_encrypted TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  webhook_secret TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calendar sync records
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ilt_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'ical')),
  external_event_id TEXT,
  calendar_url TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_session ON calendar_events(session_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
