-- Structured development goals for a mentorship pairing. Each row is one goal
-- the mentee and mentor are working toward, optionally with a target date.
-- Lives under a mentorship_request so it's scoped to a single pairing.
CREATE TABLE IF NOT EXISTS mentorship_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_goals_request ON mentorship_goals(request_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_goals_status ON mentorship_goals(status);
