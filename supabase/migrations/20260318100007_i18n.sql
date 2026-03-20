-- Course translations for multi-language support
CREATE TABLE IF NOT EXISTS course_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  locale TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, locale)
);

CREATE INDEX idx_course_translations_course ON course_translations(course_id);
CREATE INDEX idx_course_translations_locale ON course_translations(locale);

-- Enable RLS
ALTER TABLE course_translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations
CREATE POLICY "course_translations_select" ON course_translations
  FOR SELECT USING (true);

-- Only admins and instructors can insert/update/delete translations
CREATE POLICY "course_translations_insert" ON course_translations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'instructor')
    )
  );

CREATE POLICY "course_translations_update" ON course_translations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'instructor')
    )
  );

CREATE POLICY "course_translations_delete" ON course_translations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'super_admin', 'instructor')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER course_translations_updated_at
  BEFORE UPDATE ON course_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
