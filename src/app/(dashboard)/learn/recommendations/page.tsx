import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getUnifiedRecommendations,
  getAdaptivePath,
  getSimilarCourses,
} from "@/lib/ai/recommendations";
import RecommendationsClient from "./recommendations-client";
import type { RecommendedCourse, SkillGapItem, AiRecommendation, AdaptivePathData, SimilarCourseBucket } from "./recommendations-client";

export const metadata: Metadata = {
  title: "Recommendations | LMS Platform",
  description: "Personalized course recommendations based on your skills and interests",
};

/* ------------------------------------------------------------------ */
/*  Gradient palette for course cards                                  */
/* ------------------------------------------------------------------ */

const GRADIENTS = [
  "from-green-500 to-emerald-600",
  "from-sky-500 to-blue-600",
  "from-slate-600 to-gray-800",
  "from-cyan-500 to-blue-600",
  "from-purple-600 to-violet-700",
  "from-orange-500 to-red-600",
  "from-indigo-500 to-purple-600",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
];

function pickGradient(index: number): string {
  return GRADIENTS[index % GRADIENTS.length];
}

/* ------------------------------------------------------------------ */
/*  Map a DB course row to the client RecommendedCourse shape          */
/* ------------------------------------------------------------------ */

function toCourse(row: any, index: number, reason: string): RecommendedCourse {
  const creator = row.creator as any;
  const instructorName =
    creator?.first_name && creator?.last_name
      ? `${creator.first_name} ${creator.last_name}`
      : "Instructor";

  return {
    id: row.id,
    slug: row.slug ?? row.id,
    title: row.title ?? "Untitled Course",
    instructor: instructorName,
    duration: row.estimated_duration ?? 0,
    rating: 4.5 + (index % 5) * 0.1, // synthetic rating since no ratings table
    enrolledCount: Number(row.enrolled_count?.[0]?.count ?? row._enrolled_count ?? 0),
    gradient: pickGradient(index),
    reason,
  };
}

/* ------------------------------------------------------------------ */
/*  Shared course select fragment                                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Page (server component) — Personalized Recommendations Engine      */
/* ------------------------------------------------------------------ */

export default async function RecommendationsPage() {
  const supabase = await createClient();

  /* ================================================================ */
  /*  1. Auth & user profile                                          */
  /* ================================================================ */

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: dbUser } = await service
    .from("users")
    .select("id, organization_id, job_title, role")
    .eq("auth_id", user.id)
    .single();

  const userId = dbUser?.id;
  const orgId = dbUser?.organization_id;
  const jobTitle = dbUser?.job_title;

  if (!userId) redirect("/login");

  /* ================================================================ */
  /*  2. Get user's enrolled course IDs & completed course metadata    */
  /* ================================================================ */

  const { data: enrollments } = await service
    .from("enrollments")
    .select("course_id, status, course:courses!enrollments_course_id_fkey ( category_id, tags )")
    .eq("user_id", userId);

  const enrolledCourseIds = new Set(
    (enrollments ?? []).map((e: any) => e.course_id as string)
  );

  const completedCategoryIds = new Set<string>();
  const completedTags = new Set<string>();
  for (const e of enrollments ?? []) {
    if (e.status === "completed") {
      const course = e.course as any;
      if (course?.category_id) completedCategoryIds.add(course.category_id);
      if (Array.isArray(course?.tags)) {
        for (const t of course.tags) completedTags.add(t);
      }
    }
  }

  /* ================================================================ */
  /*  3. Get user's skills & find skill gaps via course_skills         */
  /* ================================================================ */

  const { data: userSkillRows } = await service
    .from("user_skills")
    .select("skill_id, proficiency_level, skill:skills!user_skills_skill_id_fkey ( id, name, category )")
    .eq("user_id", userId);

  const userSkillMap = new Map<string, { level: number; name: string }>();
  for (const row of userSkillRows ?? []) {
    const skill = row.skill as any;
    if (skill) {
      userSkillMap.set(row.skill_id, {
        level: row.proficiency_level,
        name: skill.name,
      });
    }
  }

  // Get course_skills to find courses that teach skills the user has at low proficiency
  // or skills the user doesn't have at all
  const { data: courseSkillRows } = await service
    .from("course_skills")
    .select("course_id, skill_id, proficiency_gained, skill:skills!course_skills_skill_id_fkey ( id, name )")
    .order("proficiency_gained", { ascending: false });

  // Build a map: courseId -> array of { skillId, skillName, proficiencyGained }
  const courseToSkills = new Map<string, Array<{ skillId: string; skillName: string; proficiencyGained: number }>>();
  for (const row of courseSkillRows ?? []) {
    const skill = row.skill as any;
    if (!skill) continue;
    const arr = courseToSkills.get(row.course_id) ?? [];
    arr.push({
      skillId: row.skill_id,
      skillName: skill.name,
      proficiencyGained: row.proficiency_gained ?? 1,
    });
    courseToSkills.set(row.course_id, arr);
  }

  /* ================================================================ */
  /*  4. Check competency frameworks for role-required skills          */
  /* ================================================================ */

  let requiredSkillIds = new Set<string>();
  if (jobTitle) {
    const { data: frameworks } = await service
      .from("competency_frameworks")
      .select("skills")
      .contains("applicable_roles", [jobTitle]);

    for (const fw of frameworks ?? []) {
      const fwSkills = fw.skills as any[];
      if (Array.isArray(fwSkills)) {
        for (const s of fwSkills) {
          if (s.skill_id) requiredSkillIds.add(s.skill_id);
        }
      }
    }
  }

  /* ================================================================ */
  /*  5. Fetch all published courses the user is NOT enrolled in       */
  /* ================================================================ */

  let query = service
    .from("courses")
    .select(COURSE_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (enrolledCourseIds.size > 0) {
    query = query.not("id", "in", `(${[...enrolledCourseIds].join(",")})`);
  }

  const { data: courses } = await query;
  const allCourses = (courses ?? []) as any[];

  // Quick lookup by ID
  const courseById = new Map<string, any>();
  for (const c of allCourses) courseById.set(c.id, c);

  /* ================================================================ */
  /*  6. AI-Powered Recommendations                                    */
  /* ================================================================ */

  // Run AI recommendation engine in parallel with bucket building
  const [aiScoredPicks, completedEnrollments] = await Promise.all([
    getUnifiedRecommendations(userId, 10).catch(() => []),
    service
      .from("enrollments")
      .select("course_id, completed_at, course:courses!enrollments_course_id_fkey ( id, title, slug )")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(3),
  ]);

  // Hydrate AI picks
  let aiGlobalIndex = 0;
  const aiRecommendations: AiRecommendation[] = [];
  for (const pick of aiScoredPicks) {
    const course = courseById.get(pick.courseId);
    if (!course) continue;
    const creator = course.creator as any;
    aiRecommendations.push({
      id: course.id,
      slug: course.slug ?? course.id,
      title: course.title ?? "Untitled Course",
      instructor:
        creator?.first_name && creator?.last_name
          ? `${creator.first_name} ${creator.last_name}`
          : "Instructor",
      duration: course.estimated_duration ?? 0,
      rating: 4.5 + (aiGlobalIndex % 5) * 0.1,
      enrolledCount: Number(course.enrolled_count?.[0]?.count ?? 0),
      gradient: pickGradient(aiGlobalIndex),
      reason: pick.reason,
      score: pick.score,
      difficulty_level: course.difficulty_level ?? null,
      category: course.category?.name ?? null,
    });
    aiGlobalIndex++;
  }

  // Build adaptive path for user's weakest skill
  let adaptivePath: AdaptivePathData | null = null;
  const availableSkills: Array<{ id: string; name: string; currentLevel: number }> = [];

  if (userSkillMap.size > 0) {
    // Get skills below level 5 for skill selector
    for (const [skillId, info] of userSkillMap) {
      if (info.level < 5) {
        availableSkills.push({ id: skillId, name: info.name, currentLevel: info.level });
      }
    }

    // Auto-select weakest skill for initial adaptive path
    const weakestSkill = availableSkills.sort((a, b) => a.currentLevel - b.currentLevel)[0];
    if (weakestSkill) {
      try {
        const path = await getAdaptivePath(userId, weakestSkill.id);
        if (path) {
          // Hydrate path courses with full data
          const pathCourseIds = path.courses.map((c) => c.courseId);
          let hydratedPathCourses: any[] = [];
          if (pathCourseIds.length > 0) {
            const { data: pathData } = await service
              .from("courses")
              .select(COURSE_SELECT)
              .in("id", pathCourseIds)
              .eq("status", "published");
            hydratedPathCourses = pathData ?? [];
          }
          const pathCourseMap = new Map<string, any>();
          for (const c of hydratedPathCourses) pathCourseMap.set(c.id, c);

          adaptivePath = {
            skill: path.skill,
            skillId: path.skillId,
            currentLevel: path.currentLevel,
            targetLevel: path.targetLevel,
            courses: path.courses
              .filter((pc) => pathCourseMap.has(pc.courseId))
              .map((pc, idx) => {
                const c = pathCourseMap.get(pc.courseId);
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
                  gradient: pickGradient(idx + 10), // offset to vary colors
                  reason: pc.reason,
                  difficulty_level: pc.difficulty_level ?? null,
                  order: pc.order,
                };
              }),
          };
        }
      } catch {
        // Adaptive path is best-effort
      }
    }
  }

  // Build "Because You Completed X" similar courses
  const similarBuckets: SimilarCourseBucket[] = [];
  for (const enrollment of completedEnrollments.data ?? []) {
    const completedCourse = enrollment.course as any;
    if (!completedCourse) continue;

    try {
      const simCourses = await getSimilarCourses(enrollment.course_id, 4);
      if (simCourses.length === 0) continue;

      const hydratedSim: RecommendedCourse[] = [];
      let simIdx = 0;
      for (const sim of simCourses) {
        const c = courseById.get(sim.courseId);
        if (!c) continue;
        const rec = toCourse(c, simIdx + 20, sim.reason);
        hydratedSim.push(rec);
        simIdx++;
      }

      if (hydratedSim.length > 0) {
        similarBuckets.push({
          completedCourseId: enrollment.course_id,
          completedCourseTitle: completedCourse.title,
          completedCourseSlug: completedCourse.slug,
          courses: hydratedSim,
        });
      }
    } catch {
      // Similar courses are best-effort
    }
  }

  /* ================================================================ */
  /*  7. Build existing recommendation buckets                         */
  /* ================================================================ */

  const usedIds = new Set<string>();
  let globalIndex = 0;

  function take(courseRow: any, reason: string): RecommendedCourse | null {
    if (usedIds.has(courseRow.id)) return null;
    usedIds.add(courseRow.id);
    return toCourse(courseRow, globalIndex++, reason);
  }

  /* ------ A) "Based on Your Skills" ------ */
  const skillBasedCourses: RecommendedCourse[] = [];

  if (userSkillMap.size > 0) {
    const scoredCourses: Array<{ course: any; reason: string; score: number }> = [];

    for (const c of allCourses) {
      const courseSkills = courseToSkills.get(c.id);
      if (!courseSkills) continue;

      for (const cs of courseSkills) {
        const userSkill = userSkillMap.get(cs.skillId);
        if (userSkill && cs.proficiencyGained > userSkill.level) {
          scoredCourses.push({
            course: c,
            reason: `Advance your ${userSkill.name} skills from level ${userSkill.level} to ${cs.proficiencyGained}`,
            score: cs.proficiencyGained - userSkill.level,
          });
          break;
        }
      }
    }

    if (scoredCourses.length < 6) {
      for (const c of allCourses) {
        const courseTags = Array.isArray(c.tags) ? c.tags : [];
        for (const tag of courseTags) {
          if (userSkillMap.has(tag)) continue;
          const matchingSkill = [...userSkillMap.values()].find(
            (s) => s.name.toLowerCase() === tag.toLowerCase()
          );
          if (matchingSkill) {
            scoredCourses.push({
              course: c,
              reason: `Build on your ${matchingSkill.name} experience`,
              score: 1,
            });
            break;
          }
        }
      }
    }

    scoredCourses.sort((a, b) => b.score - a.score);
    for (const item of scoredCourses) {
      if (skillBasedCourses.length >= 6) break;
      const rec = take(item.course, item.reason);
      if (rec) skillBasedCourses.push(rec);
    }
  }

  if (skillBasedCourses.length === 0 && completedTags.size > 0) {
    for (const c of allCourses) {
      if (skillBasedCourses.length >= 6) break;
      const courseTags = Array.isArray(c.tags) ? c.tags : [];
      const matchingTag = courseTags.find((t: string) => completedTags.has(t));
      if (matchingTag) {
        const rec = take(c, `Matches your interest in ${matchingTag}`);
        if (rec) skillBasedCourses.push(rec);
      }
    }
  }

  /* ------ B) Skill Gap Items ------ */
  const skillGapItems: SkillGapItem[] = [];

  const frameworkGaps: Array<{ skillId: string; skillName: string; gap: number; courseId: string }> = [];

  for (const reqSkillId of requiredSkillIds) {
    const userSkill = userSkillMap.get(reqSkillId);
    const currentLevel = userSkill?.level ?? 0;
    if (currentLevel >= 5) continue;

    for (const c of allCourses) {
      if (usedIds.has(c.id)) continue;
      const courseSkills = courseToSkills.get(c.id);
      if (!courseSkills) continue;
      const match = courseSkills.find((cs) => cs.skillId === reqSkillId);
      if (match) {
        frameworkGaps.push({
          skillId: reqSkillId,
          skillName: match.skillName,
          gap: (match.proficiencyGained ?? 5) - currentLevel,
          courseId: c.id,
        });
        break;
      }
    }
  }

  for (const [skillId, info] of userSkillMap) {
    if (info.level >= 3) continue;
    if (frameworkGaps.some((g) => g.skillId === skillId)) continue;

    for (const c of allCourses) {
      if (usedIds.has(c.id)) continue;
      const courseSkills = courseToSkills.get(c.id);
      if (!courseSkills) continue;
      const match = courseSkills.find((cs) => cs.skillId === skillId);
      if (match) {
        frameworkGaps.push({
          skillId,
          skillName: info.name,
          gap: (match.proficiencyGained ?? 5) - info.level,
          courseId: c.id,
        });
        break;
      }
    }
  }

  frameworkGaps.sort((a, b) => b.gap - a.gap);
  for (const g of frameworkGaps) {
    if (skillGapItems.length >= 5) break;
    const course = courseById.get(g.courseId);
    if (!course) continue;
    const rec = take(course, `Close your ${g.skillName} skill gap`);
    if (rec) {
      skillGapItems.push({
        skill: g.skillName,
        gap: Math.min(g.gap, 4),
        course: rec,
      });
    }
  }

  if (skillGapItems.length === 0 && userSkillMap.size > 0) {
    for (const c of allCourses) {
      if (skillGapItems.length >= 3) break;
      const courseTags = Array.isArray(c.tags) ? c.tags : [];
      for (const tag of courseTags) {
        const matchingSkill = [...userSkillMap.entries()].find(
          ([, info]) => info.name.toLowerCase() === tag.toLowerCase() && info.level < 4
        );
        if (matchingSkill) {
          const rec = take(c, `Build your ${matchingSkill[1].name} skills`);
          if (rec) {
            skillGapItems.push({
              skill: matchingSkill[1].name,
              gap: 5 - matchingSkill[1].level,
              course: rec,
            });
          }
          break;
        }
      }
    }
  }

  /* ------ C) "Popular with Your Peers" ------ */
  const popularCourses: RecommendedCourse[] = [];

  const remainingByPopularity = allCourses
    .filter((c) => !usedIds.has(c.id))
    .map((c) => ({
      ...c,
      _enrolled_count: Number(c.enrolled_count?.[0]?.count ?? 0),
    }))
    .sort((a, b) => b._enrolled_count - a._enrolled_count);

  if (orgId) {
    const { data: orgUserIds } = await service
      .from("users")
      .select("id")
      .eq("organization_id", orgId)
      .neq("id", userId)
      .limit(200);

    const peerIds = (orgUserIds ?? []).map((u: any) => u.id);

    if (peerIds.length > 0) {
      const { data: peerEnrollments } = await service
        .from("enrollments")
        .select("course_id")
        .in("user_id", peerIds);

      const peerCourseCount = new Map<string, number>();
      for (const pe of peerEnrollments ?? []) {
        if (enrolledCourseIds.has(pe.course_id)) continue;
        peerCourseCount.set(pe.course_id, (peerCourseCount.get(pe.course_id) ?? 0) + 1);
      }

      const peerSorted = [...peerCourseCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([courseId, count]) => ({ courseId, count }));

      for (const item of peerSorted) {
        if (popularCourses.length >= 6) break;
        const course = courseById.get(item.courseId);
        if (!course || usedIds.has(item.courseId)) continue;
        const rec = take(course, `Popular with your peers — ${item.count} in your org enrolled`);
        if (rec) popularCourses.push(rec);
      }
    }
  }

  for (const c of remainingByPopularity) {
    if (popularCourses.length >= 6) break;
    if (usedIds.has(c.id)) continue;
    const count = c._enrolled_count;
    if (count === 0) continue;
    const rec = take(c, `Popular with your peers — ${count.toLocaleString()} enrolled`);
    if (rec) popularCourses.push(rec);
  }

  /* ------ D) "Continue Learning" ------ */
  const continueLearningCourses: RecommendedCourse[] = [];

  if (completedCategoryIds.size > 0) {
    const sameCategoryCourses = allCourses.filter(
      (c) => !usedIds.has(c.id) && c.category_id && completedCategoryIds.has(c.category_id)
    );

    for (const c of sameCategoryCourses) {
      if (continueLearningCourses.length >= 6) break;
      const catName = c.category?.name ?? "this topic";
      const rec = take(c, `Continue your ${catName} learning journey`);
      if (rec) continueLearningCourses.push(rec);
    }
  }

  if (continueLearningCourses.length < 3 && completedTags.size > 0) {
    for (const c of allCourses) {
      if (continueLearningCourses.length >= 6) break;
      if (usedIds.has(c.id)) continue;
      const courseTags = Array.isArray(c.tags) ? c.tags : [];
      const matchTag = courseTags.find((t: string) => completedTags.has(t));
      if (matchTag) {
        const rec = take(c, `Related to your completed courses in ${matchTag}`);
        if (rec) continueLearningCourses.push(rec);
      }
    }
  }

  /* ------ E) "New & Trending" ------ */
  const trendingCourses: RecommendedCourse[] = [];

  const recentCourses = allCourses
    .filter((c) => !usedIds.has(c.id))
    .sort((a, b) => {
      const dateA = new Date(a.published_at ?? a.created_at ?? 0).getTime();
      const dateB = new Date(b.published_at ?? b.created_at ?? 0).getTime();
      return dateB - dateA;
    });

  for (const c of recentCourses) {
    if (trendingCourses.length >= 6) break;
    const count = Number(c.enrolled_count?.[0]?.count ?? 0);
    const catName = c.category?.name;
    const reason = catName
      ? `New in ${catName} — ${count.toLocaleString()} enrolled`
      : `Recently added — ${count.toLocaleString()} enrolled`;
    const rec = take(c, reason);
    if (rec) trendingCourses.push(rec);
  }

  /* ------ F) "Required for Your Role" ------ */
  const requiredForRoleCourses: RecommendedCourse[] = [];

  if (jobTitle || orgId) {
    let complianceQuery = service
      .from("compliance_requirements")
      .select("course_id, name")
      .eq("is_mandatory", true);

    const { data: complianceReqs } = await complianceQuery;

    for (const req of complianceReqs ?? []) {
      if (requiredForRoleCourses.length >= 6) break;
      if (!req.course_id) continue;
      if (enrolledCourseIds.has(req.course_id)) continue;

      const course = courseById.get(req.course_id);
      if (!course || usedIds.has(req.course_id)) continue;
      const rec = take(course, `Required: ${req.name}`);
      if (rec) requiredForRoleCourses.push(rec);
    }

    if (requiredForRoleCourses.length < 6 && requiredSkillIds.size > 0) {
      for (const c of allCourses) {
        if (requiredForRoleCourses.length >= 6) break;
        if (usedIds.has(c.id)) continue;
        const courseSkills = courseToSkills.get(c.id);
        if (!courseSkills) continue;
        const matchedSkill = courseSkills.find((cs) => requiredSkillIds.has(cs.skillId));
        if (matchedSkill) {
          const rec = take(c, `Required for your role — builds ${matchedSkill.skillName}`);
          if (rec) requiredForRoleCourses.push(rec);
        }
      }
    }

    if (requiredForRoleCourses.length === 0 && jobTitle) {
      const titleWords = jobTitle
        .toLowerCase()
        .split(/[\s,\-\/]+/)
        .filter((w: string) => w.length > 2);

      for (const c of allCourses) {
        if (requiredForRoleCourses.length >= 3) break;
        if (usedIds.has(c.id)) continue;
        const courseTags = Array.isArray(c.tags) ? (c.tags as string[]) : [];
        const courseTitle = (c.title ?? "").toLowerCase();
        const catName = (c.category?.name ?? "").toLowerCase();

        const matched = titleWords.some(
          (w: string) =>
            courseTags.some((t: string) => t.toLowerCase().includes(w)) ||
            courseTitle.includes(w) ||
            catName.includes(w)
        );

        if (matched) {
          const rec = take(c, `Recommended for ${jobTitle}`);
          if (rec) requiredForRoleCourses.push(rec);
        }
      }
    }
  }

  /* ================================================================ */
  /*  8. Render                                                        */
  /* ================================================================ */

  return (
    <RecommendationsClient
      skillBased={skillBasedCourses}
      popular={popularCourses}
      continueLearning={continueLearningCourses}
      trending={trendingCourses}
      requiredForRole={requiredForRoleCourses}
      skillGaps={skillGapItems}
      aiRecommendations={aiRecommendations}
      adaptivePath={adaptivePath}
      similarBuckets={similarBuckets}
      availableSkills={availableSkills}
    />
  );
}
