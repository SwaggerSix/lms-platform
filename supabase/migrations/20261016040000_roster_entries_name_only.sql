-- Roster attendees listed by name only.
--
-- Late adds are sometimes written onto a class roster with no email (three
-- on the 2026-06-16 Business Writing roster). Keep them, by name, rather
-- than drop them. email becomes optional, and attendee_key identifies a
-- roster line within its session from run to run: the email, else
-- "name:" + the name's words lowercased and sorted (see attendeeKey in
-- src/lib/integrations/sharepoint-rosters/sync.ts).
--
-- The existing email CHECK (non-empty, lowercased) passes for NULL, and
-- UNIQUE (session_id, email) allows several NULLs, so both stay.

ALTER TABLE ilt_roster_entries ALTER COLUMN email DROP NOT NULL;

ALTER TABLE ilt_roster_entries ADD COLUMN IF NOT EXISTS attendee_key TEXT;
UPDATE ilt_roster_entries SET attendee_key = email WHERE attendee_key IS NULL;
ALTER TABLE ilt_roster_entries ALTER COLUMN attendee_key SET NOT NULL;
ALTER TABLE ilt_roster_entries
  ADD CONSTRAINT ilt_roster_entries_session_attendee_key UNIQUE (session_id, attendee_key);

-- A line is someone: an email or a name.
ALTER TABLE ilt_roster_entries
  ADD CONSTRAINT ilt_roster_entries_email_or_name CHECK (email IS NOT NULL OR full_name IS NOT NULL);

COMMENT ON COLUMN ilt_roster_entries.attendee_key IS
  'Identifies the roster line within its session: the email, else "name:" + the name''s words lowercased and sorted. Set by the roster sync.';
