-- Cron job monitoring table for tracking run history and enabling health checks
CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  duration_ms INT,
  records_processed INT DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cron_runs_job ON cron_runs(job_name, created_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- Admins can view all cron run logs
CREATE POLICY "Admins view cron runs" ON cron_runs FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'super_admin'))
);

-- Service role (cron jobs) can insert run logs
CREATE POLICY "System insert cron runs" ON cron_runs FOR INSERT WITH CHECK (true);
