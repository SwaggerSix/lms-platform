-- SharePoint roster attendance without LMS accounts.
--
-- Class rosters (.xlsx in SharePoint _Courses) list federal attendees who
-- don't have LMS accounts. Rather than creating accounts, keep each roster
-- line against its GEMS-sourced session: who attended, their organization,
-- days attended and whether that counts as present. user_id is filled in
-- only when the email matches an existing LMS user (ilt_attendance is then
-- updated too, as before).
--
-- ilt_sessions.external_metadata carries what the source system knows about
-- a session beyond its columns. The GEMS sync stores the customer and course
-- code there; the roster sync uses them to pick the right SharePoint class
-- folder when several share a date.

ALTER TABLE ilt_sessions
  ADD COLUMN IF NOT EXISTS external_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS ilt_roster_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES ilt_sessions(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL CHECK (email <> '' AND email = lower(btrim(email))),
  full_name             TEXT,
  org                   TEXT,
  days_total            INTEGER NOT NULL DEFAULT 0,
  days_attended         INTEGER NOT NULL DEFAULT 0,
  -- 'unknown': the roster is a registration list with no attendance columns.
  attendance_status     TEXT NOT NULL CHECK (attendance_status IN ('present', 'absent', 'unknown')),
  user_id               UUID REFERENCES users(id) ON DELETE SET NULL,
  source_drive_item_id  TEXT NOT NULL,
  source_file_name      TEXT,
  source_web_url        TEXT,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, email)
);

CREATE INDEX IF NOT EXISTS idx_ilt_roster_entries_user
  ON ilt_roster_entries (user_id) WHERE user_id IS NOT NULL;

-- Written only by the roster sync (service role). Admins read.
ALTER TABLE ilt_roster_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read roster entries" ON ilt_roster_entries;
CREATE POLICY "Admins read roster entries" ON ilt_roster_entries
  FOR SELECT USING (current_user_role() IN ('admin', 'super_admin'));

COMMENT ON TABLE ilt_roster_entries IS
  'Attendees from SharePoint roster files, per GEMS-sourced ILT session, without requiring LMS accounts. Written by src/lib/integrations/sharepoint-rosters/sync.ts.';
COMMENT ON COLUMN ilt_sessions.external_metadata IS
  'What the source system knows about the session beyond its columns (GEMS: customer_name, customer_code, course_code, event_code).';
