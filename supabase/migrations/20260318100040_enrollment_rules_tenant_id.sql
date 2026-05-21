-- Add tenant_id to enrollment_rules and enrollment_rule_logs so the
-- notification-audit endpoint can scope rule failures with a direct
-- column filter instead of the current
-- .in("user_id", tenantScope.userIds) workaround.
--
-- Mirrors the workflow_runs / workflow_step_logs pattern in
-- 20260318100038.

ALTER TABLE enrollment_rules
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_enrollment_rules_tenant_id ON enrollment_rules(tenant_id);

COMMENT ON COLUMN enrollment_rules.tenant_id IS
  'Owning tenant. NULL = platform-wide (admin-defined rules that apply everywhere).';

ALTER TABLE enrollment_rule_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_enrollment_rule_logs_tenant_id ON enrollment_rule_logs(tenant_id);

COMMENT ON COLUMN enrollment_rule_logs.tenant_id IS
  'Denormalized from enrollment_rules.tenant_id at insert time via trigger.';

-- Backfill rules from the JSON conditions.organization_id (if a single org)
-- or the creator's organization (if conditions has none).
UPDATE enrollment_rules r
SET tenant_id = COALESCE(
  -- single org in conditions
  CASE
    WHEN jsonb_typeof(r.conditions -> 'organization_id') = 'array'
         AND jsonb_array_length(r.conditions -> 'organization_id') = 1
    THEN (r.conditions -> 'organization_id' ->> 0)::uuid
    WHEN jsonb_typeof(r.conditions -> 'organization_id') = 'string'
    THEN (r.conditions ->> 'organization_id')::uuid
    ELSE NULL
  END,
  u.organization_id
)
FROM users u
WHERE r.created_by = u.id
  AND r.tenant_id IS NULL;

-- Backfill rule logs from their parent rule.
UPDATE enrollment_rule_logs l
SET tenant_id = r.tenant_id
FROM enrollment_rules r
WHERE l.rule_id = r.id
  AND l.tenant_id IS NULL
  AND r.tenant_id IS NOT NULL;

-- Trigger: stamp rule_logs.tenant_id from the rule on insert.
CREATE OR REPLACE FUNCTION enrollment_rule_logs_set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM enrollment_rules
    WHERE id = NEW.rule_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enrollment_rule_logs_set_tenant_id_trg ON enrollment_rule_logs;
CREATE TRIGGER enrollment_rule_logs_set_tenant_id_trg
BEFORE INSERT ON enrollment_rule_logs
FOR EACH ROW
EXECUTE FUNCTION enrollment_rule_logs_set_tenant_id();
