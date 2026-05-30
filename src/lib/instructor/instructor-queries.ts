import { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * The set of course IDs an instructor is responsible for. This is the union of:
 *  - course-level assignments (course_instructors)
 *  - courses they created (courses.created_by)
 *  - courses they teach scheduled sessions for (ilt_sessions.instructor_id)
 *
 * Used to scope what an instructor can see and act on across the portal.
 */
export async function getInstructorCourseIds(
  instructorId: string,
  service: ServiceClient
): Promise<string[]> {
  const [assigned, created, sessions] = await Promise.all([
    service
      .from("course_instructors")
      .select("course_id")
      .eq("instructor_id", instructorId),
    service.from("courses").select("id").eq("created_by", instructorId),
    service
      .from("ilt_sessions")
      .select("course_id")
      .eq("instructor_id", instructorId),
  ]);

  const ids = new Set<string>();
  for (const row of assigned.data ?? []) {
    if (row.course_id) ids.add(row.course_id as string);
  }
  for (const row of created.data ?? []) {
    if (row.id) ids.add(row.id as string);
  }
  for (const row of sessions.data ?? []) {
    if (row.course_id) ids.add(row.course_id as string);
  }
  return [...ids];
}

/**
 * Whether the given instructor is responsible for a specific course.
 */
export async function instructorCanAccessCourse(
  instructorId: string,
  courseId: string,
  service: ServiceClient
): Promise<boolean> {
  const ids = await getInstructorCourseIds(instructorId, service);
  return ids.includes(courseId);
}
