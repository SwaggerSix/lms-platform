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

  // Get enrollment and progress data
  const [enrollmentResult, lessonsResult, assessmentResult, snapshotResult] =
    await Promise.all([
      service
        .from("enrollments")
        .select("id, status, progress, enrolled_at, due_date, last_accessed_at")
        .eq("user_id", userId)
        .eq("course_id", courseId)
        .single(),
      service
        .from("lesson_progress")
        .select("id, status, completed_at, time_spent_seconds")
        .eq("user_id", userId)
        .eq("lesson_id", courseId), // This will be joined via course
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

  const factors: Record<string, number | string> = {};
  let totalRisk = 0;

  // Factor 1: Progress rate (0-25 risk points)
  const progress = enrollment?.progress ?? 0;
  const enrolledAt = enrollment?.enrolled_at
    ? new Date(enrollment.enrolled_at)
    : new Date();
  const daysSinceEnroll = Math.max(
    1,
    (Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceEnroll > 7 && progress < 10) {
    factors.low_progress = progress;
    factors.days_since_enroll = Math.round(daysSinceEnroll);
    totalRisk += 25;
  } else if (daysSinceEnroll > 14 && progress < 30) {
    factors.low_progress = progress;
    totalRisk += 18;
  } else if (daysSinceEnroll > 30 && progress < 50) {
    factors.low_progress = progress;
    totalRisk += 12;
  }

  // Factor 2: Due date proximity (0-20 risk points)
  if (enrollment?.due_date) {
    const dueDate = new Date(enrollment.due_date);
    const daysUntilDue =
      (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const remainingWork = 100 - progress;

    if (daysUntilDue < 0) {
      factors.overdue_days = Math.abs(Math.round(daysUntilDue));
      totalRisk += 20;
    } else if (daysUntilDue < 7 && remainingWork > 50) {
      factors.days_until_due = Math.round(daysUntilDue);
      factors.remaining_progress = remainingWork;
      totalRisk += 15;
    } else if (daysUntilDue < 14 && remainingWork > 70) {
      factors.days_until_due = Math.round(daysUntilDue);
      totalRisk += 10;
    }
  }

  // Factor 3: Login / engagement recency (0-20 risk points)
  const lastAccessed = enrollment?.last_accessed_at
    ? new Date(enrollment.last_accessed_at)
    : null;
  if (lastAccessed) {
    const daysSinceAccess =
      (Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceAccess > 14) {
      factors.days_since_last_access = Math.round(daysSinceAccess);
      totalRisk += 20;
    } else if (daysSinceAccess > 7) {
      factors.days_since_last_access = Math.round(daysSinceAccess);
      totalRisk += 12;
    } else if (daysSinceAccess > 3) {
      factors.days_since_last_access = Math.round(daysSinceAccess);
      totalRisk += 5;
    }
  } else {
    factors.never_accessed = "true";
    totalRisk += 15;
  }

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

  // Determine risk level
  let riskLevel: RiskPrediction["riskLevel"];
  if (riskScore >= 75) {
    riskLevel = "critical";
  } else if (riskScore >= 50) {
    riskLevel = "high";
  } else if (riskScore >= 25) {
    riskLevel = "medium";
  } else {
    riskLevel = "low";
  }

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

  // Gather signals
  const [enrollResult, progressResult, assessmentResult] = await Promise.all([
    service
      .from("enrollments")
      .select("id, status, progress, last_accessed_at")
      .eq("user_id", userId)
      .eq("status", "active"),
    service
      .from("lesson_progress")
      .select("id, completed_at, time_spent_seconds")
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

  const enrollments = enrollResult.data ?? [];
  const recentLessons = progressResult.data ?? [];
  const recentAssessments = assessmentResult.data ?? [];

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
          (sum: number, e: any) => sum + (e.progress ?? 0),
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
    .map((e: any) =>
      e.last_accessed_at ? new Date(e.last_accessed_at).getTime() : 0
    )
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
