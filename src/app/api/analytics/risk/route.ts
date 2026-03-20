import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { identifyAtRiskLearners } from "@/lib/analytics/predictive";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id") || undefined;

  try {
    const atRiskLearners = await identifyAtRiskLearners(courseId);
    return NextResponse.json({
      learners: atRiskLearners,
      total: atRiskLearners.length,
    });
  } catch (err) {
    console.error("At-risk learners API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
