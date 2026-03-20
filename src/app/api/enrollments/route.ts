import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { validateBody, createEnrollmentSchema } from "@/lib/validations";
import { logAudit } from "@/lib/audit";
import { trackLearningEvent } from "@/lib/ai/track-event";
import { getTenantScope } from "@/lib/tenants/tenant-queries";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const tenantScope = await getTenantScope(profile.id, profile.role, request);

  const userId = searchParams.get("user_id");
  if (userId && userId !== profile.id && !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const status = searchParams.get("status");
  const courseId = searchParams.get("course_id");

  let query = service
    .from("enrollments")
    .select("*, course:courses(*, category:categories(*))")
    .order("enrolled_at", { ascending: false });

  // Default to own enrollments for non-admin/manager
  if (!userId && !["admin", "manager"].includes(profile.role)) {
    query = query.eq("user_id", profile.id);
  } else if (userId) {
    query = query.eq("user_id", userId);
  }
  if (status) query = query.eq("status", status);
  if (courseId) query = query.eq("course_id", courseId);

  // Apply tenant filtering — only show enrollments for tenant courses
  if (tenantScope && tenantScope.courseIds.length > 0) {
    query = query.in("course_id", tenantScope.courseIds);
  } else if (tenantScope && tenantScope.courseIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Enrollments API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const validation = validateBody(createEnrollmentSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the user profile
  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const rl = await rateLimit(`enrollments:${profile.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  // IDOR fix: only admin/manager can enroll other users
  let targetUserId = profile.id;
  let assignedBy = null;
  if (validation.data.user_id && validation.data.user_id !== profile.id) {
    if (!["admin", "manager"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden: cannot enroll other users" }, { status: 403 });
    }
    targetUserId = validation.data.user_id;
    assignedBy = profile.id;
  }

  // Check prerequisites before enrollment
  const { data: prerequisites } = await service
    .from("course_prerequisites")
    .select("id, prerequisite_course_id, requirement_type, min_score, prerequisite_course:courses!course_prerequisites_prerequisite_course_id_fkey(title, slug)")
    .eq("course_id", validation.data.course_id);

  if (prerequisites && prerequisites.length > 0) {
    const unmetPrerequisites: {
      prerequisite_course_id: string;
      title: string;
      slug: string;
      requirement_type: string;
      min_score: number | null;
      reason: string;
    }[] = [];

    for (const prereq of prerequisites) {
      const prereqCourse = prereq.prerequisite_course as any;

      // Check user's enrollment in the prerequisite course
      const { data: prereqEnrollment } = await service
        .from("enrollments")
        .select("id, status, score")
        .eq("user_id", targetUserId)
        .eq("course_id", prereq.prerequisite_course_id)
        .maybeSingle();

      if (prereq.requirement_type === "enrollment") {
        if (!prereqEnrollment || prereqEnrollment.status === "dropped") {
          unmetPrerequisites.push({
            prerequisite_course_id: prereq.prerequisite_course_id,
            title: prereqCourse?.title || "Unknown Course",
            slug: prereqCourse?.slug || "",
            requirement_type: prereq.requirement_type,
            min_score: null,
            reason: "Must be enrolled in this course",
          });
        }
      } else if (prereq.requirement_type === "completion") {
        if (!prereqEnrollment || prereqEnrollment.status !== "completed") {
          unmetPrerequisites.push({
            prerequisite_course_id: prereq.prerequisite_course_id,
            title: prereqCourse?.title || "Unknown Course",
            slug: prereqCourse?.slug || "",
            requirement_type: prereq.requirement_type,
            min_score: null,
            reason: "Must complete this course",
          });
        }
      } else if (prereq.requirement_type === "min_score") {
        const requiredScore = prereq.min_score ?? 0;
        if (
          !prereqEnrollment ||
          prereqEnrollment.status !== "completed" ||
          (prereqEnrollment.score ?? 0) < requiredScore
        ) {
          unmetPrerequisites.push({
            prerequisite_course_id: prereq.prerequisite_course_id,
            title: prereqCourse?.title || "Unknown Course",
            slug: prereqCourse?.slug || "",
            requirement_type: prereq.requirement_type,
            min_score: requiredScore,
            reason: `Must complete this course with a score of at least ${requiredScore}%`,
          });
        }
      }
    }

    if (unmetPrerequisites.length > 0) {
      return NextResponse.json(
        {
          error: "Prerequisites not met",
          unmet_prerequisites: unmetPrerequisites,
        },
        { status: 403 }
      );
    }
  }

  // Check if the course requires approval for enrollment
  const { data: course } = await service
    .from("courses")
    .select("enrollment_type")
    .eq("id", validation.data.course_id)
    .single();

  if (course?.enrollment_type === "approval" && !["admin", "manager"].includes(profile.role)) {
    // Check for an existing pending request
    const { data: existingRequest } = await service
      .from("enrollment_approvals")
      .select("id, status")
      .eq("course_id", validation.data.course_id)
      .eq("learner_id", targetUserId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json(
        { message: "Enrollment request already pending", approval: existingRequest },
        { status: 202 }
      );
    }

    // Determine the approver (the learner's manager)
    const { data: learnerProfile } = await service
      .from("users")
      .select("manager_id")
      .eq("id", targetUserId)
      .single();

    // Create an approval request instead of directly enrolling
    const { data: approvalData, error: approvalError } = await service
      .from("enrollment_approvals")
      .insert({
        course_id: validation.data.course_id,
        learner_id: targetUserId,
        approver_id: learnerProfile?.manager_id || null,
        status: "pending",
        reason: validation.data.reason || null,
      })
      .select()
      .single();

    if (approvalError) {
      console.error("Enrollment approval error:", approvalError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // Notify the manager if one exists
    if (learnerProfile?.manager_id) {
      try {
        await service.from("notifications").insert({
          user_id: learnerProfile.manager_id,
          type: "enrollment",
          title: "Enrollment Request",
          body: "A team member has requested enrollment in a course that requires approval.",
          link: "/manager/approvals",
          is_read: false,
        });
      } catch {
        // Non-critical: don't fail the approval request if notification fails
      }
    }

    return NextResponse.json(
      { message: "Enrollment request submitted for approval", approval: approvalData },
      { status: 202 }
    );
  }

  const enrollmentData = {
    user_id: targetUserId,
    course_id: validation.data.course_id,
    due_date: validation.data.due_date || null,
    assigned_by: assignedBy,
  };

  const { data, error } = await service
    .from("enrollments")
    .insert(enrollmentData)
    .select("*, course:courses(*)")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already enrolled in this course" }, { status: 409 });
    }
    console.error("Enrollments API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Award points for enrollment
  await service.from("points_ledger").insert({
    user_id: enrollmentData.user_id,
    action_type: "enrollment",
    points: 10,
    reference_type: "course",
    reference_id: validation.data.course_id,
  });

  // Track enrollment event (fire-and-forget)
  trackLearningEvent({
    userId: targetUserId,
    eventType: "enroll",
    courseId: validation.data.course_id,
    metadata: { assigned_by: assignedBy },
  }).catch(() => {});

  // Fire webhook (non-blocking)
  dispatchWebhook("enrollment.created", {
    enrollment_id: data.id,
    user_id: enrollmentData.user_id,
    course_id: validation.data.course_id,
  }).catch(() => {});

  logAudit({
    userId: profile.id,
    action: "created",
    entityType: "enrollment",
    entityId: data.id,
    newValues: { user_id: enrollmentData.user_id, course_id: validation.data.course_id },
  });

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const { data: authUser } = await supabase.auth.getUser();
  if (!authUser.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("users")
    .select("id, role")
    .eq("auth_id", authUser.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "User profile not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Enrollment id is required" }, { status: 400 });
  }

  // IDOR fix: verify enrollment belongs to authenticated user or user is admin
  const { data: enrollment } = await service
    .from("enrollments")
    .select("user_id")
    .eq("id", id)
    .single();

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  if (enrollment.user_id !== profile.id && profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await service
    .from("enrollments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Enrollments API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  logAudit({
    userId: profile.id,
    action: "deleted",
    entityType: "enrollment",
    entityId: id,
  });

  return NextResponse.json({ message: "Enrollment cancelled" });
}
