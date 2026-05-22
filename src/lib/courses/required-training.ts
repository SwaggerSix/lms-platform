import { createServiceClient } from "@/lib/supabase/service";
import { addMonths, differenceInCalendarDays } from "date-fns";

export interface RequiredForConfig {
  roles: string[];
  organization_ids: string[];
  due_days?: number;
  /**
   * Compliance metadata (formerly in compliance_requirements). All optional —
   * a required-training course that is not compliance-driven omits these.
   */
  regulation?: string;
  frequency_months?: number;
  is_mandatory?: boolean;
}

const VALID_ROLES = new Set(["admin", "manager", "instructor", "learner"]);

/**
 * Parse a course's metadata.required_for blob into a normalized config.
 * Returns null when the course is not flagged as required training.
 */
export function readRequiredFor(metadata: unknown): RequiredForConfig | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).required_for;
  if (!raw || typeof raw !== "object") return null;
  const blob = raw as Record<string, unknown>;
  const roles = Array.isArray(blob.roles)
    ? (blob.roles as unknown[]).map((r) => String(r).trim().toLowerCase()).filter((r) => VALID_ROLES.has(r))
    : [];
  const organization_ids = Array.isArray(blob.organization_ids)
    ? (blob.organization_ids as unknown[]).map((o) => String(o).trim()).filter(Boolean)
    : [];
  if (roles.length === 0 && organization_ids.length === 0) return null;
  const dueDaysRaw = Number(blob.due_days);
  const freqRaw = Number(blob.frequency_months);
  const regulation = typeof blob.regulation === "string" ? blob.regulation.trim() : "";
  return {
    roles,
    organization_ids,
    due_days: Number.isFinite(dueDaysRaw) && dueDaysRaw > 0 ? Math.floor(dueDaysRaw) : undefined,
    regulation: regulation || undefined,
    frequency_months: Number.isFinite(freqRaw) && freqRaw > 0 ? Math.floor(freqRaw) : undefined,
    is_mandatory: blob.is_mandatory === false ? false : true,
  };
}

/**
 * Whether a user matches a course's required-for criteria. A course with both
 * roles and organization_ids requires both to match. Empty arrays are wildcards.
 */
export function userMatchesRequiredFor(
  required: RequiredForConfig,
  user: { role: string | null; organization_id: string | null }
): boolean {
  if (required.roles.length > 0) {
    if (!user.role || !required.roles.includes(user.role)) return false;
  }
  if (required.organization_ids.length > 0) {
    if (!user.organization_id || !required.organization_ids.includes(user.organization_id)) return false;
  }
  return true;
}

/**
 * Bucket a completed enrollment into a recertification reminder tier given
 * the course's recurrence window. Returns null when the completion isn't yet
 * within reminder distance. The boundaries are inclusive:
 *   daysLeft <= 0  → "expired"
 *   daysLeft <= 7  → "7"
 *   daysLeft <= 30 → "30"
 *   otherwise      → null
 * Splitting this out of the cron lets us unit-test the boundary logic without
 * mocking Supabase.
 */
/**
 * Compute the recurrence-expiry date for a recurring required-training
 * completion. Uses date-fns addMonths so day-of-month is clamped to the
 * last day of the target month (Jan 31 + 1 month → Feb 28/29) rather than
 * rolling over. All compliance-window calculations in the app should
 * route through this helper so boundaries stay consistent.
 */
export function computeRecertExpiry(
  completedAt: Date | string,
  frequencyMonths: number
): Date {
  const base = completedAt instanceof Date ? completedAt : new Date(completedAt);
  return addMonths(base, Math.floor(frequencyMonths));
}

export function recertificationTier(
  completedAt: Date | string,
  frequencyMonths: number,
  now: Date = new Date()
): "30" | "7" | "expired" | null {
  if (!frequencyMonths || frequencyMonths <= 0) return null;
  const completion = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (Number.isNaN(completion.getTime())) return null;
  // date-fns addMonths clamps to the last day of the target month rather
  // than rolling over (Jan 31 + 1 month → Feb 28/29). This is the
  // calendar-aware behavior most users expect.
  const expires = addMonths(completion, Math.floor(frequencyMonths));
  const daysLeft = differenceInCalendarDays(expires, now);
  if (daysLeft <= 0) return "expired";
  if (daysLeft <= 7) return "7";
  if (daysLeft <= 30) return "30";
  return null;
}

export interface RequiredCourseSource {
  /** Stable identifier for UI keys: `course:<courseId>`. */
  id: string;
  /** Course title or "Untitled Course". */
  name: string;
  regulation: string;
  mandatory: boolean;
  frequencyMonths: number | null;
  applicableRoles: string[];
  applicableOrgIds: string[];
  courseId: string;
  courseName: string;
}

/**
 * Single source for every page/route that needs the list of courses
 * currently flagged as required training. Replaces the merged
 * legacy-table + course-metadata reads that the admin/manager pages
 * still do — once readers cut over to this helper, the legacy
 * compliance_requirements table can be dropped.
 *
 * Excludes archived courses. Pure read; safe to call with the service
 * client only (RLS not exercised since we filter in JS).
 */
export async function getRequiredCourseSources(
  service: ReturnType<typeof createServiceClient>
): Promise<RequiredCourseSource[]> {
  const { data: rows, error } = await service
    .from("courses")
    .select("id, title, metadata")
    .neq("status", "archived");

  if (error || !rows) return [];

  const sources: RequiredCourseSource[] = [];
  for (const row of rows as { id: string; title: string | null; metadata: unknown }[]) {
    const required = readRequiredFor(row.metadata);
    if (!required) continue;
    sources.push({
      id: `course:${row.id}`,
      name: row.title ?? "Untitled Course",
      regulation: required.regulation ?? "",
      mandatory: required.is_mandatory !== false,
      frequencyMonths: required.frequency_months ?? null,
      applicableRoles: required.roles,
      applicableOrgIds: required.organization_ids,
      courseId: row.id,
      courseName: row.title ?? "Untitled Course",
    });
  }
  return sources;
}

/**
 * Same as getRequiredCourseSources, but restricted to courses visible
 * inside a tenant scope (the set of course IDs the acting manager/learner
 * is allowed to read). Pass `null` for the scope to return all sources
 * (admin / super_admin case).
 *
 * Kept as a thin wrapper rather than a parameter to getRequiredCourseSources
 * so the unscoped helper stays cheap to test and call from cron jobs
 * that operate platform-wide.
 */
export async function getTenantScopedRequiredCourseSources(
  service: ReturnType<typeof createServiceClient>,
  scope: { courseIds: string[] } | null
): Promise<RequiredCourseSource[]> {
  const sources = await getRequiredCourseSources(service);
  if (!scope) return sources;
  const allowed = new Set(scope.courseIds);
  return sources.filter((s) => allowed.has(s.courseId));
}

interface SyncResult {
  enrolled: number;
  skipped: number;
  errors: string[];
}

/**
 * Retroactively enrol every active user matching a course's required-for criteria.
 * Idempotent: existing enrollments are left untouched.
 */
export async function syncRequiredEnrollmentsForCourse(
  courseId: string,
  assignedBy: string | null
): Promise<SyncResult> {
  const service = createServiceClient();

  const { data: course } = await service
    .from("courses")
    .select("id, metadata, status")
    .eq("id", courseId)
    .single();

  if (!course || course.status === "archived") {
    return { enrolled: 0, skipped: 0, errors: ["Course not found or archived"] };
  }

  const required = readRequiredFor(course.metadata);
  if (!required) return { enrolled: 0, skipped: 0, errors: [] };

  let usersQuery = service
    .from("users")
    .select("id, role, organization_id, hire_date")
    .eq("status", "active");

  if (required.roles.length > 0) {
    usersQuery = usersQuery.in("role", required.roles);
  }
  if (required.organization_ids.length > 0) {
    usersQuery = usersQuery.in("organization_id", required.organization_ids);
  }

  const { data: matchingUsers, error } = await usersQuery;
  if (error || !matchingUsers || matchingUsers.length === 0) {
    return { enrolled: 0, skipped: 0, errors: error ? [error.message] : [] };
  }

  const userIds = matchingUsers.map((u) => u.id);
  const { data: existing } = await service
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId)
    .in("user_id", userIds);

  const alreadyEnrolled = new Set((existing ?? []).map((e: { user_id: string }) => e.user_id));

  const toCreate = matchingUsers.filter((u) => !alreadyEnrolled.has(u.id));
  if (toCreate.length === 0) {
    return { enrolled: 0, skipped: matchingUsers.length, errors: [] };
  }

  const inserts = toCreate.map((u) => {
    const due = computeDueDate(u.hire_date, required.due_days);
    return {
      user_id: u.id,
      course_id: courseId,
      status: "enrolled" as const,
      assigned_by: assignedBy,
      due_date: due,
    };
  });

  const { error: insertErr } = await service.from("enrollments").insert(inserts);
  if (insertErr) {
    return { enrolled: 0, skipped: alreadyEnrolled.size, errors: [insertErr.message] };
  }

  return { enrolled: inserts.length, skipped: alreadyEnrolled.size, errors: [] };
}

/**
 * For a newly-created user, find every course flagged as required for their
 * role/org and enrol them. Idempotent.
 */
export async function enrollUserInAllRequiredCourses(
  userId: string,
  assignedBy: string | null
): Promise<SyncResult> {
  const service = createServiceClient();

  const { data: user } = await service
    .from("users")
    .select("id, role, organization_id, hire_date, status")
    .eq("id", userId)
    .single();

  if (!user || user.status !== "active") {
    return { enrolled: 0, skipped: 0, errors: [] };
  }

  // Pull all non-archived courses; metadata is JSONB so we filter in JS.
  const { data: courses } = await service
    .from("courses")
    .select("id, metadata, status")
    .neq("status", "archived");

  const matchingCourses: { id: string; required: RequiredForConfig }[] = [];
  for (const c of courses ?? []) {
    const required = readRequiredFor(c.metadata);
    if (!required) continue;
    if (userMatchesRequiredFor(required, { role: user.role, organization_id: user.organization_id })) {
      matchingCourses.push({ id: c.id, required });
    }
  }

  if (matchingCourses.length === 0) {
    return { enrolled: 0, skipped: 0, errors: [] };
  }

  const courseIds = matchingCourses.map((c) => c.id);
  const { data: existing } = await service
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .in("course_id", courseIds);

  const alreadyEnrolled = new Set((existing ?? []).map((e: { course_id: string }) => e.course_id));
  const toCreate = matchingCourses.filter((c) => !alreadyEnrolled.has(c.id));

  if (toCreate.length === 0) {
    return { enrolled: 0, skipped: matchingCourses.length, errors: [] };
  }

  const inserts = toCreate.map((c) => ({
    user_id: userId,
    course_id: c.id,
    status: "enrolled" as const,
    assigned_by: assignedBy,
    due_date: computeDueDate(user.hire_date, c.required.due_days),
  }));

  const { error: insertErr } = await service.from("enrollments").insert(inserts);
  if (insertErr) {
    return { enrolled: 0, skipped: alreadyEnrolled.size, errors: [insertErr.message] };
  }

  return { enrolled: inserts.length, skipped: alreadyEnrolled.size, errors: [] };
}

function computeDueDate(hireDate: string | null, dueDays?: number): string | null {
  if (!dueDays || dueDays <= 0) return null;
  const base = hireDate ? new Date(hireDate) : new Date();
  base.setDate(base.getDate() + dueDays);
  return base.toISOString().split("T")[0];
}
