-- Explicit mentorship lanes: traditional (senior mentors junior), reverse
-- (junior mentors senior on e.g. tech or social trends), and peer (lateral).
-- Existing rows default to 'traditional'.
ALTER TABLE mentorship_requests
  ADD COLUMN IF NOT EXISTS mentorship_type TEXT NOT NULL DEFAULT 'traditional';

ALTER TABLE mentorship_requests
  DROP CONSTRAINT IF EXISTS mentorship_requests_type_check;
ALTER TABLE mentorship_requests
  ADD CONSTRAINT mentorship_requests_type_check
  CHECK (mentorship_type IN ('traditional', 'reverse', 'peer'));
