-- S3 (multi-role QA audit): scope scheduled reports to an organization so a
-- client admin cannot list, edit, or delete another tenant's scheduled reports
-- (they run with the RLS-bypassing service-role key). Backfill each report's
-- organization from its creator; a null organization (single-tenant today)
-- stays null and imposes no restriction, so this is non-breaking now and
-- becomes enforcing the moment organizations are populated.

ALTER TABLE scheduled_reports
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE scheduled_reports sr
SET organization_id = u.organization_id
FROM users u
WHERE sr.created_by = u.id
  AND sr.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_org
  ON scheduled_reports(organization_id);
