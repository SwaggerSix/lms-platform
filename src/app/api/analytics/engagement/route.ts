import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { computeEngagementScore } from "@/lib/analytics/predictive";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") || auth.user.id;

  // Non-admins/managers can only see their own engagement
  if (userId !== auth.user.id && !["admin", "manager"].includes(auth.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const score = await computeEngagementScore(userId);

    // Get recent snapshots for trend
    const service = createServiceClient();
    const { data: snapshots } = await service
      .from("learning_analytics_snapshots")
      .select("snapshot_date, engagement_score")
      .eq("user_id", userId)
      .order("snapshot_date", { ascending: false })
      .limit(30);

    return NextResponse.json({
      currentScore: score,
      trend: (snapshots ?? []).reverse(),
    });
  } catch (err) {
    console.error("Engagement API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
