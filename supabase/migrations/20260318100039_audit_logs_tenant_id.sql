-- Add tenant_id to audit_logs so tenant admins only see their own
-- organization's activity. Highest-priority item from
-- supabase/TENANT_SCHEMA_AUDIT.md — until this lands, any admin role can
-- read every tenant's audit rows.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

COMMENT ON COLUMN audit_logs.tenant_id IS
  'Denormalized from the acting user''s organization_id at insert time via trigger. NULL = platform-level event (e.g. cron run, super_admin action) and is visible to all admins.';

-- Backfill from users.organization_id where the audit row has a user_id.
UPDATE audit_logs a
SET tenant_id = u.organization_id
FROM users u
WHERE a.user_id = u.id
  AND a.tenant_id IS NULL
  AND u.organization_id IS NOT NULL;

-- Trigger: stamp tenant_id from the acting user's org on every new row.
-- Falls back to NULL (platform-level) when the user has no organization
-- or the row was inserted without a user_id (system events).
CREATE OR REPLACE FUNCTION audit_logs_set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.tenant_id
    FROM users
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_set_tenant_id_trg ON audit_logs;
CREATE TRIGGER audit_logs_set_tenant_id_trg
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_logs_set_tenant_id();
