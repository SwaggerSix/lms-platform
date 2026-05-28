import { createServiceClient } from "@/lib/supabase/service";
import { sendPushToUsers } from "@/lib/push/dispatch";

// Award any mentor-category badges whose threshold the mentor has now met,
// based on count of completed mentorships as the mentor. Idempotent: skips
// badges the user already holds. Best-effort — failures are logged, never
// thrown, so a badge problem cannot break the mentorship completion flow.
export async function awardMentorBadges(mentorUserId: string): Promise<void> {
  try {
    const service = createServiceClient();

    const { count: completedCount } = await service
      .from("mentorship_requests")
      .select("id", { count: "exact", head: true })
      .eq("mentor_id", mentorUserId)
      .eq("status", "completed");
    const completed = completedCount ?? 0;
    if (completed < 1) return;

    const { data: badges } = await service
      .from("badges")
      .select("id, name, criteria")
      .eq("category", "mentorship");
    if (!badges || badges.length === 0) return;

    const { data: held } = await service
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", mentorUserId);
    const heldIds = new Set((held ?? []).map((r: any) => r.badge_id));

    const toAward: string[] = [];
    for (const badge of badges) {
      const c = (badge.criteria ?? {}) as { type?: string; threshold?: number };
      if (c.type !== "mentorship_completed_as_mentor") continue;
      const threshold = Number(c.threshold ?? 0);
      if (threshold > 0 && completed >= threshold && !heldIds.has(badge.id)) {
        toAward.push(badge.id);
      }
    }
    if (toAward.length === 0) return;

    const rows = toAward.map((badge_id) => ({ user_id: mentorUserId, badge_id }));
    const { error } = await service.from("user_badges").insert(rows);
    if (error) {
      console.error("Mentor badge award error:", error.message);
      return;
    }

    // Drop an in-app notification per badge so the mentor sees the recognition.
    const { data: awardedBadges } = await service
      .from("badges")
      .select("id, name")
      .in("id", toAward);
    if (awardedBadges && awardedBadges.length > 0) {
      await service.from("notifications").insert(
        awardedBadges.map((b: any) => ({
          user_id: mentorUserId,
          type: "mentorship",
          channel: "in_app",
          title: `Badge earned: ${b.name}`,
          body: "Recognition for your mentorship work.",
          link: "/learn/mentorship",
          is_read: false,
        }))
      );
      await sendPushToUsers({
        userIds: [mentorUserId],
        title:
          awardedBadges.length === 1
            ? `Badge earned: ${awardedBadges[0].name}`
            : `${awardedBadges.length} new mentorship badges`,
        body: "Recognition for your mentorship work.",
        url: "/learn/mentorship",
      });
    }
  } catch (err) {
    console.error("awardMentorBadges error:", err);
  }
}
