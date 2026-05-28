import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

// Add a mentee to a circle. Admin/manager only. Enforces the circle's
// max_members cap and prevents the mentor from being their own mentee.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: circleId } = await params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const menteeId = typeof body.mentee_id === "string" ? body.mentee_id : null;
  if (!menteeId) return NextResponse.json({ error: "mentee_id is required" }, { status: 400 });

  const service = createServiceClient();
  const { data: circle } = await service
    .from("mentorship_circles")
    .select("id, mentor_id, max_members")
    .eq("id", circleId)
    .single();
  if (!circle) return NextResponse.json({ error: "Circle not found" }, { status: 404 });
  if (circle.mentor_id === menteeId) {
    return NextResponse.json({ error: "The mentor cannot be a mentee in their own circle" }, { status: 400 });
  }

  const { count } = await service
    .from("mentorship_circle_members")
    .select("mentee_id", { count: "exact", head: true })
    .eq("circle_id", circleId);
  if ((count ?? 0) >= circle.max_members) {
    return NextResponse.json({ error: "Circle is full" }, { status: 409 });
  }

  const { error } = await service
    .from("mentorship_circle_members")
    .insert({ circle_id: circleId, mentee_id: menteeId });
  if (error) {
    // Most common cause: duplicate primary key (already a member).
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already a member of this circle" }, { status: 409 });
    }
    console.error("Circle member add error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: circleId } = await params;
  const url = new URL(request.url);
  const menteeId = url.searchParams.get("mentee_id");
  if (!menteeId) return NextResponse.json({ error: "mentee_id is required" }, { status: 400 });

  const service = createServiceClient();
  const { error } = await service
    .from("mentorship_circle_members")
    .delete()
    .eq("circle_id", circleId)
    .eq("mentee_id", menteeId);
  if (error) {
    console.error("Circle member remove error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
