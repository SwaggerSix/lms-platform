import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import SkillsClient, { type TeamMemberSkills } from "./skills-client";

export const metadata: Metadata = {
  title: "Team Skills | LMS Platform",
  description: "View and assess skill proficiencies across your team members",
};

export default async function SkillsPage() {
  const supabase = await createClient();

  // Get the current authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Look up the current user in the users table via auth_id
  const service = createServiceClient();
  const { data: currentUser } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!currentUser) {
    redirect("/login");
  }

  // Fetch team members where manager_id = current user's id
  const { data: teamMembers } = await service
    .from("users")
    .select("id, first_name, last_name, job_title")
    .eq("manager_id", currentUser.id);

  const members = (teamMembers ?? []) as any[];
  const memberIds = members.map((m: any) => m.id);

  // Fetch user_skills with skill joins for all team members
  const { data: userSkillsData } = await service
    .from("user_skills")
    .select("user_id, proficiency_level, skill:skills(id, name)")
    .in("user_id", memberIds.length > 0 ? memberIds : ["__none__"]);

  const userSkills = (userSkillsData ?? []) as any[];

  // Collect all unique skill names from the data
  const skillNameSet = new Set<string>();
  for (const us of userSkills) {
    const skillName = us.skill?.name;
    if (skillName) {
      skillNameSet.add(skillName);
    }
  }
  const skillNames = Array.from(skillNameSet).sort();

  // Build a map: userId -> { skillName: proficiencyLevel }
  const userSkillMap: Record<string, Record<string, number>> = {};
  for (const us of userSkills) {
    const skillName = us.skill?.name;
    if (!skillName) continue;
    if (!userSkillMap[us.user_id]) {
      userSkillMap[us.user_id] = {};
    }
    userSkillMap[us.user_id][skillName] = us.proficiency_level;
  }

  // Map team members to the TeamMemberSkills interface
  const teamSkills: TeamMemberSkills[] = members.map((m: any) => {
    const firstName = m.first_name ?? "";
    const lastName = m.last_name ?? "";
    const avatar =
      (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "??";

    // Build skills record with all skill names, default to 0 if not assessed
    const skills: Record<string, number> = {};
    for (const skillName of skillNames) {
      skills[skillName] = userSkillMap[m.id]?.[skillName] ?? 0;
    }

    return {
      id: m.id,
      name: `${firstName} ${lastName}`.trim(),
      avatar,
      role: m.job_title ?? "Employee",
      skills,
    };
  });

  return <SkillsClient teamSkills={teamSkills} skillNames={skillNames} />;
}
