-- 360-Degree Feedback System
-- Migration: 20260318100012_360_feedback.sql

-- Feedback cycles
CREATE TABLE IF NOT EXISTS feedback_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  cycle_type TEXT NOT NULL DEFAULT '360' CHECK (cycle_type IN ('360', 'peer', 'manager', 'self')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  anonymous BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feedback templates
CREATE TABLE IF NOT EXISTS feedback_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  cycle_id UUID REFERENCES feedback_cycles(id) ON DELETE CASCADE,
  questions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feedback nominations
CREATE TABLE IF NOT EXISTS feedback_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES feedback_cycles(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('self', 'peer', 'manager', 'direct_report', 'external')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'declined')),
  nominated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, subject_id, reviewer_id)
);

-- Feedback responses
CREATE TABLE IF NOT EXISTS feedback_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id UUID NOT NULL REFERENCES feedback_nominations(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  is_draft BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feedback competencies
CREATE TABLE IF NOT EXISTS feedback_competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_cycles_status ON feedback_cycles(status);
CREATE INDEX IF NOT EXISTS idx_feedback_cycles_created_by ON feedback_cycles(created_by);
CREATE INDEX IF NOT EXISTS idx_feedback_nominations_cycle ON feedback_nominations(cycle_id);
CREATE INDEX IF NOT EXISTS idx_feedback_nominations_subject ON feedback_nominations(subject_id);
CREATE INDEX IF NOT EXISTS idx_feedback_nominations_reviewer ON feedback_nominations(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_nominations_status ON feedback_nominations(status);
CREATE INDEX IF NOT EXISTS idx_feedback_responses_nomination ON feedback_responses(nomination_id);
CREATE INDEX IF NOT EXISTS idx_feedback_templates_cycle ON feedback_templates(cycle_id);
CREATE INDEX IF NOT EXISTS idx_feedback_competencies_active ON feedback_competencies(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE feedback_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_competencies ENABLE ROW LEVEL SECURITY;
