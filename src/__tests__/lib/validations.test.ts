import { describe, it, expect } from "vitest";
import {
  createCourseSchema,
  updateCourseSchema,
  createUserSchema,
  updateUserSchema,
  createEnrollmentSchema,
  createAssessmentSchema,
  updateAssessmentSchema,
  sendMessageSchema,
  createNotificationSchema,
  createArticleSchema,
  createPathSchema,
  createCertificationSchema,
  createOrgSchema,
  updateSettingSchema,
  createSkillSchema,
  createDiscussionSchema,
  validateBody,
} from "@/lib/validations";

// ---------------------------------------------------------------------------
// createCourseSchema
// ---------------------------------------------------------------------------
describe("createCourseSchema", () => {
  it("accepts a minimal valid course", () => {
    const result = createCourseSchema.safeParse({ title: "Intro to TS" });
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated course", () => {
    const result = createCourseSchema.safeParse({
      title: "Advanced TypeScript",
      description: "Deep dive into TS generics",
      slug: "advanced-ts",
      course_type: "self_paced",
      difficulty: "advanced",
      status: "draft",
      category_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      estimated_duration: 120,
      enrollment_type: "open",
      max_enrollment: 50,
      thumbnail_url: "https://example.com/thumb.png",
      tags: ["typescript", "programming"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createCourseSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title exceeding 200 characters", () => {
    const result = createCourseSchema.safeParse({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid course_type enum", () => {
    const result = createCourseSchema.safeParse({ title: "Test", course_type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects negative estimated_duration", () => {
    const result = createCourseSchema.safeParse({ title: "Test", estimated_duration: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid category_id", () => {
    const result = createCourseSchema.safeParse({ title: "Test", category_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid thumbnail_url", () => {
    const result = createCourseSchema.safeParse({ title: "Test", thumbnail_url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("allows nullable max_enrollment", () => {
    const result = createCourseSchema.safeParse({ title: "Test", max_enrollment: null });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateCourseSchema
// ---------------------------------------------------------------------------
describe("updateCourseSchema", () => {
  it("requires an id (uuid)", () => {
    const result = updateCourseSchema.safeParse({ title: "Updated" });
    expect(result.success).toBe(false);
  });

  it("accepts id with partial fields", () => {
    const result = updateCourseSchema.safeParse({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      title: "Updated Title",
    });
    expect(result.success).toBe(true);
  });

  it("allows updating only the id (no other fields required)", () => {
    const result = updateCourseSchema.safeParse({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createUserSchema
// ---------------------------------------------------------------------------
describe("createUserSchema", () => {
  it("accepts valid user with required fields", () => {
    const result = createUserSchema.safeParse({
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = createUserSchema.safeParse({ first_name: "Jane", last_name: "Doe" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = createUserSchema.safeParse({
      first_name: "Jane",
      last_name: "Doe",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty first_name", () => {
    const result = createUserSchema.safeParse({
      first_name: "",
      last_name: "Doe",
      email: "jane@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid roles", () => {
    for (const role of ["admin", "manager", "instructor", "learner"]) {
      const result = createUserSchema.safeParse({
        first_name: "A",
        last_name: "B",
        email: "a@b.com",
        role,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid role", () => {
    const result = createUserSchema.safeParse({
      first_name: "A",
      last_name: "B",
      email: "a@b.com",
      role: "superadmin",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateUserSchema
// ---------------------------------------------------------------------------
describe("updateUserSchema", () => {
  it("accepts partial updates (only email)", () => {
    const result = updateUserSchema.safeParse({ email: "new@example.com" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (all fields optional)", () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createEnrollmentSchema
// ---------------------------------------------------------------------------
describe("createEnrollmentSchema", () => {
  it("accepts valid enrollment", () => {
    const result = createEnrollmentSchema.safeParse({
      course_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid course_id", () => {
    const result = createEnrollmentSchema.safeParse({ course_id: "abc" });
    expect(result.success).toBe(false);
  });

  it("accepts nullable due_date", () => {
    const result = createEnrollmentSchema.safeParse({
      course_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      due_date: null,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createAssessmentSchema
// ---------------------------------------------------------------------------
describe("createAssessmentSchema", () => {
  it("accepts valid assessment", () => {
    const result = createAssessmentSchema.safeParse({ title: "Quiz 1" });
    expect(result.success).toBe(true);
  });

  it("rejects passing_score above 100", () => {
    const result = createAssessmentSchema.safeParse({ title: "Quiz", passing_score: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects negative passing_score", () => {
    const result = createAssessmentSchema.safeParse({ title: "Quiz", passing_score: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects zero max_attempts (must be positive)", () => {
    const result = createAssessmentSchema.safeParse({ title: "Quiz", max_attempts: 0 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sendMessageSchema
// ---------------------------------------------------------------------------
describe("sendMessageSchema", () => {
  it("accepts valid message", () => {
    const result = sendMessageSchema.safeParse({
      conversation_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      content: "Hello!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = sendMessageSchema.safeParse({
      conversation_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      content: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects content exceeding 10000 characters", () => {
    const result = sendMessageSchema.safeParse({
      conversation_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      content: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createNotificationSchema
// ---------------------------------------------------------------------------
describe("createNotificationSchema", () => {
  it("accepts valid notification", () => {
    const result = createNotificationSchema.safeParse({
      title: "Reminder",
      body: "Your course is due tomorrow",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing body", () => {
    const result = createNotificationSchema.safeParse({ title: "Reminder" });
    expect(result.success).toBe(false);
  });

  it("accepts all priority levels", () => {
    for (const priority of ["low", "normal", "high", "urgent"]) {
      const result = createNotificationSchema.safeParse({
        title: "T",
        body: "B",
        priority,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// createArticleSchema
// ---------------------------------------------------------------------------
describe("createArticleSchema", () => {
  it("accepts valid article", () => {
    const result = createArticleSchema.safeParse({
      title: "Getting Started",
      content: "Welcome to the platform...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing content", () => {
    const result = createArticleSchema.safeParse({ title: "No content" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createPathSchema
// ---------------------------------------------------------------------------
describe("createPathSchema", () => {
  it("accepts path with items", () => {
    const result = createPathSchema.safeParse({
      title: "Frontend Path",
      items: [
        { course_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", sort_order: 1 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid item course_id", () => {
    const result = createPathSchema.safeParse({
      title: "Path",
      items: [{ course_id: "invalid" }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createCertificationSchema
// ---------------------------------------------------------------------------
describe("createCertificationSchema", () => {
  it("accepts valid certification", () => {
    const result = createCertificationSchema.safeParse({ name: "AWS Cert" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid badge_image_url", () => {
    const result = createCertificationSchema.safeParse({
      name: "Cert",
      badge_image_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createOrgSchema, updateSettingSchema, createSkillSchema, createDiscussionSchema
// ---------------------------------------------------------------------------
describe("createOrgSchema", () => {
  it("accepts valid org", () => {
    expect(createOrgSchema.safeParse({ name: "Acme" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(createOrgSchema.safeParse({ name: "" }).success).toBe(false);
  });
});

describe("updateSettingSchema", () => {
  it("accepts any value type", () => {
    expect(updateSettingSchema.safeParse({ key: "theme", value: "dark" }).success).toBe(true);
    expect(updateSettingSchema.safeParse({ key: "count", value: 42 }).success).toBe(true);
    expect(updateSettingSchema.safeParse({ key: "flag", value: true }).success).toBe(true);
  });
});

describe("createSkillSchema", () => {
  it("accepts valid skill", () => {
    expect(createSkillSchema.safeParse({ name: "TypeScript" }).success).toBe(true);
  });
});

describe("createDiscussionSchema", () => {
  it("accepts create_thread action", () => {
    const result = createDiscussionSchema.safeParse({
      action: "create_thread",
      title: "Question",
      body: "How does this work?",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown action", () => {
    const result = createDiscussionSchema.safeParse({ action: "delete" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateBody helper
// ---------------------------------------------------------------------------
describe("validateBody", () => {
  it("returns success with parsed data for valid input", () => {
    const result = validateBody(createCourseSchema, { title: "Test Course" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Test Course");
    }
  });

  it("returns error string for invalid input", () => {
    const result = validateBody(createCourseSchema, { title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe("string");
    }
  });

  it("includes field path in error message", () => {
    const result = validateBody(createUserSchema, {
      first_name: "A",
      last_name: "B",
      email: "bad",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("email");
    }
  });

  it("reports multiple errors separated by comma", () => {
    const result = validateBody(createUserSchema, {});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(",");
    }
  });
});
