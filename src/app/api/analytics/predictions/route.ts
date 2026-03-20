import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id") || auth.user.id;
  const courseId = searchParams.get("course_id");

  // Non-admins can only see their own predictions
  if (userId !== auth.user.id && !["admin", "manager"].includes(auth.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = service
    .from("risk_predictions")
    .select(
      "*, course:courses!risk_predictions_course_id_fkey(id, title, slug)"
    )
    .eq("user_id", userId)
    .order("computed_at", { ascending: false });

  if (courseId) {
    query = query.eq("course_id", courseId);
  }

  // Get the most recent prediction per course
  const { data, error } = await query.limit(50);

  if (error) {
    console.error("Predictions API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Deduplicate: keep only most recent prediction per course
  const seen = new Set<string>();
  const unique = (data ?? []).filter((p: any) => {
    if (seen.has(p.course_id)) return false;
    seen.add(p.course_id);
    return true;
  });

  return NextResponse.json({ predictions: unique });
}
