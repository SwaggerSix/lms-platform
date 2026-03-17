-- ============================================
-- LearnHub LMS - Portal Features Migration
-- Management Concepts Custom Learning Portal
-- ============================================

-- ============================================
-- FEATURED COURSES (add column to courses)
-- ============================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS featured_order INTEGER DEFAULT 0;
CREATE INDEX idx_courses_featured ON courses(is_featured) WHERE is_featured = true;

-- ============================================
-- ENROLLMENT APPROVALS
-- ============================================

CREATE TABLE enrollment_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  decided_at TIMESTAMPTZ,
  reason TEXT,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_enrollment_approvals_status ON enrollment_approvals(status);
CREATE INDEX idx_enrollment_approvals_approver ON enrollment_approvals(approver_id);
CREATE INDEX idx_enrollment_approvals_learner ON enrollment_approvals(learner_id);
CREATE INDEX idx_enrollment_approvals_course ON enrollment_approvals(course_id);

-- ============================================
-- ILT SESSIONS (Instructor-Led Training)
-- ============================================

CREATE TABLE ilt_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  location_type TEXT NOT NULL DEFAULT 'virtual' CHECK (location_type IN ('virtual', 'in_person', 'hybrid')),
  location_details TEXT,
  meeting_url TEXT,
  max_capacity INTEGER DEFAULT 30,
  min_capacity INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  materials_url TEXT,
  recording_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ilt_sessions_course ON ilt_sessions(course_id);
CREATE INDEX idx_ilt_sessions_instructor ON ilt_sessions(instructor_id);
CREATE INDEX idx_ilt_sessions_date ON ilt_sessions(session_date);
CREATE INDEX idx_ilt_sessions_status ON ilt_sessions(status);

-- ============================================
-- ILT ATTENDANCE
-- ============================================

CREATE TABLE ilt_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ilt_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_status TEXT NOT NULL DEFAULT 'registered' CHECK (registration_status IN ('registered', 'waitlisted', 'cancelled')),
  attendance_status TEXT CHECK (attendance_status IN ('present', 'absent', 'late', 'excused', 'no_show')),
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  completion_status TEXT DEFAULT 'not_started' CHECK (completion_status IN ('not_started', 'in_progress', 'completed', 'failed')),
  score DECIMAL(5,2),
  feedback TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX idx_ilt_attendance_session ON ilt_attendance(session_id);
CREATE INDEX idx_ilt_attendance_user ON ilt_attendance(user_id);
CREATE INDEX idx_ilt_attendance_status ON ilt_attendance(attendance_status);

-- ============================================
-- CONVERSATIONS (Private Messaging)
-- ============================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  title TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  is_muted BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conv_participants_conv ON conversation_participants(conversation_id);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'image', 'system')),
  attachment_url TEXT,
  attachment_name TEXT,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- ============================================
-- DOCUMENT REPOSITORY
-- ============================================

CREATE TABLE document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES document_folders(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'managers', 'admins')),
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_doc_folders_parent ON document_folders(parent_id);
CREATE INDEX idx_doc_folders_org ON document_folders(organization_id);

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES document_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type TEXT,
  version INTEGER DEFAULT 1,
  tags TEXT[] DEFAULT '{}',
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'managers', 'admins')),
  is_policy BOOLEAN DEFAULT false,
  effective_date DATE,
  expiry_date DATE,
  acknowledgment_required BOOLEAN DEFAULT false,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_folder ON documents(folder_id);
CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_tags ON documents USING gin(tags);
CREATE INDEX idx_documents_policy ON documents(is_policy) WHERE is_policy = true;

CREATE TABLE document_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(document_id, user_id)
);

-- ============================================
-- KNOWLEDGE BASE / FAQ
-- ============================================

CREATE TABLE kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  parent_id UUID REFERENCES kb_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES kb_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_faq BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kb_articles_category ON kb_articles(category_id);
CREATE INDEX idx_kb_articles_status ON kb_articles(status);
CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX idx_kb_articles_faq ON kb_articles(is_faq) WHERE is_faq = true;
CREATE INDEX idx_kb_articles_tags ON kb_articles USING gin(tags);

-- ============================================
-- SCHEDULED REPORTS
-- ============================================

CREATE TABLE scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL CHECK (report_type IN ('completion', 'compliance', 'enrollment', 'skills_gap', 'engagement', 'learner_progress', 'ilt_attendance', 'custom')),
  filters JSONB DEFAULT '{}',
  schedule_frequency TEXT NOT NULL CHECK (schedule_frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  schedule_day INTEGER,
  schedule_time TIME NOT NULL DEFAULT '09:00',
  schedule_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  delivery_method TEXT NOT NULL DEFAULT 'email' CHECK (delivery_method IN ('email', 'download', 'both')),
  recipients TEXT[] DEFAULT '{}',
  format TEXT NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'xlsx')),
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run_at);

-- ============================================
-- TRAINING TRANSCRIPTS (view support)
-- ============================================

CREATE TABLE transcript_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  export_format TEXT NOT NULL DEFAULT 'pdf' CHECK (export_format IN ('pdf', 'csv')),
  file_url TEXT,
  generated_at TIMESTAMPTZ DEFAULT now(),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- SEED DATA FOR NEW FEATURES
-- ============================================

-- Featured courses
UPDATE courses SET is_featured = true, featured_order = 1
WHERE id = (SELECT id FROM courses WHERE title LIKE '%Financial%' LIMIT 1);
UPDATE courses SET is_featured = true, featured_order = 2
WHERE id = (SELECT id FROM courses WHERE title LIKE '%Leadership%' LIMIT 1);
UPDATE courses SET is_featured = true, featured_order = 3
WHERE id = (SELECT id FROM courses WHERE title LIKE '%Cybersecurity%' LIMIT 1);

-- KB Categories
INSERT INTO kb_categories (name, description, icon, sort_order) VALUES
  ('Getting Started', 'New to the platform? Start here.', 'rocket', 1),
  ('Courses & Learning', 'How to find, enroll, and complete courses.', 'book-open', 2),
  ('Certifications', 'Information about certifications and compliance.', 'award', 3),
  ('Technical Support', 'Troubleshooting and technical help.', 'wrench', 4),
  ('Policies & Procedures', 'Training policies and organizational procedures.', 'file-text', 5),
  ('Account & Profile', 'Managing your account settings.', 'user', 6);

-- KB Articles / FAQs
INSERT INTO kb_articles (category_id, title, slug, content, excerpt, status, is_faq, is_pinned) VALUES
  ((SELECT id FROM kb_categories WHERE name = 'Getting Started'),
   'How to Access the Learning Portal', 'how-to-access-portal',
   'The learning portal can be accessed via your organization''s unique URL. Simply navigate to the portal in your web browser — no downloads or plugins required. Use your organization email and password to log in. If you don''t have an account, contact your training administrator or use the self-registration page if enabled.',
   'Learn how to access and log into the learning portal.', 'published', true, true),
  ((SELECT id FROM kb_categories WHERE name = 'Getting Started'),
   'Navigating the Dashboard', 'navigating-dashboard',
   'Your dashboard is your home base. It shows your enrolled courses, upcoming deadlines, recommended training, and recent achievements. Use the sidebar navigation to access different sections including the course catalog, learning paths, certifications, and community forums.',
   'A guide to your learning dashboard.', 'published', true, false),
  ((SELECT id FROM kb_categories WHERE name = 'Courses & Learning'),
   'How to Enroll in a Course', 'how-to-enroll',
   'To enroll in a course: 1) Browse the Course Catalog from the sidebar. 2) Click on a course to view details. 3) Click "Enroll Now" to register. Some courses may require manager approval before enrollment is confirmed. You''ll receive a notification once your enrollment is approved.',
   'Step-by-step guide to enrolling in courses.', 'published', true, false),
  ((SELECT id FROM kb_categories WHERE name = 'Courses & Learning'),
   'Attending Instructor-Led Training (ILT)', 'attending-ilt',
   'Instructor-Led Training sessions have scheduled dates and times. After enrolling, check the session schedule for your class. Virtual sessions include a meeting link that becomes available 15 minutes before start time. In-person sessions will show location details. Attendance is tracked — please arrive on time to be marked as present.',
   'Everything you need to know about ILT sessions.', 'published', true, false),
  ((SELECT id FROM kb_categories WHERE name = 'Certifications'),
   'Understanding Compliance Training Requirements', 'compliance-training',
   'Your organization may have mandatory compliance training requirements. These appear on your dashboard with due dates. Overdue training is highlighted in red. Complete all required training before the deadline to maintain compliance. Your manager and HR will be notified of compliance status.',
   'Learn about mandatory compliance training.', 'published', true, false),
  ((SELECT id FROM kb_categories WHERE name = 'Technical Support'),
   'Supported File Types', 'supported-file-types',
   'The portal supports the following file types for uploads and course materials: Documents (docx, doc, pdf, rtf, txt), Spreadsheets (xlsx, xls), Presentations (pptx, ppt, pps), Images (gif, jpeg, jpg, jpe, png, svg), Video (mp4, webm), Audio (mp3, wav). Maximum file size is 100MB per file.',
   'List of supported file formats.', 'published', true, false),
  ((SELECT id FROM kb_categories WHERE name = 'Technical Support'),
   'Browser Compatibility', 'browser-compatibility',
   'The learning portal works best with modern browsers: Chrome (latest 2 versions), Firefox (latest 2 versions), Safari (latest 2 versions), Microsoft Edge (latest 2 versions). No plugins or downloads are required. Ensure JavaScript is enabled and cookies are allowed.',
   'Supported browsers and requirements.', 'published', true, false),
  ((SELECT id FROM kb_categories WHERE name = 'Policies & Procedures'),
   'Training Request & Approval Process', 'training-approval-process',
   'Some courses require manager approval before enrollment. When you request enrollment in such a course, your direct manager receives a notification. They can approve or reject the request with optional comments. You''ll be notified of the decision. Approved enrollments are automatically activated.',
   'How the training approval workflow works.', 'published', true, false);

-- Document folders
INSERT INTO document_folders (name, description, visibility, sort_order) VALUES
  ('Training Policies', 'Official training policies and guidelines', 'all', 1),
  ('Procedure Documents', 'Standard operating procedures', 'all', 2),
  ('Manager Resources', 'Resources for team managers', 'managers', 3),
  ('Templates & Forms', 'Downloadable templates and forms', 'all', 4),
  ('Compliance Documents', 'Regulatory and compliance documentation', 'all', 5);

-- Sample documents
INSERT INTO documents (folder_id, title, description, file_url, file_name, file_type, file_size, is_policy, acknowledgment_required) VALUES
  ((SELECT id FROM document_folders WHERE name = 'Training Policies'),
   'Annual Training Requirements Policy', 'Outlines mandatory annual training requirements for all employees.',
   '/documents/annual-training-policy.pdf', 'annual-training-policy.pdf', 'pdf', 245000, true, true),
  ((SELECT id FROM document_folders WHERE name = 'Training Policies'),
   'Professional Development Guidelines', 'Guidelines for professional development and continuing education.',
   '/documents/pd-guidelines.pdf', 'pd-guidelines.pdf', 'pdf', 189000, true, false),
  ((SELECT id FROM document_folders WHERE name = 'Procedure Documents'),
   'Course Request SOP', 'Standard operating procedure for requesting new courses.',
   '/documents/course-request-sop.docx', 'course-request-sop.docx', 'docx', 52000, false, false),
  ((SELECT id FROM document_folders WHERE name = 'Templates & Forms'),
   'Training Completion Certificate Template', 'Template for generating training completion certificates.',
   '/documents/cert-template.pptx', 'cert-template.pptx', 'pptx', 340000, false, false),
  ((SELECT id FROM document_folders WHERE name = 'Compliance Documents'),
   'Data Security Training Requirements', 'Compliance requirements for annual data security training.',
   '/documents/data-security-requirements.pdf', 'data-security-requirements.pdf', 'pdf', 178000, true, true);

-- Sample ILT sessions
INSERT INTO ilt_sessions (course_id, title, description, session_date, start_time, end_time, location_type, location_details, meeting_url, max_capacity, status)
SELECT
  id,
  'Financial Management 101 - Session 1',
  'Introduction to federal financial management principles',
  CURRENT_DATE + INTERVAL '7 days',
  '09:00',
  '12:00',
  'virtual',
  'Microsoft Teams',
  'https://teams.microsoft.com/meeting/example1',
  25,
  'scheduled'
FROM courses WHERE title LIKE '%Financial%' LIMIT 1;

INSERT INTO ilt_sessions (course_id, title, description, session_date, start_time, end_time, location_type, location_details, max_capacity, status)
SELECT
  id,
  'Leadership Development Workshop',
  'Interactive leadership skills workshop',
  CURRENT_DATE + INTERVAL '14 days',
  '13:00',
  '17:00',
  'in_person',
  'Building A, Conference Room 301',
  20,
  'scheduled'
FROM courses WHERE title LIKE '%Leadership%' LIMIT 1;

-- Scheduled reports
INSERT INTO scheduled_reports (name, description, report_type, schedule_frequency, schedule_day, schedule_time, delivery_method, recipients, format, is_active) VALUES
  ('Weekly Enrollment Summary', 'Shows new enrollments and completions from the past week', 'enrollment', 'weekly', 1, '09:00', 'email', ARRAY['admin@example.com'], 'pdf', true),
  ('Monthly Compliance Status', 'Monthly compliance training status across all departments', 'compliance', 'monthly', 1, '08:00', 'both', ARRAY['admin@example.com', 'hr@example.com'], 'xlsx', true),
  ('Quarterly Skills Gap Analysis', 'Quarterly review of organizational skill gaps', 'skills_gap', 'quarterly', 1, '09:00', 'email', ARRAY['admin@example.com'], 'pdf', true);
