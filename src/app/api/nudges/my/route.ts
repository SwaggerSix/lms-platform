import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET: the current user's own assigned nudges, with today's log + streak.
export async function GET(_request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data: assignments, error } = await service
    .from("nudge_assignments")
    .select("*, nudge_actions(title, description, estimated_minutes, image_url, quote, quote_author)")
    .eq("assignee_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("My nudges GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const ids = (assignments ?? []).map((a) => a.id);
  const today = new Date().toISOString().split("T")[0];

  const [logsRes, streaksRes] = await Promise.all([
    ids.length ? service.from("nudge_daily_logs").select("*").eq("log_date", today).in("assignment_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? service.from("nudge_streaks").select("*").in("assignment_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const logMap = new Map((logsRes.data ?? []).map((l) => [l.assignment_id, l]));
  const streakMap = new Map((streaksRes.data ?? []).map((s) => [s.assignment_id, s]));

  const nudges = (assignments ?? []).map((a) => ({
    ...a,
    todayLog: logMap.get(a.id) ?? null,
    streak: streakMap.get(a.id) ?? null,
  }));

  return NextResponse.json({ nudges });
}
