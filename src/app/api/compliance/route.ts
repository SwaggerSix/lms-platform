import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTenantScope } from "@/lib/tenants/tenant-queries";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const service = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await service.from("users").select("id, role").eq("auth_id", user.id).single();
  const tenantScope = profile ? await getTenantScope(profile.id, profile.role, request) : null;

  let query = service
    .from("compliance_requirements")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantScope) {
    query = query.in("course_id", tenantScope.courseIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Compliance API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const service = createServiceClient();
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, regulation, mandatory, applicable_to, linked_course, frequency } = body;

  if (!name) {
    return NextResponse.json({ error: "Requirement name is required" }, { status: 400 });
  }

  const { data, error } = await service
    .from("compliance_requirements")
    .insert({
      name,
      description: regulation || '',
      regulation: regulation || '',
      course_id: linked_course || null,
      frequency_months: frequency || 12,
      is_mandatory: mandatory !== undefined ? mandatory : true,
    })
    .select()
    .single();

  if (error) {
    console.error("Compliance API POST error:", error.message);
    return NextResponse.json({ error: "Failed to create requirement: " + error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createClient();
  const service = createServiceClient();
  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Compliance requirement id is required" }, { status: 400 });
  }

  const allowedFields = ["name", "description", "regulation", "course_id", "path_id", "frequency_months", "applicable_roles", "applicable_org_ids", "is_mandatory"] as const;
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }

  const { data, error } = await service
    .from("compliance_requirements")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Compliance API error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
  return NextResponse.json(data);
}
