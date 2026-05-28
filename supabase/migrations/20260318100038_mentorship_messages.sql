-- Lightweight per-pairing message thread between mentor and mentee. Keeps
-- the conversation in the LMS (and retrievable) instead of buried in email.
CREATE TABLE IF NOT EXISTS mentorship_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_messages_request ON mentorship_messages(request_id, created_at);
