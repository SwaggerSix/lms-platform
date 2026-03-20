-- Mentorship Matching Feature
-- Migration: 20260318100015_mentorship.sql

-- Mentor profiles
CREATE TABLE IF NOT EXISTS mentor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  expertise_areas JSONB DEFAULT '[]',
  availability TEXT NOT NULL DEFAULT 'available'
    CHECK (availability IN ('available', 'limited', 'unavailable')),
  max_mentees INT NOT NULL DEFAULT 3,
  current_mentee_count INT NOT NULL DEFAULT 0,
  bio TEXT,
  years_experience INT,
  timezone TEXT,
  preferred_meeting_frequency TEXT DEFAULT 'weekly'
    CHECK (preferred_meeting_frequency IN ('weekly', 'biweekly', 'monthly')),
  rating NUMERIC(3,2),
  total_reviews INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentorship requests
CREATE TABLE IF NOT EXISTS mentorship_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'matched', 'active', 'completed', 'cancelled')),
  goals TEXT,
  preferred_areas JSONB DEFAULT '[]',
  match_score NUMERIC(5,2),
  matched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentorship sessions
CREATE TABLE IF NOT EXISTS mentorship_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INT NOT NULL DEFAULT 30,
  meeting_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  mentor_notes TEXT,
  mentee_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mentor reviews
CREATE TABLE IF NOT EXISTS mentor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES mentorship_requests(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_mentor_profiles_user_id ON mentor_profiles(user_id);
CREATE INDEX idx_mentor_profiles_availability ON mentor_profiles(availability) WHERE is_active = true;
CREATE INDEX idx_mentorship_requests_mentee ON mentorship_requests(mentee_id);
CREATE INDEX idx_mentorship_requests_mentor ON mentorship_requests(mentor_id);
CREATE INDEX idx_mentorship_requests_status ON mentorship_requests(status);
CREATE INDEX idx_mentorship_sessions_request ON mentorship_sessions(request_id);
CREATE INDEX idx_mentorship_sessions_scheduled ON mentorship_sessions(scheduled_at);
CREATE INDEX idx_mentor_reviews_request ON mentor_reviews(request_id);

-- Enable RLS
ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentorship_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies (service role bypasses, so these are for direct client access)
CREATE POLICY "Users can view active mentor profiles" ON mentor_profiles
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can manage own mentor profile" ON mentor_profiles
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own mentorship requests" ON mentorship_requests
  FOR SELECT USING (mentee_id = auth.uid() OR mentor_id = auth.uid());

CREATE POLICY "Users can create mentorship requests" ON mentorship_requests
  FOR INSERT WITH CHECK (mentee_id = auth.uid());

CREATE POLICY "Users can view sessions for their requests" ON mentorship_sessions
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM mentorship_requests
      WHERE mentee_id = auth.uid() OR mentor_id = auth.uid()
    )
  );

CREATE POLICY "Users can view reviews" ON mentor_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can create reviews" ON mentor_reviews
  FOR INSERT WITH CHECK (reviewer_id = auth.uid());
