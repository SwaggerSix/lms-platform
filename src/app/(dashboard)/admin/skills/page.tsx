import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import SkillsClient from "./skills-client";
import type { Skill } from "./skills-client";

export default async function SkillsManagementPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Verify user exists in users table
  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  // Fetch all skills with user_skills count, course_skills count, and avg proficiency
  const { data: skillsRaw } = await service
    .from("skills")
    .select(`
      id,
      name,
      category,
      description,
      parent_id,
      user_skills (
        proficiency_level
      ),
      course_skills (
        skill_id
      )
    `)
    .order("name", { ascending: true });

  const skills: Skill[] = (skillsRaw || []).map((s: any) => {
    const userSkills = Array.isArray(s.user_skills) ? s.user_skills : [];
    const courseSkills = Array.isArray(s.course_skills) ? s.course_skills : [];
    const usersCount = userSkills.length;
    const coursesCount = courseSkills.length;
    const avgProficiency = usersCount > 0
      ? Math.round(
          (userSkills.reduce((sum: number, us: any) => sum + (us.proficiency_level || 0), 0) / usersCount) * 20
        )
      : 0;

    return {
      id: s.id,
      name: s.name,
      category: s.category || "Technical",
      description: s.description || "",
      coursesCount,
      usersCount,
      avgProficiency,
      parentId: s.parent_id || undefined,
    };
  });

  return <SkillsClient skills={skills} />;
}
