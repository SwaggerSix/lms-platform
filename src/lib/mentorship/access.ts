import { createServiceClient } from "@/lib/supabase/service";

// Returns true when the user is the mentee, the mentor, or has an
// admin/manager role — the same trust boundary used by the request detail
// page. Used by goal routes (and future session/note routes) to gate writes.
export async function canAccessMentorshipRequest(
  requestId: string,
  userId: string,
  userRole: string | null | undefined,
): Promise<{ ok: boolean; menteeId?: string; mentorId?: string | null }> {
  if (userRole === "admin" || userRole === "manager" || userRole === "super_admin") {
    const service = createServiceClient();
    const { data } = await service
      .from("mentorship_requests")
      .select("mentee_id, mentor_id")
      .eq("id", requestId)
      .single();
    if (!data) return { ok: false };
    return { ok: true, menteeId: data.mentee_id, mentorId: data.mentor_id };
  }

  const service = createServiceClient();
  const { data } = await service
    .from("mentorship_requests")
    .select("mentee_id, mentor_id")
    .eq("id", requestId)
    .single();
  if (!data) return { ok: false };
  const isParticipant = data.mentee_id === userId || data.mentor_id === userId;
  return { ok: isParticipant, menteeId: data.mentee_id, mentorId: data.mentor_id };
}
