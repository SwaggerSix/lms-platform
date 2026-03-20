import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import MentorshipDetailClient from "./detail-client";

export const metadata: Metadata = {
  title: "Mentorship Detail | LMS Platform",
  description: "View mentorship sessions, notes, and goals",
};

export default async function MentorshipDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) redirect("/login");

  // Fetch the mentorship request
  const { data: request } = await service
    .from("mentorship_requests")
    .select(
      "*, mentee:users!mentorship_requests_mentee_id_fkey(id, first_name, last_name, email, job_title), mentor:users!mentorship_requests_mentor_id_fkey(id, first_name, last_name, email, job_title)"
    )
    .eq("id", requestId)
    .single();

  if (!request) notFound();

  // Verify access
  const isParticipant =
    request.mentee_id === dbUser.id || request.mentor_id === dbUser.id;
  const isAdmin = dbUser.role === "admin";
  if (!isParticipant && !isAdmin) notFound();

  // Fetch sessions
  const { data: sessions } = await service
    .from("mentorship_sessions")
    .select("*")
    .eq("request_id", requestId)
    .order("scheduled_at", { ascending: true });

  // Fetch reviews
  const { data: reviews } = await service
    .from("mentor_reviews")
    .select(
      "*, reviewer:users!mentor_reviews_reviewer_id_fkey(first_name, last_name)"
    )
    .eq("request_id", requestId)
    .order("created_at", { ascending: false });

  const isMentor = request.mentor_id === dbUser.id;

  return (
    <MentorshipDetailClient
      request={request}
      sessions={sessions ?? []}
      reviews={reviews ?? []}
      userId={dbUser.id}
      isMentor={isMentor}
    />
  );
}
