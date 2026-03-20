import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, updateNuggetSchema } from "@/lib/validations";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("microlearning_nuggets")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Nugget not found" }, { status: 404 });
  }

  // Increment view count (non-blocking)
  service
    .from("microlearning_nuggets")
    .update({ view_count: (data.view_count || 0) + 1 })
    .eq("id", id)
    .then(() => {});

  // Get user progress
  const { data: progress } = await service
    .from("microlearning_progress")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("nugget_id", id)
    .single();

  return NextResponse.json({ ...data, user_progress: progress || null });
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

  const validation = validateBody(updateNuggetSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // If instructor, verify ownership
  if (auth.user.role === "instructor") {
    const { data: nugget } = await service
      .from("microlearning_nuggets")
      .select("created_by")
      .eq("id", id)
      .single();
    if (!nugget || nugget.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await service
    .from("microlearning_nuggets")
    .update({ ...validation.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Nugget PUT error:", error.message);
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
    const { data: nugget } = await service
      .from("microlearning_nuggets")
      .select("created_by")
      .eq("id", id)
      .single();
    if (!nugget || nugget.created_by !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await service
    .from("microlearning_nuggets")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Nugget DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Nugget deleted" });
}
