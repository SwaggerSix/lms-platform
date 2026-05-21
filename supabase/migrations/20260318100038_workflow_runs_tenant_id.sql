-- Denormalize tenant_id onto workflow_runs so audit queries can filter by
-- tenant without doing a two-hop join (runs → workflows). The audit
-- endpoint previously fetched workflow ids for the tenant, then run ids
-- for those workflows; this collapses to a single .eq("tenant_id", x).
--
-- A trigger keeps tenant_id in sync on new runs by copying the workflow's
-- tenant_id at insert time. Existing runs are backfilled below.

ALTER TABLE workflow_runs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant_id ON workflow_runs(tenant_id);

COMMENT ON COLUMN workflow_runs.tenant_id IS
  'Denormalized from workflows.tenant_id at insert time via trigger. NULL = platform-wide.';

-- Backfill from workflows.
UPDATE workflow_runs r
SET tenant_id = w.tenant_id
FROM workflows w
WHERE r.workflow_id = w.id
  AND r.tenant_id IS NULL
  AND w.tenant_id IS NOT NULL;

-- Trigger: stamp tenant_id from the parent workflow on every new run.
CREATE OR REPLACE FUNCTION workflow_runs_set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM workflows
    WHERE id = NEW.workflow_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workflow_runs_set_tenant_id_trg ON workflow_runs;
CREATE TRIGGER workflow_runs_set_tenant_id_trg
BEFORE INSERT ON workflow_runs
FOR EACH ROW
EXECUTE FUNCTION workflow_runs_set_tenant_id();

-- Same idea on workflow_step_logs so audit queries can filter step logs
-- directly without joining through workflow_runs.

ALTER TABLE workflow_step_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_step_logs_tenant_id ON workflow_step_logs(tenant_id);

UPDATE workflow_step_logs l
SET tenant_id = r.tenant_id
FROM workflow_runs r
WHERE l.run_id = r.id
  AND l.tenant_id IS NULL
  AND r.tenant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION workflow_step_logs_set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM workflow_runs
    WHERE id = NEW.run_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workflow_step_logs_set_tenant_id_trg ON workflow_step_logs;
CREATE TRIGGER workflow_step_logs_set_tenant_id_trg
BEFORE INSERT ON workflow_step_logs
FOR EACH ROW
EXECUTE FUNCTION workflow_step_logs_set_tenant_id();
