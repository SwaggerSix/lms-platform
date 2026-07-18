-- Follow-up to 20260716020000 (DB1: unindexed foreign keys). The tables added
-- since that pass — notification_templates, api_keys, course_versions, and
-- custom_roles — index their organization/course foreign keys but not their
-- created_by / published_by ones, so those four FKs would surface as new
-- unindexed_foreign_keys advisor findings on deploy. Same rationale as the
-- original pass: unindexed FKs force sequential scans on joins and on cascade
-- delete/update of the parent row (here: deleting a user seq-scans each of
-- these tables to apply ON DELETE SET NULL). Each statement is idempotent
-- (IF NOT EXISTS) and purely additive.

CREATE INDEX IF NOT EXISTS idx_notification_templates_created_by ON public.notification_templates (created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by ON public.api_keys (created_by);
CREATE INDEX IF NOT EXISTS idx_course_versions_published_by ON public.course_versions (published_by);
CREATE INDEX IF NOT EXISTS idx_custom_roles_created_by ON public.custom_roles (created_by);
