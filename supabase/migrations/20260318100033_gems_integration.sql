-- ============================================================
-- GEMS (proprietary training scheduling system) integration
-- ============================================================
-- GEMS is the system of record for scheduling instructor-led
-- training. This migration lets GEMS events flow one-way into
-- the LMS so administrators work in the LMS only.
--
-- It does three things:
--   1. Registers 'gems' as a valid external_integrations provider.
--   2. Adds idempotency keys to ilt_sessions / ilt_attendance so
--      repeated syncs upsert rather than duplicate.
--   3. Indexes those keys for fast lookups during sync.
-- ============================================================

-- 1. Allow 'gems' as a provider on external_integrations.
ALTER TABLE external_integrations
  DROP CONSTRAINT IF EXISTS external_integrations_provider_check;

ALTER TABLE external_integrations
  ADD CONSTRAINT external_integrations_provider_check
  CHECK (provider IN ('bamboohr', 'workday', 'adp', 'salesforce', 'hubspot', 'gems', 'custom_webhook'));

-- Allow 'scheduling' as an integration type (GEMS is neither HRIS nor CRM).
ALTER TABLE external_integrations
  DROP CONSTRAINT IF EXISTS external_integrations_type_check;

ALTER TABLE external_integrations
  ADD CONSTRAINT external_integrations_type_check
  CHECK (type IN ('hris', 'crm', 'hr_system', 'scheduling'));

-- 2. Idempotency keys on ilt_sessions.
--    external_source identifies the origin system ('gems'); external_id is
--    the stable GEMS event id. Together they map an LMS session back to its
--    GEMS origin and make the sync an upsert.
ALTER TABLE ilt_sessions
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_integration_id UUID REFERENCES external_integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ilt_sessions_external
  ON ilt_sessions(external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;

-- 3. Idempotency keys on ilt_attendance (one GEMS roster entry per session/user).
ALTER TABLE ilt_attendance
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ilt_attendance_external
  ON ilt_attendance(external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
