-- Backfill legacy compliance_requirements rows into courses.metadata.required_for.
--
-- Each row in compliance_requirements that points at a course is folded into
-- that course's metadata.required_for JSON blob, carrying regulation,
-- frequency_months, is_mandatory, and applicable_roles forward. Rows whose
-- target course already has a required_for blob set are skipped so we never
-- clobber admin-set values.
--
-- The legacy table is NOT dropped — rows with no course_id remain accessible
-- via the compliance admin page's "legacy" tab, and the table is still the
-- target of the existing /api/compliance POST endpoint for backwards compat.
-- A future migration can drop the table once all rows have been moved or
-- declared obsolete.

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

    -- Skip if the course already has a required_for blob — admin intent wins.
    IF existing_rf IS NOT NULL AND existing_rf <> 'null'::jsonb THEN
      CONTINUE;
    END IF;

    -- Normalize roles: applicable_roles is text[] -> jsonb array of strings.
    -- Empty array becomes [] which means "all roles" downstream. To preserve
    -- the auto-enroll semantics of the new system, we only set required_for
    -- if we have at least one role OR org. Otherwise the legacy row stays
    -- read-only on the compliance page.
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
