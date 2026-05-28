import { createServiceClient } from "@/lib/supabase/service";

// If MENTOR_ONBOARDING_COURSE_ID is set, a user must have completed that
// course (enrollments.status = 'completed') before their mentor profile is
// allowed to be active. When the env var is unset, no onboarding gate applies.
export interface MentorOnboardingStatus {
  required: boolean;
  completed: boolean;
  courseId: string | null;
  courseTitle: string | null;
}

export async function getMentorOnboardingStatus(userId: string): Promise<MentorOnboardingStatus> {
  const courseId = process.env.MENTOR_ONBOARDING_COURSE_ID || null;
  if (!courseId) {
    return { required: false, completed: true, courseId: null, courseTitle: null };
  }

  const service = createServiceClient();

  const [{ data: course }, { data: enrollment }] = await Promise.all([
    service.from("courses").select("id, title").eq("id", courseId).maybeSingle(),
    service
      .from("enrollments")
      .select("status, completed_at")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const completed = enrollment?.status === "completed";
  return {
    required: true,
    completed,
    courseId,
    courseTitle: course?.title ?? null,
  };
}
