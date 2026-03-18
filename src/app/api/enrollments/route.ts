import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { dispatchWebhook } from "@/lib/webhooks/dispatcher";
import { validateBody, createEnrollmentSchema } from "@/lib/validations";

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

  if (userId) query = query.eq("user_id", userId);
  if (status) query = query.eq("status", status);
  if (courseId) query = query.eq("course_id", courseId);

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

  // Check if the course requires approval for enrollment
  const { data: course } = await service
    .from("courses")
    .select("enrollment_type")
    .eq("id", validation.data.course_id)
    .single();

  if (course?.enrollment_type === "approval" && !["admin", "manager"].includes(profile.role)) {
    // Create an approval request instead of directly enrolling
    const { data: approvalData, error: approvalError } = await service
      .from("enrollment_approvals")
      .insert({
        course_id: validation.data.course_id,
        learner_id: targetUserId,
        status: "pending",
        reason: null,
      })
      .select()
      .single();

    if (approvalError) {
      console.error("Enrollment approval error:", approvalError.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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

  // Fire webhook (non-blocking)
  dispatchWebhook("enrollment.created", {
    enrollment_id: data.id,
    user_id: enrollmentData.user_id,
    course_id: validation.data.course_id,
  }).catch(() => {});

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

  return NextResponse.json({ message: "Enrollment cancelled" });
}
