-- ============================================================
-- ilt_sessions: free-text instructor fields
-- ============================================================
-- ilt_sessions.instructor_id is an FK into users; for GEMS-imported
-- sessions the instructor often isn't an LMS user (external trainer,
-- not provisioned, etc.). Add free-text columns so we can store and
-- display the GEMS instructor info regardless of FK match.
-- ============================================================

ALTER TABLE ilt_sessions
  ADD COLUMN IF NOT EXISTS instructor_name TEXT,
  ADD COLUMN IF NOT EXISTS instructor_email TEXT;

CREATE INDEX IF NOT EXISTS idx_ilt_sessions_instructor_email
  ON ilt_sessions(instructor_email)
  WHERE instructor_email IS NOT NULL;
