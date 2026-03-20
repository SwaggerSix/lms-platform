-- =============================================================
-- Tenant feature support: junction tables + default feature flags
-- =============================================================

-- Junction table for tenant → learning path mapping
CREATE TABLE IF NOT EXISTS tenant_learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, path_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_learning_paths_tenant ON tenant_learning_paths(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_learning_paths_path ON tenant_learning_paths(path_id);

-- RLS
ALTER TABLE tenant_learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members view paths" ON tenant_learning_paths FOR SELECT USING (
  tenant_id IN (SELECT tenant_id FROM tenant_memberships WHERE user_id = current_user_id())
  OR current_user_role() IN ('admin', 'super_admin')
);
CREATE POLICY "Admins manage tenant paths" ON tenant_learning_paths FOR ALL USING (
  current_user_role() IN ('admin', 'super_admin')
);

-- Default platform feature flags
INSERT INTO platform_settings (key, value) VALUES (
  'features',
  '{
    "gamification": true,
    "social_learning": true,
    "skills_tracking": true,
    "self_registration": true,
    "course_ratings": true,
    "learning_paths": true,
    "ecommerce": true,
    "ai_chat": true,
    "mentorship": true,
    "microlearning": true,
    "marketplace": true,
    "feedback_360": true,
    "observations": true,
    "ilt_sessions": true,
    "predictive_analytics": true
  }'::jsonb
) ON CONFLICT (key) DO NOTHING;
