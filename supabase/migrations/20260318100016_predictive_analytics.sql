-- Predictive Analytics Feature
-- Migration: 20260318100016_predictive_analytics.sql

-- Risk predictions
CREATE TABLE IF NOT EXISTS risk_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_score NUMERIC(5,2) NOT NULL,
  factors JSONB DEFAULT '{}',
  recommended_actions JSONB DEFAULT '[]',
  prediction_model TEXT NOT NULL DEFAULT 'v1',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Learning analytics snapshots
CREATE TABLE IF NOT EXISTS learning_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  courses_enrolled INT NOT NULL DEFAULT 0,
  courses_completed INT NOT NULL DEFAULT 0,
  avg_progress NUMERIC(5,2) DEFAULT 0,
  avg_score NUMERIC(5,2) DEFAULT 0,
  login_streak INT DEFAULT 0,
  total_time_minutes INT DEFAULT 0,
  engagement_score NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, snapshot_date)
);

-- Analytics alerts
CREATE TABLE IF NOT EXISTS analytics_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL
    CHECK (alert_type IN ('at_risk', 'disengaged', 'behind_schedule', 'high_performer')),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_risk_predictions_user ON risk_predictions(user_id);
CREATE INDEX idx_risk_predictions_course ON risk_predictions(course_id);
CREATE INDEX idx_risk_predictions_level ON risk_predictions(risk_level);
CREATE INDEX idx_risk_predictions_computed ON risk_predictions(computed_at DESC);
CREATE INDEX idx_risk_predictions_user_course ON risk_predictions(user_id, course_id);

CREATE INDEX idx_analytics_snapshots_user ON learning_analytics_snapshots(user_id);
CREATE INDEX idx_analytics_snapshots_date ON learning_analytics_snapshots(snapshot_date DESC);
CREATE INDEX idx_analytics_snapshots_user_date ON learning_analytics_snapshots(user_id, snapshot_date DESC);

CREATE INDEX idx_analytics_alerts_user ON analytics_alerts(user_id);
CREATE INDEX idx_analytics_alerts_type ON analytics_alerts(alert_type);
CREATE INDEX idx_analytics_alerts_unread ON analytics_alerts(user_id) WHERE is_read = false AND is_dismissed = false;

-- Enable RLS
ALTER TABLE risk_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own risk predictions" ON risk_predictions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own snapshots" ON learning_analytics_snapshots
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view own alerts" ON analytics_alerts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own alerts" ON analytics_alerts
  FOR UPDATE USING (user_id = auth.uid());
