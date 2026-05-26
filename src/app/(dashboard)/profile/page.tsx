import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import ProfileClient from "./profile-client";
import { buildProfileData } from "./get-profile-data";

export const metadata: Metadata = {
  title: "Profile | LMS Platform",
  description: "View and manage your learner profile, skills, and certifications",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Resolve the current user's profile id
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  const profileData = await buildProfileData(dbUser.id);
  if (!profileData) {
    redirect("/login");
  }

  return <ProfileClient data={profileData} />;
}
