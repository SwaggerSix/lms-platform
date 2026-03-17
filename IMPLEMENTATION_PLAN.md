# Learning Management System (LMS) — Implementation Plan

## Executive Summary

Build an enterprise-grade Learning Management System modeled after Cornerstone OnDemand, supporting course management, learning paths, compliance tracking, skills intelligence, gamification, and analytics. Designed for internal company use with extensibility for external audiences.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui | SSR/SSG for performance, type safety, rapid UI development |
| **Backend** | Next.js API Routes + Supabase Edge Functions | Serverless, scales automatically, co-located with frontend |
| **Database** | PostgreSQL (via Supabase) | Relational integrity for complex LMS relationships, Row Level Security |
| **Auth** | Supabase Auth (SAML SSO, OAuth, email/password) | Enterprise SSO support, role-based access out of the box |
| **Storage** | Supabase Storage | SCORM packages, video content, documents, certificates |
| **Real-time** | Supabase Realtime | Live notifications, progress updates, collaborative features |
| **Video** | Mux or Cloudflare Stream | Adaptive bitrate, HLS streaming, in-video analytics |
| **Search** | PostgreSQL full-text search + pg_trgm | No extra infrastructure, good enough for LMS-scale |
| **Analytics** | Custom dashboards + Recharts | Flexible reporting, no vendor lock-in |
| **Email** | Resend or Supabase Edge Functions + SMTP | Transactional notifications, digest emails |
| **Deployment** | Vercel (frontend) + Supabase (backend) | Zero-config deployment, global CDN |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Frontend                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Learner  │ │ Instructor│ │  Admin   │ │  Manager  │  │
│  │  Portal  │ │  Portal   │ │  Portal  │ │  Portal   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘  │
│       └─────────────┴────────────┴─────────────┘        │
│                         │                                │
│              Next.js API Routes / Server Actions          │
└─────────────────────────┬───────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │    Supabase Platform   │
              │  ┌─────────────────┐  │
              │  │   PostgreSQL    │  │
              │  │   (Database)    │  │
              │  ├─────────────────┤  │
              │  │   Auth (SSO)    │  │
              │  ├─────────────────┤  │
              │  │   Storage       │  │
              │  │  (SCORM/Video)  │  │
              │  ├─────────────────┤  │
              │  │   Realtime      │  │
              │  │ (Notifications) │  │
              │  ├─────────────────┤  │
              │  │ Edge Functions  │  │
              │  │ (SCORM Runtime) │  │
              │  └─────────────────┘  │
              └───────────────────────┘
```

---

## Module Breakdown

### Phase 1: Foundation (Weeks 1–3)

#### 1.1 Authentication & User Management
- Supabase Auth with email/password + SSO (SAML 2.0, OAuth)
- Role-based access: Super Admin, Admin, Manager, Instructor, Learner
- Organization hierarchy (departments, teams, locations)
- User profiles with avatar, bio, skills, certifications
- Bulk user import via CSV
- Self-registration with approval workflows

**Key Pages:**
- `/login`, `/register`, `/forgot-password`
- `/admin/users` — user CRUD, bulk import, role assignment
- `/admin/organizations` — org hierarchy management
- `/profile` — user profile and settings

#### 1.2 Database Schema & Migrations
- Core tables: users, organizations, roles, permissions
- Row Level Security policies for multi-tenant data isolation
- Audit log infrastructure
- Database seed scripts for development

#### 1.3 Layout & Navigation
- Responsive sidebar navigation (collapsible on mobile)
- Role-based menu items
- Global search bar
- Notification bell with dropdown
- Breadcrumb navigation

---

### Phase 2: Course Management (Weeks 4–6)

#### 2.1 Course Builder
- Drag-and-drop course creation wizard
- Content types: Video, Document (PDF/PPT/DOC), SCORM package, HTML, Quiz, Assignment
- Module/lesson structure with sequencing
- Course versioning (draft → published → archived)
- Course thumbnails and rich descriptions
- Prerequisites and enrollment rules
- Estimated duration and difficulty level
- Tags and categories

**Key Pages:**
- `/admin/courses` — course listing with filters
- `/admin/courses/new` — course creation wizard
- `/admin/courses/[id]/edit` — course editor with module builder
- `/admin/courses/[id]/settings` — enrollment rules, prerequisites

#### 2.2 SCORM & xAPI Support
- SCORM 1.2 and SCORM 2004 runtime player
- SCORM package upload, extraction, and validation
- JavaScript API bridge (CMI data model)
- Suspend/resume data persistence
- xAPI statement generation and storage
- LTI 1.3 provider for external tool integration

**Technical Implementation:**
```
/supabase/functions/scorm-runtime/
  ├── index.ts          # SCORM API endpoint
  ├── scorm12.ts        # SCORM 1.2 data model handler
  ├── scorm2004.ts      # SCORM 2004 data model handler
  └── xapi-bridge.ts    # Convert SCORM calls to xAPI statements

/public/scorm-player/
  ├── index.html        # SCORM player iframe host
  ├── api-bridge.js     # postMessage bridge to parent
  └── scorm-api.js      # CMI JavaScript API implementation
```

#### 2.3 Content Library
- Searchable content repository
- Content categorization with tags
- Content reuse across multiple courses
- Upload and manage media assets
- Content approval workflow

---

### Phase 3: Learning Experience (Weeks 7–9)

#### 3.1 Course Player
- Unified course player for all content types
- Progress tracking (module-level and course-level)
- Auto-save progress and bookmarking
- Video player with playback controls, speed adjustment, captions
- Document viewer (PDF.js integration)
- Fullscreen mode
- Mobile-responsive player

**Key Pages:**
- `/learn/courses` — course catalog with search/filter
- `/learn/courses/[id]` — course overview and enrollment
- `/learn/courses/[id]/player` — immersive course player
- `/learn/my-courses` — enrolled courses with progress

#### 3.2 Learning Paths & Curricula
- Create ordered sequences of courses
- Required vs. optional courses within paths
- Prerequisite enforcement between path items
- Auto-enrollment when assigned to a path
- Visual path progress tracker
- Role-based path assignment (auto-assign by department/role)

**Key Pages:**
- `/learn/paths` — available learning paths
- `/learn/paths/[id]` — path overview with course list
- `/admin/paths` — path builder and management

#### 3.3 Enrollments & Assignments
- Self-enrollment for open courses
- Manager/admin assignment
- Enrollment rules (by department, role, location)
- Due dates and reminders
- Waitlist management for ILT sessions
- Enrollment status tracking

---

### Phase 4: Assessments & Certifications (Weeks 10–12)

#### 4.1 Assessment Engine
- Question types: Multiple choice, multi-select, true/false, fill-in-the-blank, matching, ordering, essay/free-text
- Question banks with randomized selection
- Timed assessments
- Multiple attempts with best/latest/average scoring
- Passing score thresholds
- Immediate or delayed feedback
- Anti-cheating: randomized question order, one-question-at-a-time mode

**Key Pages:**
- `/admin/assessments` — assessment management
- `/admin/assessments/[id]/questions` — question bank editor
- `/learn/assessments/[id]` — assessment taking interface
- `/learn/assessments/[id]/results` — score and feedback view

#### 4.2 Certification & Compliance
- Certificate templates with customizable design
- Auto-issue certificates on course/path completion
- Expiration dates and validity periods
- Auto-recertification workflows (re-enroll when expiring)
- Compliance training assignment by regulation
- Audit trail logging for compliance reporting
- Manager notifications for team compliance status
- Downloadable/printable PDF certificates

**Key Pages:**
- `/admin/certifications` — certification management
- `/admin/compliance` — compliance requirements and tracking
- `/learn/certifications` — my certifications with status
- `/manager/compliance` — team compliance dashboard

#### 4.3 Grading & Feedback
- Instructor grading queue for essays/assignments
- Rubric-based grading
- Inline feedback and annotations
- Grade export

---

### Phase 5: Social & Gamification (Weeks 13–14)

#### 5.1 Social Learning
- Course-level discussion forums
- Threaded comments with rich text
- @mentions and notifications
- Peer reviews and ratings
- Q&A boards per course
- Activity feed showing peer completions

#### 5.2 Gamification Engine
- Points system (earn points for completions, streaks, participation)
- Badges with criteria-based auto-award
- Leaderboards (global, department, course-level)
- Achievement streaks (daily/weekly learning streaks)
- Progress bars and level progression
- Certificate showcase on profile

**Database Tables:**
```sql
-- Points ledger
CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL, -- 'course_complete', 'quiz_pass', 'streak', 'discussion_post'
  points INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Badges
CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  criteria JSONB NOT NULL, -- { "type": "courses_completed", "threshold": 10 }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User badges
CREATE TABLE user_badges (
  user_id UUID REFERENCES users(id),
  badge_id UUID REFERENCES badges(id),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);
```

---

### Phase 6: Skills & Competency Tracking (Weeks 15–16)

#### 6.1 Skills Engine (Inspired by Cornerstone Skills Graph)
- Skills taxonomy (hierarchical categories)
- Skill-to-course mapping (courses develop specific skills)
- User skill profiles with proficiency levels (1-5)
- Skill gap analysis: required skills for role vs. current skills
- AI-powered skill recommendations based on role and gap
- Manager view of team skill distribution

#### 6.2 Competency Frameworks
- Define competency frameworks per role/department
- Map required skills with target proficiency levels
- Track progress toward competency completion
- Development plans linked to learning paths

**Key Pages:**
- `/admin/skills` — skill taxonomy management
- `/admin/competencies` — framework builder
- `/profile/skills` — my skills with proficiency levels
- `/manager/skills` — team skills heat map
- `/learn/recommendations` — AI-powered course recommendations

---

### Phase 7: Reporting & Analytics (Weeks 17–18)

#### 7.1 Dashboards
- **Learner Dashboard:** My progress, upcoming deadlines, recommendations, achievements
- **Manager Dashboard:** Team completion rates, compliance status, skill gaps, overdue items
- **Admin Dashboard:** Platform usage, enrollment trends, course effectiveness, top courses
- **Executive Dashboard:** ROI metrics, compliance rates, skill development trends

#### 7.2 Report Builder
- Pre-built report templates (completion, compliance, skills, engagement)
- Custom report builder with drag-and-drop fields
- Filters: date range, department, role, course, status
- Export to CSV, PDF, Excel
- Scheduled report delivery via email
- Data visualization with charts (bar, line, pie, heat maps)

**Key Pages:**
- `/dashboard` — role-based home dashboard
- `/reports` — report library and builder
- `/reports/[id]` — individual report view
- `/admin/analytics` — platform-wide analytics

#### 7.3 Analytics Events
- Track: page views, course starts, module completions, time spent, quiz scores
- Funnel analysis: enrollment → start → progress → completion
- Engagement scoring per learner
- Content effectiveness metrics (avg. score, completion rate, time)

---

### Phase 8: Notifications & Communication (Week 19)

#### 8.1 Notification System
- Multi-channel: in-app, email, push (mobile)
- Event triggers:
  - Enrollment confirmation
  - Due date reminders (7 days, 3 days, 1 day, overdue)
  - Certification expiration warnings
  - Course completion acknowledgment
  - New course/path available
  - Discussion replies and @mentions
  - Manager alerts for team overdue items
- Notification preferences per user
- Digest mode (daily/weekly summary)

#### 8.2 Announcements
- Admin broadcast announcements
- Course-level announcements from instructors
- Targeted announcements by department/role

---

### Phase 9: Admin & Configuration (Week 20)

#### 9.1 Platform Settings
- Branding customization (logo, colors, favicon)
- Email template customization
- Default enrollment settings
- Gamification toggle and point values
- Feature flags for module enable/disable
- Custom fields for user profiles

#### 9.2 Integration Framework
- REST API for external integrations
- Webhook events for key actions
- HR system sync (employee data import)
- Calendar integration (ILT sessions → Google/Outlook calendar)
- API key management

#### 9.3 Audit & Security
- Complete audit log of admin actions
- Data export for compliance
- GDPR data deletion support
- Session management
- IP allowlisting (optional)

---

## Database Schema (Core Tables)

```sql
-- ============================================
-- USERS & ORGANIZATIONS
-- ============================================

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES organizations(id),
  type TEXT DEFAULT 'department', -- 'company', 'department', 'team', 'location'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE, -- links to Supabase Auth
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'learner', -- 'super_admin', 'admin', 'manager', 'instructor', 'learner'
  organization_id UUID REFERENCES organizations(id),
  manager_id UUID REFERENCES users(id),
  job_title TEXT,
  hire_date DATE,
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- COURSES & CONTENT
-- ============================================

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES categories(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  thumbnail_url TEXT,
  category_id UUID REFERENCES categories(id),
  created_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'
  course_type TEXT DEFAULT 'self_paced', -- 'self_paced', 'instructor_led', 'blended', 'scorm', 'external'
  difficulty_level TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
  estimated_duration INTEGER, -- minutes
  passing_score INTEGER DEFAULT 70,
  max_attempts INTEGER,
  enrollment_type TEXT DEFAULT 'open', -- 'open', 'approval', 'assigned'
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  version INTEGER DEFAULT 1,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'video', 'document', 'scorm', 'html', 'quiz', 'assignment'
  content_url TEXT,
  content_data JSONB, -- for HTML content, quiz questions, etc.
  duration INTEGER, -- minutes
  sequence_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ENROLLMENTS & PROGRESS
-- ============================================

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  course_id UUID REFERENCES courses(id),
  status TEXT DEFAULT 'enrolled', -- 'enrolled', 'in_progress', 'completed', 'failed', 'expired'
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  assigned_by UUID REFERENCES users(id),
  score NUMERIC(5,2),
  time_spent INTEGER DEFAULT 0, -- seconds
  certificate_issued BOOLEAN DEFAULT false,
  UNIQUE(user_id, course_id)
);

CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  lesson_id UUID REFERENCES lessons(id),
  enrollment_id UUID REFERENCES enrollments(id),
  status TEXT DEFAULT 'not_started', -- 'not_started', 'in_progress', 'completed'
  score NUMERIC(5,2),
  time_spent INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  bookmark_data JSONB, -- for SCORM suspend_data, video timestamp, etc.
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, lesson_id)
);

-- ============================================
-- LEARNING PATHS
-- ============================================

CREATE TABLE learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  created_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'draft',
  estimated_duration INTEGER,
  is_sequential BOOLEAN DEFAULT true,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE learning_path_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id),
  sequence_order INTEGER NOT NULL,
  is_required BOOLEAN DEFAULT true
);

CREATE TABLE learning_path_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  path_id UUID REFERENCES learning_paths(id),
  status TEXT DEFAULT 'enrolled',
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  UNIQUE(user_id, path_id)
);

-- ============================================
-- ASSESSMENTS
-- ============================================

CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,
  time_limit INTEGER, -- minutes
  max_attempts INTEGER DEFAULT 3,
  randomize_questions BOOLEAN DEFAULT false,
  show_correct_answers BOOLEAN DEFAULT true,
  question_count INTEGER, -- null = all questions
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL, -- 'multiple_choice', 'multi_select', 'true_false', 'fill_blank', 'matching', 'ordering', 'essay'
  points INTEGER DEFAULT 1,
  explanation TEXT,
  sequence_order INTEGER,
  options JSONB NOT NULL DEFAULT '[]', -- [{text, is_correct, feedback}]
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  assessment_id UUID REFERENCES assessments(id),
  score NUMERIC(5,2),
  passed BOOLEAN,
  answers JSONB NOT NULL DEFAULT '[]', -- [{question_id, selected_options, is_correct}]
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  time_spent INTEGER -- seconds
);

-- ============================================
-- CERTIFICATIONS & COMPLIANCE
-- ============================================

CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  template_data JSONB, -- certificate template design
  validity_months INTEGER, -- null = never expires
  recertification_course_id UUID REFERENCES courses(id),
  recertification_path_id UUID REFERENCES learning_paths(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  certification_id UUID REFERENCES certifications(id),
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
  certificate_url TEXT, -- generated PDF URL
  metadata JSONB DEFAULT '{}'
);

CREATE TABLE compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  regulation TEXT, -- 'OSHA', 'HIPAA', 'SOX', etc.
  course_id UUID REFERENCES courses(id),
  path_id UUID REFERENCES learning_paths(id),
  frequency_months INTEGER, -- how often re-training is required
  applicable_roles TEXT[],
  applicable_org_ids UUID[],
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SKILLS & COMPETENCIES
-- ============================================

CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  parent_id UUID REFERENCES skills(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_skills (
  user_id UUID REFERENCES users(id),
  skill_id UUID REFERENCES skills(id),
  proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
  source TEXT DEFAULT 'assessment', -- 'assessment', 'self_reported', 'manager', 'course_completion'
  assessed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE course_skills (
  course_id UUID REFERENCES courses(id),
  skill_id UUID REFERENCES skills(id),
  proficiency_gained INTEGER CHECK (proficiency_gained BETWEEN 1 AND 5),
  PRIMARY KEY (course_id, skill_id)
);

CREATE TABLE competency_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  applicable_roles TEXT[],
  applicable_org_ids UUID[],
  skills JSONB NOT NULL, -- [{skill_id, target_proficiency}]
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- GAMIFICATION
-- ============================================

CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  reference_type TEXT, -- 'course', 'assessment', 'discussion', 'streak'
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  criteria JSONB NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_badges (
  user_id UUID REFERENCES users(id),
  badge_id UUID REFERENCES badges(id),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- ============================================
-- SOCIAL LEARNING
-- ============================================

CREATE TABLE discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id),
  user_id UUID REFERENCES users(id),
  parent_id UUID REFERENCES discussions(id), -- for threading
  title TEXT,
  body TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_answer BOOLEAN DEFAULT false, -- for Q&A mode
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL, -- 'enrollment', 'reminder', 'completion', 'certification', 'announcement', 'mention'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  channel TEXT DEFAULT 'in_app', -- 'in_app', 'email', 'push'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AUDIT & ANALYTICS
-- ============================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'export'
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL, -- 'page_view', 'course_start', 'module_complete', 'video_play', 'search'
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_manager ON users(manager_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_courses_status ON courses(status);
CREATE INDEX idx_courses_category ON courses(category_id);
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_status ON enrollments(status);
CREATE INDEX idx_enrollments_due ON enrollments(due_date);
CREATE INDEX idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_enrollment ON lesson_progress(enrollment_id);
CREATE INDEX idx_user_certs_user ON user_certifications(user_id);
CREATE INDEX idx_user_certs_expires ON user_certifications(expires_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_analytics_user ON analytics_events(user_id);
CREATE INDEX idx_analytics_type ON analytics_events(event_type);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_points_user ON points_ledger(user_id);
```

---

## Page Map & Route Structure

```
/                           → Redirect to /dashboard
/login                      → Login page
/register                   → Self-registration
/forgot-password            → Password reset

/dashboard                  → Role-based dashboard (learner/manager/admin)

-- LEARNER PORTAL --
/learn/catalog              → Browse all courses
/learn/catalog/[slug]       → Course detail & enrollment
/learn/my-courses           → Enrolled courses with progress
/learn/player/[courseId]    → Immersive course player
/learn/paths                → Browse learning paths
/learn/paths/[slug]         → Path detail with course list
/learn/certifications       → My certificates
/learn/recommendations      → AI-powered recommendations
/learn/achievements         → Badges, points, leaderboard

-- ASSESSMENTS --
/learn/assessments/[id]           → Take assessment
/learn/assessments/[id]/results   → View results

-- SOCIAL --
/learn/discussions                → Discussion feed
/learn/courses/[id]/discussions   → Course discussions

-- PROFILE --
/profile                    → My profile
/profile/skills             → Skill profile & gaps
/profile/settings           → Notification preferences

-- MANAGER PORTAL --
/manager/team               → Team overview
/manager/assignments        → Assign courses to team
/manager/compliance         → Team compliance status
/manager/skills             → Team skills heat map
/manager/reports            → Team reports

-- ADMIN PORTAL --
/admin/dashboard            → Platform analytics
/admin/users                → User management
/admin/organizations        → Org structure
/admin/courses              → Course management
/admin/courses/new          → Course creation wizard
/admin/courses/[id]/edit    → Course editor
/admin/paths                → Learning path management
/admin/assessments          → Assessment management
/admin/certifications       → Certification management
/admin/compliance           → Compliance requirements
/admin/skills               → Skills taxonomy
/admin/competencies         → Competency frameworks
/admin/gamification         → Badges & point rules
/admin/reports              → Report builder
/admin/notifications        → Announcement management
/admin/settings             → Platform settings & branding
/admin/integrations         → API keys & webhooks
/admin/audit-log            → Audit trail viewer
```

---

## Key Feature Specifications

### SCORM Player Architecture
```
1. Admin uploads .zip SCORM package
2. Backend extracts to Supabase Storage (/scorm/{course_id}/{version}/)
3. Parse imsmanifest.xml → extract launch file, SCOs, sequencing rules
4. Player loads in sandboxed iframe
5. JavaScript API bridge intercepts SCORM API calls (LMSInitialize, LMSGetValue, LMSSetValue, etc.)
6. Bridge communicates with parent via postMessage
7. Parent persists CMI data to lesson_progress.bookmark_data via API
8. On LMSFinish/LMSCommit → update enrollment status and score
```

### Certificate Generation
```
1. Define certificate template (HTML/CSS with Handlebars variables)
2. On course completion → trigger Edge Function
3. Edge Function renders HTML template with user/course data
4. Convert to PDF via Puppeteer or html-pdf
5. Store PDF in Supabase Storage
6. Update user_certifications with certificate_url
7. Send email notification with download link
```

### Notification Pipeline
```
Event occurs (enrollment, completion, etc.)
  → Insert into notifications table (in-app)
  → Check user notification preferences
  → If email enabled → queue email via Resend
  → If push enabled → send push notification
  → Realtime subscription delivers in-app instantly
```

---

## Implementation Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| 1. Foundation | Weeks 1–3 | Auth, users, orgs, layout, DB schema |
| 2. Course Management | Weeks 4–6 | Course builder, SCORM player, content library |
| 3. Learning Experience | Weeks 7–9 | Course player, learning paths, enrollments |
| 4. Assessments & Certs | Weeks 10–12 | Quiz engine, certifications, compliance |
| 5. Social & Gamification | Weeks 13–14 | Forums, badges, points, leaderboards |
| 6. Skills Tracking | Weeks 15–16 | Skills engine, competency frameworks, gap analysis |
| 7. Reporting & Analytics | Weeks 17–18 | Dashboards, report builder, analytics events |
| 8. Notifications | Week 19 | Multi-channel notifications, announcements |
| 9. Admin & Config | Week 20 | Settings, integrations, audit, security |

---

## Getting Started — Next Steps

1. **Initialize the project:** `npx create-next-app@latest lms-platform --typescript --tailwind --app`
2. **Set up Supabase:** Create project, configure auth providers, enable RLS
3. **Install core dependencies:** shadcn/ui, Zustand, React Query, Recharts, PDF.js
4. **Run database migrations:** Apply the schema above
5. **Build Phase 1:** Auth flows, user management, layout shell
6. **Iterate through phases** with continuous testing and feedback

---

## Competitive Feature Comparison

| Feature | Cornerstone | Our LMS |
|---------|-------------|---------|
| Course Management | ✅ | ✅ Phase 2 |
| SCORM Support | ✅ | ✅ Phase 2 |
| xAPI Support | ✅ | ✅ Phase 2 |
| Learning Paths | ✅ | ✅ Phase 3 |
| Assessment Engine | ✅ | ✅ Phase 4 |
| Certifications | ✅ | ✅ Phase 4 |
| Compliance Tracking | ✅ | ✅ Phase 4 |
| Skills Graph / AI | ✅ | ✅ Phase 6 |
| Gamification | ✅ | ✅ Phase 5 |
| Social Learning | ✅ | ✅ Phase 5 |
| Reporting / Analytics | ✅ | ✅ Phase 7 |
| Mobile Responsive | ✅ | ✅ All Phases |
| Multi-tenant | ✅ | ✅ Phase 1 (RLS) |
| Content Marketplace | ✅ | ❌ Future |
| Talent Management | ✅ | ❌ Future |
| Succession Planning | ✅ | ❌ Future |
