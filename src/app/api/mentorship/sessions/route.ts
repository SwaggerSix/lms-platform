import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createMentorshipSessionSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("request_id");
  const status = searchParams.get("status");

  // Get user's mentorship requests to find their sessions
  const { data: userRequests } = await service
    .from("mentorship_requests")
    .select("id")
    .or(`mentee_id.eq.${auth.user.id},mentor_id.eq.${auth.user.id}`);

  const requestIds = (userRequests ?? []).map((r: any) => r.id);

  if (requestIds.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  let query = service
    .from("mentorship_sessions")
    .select(
      "*, request:mentorship_requests!mentorship_sessions_request_id_fkey(id, mentee_id, mentor_id, goals, mentee:users!mentorship_requests_mentee_id_fkey(first_name, last_name), mentor:users!mentorship_requests_mentor_id_fkey(first_name, last_name))"
    )
    .in("request_id", requestId ? [requestId] : requestIds)
    .order("scheduled_at", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Mentorship sessions API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`session-create-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createMentorshipSessionSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify request exists and user is a participant
  const { data: mentorshipRequest } = await service
    .from("mentorship_requests")
    .select("id, mentee_id, mentor_id, status")
    .eq("id", validation.data.request_id)
    .single();

  if (!mentorshipRequest) {
    return NextResponse.json({ error: "Mentorship request not found" }, { status: 404 });
  }

  if (
    mentorshipRequest.mentee_id !== auth.user.id &&
    mentorshipRequest.mentor_id !== auth.user.id &&
    auth.user.role !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["matched", "active"].includes(mentorshipRequest.status)) {
    return NextResponse.json(
      { error: "Can only schedule sessions for matched or active mentorships" },
      { status: 400 }
    );
  }

  const { data, error } = await service
    .from("mentorship_sessions")
    .insert(validation.data)
    .select()
    .single();

  if (error) {
    console.error("Session create error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
