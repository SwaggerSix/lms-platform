-- Custom roles / granular permissions (overlay model).
--
-- Custom roles do not replace the five built-in roles. Every user keeps a
-- built-in `users.role` (the base role), so all existing authorization —
-- authorize(...) at the API layer, the hardcoded role literals in RLS, and the
-- middleware route gates — keeps working unchanged. A custom role is an overlay
-- on top of a base role: a named permission set constrained to a subset of the
-- base role's default permissions. Enforcement is at the application layer via
-- the permissions helper; this migration is just the data model.

CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  -- The built-in role this custom role overlays. Excludes super_admin, which is
  -- reserved for internal gC/GGS staff and is never a delegation target.
  base_role TEXT NOT NULL CHECK (base_role IN ('admin', 'manager', 'instructor', 'learner')),
  -- Null organization_id = a global custom role available to every tenant.
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- Granted permission keys (subset of the base role's defaults). Application
  -- layer re-constrains on read, so a drifted set can never escalate.
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_roles_org ON custom_roles(organization_id);
-- Case-insensitive unique name per organization (NULLs are distinct, so global
-- roles are deduped separately by the partial index below).
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_roles_org_name
  ON custom_roles(organization_id, lower(name))
  WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_roles_global_name
  ON custom_roles(lower(name))
  WHERE organization_id IS NULL;

-- Assign a custom role to a user. The user's base `role` is kept in sync with
-- the custom role's base_role by the application layer; this is only the link.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_custom_role ON users(custom_role_id);

-- RLS: custom roles are readable by staff and written via the service-role app
-- layer (which enforces tenant scope and the subset-of-base constraint).
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read custom roles" ON custom_roles;
CREATE POLICY "Staff read custom roles" ON custom_roles
  FOR SELECT TO public
  USING (EXISTS ( SELECT 1
    FROM users
    WHERE (users.auth_id = (select auth.uid()))
      AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'manager'::text, 'instructor'::text]))));

DROP POLICY IF EXISTS "Admins manage custom roles" ON custom_roles;
CREATE POLICY "Admins manage custom roles" ON custom_roles
  FOR ALL TO public
  USING (EXISTS ( SELECT 1
    FROM users
    WHERE (users.auth_id = (select auth.uid()))
      AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))
  WITH CHECK (EXISTS ( SELECT 1
    FROM users
    WHERE (users.auth_id = (select auth.uid()))
      AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))));

DROP TRIGGER IF EXISTS trg_custom_roles_updated_at ON custom_roles;
CREATE TRIGGER trg_custom_roles_updated_at
  BEFORE UPDATE ON custom_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
