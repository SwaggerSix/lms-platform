import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createXRSessionSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`xr-session-${auth.user.id}`, 30, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createXRSessionSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Verify content exists
  const { data: content } = await service
    .from("xr_content")
    .select("id")
    .eq("id", validation.data.content_id)
    .single();

  if (!content) {
    return NextResponse.json({ error: "XR content not found" }, { status: 404 });
  }

  // If this is ending an existing session (has duration_seconds and/or completed), update it
  if (validation.data.duration_seconds != null || validation.data.completed) {
    // Find the most recent open session for this user + content
    const { data: existing } = await service
      .from("xr_sessions")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("content_id", validation.data.content_id)
      .eq("completed", false)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (validation.data.duration_seconds != null) updateData.duration_seconds = validation.data.duration_seconds;
      if (validation.data.interactions) updateData.interactions = validation.data.interactions;
      if (validation.data.completed) {
        updateData.completed = true;
        updateData.completed_at = new Date().toISOString();
      }

      const { data, error } = await service
        .from("xr_sessions")
        .update(updateData)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("XR session update error:", error.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
      }

      return NextResponse.json(data);
    }
  }

  // Create new session
  const { data, error } = await service
    .from("xr_sessions")
    .insert({
      user_id: auth.user.id,
      content_id: validation.data.content_id,
      device_type: validation.data.device_type || null,
      duration_seconds: validation.data.duration_seconds || null,
      interactions: validation.data.interactions || [],
      completed: validation.data.completed || false,
      started_at: new Date().toISOString(),
      completed_at: validation.data.completed ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    console.error("XR session POST error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
