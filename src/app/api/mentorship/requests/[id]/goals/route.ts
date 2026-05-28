import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { canAccessMentorshipRequest } from "@/lib/mentorship/access";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: requestId } = await params;
  const access = await canAccessMentorshipRequest(requestId, auth.user.id, auth.user.role);
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("mentorship_goals")
    .select("*")
    .eq("request_id", requestId)
    .order("status", { ascending: true })
    .order("target_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Mentorship goals list error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ goals: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: requestId } = await params;
  const access = await canAccessMentorshipRequest(requestId, auth.user.id, auth.user.role);
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (title.length > 200) return NextResponse.json({ error: "Title is too long" }, { status: 400 });

  const description = typeof body.description === "string" ? body.description.trim() : null;
  const targetDate = typeof body.target_date === "string" && body.target_date ? body.target_date : null;

  const service = createServiceClient();
  const { data, error } = await service
    .from("mentorship_goals")
    .insert({
      request_id: requestId,
      title,
      description,
      target_date: targetDate,
      created_by: auth.user.id,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Mentorship goal create error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
