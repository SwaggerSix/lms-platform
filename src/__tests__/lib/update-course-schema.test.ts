import { describe, it, expect } from "vitest";
import { updateCourseSchema } from "@/lib/validations";

/**
 * updateCourseSchema accepts arbitrary metadata blobs (z.record of unknown).
 * The /api/courses PATCH handler then merges metadata with the existing
 * row, so passing { id, metadata: { required_for: {...} } } is the
 * supported way to configure required-training criteria for a course
 * — replacing the legacy /api/compliance POST flow.
 *
 * These tests pin the schema's acceptance of required_for so a future
 * tightening (e.g. dropping z.unknown for a stricter record) doesn't
 * silently lock the admin out of the compliance UI.
 */

const COURSE_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("updateCourseSchema accepts required_for inside metadata", () => {
  it("accepts a complete required_for blob", () => {
    const result = updateCourseSchema.safeParse({
      id: COURSE_ID,
      metadata: {
        required_for: {
          roles: ["learner"],
          organization_ids: ["org-1"],
          regulation: "OSHA",
          frequency_months: 12,
          is_mandatory: true,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal required_for blob (roles only)", () => {
    const result = updateCourseSchema.safeParse({
      id: COURSE_ID,
      metadata: { required_for: { roles: ["learner"] } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts metadata without required_for (preserves the existing PATCH behavior)", () => {
    const result = updateCourseSchema.safeParse({
      id: COURSE_ID,
      metadata: { cpe_credits: 3 },
    });
    expect(result.success).toBe(true);
  });

  it("requires id (uuid) on every PATCH call", () => {
    expect(updateCourseSchema.safeParse({ metadata: {} }).success).toBe(false);
    expect(updateCourseSchema.safeParse({ id: "not-a-uuid", metadata: {} }).success).toBe(false);
  });
});
