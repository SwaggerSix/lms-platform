-- L3 (multi-role QA audit): make notification templates a real feature.
-- Previously the admin UI's "Save Template" was a no-op and the five templates
-- were hardcoded in the server component. This creates a backing table (with
-- those five seeded as global defaults) so templates can be created, edited,
-- and deleted for real, scoped per organization.

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT,                                   -- optional slug identifying purpose
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  subject TEXT,                               -- optional email subject line
  body TEXT NOT NULL DEFAULT '',              -- message body / preview ({variables})
  channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'push')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_org
  ON notification_templates(organization_id);

-- At most one template per (org, key) when a key is set.
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_templates_org_key
  ON notification_templates(organization_id, key) WHERE key IS NOT NULL;

-- Seed the historical hardcoded defaults as global templates (org NULL), once.
INSERT INTO notification_templates (organization_id, key, name, description, body, channel)
SELECT NULL, v.key, v.name, v.description, v.body, v.channel
FROM (VALUES
  ('enrollment_confirmation', 'Enrollment Confirmation',
   'Sent when a user is enrolled in a new course',
   'You have been enrolled in {course_name}. Start your learning journey today!', 'email'),
  ('due_date_reminder', 'Due Date Reminder',
   'Reminder sent 3 days before a course due date',
   'Reminder: {course_name} is due on {due_date}. You are {progress}% complete.', 'email'),
  ('completion_congratulations', 'Completion Congratulations',
   'Sent when a user completes a course',
   'Congratulations! You have completed {course_name} with a score of {score}%.', 'email'),
  ('certificate_issued', 'Certificate Issued',
   'Sent when a certificate is generated',
   'Your certificate for {course_name} is now available. Download it from your profile.', 'email'),
  ('overdue_warning', 'Overdue Warning',
   'Sent when a course passes its due date',
   'Action required: {course_name} was due on {due_date}. Please complete it as soon as possible.', 'email')
) AS v(key, name, description, body, channel)
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates WHERE organization_id IS NULL
);

-- RLS: access is normally via the service-role API (admin-gated), but enable
-- RLS with an admin-manage policy so the table isn't flagged as unprotected and
-- direct user-session reads stay locked down. auth.uid() is wrapped in a
-- scalar subquery so it is evaluated once per query (no initplan lint).
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage notification templates" ON notification_templates;
CREATE POLICY "Admins manage notification templates" ON notification_templates
  FOR ALL TO public
  USING (EXISTS ( SELECT 1
    FROM users
    WHERE (users.auth_id = (select auth.uid()))
      AND (users.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))));
