import { createServiceClient } from "@/lib/supabase/service";
import type {
  ProfileData,
  ProfileSkill,
  ProfileCertification,
} from "./profile-client";

// Builds the full ProfileData for a given users-table id.
// Shared by the current-user profile page and the /profile/[id] view.
export async function buildProfileData(
  userId: string
): Promise<ProfileData | null> {
  const service = createServiceClient();

  const { data: dbUser } = await service
    .from("users")
    .select(
      `
      id,
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
    `
    )
    .eq("id", userId)
    .single();

  if (!dbUser) return null;

  const userData = dbUser as any;

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

  const { data: userSkillsRaw } = await service
    .from("user_skills")
    .select(
      `
      proficiency_level,
      skills (
        name
      )
    `
    )
    .eq("user_id", userData.id);

  const skills: ProfileSkill[] = (userSkillsRaw || []).map((us: any) => ({
    name: us.skills?.name || "Unknown",
    proficiency: us.proficiency_level || 0,
  }));

  const { data: userCertsRaw } = await service
    .from("user_certifications")
    .select(
      `
      issued_at,
      expires_at,
      status,
      certifications (
        name
      )
    `
    )
    .eq("user_id", userData.id);

  const certifications: ProfileCertification[] = (userCertsRaw || []).map(
    (uc: any) => {
      const issuedDate = uc.issued_at ? new Date(uc.issued_at) : null;
      const expiryDate = uc.expires_at ? new Date(uc.expires_at) : null;
      const threeMonths = new Date();
      threeMonths.setMonth(threeMonths.getMonth() + 3);

      let status: "active" | "expiring" = "active";
      if (expiryDate && expiryDate <= threeMonths) {
        status = "expiring";
      }

      return {
        name: uc.certifications?.name || "Unknown",
        issuer: "Internal",
        issued: issuedDate
          ? issuedDate.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })
          : "Unknown",
        expires: expiryDate
          ? expiryDate.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })
          : "No expiration",
        status,
      };
    }
  );

  const { data: enrollments } = await service
    .from("enrollments")
    .select("id, status, completed_at")
    .eq("user_id", userData.id);

  const completedCourses = (enrollments || []).filter(
    (e: any) => e.status === "completed"
  ).length;
  const certificateCount = certifications.length;

  const firstName = userData.first_name || "";
  const lastName = userData.last_name || "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const hireDate = userData.hire_date ? new Date(userData.hire_date) : null;
  const memberSince = hireDate
    ? hireDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "Unknown";

  const orgName = userData.organizations?.name || "Unknown Department";
  const preferences = userData.preferences || {};
  const bio = preferences.bio || "";

  return {
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
}
