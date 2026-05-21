-- Add tenant_id to workflows so workflow logs (via the run → workflow chain)
-- can be tenant-scoped from the API side. Backfills tenant_id from the
-- workflow's creator's organization_id when missing.
--
-- workflow_runs and workflow_step_logs don't get their own tenant_id column —
-- they're cheap to join to workflows for the scope check. If perf becomes an
-- issue, denormalize tenant_id onto workflow_runs later.

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_tenant_id ON workflows(tenant_id);

COMMENT ON COLUMN workflows.tenant_id IS
  'Owning tenant/organization. NULL means platform-wide (visible to all admins).';

-- Backfill: copy organization_id from the workflow's creator if available.
UPDATE workflows w
SET tenant_id = u.organization_id
FROM users u
WHERE w.created_by = u.id
  AND w.tenant_id IS NULL
  AND u.organization_id IS NOT NULL;
