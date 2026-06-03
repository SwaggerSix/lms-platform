-- ============================================================
-- GEMS / SharePoint integration follow-ups
-- ============================================================
-- 1. Add `org` to ilt_attendance to record the attendee's
--    organizational unit (e.g. NASA org code "GRC-PE00") from
--    SharePoint rosters.
-- 2. Index courses.metadata->>'gems_course_code' so the GEMS sync
--    can match events to LMS courses by code (set on auto-create).
-- ============================================================

ALTER TABLE ilt_attendance
  ADD COLUMN IF NOT EXISTS org TEXT;

CREATE INDEX IF NOT EXISTS idx_courses_metadata_gems_course_code
  ON courses ((metadata->>'gems_course_code'))
  WHERE metadata->>'gems_course_code' IS NOT NULL;
