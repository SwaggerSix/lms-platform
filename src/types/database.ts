export type UserRole = "super_admin" | "admin" | "manager" | "instructor" | "learner";
export type UserStatus = "active" | "inactive" | "suspended";
export type CourseStatus = "draft" | "published" | "archived";
export type CourseType = "self_paced" | "instructor_led" | "blended" | "scorm" | "external";
export type DifficultyLevel = "beginner" | "intermediate" | "advanced";
export type EnrollmentStatus = "enrolled" | "in_progress" | "completed" | "failed" | "expired";
export type LessonContentType = "video" | "document" | "scorm" | "html" | "quiz" | "assignment";
export type QuestionType = "multiple_choice" | "multi_select" | "true_false" | "fill_blank" | "matching" | "ordering" | "essay";
export type NotificationType = "enrollment" | "reminder" | "completion" | "certification" | "announcement" | "mention";
export type CertStatus = "active" | "expired" | "revoked";

export interface Organization {
  id: string;
  name: string;
  parent_id: string | null;
  type: "company" | "department" | "team" | "location";
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  auth_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  role: UserRole;
  organization_id: string | null;
  manager_id: string | null;
  job_title: string | null;
  hire_date: string | null;
  status: UserStatus;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  created_at: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  category_id: string | null;
  created_by: string | null;
  status: CourseStatus;
  course_type: CourseType;
  difficulty_level: DifficultyLevel;
  estimated_duration: number | null;
  passing_score: number;
  max_attempts: number | null;
  enrollment_type: "open" | "approval" | "assigned";
  tags: string[];
  metadata: Record<string, unknown>;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  modules?: Module[];
  enrollment_count?: number;
  completion_rate?: number;
}

export interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sequence_order: number;
  created_at: string;
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  content_type: LessonContentType;
  content_url: string | null;
  content_data: Record<string, unknown> | null;
  duration: number | null;
  sequence_order: number;
  is_required: boolean;
  created_at: string;
  progress?: LessonProgress;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  due_date: string | null;
  assigned_by: string | null;
  score: number | null;
  time_spent: number;
  certificate_issued: boolean;
  course?: Course;
  user?: User;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  enrollment_id: string;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
  time_spent: number;
  attempts: number;
  bookmark_data: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface LearningPath {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  created_by: string | null;
  status: CourseStatus;
  estimated_duration: number | null;
  is_sequential: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  items?: LearningPathItem[];
  enrollment_count?: number;
}

export interface LearningPathItem {
  id: string;
  path_id: string;
  course_id: string;
  sequence_order: number;
  is_required: boolean;
  course?: Course;
}

export interface LearningPathEnrollment {
  id: string;
  user_id: string;
  path_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
  due_date: string | null;
  path?: LearningPath;
}

export interface Assessment {
  id: string;
  course_id: string | null;
  title: string;
  description: string | null;
  passing_score: number;
  time_limit: number | null;
  max_attempts: number;
  randomize_questions: boolean;
  show_correct_answers: boolean;
  question_count: number | null;
  created_at: string;
  questions?: Question[];
}

export interface QuestionOption {
  text: string;
  is_correct: boolean;
  feedback?: string;
}

export interface Question {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: QuestionType;
  points: number;
  explanation: string | null;
  sequence_order: number | null;
  options: QuestionOption[];
  created_at: string;
}

export interface AssessmentAttempt {
  id: string;
  user_id: string;
  assessment_id: string;
  score: number | null;
  passed: boolean | null;
  answers: { question_id: string; selected_options: number[]; is_correct: boolean }[];
  started_at: string;
  completed_at: string | null;
  time_spent: number | null;
}

export interface Certification {
  id: string;
  name: string;
  description: string | null;
  template_data: Record<string, unknown> | null;
  validity_months: number | null;
  recertification_course_id: string | null;
  recertification_path_id: string | null;
  created_at: string;
}

export interface UserCertification {
  id: string;
  user_id: string;
  certification_id: string;
  issued_at: string;
  expires_at: string | null;
  status: CertStatus;
  certificate_url: string | null;
  metadata: Record<string, unknown>;
  certification?: Certification;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string | null;
  regulation: string | null;
  course_id: string | null;
  path_id: string | null;
  frequency_months: number | null;
  applicable_roles: string[];
  applicable_org_ids: string[];
  is_mandatory: boolean;
  created_at: string;
  course?: Course;
}

export interface Skill {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  parent_id: string | null;
  created_at: string;
  children?: Skill[];
}

export interface UserSkill {
  user_id: string;
  skill_id: string;
  proficiency_level: number;
  source: "assessment" | "self_reported" | "manager" | "course_completion";
  assessed_at: string;
  skill?: Skill;
}

export interface CompetencyFramework {
  id: string;
  name: string;
  description: string | null;
  applicable_roles: string[];
  applicable_org_ids: string[];
  skills: { skill_id: string; target_proficiency: number }[];
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  criteria: Record<string, unknown>;
  category: string | null;
  created_at: string;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  awarded_at: string;
  badge?: Badge;
}

export interface PointsEntry {
  id: string;
  user_id: string;
  action_type: string;
  points: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface Discussion {
  id: string;
  course_id: string | null;
  user_id: string;
  parent_id: string | null;
  title: string | null;
  body: string;
  is_pinned: boolean;
  is_answer: boolean;
  upvotes: number;
  created_at: string;
  updated_at: string;
  user?: User;
  replies?: Discussion[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  channel: "in_app" | "email" | "push";
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AnalyticsEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  session_id: string | null;
  created_at: string;
}

// ============================================
// Portal Features (Management Concepts)
// ============================================

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";
export type ILTLocationType = "virtual" | "in_person" | "hybrid";
export type ILTSessionStatus = "scheduled" | "in_progress" | "completed" | "cancelled";
export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "no_show";
export type RegistrationStatus = "registered" | "waitlisted" | "cancelled";
export type MessageType = "text" | "file" | "image" | "system";
export type ConversationType = "direct" | "group";
export type DocumentVisibility = "all" | "managers" | "admins";
export type KBArticleStatus = "draft" | "published" | "archived";
export type ReportFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";
export type ReportFormat = "pdf" | "csv" | "xlsx";

export interface EnrollmentApproval {
  id: string;
  enrollment_id: string | null;
  course_id: string;
  learner_id: string;
  approver_id: string | null;
  status: ApprovalStatus;
  requested_at: string;
  decided_at: string | null;
  reason: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  course?: Course;
  learner?: User;
  approver?: User;
}

export interface ILTSession {
  id: string;
  course_id: string;
  instructor_id: string | null;
  title: string;
  description: string | null;
  session_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  location_type: ILTLocationType;
  location_details: string | null;
  meeting_url: string | null;
  max_capacity: number;
  min_capacity: number;
  status: ILTSessionStatus;
  materials_url: string | null;
  recording_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  course?: Course;
  instructor?: User;
  attendees?: ILTAttendance[];
  registered_count?: number;
}

export interface ILTAttendance {
  id: string;
  session_id: string;
  user_id: string;
  registration_status: RegistrationStatus;
  attendance_status: AttendanceStatus | null;
  check_in_time: string | null;
  check_out_time: string | null;
  completion_status: "not_started" | "in_progress" | "completed" | "failed";
  score: number | null;
  feedback: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user?: User;
  session?: ILTSession;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  is_muted: boolean;
  joined_at: string;
  user?: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: MessageType;
  attachment_url: string | null;
  attachment_name: string | null;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
  sender?: User;
}

export interface DocumentFolder {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  organization_id: string | null;
  visibility: DocumentVisibility;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  documents?: Document[];
  document_count?: number;
}

export interface Document {
  id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  mime_type: string | null;
  version: number;
  tags: string[];
  organization_id: string | null;
  visibility: DocumentVisibility;
  is_policy: boolean;
  effective_date: string | null;
  expiry_date: string | null;
  acknowledgment_required: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  folder?: DocumentFolder;
  uploader?: User;
  acknowledged?: boolean;
}

export interface DocumentAcknowledgment {
  id: string;
  document_id: string;
  user_id: string;
  acknowledged_at: string;
}

export interface KBCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  articles?: KBArticle[];
  article_count?: number;
}

export interface KBArticle {
  id: string;
  category_id: string | null;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  author_id: string | null;
  status: KBArticleStatus;
  is_faq: boolean;
  is_pinned: boolean;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
  category?: KBCategory;
  author?: User;
}

export interface ScheduledReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  filters: Record<string, unknown>;
  schedule_frequency: ReportFrequency;
  schedule_day: number | null;
  schedule_time: string;
  schedule_timezone: string;
  delivery_method: "email" | "download" | "both";
  recipients: string[];
  format: ReportFormat;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptEntry {
  course_title: string;
  course_type: CourseType;
  enrollment_date: string;
  completion_date: string | null;
  status: EnrollmentStatus;
  score: number | null;
  credits: number | null;
  certificate_id: string | null;
}
