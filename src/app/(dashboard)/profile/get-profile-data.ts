import { createServiceClient } from "@/lib/supabase/service";
import type {
  ProfileData,
  ProfileSkill,
  ProfileCertification,
  ProfileActivity,
  ProfileBadge,
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

  const [{ data: enrollments }, { data: userBadgesRaw }] = await Promise.all([
    service
      .from("enrollments")
      .select("id, status, completed_at, enrolled_at, time_spent, course:courses(title)")
      .eq("user_id", userData.id),
    service
      .from("user_badges")
      .select("awarded_at, badge:badges(name)")
      .eq("user_id", userData.id)
      .order("awarded_at", { ascending: false }),
  ]);

  const completedCourses = (enrollments || []).filter(
    (e: any) => e.status === "completed"
  ).length;
  const certificateCount = certifications.length;
  const learningHours = Math.round(
    (enrollments || []).reduce((sum: number, e: any) => sum + (e.time_spent ?? 0), 0) / 60
  );

  const topBadges: ProfileBadge[] = (userBadgesRaw || [])
    .filter((ub: any) => ub.badge?.name)
    .slice(0, 4)
    .map((ub: any) => ({ name: ub.badge.name }));

  // Recent activity assembled from real enrollment and badge events.
  const activityEvents: ProfileActivity[] = [];
  for (const e of enrollments || []) {
    const title = (e as any).course?.title ?? "a course";
    if ((e as any).enrolled_at) {
      activityEvents.push({
        id: `enrolled-${(e as any).id}`,
        text: `Started ${title}`,
        date: (e as any).enrolled_at,
        kind: "started",
      });
    }
    if ((e as any).completed_at) {
      activityEvents.push({
        id: `completed-${(e as any).id}`,
        text: `Completed ${title}`,
        date: (e as any).completed_at,
        kind: "completed",
      });
    }
  }
  for (const [idx, ub] of (userBadgesRaw || []).entries()) {
    if ((ub as any).badge?.name && (ub as any).awarded_at) {
      activityEvents.push({
        id: `badge-${idx}`,
        text: `Earned ${(ub as any).badge.name} badge`,
        date: (ub as any).awarded_at,
        kind: "badge",
      });
    }
  }
  const recentActivity = activityEvents
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

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
    recentActivity,
    topBadges,
    stats: {
      coursesCompleted: completedCourses,
      learningHours,
      certificates: certificateCount,
      badgesEarned: (userBadgesRaw || []).length,
    },
  };
}
