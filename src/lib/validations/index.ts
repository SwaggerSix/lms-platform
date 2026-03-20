import { z } from "zod";

// Drip content settings for modules
export const dripSettingsSchema = z.object({
  drip_type: z.enum(["immediate", "after_days", "on_date", "after_previous"]).default("immediate"),
  drip_days: z.number().int().min(0).default(0),
  drip_date: z.string().nullable().optional(),
});

// Module schema (used when modules are included inline with course creation)
export const moduleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sequence_order: z.number().int().min(0).optional(),
  drip_type: z.enum(["immediate", "after_days", "on_date", "after_previous"]).default("immediate"),
  drip_days: z.number().int().min(0).default(0),
  drip_date: z.string().nullable().optional(),
});

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
  metadata: z.record(z.string(), z.unknown()).optional(),
  published_at: z.string().nullable().optional(),
  short_description: z.string().max(500).optional(),
  passing_score: z.number().int().min(0).max(100).optional(),
  max_attempts: z.number().int().positive().optional(),
  difficulty_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
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
  reason: z.string().max(1000).optional().nullable(),
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

// Module drip update
export const updateModuleDripSchema = z.object({
  id: z.string().uuid(),
  drip_type: z.enum(["immediate", "after_days", "on_date", "after_previous"]),
  drip_days: z.number().int().min(0).default(0),
  drip_date: z.string().nullable().optional(),
});

// Prerequisites
export const addPrerequisiteSchema = z.object({
  prerequisite_course_id: z.string().uuid(),
  requirement_type: z.enum(["completion", "min_score", "enrollment"]).default("completion"),
  min_score: z.number().int().min(0).max(100).optional().nullable(),
});

// SSO Providers
export const createSSOProviderSchema = z.object({
  name: z.string().min(1).max(200),
  provider_type: z.enum(["saml", "oidc"]).default("saml"),
  entity_id: z.string().max(500).optional().nullable(),
  metadata_url: z.string().url().max(1000).optional().nullable(),
  domain: z.string().min(1).max(253),
  auto_provision_users: z.boolean().default(true),
  default_role: z.enum(["admin", "manager", "instructor", "learner"]).default("learner"),
  attribute_mapping: z.record(z.string(), z.string()).default({}),
});

export const updateSSOProviderSchema = createSSOProviderSchema.partial().extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
  scim_enabled: z.boolean().optional(),
});

// eCommerce - Products
export const createProductSchema = z.object({
  course_id: z.string().uuid(),
  price: z.number().min(0),
  currency: z.string().default("USD"),
  discount_price: z.number().min(0).optional().nullable(),
  discount_ends_at: z.string().optional().nullable(),
  is_featured: z.boolean().default(false),
  status: z.enum(["active", "inactive", "coming_soon"]).default("active"),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().uuid(),
});

// eCommerce - Cart
export const addToCartSchema = z.object({
  product_id: z.string().uuid(),
});

// eCommerce - Checkout
export const checkoutSchema = z.object({
  payment_method: z.string().default("card"),
  coupon_code: z.string().optional(),
});

// eCommerce - Coupons
export const createCouponSchema = z.object({
  code: z.string().min(1).max(50),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.number().min(0),
  max_uses: z.number().int().positive().optional().nullable(),
  min_purchase: z.number().min(0).optional().nullable(),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

// eCommerce - Validate Coupon
export const validateCouponSchema = z.object({
  code: z.string().min(1).max(50),
});

// eCommerce - Order Update
export const updateOrderSchema = z.object({
  status: z.enum(["pending", "completed", "refunded", "failed"]),
});

// 360-Degree Feedback
export const createFeedbackCycleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  cycle_type: z.enum(["360", "peer", "manager", "self"]).default("360"),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  anonymous: z.boolean().default(true),
});

export const updateFeedbackCycleSchema = createFeedbackCycleSchema.partial().extend({
  status: z.enum(["draft", "active", "closed", "archived"]).optional(),
});

export const createNominationSchema = z.object({
  subject_id: z.string().uuid(),
  reviewer_id: z.string().uuid(),
  relationship: z.enum(["self", "peer", "manager", "direct_report", "external"]),
});

export const createFeedbackResponseSchema = z.object({
  nomination_id: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  is_draft: z.boolean().default(true),
});

export const updateFeedbackResponseSchema = z.object({
  id: z.string().uuid(),
  answers: z.record(z.string(), z.unknown()),
  is_draft: z.boolean().default(true),
});

export const createFeedbackTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  cycle_id: z.string().uuid(),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string().min(1),
    type: z.enum(["rating", "text", "competency", "multiple_choice"]),
    required: z.boolean().default(true),
    options: z.array(z.string()).optional(),
    competency_id: z.string().uuid().optional(),
  })),
});

export const createCompetencySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(200).optional(),
  is_active: z.boolean().default(true),
});

// AI Chatbot
export const createChatSessionSchema = z.object({
  title: z.string().max(200).optional(),
  context_course_id: z.string().uuid().optional().nullable(),
  context_type: z.enum(["general", "course", "assessment", "career"]).default("general"),
});

export const sendChatMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

// Multi-Tenant
export const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(2).max(63).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Slug must be lowercase alphanumeric with hyphens"),
  domain: z.string().max(253).optional().nullable(),
  logo_url: z.string().url().optional().nullable(),
  favicon_url: z.string().url().optional().nullable(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  plan: z.enum(["free", "starter", "professional", "enterprise"]).optional(),
  max_users: z.number().int().positive().optional().nullable(),
  max_courses: z.number().int().positive().optional().nullable(),
});

export const updateTenantSchema = createTenantSchema.partial();

export const updateTenantBrandingSchema = z.object({
  logo_url: z.string().url().optional().nullable(),
  favicon_url: z.string().url().optional().nullable(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  branding: z.object({
    login_bg: z.string().optional(),
    hero_text: z.string().max(500).optional(),
    footer_text: z.string().max(500).optional(),
    custom_css: z.string().max(10000).optional(),
  }).optional(),
});

export const addTenantMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export const assignTenantCourseSchema = z.object({
  course_id: z.string().uuid(),
  is_featured: z.boolean().optional(),
  custom_price: z.number().min(0).optional().nullable(),
});

export const tenantInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

// Workflow Automation
export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  trigger_type: z.enum(["event", "schedule", "webhook", "manual"]),
  trigger_config: z.record(z.string(), z.unknown()).optional().default({}),
  is_active: z.boolean().optional().default(true),
});

export const updateWorkflowSchema = createWorkflowSchema.partial();

export const createWorkflowStepSchema = z.object({
  step_type: z.enum(["condition", "action", "delay", "branch", "loop"]),
  step_config: z.record(z.string(), z.unknown()).default({}),
  position_x: z.number().int().optional().default(0),
  position_y: z.number().int().optional().default(0),
  next_step_id: z.string().uuid().optional().nullable(),
  true_step_id: z.string().uuid().optional().nullable(),
  false_step_id: z.string().uuid().optional().nullable(),
  sequence_order: z.number().int().optional().default(0),
});

export const bulkUpdateStepsSchema = z.object({
  steps: z.array(
    z.object({
      id: z.string().uuid(),
      step_type: z.enum(["condition", "action", "delay", "branch", "loop"]).optional(),
      step_config: z.record(z.string(), z.unknown()).optional(),
      position_x: z.number().int().optional(),
      position_y: z.number().int().optional(),
      next_step_id: z.string().uuid().optional().nullable(),
      true_step_id: z.string().uuid().optional().nullable(),
      false_step_id: z.string().uuid().optional().nullable(),
      sequence_order: z.number().int().optional(),
    })
  ),
});

// Microlearning - Nuggets
export const createNuggetSchema = z.object({
  title: z.string().min(1).max(200),
  content_type: z.enum(["tip", "flashcard", "quiz", "video_clip", "infographic", "checklist"]),
  content: z.record(z.string(), z.unknown()).default({}),
  course_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  estimated_seconds: z.number().int().min(1).max(3600).optional(),
  is_active: z.boolean().optional(),
});

export const updateNuggetSchema = createNuggetSchema.partial();

// Microlearning - Progress
export const createMicroProgressSchema = z.object({
  nugget_id: z.string().uuid(),
  status: z.enum(["viewed", "completed", "bookmarked"]).default("viewed"),
  score: z.number().min(0).max(100).optional(),
});

// Microlearning - Schedule
export const updateMicroScheduleSchema = z.object({
  frequency: z.enum(["daily", "weekdays", "weekly"]).optional(),
  preferred_time: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format").optional(),
  topics: z.array(z.string()).optional(),
  max_per_day: z.number().int().min(1).max(20).optional(),
  is_active: z.boolean().optional(),
});

// Embed Widgets
export const createWidgetSchema = z.object({
  name: z.string().min(1).max(200),
  widget_type: z.enum(["course_card", "progress_bar", "nugget_feed", "leaderboard", "skill_radar"]),
  config: z.record(z.string(), z.unknown()).optional(),
  allowed_domains: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
});

// XR Content
export const createXRContentSchema = z.object({
  lesson_id: z.string().uuid().optional().nullable(),
  content_type: z.enum(["vr_360", "vr_interactive", "ar_overlay", "3d_model"]),
  file_url: z.string().url(),
  fallback_url: z.string().url().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  player_config: z.record(z.string(), z.unknown()).optional(),
  compatibility: z.array(z.string()).optional(),
});

export const updateXRContentSchema = createXRContentSchema.partial();

// XR Sessions
export const createXRSessionSchema = z.object({
  content_id: z.string().uuid(),
  device_type: z.string().max(100).optional(),
  duration_seconds: z.number().int().min(0).optional(),
  interactions: z.array(z.record(z.string(), z.unknown())).optional(),
  completed: z.boolean().optional(),
});

// Marketplace - Providers
export const createMarketplaceProviderSchema = z.object({
  name: z.string().min(1).max(200),
  provider_type: z.enum(["linkedin_learning", "coursera", "udemy_business", "openai", "custom"]),
  api_config: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export const updateMarketplaceProviderSchema = createMarketplaceProviderSchema.partial();

// Marketplace - Enrollment
export const createMarketplaceEnrollmentSchema = z.object({
  marketplace_course_id: z.string().uuid(),
});

// xAPI Statements
export const xapiStatementSchema = z.object({
  id: z.string().optional(),
  actor: z.object({
    objectType: z.enum(["Agent", "Group"]).optional(),
    name: z.string().optional(),
    mbox: z.string().optional(),
    account: z.object({
      homePage: z.string(),
      name: z.string(),
    }).optional(),
  }).optional(),
  verb: z.object({
    id: z.string().min(1),
    display: z.record(z.string(), z.string()).optional(),
  }),
  object: z.object({
    objectType: z.enum(["Activity", "Agent", "Group", "StatementRef"]).optional(),
    id: z.string().optional(),
    definition: z.object({
      type: z.string().optional(),
      name: z.record(z.string(), z.string()).optional(),
      description: z.record(z.string(), z.string()).optional(),
    }).optional(),
  }),
  result: z.object({
    score: z.object({
      scaled: z.number().min(-1).max(1).optional(),
      raw: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    success: z.boolean().optional(),
    completion: z.boolean().optional(),
    duration: z.string().optional(),
    response: z.string().optional(),
  }).optional(),
  context: z.object({
    registration: z.string().uuid().optional(),
    contextActivities: z.record(z.string(), z.unknown()).optional(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  timestamp: z.string().optional(),
  version: z.string().optional(),
});

// LRS Configuration
export const lrsConfigSchema = z.object({
  name: z.string().min(1).max(200),
  endpoint_url: z.string().url(),
  auth_type: z.enum(["basic", "oauth"]),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  token: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  sync_direction: z.enum(["push", "pull", "both"]).optional(),
});

export const lrsConfigUpdateSchema = lrsConfigSchema.partial();

// Mentorship - Mentor Profile
export const createMentorProfileSchema = z.object({
  expertise_areas: z.array(z.string()).default([]),
  availability: z.enum(["available", "limited", "unavailable"]).default("available"),
  max_mentees: z.number().int().min(1).max(20).default(3),
  bio: z.string().max(2000).optional(),
  years_experience: z.number().int().min(0).max(50).optional(),
  timezone: z.string().max(100).optional(),
  preferred_meeting_frequency: z.enum(["weekly", "biweekly", "monthly"]).default("weekly"),
});

export const updateMentorProfileSchema = createMentorProfileSchema.partial();

// Mentorship - Request
export const createMentorshipRequestSchema = z.object({
  mentor_id: z.string().uuid().optional(),
  goals: z.string().min(1).max(2000),
  preferred_areas: z.array(z.string()).default([]),
});

export const updateMentorshipRequestSchema = z.object({
  status: z.enum(["matched", "active", "completed", "cancelled"]),
});

// Mentorship - Session
export const createMentorshipSessionSchema = z.object({
  request_id: z.string().uuid(),
  scheduled_at: z.string().min(1),
  duration_minutes: z.number().int().min(15).max(180).default(30),
  meeting_url: z.string().url().optional(),
  notes: z.string().max(5000).optional(),
});

export const updateMentorshipSessionSchema = z.object({
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  mentor_notes: z.string().max(5000).optional(),
  mentee_notes: z.string().max(5000).optional(),
  meeting_url: z.string().url().optional(),
  notes: z.string().max(5000).optional(),
});

// Mentorship - Review
export const createMentorReviewSchema = z.object({
  request_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(2000).optional(),
});

// Analytics - Alerts
export const updateAlertSchema = z.object({
  is_read: z.boolean().optional(),
  is_dismissed: z.boolean().optional(),
});

// HRIS / CRM Integrations
export const createExternalIntegrationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["hris", "crm", "hr_system"]),
  provider: z.enum(["bamboohr", "workday", "adp", "salesforce", "hubspot", "custom_webhook"]),
  is_active: z.boolean().optional().default(false),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  sync_direction: z.enum(["import", "export", "both"]).optional().default("import"),
  sync_frequency: z.enum(["realtime", "hourly", "daily", "weekly", "manual"]).optional().default("daily"),
});

export const updateExternalIntegrationSchema = createExternalIntegrationSchema.partial();

export const updateFieldMappingsSchema = z.object({
  mappings: z.array(z.object({
    id: z.string().uuid().optional(),
    source_field: z.string().min(1),
    target_field: z.string().min(1),
    transform: z.string().optional().nullable(),
    is_active: z.boolean().optional().default(true),
  })),
});

export const testConnectionSchema = z.object({
  provider: z.enum(["bamboohr", "workday", "adp", "salesforce", "hubspot", "custom_webhook"]),
  config: z.record(z.string(), z.unknown()),
});

// Observation Checklists
export const createObservationTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(200).optional(),
  items: z.array(z.object({
    id: z.string(),
    label: z.string().min(1),
    type: z.enum(["checkbox", "rating", "text", "yes_no"]),
    required: z.boolean().optional().default(false),
    weight: z.number().min(0).max(100).optional().default(1),
  })).default([]),
  passing_score: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateObservationTemplateSchema = createObservationTemplateSchema.partial();

export const createObservationSchema = z.object({
  template_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  course_id: z.string().uuid().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  location: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateObservationSchema = z.object({
  status: z.enum(["draft", "in_progress", "completed", "signed_off"]).optional(),
  responses: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  overall_score: z.number().min(0).max(100).optional(),
  completed_at: z.string().optional().nullable(),
});

export const signOffObservationSchema = z.object({
  notes: z.string().max(5000).optional(),
});

// Training Evaluations
export const evaluationQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  type: z.enum(["rating", "text", "multiple_choice", "yes_no", "nps"]),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(), // for multiple_choice
  scale_min: z.number().optional(),        // for rating/nps
  scale_max: z.number().optional(),
  scale_min_label: z.string().optional(),
  scale_max_label: z.string().optional(),
});

export const createEvaluationTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  level: z.number().int().min(1).max(4).default(1),
  questions: z.array(evaluationQuestionSchema).min(1),
  is_active: z.boolean().default(true),
});

export const updateEvaluationTemplateSchema = createEvaluationTemplateSchema.partial();

export const createEvaluationTriggerSchema = z.object({
  course_id: z.string().uuid(),
  template_id: z.string().uuid(),
  delay_days: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

export const updateEvaluationTriggerSchema = createEvaluationTriggerSchema.partial();

export const submitEvaluationResponseSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

// Generic helper
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { success: false, error: result.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ") };
  }
  return { success: true, data: result.data };
}
