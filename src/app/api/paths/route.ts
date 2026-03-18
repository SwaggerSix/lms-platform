import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createPathSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "published";
  const service = createServiceClient();

  const { data, error } = await service
    .from("learning_paths")
    .select("*, items:learning_path_items(*, course:courses(*))")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Paths API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const validation = validateBody(createPathSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { items, ...pathData } = validation.data;
  const service = createServiceClient();

  const { data: path, error } = await service
    .from("learning_paths")
    .insert(pathData)
    .select()
    .single();

  if (error) {
    console.error("Paths API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (items?.length) {
    const pathItems = items.map((item: Record<string, unknown>, i: number) => ({
      ...item,
      path_id: path.id,
      sequence_order: i + 1,
    }));
    await service.from("learning_path_items").insert(pathItems);
  }

  return NextResponse.json(path, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const { id, items } = body;

  if (!id) {
    return NextResponse.json({ error: "Learning path id is required" }, { status: 400 });
  }

  const allowedFields = ["title", "description", "slug", "status", "difficulty", "estimated_duration", "thumbnail_url"] as const;
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  const service = createServiceClient();

  const { data, error } = await service
    .from("learning_paths")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Paths API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  if (items?.length) {
    await service.from("learning_path_items").delete().eq("path_id", id);
    const pathItems = items.map((item: Record<string, unknown>, i: number) => ({
      ...item,
      path_id: id,
      sequence_order: i + 1,
    }));
    await service.from("learning_path_items").insert(pathItems);
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Learning path id is required" }, { status: 400 });
  }
  const service = createServiceClient();

  const { error } = await service
    .from("learning_paths")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Paths API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Learning path deleted" });
}
