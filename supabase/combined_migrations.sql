-- ========================================
-- ALL PENDING MIGRATIONS (22 files)
-- Run this in Supabase SQL Editor
-- ========================================


-- ========================================
-- Migration: 20260318100000_drip_content.sql
-- ========================================
-- ============================================
-- Drip Content / Scheduled Release
-- Add drip/scheduled release fields to modules table
-- ============================================

-- drip_type meanings:
-- 'immediate' = available right away (default, backward compatible)
-- 'after_days' = available N days after enrollment date
-- 'on_date' = available on specific date
-- 'after_previous' = available after previous module is completed

ALTER TABLE modules ADD COLUMN IF NOT EXISTS drip_type TEXT DEFAULT 'immediate' CHECK (drip_type IN ('immediate', 'after_days', 'on_date', 'after_previous'));
ALTER TABLE modules ADD COLUMN IF NOT EXISTS drip_days INTEGER DEFAULT 0;
ALTER TABLE modules ADD COLUMN IF NOT EXISTS drip_date TIMESTAMPTZ;


-- ========================================
-- Migration: 20260318100001_prerequisites.sql
-- ========================================
-- Course prerequisites table
CREATE TABLE IF NOT EXISTS course_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL DEFAULT 'completion' CHECK (requirement_type IN ('completion', 'min_score', 'enrollment')),
  min_score INTEGER, -- only used when requirement_type = 'min_score'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, prerequisite_course_id),
  CHECK (course_id != prerequisite_course_id)
);

CREATE INDEX idx_prerequisites_course ON course_prerequisites(course_id);
CREATE INDEX idx_prerequisites_prereq ON course_prerequisites(prerequisite_course_id);


-- ========================================
-- Migration: 20260318100002_sso_config.sql
-- ========================================
-- SSO provider configurations (app-level metadata, actual SAML config lives in Supabase Auth)
CREATE TABLE IF NOT EXISTS sso_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'saml' CHECK (provider_type IN ('saml', 'oidc')),
  entity_id TEXT, -- SAML Entity ID / Issuer
  metadata_url TEXT, -- SAML metadata URL
  domain TEXT, -- email domain for auto-routing (e.g., "acme.com")
  is_active BOOLEAN DEFAULT false,
  auto_provision_users BOOLEAN DEFAULT true,
  default_role TEXT DEFAULT 'learner',
  attribute_mapping JSONB DEFAULT '{}', -- maps SAML attributes to user fields
  scim_enabled BOOLEAN DEFAULT false,
  scim_token_hash TEXT, -- hashed SCIM bearer token
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sso_domain ON sso_providers(domain);


-- ========================================
-- Migration: 20260318100003_ai_recommendations.sql
-- ========================================
-- Track user learning behavior for ML recommendations
CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view_course', 'start_course', 'complete_lesson', 'complete_module', 'complete_course', 'search', 'enroll', 'unenroll', 'view_path', 'assessment_pass', 'assessment_fail')),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_learning_events_user ON learning_events(user_id);
CREATE INDEX idx_learning_events_type ON learning_events(event_type);
CREATE INDEX idx_learning_events_course ON learning_events(course_id);
CREATE INDEX idx_learning_events_created ON learning_events(created_at DESC);

-- User learning preferences (inferred from behavior)
CREATE TABLE IF NOT EXISTS user_learning_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_difficulty TEXT,
  preferred_duration TEXT CHECK (preferred_duration IN ('short', 'medium', 'long')),
  preferred_content_types JSONB DEFAULT '[]',
  preferred_categories JSONB DEFAULT '[]',
  learning_pace TEXT CHECK (learning_pace IN ('slow', 'moderate', 'fast')),
  best_learning_time TEXT, -- e.g., 'morning', 'afternoon', 'evening'
  completion_rate NUMERIC(5,2) DEFAULT 0,
  avg_score NUMERIC(5,2),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Precomputed course similarity scores
CREATE TABLE IF NOT EXISTS course_similarity (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  similar_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  similarity_score NUMERIC(5,4) NOT NULL,
  similarity_type TEXT NOT NULL CHECK (similarity_type IN ('content', 'collaborative', 'skill')),
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (course_id, similar_course_id, similarity_type)
);

CREATE INDEX idx_course_similarity_course ON course_similarity(course_id);


-- ========================================
-- Migration: 20260318100004_enrollment_rules.sql
-- ========================================
-- Enrollment automation rules
CREATE TABLE IF NOT EXISTS enrollment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('user_created', 'role_changed', 'org_changed', 'hire_date', 'manual', 'course_completed', 'schedule')),
  conditions JSONB NOT NULL DEFAULT '{}',
  -- conditions format: { "role": ["learner"], "organization_id": ["uuid"], "hire_date_within_days": 30, "completed_course_id": "uuid" }
  actions JSONB NOT NULL DEFAULT '[]',
  -- actions format: [{ "type": "enroll_course", "course_id": "uuid", "due_days": 30 }, { "type": "enroll_path", "path_id": "uuid" }, { "type": "assign_badge", "badge_id": "uuid" }]
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Log of rule executions
CREATE TABLE IF NOT EXISTS enrollment_rule_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES enrollment_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_target_id TEXT, -- course_id or path_id
  status TEXT NOT NULL CHECK (status IN ('success', 'skipped', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_enrollment_rules_active ON enrollment_rules(is_active);
CREATE INDEX idx_enrollment_rules_trigger ON enrollment_rules(trigger_type);
CREATE INDEX idx_rule_logs_rule ON enrollment_rule_logs(rule_id);
CREATE INDEX idx_rule_logs_user ON enrollment_rule_logs(user_id);


-- ========================================
-- Migration: 20260318100005_video_conferencing.sql
-- ========================================
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


-- ========================================
-- Migration: 20260318100006_certificate_designer.sql
-- ========================================
-- Certificate templates with design data
CREATE TABLE IF NOT EXISTS certificate_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  design_data JSONB NOT NULL DEFAULT '{}',
  -- design_data format:
  -- {
  --   "background": { "color": "#fff", "image_url": null, "pattern": "classic" },
  --   "dimensions": { "width": 1056, "height": 816, "orientation": "landscape" },
  --   "elements": [
  --     { "type": "text", "id": "title", "content": "Certificate of Completion", "x": 528, "y": 120, "fontSize": 36, "fontFamily": "serif", "fontWeight": "bold", "color": "#1a1a2e", "align": "center" },
  --     { "type": "text", "id": "recipient", "content": "{{learner_name}}", "x": 528, "y": 280, "fontSize": 28, "fontFamily": "serif", "color": "#333", "align": "center" },
  --     { "type": "text", "id": "course", "content": "{{course_name}}", "x": 528, "y": 380, "fontSize": 20, "fontFamily": "sans-serif", "color": "#555", "align": "center" },
  --     { "type": "text", "id": "date", "content": "{{completion_date}}", "x": 528, "y": 480, "fontSize": 16, "fontFamily": "sans-serif", "color": "#777", "align": "center" },
  --     { "type": "line", "id": "divider", "x1": 200, "y1": 340, "x2": 856, "y2": 340, "strokeColor": "#4f46e5", "strokeWidth": 2 },
  --     { "type": "image", "id": "logo", "url": "{{company_logo}}", "x": 50, "y": 50, "width": 120, "height": 60 }
  --   ],
  --   "border": { "enabled": true, "color": "#4f46e5", "width": 3, "style": "double", "padding": 20 }
  -- }
  thumbnail_url TEXT,
  is_default BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Link templates to certifications
ALTER TABLE certifications ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES certificate_templates(id);

-- Public verification
ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS verification_code TEXT UNIQUE;
ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE user_certifications ADD COLUMN IF NOT EXISTS public_url TEXT;

CREATE INDEX IF NOT EXISTS idx_cert_verification ON user_certifications(verification_code);


-- ========================================
-- Migration: 20260318100007_i18n.sql
-- ========================================
-- Course translations for multi-language support
CREATE TABLE IF NOT EXISTS course_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, locale)
);

CREATE INDEX idx_course_translations_course ON course_translations(course_id);
CREATE INDEX idx_course_translations_locale ON course_translations(locale);

-- Enable RLS
ALTER TABLE course_translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations
CREATE POLICY "course_translations_select" ON course_translations
  FOR SELECT USING (true);

-- Only admins and instructors can insert/update/delete translations
CREATE POLICY "course_translations_insert" ON course_translations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'instructor')
    )
  );

CREATE POLICY "course_translations_update" ON course_translations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'instructor')
    )
  );

CREATE POLICY "course_translations_delete" ON course_translations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'instructor')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER course_translations_updated_at
  BEFORE UPDATE ON course_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ========================================
-- Migration: 20260318100008_content_authoring.sql
-- ========================================
-- ============================================
-- CONTENT AUTHORING / BLOCK EDITOR
-- ============================================

-- Add content_blocks_enabled flag to lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS content_blocks_enabled BOOLEAN DEFAULT false;

-- Content blocks for structured lesson content
CREATE TABLE content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL CHECK (block_type IN (
    'text', 'heading', 'image', 'video', 'code',
    'embed', 'quiz_inline', 'divider', 'callout',
    'accordion', 'tabs'
  )),
  content JSONB NOT NULL DEFAULT '{}',
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_blocks_lesson ON content_blocks(lesson_id);
CREATE INDEX idx_content_blocks_order ON content_blocks(lesson_id, sequence_order);

-- Content templates for reusable block layouts
CREATE TABLE content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  blocks JSONB NOT NULL DEFAULT '[]',
  category TEXT,
  is_system BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_content_templates_category ON content_templates(category);

-- Auto-update updated_at on content_blocks
CREATE OR REPLACE FUNCTION update_content_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_content_blocks_updated_at
  BEFORE UPDATE ON content_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_content_blocks_updated_at();

-- RLS policies
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

-- Content blocks: anyone authenticated can read, admins/instructors can write
CREATE POLICY content_blocks_select ON content_blocks FOR SELECT USING (true);
CREATE POLICY content_blocks_insert ON content_blocks FOR INSERT WITH CHECK (true);
CREATE POLICY content_blocks_update ON content_blocks FOR UPDATE USING (true);
CREATE POLICY content_blocks_delete ON content_blocks FOR DELETE USING (true);

-- Content templates: anyone can read, admins/instructors can write
CREATE POLICY content_templates_select ON content_templates FOR SELECT USING (true);
CREATE POLICY content_templates_insert ON content_templates FOR INSERT WITH CHECK (true);
CREATE POLICY content_templates_update ON content_templates FOR UPDATE USING (true);
CREATE POLICY content_templates_delete ON content_templates FOR DELETE USING (true);


-- ========================================
-- Migration: 20260318100009_ecommerce.sql
-- ========================================
-- eCommerce / Course Marketplace tables

-- Products (one product per course)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  discount_price NUMERIC(10,2),
  discount_ends_at TIMESTAMPTZ,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sales_count INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','coming_soon')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_course_id_unique UNIQUE (course_id)
);

CREATE INDEX idx_products_course_id ON products(course_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_is_featured ON products(is_featured) WHERE is_featured = true;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','refunded','failed')),
  subtotal NUMERIC(10,2),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT,
  payment_intent_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_course_id ON order_items(course_id);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  max_uses INT,
  current_uses INT NOT NULL DEFAULT 0,
  min_purchase NUMERIC(10,2),
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_is_active ON coupons(is_active);

-- Cart items
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  coupon_id UUID REFERENCES coupons(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_user_product_unique UNIQUE (user_id, product_id)
);

CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- Instructor payouts
CREATE TABLE IF NOT EXISTS instructor_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES users(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  amount NUMERIC(10,2) NOT NULL,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 70.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_instructor_payouts_instructor_id ON instructor_payouts(instructor_id);
CREATE INDEX idx_instructor_payouts_order_id ON instructor_payouts(order_id);
CREATE INDEX idx_instructor_payouts_status ON instructor_payouts(status);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructor_payouts ENABLE ROW LEVEL SECURITY;


-- ========================================
-- Migration: 20260318100010_xapi_lrs.sql
-- ========================================
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


-- ========================================
-- Migration: 20260318100011_workflows.sql
-- ========================================
-- Workflow Automation Engine
-- Extends basic enrollment_rules into a full visual workflow builder

-- ── Workflows table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'schedule', 'webhook', 'manual')),
  trigger_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  version INT DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_run_at TIMESTAMPTZ,
  run_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Workflow steps table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL CHECK (step_type IN ('condition', 'action', 'delay', 'branch', 'loop')),
  step_config JSONB NOT NULL DEFAULT '{}',
  position_x INT DEFAULT 0,
  position_y INT DEFAULT 0,
  next_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  true_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  false_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  sequence_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Workflow runs table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
  trigger_data JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- ── Workflow step logs table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_step_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES workflow_steps(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_is_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_sequence ON workflow_steps(workflow_id, sequence_order);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_run_id ON workflow_step_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_step_id ON workflow_step_logs(step_id);

-- ── RLS Policies ────────────────────────────────────────────────────────────
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only access for all workflow tables
CREATE POLICY "Admin full access on workflows" ON workflows
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admin full access on workflow_steps" ON workflow_steps
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admin full access on workflow_runs" ON workflow_runs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admin full access on workflow_step_logs" ON workflow_step_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid() AND users.role = 'admin')
  );

-- ── Updated_at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_workflows_updated_at();


-- ========================================
-- Migration: 20260318100012_360_feedback.sql
-- ========================================
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


-- ========================================
-- Migration: 20260318100013_ai_chatbot.sql
-- ========================================
-- AI Learning Chatbot
-- Migration: 20260318100013_ai_chatbot.sql

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  context_course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  context_type TEXT NOT NULL DEFAULT 'general' CHECK (context_type IN ('general', 'course', 'assessment', 'career')),
  message_count INT NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  tokens_used INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_course ON chat_sessions(context_course_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message ON chat_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

-- Enable RLS
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;


-- ========================================
-- Migration: 20260318100014_multi_tenant.sql
-- ========================================
-- Multi-Tenant Portal migration
-- Supports white-label tenant portals with custom branding, membership, and course assignment

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT UNIQUE,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#4f46e5',
  secondary_color TEXT DEFAULT '#7c3aed',
  branding JSONB DEFAULT '{}',        -- {login_bg, hero_text, footer_text, custom_css}
  features JSONB DEFAULT '{}',        -- {ecommerce: bool, gamification: bool, ...}
  settings JSONB DEFAULT '{}',
  max_users INT,
  max_courses INT,
  plan TEXT CHECK (plan IN ('free', 'starter', 'professional', 'enterprise')) DEFAULT 'starter',
  status TEXT CHECK (status IN ('active', 'suspended', 'trial')) DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TENANT MEMBERSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- ============================================================
-- TENANT COURSES
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  is_featured BOOLEAN DEFAULT false,
  custom_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, course_id)
);

-- ============================================================
-- TENANT INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_role ON tenant_memberships(tenant_id, role);

CREATE INDEX IF NOT EXISTS idx_tenant_courses_tenant ON tenant_courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_courses_course ON tenant_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_tenant_courses_featured ON tenant_courses(tenant_id, is_featured) WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant ON tenant_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON tenant_invitations(token);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_email ON tenant_invitations(email);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenants_updated_at ON tenants;
CREATE TRIGGER trigger_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Tenants: members can view their own tenants
CREATE POLICY tenants_select ON tenants FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.tenant_id = tenants.id
      AND u.auth_id = auth.uid()
  )
);

-- Tenant memberships: members of the tenant can view
CREATE POLICY tenant_memberships_select ON tenant_memberships FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.tenant_id = tenant_memberships.tenant_id
      AND u.auth_id = auth.uid()
  )
);

-- Tenant courses: members of the tenant can view
CREATE POLICY tenant_courses_select ON tenant_courses FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.tenant_id = tenant_courses.tenant_id
      AND u.auth_id = auth.uid()
  )
);

-- Invitations: only admins/owners of the tenant
CREATE POLICY tenant_invitations_select ON tenant_invitations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.tenant_id = tenant_invitations.tenant_id
      AND u.auth_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
  )
);


-- ========================================
-- Migration: 20260318100015_mentorship.sql
-- ========================================
-- Mentorship Matching Feature
-- Migration: 20260318100015_mentorship.sql

-- Mentor profiles
CREATE TABLE IF NOT EXISTS mentor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  expertise_areas JSONB DEFAULT '[]',
  availability TEXT NOT NULL DEFAULT 'available'
    CHECK (availability IN ('available', 'limited', 'unavailable')),
  max_mentees INT NOT NULL DEFAULT 3,
  current_mentee_count INT NOT NULL DEFAULT 0,
  bio TEXT,
  years_experience INT,
  timezone TEXT,
  preferred_meeting_frequency TEXT DEFAULT 'weekly'
    CHECK (preferred_meeting_frequency IN ('weekly', 'biweekly', 'monthly')),
  rating NUMERIC(3,2),
  total_reviews INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentorship requests
CREATE TABLE IF NOT EXISTS mentorship_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'active', 'completed', 'cancelled')),
  goals TEXT,
  preferred_areas JSONB DEFAULT '[]',
  match_score NUMERIC(5,2),
  matched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentorship sessions
CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT NOT NULL DEFAULT 30,
  meeting_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  mentor_notes TEXT,
  mentee_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentor reviews
CREATE TABLE IF NOT EXISTS mentor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_mentor_profiles_user_id ON mentor_profiles(user_id);
CREATE INDEX idx_mentor_profiles_availability ON mentor_profiles(availability) WHERE is_active = true;
CREATE INDEX idx_mentorship_requests_mentee ON mentorship_requests(mentee_id);
CREATE INDEX idx_mentorship_requests_mentor ON mentorship_requests(mentor_id);
CREATE INDEX idx_mentorship_requests_status ON mentorship_requests(status);
CREATE INDEX idx_mentorship_sessions_request ON mentorship_sessions(request_id);
CREATE INDEX idx_mentorship_sessions_scheduled ON mentorship_sessions(scheduled_at);
CREATE INDEX idx_mentor_reviews_request ON mentor_reviews(request_id);

-- Enable RLS
ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypasses, so these are for direct client access)
CREATE POLICY "Users can view active mentor profiles" ON mentor_profiles
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage own mentor profile" ON mentor_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own mentorship requests" ON mentorship_requests
  FOR SELECT USING (mentee_id = auth.uid() OR mentor_id = auth.uid());

CREATE POLICY "Users can create mentorship requests" ON mentorship_requests
  FOR INSERT WITH CHECK (mentee_id = auth.uid());

CREATE POLICY "Users can view sessions for their requests" ON mentorship_sessions
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM mentorship_requests
      WHERE mentee_id = auth.uid() OR mentor_id = auth.uid()
    )
  );

CREATE POLICY "Users can view reviews" ON mentor_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON mentor_reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());


-- ========================================
-- Migration: 20260318100016_predictive_analytics.sql
-- ========================================
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


-- ========================================
-- Migration: 20260318100017_hris_integrations.sql
-- ========================================
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


-- ========================================
-- Migration: 20260318100018_observation_checklists.sql
-- ========================================
-- ============================================================
-- Observation Checklists
-- ============================================================

-- Observation templates
CREATE TABLE IF NOT EXISTS observation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  passing_score NUMERIC(5,2),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Observations
CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES observation_templates(id),
  observer_id UUID NOT NULL REFERENCES users(id),
  subject_id UUID NOT NULL REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  status TEXT CHECK (status IN ('draft', 'in_progress', 'completed', 'signed_off')) DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  location TEXT,
  notes TEXT,
  overall_score NUMERIC(5,2),
  responses JSONB DEFAULT '{}',
  sign_off_by UUID REFERENCES users(id),
  signed_off_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Observation attachments
CREATE TABLE IF NOT EXISTS observation_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_observation_templates_category ON observation_templates(category);
CREATE INDEX IF NOT EXISTS idx_observation_templates_is_active ON observation_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_observation_templates_created_by ON observation_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_observations_template_id ON observations(template_id);
CREATE INDEX IF NOT EXISTS idx_observations_observer_id ON observations(observer_id);
CREATE INDEX IF NOT EXISTS idx_observations_subject_id ON observations(subject_id);
CREATE INDEX IF NOT EXISTS idx_observations_course_id ON observations(course_id);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(status);
CREATE INDEX IF NOT EXISTS idx_observations_scheduled_at ON observations(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_observation_attachments_observation_id ON observation_attachments(observation_id);

-- Updated_at triggers
CREATE OR REPLACE TRIGGER set_observation_templates_updated_at
  BEFORE UPDATE ON observation_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER set_observations_updated_at
  BEFORE UPDATE ON observations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE observation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE observation_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage observation templates"
  ON observation_templates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager', 'instructor'))
  );

CREATE POLICY "Users can view active observation templates"
  ON observation_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "Observers can manage their observations"
  ON observations FOR ALL
  USING (
    observer_id = auth.uid()
    OR subject_id = auth.uid()
    OR sign_off_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );

CREATE POLICY "Users can manage observation attachments"
  ON observation_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM observations
      WHERE observations.id = observation_attachments.observation_id
      AND (observations.observer_id = auth.uid() OR observations.subject_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('admin', 'manager'))
  );


-- ========================================
-- Migration: 20260318100019_microlearning.sql
-- ========================================
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


-- ========================================
-- Migration: 20260318100020_vr_xr_content.sql
-- ========================================
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


-- ========================================
-- Migration: 20260318100021_content_marketplace.sql
-- ========================================
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

