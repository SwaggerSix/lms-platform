import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const courseId = searchParams.get("course_id");

  // Admins/managers can view all; learners only see their own
  const isAdmin = ["admin", "super_admin", "manager"].includes(auth.user.role);
  const targetUserId = isAdmin && searchParams.get("user_id")
    ? searchParams.get("user_id")
    : auth.user.id;

  let query = service
    .from("evaluation_assignments")
    .select(`
      *,
      template:evaluation_templates(id, name, level, questions),
      course:courses(id, title, thumbnail_url)
    `)
    .order("created_at", { ascending: false });

  if (!isAdmin || !searchParams.get("user_id")) {
    query = query.eq("user_id", targetUserId!);
  }
  if (status) query = query.eq("status", status);
  if (courseId) query = query.eq("course_id", courseId);

  const { data, error } = await query;
  if (error) {
    console.error("Evaluation assignments GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ assignments: data });
}
