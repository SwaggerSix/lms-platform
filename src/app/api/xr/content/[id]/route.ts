import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, updateXRContentSchema } from "@/lib/validations";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("xr_content")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "XR content not found" }, { status: 404 });
  }

  // Get session stats
  const { data: sessions } = await service
    .from("xr_sessions")
    .select("id, completed, duration_seconds")
    .eq("content_id", id);

  const stats = {
    total_sessions: sessions?.length || 0,
    completed_sessions: sessions?.filter((s) => s.completed).length || 0,
    avg_duration:
      Math.round(
        (sessions ?? []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0) /
          Math.max(sessions?.length || 1, 1)
      ),
  };

  return NextResponse.json({ ...data, stats });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateXRContentSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  if (auth.user.role === "instructor") {
    const { data: content } = await service
      .from("xr_content")
      .select("created_by")
      .eq("id", id)
      .single();
    if (!content || content.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await service
    .from("xr_content")
    .update({ ...validation.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("XR content PUT error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin", "instructor");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  if (auth.user.role === "instructor") {
    const { data: content } = await service
      .from("xr_content")
      .select("created_by")
      .eq("id", id)
      .single();
    if (!content || content.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await service
    .from("xr_content")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("XR content DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "XR content deleted" });
}
