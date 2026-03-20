import { createServiceClient } from "@/lib/supabase/service";

/**
 * Called fire-and-forget after a course is marked complete.
 * Looks up active evaluation triggers for the course and creates
 * an assignment record for the user for each one.
 */
export async function createEvaluationAssignments({
  userId,
  courseId,
  enrollmentId,
}: {
  userId: string;
  courseId: string;
  enrollmentId: string;
}) {
  const service = createServiceClient();

  // Fetch all active triggers for this course
  const { data: triggers, error } = await service
    .from("evaluation_triggers")
    .select("id, template_id, delay_days")
    .eq("course_id", courseId)
    .eq("is_active", true);

  if (error || !triggers || triggers.length === 0) return;

  const now = new Date();

  const assignments = triggers.map((trigger) => {
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + trigger.delay_days);

    return {
      trigger_id: trigger.id,
      template_id: trigger.template_id,
      course_id: courseId,
      user_id: userId,
      enrollment_id: enrollmentId,
      status: "pending" as const,
      due_at: dueAt.toISOString(),
    };
  });

  // Insert all assignments; ignore conflicts (user may have already been assigned)
  await service
    .from("evaluation_assignments")
    .upsert(assignments, { onConflict: "trigger_id,user_id", ignoreDuplicates: true });
}
