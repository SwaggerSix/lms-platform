-- =============================================================
-- Error logging
-- Captures runtime errors from across the platform (API routes,
-- server components, and client error boundaries) so admins can
-- triage and resolve them from Settings → Error Log.
-- =============================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Where the error originated: 'api', 'server', 'client', or 'cron'
  source TEXT NOT NULL DEFAULT 'server',
  -- Severity: 'error' (default), 'warning', or 'fatal'
  severity TEXT NOT NULL DEFAULT 'error',
  message TEXT NOT NULL,
  -- Stack trace / additional detail when available
  stack TEXT,
  -- Request context (route path, HTTP method, status code)
  path TEXT,
  method TEXT,
  status_code INTEGER,
  -- Next.js error digest, useful for correlating with server logs
  digest TEXT,
  -- Arbitrary structured context (request params, ids, etc.)
  context JSONB,
  -- Who experienced the error, if known
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_agent TEXT,
  -- Triage workflow
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);

-- RLS: only admins / super admins may read or manage error logs.
-- Inserts happen via the service-role key (logError helper / API), which
-- bypasses RLS, so no INSERT policy is needed for end users.
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view error logs" ON error_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

CREATE POLICY "Admins manage error logs" ON error_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);
