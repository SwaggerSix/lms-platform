import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { getTrendData } from "@/lib/analytics/snapshots";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") || auth.user.id;
  const days = parseInt(searchParams.get("days") || "30");

  // Non-admins/managers can only see their own snapshots
  if (userId !== auth.user.id && !["admin", "manager"].includes(auth.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const snapshots = await getTrendData(userId, Math.min(days, 365));
    return NextResponse.json({ snapshots });
  } catch (err) {
    console.error("Snapshots API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
