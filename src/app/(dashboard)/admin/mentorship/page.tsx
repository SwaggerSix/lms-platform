import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import AdminMentorshipClient from "./admin-mentorship-client";

export const metadata: Metadata = {
  title: "Mentorship Admin | LMS Platform",
  description: "Manage mentorships, view statistics, and oversee mentor matching",
};

export default async function AdminMentorshipPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser || !["admin", "manager"].includes(dbUser.role)) {
    redirect("/dashboard");
  }

  // Aggregate stats
  const [mentorsResult, requestsResult, sessionsResult, reviewsResult] = await Promise.all([
    service.from("mentor_profiles").select("id, is_active, availability, rating, current_mentee_count"),
    service.from("mentorship_requests").select("id, status, match_score, created_at, matched_at, completed_at, mentor_id"),
    service.from("mentorship_sessions").select("id, status, scheduled_at, request_id"),
    service.from("mentor_reviews").select("id, rating, outcomes_met, would_recommend"),
  ]);

  const mentors = mentorsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const sessions = sessionsResult.data ?? [];
  const reviewsList = reviewsResult.data ?? [];

  const stats = {
    totalMentors: mentors.length,
    activeMentors: mentors.filter((m: any) => m.is_active).length,
    availableMentors: mentors.filter((m: any) => m.availability === "available").length,
    totalRequests: requests.length,
    pendingRequests: requests.filter((r: any) => r.status === "pending").length,
    activeRequests: requests.filter((r: any) => r.status === "active").length,
    completedRequests: requests.filter((r: any) => r.status === "completed").length,
    totalSessions: sessions.length,
    completedSessions: sessions.filter((s: any) => s.status === "completed").length,
    avgRating:
      reviewsList.length > 0
        ? (reviewsList.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewsList.length).toFixed(1)
        : "N/A",
    totalActiveMentees: mentors.reduce((sum: number, m: any) => sum + (m.current_mentee_count ?? 0), 0),
  };

  // Program outcomes: real measures of whether the program is working.
  const now = Date.now();
  const day = 86_400_000;

  // Time-to-match: days between request created_at and matched_at
  const matchedRequests = requests.filter((r: any) => r.matched_at && r.created_at);
  const avgTimeToMatchDays =
    matchedRequests.length > 0
      ? (
          matchedRequests.reduce(
            (sum: number, r: any) =>
              sum + (new Date(r.matched_at).getTime() - new Date(r.created_at).getTime()) / day,
            0
          ) / matchedRequests.length
        ).toFixed(1)
      : null;

  // Completion rate: completed / (completed + cancelled)
  const completedCount = requests.filter((r: any) => r.status === "completed").length;
  const cancelledCount = requests.filter((r: any) => r.status === "cancelled").length;
  const decided = completedCount + cancelledCount;
  const completionRatePct =
    decided > 0 ? Math.round((completedCount / decided) * 100) : null;

  // Outcomes from exit reviews
  const reviewsWithOutcomes = reviewsList.filter((r: any) => r.outcomes_met !== null && r.outcomes_met !== undefined);
  const goalsMetPct =
    reviewsWithOutcomes.length > 0
      ? Math.round(
          (reviewsWithOutcomes.filter((r: any) => r.outcomes_met === true).length /
            reviewsWithOutcomes.length) *
            100
        )
      : null;

  const reviewsWithRec = reviewsList.filter((r: any) => r.would_recommend !== null && r.would_recommend !== undefined);
  const wouldRecommendPct =
    reviewsWithRec.length > 0
      ? Math.round(
          (reviewsWithRec.filter((r: any) => r.would_recommend === true).length /
            reviewsWithRec.length) *
            100
        )
      : null;

  // Engagement: active pairs with a completed session in the last 30 days
  const thirtyDaysAgo = now - 30 * day;
  const activeRequestIds = new Set(
    requests.filter((r: any) => r.status === "active").map((r: any) => r.id)
  );
  const engagedRequestIds = new Set(
    sessions
      .filter(
        (s: any) =>
          s.status === "completed" &&
          s.scheduled_at &&
          new Date(s.scheduled_at).getTime() >= thirtyDaysAgo
      )
      .map((s: any) => s.request_id)
  );
  const engagedActive = Array.from(engagedRequestIds).filter((id) => activeRequestIds.has(id)).length;
  const engagementPct =
    activeRequestIds.size > 0
      ? Math.round((engagedActive / activeRequestIds.size) * 100)
      : null;

  // Sessions completed in the last 90 days
  const ninetyDaysAgo = now - 90 * day;
  const sessionsLast90d = sessions.filter(
    (s: any) =>
      s.status === "completed" &&
      s.scheduled_at &&
      new Date(s.scheduled_at).getTime() >= ninetyDaysAgo
  ).length;

  const outcomes = {
    avgTimeToMatchDays,
    completionRatePct,
    goalsMetPct,
    wouldRecommendPct,
    engagementPct,
    engagedActive,
    activeCount: activeRequestIds.size,
    sessionsLast90d,
  };

  // Recent requests
  const { data: recentRequests } = await service
    .from("mentorship_requests")
    .select(
      "*, mentee:users!mentorship_requests_mentee_id_fkey(first_name, last_name, email), mentor:users!mentorship_requests_mentor_id_fkey(first_name, last_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  // Full mentor profile list for the admin Mentors table
  const { data: mentorProfiles } = await service
    .from("mentor_profiles")
    .select(
      "id, user_id, is_active, availability, expertise_areas, years_experience, max_mentees, current_mentee_count, rating, total_reviews, created_at, user:users!mentor_profiles_user_id_fkey(first_name, last_name, email, job_title)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  // Users list for the mentee picker in the assign dialog
  const { data: allUsers } = await service
    .from("users")
    .select("id, first_name, last_name, email")
    .order("first_name", { ascending: true })
    .limit(1000);

  // Mentorship circles (group mentorship)
  const { data: circles } = await service
    .from("mentorship_circles")
    .select(
      "id, name, description, mentor_id, max_members, created_at, mentor:users!mentorship_circles_mentor_id_fkey(first_name, last_name, email), members:mentorship_circle_members(mentee_id, mentee:users!mentorship_circle_members_mentee_id_fkey(first_name, last_name, email))"
    )
    .order("created_at", { ascending: false });

  return (
    <AdminMentorshipClient
      stats={stats}
      outcomes={outcomes}
      recentRequests={recentRequests ?? []}
      mentors={mentorProfiles ?? []}
      users={allUsers ?? []}
      circles={circles ?? []}
    />
  );
}
