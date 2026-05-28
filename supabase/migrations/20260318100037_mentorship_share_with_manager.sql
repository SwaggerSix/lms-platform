-- Mentee can opt in to share their mentorship (goals, sessions, reviews)
-- with their manager. Default off; only the mentee can flip this flag.
ALTER TABLE mentorship_requests
  ADD COLUMN IF NOT EXISTS share_with_manager BOOLEAN NOT NULL DEFAULT FALSE;
