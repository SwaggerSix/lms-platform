import { createServiceClient } from "@/lib/supabase/service";

export interface LearningEventParams {
  userId: string;
  eventType:
    | "view_course"
    | "start_course"
    | "complete_lesson"
    | "complete_module"
    | "complete_course"
    | "search"
    | "enroll"
    | "unenroll"
    | "view_path"
    | "assessment_pass"
    | "assessment_fail";
  courseId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track a learning event for recommendation engine analysis.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function trackLearningEvent(params: LearningEventParams): Promise<void> {
  try {
    const service = createServiceClient();
    const { error } = await service.from("learning_events").insert({
      user_id: params.userId,
      event_type: params.eventType,
      course_id: params.courseId ?? null,
      metadata: params.metadata ?? {},
    });
    if (error) console.error("Learning event tracking failed:", error.message);
  } catch (err) {
    console.error("Learning event tracking network error:", err);
  }
}
