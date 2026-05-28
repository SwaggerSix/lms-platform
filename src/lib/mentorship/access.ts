import { createServiceClient } from "@/lib/supabase/service";

// Returns true when the user is the mentee, the mentor, an admin/manager
// role, or — when the mentee has opted in via share_with_manager — the
// mentee's direct manager. Used by goal/session routes (and the detail
// page) to gate access consistently.
export async function canAccessMentorshipRequest(
  requestId: string,
  userId: string,
  userRole: string | null | undefined,
): Promise<{ ok: boolean; menteeId?: string; mentorId?: string | null }> {
  const service = createServiceClient();
  const { data: req } = await service
    .from("mentorship_requests")
    .select("mentee_id, mentor_id, share_with_manager")
    .eq("id", requestId)
    .single();
  if (!req) return { ok: false };

  if (userRole === "admin" || userRole === "manager" || userRole === "super_admin") {
    return { ok: true, menteeId: req.mentee_id, mentorId: req.mentor_id };
  }

  if (req.mentee_id === userId || req.mentor_id === userId) {
    return { ok: true, menteeId: req.mentee_id, mentorId: req.mentor_id };
  }

  // Mentee's direct manager, only when sharing is on
  if (req.share_with_manager) {
    const { data: mentee } = await service
      .from("users")
      .select("manager_id")
      .eq("id", req.mentee_id)
      .single();
    if (mentee?.manager_id && mentee.manager_id === userId) {
      return { ok: true, menteeId: req.mentee_id, mentorId: req.mentor_id };
    }
  }

  return { ok: false };
}
