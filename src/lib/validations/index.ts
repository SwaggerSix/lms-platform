import { z } from "zod";

// Courses
export const createCourseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  slug: z.string().min(1).max(200).optional(),
  course_type: z.enum(["self_paced", "instructor_led", "blended", "webinar"]).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  category_id: z.string().uuid().optional(),
  estimated_duration: z.number().int().positive().optional(),
  enrollment_type: z.enum(["open", "approval", "closed"]).optional(),
  max_enrollment: z.number().int().positive().optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

export const updateCourseSchema = createCourseSchema.partial().extend({
  id: z.string().uuid(),
});

// Users
export const createUserSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "manager", "instructor", "learner"]).optional(),
  job_title: z.string().max(200).optional(),
  organization_id: z.string().uuid().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  status: z.enum(["active", "inactive", "suspended"]).optional(),
  hire_date: z.string().optional().nullable(),
});

export const updateUserSchema = createUserSchema.partial();

// Enrollments
export const createEnrollmentSchema = z.object({
  course_id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  due_date: z.string().optional().nullable(),
});

// Assessments
export const createAssessmentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  course_id: z.string().uuid().optional().nullable(),
  time_limit: z.number().int().positive().optional().nullable(),
  passing_score: z.number().min(0).max(100).optional(),
  max_attempts: z.number().int().positive().optional(),
});

export const updateAssessmentSchema = createAssessmentSchema.partial().extend({
  id: z.string().uuid(),
});

// Messages
export const sendMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().min(1).max(10000),
  sender_id: z.string().uuid().optional(),
});

// Notifications
export const createNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  audience: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  scheduled_for: z.string().optional().nullable(),
  status: z.enum(["draft", "sent", "scheduled"]).optional(),
});

// Knowledge Base
export const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  category_id: z.string().uuid().optional().nullable(),
  status: z.enum(["draft", "published"]).optional(),
  tags: z.array(z.string()).optional(),
});

// Paths
export const createPathSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  estimated_duration: z.number().int().positive().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  items: z.array(z.object({
    course_id: z.string().uuid(),
    sort_order: z.number().int().optional(),
  })).optional(),
});

// Certifications
export const createCertificationSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  course_id: z.string().uuid().optional().nullable(),
  validity_period_days: z.number().int().positive().optional().nullable(),
  badge_image_url: z.string().url().optional().nullable(),
  issuing_authority: z.string().max(200).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

// Organizations
export const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  parent_id: z.string().uuid().optional().nullable(),
});

// Settings
export const updateSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(),
});

// Skills
export const createSkillSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  parent_id: z.string().uuid().optional().nullable(),
});

// Discussions
export const createDiscussionSchema = z.object({
  action: z.enum(["create_thread", "reply", "upvote"]),
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(10000).optional(),
  course: z.string().optional(),
  thread_id: z.string().uuid().optional(),
  post_id: z.string().uuid().optional(),
});

// Generic helper
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { success: false, error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ") };
  }
  return { success: true, data: result.data };
}
