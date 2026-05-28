import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";

// Admin/manager direct assignment of a mentor to a mentee. Creates an active
// mentorship_request linking the two and bumps the mentor's mentee count.
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const menteeId = typeof body.mentee_id === "string" ? body.mentee_id : null;
  const mentorId = typeof body.mentor_id === "string" ? body.mentor_id : null;
  const goals = typeof body.goals === "string" && body.goals.trim() ? body.goals.trim() : null;
  const preferredAreas = Array.isArray(body.preferred_areas) ? body.preferred_areas : null;

  if (!menteeId || !mentorId) {
    return NextResponse.json({ error: "Both a mentee and a mentor are required" }, { status: 400 });
  }
  if (menteeId === mentorId) {
    return NextResponse.json({ error: "A user cannot be assigned as their own mentor" }, { status: 400 });
  }

  const service = createServiceClient();

  // The mentee must not already have an open mentorship.
  const { data: existing } = await service
    .from("mentorship_requests")
    .select("id")
    .eq("mentee_id", menteeId)
    .in("status", ["pending", "matched", "active"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "This mentee already has an open mentorship. Complete or cancel it first." },
      { status: 409 }
    );
  }

  // Verify the mentor has an active profile with capacity.
  const { data: mentor } = await service
    .from("mentor_profiles")
    .select("user_id, current_mentee_count, max_mentees, availability")
    .eq("user_id", mentorId)
    .eq("is_active", true)
    .single();

  if (!mentor) {
    return NextResponse.json({ error: "The selected mentor does not have an active profile" }, { status: 404 });
  }
  if (mentor.current_mentee_count >= mentor.max_mentees) {
    return NextResponse.json({ error: "This mentor has no available capacity" }, { status: 409 });
  }
  if (mentor.availability === "unavailable") {
    return NextResponse.json({ error: "This mentor is currently unavailable" }, { status: 409 });
  }

  const { data, error } = await service
    .from("mentorship_requests")
    .insert({
      mentee_id: menteeId,
      mentor_id: mentorId,
      goals,
      preferred_areas: preferredAreas,
      status: "active",
      matched_at: new Date().toISOString(),
    })
    .select(
      "*, mentee:users!mentorship_requests_mentee_id_fkey(id, first_name, last_name, email), mentor:users!mentorship_requests_mentor_id_fkey(id, first_name, last_name, email)"
    )
    .single();

  if (error) {
    console.error("Mentor assignment error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  await service
    .from("mentor_profiles")
    .update({ current_mentee_count: (mentor.current_mentee_count ?? 0) + 1 })
    .eq("user_id", mentorId);

  return NextResponse.json(data, { status: 201 });
}
