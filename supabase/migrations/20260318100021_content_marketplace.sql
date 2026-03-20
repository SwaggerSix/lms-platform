-- Content Marketplace Integration
-- Migration: 20260318100021_content_marketplace.sql

-- Marketplace providers
CREATE TABLE IF NOT EXISTS marketplace_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('linkedin_learning','coursera','udemy_business','openai','custom')),
  api_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  catalog_synced_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Marketplace courses (external catalog)
CREATE TABLE IF NOT EXISTS marketplace_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES marketplace_providers(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  external_url TEXT NOT NULL,
  duration_minutes INT,
  difficulty TEXT,
  topics JSONB DEFAULT '[]',
  rating NUMERIC(3,2),
  last_synced_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(provider_id, external_id)
);

-- Marketplace enrollments
CREATE TABLE IF NOT EXISTS marketplace_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace_course_id UUID NOT NULL REFERENCES marketplace_courses(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled','in_progress','completed')),
  progress NUMERIC(5,2) DEFAULT 0,
  external_enrollment_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_marketplace_providers_type ON marketplace_providers(provider_type);
CREATE INDEX idx_marketplace_providers_active ON marketplace_providers(is_active) WHERE is_active = true;
CREATE INDEX idx_marketplace_courses_provider ON marketplace_courses(provider_id);
CREATE INDEX idx_marketplace_courses_active ON marketplace_courses(is_active) WHERE is_active = true;
CREATE INDEX idx_marketplace_courses_topics ON marketplace_courses USING gin(topics);
CREATE INDEX idx_marketplace_enrollments_user ON marketplace_enrollments(user_id);
CREATE INDEX idx_marketplace_enrollments_course ON marketplace_enrollments(marketplace_course_id);
CREATE INDEX idx_marketplace_enrollments_status ON marketplace_enrollments(status);
