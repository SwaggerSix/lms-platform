import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import ProfileClient from "./profile-client";
import type { ProfileData, ProfileSkill, ProfileCertification } from "./profile-client";

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

  // Fetch user with organization
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select(`
      id,
      auth_id,
      email,
      first_name,
      last_name,
      avatar_url,
      role,
      organization_id,
      manager_id,
      job_title,
      hire_date,
      status,
      preferences,
      organizations (
        id,
        name
      )
    `)
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  const userData = dbUser as any;

  // Fetch manager name if manager_id exists
  let managerName = "Not assigned";
  if (userData.manager_id) {
    const { data: manager } = await service
      .from("users")
      .select("first_name, last_name")
      .eq("id", userData.manager_id)
      .single();
    if (manager) {
      managerName = `${manager.first_name} ${manager.last_name}`;
    }
  }

  // Fetch user skills with skill names
  const { data: userSkillsRaw } = await service
    .from("user_skills")
    .select(`
      proficiency_level,
      skills (
        name
      )
    `)
    .eq("user_id", userData.id);

  const skills: ProfileSkill[] = (userSkillsRaw || []).map((us: any) => ({
    name: us.skills?.name || "Unknown",
    proficiency: us.proficiency_level || 0,
  }));

  // Fetch user certifications
  const { data: userCertsRaw } = await service
    .from("user_certifications")
    .select(`
      issued_date,
      expiry_date,
      status,
      certifications (
        name,
        issuing_body
      )
    `)
    .eq("user_id", userData.id);

  const certifications: ProfileCertification[] = (userCertsRaw || []).map((uc: any) => {
    const issuedDate = uc.issued_date ? new Date(uc.issued_date) : null;
    const expiryDate = uc.expiry_date ? new Date(uc.expiry_date) : null;
    const now = new Date();
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);

    let status: "active" | "expiring" = "active";
    if (expiryDate && expiryDate <= threeMonths) {
      status = "expiring";
    }

    return {
      name: uc.certifications?.name || "Unknown",
      issuer: uc.certifications?.issuing_body || "Unknown",
      issued: issuedDate
        ? issuedDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "Unknown",
      expires: expiryDate
        ? expiryDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "No expiration",
      status,
    };
  });

  // Fetch enrollment stats
  const { data: enrollments } = await service
    .from("enrollments")
    .select("id, status, completed_at")
    .eq("user_id", userData.id);

  const completedCourses = (enrollments || []).filter((e: any) => e.status === "completed").length;
  const certificateCount = certifications.length;

  // Build initials
  const firstName = userData.first_name || "";
  const lastName = userData.last_name || "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  // Format hire date
  const hireDate = userData.hire_date ? new Date(userData.hire_date) : null;
  const memberSince = hireDate
    ? hireDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Unknown";

  // Organization name
  const orgName = userData.organizations?.name || "Unknown Department";

  // Bio from preferences
  const preferences = userData.preferences || {};
  const bio = preferences.bio || "";

  const profileData: ProfileData = {
    userId: userData.id,
    firstName,
    lastName,
    initials,
    jobTitle: userData.job_title || "No title",
    organizationName: orgName,
    memberSince,
    managerName,
    bio,
    skills,
    certifications,
    stats: {
      coursesCompleted: completedCourses,
      learningHours: 0,
      certificates: certificateCount,
      dayStreak: 0,
    },
  };

  return <ProfileClient data={profileData} />;
}
