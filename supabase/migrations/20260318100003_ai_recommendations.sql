-- Track user learning behavior for ML recommendations
CREATE TABLE IF NOT EXISTS learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view_course', 'start_course', 'complete_lesson', 'complete_module', 'complete_course', 'search', 'enroll', 'unenroll', 'view_path', 'assessment_pass', 'assessment_fail')),
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_learning_events_user ON learning_events(user_id);
CREATE INDEX idx_learning_events_type ON learning_events(event_type);
CREATE INDEX idx_learning_events_course ON learning_events(course_id);
CREATE INDEX idx_learning_events_created ON learning_events(created_at DESC);

-- User learning preferences (inferred from behavior)
CREATE TABLE IF NOT EXISTS user_learning_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferred_difficulty TEXT,
  preferred_duration TEXT CHECK (preferred_duration IN ('short', 'medium', 'long')),
  preferred_content_types JSONB DEFAULT '[]',
  preferred_categories JSONB DEFAULT '[]',
  learning_pace TEXT CHECK (learning_pace IN ('slow', 'moderate', 'fast')),
  best_learning_time TEXT, -- e.g., 'morning', 'afternoon', 'evening'
  completion_rate NUMERIC(5,2) DEFAULT 0,
  avg_score NUMERIC(5,2),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Precomputed course similarity scores
CREATE TABLE IF NOT EXISTS course_similarity (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  similar_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  similarity_score NUMERIC(5,4) NOT NULL,
  similarity_type TEXT NOT NULL CHECK (similarity_type IN ('content', 'collaborative', 'skill')),
  computed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (course_id, similar_course_id, similarity_type)
);

CREATE INDEX idx_course_similarity_course ON course_similarity(course_id);
