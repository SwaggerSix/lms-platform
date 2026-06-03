-- ============================================================
-- SharePoint roster integration
-- ============================================================
-- Allows `sharepoint_rosters` as an external integration provider.
-- The actual attendee data lands in the existing `ilt_attendance`
-- table; the idempotency columns (external_source, external_id)
-- added in the GEMS migration are reused here.
-- ============================================================

ALTER TABLE external_integrations
  DROP CONSTRAINT IF EXISTS external_integrations_provider_check;

ALTER TABLE external_integrations
  ADD CONSTRAINT external_integrations_provider_check
  CHECK (provider IN (
    'bamboohr', 'workday', 'adp',
    'salesforce', 'hubspot',
    'gems', 'sharepoint_rosters',
    'custom_webhook'
  ));

ALTER TABLE external_integrations
  DROP CONSTRAINT IF EXISTS external_integrations_type_check;

ALTER TABLE external_integrations
  ADD CONSTRAINT external_integrations_type_check
  CHECK (type IN ('hris', 'crm', 'hr_system', 'scheduling', 'documents'));
