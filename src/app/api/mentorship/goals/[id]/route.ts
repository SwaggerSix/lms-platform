import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { canAccessMentorshipRequest } from "@/lib/mentorship/access";

async function loadGoal(goalId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("mentorship_goals")
    .select("id, request_id")
    .eq("id", goalId)
    .single();
  return data;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: goalId } = await params;
  const goal = await loadGoal(goalId);
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const access = await canAccessMentorshipRequest(goal.request_id, auth.user.id, auth.user.role);
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    if (t.length > 200) return NextResponse.json({ error: "Title is too long" }, { status: 400 });
    updates.title = t;
  }
  if (body.description === null || typeof body.description === "string") {
    updates.description = body.description ? String(body.description).trim() : null;
  }
  if (body.target_date === null || typeof body.target_date === "string") {
    updates.target_date = body.target_date || null;
  }
  if (typeof body.status === "string") {
    if (body.status !== "open" && body.status !== "done") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
    updates.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  const service = createServiceClient();
  const { data, error } = await service
    .from("mentorship_goals")
    .update(updates)
    .eq("id", goalId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Mentorship goal update error:", error?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: goalId } = await params;
  const goal = await loadGoal(goalId);
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const access = await canAccessMentorshipRequest(goal.request_id, auth.user.id, auth.user.role);
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service.from("mentorship_goals").delete().eq("id", goalId);

  if (error) {
    console.error("Mentorship goal delete error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
