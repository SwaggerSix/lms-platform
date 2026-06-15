-- ============================================================
-- Partner Portal → LMS instructor sync
-- ============================================================
-- NOTE: the users.external_* provenance columns below were applied
-- manually to the live LMS project on 2026-06-15. They had been
-- missing, so the instructor "My Bio" page's user query errored and
-- redirected instructors to the dashboard.
-- ============================================================
-- The gC Partner Portal is the system of record for subcontractor
-- master profiles. Subcontractors become LMS instructors via a
-- one-way sync: each portal profile is mirrored into a users row
-- (role 'instructor'). Portal-owned fields (name, email, bio,
-- avatar) are authoritative — LMS-side edits to them are rejected
-- by the profile/users API routes so a later sync never clobbers
-- local changes (and vice-versa).
--
-- This migration mirrors the GEMS integration pattern:
--   1. Registers 'partner_portal' as a valid external_integrations
--      provider, and 'directory' as a valid integration type.
--   2. Adds provenance / idempotency keys to users so repeated
--      syncs upsert (by external_source + external_id) rather than
--      duplicate.
--   3. Indexes those keys for fast lookups during sync.
-- ============================================================

-- 1. Allow 'partner_portal' as a provider on external_integrations.
ALTER TABLE external_integrations
  DROP CONSTRAINT IF EXISTS external_integrations_provider_check;

-- Keep every provider that other integrations already register (gems,
-- sharepoint_rosters, …) — rewriting the list without them breaks the
-- constraint against existing rows — and add 'partner_portal'.
ALTER TABLE external_integrations
  ADD CONSTRAINT external_integrations_provider_check
  CHECK (provider IN ('bamboohr', 'workday', 'adp', 'salesforce', 'hubspot', 'gems', 'sharepoint_rosters', 'partner_portal', 'custom_webhook'));

-- Allow 'directory' as an integration type (a people/profile source), while
-- preserving the existing types ('documents' for the SharePoint roster source).
ALTER TABLE external_integrations
  DROP CONSTRAINT IF EXISTS external_integrations_type_check;

ALTER TABLE external_integrations
  ADD CONSTRAINT external_integrations_type_check
  CHECK (type IN ('hris', 'crm', 'hr_system', 'scheduling', 'documents', 'directory'));

-- 2. Provenance / idempotency keys on users.
--    external_source identifies the origin system ('partner_portal');
--    external_id is the stable portal profile id (UUID). Together they
--    map an LMS user back to its portal origin and make the sync an upsert.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS external_source TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_integration_id UUID REFERENCES external_integrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_synced_at TIMESTAMPTZ;

-- 3. One LMS user per (origin system, external id).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external
  ON users(external_source, external_id)
  WHERE external_source IS NOT NULL AND external_id IS NOT NULL;
