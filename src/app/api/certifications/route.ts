import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { validateBody, createCertificationSchema } from "@/lib/validations";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tenantScope = await getTenantScope(profile.id, profile.role, request);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  if (userId && userId !== profile.id && !["admin", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (userId) {
    const { data, error } = await service
      .from("user_certifications")
      .select("*, certification:certifications(*)")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false });

    if (error) {
    console.error("Certifications API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
    return NextResponse.json(data);
  }

  const { data, error } = await service
    .from("certifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Certifications API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const validation = validateBody(createCertificationSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Mass assignment fix: whitelist allowed fields
  const allowedPostFields = ["name", "description", "course_id", "validity_period_days", "badge_image_url", "issuing_authority", "status"];
  const sanitized = Object.fromEntries(
    Object.entries(validation.data).filter(([key]) => allowedPostFields.includes(key))
  );

  const { data, error } = await service
    .from("certifications")
    .insert(sanitized)
    .select()
    .single();

  if (error) {
    console.error("Certifications API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Certification id is required" }, { status: 400 });
  }

  // Mass assignment fix: whitelist allowed fields
  const allowedPatchFields = ["name", "description", "course_id", "validity_period_days", "badge_image_url", "issuing_authority", "status"];
  const sanitizedUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => allowedPatchFields.includes(key))
  );

  const { data, error } = await service
    .from("certifications")
    .update(sanitizedUpdates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Certifications API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize("admin");
  const service = createServiceClient();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Certification id is required" }, { status: 400 });
  }

  const { error } = await service
    .from("certifications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Certifications API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json({ message: "Certification deleted" });
}
