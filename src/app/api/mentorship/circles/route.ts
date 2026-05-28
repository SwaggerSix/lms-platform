import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

// List all circles with their members. Anyone authenticated can read the
// directory (so learners can browse what exists); creating/editing is gated
// to admin/manager.
export async function GET() {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { data, error } = await service
    .from("mentorship_circles")
    .select(
      "id, name, description, mentor_id, max_members, created_at, mentor:users!mentorship_circles_mentor_id_fkey(first_name, last_name, email), members:mentorship_circle_members(mentee_id, joined_at, mentee:users!mentorship_circle_members_mentee_id_fkey(first_name, last_name, email))"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Circles list error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ circles: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const mentorId = typeof body.mentor_id === "string" ? body.mentor_id : null;
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const maxMembers = Number.isFinite(body.max_members) ? Math.max(1, Math.min(50, Number(body.max_members))) : 6;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!mentorId) return NextResponse.json({ error: "Mentor is required" }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: "Name is too long" }, { status: 400 });

  const service = createServiceClient();
  const { data: mentor } = await service
    .from("mentor_profiles")
    .select("user_id, is_active")
    .eq("user_id", mentorId)
    .single();
  if (!mentor) {
    return NextResponse.json({ error: "Selected mentor does not have a mentor profile" }, { status: 400 });
  }

  const { data, error } = await service
    .from("mentorship_circles")
    .insert({ name, description, mentor_id: mentorId, max_members: maxMembers })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Circle create error:", error?.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
