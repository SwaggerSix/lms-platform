import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, updateMarketplaceProviderSchema } from "@/lib/validations";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { data, error } = await service
    .from("marketplace_providers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  // Get course count and enrollment stats
  const { count: courseCount } = await service
    .from("marketplace_courses")
    .select("*", { count: "exact", head: true })
    .eq("provider_id", id);

  const { count: enrollmentCount } = await service
    .from("marketplace_enrollments")
    .select("*, marketplace_courses!inner(provider_id)", { count: "exact", head: true })
    .eq("marketplace_courses.provider_id", id);

  return NextResponse.json({
    ...data,
    stats: {
      total_courses: courseCount || 0,
      total_enrollments: enrollmentCount || 0,
    },
  });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(updateMarketplaceProviderSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("marketplace_providers")
    .update({ ...validation.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Marketplace provider PUT error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const service = createServiceClient();

  const { error } = await service
    .from("marketplace_providers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Marketplace provider DELETE error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ message: "Provider deleted" });
}
