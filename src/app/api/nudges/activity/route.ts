import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET: per-assignment summaries + a recent activity feed for the manager.
export async function GET(_request: NextRequest) {
  const auth = await authorize("manager", "admin", "super_admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const isAdmin = ["admin", "super_admin"].includes(auth.user.role);

  let aQuery = service
    .from("nudge_assignments")
    .select("id, assignee_name, status, nudge_actions(title)")
    .order("created_at", { ascending: false });
  if (!isAdmin) aQuery = aQuery.eq("assigned_by", auth.user.id);

  const { data: assignments, error } = await aQuery;
  if (error) {
    console.error("Nudge activity GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const ids = (assignments ?? []).map((a) => a.id);
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];

  const [streaksRes, todayLogsRes, activityRes] = await Promise.all([
    ids.length ? service.from("nudge_streaks").select("*").in("assignment_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? service.from("nudge_daily_logs").select("assignment_id, committed, completed").eq("log_date", today).in("assignment_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? service.from("nudge_activity_log").select("*").in("assignment_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
  ]);

  const streakMap = new Map((streaksRes.data ?? []).map((s) => [s.assignment_id, s]));
  const todayMap = new Map((todayLogsRes.data ?? []).map((l) => [l.assignment_id, l]));

  const summaries = (assignments ?? []).map((a) => {
    const s = streakMap.get(a.id);
    const t = todayMap.get(a.id);
    const action = a.nudge_actions as unknown as { title: string } | null;
    return {
      assignmentId: a.id,
      assigneeName: a.assignee_name,
      actionTitle: action?.title ?? "",
      status: a.status,
      currentStreak: s?.current_streak ?? 0,
      longestStreak: s?.longest_streak ?? 0,
      totalCommitted: s?.total_committed ?? 0,
      totalCompleted: s?.total_completed ?? 0,
      todayCommitted: !!t?.committed,
      todayCompleted: !!t?.completed,
      lastCompletedDate: s?.last_completed_date ?? null,
    };
  });

  const recentActivity = (activityRes.data ?? []).map((e) => ({
    date: e.created_at,
    action: e.action,
    actionTitle: e.action_title,
    reflection: e.reflection,
  }));

  return NextResponse.json({ summaries, recentActivity });
}
