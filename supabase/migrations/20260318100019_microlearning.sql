-- Microlearning & Embedded Widgets
-- Migration: 20260318100019_microlearning.sql

-- Microlearning nuggets
CREATE TABLE IF NOT EXISTS microlearning_nuggets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('tip','flashcard','quiz','video_clip','infographic','checklist')),
  content JSONB NOT NULL DEFAULT '{}',
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  tags JSONB DEFAULT '[]',
  difficulty TEXT CHECK (difficulty IN ('beginner','intermediate','advanced')),
  estimated_seconds INT DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  view_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Microlearning progress
CREATE TABLE IF NOT EXISTS microlearning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nugget_id UUID NOT NULL REFERENCES microlearning_nuggets(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'viewed' CHECK (status IN ('viewed','completed','bookmarked')),
  score NUMERIC(5,2),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, nugget_id)
);

-- Microlearning schedules
CREATE TABLE IF NOT EXISTS microlearning_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('daily','weekdays','weekly')),
  preferred_time TIME DEFAULT '09:00',
  topics JSONB DEFAULT '[]',
  max_per_day INT DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Embed widgets
CREATE TABLE IF NOT EXISTS embed_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  widget_type TEXT NOT NULL CHECK (widget_type IN ('course_card','progress_bar','nugget_feed','leaderboard','skill_radar')),
  config JSONB DEFAULT '{}',
  embed_token TEXT UNIQUE NOT NULL,
  allowed_domains JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_microlearning_nuggets_course ON microlearning_nuggets(course_id);
CREATE INDEX idx_microlearning_nuggets_active ON microlearning_nuggets(is_active) WHERE is_active = true;
CREATE INDEX idx_microlearning_nuggets_type ON microlearning_nuggets(content_type);
CREATE INDEX idx_microlearning_nuggets_difficulty ON microlearning_nuggets(difficulty);
CREATE INDEX idx_microlearning_nuggets_created_by ON microlearning_nuggets(created_by);
CREATE INDEX idx_microlearning_progress_user ON microlearning_progress(user_id);
CREATE INDEX idx_microlearning_progress_nugget ON microlearning_progress(nugget_id);
CREATE INDEX idx_microlearning_schedules_user ON microlearning_schedules(user_id);
CREATE INDEX idx_embed_widgets_token ON embed_widgets(embed_token);
CREATE INDEX idx_embed_widgets_active ON embed_widgets(is_active) WHERE is_active = true;
