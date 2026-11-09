import type { createServiceClient } from "@/lib/supabase/service";
import { provisionCourseMaterials } from "@/lib/services/course-materials";

export { parseInviteList, MAX_PATH_INVITES } from "./invite-list";
export type { Invitee, ParsedInviteList } from "./invite-list";

/**
 * Enrolls a user in a learning path and every course on it. Idempotent:
 * returns "already" when they already had the path (any missing courses are
 * still added), "enrolled" when the path enrollment was created now.
 */
export async function grantPathAccess(
  service: ReturnType<typeof createServiceClient>,
  opts: { userId: string; pathId: string; courseIds: string[]; assignedBy: string }
): Promise<"enrolled" | "already" | "error"> {
  const now = new Date().toISOString();

  const { data: existing, error: lookupErr } = await service
    .from("learning_path_enrollments")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("path_id", opts.pathId)
    .maybeSingle();
  if (lookupErr) {
    console.error("Path invite: enrollment lookup failed:", lookupErr.message);
    return "error";
  }

  let outcome: "enrolled" | "already" = "already";
  if (!existing) {
    const { error } = await service.from("learning_path_enrollments").upsert(
      {
        user_id: opts.userId,
        path_id: opts.pathId,
        status: "enrolled",
        enrolled_at: now,
        assigned_by: opts.assignedBy,
      },
      { onConflict: "user_id,path_id", ignoreDuplicates: true }
    );
    if (error) {
      console.error("Path invite: path enrollment failed:", error.message);
      return "error";
    }
    outcome = "enrolled";
  }

  if (opts.courseIds.length > 0) {
    const { error } = await service.from("enrollments").upsert(
      opts.courseIds.map((courseId) => ({
        user_id: opts.userId,
        course_id: courseId,
        status: "enrolled",
        enrolled_at: now,
        assigned_by: opts.assignedBy,
      })),
      { onConflict: "user_id,course_id", ignoreDuplicates: true }
    );
    if (error) {
      console.error("Path invite: course enrollment failed:", error.message);
      return "error";
    }
    if (outcome === "enrolled") {
      // Same as the Assign feature: copy each course's materials to Documents.
      await Promise.allSettled(
        opts.courseIds.map((cid) =>
          provisionCourseMaterials(service, opts.userId, cid)
        )
      );
    }
  }
  return outcome;
}
