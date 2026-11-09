import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { provisionCourseMaterials } from "@/lib/services/course-materials";
import { grantPathAccess, MAX_PATH_INVITES } from "@/lib/paths/invite";

/**
 * POST /api/paths/enroll
 * Body: { path_id: string, user_id?: string, user_ids?: string[], due_date?: string }
 *
 * - user_ids assigns several people at once (Admin → Learning Paths → Assign).
 *   The dialog always sent user_ids, which this route used to ignore, so it
 *   enrolled the admin themselves instead of the people they picked.
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

  let body: { path_id?: string; user_id?: string; user_ids?: unknown; due_date?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { path_id, user_id, due_date } = body;
  if (!path_id) {
    return NextResponse.json({ error: "path_id is required" }, { status: 400 });
  }

  if (body.user_ids !== undefined) {
    return assignMany(service, profile, path_id, body.user_ids, due_date ?? null);
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

  // A path sold as a store bundle is bought, not joined: learners may not
  // enroll themselves in it (that would hand out every course for free).
  // Admins and managers can still assign it.
  if (isSelf && !isPrivileged) {
    const { data: onSale } = await service
      .from("products")
      .select("id")
      .eq("learning_path_id", path_id)
      .neq("status", "inactive")
      .limit(1);
    if (onSale && onSale.length > 0) {
      return NextResponse.json(
        { error: "This learning path is sold in our online store. Purchase it there to enroll." },
        { status: 403 }
      );
    }
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

/**
 * Assigns a published path to several people: admins/super admins to anyone,
 * managers to their own direct reports (others are skipped). Idempotent —
 * people who already have the path are counted as skipped.
 */
async function assignMany(
  service: ReturnType<typeof createServiceClient>,
  profile: { id: string; role: string },
  pathId: string,
  rawIds: unknown,
  dueDate: string | null
) {
  const isPrivileged = ["admin", "super_admin"].includes(profile.role);
  if (profile.role !== "manager" && !isPrivileged) {
    return NextResponse.json({ error: "You are not allowed to assign learning paths" }, { status: 403 });
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!Array.isArray(rawIds) || rawIds.length === 0 || !rawIds.every((x) => typeof x === "string" && uuid.test(x))) {
    return NextResponse.json({ error: "user_ids must be a list of user ids" }, { status: 400 });
  }
  const ids = [...new Set(rawIds as string[])];
  if (ids.length > MAX_PATH_INVITES) {
    return NextResponse.json({ error: `Assign at most ${MAX_PATH_INVITES} people at a time` }, { status: 400 });
  }

  const { data: path } = await service
    .from("learning_paths")
    .select("id, title")
    .eq("id", pathId)
    .eq("status", "published")
    .maybeSingle();
  if (!path) {
    return NextResponse.json({ error: "Learning path not found" }, { status: 404 });
  }

  const { data: targets } = await service.from("users").select("id, manager_id").in("id", ids);
  const allowed = ((targets as { id: string; manager_id: string | null }[] | null) || [])
    .filter((t) => isPrivileged || t.manager_id === profile.id)
    .map((t) => t.id);
  if (allowed.length === 0) {
    return NextResponse.json(
      { error: isPrivileged ? "User not found" : "You can only assign paths to your own team members" },
      { status: isPrivileged ? 404 : 403 }
    );
  }

  const { data: items } = await service
    .from("learning_path_items")
    .select("course_id, sequence_order")
    .eq("path_id", pathId)
    .order("sequence_order", { ascending: true });
  const courseIds = ((items as { course_id: string | null }[] | null) || [])
    .map((i) => i.course_id)
    .filter((c): c is string => Boolean(c));

  let enrolled = 0;
  for (const userId of allowed) {
    const outcome = await grantPathAccess(service, { userId, pathId, courseIds, assignedBy: profile.id });
    if (outcome === "enrolled") {
      enrolled++;
      if (dueDate) {
        await service
          .from("learning_path_enrollments")
          .update({ due_date: dueDate })
          .eq("user_id", userId)
          .eq("path_id", pathId);
      }
    }
  }

  logAudit({
    userId: profile.id,
    action: "created",
    entityType: "learning_path_enrollment",
    entityId: path.id,
    newValues: { path_id: pathId, path_title: path.title, assigned_count: enrolled, requested: ids.length },
  });

  return NextResponse.json(
    { enrolled_count: enrolled, skipped: ids.length - enrolled },
    { status: 201 }
  );
}
