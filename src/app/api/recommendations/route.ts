import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import {
  getUnifiedRecommendations,
  getAdaptivePath,
  getSimilarCourses,
  computeUserPreferences,
} from "@/lib/ai/recommendations";

const COURSE_SELECT = `
  id,
  title,
  slug,
  description,
  short_description,
  thumbnail_url,
  category_id,
  status,
  course_type,
  difficulty_level,
  estimated_duration,
  tags,
  published_at,
  created_at,
  creator:users!courses_created_by_fkey ( first_name, last_name ),
  category:categories!courses_category_id_fkey ( id, name, slug ),
  enrolled_count:enrollments ( count )
`;

/**
 * GET /api/recommendations
 * Fetch personalized AI-powered recommendations for the current user.
 *
 * Query params:
 *   - skill: optional target skill name/id for adaptive path
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, organization_id, job_title")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const targetSkill = searchParams.get("skill");

  // Run recommendation algorithms in parallel
  const [aiPicks, adaptivePath, recentCompleted] = await Promise.all([
    getUnifiedRecommendations(profile.id, 10),
    targetSkill ? getAdaptivePath(profile.id, targetSkill) : Promise.resolve(null),
    // Get recently completed courses for "because you completed" section
    service
      .from("enrollments")
      .select("course_id, course:courses!enrollments_course_id_fkey ( id, title, slug )")
      .eq("user_id", profile.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(3),
  ]);

  // Hydrate AI picks with full course data
  const aiCourseIds = aiPicks.map((p) => p.courseId);
  let aiCourses: any[] = [];
  if (aiCourseIds.length > 0) {
    const { data } = await service
      .from("courses")
      .select(COURSE_SELECT)
      .in("id", aiCourseIds)
      .eq("status", "published");
    aiCourses = data ?? [];
  }

  // Map course data back to scored recommendations, preserving rank order
  const courseMap = new Map<string, any>();
  for (const c of aiCourses) courseMap.set(c.id, c);

  const hydratedAiPicks = aiPicks
    .filter((p) => courseMap.has(p.courseId))
    .map((p) => {
      const course = courseMap.get(p.courseId);
      const creator = course.creator as any;
      return {
        id: course.id,
        slug: course.slug ?? course.id,
        title: course.title ?? "Untitled Course",
        instructor:
          creator?.first_name && creator?.last_name
            ? `${creator.first_name} ${creator.last_name}`
            : "Instructor",
        duration: course.estimated_duration ?? 0,
        rating: 4.5,
        enrolledCount: Number(course.enrolled_count?.[0]?.count ?? 0),
        difficulty_level: course.difficulty_level,
        category: course.category?.name ?? null,
        reason: p.reason,
        score: p.score,
      };
    });

  // Build "because you completed" similar courses
  const similar: Record<string, any[]> = {};
  const completedCourses = recentCompleted.data ?? [];

  for (const enrollment of completedCourses) {
    const course = enrollment.course as any;
    if (!course) continue;

    const simCourses = await getSimilarCourses(enrollment.course_id, 4);
    if (simCourses.length === 0) continue;

    const simIds = simCourses.map((s) => s.courseId);
    const { data: simData } = await service
      .from("courses")
      .select(COURSE_SELECT)
      .in("id", simIds)
      .eq("status", "published");

    const simMap = new Map<string, any>();
    for (const c of simData ?? []) simMap.set(c.id, c);

    similar[enrollment.course_id] = simCourses
      .filter((s) => simMap.has(s.courseId))
      .map((s) => {
        const c = simMap.get(s.courseId);
        const creator = c.creator as any;
        return {
          id: c.id,
          slug: c.slug ?? c.id,
          title: c.title ?? "Untitled Course",
          instructor:
            creator?.first_name && creator?.last_name
              ? `${creator.first_name} ${creator.last_name}`
              : "Instructor",
          duration: c.estimated_duration ?? 0,
          rating: 4.5,
          enrolledCount: Number(c.enrolled_count?.[0]?.count ?? 0),
          reason: s.reason,
          completedCourseTitle: course.title,
          completedCourseSlug: course.slug,
        };
      });
  }

  // Get available skills for the adaptive path skill selector
  const { data: userSkills } = await service
    .from("user_skills")
    .select("skill_id, proficiency_level, skill:skills!user_skills_skill_id_fkey ( id, name )")
    .eq("user_id", profile.id);

  const availableSkills = (userSkills ?? [])
    .filter((s: any) => s.proficiency_level < 5)
    .map((s: any) => ({
      id: s.skill_id,
      name: (s.skill as any)?.name ?? "Unknown",
      currentLevel: s.proficiency_level,
    }));

  return NextResponse.json({
    ai_picks: hydratedAiPicks,
    adaptive_path: adaptivePath,
    similar,
    available_skills: availableSkills,
  });
}

/**
 * POST /api/recommendations
 * Trigger preference recomputation for the current user.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const preferences = await computeUserPreferences(profile.id);

  return NextResponse.json({ preferences });
}
