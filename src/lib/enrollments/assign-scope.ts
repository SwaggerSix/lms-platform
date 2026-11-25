/**
 * Who a member of staff may pick on the Assign Course screen, and whether
 * they may enrol someone other than themselves at all.
 *
 * - super admin: anyone.
 * - admin with an organization: everyone in it; without one, their own team.
 * - manager: their direct reports (users.manager_id).
 */
export type AssignScope =
  | { kind: "everyone" }
  | { kind: "organization"; organizationId: string }
  | { kind: "team" };

export function assignScope(user: { role?: string | null; organization_id?: string | null }): AssignScope {
  if (user.role === "super_admin") return { kind: "everyone" };
  if (user.role === "admin" && user.organization_id) return { kind: "organization", organizationId: user.organization_id };
  return { kind: "team" };
}

/** Roles that may enrol another user (POST /api/enrollments with user_id). */
export const CAN_ENROL_OTHERS = ["super_admin", "admin", "manager"];

export function canEnrolOthers(role?: string | null): boolean {
  return !!role && CAN_ENROL_OTHERS.includes(role);
}

/**
 * A course whose enrollment_type is "assigned" is joined only by buying it in
 * the store or by a member of staff assigning it. A learner can't enrol
 * themselves for free; staff still can (to test a course).
 */
export const ASSIGNED_ONLY_MESSAGE =
  "This course is available by purchase, or when an administrator assigns it to you.";

export function selfEnrolBlocked(enrollmentType: string | null | undefined, role?: string | null): boolean {
  return enrollmentType === "assigned" && !canEnrolOthers(role);
}
