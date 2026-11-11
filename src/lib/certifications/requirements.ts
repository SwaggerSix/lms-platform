/**
 * Which courses a staff-awarded credential needs.
 *
 * Two shapes:
 * - `award_requires_course_ids` (several): Mosaic Practitioner Certified
 *   needs MOS-100, MOS-230 and MOS-240 all finished (final exams passed). Its
 *   capstone opens only then, as the bundle's sales page says.
 * - `award_requires_course_id` (one): the Coaching Studio and SurveyCraft
 *   Specialists. The learner can hand in work once enrolled; Award waits for
 *   the course to be finished.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CourseRequirement {
  award_requires_course_id?: string | null;
  award_requires_course_ids?: string[] | null;
}

export function requiredCourseIds(cert: CourseRequirement): string[] {
  const many = (cert.award_requires_course_ids ?? []).filter(Boolean);
  if (many.length) return [...new Set(many)];
  return cert.award_requires_course_id ? [cert.award_requires_course_id] : [];
}

/** Capstone opens only once every course is finished (vs. on enrolment). */
export function opensOnCompletion(cert: CourseRequirement): boolean {
  return (cert.award_requires_course_ids ?? []).filter(Boolean).length > 0;
}

/** Of `userIds` (or everyone, when omitted), who has finished every course in `courseIds`. */
export async function finishedAll(
  service: SupabaseClient,
  courseIds: string[],
  userIds?: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (!courseIds.length) return out;
  let q = service
    .from("enrollments")
    .select("user_id, course_id, completed_at")
    .in("course_id", courseIds)
    .eq("status", "completed");
  if (userIds) {
    if (!userIds.length) return out;
    q = q.in("user_id", userIds);
  }
  const { data, error } = await q.limit(5000);
  if (error) throw new Error(error.message);
  const byUser = new Map<string, Map<string, string | null>>();
  for (const r of (data ?? []) as { user_id: string; course_id: string; completed_at: string | null }[]) {
    const m = byUser.get(r.user_id) ?? new Map<string, string | null>();
    const prev = m.get(r.course_id);
    if (prev === undefined || (r.completed_at && (!prev || r.completed_at < prev))) m.set(r.course_id, r.completed_at);
    byUser.set(r.user_id, m);
  }
  for (const [uid, m] of byUser) {
    if (courseIds.every((c) => m.has(c))) {
      // When the last of them was finished.
      const dates = [...m.values()].filter(Boolean) as string[];
      out.set(uid, dates.length ? dates.sort().at(-1)! : null);
    }
  }
  return out;
}

/** Whether one learner has finished every course the credential needs. */
export async function hasFinishedAll(service: SupabaseClient, cert: CourseRequirement, userId: string): Promise<boolean> {
  const ids = requiredCourseIds(cert);
  if (!ids.length) return true;
  return (await finishedAll(service, ids, [userId])).has(userId);
}

/** Whether a learner is enrolled in any of the courses (for showing the capstone card). */
export async function enrolledInAny(service: SupabaseClient, cert: CourseRequirement, userId: string): Promise<boolean> {
  const ids = requiredCourseIds(cert);
  if (!ids.length) return true;
  const { data } = await service.from("enrollments").select("id").eq("user_id", userId).in("course_id", ids).limit(1);
  return !!data && data.length > 0;
}
