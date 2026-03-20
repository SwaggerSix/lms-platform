import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createFeedbackResponseSchema, updateFeedbackResponseSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const nominationId = searchParams.get("nomination_id");

  const service = createServiceClient();

  if (nominationId) {
    // Verify the user is the reviewer for this nomination
    const { data: nomination } = await service
      .from("feedback_nominations")
      .select("reviewer_id")
      .eq("id", nominationId)
      .single();

    if (!nomination || nomination.reviewer_id !== auth.user.id) {
      // Allow admins to view any
      const { data: dbUser } = await service.from("users").select("role").eq("id", auth.user.id).single();
      if (!dbUser || dbUser.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data, error } = await service
      .from("feedback_responses")
      .select("*")
      .eq("nomination_id", nominationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    return NextResponse.json({ response: data || null });
  }

  // Get all responses for nominations where user is reviewer
  const { data: nominations } = await service
    .from("feedback_nominations")
    .select("id")
    .eq("reviewer_id", auth.user.id);

  if (!nominations || nominations.length === 0) {
    return NextResponse.json({ responses: [] });
  }

  const nomIds = nominations.map((n) => n.id);
  const { data, error } = await service
    .from("feedback_responses")
    .select("*")
    .in("nomination_id", nomIds)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ responses: data });
}

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`feedback-response-${auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createFeedbackResponseSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Verify the user is the reviewer
  const { data: nomination } = await service
    .from("feedback_nominations")
    .select("id, reviewer_id, status")
    .eq("id", validation.data.nomination_id)
    .single();

  if (!nomination || nomination.reviewer_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (nomination.status === "completed") {
    return NextResponse.json({ error: "Feedback already submitted" }, { status: 400 });
  }

  const isDraft = validation.data.is_draft;
  const { data, error } = await service
    .from("feedback_responses")
    .insert({
      nomination_id: validation.data.nomination_id,
      answers: validation.data.answers,
      is_draft: isDraft,
      submitted_at: isDraft ? null : new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Feedback response POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Update nomination status
  await service
    .from("feedback_nominations")
    .update({ status: isDraft ? "in_progress" : "completed" })
    .eq("id", validation.data.nomination_id);

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateFeedbackResponseSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const service = createServiceClient();

  // Verify ownership
  const { data: existing } = await service
    .from("feedback_responses")
    .select("*, nomination:feedback_nominations(reviewer_id)")
    .eq("id", validation.data.id)
    .single();

  if (!existing || (existing.nomination as any)?.reviewer_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (existing.submitted_at && !existing.is_draft) {
    return NextResponse.json({ error: "Cannot edit submitted feedback" }, { status: 400 });
  }

  const isDraft = validation.data.is_draft;
  const { data, error } = await service
    .from("feedback_responses")
    .update({
      answers: validation.data.answers,
      is_draft: isDraft,
      submitted_at: isDraft ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", validation.data.id)
    .select()
    .single();

  if (error) {
    console.error("Feedback response PUT error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Update nomination status
  if (!isDraft) {
    const nomId = (existing as any).nomination_id;
    await service
      .from("feedback_nominations")
      .update({ status: "completed" })
      .eq("id", nomId);
  }

  return NextResponse.json(data);
}
