import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateMentorshipRequestSchema } from "@/lib/validations";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateMentorshipRequestSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Get existing request
  const { data: existing } = await service
    .from("mentorship_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Only mentee, mentor, or admin can update
  const isParticipant =
    existing.mentee_id === auth.user.id || existing.mentor_id === auth.user.id;
  const isAdmin = auth.user.role === "admin";

  if (!isParticipant && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updates: any = { status: validation.data.status };

  // Handle status transitions
  if (validation.data.status === "active" && existing.status === "matched") {
    // Mentor accepts - increment mentee count
    await service
      .from("mentor_profiles")
      .update({ current_mentee_count: ((existing as Record<string, unknown>).current_mentee_count as number || 0) + 1 })
      .eq("user_id", existing.mentor_id);
  }

  if (validation.data.status === "completed") {
    updates.completed_at = new Date().toISOString();
    // Decrement mentee count
    if (existing.mentor_id) {
      const { data: profile } = await service
        .from("mentor_profiles")
        .select("current_mentee_count")
        .eq("user_id", existing.mentor_id)
        .single();

      if (profile) {
        await service
          .from("mentor_profiles")
          .update({
            current_mentee_count: Math.max(0, (profile.current_mentee_count ?? 1) - 1),
          })
          .eq("user_id", existing.mentor_id);
      }
    }
  }

  if (validation.data.status === "cancelled") {
    // Decrement if was active
    if (existing.status === "active" && existing.mentor_id) {
      const { data: profile } = await service
        .from("mentor_profiles")
        .select("current_mentee_count")
        .eq("user_id", existing.mentor_id)
        .single();

      if (profile) {
        await service
          .from("mentor_profiles")
          .update({
            current_mentee_count: Math.max(0, (profile.current_mentee_count ?? 1) - 1),
          })
          .eq("user_id", existing.mentor_id);
      }
    }
  }

  const { data, error } = await service
    .from("mentorship_requests")
    .update(updates)
    .eq("id", id)
    .select(
      "*, mentee:users!mentorship_requests_mentee_id_fkey(id, first_name, last_name), mentor:users!mentorship_requests_mentor_id_fkey(id, first_name, last_name)"
    )
    .single();

  if (error) {
    console.error("Mentorship request update error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  // Verify ownership
  const { data: existing } = await service
    .from("mentorship_requests")
    .select("mentee_id, status")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (existing.mentee_id !== auth.user.id && auth.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.status === "active") {
    return NextResponse.json(
      { error: "Cannot delete an active mentorship. Cancel it first." },
      { status: 400 }
    );
  }

  const { error } = await service
    .from("mentorship_requests")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Mentorship request delete error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Request deleted" });
}
