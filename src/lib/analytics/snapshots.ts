import { createServiceClient } from "@/lib/supabase/service";
import {
  computeEngagementScore,
  getEnrollmentActivity,
  getCourseLessonCounts,
  progressPercent,
} from "./predictive";

export interface SnapshotData {
  snapshotDate: string;
  coursesEnrolled: number;
  coursesCompleted: number;
  avgProgress: number;
  avgScore: number;
  loginStreak: number;
  totalTimeMinutes: number;
  engagementScore: number;
}

/**
 * Create a daily analytics snapshot for a user.
 */
export async function createDailySnapshot(userId: string): Promise<void> {
  const service = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Get enrollment stats. Progress is derived from lesson_progress — the
  // enrollments table has no progress column.
  const { data: enrollments } = await service
    .from("enrollments")
    .select("id, course_id, status, time_spent")
    .eq("user_id", userId);

  const allEnrollments = (enrollments ?? []) as any[];
  const coursesEnrolled = allEnrollments.length;
  const coursesCompleted = allEnrollments.filter(
    (e: any) => e.status === "completed"
  ).length;

  const [activity, lessonCounts] = await Promise.all([
    getEnrollmentActivity(service, allEnrollments.map((e) => e.id)),
    getCourseLessonCounts(service, allEnrollments.map((e) => e.course_id)),
  ]);
  const avgProgress =
    coursesEnrolled > 0
      ? allEnrollments.reduce(
          (sum: number, e: any) =>
            sum +
            (e.status === "completed"
              ? 100
              : progressPercent(
                  activity.get(e.id)?.completedLessons ?? 0,
                  lessonCounts.get(e.course_id)
                )),
          0
        ) / coursesEnrolled
      : 0;

  // Get average assessment score
  const { data: assessments } = await service
    .from("assessment_attempts")
    .select("score")
    .eq("user_id", userId)
    .not("score", "is", null);

  const allAssessments = assessments ?? [];
  const avgScore =
    allAssessments.length > 0
      ? allAssessments.reduce(
          (sum: number, a: any) => sum + (a.score ?? 0),
          0
        ) / allAssessments.length
      : 0;

  // Calculate login streak from snapshots
  const { data: recentSnapshots } = await service
    .from("learning_analytics_snapshots")
    .select("snapshot_date, engagement_score, login_streak")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: false })
    .limit(30);

  let loginStreak = 1; // today counts
  if (recentSnapshots && recentSnapshots.length > 0) {
    const prevStreak = recentSnapshots[0]?.login_streak ?? 0;
    const prevDate = recentSnapshots[0]?.snapshot_date;
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    if (prevDate === yesterday) {
      loginStreak = (prevStreak as number) + 1;
    }
  }

  // Total time comes from enrollments.time_spent (minutes) — that's the
  // column the learner progress flow actually maintains.
  const totalTimeMinutes = allEnrollments.reduce(
    (sum: number, e: any) => sum + (e.time_spent ?? 0),
    0
  );

  // Compute engagement score
  const engagementScore = await computeEngagementScore(userId);

  // Upsert snapshot
  await service.from("learning_analytics_snapshots").upsert(
    {
      user_id: userId,
      snapshot_date: today,
      courses_enrolled: coursesEnrolled,
      courses_completed: coursesCompleted,
      avg_progress: Math.round(avgProgress * 100) / 100,
      avg_score: Math.round(avgScore * 100) / 100,
      login_streak: loginStreak,
      total_time_minutes: totalTimeMinutes,
      engagement_score: engagementScore,
    },
    { onConflict: "user_id,snapshot_date" }
  );
}

/**
 * Get trend data for a user over the specified number of days.
 */
export async function getTrendData(
  userId: string,
  days: number = 30
): Promise<SnapshotData[]> {
  const service = createServiceClient();

  const startDate = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data } = await service
    .from("learning_analytics_snapshots")
    .select("*")
    .eq("user_id", userId)
    .gte("snapshot_date", startDate)
    .order("snapshot_date", { ascending: true });

  return (data ?? []).map((s: any) => ({
    snapshotDate: s.snapshot_date,
    coursesEnrolled: s.courses_enrolled,
    coursesCompleted: s.courses_completed,
    avgProgress: parseFloat(s.avg_progress) || 0,
    avgScore: parseFloat(s.avg_score) || 0,
    loginStreak: s.login_streak,
    totalTimeMinutes: s.total_time_minutes,
    engagementScore: parseFloat(s.engagement_score) || 0,
  }));
}
