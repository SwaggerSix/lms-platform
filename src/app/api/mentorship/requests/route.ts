import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createMentorshipRequestSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "mentee"; // "mentee" or "mentor"
  const status = searchParams.get("status");

  let query = service
    .from("mentorship_requests")
    .select(
      "*, mentee:users!mentorship_requests_mentee_id_fkey(id, first_name, last_name, email), mentor:users!mentorship_requests_mentor_id_fkey(id, first_name, last_name, email)"
    )
    .order("created_at", { ascending: false });

  if (role === "mentor") {
    query = query.eq("mentor_id", auth.user.id);
  } else {
    query = query.eq("mentee_id", auth.user.id);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Mentorship requests API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`mentorship-request-${auth.user.id}`, 5, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createMentorshipRequestSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Check for existing pending request
  const { data: existing } = await service
    .from("mentorship_requests")
    .select("id")
    .eq("mentee_id", auth.user.id)
    .in("status", ["pending", "matched", "active"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "You already have an active mentorship request" },
      { status: 409 }
    );
  }

  const requestData: any = {
    mentee_id: auth.user.id,
    goals: validation.data.goals,
    preferred_areas: validation.data.preferred_areas,
  };

  // If a specific mentor was requested
  if (validation.data.mentor_id) {
    // Verify mentor exists and has capacity
    const { data: mentor } = await service
      .from("mentor_profiles")
      .select("user_id, current_mentee_count, max_mentees, availability")
      .eq("user_id", validation.data.mentor_id)
      .eq("is_active", true)
      .single();

    if (!mentor) {
      return NextResponse.json({ error: "Mentor not found" }, { status: 404 });
    }

    if (mentor.current_mentee_count >= mentor.max_mentees) {
      return NextResponse.json({ error: "Mentor has no available capacity" }, { status: 409 });
    }

    if (mentor.availability === "unavailable") {
      return NextResponse.json({ error: "Mentor is currently unavailable" }, { status: 409 });
    }

    requestData.mentor_id = validation.data.mentor_id;
    requestData.status = "matched";
    requestData.matched_at = new Date().toISOString();
  }

  const { data, error } = await service
    .from("mentorship_requests")
    .insert(requestData)
    .select(
      "*, mentee:users!mentorship_requests_mentee_id_fkey(id, first_name, last_name), mentor:users!mentorship_requests_mentor_id_fkey(id, first_name, last_name)"
    )
    .single();

  if (error) {
    console.error("Mentorship request create error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
