import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/paths/enroll
 * Body: { path_id: string, user_ids?: string[] }
 * Enrolls the authenticated user in a learning path. Admins and managers may
 * pass user_ids to assign one or more other users to the path instead.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rl = await rateLimit(`path-enroll-${profile.id}`, 20, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: { path_id?: string; user_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { path_id } = body;
  if (!path_id) {
    return NextResponse.json({ error: "path_id is required" }, { status: 400 });
  }

  // Determine who is being enrolled. Only admins/managers can assign others.
  const isManager = ["admin", "manager"].includes(profile.role);
  let targetUserIds: string[];
  if (body.user_ids && body.user_ids.length > 0) {
    if (!isManager) {
      return NextResponse.json({ error: "Forbidden: cannot assign other users" }, { status: 403 });
    }
    targetUserIds = [...new Set(body.user_ids)];
  } else {
    targetUserIds = [profile.id];
  }

  // Verify the path exists and is published
  const { data: path, error: pathError } = await service
    .from("learning_paths")
    .select("id, title")
    .eq("id", path_id)
    .eq("status", "published")
    .single();

  if (pathError || !path) {
    return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
  }

  // Skip users already enrolled in the path
  const { data: existing } = await service
    .from("learning_path_enrollments")
    .select("user_id")
    .eq("path_id", path_id)
    .in("user_id", targetUserIds);

  const alreadyInPath = new Set((existing ?? []).map((e: any) => e.user_id));
  const toEnroll = targetUserIds.filter((id) => !alreadyInPath.has(id));

  // Self-enrollment with no new work: report the conflict as before
  if (toEnroll.length === 0) {
    return NextResponse.json({ error: "Already enrolled in this path" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: enrollments, error: enrollError } = await service
    .from("learning_path_enrollments")
    .insert(
      toEnroll.map((userId) => ({
        user_id: userId,
        path_id,
        status: "in_progress",
        enrolled_at: now,
      }))
    )
    .select();

  if (enrollError) {
    console.error("Path enrollment error:", enrollError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Also enroll each user in all courses within the path (if not already enrolled)
  const { data: pathItems } = await service
    .from("learning_path_items")
    .select("course_id")
    .eq("path_id", path_id)
    .order("sequence_order", { ascending: true });

  if (pathItems && pathItems.length > 0) {
    const courseIds = pathItems.map((item: any) => item.course_id);

    const { data: existingEnrollments } = await service
      .from("enrollments")
      .select("user_id, course_id")
      .in("user_id", toEnroll)
      .in("course_id", courseIds);

    const alreadyEnrolled = new Set(
      (existingEnrollments ?? []).map((e: any) => `${e.user_id}:${e.course_id}`)
    );

    const newEnrollments = toEnroll.flatMap((userId) =>
      courseIds
        .filter((cid: string) => !alreadyEnrolled.has(`${userId}:${cid}`))
        .map((course_id: string) => ({
          user_id: userId,
          course_id,
          status: "not_started",
          enrolled_at: now,
        }))
    );

    if (newEnrollments.length > 0) {
      await service.from("enrollments").insert(newEnrollments);
    }
  }

  for (const enrollment of enrollments ?? []) {
    logAudit({
      userId: profile.id,
      action: "created",
      entityType: "learning_path_enrollment",
      entityId: enrollment.id,
      newValues: { path_id, path_title: path.title, enrolled_user_id: enrollment.user_id },
    });
  }

  return NextResponse.json(
    { data: enrollments, enrolled_count: enrollments?.length ?? 0 },
    { status: 201 }
  );
}
