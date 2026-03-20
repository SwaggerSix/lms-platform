-- Course prerequisites table
CREATE TABLE IF NOT EXISTS course_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  prerequisite_course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL DEFAULT 'completion' CHECK (requirement_type IN ('completion', 'min_score', 'enrollment')),
  min_score INTEGER, -- only used when requirement_type = 'min_score'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, prerequisite_course_id),
  CHECK (course_id != prerequisite_course_id)
);

CREATE INDEX idx_prerequisites_course ON course_prerequisites(course_id);
CREATE INDEX idx_prerequisites_prereq ON course_prerequisites(prerequisite_course_id);
