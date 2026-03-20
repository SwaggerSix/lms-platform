import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "active";

  let query = service
    .from("certificate_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Certificate templates API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const body = await request.json();

  const { name, description, design_data, is_default } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  if (!design_data || typeof design_data !== "object") {
    return NextResponse.json({ error: "Design data is required" }, { status: 400 });
  }

  // If this is being set as default, unset any existing default
  if (is_default) {
    await service
      .from("certificate_templates")
      .update({ is_default: false })
      .eq("is_default", true);
  }

  const { data, error } = await service
    .from("certificate_templates")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      design_data,
      is_default: is_default || false,
      created_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Certificate templates API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  // Whitelist allowed fields
  const allowedFields = ["name", "description", "design_data", "is_default", "status", "thumbnail_url"];
  const sanitized: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in updates) {
      sanitized[key] = updates[key];
    }
  }
  sanitized.updated_at = new Date().toISOString();

  // If setting as default, unset others first
  if (sanitized.is_default === true) {
    await service
      .from("certificate_templates")
      .update({ is_default: false })
      .eq("is_default", true);
  }

  const { data, error } = await service
    .from("certificate_templates")
    .update(sanitized)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Certificate templates API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  // Archive instead of hard delete
  const { data, error } = await service
    .from("certificate_templates")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Certificate templates API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Template archived", data });
}
