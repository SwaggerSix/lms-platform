-- Group / circle mentorship: one mentor leads a group of mentees. A circle
-- sits alongside the 1:1 mentorship_requests model and can grow over time.
CREATE TABLE IF NOT EXISTS mentorship_circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  mentor_id UUID NOT NULL REFERENCES users(id),
  max_members INT NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mentorship_circle_members (
  circle_id UUID NOT NULL REFERENCES mentorship_circles(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, mentee_id)
);

CREATE INDEX IF NOT EXISTS idx_mentorship_circles_mentor ON mentorship_circles(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_circle_members_mentee ON mentorship_circle_members(mentee_id);
