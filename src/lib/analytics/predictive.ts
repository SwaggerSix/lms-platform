import { createServiceClient } from "@/lib/supabase/service";

export interface RiskPrediction {
  userId: string;
  courseId: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  factors: Record<string, number | string>;
  recommendedActions: string[];
}

export interface AtRiskLearner {
  userId: string;
  userName: string;
  email: string;
  courseId: string;
  courseTitle: string;
  riskLevel: string;
  riskScore: number;
  factors: Record<string, number | string>;
  recommendedActions: string[];
  computedAt: string;
}

export interface EnrollmentRiskInput {
  progress: number | null;
  enrolled_at: string | null;
  due_date: string | null;
  last_accessed_at: string | null;
}

/**
 * Score the enrollment-level risk factors — progress rate (0-25), due-date
 * proximity (0-20), and access recency (0-20) — for a single enrollment.
 * Pure so it can run set-based over paged enrollment rows. Shared by
 * calculateRiskScore (which layers on assessment-score and engagement-trend
 * factors) and the at-risk report, so the scoring rules cannot diverge.
 */
export function scoreEnrollmentRisk(enrollment: EnrollmentRiskInput): {
  riskPoints: number;
  factors: Record<string, number | string>;
} {
  const factors: Record<string, number | string> = {};
  let riskPoints = 0;

  // Factor 1: Progress rate (0-25 risk points)
  const progress = enrollment.progress ?? 0;
  const enrolledAt = enrollment.enrolled_at
    ? new Date(enrollment.enrolled_at)
    : new Date();
  const daysSinceEnroll = Math.max(
    1,
    (Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceEnroll > 7 && progress < 10) {
    factors.low_progress = progress;
    factors.days_since_enroll = Math.round(daysSinceEnroll);
    riskPoints += 25;
  } else if (daysSinceEnroll > 14 && progress < 30) {
    factors.low_progress = progress;
    riskPoints += 18;
  } else if (daysSinceEnroll > 30 && progress < 50) {
    factors.low_progress = progress;
    riskPoints += 12;
  }

  // Factor 2: Due date proximity (0-20 risk points)
  if (enrollment.due_date) {
    const dueDate = new Date(enrollment.due_date);
    const daysUntilDue =
      (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const remainingWork = 100 - progress;

    if (daysUntilDue < 0) {
      factors.overdue_days = Math.abs(Math.round(daysUntilDue));
      riskPoints += 20;
    } else if (daysUntilDue < 7 && remainingWork > 50) {
      factors.days_until_due = Math.round(daysUntilDue);
      factors.remaining_progress = remainingWork;
      riskPoints += 15;
    } else if (daysUntilDue < 14 && remainingWork > 70) {
      factors.days_until_due = Math.round(daysUntilDue);
      riskPoints += 10;
    }
  }

  // Factor 3: Login / engagement recency (0-20 risk points)
  const lastAccessed = enrollment.last_accessed_at
    ? new Date(enrollment.last_accessed_at)
    : null;
  if (lastAccessed) {
    const daysSinceAccess =
      (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAccess > 14) {
      factors.days_since_last_access = Math.round(daysSinceAccess);
      riskPoints += 20;
    } else if (daysSinceAccess > 7) {
      factors.days_since_last_access = Math.round(daysSinceAccess);
      riskPoints += 12;
    } else if (daysSinceAccess > 3) {
      factors.days_since_last_access = Math.round(daysSinceAccess);
      riskPoints += 5;
    }
  } else {
    factors.never_accessed = "true";
    riskPoints += 15;
  }

  return { riskPoints, factors };
}

/** Map a 0-100 risk score to the level buckets used across the platform. */
export function riskLevelForScore(
  riskScore: number
): RiskPrediction["riskLevel"] {
  if (riskScore >= 75) return "critical";
  if (riskScore >= 50) return "high";
  if (riskScore >= 25) return "medium";
  return "low";
}

// The enrollments table stores no progress or last-access columns — both are
// derived from lesson_progress (progress = completed lessons / course lesson
// count; last access = latest started_at/completed_at). The helpers below do
// that derivation set-based so report-scale callers avoid N+1 queries.

const BATCH_PAGE = 1000;
const IN_CHUNK = 200;

export interface EnrollmentActivity {
  completedLessons: number;
  lastAccessedAt: string | null;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

/** Lesson count per course (via modules), for the given course ids. */
export async function getCourseLessonCounts(
  service: ServiceClient,
  courseIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const unique = [...new Set(courseIds)];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);
    for (let offset = 0; ; offset += BATCH_PAGE) {
      const { data, error } = await service
        .from("lessons")
        .select("id, module:modules!inner(course_id)")
        .in("module.course_id", chunk)
        .range(offset, offset + BATCH_PAGE - 1);
      if (error) throw error;
      const batch = (data ?? []) as any[];
      for (const lesson of batch) {
        const courseId = lesson.module?.course_id;
        if (courseId) counts.set(courseId, (counts.get(courseId) ?? 0) + 1);
      }
      if (batch.length < BATCH_PAGE) break;
    }
  }
  return counts;
}

/** Completed-lesson count and latest activity timestamp per enrollment id. */
export async function getEnrollmentActivity(
  service: ServiceClient,
  enrollmentIds: string[]
): Promise<Map<string, EnrollmentActivity>> {
  const activity = new Map<string, EnrollmentActivity>();
  const unique = [...new Set(enrollmentIds)];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);
    for (let offset = 0; ; offset += BATCH_PAGE) {
      const { data, error } = await service
        .from("lesson_progress")
        .select("enrollment_id, status, started_at, completed_at")
        .in("enrollment_id", chunk)
        .range(offset, offset + BATCH_PAGE - 1);
      if (error) throw error;
      const batch = (data ?? []) as any[];
      for (const row of batch) {
        const entry = activity.get(row.enrollment_id) ?? {
          completedLessons: 0,
          lastAccessedAt: null,
        };
        if (row.status === "completed") entry.completedLessons += 1;
        for (const ts of [row.started_at, row.completed_at]) {
          if (ts && (!entry.lastAccessedAt || ts > entry.lastAccessedAt)) {
            entry.lastAccessedAt = ts;
          }
        }
        activity.set(row.enrollment_id, entry);
      }
      if (batch.length < BATCH_PAGE) break;
    }
  }
  return activity;
}

/** Progress % from completed vs total lessons (0 when the course is empty). */
export function progressPercent(
  completedLessons: number,
  totalLessons: number | undefined
): number {
  if (!totalLessons || totalLessons <= 0) return 0;
  return Math.min(100, Math.round((completedLessons / totalLessons) * 100));
}

/**
 * Calculate a risk score for a specific user in a specific course.
 * Factors: login frequency, progress rate, assessment scores,
 * time between sessions, completion patterns.
 */
export async function calculateRiskScore(
  userId: string,
  courseId: string
): Promise<RiskPrediction> {
  const service = createServiceClient();

  const [enrollmentResult, assessmentResult, snapshotResult] =
    await Promise.all([
      service
        .from("enrollments")
        .select("id, status, enrolled_at, due_date")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .maybeSingle(),
      service
        .from("assessment_attempts")
        .select("id, score, completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(10),
      service
        .from("learning_analytics_snapshots")
        .select("*")
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: false })
        .limit(14),
    ]);

  const enrollment = enrollmentResult.data;
  const snapshots = snapshotResult.data ?? [];
  const assessments = assessmentResult.data ?? [];

  // Progress and last-access are derived from lesson_progress — the
  // enrollments table has no columns for them.
  let progress: number | null = null;
  let lastAccessedAt: string | null = null;
  if (enrollment) {
    const [activity, lessonCounts] = await Promise.all([
      getEnrollmentActivity(service, [enrollment.id]),
      getCourseLessonCounts(service, [courseId]),
    ]);
    const entry = activity.get(enrollment.id);
    progress = progressPercent(
      entry?.completedLessons ?? 0,
      lessonCounts.get(courseId)
    );
    lastAccessedAt = entry?.lastAccessedAt ?? null;
  }

  // Factors 1-3 (progress rate, due date, access recency) share the pure
  // enrollment-level scorer with the at-risk report.
  const enrollmentRisk = scoreEnrollmentRisk({
    progress,
    enrolled_at: enrollment?.enrolled_at ?? null,
    due_date: enrollment?.due_date ?? null,
    last_accessed_at: lastAccessedAt,
  });
  const factors: Record<string, number | string> = enrollmentRisk.factors;
  let totalRisk = enrollmentRisk.riskPoints;

  // Factor 4: Assessment scores (0-20 risk points)
  if (assessments.length > 0) {
    const avgScore =
      assessments.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) /
      assessments.length;
    factors.avg_assessment_score = Math.round(avgScore * 100) / 100;

    if (avgScore < 50) {
      totalRisk += 20;
    } else if (avgScore < 65) {
      totalRisk += 12;
    } else if (avgScore < 75) {
      totalRisk += 5;
    }
  }

  // Factor 5: Engagement trend (0-15 risk points)
  if (snapshots.length >= 3) {
    const recentEngagement = snapshots
      .slice(0, 3)
      .map((s: any) => parseFloat(s.engagement_score) || 0);
    const olderEngagement = snapshots
      .slice(3, 7)
      .map((s: any) => parseFloat(s.engagement_score) || 0);

    const recentAvg =
      recentEngagement.reduce((a: number, b: number) => a + b, 0) /
      recentEngagement.length;
    const olderAvg =
      olderEngagement.length > 0
        ? olderEngagement.reduce((a: number, b: number) => a + b, 0) /
          olderEngagement.length
        : recentAvg;

    if (olderAvg > 0 && recentAvg < olderAvg * 0.5) {
      factors.engagement_declining = "significant";
      totalRisk += 15;
    } else if (olderAvg > 0 && recentAvg < olderAvg * 0.75) {
      factors.engagement_declining = "moderate";
      totalRisk += 8;
    }
  }

  // Normalize to 0-100
  const riskScore = Math.min(totalRisk, 100);

  const riskLevel = riskLevelForScore(riskScore);

  const recommendedActions = generateRecommendedActions(factors);

  return {
    userId,
    courseId,
    riskLevel,
    riskScore,
    factors,
    recommendedActions,
  };
}

/**
 * Generate human-readable recommended actions based on risk factors.
 */
export function generateRecommendedActions(
  factors: Record<string, number | string>
): string[] {
  const actions: string[] = [];

  if (factors.never_accessed === "true") {
    actions.push(
      "Send a welcome email with course highlights to encourage first login"
    );
  }

  if (
    typeof factors.days_since_last_access === "number" &&
    factors.days_since_last_access > 7
  ) {
    actions.push(
      "Send a re-engagement notification reminding the learner of their progress"
    );
  }

  if (
    typeof factors.low_progress === "number" &&
    factors.low_progress < 30
  ) {
    actions.push(
      "Schedule a check-in with the learner to discuss potential blockers"
    );
  }

  if (factors.overdue_days) {
    actions.push(
      "Contact learner about the overdue course and consider extending the deadline"
    );
  }

  if (
    typeof factors.days_until_due === "number" &&
    factors.days_until_due < 7
  ) {
    actions.push(
      "Send an urgent deadline reminder with a study plan for completion"
    );
  }

  if (
    typeof factors.avg_assessment_score === "number" &&
    factors.avg_assessment_score < 65
  ) {
    actions.push(
      "Recommend supplementary resources or tutoring to improve assessment scores"
    );
  }

  if (factors.engagement_declining === "significant") {
    actions.push(
      "Assign a mentor or peer buddy to re-engage the learner"
    );
    actions.push(
      "Consider offering alternative learning formats (video, interactive, etc.)"
    );
  }

  if (actions.length === 0) {
    actions.push("Continue monitoring - learner is on track");
  }

  return actions;
}

/**
 * Compute an engagement score (0-100) for a user based on recent activity.
 */
export async function computeEngagementScore(
  userId: string
): Promise<number> {
  const service = createServiceClient();

  // Gather signals ("active" = an open enrollment; the status enum is
  // enrolled/in_progress/completed/failed/expired)
  const [enrollResult, progressResult, assessmentResult] = await Promise.all([
    service
      .from("enrollments")
      .select("id, course_id, status")
      .eq("user_id", userId)
      .in("status", ["enrolled", "in_progress"]),
    service
      .from("lesson_progress")
      .select("id, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(30),
    service
      .from("assessment_attempts")
      .select("id, score, completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(10),
  ]);

  const enrollments = (enrollResult.data ?? []) as any[];
  const recentLessons = progressResult.data ?? [];
  const recentAssessments = assessmentResult.data ?? [];

  // Progress and last-access are derived from lesson_progress.
  const [activity, lessonCounts] = await Promise.all([
    getEnrollmentActivity(service, enrollments.map((e) => e.id)),
    getCourseLessonCounts(service, enrollments.map((e) => e.course_id)),
  ]);

  let score = 0;

  // Active enrollments factor (0-20)
  score += Math.min(enrollments.length * 5, 20);

  // Recent activity factor (0-30)
  const now = Date.now();
  const recentActivityCount = recentLessons.filter((l: any) => {
    if (!l.completed_at) return false;
    const diff = now - new Date(l.completed_at).getTime();
    return diff < 7 * 24 * 60 * 60 * 1000; // last 7 days
  }).length;
  score += Math.min(recentActivityCount * 5, 30);

  // Progress momentum (0-25)
  const avgProgress =
    enrollments.length > 0
      ? enrollments.reduce(
          (sum: number, e: any) =>
            sum +
            progressPercent(
              activity.get(e.id)?.completedLessons ?? 0,
              lessonCounts.get(e.course_id)
            ),
          0
        ) / enrollments.length
      : 0;
  score += Math.min((avgProgress / 100) * 25, 25);

  // Assessment engagement (0-15)
  const recentAttempts = recentAssessments.filter((a: any) => {
    if (!a.completed_at) return false;
    const diff = now - new Date(a.completed_at).getTime();
    return diff < 14 * 24 * 60 * 60 * 1000;
  }).length;
  score += Math.min(recentAttempts * 5, 15);

  // Recency factor (0-10)
  const mostRecentAccess = enrollments
    .map((e: any) => {
      const ts = activity.get(e.id)?.lastAccessedAt;
      return ts ? new Date(ts).getTime() : 0;
    })
    .sort((a: number, b: number) => b - a)[0];
  if (mostRecentAccess) {
    const daysSinceAccess =
      (now - mostRecentAccess) / (1000 * 60 * 60 * 24);
    if (daysSinceAccess < 1) score += 10;
    else if (daysSinceAccess < 3) score += 7;
    else if (daysSinceAccess < 7) score += 3;
  }

  return Math.min(Math.round(score), 100);
}

/**
 * Identify at-risk learners, optionally filtered by course.
 */
export async function identifyAtRiskLearners(
  courseId?: string
): Promise<AtRiskLearner[]> {
  const service = createServiceClient();

  // Get recent risk predictions
  let query = service
    .from("risk_predictions")
    .select(
      "*, user:users!risk_predictions_user_id_fkey(id, first_name, last_name, email), course:courses!risk_predictions_course_id_fkey(id, title)"
    )
    .in("risk_level", ["high", "critical"])
    .order("risk_score", { ascending: false })
    .limit(100);

  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  const { data } = await query;

  return (data ?? []).map((r: any) => {
    const user = r.user as any;
    const course = r.course as any;
    return {
      userId: r.user_id,
      userName:
        user?.first_name && user?.last_name
          ? `${user.first_name} ${user.last_name}`
          : "Unknown",
      email: user?.email ?? "",
      courseId: r.course_id,
      courseTitle: course?.title ?? "Unknown Course",
      riskLevel: r.risk_level,
      riskScore: parseFloat(r.risk_score),
      factors: r.factors ?? {},
      recommendedActions: r.recommended_actions ?? [],
      computedAt: r.computed_at,
    };
  });
}
