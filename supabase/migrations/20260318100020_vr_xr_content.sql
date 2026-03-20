-- VR/XR Content Support
-- Migration: 20260318100020_vr_xr_content.sql

-- XR content linked to lessons
CREATE TABLE IF NOT EXISTS xr_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('vr_360','vr_interactive','ar_overlay','3d_model')),
  file_url TEXT NOT NULL,
  fallback_url TEXT,
  metadata JSONB DEFAULT '{}',
  player_config JSONB DEFAULT '{}',
  compatibility JSONB DEFAULT '["desktop","mobile","headset"]',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- XR sessions tracking
CREATE TABLE IF NOT EXISTS xr_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES xr_content(id) ON DELETE CASCADE,
  device_type TEXT,
  duration_seconds INT,
  interactions JSONB DEFAULT '[]',
  completed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_xr_content_lesson ON xr_content(lesson_id);
CREATE INDEX idx_xr_content_type ON xr_content(content_type);
CREATE INDEX idx_xr_content_created_by ON xr_content(created_by);
CREATE INDEX idx_xr_sessions_user ON xr_sessions(user_id);
CREATE INDEX idx_xr_sessions_content ON xr_sessions(content_id);
CREATE INDEX idx_xr_sessions_completed ON xr_sessions(completed);
