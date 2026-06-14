import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/classes/[classId]/assessments
 * Staff view: which of the course's assessments are deployed to this class.
 * Returns every assessment for the class's course with a `deployed` flag.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data: cls } = await service.from("classes").select("course_id").eq("id", classId).single();
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const [{ data: courseAssessments }, { data: deployed }] = await Promise.all([
    service.from("assessments").select("id, title, status").eq("course_id", cls.course_id),
    service.from("class_assessments").select("assessment_id").eq("class_id", classId),
  ]);

  const deployedIds = new Set((deployed ?? []).map((d) => d.assessment_id));
  const assessments = (courseAssessments ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    status: a.status,
    deployed: deployedIds.has(a.id),
  }));

  return NextResponse.json({ assessments, has_deployment: deployedIds.size > 0 });
}

/**
 * POST /api/classes/[classId]/assessments  — deploy an exam to this class.
 * Body: { assessment_id }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { assessment_id } = await request.json();
  if (!assessment_id) return NextResponse.json({ error: "assessment_id is required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("class_assessments")
    .upsert({ class_id: classId, assessment_id, created_by: auth.user.id }, { onConflict: "class_id,assessment_id" });

  if (error) {
    console.error("Class assessment deploy error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/classes/[classId]/assessments?assessment_id=...  — undeploy.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  const { classId } = await params;
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const assessmentId = new URL(request.url).searchParams.get("assessment_id");
  if (!assessmentId) return NextResponse.json({ error: "assessment_id is required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("class_assessments")
    .delete()
    .eq("class_id", classId)
    .eq("assessment_id", assessmentId);

  if (error) {
    console.error("Class assessment undeploy error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
