-- L1 (custom report builder): saved, org-scoped custom report definitions.
-- A definition names a dataset (enrollments / learners / courses), an ordered
-- column subset, saved filters, and a sort — the query itself is assembled
-- server-side from a fixed column registry, so definitions carry no SQL.

CREATE TABLE IF NOT EXISTS report_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  dataset TEXT NOT NULL CHECK (dataset IN ('enrollments', 'learners', 'courses')),
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_by TEXT,
  sort_dir TEXT NOT NULL DEFAULT 'asc' CHECK (sort_dir IN ('asc', 'desc')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Both FKs covered per the unindexed-FK standard.
CREATE INDEX IF NOT EXISTS idx_report_definitions_org ON report_definitions(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_definitions_created_by ON report_definitions(created_by);

ALTER TABLE report_definitions ENABLE ROW LEVEL SECURITY;

-- Same audience as the reports surface: admins and managers (super_admin
-- passes the role check by definition elsewhere; RLS mirrors that here).
DROP POLICY IF EXISTS "Staff manage report definitions" ON report_definitions;
CREATE POLICY "Staff manage report definitions" ON report_definitions
  FOR ALL TO public
  USING (EXISTS ( SELECT 1
    FROM users
    WHERE (users.auth_id = (select auth.uid()))
      AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'manager'::text]))))
  WITH CHECK (EXISTS ( SELECT 1
    FROM users
    WHERE (users.auth_id = (select auth.uid()))
      AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'manager'::text]))));

DROP TRIGGER IF EXISTS trg_report_definitions_updated_at ON report_definitions;
CREATE TRIGGER trg_report_definitions_updated_at
  BEFORE UPDATE ON report_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
