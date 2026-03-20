import { createServiceClient } from "@/lib/supabase/service";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface UserPreferences {
  preferred_difficulty: string | null;
  preferred_duration: "short" | "medium" | "long" | null;
  preferred_content_types: string[];
  preferred_categories: string[];
  learning_pace: "slow" | "moderate" | "fast" | null;
  best_learning_time: string | null;
  completion_rate: number;
  avg_score: number | null;
}

export interface ScoredCourse {
  courseId: string;
  score: number;
  reason: string;
}

export interface AdaptivePathCourse {
  courseId: string;
  title: string;
  slug: string;
  difficulty_level: string | null;
  estimated_duration: number | null;
  reason: string;
  order: number;
}

export interface AdaptivePath {
  skill: string;
  skillId: string;
  currentLevel: number;
  targetLevel: number;
  courses: AdaptivePathCourse[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Jaccard similarity between two sets */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Map difficulty string to a numeric value */
function difficultyToNumber(d: string | null): number {
  switch (d?.toLowerCase()) {
    case "beginner":
      return 1;
    case "intermediate":
      return 2;
    case "advanced":
      return 3;
    case "expert":
      return 4;
    default:
      return 2;
  }
}

/** Map duration in minutes to a category */
function durationCategory(minutes: number): "short" | "medium" | "long" {
  if (minutes <= 60) return "short";
  if (minutes <= 240) return "medium";
  return "long";
}

/* ------------------------------------------------------------------ */
/*  computeUserPreferences                                             */
/* ------------------------------------------------------------------ */

export async function computeUserPreferences(userId: string): Promise<UserPreferences> {
  const service = createServiceClient();

  // Fetch user's enrollments with course data
  const { data: enrollments } = await service
    .from("enrollments")
    .select(
      "status, score, time_spent, course:courses!enrollments_course_id_fkey ( id, category_id, difficulty_level, estimated_duration, course_type, tags )"
    )
    .eq("user_id", userId);

  const rows = (enrollments ?? []) as any[];

  // Fetch learning events for time-of-day analysis
  const { data: events } = await service
    .from("learning_events")
    .select("event_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  // --- Compute preferred difficulty ---
  const difficultyCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const contentTypeCounts: Record<string, number> = {};
  const durations: number[] = [];
  let completedCount = 0;
  let totalEnrollments = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const row of rows) {
    totalEnrollments++;
    const course = row.course as any;
    if (!course) continue;

    if (course.difficulty_level) {
      difficultyCounts[course.difficulty_level] =
        (difficultyCounts[course.difficulty_level] ?? 0) + 1;
    }
    if (course.category_id) {
      categoryCounts[course.category_id] =
        (categoryCounts[course.category_id] ?? 0) + 1;
    }
    if (course.course_type) {
      contentTypeCounts[course.course_type] =
        (contentTypeCounts[course.course_type] ?? 0) + 1;
    }
    if (course.estimated_duration) {
      durations.push(course.estimated_duration);
    }

    if (row.status === "completed") {
      completedCount++;
    }
    if (row.score != null) {
      scoreSum += Number(row.score);
      scoreCount++;
    }
  }

  // Preferred difficulty = most common
  const preferredDifficulty =
    Object.entries(difficultyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Preferred duration = category of median duration
  durations.sort((a, b) => a - b);
  const medianDuration =
    durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 120;
  const preferredDuration = durationCategory(medianDuration);

  // Top content types (up to 3)
  const preferredContentTypes = Object.entries(contentTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);

  // Top categories (up to 5)
  const preferredCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([catId]) => catId);

  // Learning pace based on completion rate and time patterns
  const completionRate =
    totalEnrollments > 0 ? (completedCount / totalEnrollments) * 100 : 0;

  let learningPace: "slow" | "moderate" | "fast" = "moderate";
  if (completionRate >= 70) learningPace = "fast";
  else if (completionRate < 30 && totalEnrollments > 2) learningPace = "slow";

  // Best learning time from events
  const hourCounts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0 };
  for (const event of events ?? []) {
    const hour = new Date(event.created_at).getHours();
    if (hour >= 5 && hour < 12) hourCounts.morning++;
    else if (hour >= 12 && hour < 17) hourCounts.afternoon++;
    else hourCounts.evening++;
  }
  const bestLearningTime =
    Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const avgScore = scoreCount > 0 ? scoreSum / scoreCount : null;

  const preferences: UserPreferences = {
    preferred_difficulty: preferredDifficulty,
    preferred_duration: preferredDuration,
    preferred_content_types: preferredContentTypes,
    preferred_categories: preferredCategories,
    learning_pace: learningPace,
    best_learning_time: bestLearningTime,
    completion_rate: Math.round(completionRate * 100) / 100,
    avg_score: avgScore ? Math.round(avgScore * 100) / 100 : null,
  };

  // Upsert into user_learning_preferences
  await service.from("user_learning_preferences").upsert(
    {
      user_id: userId,
      preferred_difficulty: preferences.preferred_difficulty,
      preferred_duration: preferences.preferred_duration,
      preferred_content_types: preferences.preferred_content_types,
      preferred_categories: preferences.preferred_categories,
      learning_pace: preferences.learning_pace,
      best_learning_time: preferences.best_learning_time,
      completion_rate: preferences.completion_rate,
      avg_score: preferences.avg_score,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return preferences;
}

/* ------------------------------------------------------------------ */
/*  getCollaborativeRecommendations                                    */
/* ------------------------------------------------------------------ */

export async function getCollaborativeRecommendations(
  userId: string,
  limit: number = 10
): Promise<ScoredCourse[]> {
  const service = createServiceClient();

  // Get current user's completed courses
  const { data: userEnrollments } = await service
    .from("enrollments")
    .select("course_id, status")
    .eq("user_id", userId);

  const userCourses = new Set(
    (userEnrollments ?? []).map((e: any) => e.course_id as string)
  );
  const userCompletedCourses = new Set(
    (userEnrollments ?? [])
      .filter((e: any) => e.status === "completed")
      .map((e: any) => e.course_id as string)
  );

  if (userCompletedCourses.size === 0) return [];

  // Find other users who completed at least one of the same courses
  const { data: similarUserEnrollments } = await service
    .from("enrollments")
    .select("user_id, course_id, status")
    .in("course_id", [...userCompletedCourses])
    .eq("status", "completed")
    .neq("user_id", userId)
    .limit(2000);

  // Group enrollments by user
  const userToCourses = new Map<string, Set<string>>();
  for (const row of similarUserEnrollments ?? []) {
    const existing = userToCourses.get(row.user_id) ?? new Set();
    existing.add(row.course_id);
    userToCourses.set(row.user_id, existing);
  }

  // Get all courses for similar users (including ones current user hasn't taken)
  const similarUserIds = [...userToCourses.keys()];
  if (similarUserIds.length === 0) return [];

  // Compute Jaccard similarity for each user
  const userSimilarities: Array<{ userId: string; similarity: number }> = [];
  for (const [otherUserId, otherCourses] of userToCourses) {
    const sim = jaccard(userCompletedCourses, otherCourses);
    if (sim > 0.1) {
      userSimilarities.push({ userId: otherUserId, similarity: sim });
    }
  }

  userSimilarities.sort((a, b) => b.similarity - a.similarity);
  const topSimilarUsers = userSimilarities.slice(0, 50);

  if (topSimilarUsers.length === 0) return [];

  // Get all enrollments for top similar users
  const { data: topUserEnrollments } = await service
    .from("enrollments")
    .select("user_id, course_id")
    .in(
      "user_id",
      topSimilarUsers.map((u) => u.userId)
    )
    .eq("status", "completed");

  // Count how many similar users completed each course the current user hasn't taken
  const courseScores = new Map<string, number>();
  const similarityLookup = new Map(
    topSimilarUsers.map((u) => [u.userId, u.similarity])
  );

  for (const row of topUserEnrollments ?? []) {
    if (userCourses.has(row.course_id)) continue; // skip courses user already has
    const sim = similarityLookup.get(row.user_id) ?? 0;
    courseScores.set(
      row.course_id,
      (courseScores.get(row.course_id) ?? 0) + sim
    );
  }

  // Sort by weighted score and return top N
  const sorted = [...courseScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return sorted.map(([courseId, score]) => ({
    courseId,
    score,
    reason: "Learners with similar history also completed this",
  }));
}

/* ------------------------------------------------------------------ */
/*  getContentBasedRecommendations                                     */
/* ------------------------------------------------------------------ */

export async function getContentBasedRecommendations(
  userId: string,
  limit: number = 10
): Promise<ScoredCourse[]> {
  const service = createServiceClient();

  // Get or compute user preferences
  const { data: existingPrefs } = await service
    .from("user_learning_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();

  const prefs = existingPrefs ?? (await computeUserPreferences(userId));

  // Get user's enrolled course IDs
  const { data: enrollments } = await service
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId);

  const enrolledIds = new Set(
    (enrollments ?? []).map((e: any) => e.course_id as string)
  );

  // Get user's skill gaps (skills at low proficiency)
  const { data: userSkills } = await service
    .from("user_skills")
    .select("skill_id, proficiency_level")
    .eq("user_id", userId);

  const skillGapIds = new Set(
    (userSkills ?? [])
      .filter((s: any) => s.proficiency_level < 3)
      .map((s: any) => s.skill_id as string)
  );

  // Fetch all published courses the user is NOT enrolled in
  const { data: allCourses } = await service
    .from("courses")
    .select("id, category_id, difficulty_level, estimated_duration, course_type, tags")
    .eq("status", "published");

  // Fetch course_skills for skill-gap boosting
  const { data: courseSkillRows } = await service
    .from("course_skills")
    .select("course_id, skill_id")
    .limit(5000);

  const courseSkillMap = new Map<string, Set<string>>();
  for (const row of courseSkillRows ?? []) {
    const existing = courseSkillMap.get(row.course_id) ?? new Set();
    existing.add(row.skill_id);
    courseSkillMap.set(row.course_id, existing);
  }

  const prefCategories = new Set(
    (prefs.preferred_categories as string[]) ?? []
  );
  const prefContentTypes = new Set(
    (prefs.preferred_content_types as string[]) ?? []
  );
  const prefDifficultyNum = difficultyToNumber(
    prefs.preferred_difficulty as string | null
  );
  const prefDuration = prefs.preferred_duration as string | null;

  const scored: ScoredCourse[] = [];

  for (const course of allCourses ?? []) {
    if (enrolledIds.has(course.id)) continue;

    let score = 0;
    const reasons: string[] = [];

    // Category match (strong signal)
    if (course.category_id && prefCategories.has(course.category_id)) {
      score += 3;
      reasons.push("matches your preferred topics");
    }

    // Difficulty proximity (closer = better)
    const courseDiff = difficultyToNumber(course.difficulty_level);
    const diffDelta = Math.abs(courseDiff - prefDifficultyNum);
    if (diffDelta === 0) {
      score += 2;
    } else if (diffDelta === 1) {
      score += 1;
    }

    // Content type match
    if (course.course_type && prefContentTypes.has(course.course_type)) {
      score += 1.5;
      reasons.push("matches your preferred format");
    }

    // Duration preference match
    if (course.estimated_duration && prefDuration) {
      const courseDur = durationCategory(course.estimated_duration);
      if (courseDur === prefDuration) {
        score += 1;
      }
    }

    // Skill gap boost (high-value signal)
    const courseSkills = courseSkillMap.get(course.id);
    if (courseSkills) {
      let gapBoost = 0;
      for (const skillId of courseSkills) {
        if (skillGapIds.has(skillId)) gapBoost++;
      }
      if (gapBoost > 0) {
        score += gapBoost * 2;
        reasons.push("closes your skill gaps");
      }
    }

    // Tag overlap with preferred categories (weak signal)
    const courseTags = Array.isArray(course.tags) ? course.tags : [];
    if (courseTags.length > 0) {
      score += 0.5;
    }

    if (score > 0) {
      scored.push({
        courseId: course.id,
        score,
        reason:
          reasons.length > 0
            ? `Recommended because it ${reasons[0]}`
            : "Matches your learning profile",
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/*  getAdaptivePath                                                    */
/* ------------------------------------------------------------------ */

export async function getAdaptivePath(
  userId: string,
  targetSkill: string
): Promise<AdaptivePath | null> {
  const service = createServiceClient();

  // Find the skill by name or ID
  let skillId = targetSkill;
  let skillName = targetSkill;

  const { data: skill } = await service
    .from("skills")
    .select("id, name")
    .or(`id.eq.${targetSkill},name.ilike.%${targetSkill}%`)
    .limit(1)
    .single();

  if (skill) {
    skillId = skill.id;
    skillName = skill.name;
  } else {
    return null;
  }

  // Get user's current proficiency for this skill
  const { data: userSkill } = await service
    .from("user_skills")
    .select("proficiency_level")
    .eq("user_id", userId)
    .eq("skill_id", skillId)
    .single();

  const currentLevel = userSkill?.proficiency_level ?? 0;

  // Get user's completed courses
  const { data: completedEnrollments } = await service
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .eq("status", "completed");

  const completedCourseIds = new Set(
    (completedEnrollments ?? []).map((e: any) => e.course_id as string)
  );

  // Get all enrolled course IDs
  const { data: allEnrollments } = await service
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId);

  const enrolledCourseIds = new Set(
    (allEnrollments ?? []).map((e: any) => e.course_id as string)
  );

  // Find courses that teach this skill
  const { data: courseSkills } = await service
    .from("course_skills")
    .select(
      "course_id, proficiency_gained, course:courses!course_skills_course_id_fkey ( id, title, slug, difficulty_level, estimated_duration, status )"
    )
    .eq("skill_id", skillId)
    .order("proficiency_gained", { ascending: true });

  if (!courseSkills || courseSkills.length === 0) return null;

  // Filter to published, non-completed courses and sort by difficulty progression
  const difficultyOrder = ["beginner", "intermediate", "advanced", "expert"];

  const pathCourses: AdaptivePathCourse[] = [];
  let order = 1;

  // Sort courses by difficulty then proficiency_gained
  const sortedCourseSkills = [...courseSkills].sort((a, b) => {
    const courseA = a.course as any;
    const courseB = b.course as any;
    if (!courseA || !courseB) return 0;
    const diffA = difficultyOrder.indexOf(courseA.difficulty_level?.toLowerCase() ?? "intermediate");
    const diffB = difficultyOrder.indexOf(courseB.difficulty_level?.toLowerCase() ?? "intermediate");
    if (diffA !== diffB) return diffA - diffB;
    return (a.proficiency_gained ?? 0) - (b.proficiency_gained ?? 0);
  });

  for (const cs of sortedCourseSkills) {
    const course = cs.course as any;
    if (!course) continue;
    if (course.status !== "published") continue;

    // Skip courses the user already completed
    if (completedCourseIds.has(course.id)) continue;

    // Skip courses that teach below user's current level
    if ((cs.proficiency_gained ?? 0) <= currentLevel) continue;

    const alreadyEnrolled = enrolledCourseIds.has(course.id);

    pathCourses.push({
      courseId: course.id,
      title: course.title,
      slug: course.slug,
      difficulty_level: course.difficulty_level,
      estimated_duration: course.estimated_duration,
      reason: alreadyEnrolled
        ? "Continue this course to advance"
        : `Builds ${skillName} to level ${cs.proficiency_gained}`,
      order: order++,
    });
  }

  if (pathCourses.length === 0) return null;

  return {
    skill: skillName,
    skillId,
    currentLevel,
    targetLevel: 5,
    courses: pathCourses,
  };
}

/* ------------------------------------------------------------------ */
/*  computeCourseSimilarity                                            */
/* ------------------------------------------------------------------ */

export async function computeCourseSimilarity(courseId: string): Promise<void> {
  const service = createServiceClient();

  // Fetch the target course
  const { data: targetCourse } = await service
    .from("courses")
    .select("id, category_id, difficulty_level, tags")
    .eq("id", courseId)
    .single();

  if (!targetCourse) return;

  // Fetch all other published courses
  const { data: allCourses } = await service
    .from("courses")
    .select("id, category_id, difficulty_level, tags")
    .eq("status", "published")
    .neq("id", courseId);

  if (!allCourses || allCourses.length === 0) return;

  // Fetch course_skills for skill-based similarity
  const { data: allCourseSkills } = await service
    .from("course_skills")
    .select("course_id, skill_id");

  const courseSkillMap = new Map<string, Set<string>>();
  for (const row of allCourseSkills ?? []) {
    const existing = courseSkillMap.get(row.course_id) ?? new Set();
    existing.add(row.skill_id);
    courseSkillMap.set(row.course_id, existing);
  }

  const targetTags = new Set<string>(
    Array.isArray(targetCourse.tags) ? targetCourse.tags : []
  );
  const targetSkills = courseSkillMap.get(courseId) ?? new Set<string>();
  const targetDiff = difficultyToNumber(targetCourse.difficulty_level);

  const similarities: Array<{
    course_id: string;
    similar_course_id: string;
    similarity_score: number;
    similarity_type: string;
  }> = [];

  for (const other of allCourses) {
    // Content similarity: tag overlap + category match + difficulty proximity
    const otherTags = new Set<string>(
      Array.isArray(other.tags) ? other.tags : []
    );
    const tagSim = jaccard(targetTags, otherTags);

    const categoryMatch =
      targetCourse.category_id && other.category_id
        ? targetCourse.category_id === other.category_id
          ? 1
          : 0
        : 0;

    const otherDiff = difficultyToNumber(other.difficulty_level);
    const diffProximity = 1 - Math.abs(targetDiff - otherDiff) / 4;

    const contentScore = (tagSim * 0.4 + categoryMatch * 0.4 + diffProximity * 0.2);

    if (contentScore > 0.1) {
      similarities.push({
        course_id: courseId,
        similar_course_id: other.id,
        similarity_score: Math.round(contentScore * 10000) / 10000,
        similarity_type: "content",
      });
    }

    // Skill similarity
    const otherSkills = courseSkillMap.get(other.id) ?? new Set<string>();
    if (targetSkills.size > 0 || otherSkills.size > 0) {
      const skillSim = jaccard(targetSkills, otherSkills);
      if (skillSim > 0.1) {
        similarities.push({
          course_id: courseId,
          similar_course_id: other.id,
          similarity_score: Math.round(skillSim * 10000) / 10000,
          similarity_type: "skill",
        });
      }
    }
  }

  if (similarities.length === 0) return;

  // Delete existing similarities for this course
  await service
    .from("course_similarity")
    .delete()
    .eq("course_id", courseId);

  // Insert in batches of 100
  for (let i = 0; i < similarities.length; i += 100) {
    const batch = similarities.slice(i, i + 100);
    await service.from("course_similarity").upsert(batch, {
      onConflict: "course_id,similar_course_id,similarity_type",
    });
  }
}

/* ------------------------------------------------------------------ */
/*  getSimilarCourses — fetch precomputed similarity                   */
/* ------------------------------------------------------------------ */

export async function getSimilarCourses(
  courseId: string,
  limit: number = 6
): Promise<ScoredCourse[]> {
  const service = createServiceClient();

  const { data } = await service
    .from("course_similarity")
    .select("similar_course_id, similarity_score, similarity_type")
    .eq("course_id", courseId)
    .order("similarity_score", { ascending: false })
    .limit(limit * 2); // fetch extra to deduplicate across types

  if (!data || data.length === 0) return [];

  // Combine scores across similarity types, taking the max per course
  const bestScores = new Map<string, { score: number; type: string }>();
  for (const row of data) {
    const existing = bestScores.get(row.similar_course_id);
    const score = Number(row.similarity_score);
    if (!existing || score > existing.score) {
      bestScores.set(row.similar_course_id, {
        score,
        type: row.similarity_type,
      });
    }
  }

  return [...bestScores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([courseId, { score, type }]) => ({
      courseId,
      score,
      reason:
        type === "skill"
          ? "Teaches similar skills"
          : "Similar content and difficulty",
    }));
}

/* ------------------------------------------------------------------ */
/*  getUnifiedRecommendations — merge all signals                      */
/* ------------------------------------------------------------------ */

export async function getUnifiedRecommendations(
  userId: string,
  limit: number = 10
): Promise<ScoredCourse[]> {
  // Run collaborative and content-based in parallel
  const [collaborative, contentBased] = await Promise.all([
    getCollaborativeRecommendations(userId, limit * 2),
    getContentBasedRecommendations(userId, limit * 2),
  ]);

  // Merge scores: combine both signals with weights
  const merged = new Map<string, { score: number; reasons: string[] }>();

  for (const rec of collaborative) {
    const existing = merged.get(rec.courseId) ?? { score: 0, reasons: [] };
    existing.score += rec.score * 1.2; // collaborative gets slight boost
    existing.reasons.push(rec.reason);
    merged.set(rec.courseId, existing);
  }

  for (const rec of contentBased) {
    const existing = merged.get(rec.courseId) ?? { score: 0, reasons: [] };
    existing.score += rec.score;
    existing.reasons.push(rec.reason);
    merged.set(rec.courseId, existing);
  }

  // Bonus for courses appearing in both lists
  for (const rec of collaborative) {
    if (contentBased.some((cb) => cb.courseId === rec.courseId)) {
      const entry = merged.get(rec.courseId);
      if (entry) entry.score *= 1.3;
    }
  }

  return [...merged.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit)
    .map(([courseId, { score, reasons }]) => ({
      courseId,
      score,
      reason: reasons[0] ?? "Personalized for your learning profile",
    }));
}
