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
    service.from("mentorship_requests").select("id, status, match_score, created_at"),
    service.from("mentorship_sessions").select("id, status"),
    service.from("mentor_reviews").select("id, rating"),
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

  // Recent requests
  const { data: recentRequests } = await service
    .from("mentorship_requests")
    .select(
      "*, mentee:users!mentorship_requests_mentee_id_fkey(first_name, last_name, email), mentor:users!mentorship_requests_mentor_id_fkey(first_name, last_name, email)"
    )
    .order("created_at", { ascending: false })
    .limit(20);

  return <AdminMentorshipClient stats={stats} recentRequests={recentRequests ?? []} />;
}
