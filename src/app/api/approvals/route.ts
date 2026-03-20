import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import type { ApprovalStatus } from "@/types/database";

/**
 * GET /api/approvals
 * Fetch approval requests with optional filters.
 *
 * Query params:
 *   - status: ApprovalStatus (pending | approved | rejected | cancelled)
 *   - approver_id: string
 *   - learner_id: string
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as ApprovalStatus | null;
  const approverId = searchParams.get("approver_id");
  const learnerId = searchParams.get("learner_id");
  const service = createServiceClient();

  let query = service
    .from("enrollment_approvals")
    .select("*")
    .order("requested_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }
  if (approverId) {
    query = query.eq("approver_id", approverId);
  }
  if (learnerId) {
    query = query.eq("learner_id", learnerId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Approvals GET error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: data?.length ?? 0,
  });
}

/**
 * POST /api/approvals
 * Create a new enrollment approval request.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    if (!body.course_id) {
      return NextResponse.json(
        { error: "course_id is required" },
        { status: 400 }
      );
    }
    const service = createServiceClient();

    // Derive learner_id from authenticated user — don't trust client input
    const { data: profile } = await service
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data, error } = await service
      .from("enrollment_approvals")
      .insert({
        enrollment_id: body.enrollment_id || null,
        course_id: body.course_id,
        learner_id: profile.id,
        approver_id: null,
        status: "pending",
        reason: body.reason || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Approvals API error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/approvals
 * Update an approval status (approve or reject).
 */
export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const supabase = await createClient();
    const body = await request.json();

    if (!body.id || !body.status) {
      return NextResponse.json(
        { error: "id and status are required" },
        { status: 400 }
      );
    }

    if (!["approved", "rejected"].includes(body.status)) {
      return NextResponse.json(
        { error: "status must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    if (body.status === "rejected" && !body.rejection_reason) {
      return NextResponse.json(
        { error: "rejection_reason is required when rejecting" },
        { status: 400 }
      );
    }
    const service = createServiceClient();

    // Check current status
    const { data: existing, error: fetchError } = await service
      .from("enrollment_approvals")
      .select("status")
      .eq("id", body.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Approval request not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending requests can be updated" },
        { status: 409 }
      );
    }

    const { data, error } = await service
      .from("enrollment_approvals")
      .update({
        status: body.status,
        decided_at: new Date().toISOString(),
        approver_id: auth.user.id,
        rejection_reason: body.status === "rejected" ? body.rejection_reason : null,
        notes: body.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      console.error("Approvals API error:", error.message);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    // When approved, create the actual enrollment and notify the user
    if (body.status === "approved") {
      const { data: approval } = await service
        .from("enrollment_approvals")
        .select("learner_id, course_id")
        .eq("id", body.id)
        .single();

      if (approval) {
        // Create the actual enrollment (status must match check constraint: enrolled, in_progress, completed, failed, expired)
        await service.from("enrollments").insert({
          user_id: approval.learner_id,
          course_id: approval.course_id,
          status: "enrolled",
          enrolled_at: new Date().toISOString(),
        });

        // Notify the user
        await service.from("notifications").insert({
          user_id: approval.learner_id,
          title: "Enrollment Approved",
          body: "Your enrollment request has been approved. You can now start the course.",
          type: "enrollment",
          is_read: false,
        });
      }
    }

    // When rejected, notify the user
    if (body.status === "rejected") {
      const { data: approval } = await service
        .from("enrollment_approvals")
        .select("learner_id")
        .eq("id", body.id)
        .single();

      if (approval) {
        await service.from("notifications").insert({
          user_id: approval.learner_id,
          title: "Enrollment Rejected",
          body: body.rejection_reason || "Your enrollment request was not approved.",
          type: "enrollment",
          is_read: false,
        });
      }
    }

    return NextResponse.json({ data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
