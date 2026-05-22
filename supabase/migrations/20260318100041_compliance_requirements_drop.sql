-- Drop compliance_requirements after the retirement work has landed.
-- Preconditions:
--
--   1. POST /api/compliance returns 410 Gone (done in the same PR as
--      this migration). Read endpoints / readers all source from
--      courses.metadata.required_for via getRequiredCourseSources.
--   2. All retired_at IS NULL rows have been either retired or audited
--      and explicitly approved for retention. The DO block below
--      aborts the drop if any non-retired rows still exist.
--   3. No external consumers (BI tools, exports, analytics) read from
--      the compliance_requirements table directly. If yours does,
--      flip it to read from courses.metadata.required_for first.
--
-- This migration is intentionally aggressive: if the preconditions
-- fail it raises and rolls back, so it's safe to attempt and observe
-- rather than run blindly.

DO $$
DECLARE
  non_retired_count INTEGER;
  unbackfilled_count INTEGER;
BEGIN
  -- Precondition A: every row should be retired by the time we drop the table.
  SELECT COUNT(*) INTO non_retired_count
  FROM compliance_requirements
  WHERE retired_at IS NULL;

  IF non_retired_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop compliance_requirements: % row(s) are not retired. '
      'Re-run 20260318100032 first, or audit + manually set retired_at on '
      'rows that should be archived.',
      non_retired_count;
  END IF;

  -- Precondition B: every retired row's course must carry the required_for
  -- data we expected the backfill to install. A retired row whose course no
  -- longer has required_for means the data was lost — abort and investigate.
  SELECT COUNT(*) INTO unbackfilled_count
  FROM compliance_requirements cr
  LEFT JOIN courses c ON c.id = cr.course_id
  WHERE cr.retired_at IS NOT NULL
    AND cr.course_id IS NOT NULL
    AND (
      c.id IS NULL
      OR c.metadata IS NULL
      OR NOT (c.metadata ? 'required_for')
      OR c.metadata -> 'required_for' IS NULL
      OR c.metadata -> 'required_for' = 'null'::jsonb
    );

  IF unbackfilled_count > 0 THEN
    RAISE EXCEPTION
      'Refusing to drop compliance_requirements: % retired row(s) reference '
      'courses that no longer carry required_for metadata. The backfill '
      'appears to have been undone — investigate before dropping.',
      unbackfilled_count;
  END IF;
END $$;

-- All preconditions satisfied. Drop the table.
DROP TABLE IF EXISTS compliance_requirements CASCADE;

-- Notify anyone reading this in psql.
DO $$ BEGIN RAISE NOTICE 'compliance_requirements dropped successfully'; END $$;
