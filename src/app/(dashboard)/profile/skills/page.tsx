import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SkillsClient from "./skills-client";
import type { SkillsData, SkillCategory, SkillGap, RadarCategory } from "./skills-client";

export const metadata: Metadata = {
  title: "Skills | LMS Platform",
  description: "View your skill proficiencies, gaps, and development progress",
};

export default async function SkillsPage() {
  const supabase = await createClient();

  // Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch user
  const { data: dbUser } = await supabase
    .from("users")
    .select("id, job_title")
    .eq("auth_id", user.id)
    .single();

  if (!dbUser) {
    redirect("/login");
  }

  const userData = dbUser as any;

  // Fetch user_skills with skill details (name, category)
  const { data: userSkillsRaw } = await supabase
    .from("user_skills")
    .select(`
      proficiency_level,
      source,
      assessed_at,
      target_level,
      skills (
        name,
        category
      )
    `)
    .eq("user_id", userData.id);

  // Group skills by category
  const categoryMap: Record<string, SkillCategory> = {};
  const radarMap: Record<string, { total: number; count: number }> = {};

  (userSkillsRaw || []).forEach((us: any) => {
    const skillName = us.skills?.name || "Unknown";
    const category = us.skills?.category || "Other";
    const proficiency = us.proficiency_level || 0;
    const source = us.source || "Self Reported";
    const assessedAt = us.assessed_at ? new Date(us.assessed_at) : null;
    const lastAssessed = assessedAt
      ? assessedAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "Not assessed";

    if (!categoryMap[category]) {
      categoryMap[category] = { name: category, skills: [] };
    }
    categoryMap[category].skills.push({
      name: skillName,
      proficiency,
      source,
      lastAssessed,
    });

    // Accumulate for radar chart
    if (!radarMap[category]) {
      radarMap[category] = { total: 0, count: 0 };
    }
    radarMap[category].total += proficiency;
    radarMap[category].count += 1;
  });

  const categories: SkillCategory[] = Object.values(categoryMap);

  // Build radar categories from average proficiency per category (scaled to 100)
  const radarCategories: RadarCategory[] = Object.entries(radarMap).map(([label, { total, count }]) => ({
    label,
    value: count > 0 ? Math.round((total / count / 5) * 100) : 0,
  }));

  // Build skill gaps: skills where target_level > proficiency_level
  const skillGaps: SkillGap[] = (userSkillsRaw || [])
    .filter((us: any) => us.target_level && us.target_level > (us.proficiency_level || 0))
    .map((us: any) => {
      const current = us.proficiency_level || 0;
      const target = us.target_level || 0;
      return {
        skill: us.skills?.name || "Unknown",
        current,
        target,
        gap: target - current,
        recommendedCourse: `Improve ${us.skills?.name || "this skill"}`,
      };
    })
    .sort((a: SkillGap, b: SkillGap) => b.gap - a.gap);

  const skillsData: SkillsData = {
    userId: userData.id,
    categories,
    skillGaps,
    radarCategories,
    jobTitle: userData.job_title || "No title",
  };

  return <SkillsClient data={skillsData} />;
}
