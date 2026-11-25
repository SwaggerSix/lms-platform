import { describe, it, expect } from "vitest";
import { assignScope, canEnrolOthers } from "@/lib/enrollments/assign-scope";

describe("who can be picked on Assign Course", () => {
  it("a super admin can pick anyone", () => {
    expect(assignScope({ role: "super_admin", organization_id: null })).toEqual({ kind: "everyone" });
  });
  it("an org admin picks from their organization; without one, from their team", () => {
    expect(assignScope({ role: "admin", organization_id: "org1" })).toEqual({ kind: "organization", organizationId: "org1" });
    expect(assignScope({ role: "admin", organization_id: null })).toEqual({ kind: "team" });
  });
  it("a manager picks from their direct reports", () => {
    expect(assignScope({ role: "manager", organization_id: "org1" })).toEqual({ kind: "team" });
  });
  it("super admins, admins and managers may enrol someone else; learners and instructors may not", () => {
    expect(["super_admin", "admin", "manager"].every(canEnrolOthers)).toBe(true);
    expect(["learner", "instructor", "", null, undefined].some((r) => canEnrolOthers(r))).toBe(false);
  });
});
