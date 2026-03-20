import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/paths/enroll
 * Body: { path_id: string }
 * Enrolls the authenticated user in a learning path.
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
    .select("id")
    .eq("auth_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const rl = await rateLimit(`path-enroll-${profile.id}`, 20, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: { path_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { path_id } = body;
  if (!path_id) {
    return NextResponse.json({ error: "path_id is required" }, { status: 400 });
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

  // Check if already enrolled
  const { data: existing } = await service
    .from("learning_path_enrollments")
    .select("id")
    .eq("user_id", profile.id)
    .eq("path_id", path_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Already enrolled in this path" }, { status: 409 });
  }

  // Create the enrollment
  const { data: enrollment, error: enrollError } = await service
    .from("learning_path_enrollments")
    .insert({
      user_id: profile.id,
      path_id,
      status: "in_progress",
      enrolled_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (enrollError) {
    console.error("Path enrollment error:", enrollError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Also enroll the user in all courses within the path (if not already enrolled)
  const { data: pathItems } = await service
    .from("learning_path_items")
    .select("course_id")
    .eq("path_id", path_id)
    .order("sequence_order", { ascending: true });

  if (pathItems && pathItems.length > 0) {
    const courseIds = pathItems.map((item: any) => item.course_id);

    // Find courses user is NOT already enrolled in
    const { data: existingEnrollments } = await service
      .from("enrollments")
      .select("course_id")
      .eq("user_id", profile.id)
      .in("course_id", courseIds);

    const alreadyEnrolled = new Set(
      (existingEnrollments ?? []).map((e: any) => e.course_id)
    );

    const newEnrollments = courseIds
      .filter((cid: string) => !alreadyEnrolled.has(cid))
      .map((course_id: string) => ({
        user_id: profile.id,
        course_id,
        status: "not_started",
        enrolled_at: new Date().toISOString(),
      }));

    if (newEnrollments.length > 0) {
      await service.from("enrollments").insert(newEnrollments);
    }
  }

  logAudit({
    userId: profile.id,
    action: "created",
    entityType: "learning_path_enrollment",
    entityId: enrollment.id,
    newValues: { path_id, path_title: path.title },
  });

  return NextResponse.json({ data: enrollment }, { status: 201 });
}
