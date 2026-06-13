import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { provisionCourseMaterials } from "@/lib/services/course-materials";

/**
 * POST /api/paths/enroll
 * Body: { path_id: string, user_id?: string, due_date?: string }
 *
 * - Learners enroll themselves (omit user_id).
 * - Managers/admins assign a path to someone else (pass user_id). Managers may
 *   only assign to their own direct reports; admins/super admins to anyone.
 *
 * Enrolling in a path also enrolls the target user in each of its courses.
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

  let body: { path_id?: string; user_id?: string; due_date?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { path_id, user_id, due_date } = body;
  if (!path_id) {
    return NextResponse.json({ error: "path_id is required" }, { status: 400 });
  }

  // Resolve the target learner and authorize assignment-on-behalf-of.
  const targetUserId = user_id || profile.id;
  const isSelf = targetUserId === profile.id;
  const isPrivileged = ["admin", "super_admin"].includes(profile.role);

  if (!isSelf) {
    if (profile.role !== "manager" && !isPrivileged) {
      return NextResponse.json(
        { error: "You are not allowed to assign learning paths" },
        { status: 403 }
      );
    }
    // Managers may only assign to their own direct reports.
    if (!isPrivileged) {
      const { data: target } = await service
        .from("users")
        .select("id, manager_id")
        .eq("id", targetUserId)
        .single();
      if (!target) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (target.manager_id !== profile.id) {
        return NextResponse.json(
          { error: "You can only assign paths to your own team members" },
          { status: 403 }
        );
      }
    }
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

  // Check if already enrolled in the path
  const { data: existing } = await service
    .from("learning_path_enrollments")
    .select("id")
    .eq("user_id", targetUserId)
    .eq("path_id", path_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: isSelf
          ? "Already enrolled in this path"
          : "This user is already enrolled in this path",
      },
      { status: 409 }
    );
  }

  // Create the path enrollment. Self-enroll starts in progress; an assignment
  // sits at "enrolled" until the learner begins.
  const { data: enrollment, error: enrollError } = await service
    .from("learning_path_enrollments")
    .insert({
      user_id: targetUserId,
      path_id,
      status: isSelf ? "in_progress" : "enrolled",
      enrolled_at: new Date().toISOString(),
      due_date: due_date || null,
      assigned_by: isSelf ? null : profile.id,
    })
    .select()
    .single();

  if (enrollError) {
    console.error("Path enrollment error:", enrollError.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Also enroll the target user in all courses within the path (if not already).
  const { data: pathItems } = await service
    .from("learning_path_items")
    .select("course_id")
    .eq("path_id", path_id)
    .order("sequence_order", { ascending: true });

  if (pathItems && pathItems.length > 0) {
    const courseIds = pathItems.map((item: any) => item.course_id);

    const { data: existingEnrollments } = await service
      .from("enrollments")
      .select("course_id")
      .eq("user_id", targetUserId)
      .in("course_id", courseIds);

    const alreadyEnrolled = new Set(
      (existingEnrollments ?? []).map((e: any) => e.course_id)
    );

    const newEnrollments = courseIds
      .filter((cid: string) => !alreadyEnrolled.has(cid))
      .map((course_id: string) => ({
        user_id: targetUserId,
        course_id,
        status: "enrolled",
        enrolled_at: new Date().toISOString(),
        due_date: due_date || null,
        assigned_by: isSelf ? null : profile.id,
      }));

    if (newEnrollments.length > 0) {
      const { error: courseEnrollError } = await service
        .from("enrollments")
        .insert(newEnrollments);
      if (courseEnrollError) {
        console.error("Path course enrollment error:", courseEnrollError.message);
      }
    }

    // Copy each course's learner materials into the user's Documents.
    await Promise.allSettled(
      courseIds.map((cid: string) =>
        provisionCourseMaterials(service, targetUserId, cid)
      )
    );
  }

  logAudit({
    userId: profile.id,
    action: "created",
    entityType: "learning_path_enrollment",
    entityId: enrollment.id,
    newValues: {
      path_id,
      path_title: path.title,
      target_user_id: targetUserId,
      assigned: !isSelf,
    },
  });

  return NextResponse.json(
    { data: enrollment, enrolled_count: 1 },
    { status: 201 }
  );
}
