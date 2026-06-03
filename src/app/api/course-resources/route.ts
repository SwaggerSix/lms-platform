import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { getInstructorCourseIds } from "@/lib/instructor/instructor-queries";

const RESOURCE_TYPES = [
  "presentation_deck",
  "video",
  "learner_guide",
  "facilitator_guide",
  "course_material",
  "other",
];

/**
 * GET /api/course-resources?course_id=...
 * Lists a course's content artifacts. Learners only see learner-audience
 * resources; admins/instructors see everything (incl. facilitator guides).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  if (!courseId) {
    return NextResponse.json({ error: "course_id is required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  const privileged = ["admin", "super_admin", "instructor"].includes(profile?.role ?? "");

  let query = service
    .from("course_resources")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });
  if (!privileged) query = query.eq("audience", "learner");

  const { data, error } = await query;
  if (error) {
    console.error("Course resources GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ resources: data ?? [] });
}

/** Whether the actor may manage resources for the given course. */
async function canManageCourse(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  role: string,
  courseId: string
): Promise<boolean> {
  if (["admin", "super_admin"].includes(role)) return true;
  if (role === "instructor") {
    const ids = await getInstructorCourseIds(userId, service);
    return ids.includes(courseId);
  }
  return false;
}

/**
 * POST /api/course-resources
 * Body: { course_id, title, resource_type, audience, file_url, file_name, file_type, file_size }
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "super_admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { course_id, title, resource_type, audience, file_url, file_name, file_type, file_size } = body ?? {};
  if (!course_id || !title || !file_url) {
    return NextResponse.json({ error: "course_id, title, and file_url are required" }, { status: 400 });
  }
  if (resource_type && !RESOURCE_TYPES.includes(resource_type)) {
    return NextResponse.json({ error: "Invalid resource_type" }, { status: 400 });
  }

  const service = createServiceClient();
  if (!(await canManageCourse(service, auth.user.id, auth.user.role, course_id))) {
    return NextResponse.json({ error: "You can only manage resources for your own courses" }, { status: 403 });
  }

  const { data, error } = await service
    .from("course_resources")
    .insert({
      course_id,
      title,
      resource_type: resource_type || "course_material",
      audience: audience === "facilitator" ? "facilitator" : "learner",
      file_url,
      file_name: file_name ?? title,
      file_type: file_type ?? null,
      file_size: file_size ?? 0,
      uploaded_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Course resources POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  // Bump the course's Last Updated timestamp (courseware changed).
  await service.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", course_id);
  return NextResponse.json(data, { status: 201 });
}

/** DELETE /api/course-resources?id=... */
export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin", "super_admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const service = createServiceClient();
  const { data: existing } = await service
    .from("course_resources")
    .select("id, course_id")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canManageCourse(service, auth.user.id, auth.user.role, existing.course_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service.from("course_resources").delete().eq("id", id);
  if (error) {
    console.error("Course resources DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  await service.from("courses").update({ updated_at: new Date().toISOString() }).eq("id", existing.course_id);
  return NextResponse.json({ success: true });
}
