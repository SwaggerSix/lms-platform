import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import AchievementsClient from "./achievements-client";
import type { AchievementsData, BadgeData, LeaderboardEntry, ActivityEntry } from "./achievements-client";

export const metadata: Metadata = {
  title: "Achievements | LMS Platform",
  description: "Track your badges, points, streaks, and leaderboard ranking",
};

/* ------------------------------------------------------------------ */
/*  Badge catalog — loaded from the badges table at runtime            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Level helpers                                                      */
/* ------------------------------------------------------------------ */

const LEVEL_NAMES: Record<number, string> = {
  1: "Newcomer",
  2: "Explorer",
  3: "Achiever",
  4: "Scholar",
  5: "Rising Star",
  6: "Expert",
  7: "Master",
};

function calculateLevel(totalPoints: number): { level: number; currentXP: number; nextLevelXP: number } {
  // Every 500 points = 1 level, max level 7
  const level = Math.min(7, Math.max(1, Math.floor(totalPoints / 500) + 1));
  const pointsForCurrentLevel = (level - 1) * 500;
  const currentXP = totalPoints - pointsForCurrentLevel;
  const nextLevelXP = level >= 7 ? 500 : 500; // Always 500 per level
  return { level, currentXP, nextLevelXP };
}

/* ------------------------------------------------------------------ */
/*  Time-ago helper                                                    */
/* ------------------------------------------------------------------ */

function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) return diffMins <= 1 ? "Just now" : `${diffMins} minutes ago`;
  if (diffHours < 24) return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return "1 week ago";
  return `${diffWeeks} weeks ago`;
}

/* ------------------------------------------------------------------ */
/*  Activity description mapping                                       */
/* ------------------------------------------------------------------ */

function descriptionForActivity(actionType: string | null, points: number): { description: string; iconName: string } {
  const r = (actionType ?? "").toLowerCase();
  if (r.includes("course_complete") || r.includes("course_completion")) return { description: "Completed a course", iconName: "CheckCircle2" };
  if (r.includes("lesson_completion") || r.includes("lesson")) return { description: "Completed a lesson", iconName: "CheckCircle2" };
  if (r.includes("quiz") || r.includes("assessment")) return { description: "Passed a quiz", iconName: "Star" };
  if (r.includes("streak")) return { description: "Learning streak achieved", iconName: "Flame" };
  if (r.includes("module")) return { description: "Completed a module", iconName: "Shield" };
  if (r.includes("enroll")) return { description: "Enrolled in a course", iconName: "BookOpen" };
  if (r.includes("badge")) return { description: "Earned a badge", iconName: "Award" };
  if (r.includes("discussion") || r.includes("reply") || r.includes("post")) return { description: "Posted a discussion reply", iconName: "MessageCircle" };
  if (r.includes("path") || r.includes("start")) return { description: "Started a learning path", iconName: "Rocket" };
  return { description: `Earned ${points} points`, iconName: "Award" };
}

/* ------------------------------------------------------------------ */
/*  Fallback data (used when tables are empty or don't exist)          */
/* ------------------------------------------------------------------ */

const FALLBACK_DATA: AchievementsData = {
  totalPoints: 2450,
  currentLevel: 5,
  currentLevelName: "Rising Star",
  currentXP: 450,
  nextLevelXP: 500,
  streak: 12,
  globalRank: 23,
  totalUsers: 156,
  badges: [
    { id: "b1", name: "First Steps", description: "Complete your very first course", iconName: "BookOpen", earned: true, earnedDate: "Aug 20, 2025" },
    { id: "b2", name: "Quick Learner", description: "Complete a course in under a week", iconName: "Zap", earned: true, earnedDate: "Sep 15, 2025" },
    { id: "b3", name: "Streak Champion", description: "Maintain a 7-day learning streak", iconName: "Flame", earned: true, earnedDate: "Oct 3, 2025" },
    { id: "b4", name: "Safety Star", description: "Complete all safety training courses", iconName: "Shield", earned: true, earnedDate: "Nov 10, 2025" },
    { id: "b5", name: "Knowledge Seeker", description: "Enroll in 10 different courses", iconName: "Target", earned: true, earnedDate: "Jan 5, 2026" },
    { id: "b6", name: "Quiz Master", description: "Score 100% on 3 assessments", iconName: "Star", earned: false, progress: 2, maxProgress: 3, progressLabel: "2/3 perfect scores" },
    { id: "b7", name: "Social Butterfly", description: "Post 10 discussion forum replies", iconName: "MessageCircle", earned: false, progress: 4, maxProgress: 10, progressLabel: "4/10 posts" },
    { id: "b8", name: "Completionist", description: "Complete an entire learning path", iconName: "Trophy", earned: false, progress: 0, maxProgress: 1, progressLabel: "0/1 paths" },
    { id: "b9", name: "Top Scorer", description: "Accumulate 1,000 quiz points", iconName: "Award", earned: false, progress: 670, maxProgress: 1000, progressLabel: "670/1000 pts needed" },
    { id: "b10", name: "Mentor", description: "Have a reply marked as best answer", iconName: "Users", earned: false, progress: 0, maxProgress: 1, progressLabel: "0/1 answers" },
    { id: "b11", name: "Speed Runner", description: "Complete 3 courses in one month", iconName: "Rocket", earned: false, progress: 0, maxProgress: 3, progressLabel: "Not started" },
    { id: "b12", name: "Certified Pro", description: "Earn 3 certificates", iconName: "GraduationCap", earned: false, progress: 1, maxProgress: 3, progressLabel: "1/3 certs" },
  ],
  leaderboard: [
    { rank: 1, name: "Sarah Chen", initials: "SC", level: 7, levelName: "Master", points: 5820, badges: 11, isCurrentUser: false },
    { rank: 2, name: "Marcus Rivera", initials: "MR", level: 7, levelName: "Master", points: 5410, badges: 10, isCurrentUser: false },
    { rank: 3, name: "Priya Patel", initials: "PP", level: 6, levelName: "Expert", points: 4970, badges: 9, isCurrentUser: false },
    { rank: 4, name: "James Wilson", initials: "JW", level: 6, levelName: "Expert", points: 4230, badges: 8, isCurrentUser: false },
    { rank: 5, name: "Alex Johnson", initials: "AJ", level: 5, levelName: "Rising Star", points: 2450, badges: 5, isCurrentUser: true },
    { rank: 6, name: "Emily Rodriguez", initials: "ER", level: 5, levelName: "Rising Star", points: 2310, badges: 6, isCurrentUser: false },
    { rank: 7, name: "David Kim", initials: "DK", level: 4, levelName: "Scholar", points: 1890, badges: 5, isCurrentUser: false },
    { rank: 8, name: "Lisa Thompson", initials: "LT", level: 4, levelName: "Scholar", points: 1650, badges: 4, isCurrentUser: false },
    { rank: 9, name: "Jordan Lee", initials: "JL", level: 3, levelName: "Achiever", points: 1220, badges: 3, isCurrentUser: false },
    { rank: 10, name: "Taylor Nguyen", initials: "TN", level: 3, levelName: "Achiever", points: 980, badges: 2, isCurrentUser: false },
  ],
  activities: [
    { id: "a1", description: "Completed 'Data Science' course", points: 100, timeAgo: "2 hours ago", iconName: "CheckCircle2" },
    { id: "a2", description: "Passed quiz with 90%", points: 50, timeAgo: "Yesterday", iconName: "Star" },
    { id: "a3", description: "7-day streak achieved", points: 50, timeAgo: "2 days ago", iconName: "Flame" },
    { id: "a4", description: "Completed 'Safety Basics' module", points: 75, timeAgo: "3 days ago", iconName: "Shield" },
    { id: "a5", description: "Enrolled in Cloud Architecture course", points: 25, timeAgo: "4 days ago", iconName: "BookOpen" },
    { id: "a6", description: "Earned 'Knowledge Seeker' badge", points: 150, timeAgo: "5 days ago", iconName: "Award" },
    { id: "a7", description: "Posted a helpful discussion reply", points: 30, timeAgo: "6 days ago", iconName: "MessageCircle" },
    { id: "a8", description: "Completed lesson: Intro to Python", points: 50, timeAgo: "1 week ago", iconName: "CheckCircle2" },
    { id: "a9", description: "Passed compliance training quiz", points: 75, timeAgo: "1 week ago", iconName: "Star" },
    { id: "a10", description: "Started 'Leadership Essentials' path", points: 25, timeAgo: "2 weeks ago", iconName: "Rocket" },
  ],
};

/* ------------------------------------------------------------------ */
/*  Server Component                                                   */
/* ------------------------------------------------------------------ */

export default async function AchievementsPage() {
  let achievementsData: AchievementsData;

  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) {
      // Not authenticated, use fallback
      achievementsData = FALLBACK_DATA;
      return <AchievementsClient data={achievementsData} />;
    }

    const service = createServiceClient();

    // ---- Query points_ledger for total points and recent activity ----
    let totalPoints = 0;
    let activities: ActivityEntry[] = [];
    let hasPointsData = false;

    try {
      const { data: pointsRows, error: pointsError } = await service
        .from("points_ledger")
        .select("id, points, action_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!pointsError && pointsRows && pointsRows.length > 0) {
        hasPointsData = true;
        totalPoints = pointsRows.reduce((sum, row) => sum + (row.points ?? 0), 0);

        // Map recent entries to activities (take up to 10)
        activities = pointsRows.slice(0, 10).map((row, idx) => {
          const { description, iconName } = descriptionForActivity(row.action_type, row.points ?? 0);
          return {
            id: row.id ?? `a${idx}`,
            description,
            points: row.points ?? 0,
            timeAgo: row.created_at ? timeAgo(row.created_at) : "Recently",
            iconName,
          };
        });
      }
    } catch {
      // Table may not exist, will use fallback
    }

    // ---- Calculate level from total points ----
    const { level: currentLevel, currentXP, nextLevelXP } = calculateLevel(totalPoints);
    const currentLevelName = LEVEL_NAMES[currentLevel] ?? "Newcomer";

    // ---- Calculate streak (count consecutive days with points activity) ----
    let streak = 0;
    if (hasPointsData) {
      try {
        const { data: streakRows } = await service
          .from("points_ledger")
          .select("created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (streakRows && streakRows.length > 0) {
          const daysWithActivity = new Set(
            streakRows.map((r) =>
              new Date(r.created_at).toISOString().split("T")[0]
            )
          );
          const today = new Date();
          for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split("T")[0];
            if (daysWithActivity.has(key)) {
              streak++;
            } else {
              break;
            }
          }
        }
      } catch {
        // Ignore streak errors
      }
    }

    // ---- Query badges from the database and check which ones user earned ----
    let badges: BadgeData[] = [];
    let hasBadgeData = false;

    try {
      const [allBadgesRes, userBadgesRes, enrollCountRes, completionCountRes] =
        await Promise.all([
          service.from("badges").select("*").order("category"),
          service.from("user_badges").select("badge_id, awarded_at").eq("user_id", userId),
          service.from("enrollments").select("id", { count: "exact", head: true }).eq("user_id", userId),
          service.from("enrollments").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed"),
        ]);

      if (!allBadgesRes.error && allBadgesRes.data) {
        hasBadgeData = true;
        const earnedMap = new Map(
          (userBadgesRes.data ?? []).map((b) => [b.badge_id, b])
        );

        const userEnrollments = enrollCountRes.count ?? 0;
        const userCompletions = completionCountRes.count ?? 0;

        // Icon mapping based on badge criteria type
        const criteriaIconMap: Record<string, string> = {
          completions: "BookOpen",
          enrollments: "Target",
          points: "Award",
          streak: "Flame",
        };

        badges = allBadgesRes.data.map((dbBadge) => {
          const earned = earnedMap.get(dbBadge.id);
          const criteria = dbBadge.criteria as { type?: string; count?: number } | null;
          const criteriaType = criteria?.type ?? "";
          const criteriaCount = criteria?.count ?? 1;
          const iconName = criteriaIconMap[criteriaType] ?? "Trophy";

          if (earned) {
            return {
              id: dbBadge.id,
              name: dbBadge.name,
              description: dbBadge.description ?? "",
              iconName,
              earned: true,
              earnedDate: earned.awarded_at
                ? new Date(earned.awarded_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : undefined,
            };
          }

          // Compute progress toward unearned badges
          let progress = 0;
          if (criteriaType === "completions") progress = userCompletions;
          else if (criteriaType === "enrollments") progress = userEnrollments;
          else if (criteriaType === "points") progress = totalPoints;
          else if (criteriaType === "streak") progress = streak;

          return {
            id: dbBadge.id,
            name: dbBadge.name,
            description: dbBadge.description ?? "",
            iconName,
            earned: false,
            progress: Math.min(progress, criteriaCount),
            maxProgress: criteriaCount,
            progressLabel: `${Math.min(progress, criteriaCount)}/${criteriaCount}`,
          };
        });
      }
    } catch {
      // Table may not exist, will use fallback
    }

    // ---- Query leaderboard (all users with points) ----
    let leaderboard: LeaderboardEntry[] = [];
    let hasLeaderboardData = false;

    try {
      // Try to get leaderboard from points_ledger grouped by user
      const { data: lbRows, error: lbError } = await service
        .rpc("get_leaderboard", {})
        .limit(10);

      if (!lbError && lbRows && lbRows.length > 0) {
        hasLeaderboardData = true;
        leaderboard = lbRows.map((row: { user_id: string; total_points: number; display_name?: string; badge_count?: number }, idx: number) => {
          const pts = row.total_points ?? 0;
          const { level } = calculateLevel(pts);
          const name = row.display_name ?? `User ${idx + 1}`;
          const initials = name
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          return {
            rank: idx + 1,
            name,
            initials,
            level,
            levelName: LEVEL_NAMES[level] ?? "Newcomer",
            points: pts,
            badges: row.badge_count ?? 0,
            isCurrentUser: row.user_id === userId,
          };
        });
      }
    } catch {
      // RPC may not exist, will use fallback
    }

    // If we didn't get leaderboard from RPC, try a simpler query
    if (!hasLeaderboardData) {
      try {
        const { data: usersWithPoints, error: uwpError } = await service
          .from("points_ledger")
          .select("user_id, points")
          .order("points", { ascending: false });

        if (!uwpError && usersWithPoints && usersWithPoints.length > 0) {
          // Aggregate by user
          const userPoints = new Map<string, number>();
          for (const row of usersWithPoints) {
            const current = userPoints.get(row.user_id) ?? 0;
            userPoints.set(row.user_id, current + (row.points ?? 0));
          }

          const sorted = [...userPoints.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

          if (sorted.length > 0) {
            hasLeaderboardData = true;
            leaderboard = sorted.map(([uid, pts], idx) => {
              const { level } = calculateLevel(pts);
              return {
                rank: idx + 1,
                name: uid === userId ? "You" : `User ${idx + 1}`,
                initials: uid === userId ? "ME" : `U${idx + 1}`.slice(0, 2),
                level,
                levelName: LEVEL_NAMES[level] ?? "Newcomer",
                points: pts,
                badges: 0,
                isCurrentUser: uid === userId,
              };
            });
          }
        }
      } catch {
        // Will use fallback
      }
    }

    // ---- Determine global rank ----
    let globalRank = 1;
    let totalUsersCount = 1;

    if (hasLeaderboardData) {
      const myEntry = leaderboard.find((e) => e.isCurrentUser);
      globalRank = myEntry?.rank ?? leaderboard.length + 1;
      totalUsersCount = Math.max(leaderboard.length, globalRank);
    }

    // ---- If we have no data from any table, use full fallback ----
    if (!hasPointsData && !hasBadgeData && !hasLeaderboardData) {
      achievementsData = FALLBACK_DATA;
    } else {
      achievementsData = {
        totalPoints,
        currentLevel,
        currentLevelName,
        currentXP,
        nextLevelXP,
        streak,
        globalRank: hasLeaderboardData ? globalRank : FALLBACK_DATA.globalRank,
        totalUsers: hasLeaderboardData ? totalUsersCount : FALLBACK_DATA.totalUsers,
        badges: hasBadgeData ? badges : FALLBACK_DATA.badges,
        leaderboard: hasLeaderboardData ? leaderboard : FALLBACK_DATA.leaderboard,
        activities: hasPointsData && activities.length > 0 ? activities : FALLBACK_DATA.activities,
      };
    }
  } catch {
    // If anything goes wrong at the top level, use fallback
    achievementsData = FALLBACK_DATA;
  }

  return <AchievementsClient data={achievementsData} />;
}
