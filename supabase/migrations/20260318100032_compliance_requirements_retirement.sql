-- Phase out compliance_requirements without dropping the table.
--
-- Pre-conditions: 20260318100031_compliance_backfill.sql has been run, so
-- every backfill-eligible row's data is already mirrored into the linked
-- course's metadata.required_for. This migration:
--
--   1. Re-runs the backfill in a safe, idempotent way (no-op if already
--      done — skips courses whose required_for is already set).
--   2. Adds a `retired_at` timestamp column so rows can be marked archived
--      without losing the historical record.
--   3. Marks rows as retired when their data is now fully represented on
--      the linked course. Non-course-linked rows are LEFT in place.
--   4. Does NOT drop the table. A future migration can drop it once the
--      legacy API (POST /api/compliance) has been removed and the admin
--      UI no longer reads legacy rows.

-- Step 1: idempotent backfill (same logic as 20260318100031).
DO $$
DECLARE
  rec RECORD;
  existing_meta JSONB;
  existing_rf JSONB;
  new_rf JSONB;
  roles JSONB;
BEGIN
  FOR rec IN
    SELECT cr.id, cr.name, cr.regulation, cr.course_id, cr.frequency_months,
           cr.applicable_roles, cr.applicable_org_ids, cr.is_mandatory
    FROM compliance_requirements cr
    WHERE cr.course_id IS NOT NULL
  LOOP
    SELECT COALESCE(metadata, '{}'::jsonb) INTO existing_meta FROM courses WHERE id = rec.course_id;
    existing_rf := existing_meta -> 'required_for';

    IF existing_rf IS NOT NULL AND existing_rf <> 'null'::jsonb THEN
      CONTINUE;
    END IF;

    IF COALESCE(array_length(rec.applicable_roles, 1), 0) = 0
       AND COALESCE(array_length(rec.applicable_org_ids, 1), 0) = 0 THEN
      CONTINUE;
    END IF;

    roles := COALESCE(to_jsonb(rec.applicable_roles), '[]'::jsonb);

    new_rf := jsonb_build_object(
      'roles', roles,
      'organization_ids', COALESCE(to_jsonb(rec.applicable_org_ids), '[]'::jsonb),
      'is_mandatory', COALESCE(rec.is_mandatory, true)
    );
    IF rec.regulation IS NOT NULL AND length(trim(rec.regulation)) > 0 THEN
      new_rf := new_rf || jsonb_build_object('regulation', rec.regulation);
    END IF;
    IF rec.frequency_months IS NOT NULL AND rec.frequency_months > 0 THEN
      new_rf := new_rf || jsonb_build_object('frequency_months', rec.frequency_months);
    END IF;

    UPDATE courses
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('required_for', new_rf)
    WHERE id = rec.course_id;
  END LOOP;
END $$;

-- Step 2: retirement marker.
ALTER TABLE compliance_requirements
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ;

COMMENT ON COLUMN compliance_requirements.retired_at IS
  'When this row was archived after being represented on the linked course''s metadata.required_for. NULL = still authoritative.';

COMMENT ON TABLE compliance_requirements IS
  'Deprecated. New compliance metadata lives on courses.metadata.required_for. Keep until POST /api/compliance is removed.';

-- Step 3: mark rows whose data is fully represented on the linked course.
UPDATE compliance_requirements cr
SET retired_at = now()
FROM courses c
WHERE cr.retired_at IS NULL
  AND cr.course_id IS NOT NULL
  AND cr.course_id = c.id
  AND c.metadata ? 'required_for'
  AND c.metadata -> 'required_for' IS NOT NULL
  AND c.metadata -> 'required_for' <> 'null'::jsonb;
