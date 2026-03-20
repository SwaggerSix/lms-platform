import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import MentorshipClient from "./mentorship-client";

export const metadata: Metadata = {
  title: "Mentorship | LMS Platform",
  description: "Find mentors, manage mentorships, and grow your career",
};

export default async function MentorshipPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role, first_name, last_name")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) redirect("/login");

  // Fetch mentors
  const { data: mentors } = await service
    .from("mentor_profiles")
    .select(
      "*, user:users!mentor_profiles_user_id_fkey(id, first_name, last_name, email, job_title)"
    )
    .eq("is_active", true)
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(12);

  // Fetch user's requests
  const { data: myRequests } = await service
    .from("mentorship_requests")
    .select(
      "*, mentee:users!mentorship_requests_mentee_id_fkey(id, first_name, last_name), mentor:users!mentorship_requests_mentor_id_fkey(id, first_name, last_name)"
    )
    .or(`mentee_id.eq.${dbUser.id},mentor_id.eq.${dbUser.id}`)
    .order("created_at", { ascending: false });

  // Check if user has a mentor profile
  const { data: myProfile } = await service
    .from("mentor_profiles")
    .select("*")
    .eq("user_id", dbUser.id)
    .single();

  return (
    <MentorshipClient
      userId={dbUser.id}
      userName={`${dbUser.first_name} ${dbUser.last_name}`}
      mentors={mentors ?? []}
      myRequests={myRequests ?? []}
      myProfile={myProfile}
    />
  );
}
