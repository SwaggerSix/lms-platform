-- L2 (multi-role QA audit): course versioning. Lesson/content edits overwrite
-- in place, so there's no record of "which version a learner completed" and no
-- draft-vs-live separation. This adds immutable version snapshots captured at
-- publish time and pins each enrollment to the version it is taking.
--
-- PR1 (this migration): the data model + a v1 backfill for already-published
-- courses, with existing enrollments pinned to that v1. Snapshot capture on
-- publish and enrollment pinning are wired in the application layer; the
-- draft/republish editing flow and version surfacing in reports/certs follow.

CREATE TABLE IF NOT EXISTS course_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_course_versions_number ON course_versions(course_id, version_number);
CREATE INDEX IF NOT EXISTS idx_course_versions_course ON course_versions(course_id);
-- At most one current version per course.
CREATE UNIQUE INDEX IF NOT EXISTS uq_course_versions_current ON course_versions(course_id) WHERE is_current;

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS course_version_id UUID REFERENCES course_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_course_version ON enrollments(course_version_id);

-- Backfill: one immutable v1 per already-published course, snapshotting the
-- current module/lesson/content-block structure.
INSERT INTO course_versions (course_id, version_number, snapshot, published_at, is_current)
SELECT
  c.id,
  1,
  jsonb_build_object(
    'course', jsonb_build_object(
      'title', c.title,
      'description', c.description,
      'short_description', c.short_description,
      'passing_score', c.passing_score
    ),
    'modules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'description', m.description, 'sequence_order', m.sequence_order,
        'lessons', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', l.id, 'title', l.title, 'content_type', l.content_type,
            'content_url', l.content_url, 'content_data', l.content_data,
            'duration', l.duration, 'sequence_order', l.sequence_order, 'is_required', l.is_required,
            'content_blocks', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', b.id, 'block_type', b.block_type, 'content', b.content, 'sequence_order', b.sequence_order
              ) ORDER BY b.sequence_order)
              FROM content_blocks b WHERE b.lesson_id = l.id
            ), '[]'::jsonb)
          ) ORDER BY l.sequence_order)
          FROM lessons l WHERE l.module_id = m.id
        ), '[]'::jsonb)
      ) ORDER BY m.sequence_order)
      FROM modules m WHERE m.course_id = c.id
    ), '[]'::jsonb)
  ),
  COALESCE(c.published_at, c.created_at, now()),
  true
FROM courses c
WHERE c.status = 'published'
  AND NOT EXISTS (SELECT 1 FROM course_versions cv WHERE cv.course_id = c.id);

-- Pin existing enrollments of published courses to their v1.
UPDATE enrollments e
SET course_version_id = cv.id
FROM course_versions cv
WHERE cv.course_id = e.course_id
  AND cv.version_number = 1
  AND e.course_version_id IS NULL;

-- RLS: course versions are readable by staff and written via the service-role
-- app layer. Enable RLS with a staff read/manage policy (auth.uid() wrapped).
ALTER TABLE course_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage course versions" ON course_versions;
CREATE POLICY "Staff manage course versions" ON course_versions
  FOR ALL TO public
  USING (EXISTS ( SELECT 1
    FROM users
    WHERE (users.auth_id = (select auth.uid()))
      AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text, 'instructor'::text]))));
