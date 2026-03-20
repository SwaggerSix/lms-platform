import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, updateMentorshipSessionSchema } from "@/lib/validations";

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

  const validation = validateBody(updateMentorshipSessionSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify session exists and user is a participant
  const { data: session } = await service
    .from("mentorship_sessions")
    .select(
      "id, request:mentorship_requests!mentorship_sessions_request_id_fkey(mentee_id, mentor_id)"
    )
    .eq("id", id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const req = session.request as any;
  if (
    req?.mentee_id !== auth.user.id &&
    req?.mentor_id !== auth.user.id &&
    auth.user.role !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await service
    .from("mentorship_sessions")
    .update(validation.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Session update error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}
