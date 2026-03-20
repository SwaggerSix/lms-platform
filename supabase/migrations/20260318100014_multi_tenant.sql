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
